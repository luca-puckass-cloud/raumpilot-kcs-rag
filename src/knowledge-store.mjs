import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

const error=(message,status=400)=>Object.assign(new Error(message),{status});
export class KnowledgeStore {
  constructor(seed,{directory=null}={}){
    this.directory=directory;this.queue=Promise.resolve();
    this.data={articles:seed.map(a=>({...a,revision_id:`${a.id}@${a.version}`,updated_at:a.reviewed_at+'T00:00:00Z'})),gaps:[],usage:{},audit:[]};
    this.ready=this.load();
  }
  async load(){if(!this.directory)return;await mkdir(this.directory,{recursive:true});try{const saved=JSON.parse(await readFile(join(this.directory,'knowledge.json'),'utf8'));if(!Array.isArray(saved.articles)||!Array.isArray(saved.gaps)||!saved.usage||!Array.isArray(saved.audit))throw new Error('Invalid knowledge store');this.data=saved;}catch(e){if(e.code!=='ENOENT')throw e;}}
  approved(){return structuredClone(this.data.articles.filter(a=>a.state==='approved'&&a.audience==='customer'));}
  overview(){return structuredClone(this.data);}
  async mutate(fn){
    const operation=this.queue.then(async()=>{await this.ready;const next=structuredClone(this.data);const value=fn(next);if(this.directory){const file=join(this.directory,'knowledge.json');await writeFile(file+'.tmp',JSON.stringify(next,null,2)+'\n');await rename(file+'.tmp',file);}this.data=next;return structuredClone(value);});
    this.queue=operation.catch(()=>{});return operation;
  }
  recordGap(question){return this.mutate(data=>{
    const safe=String(question).replace(/RFP-\d+/gi,'[Vorgang]').replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g,'[E-Mail]').slice(0,1000).trim();
    const key=createHash('sha256').update(safe.toLowerCase()).digest('hex');
    let gap=data.gaps.find(g=>g.key===key&&g.state!=='resolved');
    if(gap){gap.count++;gap.last_seen=new Date().toISOString();}else{gap={id:`GAP-${1001+data.gaps.length}`,key,question:safe,count:1,state:'open',created_at:new Date().toISOString(),last_seen:new Date().toISOString()};data.gaps.push(gap);}return gap;
  });}
  recordUsage(sources){return this.mutate(data=>{for(const source of sources){const key=`${source.id}@${source.version}`;data.usage[key]??={retrievals:0,helpful:0,unhelpful:0};data.usage[key].retrievals++;}return true;});}
  recordFeedback(sources,helpful){return this.mutate(data=>{for(const source of sources){const key=`${source.id}@${source.version}`;data.usage[key]??={retrievals:0,helpful:0,unhelpful:0};data.usage[key][helpful?'helpful':'unhelpful']++;}return true;});}
  createDraft(input,actor){return this.mutate(data=>{
    if(typeof input.title!=='string'||input.title.trim().length<5||input.title.length>180||typeof input.content!=='string'||input.content.length<30||input.content.length>20000||typeof input.owner!=='string'||input.owner.trim().length<2)throw error('Titel, Verantwortlicher und Artikelinhalt fehlen oder sind zu lang.');
    let id,version,base=null;
    if(input.baseId){const revisions=data.articles.filter(a=>a.id===input.baseId);if(!revisions.length)throw error('Ausgangsartikel nicht gefunden.',404);if(revisions.some(a=>['draft','in_review'].includes(a.state)))throw error('Für diesen Artikel existiert bereits ein offener Entwurf.',409);base=revisions.at(-1);id=input.baseId;version=(Math.max(...revisions.map(a=>Number(a.version)))+.1).toFixed(1);}
    else{id=`KB-${String(Math.max(0,...data.articles.map(a=>Number(a.id.split('-')[1])))+1).padStart(3,'0')}`;version='1.0';}
    if(input.search_description!==undefined&&(typeof input.search_description!=='string'||input.search_description.length>1000))throw error('Suchbeschreibung ungültig.');
    const draft={id,version,revision_id:`${id}@${version}`,title:input.title.trim(),content:input.content,search_description:input.search_description??base?.search_description??'',owner:input.owner.trim(),audience:'customer',scope:base?.scope||'general-help',requires_case_access:base?.requires_case_access??false,state:'draft',source_gap_id:input.gapId||null,updated_at:new Date().toISOString(),created_by:actor};
    if(input.gapId&&!data.gaps.some(g=>g.id===input.gapId))throw error('Wissenslücke nicht gefunden.',404);
    data.articles.push(draft);data.audit.push({at:draft.updated_at,actor,action:'draft-created',revision_id:draft.revision_id});return draft;
  });}
  editDraft(revisionId,input,actor){return this.mutate(data=>{
    const article=data.articles.find(a=>a.revision_id===revisionId);if(!article)throw error('Artikel nicht gefunden.',404);if(article.state!=='draft')throw error('Nur Entwürfe können bearbeitet werden.',409);
    if(input.expectedUpdatedAt!==article.updated_at)throw error('Der Entwurf wurde inzwischen geändert. Bitte neu laden.',409);
    if(typeof input.title!=='string'||input.title.trim().length<5||input.title.length>180||typeof input.content!=='string'||input.content.length<30||input.content.length>20000||typeof input.owner!=='string'||input.owner.trim().length<2)throw error('Titel, Verantwortlicher oder Artikelinhalt ungültig.');
    const updatedAt=new Date(Math.max(Date.now(),Date.parse(article.updated_at)+1)).toISOString();
    if(input.search_description!==undefined&&(typeof input.search_description!=='string'||input.search_description.length>1000))throw error('Suchbeschreibung ungültig.');
    Object.assign(article,{title:input.title.trim(),content:input.content,search_description:input.search_description??article.search_description??'',owner:input.owner.trim(),updated_at:updatedAt});data.audit.push({at:article.updated_at,actor,action:'draft-edited',revision_id:revisionId});return article;
  });}
  transition(revisionId,action,reviewNote,actor){return this.mutate(data=>{
    const article=data.articles.find(a=>a.revision_id===revisionId);if(!article)throw error('Artikel nicht gefunden.',404);
    const expected={review:'draft',approve:'in_review',archive:'approved',revise:'in_review'}[action];
    if(!expected||article.state!==expected)throw error('Dieser Statuswechsel ist nicht erlaubt.',409);
    if(['review','approve'].includes(action)&&(!['Problem','Gültigkeitsbereich','Bearbeitungsweg','Ausnahmen'].every(h=>new RegExp(`^## ${h}`,'m').test(article.content))||article.content.length<200))throw error('Der Artikel benötigt Problem, Gültigkeitsbereich, Bearbeitungsweg und Ausnahmen sowie einen vollständigen Inhalt.');
    if(['review','approve'].includes(action)&&/Beschreibe geprüfte Fundstellen|Für welche Produktfunktion und Bedingungen|Wann dürfen wir nicht antworten/.test(article.content))throw error('Bitte die Platzhalter durch geprüfte Inhalte ersetzen.');
    if(action==='approve'&&(typeof reviewNote!=='string'||reviewNote.trim().length<10))throw error('Für die Freigabe bitte eine fachliche Prüfnotiz ergänzen.');
    const at=new Date().toISOString();
    if(action==='approve'){
      for(const old of data.articles.filter(a=>a.id===article.id&&a.state==='approved'))old.state='superseded';
      article.state='approved';article.reviewed_at=at;article.reviewed_by=actor;article.review_note=reviewNote.trim();
      const gap=data.gaps.find(g=>g.id===article.source_gap_id);if(gap){gap.state='resolved';gap.resolved_by=revisionId;}
    }else article.state={review:'in_review',archive:'archived',revise:'draft'}[action];
    article.updated_at=at;data.audit.push({at,actor,action,revision_id:revisionId});return article;
  });}
}
