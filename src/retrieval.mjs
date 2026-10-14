import { createHash } from 'node:crypto';
import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { retrieveArticles } from './support.mjs';

export const EMBEDDING_MODEL='qwen3-embedding:0.6b';
export function knowledgeFingerprint(articles){return createHash('sha256').update(JSON.stringify(articles.filter(a=>a.state==='approved'&&a.audience==='customer').map(a=>[a.id,a.version,a.title,a.content,a.scope,a.search_description]).sort((a,b)=>a[0].localeCompare(b[0])))).digest('hex');}
export function chunkArticle(article){
  const parts=article.content.split(/^## /m).map((part,index)=>({heading:index?part.split('\n')[0]:'Überblick',body:index?part.slice(part.indexOf('\n')+1):part}));
  // A concise question/scope description prevents an incidental exception in
  // another article from becoming the strongest routing signal.
  const chunks=[{article_id:article.id,version:article.version,chunk_id:`${article.id}@${article.version}#0`,heading:'Suchbeschreibung',text:`${article.title}\n${article.search_description??parts.find(p=>/Problem/.test(p.heading))?.body??''}`,routing:true}];
  for(const part of parts)for(let offset=0;offset<part.body.length;offset+=800){const body=part.body.slice(offset,offset+1000).trim();if(body.length<20)continue;chunks.push({article_id:article.id,version:article.version,chunk_id:`${article.id}@${article.version}#${chunks.length+1}`,heading:part.heading,text:`${article.title}\n${part.heading}\n${body}`});}
  return chunks;
}
export function cosine(a,b){if(!Array.isArray(a)||!Array.isArray(b)||a.length!==b.length||!a.length)throw new Error('Embedding-Dimensionen stimmen nicht überein.');let dot=0,aa=0,bb=0;for(let i=0;i<a.length;i++){if(!Number.isFinite(a[i])||!Number.isFinite(b[i]))throw new Error('Ungültiges Embedding.');dot+=a[i]*b[i];aa+=a[i]**2;bb+=b[i]**2;}if(!aa||!bb)throw new Error('Leeres Embedding.');return dot/Math.sqrt(aa*bb);}
export async function embedLocal(texts,{fetcher=fetch,model=EMBEDDING_MODEL}={}){
  if(/cloud/i.test(model))throw new Error('Embedding-Modell muss lokal sein.');
  const response=await fetcher('http://127.0.0.1:11434/api/embed',{method:'POST',headers:{'Content-Type':'application/json'},signal:AbortSignal.timeout(90000),body:JSON.stringify({model,input:texts,truncate:false,keep_alive:'5m'})});
  if(!response.ok)throw new Error('Lokales Embedding-Modell ist nicht bereit.');
  const value=await response.json();if(!Array.isArray(value.embeddings)||value.embeddings.length!==texts.length)throw new Error('Embedding-Antwort unvollständig.');
  const length=value.embeddings[0]?.length;for(const vector of value.embeddings){if(vector.length!==length)throw new Error('Embedding-Dimensionen inkonsistent.');cosine(vector,vector);}return value.embeddings;
}
export class SemanticIndex{
  constructor({fetcher=fetch,embedder=null,directory=null,minScore=.43}={}){this.embed=embedder??(texts=>embedLocal(texts,{fetcher}));this.directory=directory;this.minScore=minScore;this.chunks=[];this.signature=null;this.builtAt=null;this.error=null;this.building=null;}
  status(articles){return {ready:this.signature===knowledgeFingerprint(articles)&&!!this.builtAt,building:!!this.building,chunks:this.chunks.length,articles:new Set(this.chunks.map(c=>c.article_id)).size,model:EMBEDDING_MODEL,built_at:this.builtAt,source_fingerprint:knowledgeFingerprint(articles),index_fingerprint:this.signature,error:this.error};}
  async rebuild(articles){
    if(this.building)await this.building;
    const eligible=articles.filter(a=>a.state==='approved'&&a.audience==='customer');const signature=knowledgeFingerprint(eligible);
    this.building=(async()=>{
      try{const chunks=eligible.flatMap(chunkArticle);const vectors=chunks.length?await this.embed(chunks.map(c=>c.text)):[];const records=chunks.map((c,i)=>({...c,vector:vectors[i]}));const builtAt=new Date().toISOString();
        if(this.directory){await mkdir(this.directory,{recursive:true});await writeFile(join(this.directory,'search-index.json'),JSON.stringify({model:EMBEDDING_MODEL,signature,builtAt,chunks:records})+'\n');}
        this.chunks=records;this.signature=signature;this.builtAt=builtAt;this.error=null;return this.status(articles);
      }catch(error){this.error=error.message;throw error;}
    })();try{return await this.building;}finally{this.building=null;}
  }
  async search(question,articles){
    // Never search an index built from another approved source revision.
    if(!this.status(articles).ready)return {method:'keyword-fallback',matches:retrieveArticles(question,articles),note:this.error||'Suchindex noch nicht aktuell; aktuelle freigegebene Originalartikel werden verwendet.'};
    try{
      const query=question.replace(/RFP-\d+/gi,'').trim();
      const [vector]=await this.embed([`Instruct: Given a German customer support question, retrieve relevant help articles that answer the question.\nQuery: ${query}`]);
      const scored=this.chunks.map(c=>({...c,similarity:cosine(vector,c.vector)})).sort((a,b)=>b.similarity-a.similarity);
      const ranked=articles.filter(a=>a.state==='approved'&&a.audience==='customer').map(article=>{
        const hits=scored.filter(c=>c.article_id===article.id&&c.version===article.version);
        const anchor=hits.find(c=>c.routing);
        const similarity=.8*(anchor?.similarity??0)+.2*(hits[0]?.similarity??0);
        return {...article,similarity,matching_chunks:hits.filter(c=>!c.routing).slice(0,3).map(c=>({id:c.chunk_id,heading:c.heading,text:c.text,similarity:c.similarity}))};
      }).sort((a,b)=>b.similarity-a.similarity);
      return {method:'vector',matches:ranked.filter(a=>a.similarity>=this.minScore).slice(0,2),top_score:ranked[0]?.similarity??null,index_built_at:this.builtAt,note:'Kalibrierter Ähnlichkeitswert, keine Wahrscheinlichkeit oder Garantie einer richtigen Antwort.'};
    }catch(error){return {method:'keyword-fallback',matches:retrieveArticles(question,articles),note:'Semantische Suche nicht erreichbar; aktuelle freigegebene Originalartikel werden verwendet.'};}
  }
}
