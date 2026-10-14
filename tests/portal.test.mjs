import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createPortalServer } from '../src/server.mjs';
import { prepareSupport, retrieveArticles } from '../src/support.mjs';
import { readFile } from 'node:fs/promises';

async function withServer(run, options={}){
  const server=createPortalServer({fetcher:async()=>{throw new Error('Ollama absent in test');},...options});
  server.listen(0,'127.0.0.1');await once(server,'listening');
  const base=`http://127.0.0.1:${server.address().port}`;
  let cookie;
  async function request(path,body){const response=await fetch(base+path,{method:body?'POST':'GET',headers:{...(cookie?{Cookie:cookie}:{}),...(body?{'Content-Type':'application/json',Origin:base}:{})},body:body?JSON.stringify(body):undefined});if(response.headers.get('set-cookie'))cookie=response.headers.get('set-cookie').split(';')[0];return {status:response.status,body:await response.json()};}
  try{await run({base,request});}finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
}
test('session filters requests and ignores a spoofed user ID in chat',async()=>withServer(async({request})=>{
  const bootstrap=await request('/api/bootstrap');assert.equal(bootstrap.body.user.id,'user-lena');assert.deepEqual(bootstrap.body.requests.map(r=>r.id),['RFP-1042','RFP-1043','RFP-1044']);
  const denied=await request('/api/chat',{message:'Ist RFP-2042 gebucht?',userId:'user-mia'});
  assert.equal(denied.body.caseData,null);assert.equal(denied.body.mode,'policy');assert.deepEqual(denied.body.sources,[]);assert.ok(!denied.body.answer.includes('BOOK-DEMO-002'));
  const unknown=await request('/api/requests/RFP-0000'), foreign=await request('/api/requests/RFP-2042');assert.deepEqual(unknown,foreign);
  await request('/api/demo-session',{userId:'user-mia'});
  const allowed=await request('/api/requests/RFP-2042');assert.equal(allowed.status,200);assert.equal(allowed.body.booking_reference,'BOOK-DEMO-002');
}));
test('support answer uses separate case data and falls back honestly without model',async()=>withServer(async({request})=>{
  await request('/api/bootstrap');
  const result=await request('/api/chat',{message:'Wie ist der Status meiner Anfrage?',requestId:'RFP-1042',mode:'ollama'});
  assert.equal(result.status,200);assert.equal(result.body.mode,'demo');assert.match(result.body.notice,/regelbasiert/);assert.match(result.body.answer,/2 Rückmeldungen/);assert.match(result.body.answer,/noch nicht zur Ansicht/);assert.equal(result.body.caseData.visible_offers,0);assert.equal(result.body.sources[0].id,'KB-001');assert.equal('knowledge' in result.body,false);
  const booking=await request('/api/chat',{message:'Ist es bereits gebucht?',requestId:'RFP-1044'});assert.match(booking.body.answer,/noch nicht/);assert.equal(booking.body.sources[0].id,'KB-002');
  const general=await request('/api/chat',{message:'Wie erstelle ich eine Anfrage?',requestId:'RFP-1042'});assert.equal(general.body.caseData,null);
}));
test('draft and ticket are local and restricted to their demo profile',async()=>withServer(async({request})=>{
  await request('/api/bootstrap');
  const draft=await request('/api/requests',{title:'Lokaler Testworkshop',city:'Köln',event_date:'2099-12-03',participants:15});assert.equal(draft.status,201);assert.equal(draft.body.status,'draft');assert.equal(draft.body.hotels_contacted,0);
  const bad=await request('/api/requests',{title:'Test',city:'Köln',event_date:'2099-02-30',participants:15});assert.equal(bad.status,400);
  const ticket=await request('/api/tickets',{subject:'Frage zum Workshop',description:'Bitte den aktuellen Stand prüfen.',requestId:draft.body.id});assert.equal(ticket.status,201);
  assert.equal((await request('/api/bootstrap')).body.tickets.length,1);
  await request('/api/demo-session',{userId:'user-ben'});assert.equal((await request('/api/requests/'+draft.body.id)).status,404);assert.equal((await request('/api/bootstrap')).body.tickets.length,0);
}));
test('cross-origin mutations are blocked',async()=>withServer(async({base})=>{
  const result=await fetch(base+'/api/demo-session',{method:'POST',headers:{Origin:'https://unrelated.example','Content-Type':'application/json'},body:'{"userId":"user-mia"}'});assert.equal(result.status,403);
}));
test('retrieval excludes drafts, archived knowledge and wrong audiences',()=>{
  const article={id:'KB-001',title:'Status Hotelangebote',content:'Status Rückmeldungen',state:'approved',audience:'customer'};
  assert.equal(retrieveArticles('Status Hotelangebote',[article,{...article,id:'DRAFT',state:'draft'},{...article,id:'ARCHIVE',state:'archived'},{...article,id:'INTERNAL',audience:'support'}]).length,1);
});
test('unknown topic causes handoff rather than invented answer',async()=>{
  const data=JSON.parse(await readFile(new URL('../data/demo.json',import.meta.url)));
  const result=prepareSupport({data,articles:[],userId:'user-lena',message:'Kann ich eine Rechnung rückwirkend aufteilen?',requestId:'RFP-1042'});assert.equal(result.handoff,true);assert.equal(result.mode,'policy');assert.equal(result.caseData,null);
});
test('explicit customer intent can select the second retrieved source without bypassing retrieval',async()=>{
  const data=JSON.parse(await readFile(new URL('../data/demo.json',import.meta.url)));
  const articles=await Promise.all(JSON.parse(await readFile(new URL('../data/articles.json',import.meta.url))).map(async a=>({...a,content:await readFile(new URL('../'+a.path,import.meta.url),'utf8')})));
  const result=prepareSupport({data,articles,userId:'user-lena',message:'Habe ich bereits eine Reservierung?',requestId:'RFP-1044',retrieved:[articles[0],articles[1]]});assert.equal(result.sources[0].id,'KB-002');assert.match(result.answer,/noch nicht/);
  const missing=prepareSupport({data,articles,userId:'user-lena',message:'Habe ich bereits eine Reservierung?',retrieved:[articles[0]]});assert.equal(missing.handoff,true);assert.equal(missing.sources.length,0);
});
test('installed local model gets only approved knowledge and permitted case context',async()=>{
  let modelCalls=0;
  const fetcher=async(url,options)=>{
    if(url.endsWith('/api/tags'))return {ok:true,json:async()=>({models:[{name:'test-local:8b'},{name:'other-cloud'}]})};
    modelCalls++;
    const value=JSON.parse(options.body);
    assert.equal(value.model,'test-local:8b');
    const context=JSON.parse(value.messages[1].content);
    assert.equal(context.allowed_case_data.id,'RFP-1042');
    assert.equal('allowed_user_ids' in context.allowed_case_data,false);
    assert.ok(context.approved_article.includes('KB-001'));
    return {ok:true,json:async()=>({message:{content:JSON.stringify({answer:'Zwei Rückmeldungen liegen vor, aber noch keine sichtbaren Angebote.',citations:['KB-001']})}})};
  };
  await withServer(async({request})=>{
    await request('/api/bootstrap');
    const result=await request('/api/chat',{message:'Wie ist der Status?',requestId:'RFP-1042',mode:'ollama',model:'test-local:8b'});
    assert.equal(result.body.mode,'ollama');assert.equal(result.body.model,'test-local:8b');assert.equal(result.body.sources[0].id,'KB-001');
    const denied=await request('/api/chat',{message:'Status von RFP-2042?',mode:'ollama',model:'test-local:8b'});assert.equal(denied.body.mode,'policy');
    const cloud=await request('/api/chat',{message:'Wie ist der Status?',requestId:'RFP-1042',mode:'ollama',model:'other-cloud'});assert.equal(cloud.body.mode,'demo');
    assert.equal(modelCalls,1);
  },{fetcher});
});
test('customer cannot manage drafts; editor approval makes a previously unanswered question available',async()=>withServer(async({request})=>{
  await request('/api/bootstrap');assert.equal((await request('/api/knowledge/admin')).status,403);
  assert.equal((await request('/api/knowledge/drafts',{title:'Test'})).status,403);
  const unknown=await request('/api/chat',{message:'Kann ich eine Rechnung rückwirkend aufteilen?'});assert.ok(unknown.body.gap_id);
  await request('/api/demo-session',{userId:'user-knowledge'});
  const admin=await request('/api/knowledge/admin');assert.equal(admin.body.gaps.length,1);
  const content='# Rechnung aufteilen\n\n## Problem aus Kundensicht\nDer Kunde möchte eine Rechnung nachträglich teilen.\n\n## Gültigkeitsbereich\nFiktive RaumPilot Rechnungshilfe.\n\n## Bearbeitungsweg\nIn dieser Demo ist eine nachträgliche Aufteilung nicht möglich. Eine Änderung muss vor Ausstellung mit dem Support abgestimmt werden.\n\n## Ausnahmen und Übergabe\nKeine Rechnungsdaten erfinden; besondere Fälle an Support übergeben.';
  const draft=await request('/api/knowledge/drafts',{title:'Kann ich eine Rechnung rückwirkend aufteilen?',owner:'Billing Support',content,gapId:unknown.body.gap_id});assert.equal(draft.status,201);
  const path='/api/knowledge/revisions/'+encodeURIComponent(draft.body.revision_id);
  assert.equal((await request(path+'/review',{})).status,200);
  assert.equal((await request(path+'/approve',{reviewNote:'Produktregel und Übergabe vollständig geprüft.'})).status,200);
  await request('/api/demo-session',{userId:'user-lena'});
  const answer=await request('/api/chat',{message:'Kann ich eine Rechnung rückwirkend aufteilen?'});assert.equal(answer.body.handoff,false);assert.equal(answer.body.sources[0].id,draft.body.id);
  const voted=await request('/api/chat/feedback',{replyId:answer.body.reply_id,helpful:true});assert.equal(voted.status,200);assert.equal((await request('/api/chat/feedback',{replyId:answer.body.reply_id,helpful:true})).status,409);
}));
