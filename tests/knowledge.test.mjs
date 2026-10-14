import test from 'node:test';
import assert from 'node:assert/strict';
import { KnowledgeStore } from '../src/knowledge-store.mjs';
import { SemanticIndex,knowledgeFingerprint,cosine,chunkArticle } from '../src/retrieval.mjs';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const content='# Beispiel\n\n## Problem aus Kundensicht\nDer Kunde sucht eine eindeutige Antwort.\n\n## Gültigkeitsbereich\nAllgemeine RaumPilot Hilfe, keine persönlichen Daten.\n\n## Bearbeitungsweg\nDen geprüften Ablauf erklären und die aktuellen Vorgangsdaten nur berechtigt abrufen.\n\n## Ausnahmen und Übergabe\nBei fehlendem Wissen übergeben und keine Zusagen erfinden.';
const seed=[{id:'KB-001',version:'1.0',title:'Status einer Anfrage',scope:'request-status',owner:'Support',state:'approved',audience:'customer',reviewed_at:'2026-10-14',content}];
test('draft review approval keeps old knowledge until the new version is approved',async()=>{
  const store=new KnowledgeStore(seed);await store.ready;
  const draft=await store.createDraft({baseId:'KB-001',title:'Aktualisierter Anfragestatus',owner:'Support',content:content+'\nNeue geprüfte Information.'},'editor');
  assert.equal(draft.version,'1.1');assert.equal(draft.scope,'request-status');assert.equal(store.approved()[0].version,'1.0');
  await assert.rejects(()=>store.transition(draft.revision_id,'approve','Fachlich geprüft.','editor'),{status:409});
  await store.transition(draft.revision_id,'review',null,'editor');assert.equal(store.approved()[0].version,'1.0');
  await assert.rejects(()=>store.transition(draft.revision_id,'approve','kurz','editor'),{status:400});
  await store.transition(draft.revision_id,'approve','Fundstellen, Ablauf und Ausnahmen fachlich geprüft.','editor');
  assert.equal(store.approved().length,1);assert.equal(store.approved()[0].version,'1.1');assert.equal(store.overview().articles.find(a=>a.version==='1.0').state,'superseded');
});
test('unknown questions become reusable gaps without request IDs or email addresses',async()=>{
  const store=new KnowledgeStore(seed);const gap=await store.recordGap('Frage zu RFP-1042 von lena@example.test');
  assert.ok(!gap.question.includes('RFP-1042'));assert.ok(!gap.question.includes('lena@example.test'));
  const repeated=await store.recordGap('Frage zu RFP-1042 von lena@example.test');assert.equal(repeated.id,gap.id);assert.equal(repeated.count,2);
  const draft=await store.createDraft({title:'Neue Supportfrage',owner:'Support',content,gapId:gap.id},'editor');
  await store.transition(draft.revision_id,'review',null,'editor');await store.transition(draft.revision_id,'approve','Die Produktregel wurde vollständig überprüft.','editor');assert.equal(store.overview().gaps[0].state,'resolved');
});
test('incomplete articles and stale draft edits are rejected',async()=>{
  const store=new KnowledgeStore(seed);const draft=await store.createDraft({title:'Entwurf ohne Struktur',owner:'Support',content:'Ein unvollständiger Text ohne die notwendigen Abschnitte.'},'editor');
  await assert.rejects(()=>store.transition(draft.revision_id,'review',null,'editor'),{status:400});
  await assert.rejects(()=>store.editDraft(draft.revision_id,{title:draft.title,owner:draft.owner,content,expectedUpdatedAt:'wrong'},'editor'),{status:409});
});
test('index excludes drafts; changed or archived sources cannot use stale chunks',async()=>{
  const store=new KnowledgeStore(seed);const embedded=[];
  const index=new SemanticIndex({embedder:async texts=>{embedded.push(...texts);return texts.map(()=>[1,0,0]);}});
  const unpublished=await store.createDraft({title:'Unreleased knowledge',owner:'Support',content:content+'unreleased-marker'},'editor');
  await index.rebuild(store.approved());assert.equal(index.status(store.approved()).ready,true);assert.ok(!embedded.some(text=>text.includes('unreleased-marker')));
  assert.equal((await index.search('Status Anfrage',store.approved())).method,'vector');
  const changed=[{...seed[0],content:content+'changed'}];assert.notEqual(knowledgeFingerprint(seed),knowledgeFingerprint(changed));assert.equal(index.status(changed).ready,false);
  await store.transition('KB-001@1.0','archive',null,'editor');const result=await index.search('Status Anfrage',store.approved());assert.equal(result.method,'keyword-fallback');assert.equal(result.matches.length,0);
  assert.equal(unpublished.state,'draft');
});
test('embedding failures use approved original knowledge, not a pretend vector result',async()=>{
  const index=new SemanticIndex({embedder:async()=>{throw new Error('offline');}});
  await assert.rejects(()=>index.rebuild(seed));const result=await index.search('Status Anfrage',seed);assert.equal(result.method,'keyword-fallback');assert.equal(result.matches[0].id,'KB-001');
});
test('vector math validates dimensions and chunks carry exact source revisions',()=>{
  assert.equal(cosine([1,0],[1,0]),1);assert.equal(cosine([1,0],[0,1]),0);assert.throws(()=>cosine([1],[1,0]));assert.throws(()=>cosine([0],[0]));
  for(const chunk of chunkArticle(seed[0])){assert.equal(chunk.article_id,'KB-001');assert.equal(chunk.version,'1.0');assert.ok(chunk.chunk_id.startsWith('KB-001@1.0#'));}
});
test('knowledge, gaps and audit survive restart without replacing saved revisions',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'raumpilot-test-'));
  try{const first=new KnowledgeStore(seed,{directory});await first.ready;const gap=await first.recordGap('Neue unbekannte Frage');const draft=await first.createDraft({title:'Gespeicherter Artikel',owner:'Support',content,search_description:'Fragen aus Kundensicht',gapId:gap.id},'editor');
    const second=new KnowledgeStore(seed,{directory});await second.ready;assert.equal(second.overview().articles.at(-1).revision_id,draft.revision_id);assert.equal(second.overview().gaps[0].id,gap.id);assert.equal(second.overview().audit.length,1);
  }finally{await rm(directory,{recursive:true});}
});
test('concurrent edits cannot silently overwrite the preceding draft edit',async()=>{
  const store=new KnowledgeStore(seed);const draft=await store.createDraft({title:'Gleichzeitiger Entwurf',owner:'Support',content},'editor');
  const input={title:draft.title,owner:draft.owner,content:content+'\nErgänzung.',expectedUpdatedAt:draft.updated_at};
  const updated=await store.editDraft(draft.revision_id,input,'editor');assert.notEqual(updated.updated_at,draft.updated_at);
  await assert.rejects(()=>store.editDraft(draft.revision_id,input,'editor'),{status:409});
});
