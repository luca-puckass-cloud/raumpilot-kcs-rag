import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, extname, sep } from 'node:path';
import { getPermittedRequest } from './case-access.mjs';
import { prepareSupport, generateLocalReply, statusLabels } from './support.mjs';
import { KnowledgeStore } from './knowledge-store.mjs';
import { SemanticIndex } from './retrieval.mjs';

const root = fileURLToPath(new URL('..',import.meta.url));
const baseData = JSON.parse(await readFile(new URL('../data/demo.json',import.meta.url)));
const meta = JSON.parse(await readFile(new URL('../data/articles.json',import.meta.url)));
const articles = await Promise.all(meta.map(async article => ({...article,content:await readFile(resolve(root,article.path),'utf8')})));
const extra = {
  'RFP-1042':{title:'Strategieworkshop Q4',city:'Köln',event_date:'2026-11-12',participants:24},
  'RFP-1043':{title:'Team-Offsite',city:'Bonn',event_date:'2026-11-26',participants:18},
  'RFP-1044':{title:'Leadership Day',city:'Düsseldorf',event_date:'2026-12-03',participants:12},
  'RFP-1045':{title:'Jahresplanung',city:'Köln',event_date:'2026-12-10',participants:16},
  'RFP-2042':{title:'Produktkonferenz',city:'Berlin',event_date:'2026-11-20',participants:40},
  'RFP-3042':{title:'Design-Sprint',city:'Hamburg',event_date:'2026-12-01',participants:10},
  'RFP-4042':{title:'Teamtag',city:'Frankfurt',event_date:'2026-11-05',participants:20},
  'RFP-4043':{title:'Vertriebsworkshop',city:'Köln',event_date:'2026-12-15',participants:22}
};

export function createPortalServer({ model = process.env.RAUMPILOT_MODEL || 'qwen3:8b', fetcher=fetch,knowledgeDirectory=null,embedder=null,autoIndex=false } = {}) {
  const data=structuredClone(baseData), details=structuredClone(extra), sessions=new Map(), tickets=[];
  const knowledge=new KnowledgeStore(articles,{directory:knowledgeDirectory}),index=new SemanticIndex({fetcher,embedder,directory:knowledgeDirectory});
  const replies=new Map();
  const refreshIndex=()=>index.rebuild(knowledge.approved()).catch(()=>{});
  if(autoIndex)knowledge.ready.then(refreshIndex).catch(()=>{});
  let requestCounter=5000,ticketCounter=1000;
  const safeRequest = (user,id) => {
    const result=getPermittedRequest(data,user.id,id);
    return result.ok ? {...result.request,...details[id],status_label:statusLabels[result.request.status]} : null;
  };
  const json=(response,status,body)=>{response.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});response.end(JSON.stringify(body));};
  async function body(request) {
    let text='';
    for await (const chunk of request) {text+=chunk; if(text.length>64000) throw Object.assign(new Error('Anfrage zu groß.'),{status:413});}
    try{return JSON.parse(text||'{}');}catch{throw Object.assign(new Error('Ungültige Anfrage.'),{status:400});}
  }
  async function modelState() {
    try {
      await knowledge.ready;
      const response=await fetcher('http://127.0.0.1:11434/api/tags',{signal:AbortSignal.timeout(2000)});
      if(!response.ok) throw new Error();
      const value=await response.json();
      const names=(value.models??[]).map(m=>m.name).filter(name=>!name.includes('cloud')&&!/embedding/i.test(name));
      return {reachable:true,configured:model,ready:names.includes(model),models:names};
    }catch{return {reachable:false,configured:model,ready:false,models:[]};}
  }
  return createServer(async (request,response)=>{
    try {
      const host=request.headers.host;
      if(!/^(127\.0\.0\.1|localhost):\d+$/.test(host??'')) return json(response,403,{error:'Host nicht erlaubt.'});
      const url=new URL(request.url,'http://'+host), path=url.pathname;
      if(path.startsWith('/api/'))await knowledge.ready;
      response.setHeader('X-Content-Type-Options','nosniff');
      response.setHeader('Referrer-Policy','no-referrer');
      response.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'");
      if(request.method==='POST' && request.headers.origin!=='http://'+host) return json(response,403,{error:'Origin nicht erlaubt.'});
      let token=(request.headers.cookie??'').split('; ').find(s=>s.startsWith('raumpilot_session='))?.slice(18);
      if(!sessions.has(token)){
        token=randomBytes(24).toString('hex'); sessions.set(token,'user-lena');
        response.setHeader('Set-Cookie',`raumpilot_session=${token}; HttpOnly; SameSite=Strict; Path=/`);
      }
      let user=data.users.find(u=>u.id===sessions.get(token));
      if(path==='/api/demo-session'&&request.method==='POST') {
        const value=await body(request), next=data.users.find(u=>u.id===value.userId);
        if(!next) return json(response,400,{error:'Unbekanntes Demoprofil.'});
        sessions.set(token,next.id); return json(response,200,{ok:true});
      }
      if(path==='/api/bootstrap'&&request.method==='GET') return json(response,200,{
        user,company:data.companies.find(c=>c.id===user.company_id),
        profiles:data.users.map(u=>({...u,company:data.companies.find(c=>c.id===u.company_id).name})),
        requests:data.requests.map(r=>safeRequest(user,r.id)).filter(Boolean),
        articles:knowledge.approved().map(({content,...a})=>a),
        tickets:tickets.filter(t=>t.user_id===user.id),snapshot_at:data.snapshot_at
      });
      if(path==='/api/model'&&request.method==='GET') return json(response,200,await modelState());
      if(path==='/api/knowledge/status'&&request.method==='GET')return json(response,200,index.status(knowledge.approved()));
      if(path.startsWith('/api/knowledge/')&&path!=='/api/knowledge/status'){
        if(user.role!=='knowledge-manager')return json(response,403,{error:'Wissenspflege ist nur für das Demo-Redaktionsprofil verfügbar.'});
        if(path==='/api/knowledge/admin'&&request.method==='GET')return json(response,200,{...knowledge.overview(),index:index.status(knowledge.approved())});
        if(path==='/api/knowledge/drafts'&&request.method==='POST')return json(response,201,await knowledge.createDraft(await body(request),user.id));
        if(path==='/api/knowledge/reindex'&&request.method==='POST'){await index.rebuild(knowledge.approved());return json(response,200,index.status(knowledge.approved()));}
        const route=/^\/api\/knowledge\/revisions\/([^/]+)\/(edit|review|approve|archive|revise)$/.exec(path);
        if(route&&request.method==='POST'){
          const input=await body(request),id=decodeURIComponent(route[1]),action=route[2];
          const result=action==='edit'?await knowledge.editDraft(id,input,user.id):await knowledge.transition(id,action,input.reviewNote,user.id);
          if(['approve','archive'].includes(action))refreshIndex();
          return json(response,200,{article:result,index:index.status(knowledge.approved())});
        }
        return json(response,404,{error:'Wissenspflege-Endpunkt nicht verfügbar.'});
      }
      if(path.startsWith('/api/requests/')&&request.method==='GET') {
        const result=safeRequest(user,decodeURIComponent(path.slice('/api/requests/'.length)));
        return result?json(response,200,result):json(response,404,{error:'Anfrage nicht zugänglich.'});
      }
      if(path.startsWith('/api/articles/')&&request.method==='GET') {
        const article=knowledge.approved().find(a=>a.id===path.split('/').at(-1));
        return article?json(response,200,article):json(response,404,{error:'Artikel nicht verfügbar.'});
      }
      if(path==='/api/requests'&&request.method==='POST'){
        const value=await body(request);
        if(typeof value.title!=='string'||value.title.trim().length<3||value.title.length>100||typeof value.city!=='string'||value.city.trim().length<2||value.city.length>80||!/^\d{4}-\d{2}-\d{2}$/.test(value.event_date??'')||!Number.isInteger(value.participants)||value.participants<1||value.participants>1000) return json(response,400,{error:'Bitte prüfe Titel, Ort, Datum und Teilnehmerzahl.'});
        const parsedDate=new Date(value.event_date+'T00:00:00Z');
        if(Number.isNaN(parsedDate.getTime())||parsedDate.toISOString().slice(0,10)!==value.event_date||value.event_date<new Date().toISOString().slice(0,10)) return json(response,400,{error:'Bitte wähle ein gültiges zukünftiges Datum.'});
        const id=`RFP-${++requestCounter}`;
        data.requests.push({id,company_id:user.company_id,allowed_user_ids:[user.id],status:'draft',hotels_contacted:0,responses_received:0,offers:[],booking_reference:null,next_review_at:null,updated_at:new Date().toISOString()});
        details[id]={title:value.title.trim(),city:value.city.trim(),event_date:value.event_date,participants:value.participants};
        return json(response,201,safeRequest(user,id));
      }
      if(path==='/api/tickets'&&request.method==='POST'){
        const value=await body(request);
        if(typeof value.subject!=='string'||value.subject.trim().length<3||value.subject.length>120||typeof value.description!=='string'||value.description.trim().length<5||value.description.length>4000) return json(response,400,{error:'Bitte Betreff und Beschreibung ergänzen.'});
        if(value.requestId&&!safeRequest(user,value.requestId)) return json(response,404,{error:'Anfrage nicht zugänglich.'});
        const ticket={id:`TKT-${++ticketCounter}`,user_id:user.id,request_id:value.requestId||null,subject:value.subject.trim(),description:value.description.trim(),status:'open',created_at:new Date().toISOString()};
        tickets.push(ticket); return json(response,201,ticket);
      }
      if(path==='/api/chat'&&request.method==='POST'){
        const value=await body(request);
        if(typeof value.message!=='string'||!value.message.trim()||value.message.length>2000) return json(response,400,{error:'Nachricht muss zwischen 1 und 2.000 Zeichen enthalten.'});
        const currentArticles=knowledge.approved();
        let prepared=prepareSupport({data,articles:currentArticles,userId:user.id,message:value.message,requestId:value.requestId});
        let retrieval={method:'policy',matches:[],note:'Keine Wissenssuche vor unklarer Zugriffsberechtigung.'};
        if(!prepared.reason.startsWith('Zugriff nicht')&&!prepared.reason.startsWith('Mehrere Anfrage')){
          retrieval=await index.search(value.message,currentArticles);
          prepared=prepareSupport({data,articles:currentArticles,userId:user.id,message:value.message,requestId:value.requestId,retrieved:retrieval.matches});
        }
        let result=prepared;
        if(value.mode==='ollama'&&prepared.mode!=='policy') {
          const models=await modelState();
          const requestedModel=value.model||model;
          if(!models.models.includes(requestedModel)) result={...prepared,mode:'demo',notice:'Das ausgewählte lokale Modell ist noch nicht bereit. Diese Antwort ist regelbasiert.'};
          else try{result=await generateLocalReply(prepared,value.message,requestedModel,fetcher);}catch{result={...prepared,mode:'demo',notice:'Das lokale Modell konnte nicht antworten. Diese Antwort ist regelbasiert.'};}
        }
        if(result.sources?.some(source=>!knowledge.approved().some(a=>a.id===source.id&&a.version===source.version)))result={answer:'Das freigegebene Wissen wurde während der Antwort aktualisiert. Bitte stelle deine Frage erneut, damit ich die aktuelle Fassung verwenden kann.',mode:'policy',sources:[],caseData:null,handoff:false,reason:'Veraltete Quelle verworfen.'};
        let gap=null;
        if(result.handoff&&result.reason.startsWith('Keine geeignete'))gap=await knowledge.recordGap(value.message);
        if(result.sources.length)await knowledge.recordUsage(result.sources);
        const replyId=randomBytes(12).toString('hex');replies.set(replyId,{token,userId:user.id,sources:result.sources,question:value.message,voted:false});
        const {knowledge:internalKnowledge,...publicResult}=result;
        return json(response,200,{...publicResult,reply_id:replyId,gap_id:gap?.id??null,retrieval:{method:retrieval.method,top_score:retrieval.top_score??null,index_built_at:retrieval.index_built_at??null,note:retrieval.note},checked_at:new Date().toISOString()});
      }
      if(path==='/api/chat/feedback'&&request.method==='POST'){
        const value=await body(request),reply=replies.get(value.replyId);
        if(!reply||reply.token!==token||reply.userId!==user.id)return json(response,404,{error:'Antwort nicht verfügbar.'});
        if(reply.voted)return json(response,409,{error:'Feedback wurde bereits gespeichert.'});
        if(typeof value.helpful!=='boolean')return json(response,400,{error:'Feedback ungültig.'});
        reply.voted=true;await knowledge.recordFeedback(reply.sources,value.helpful);if(!value.helpful)await knowledge.recordGap(reply.question);
        return json(response,200,{ok:true});
      }
      if(path.startsWith('/api/')) return json(response,404,{error:'Endpunkt nicht verfügbar.'});
      if(request.method!=='GET') return json(response,405,{error:'Methode nicht erlaubt.'});
      const publicRoot=resolve(root,'public'), file=resolve(publicRoot,'.'+decodeURIComponent(path==='/'?'/index.html':path));
      if(!file.startsWith(publicRoot+sep)) return json(response,403,{error:'Pfad nicht erlaubt.'});
      const contents=await readFile(file);
      response.writeHead(200,{'Content-Type':({'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml'})[extname(file)]??'application/octet-stream'});response.end(contents);
    }catch(error){json(response,error.status??(error.code==='ENOENT'?404:500),{error:error.status?error.message:'Anfrage konnte nicht verarbeitet werden.'});}
  });
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const port=Number(process.env.PORT??4175);
  createPortalServer({knowledgeDirectory:resolve(root,'runtime'),autoIndex:true}).listen(port,'127.0.0.1',()=>console.log(`RaumPilot: http://127.0.0.1:${port} · local demo · KCS knowledge persisted in runtime/`));
}
