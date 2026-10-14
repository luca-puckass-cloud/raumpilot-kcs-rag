const $ = selector => document.querySelector(selector);
const escape = value => String(value ?? '').replace(/[&<>"']/g, char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const paths={
  grid:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  book:'<path d="M12 6c-3-3-7-3-10-1v15c3-2 7-2 10 1 3-3 7-3 10-1V5c-3-2-7-2-10 1z"/><path d="M12 6v15"/>',
  support:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/><path d="m5.5 5.5 3.7 3.7m5.6 5.6 3.7 3.7m-13 0 3.7-3.7m5.6-5.6 3.7-3.7"/>',
  settings:'<path d="M12 3v3m0 12v3M3 12h3m12 0h3M5.6 5.6l2 2m8.8 8.8 2 2m-13 0 2-2m8.8-8.8 2-2"/><circle cx="12" cy="12" r="5"/>',
  chat:'<path d="M21 11a8 8 0 0 1-8 8H7l-5 3V7a5 5 0 0 1 5-5h9a5 5 0 0 1 5 5z"/><path d="M7 8h9M7 12h6"/>',
  chevron:'<path d="m8 10 4 4 4-4"/>',close:'<path d="m6 6 12 12M6 18 18 6"/>',
  link:'<path d="m10 13 4-4m-6 5-2 2a4 4 0 0 1-6-6l4-4a4 4 0 0 1 6 0m2 2 2-2a4 4 0 0 1 6 6l-4 4a4 4 0 0 1-6 0"/>',
  arrow:'<path d="M12 20V4m-6 6 6-6 6 6"/>','arrow-right':'<path d="M4 12h16m-6-6 6 6-6 6"/>',
  back:'<path d="M20 12H4m6-6-6 6 6 6"/>',plus:'<path d="M12 5v14M5 12h14"/>',
  search:'<circle cx="10" cy="10" r="6"/><path d="m15 15 6 6"/>',
  clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  check:'<path d="m5 12 4 4L19 6"/>',file:'<path d="M14 2H5v20h14V7z"/><path d="M14 2v6h5M8 12h8M8 16h6"/>',
  info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v.1"/>',
  server:'<rect x="3" y="3" width="18" height="7" rx="2"/><rect x="3" y="14" width="18" height="7" rx="2"/><path d="M7 6.5h.1M7 17.5h.1m4-11h6m-6 11h6"/>',
  shield:'<path d="m12 2 8 3v7c0 5-8 10-8 10S4 17 4 12V5z"/><path d="m8 12 3 3 5-6"/>',
  calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 10h18"/>'
};
const icon=name=>`<svg viewBox="0 0 24 24" aria-hidden="true">${paths[name]??paths.file}</svg>`;
function fillIcons(root=document){root.querySelectorAll('[data-icon]').forEach(element=>{element.innerHTML=icon(element.dataset.icon);});}
fillIcons();
const state={data:null,view:'requests',selected:null,filter:'all',search:'',messages:[],busy:false,mode:'demo',epoch:0,model:null,modelName:null,management:null,editor:null};
const date=(value,full=false)=>value?new Date(value).toLocaleDateString('de-DE',full?{day:'2-digit',month:'long',year:'numeric'}:{day:'2-digit',month:'short',year:'numeric'}):'–';
const status=r=>`<span class="status ${escape(r.status)}">${escape(r.status_label)}</span>`;
async function api(path,options={}){
  const response=await fetch(path,{credentials:'same-origin',...options,headers:{'Content-Type':'application/json',...options.headers}});
  const result=await response.json();if(!response.ok)throw new Error(result.error||'Verbindung fehlgeschlagen.');return result;
}
const post=(path,body)=>api(path,{method:'POST',body:JSON.stringify(body)});
let toastTimer;
function notify(message){$('#toast').textContent=message;$('#toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').hidden=true,5000);}
function syncHeader(){
  const {user,company,requests,tickets,profiles}=state.data;
  $('#company-name').textContent=company.name;$('#sidebar-company').textContent=company.name;
  $('#company-mark').textContent=company.name.split(' ').map(w=>w[0]).join('').slice(0,2);
  $('#user-name').textContent=user.name;$('#user-avatar').textContent=user.name[0];
  $('#request-count').textContent=requests.length;$('#ticket-count').textContent=tickets.length||'';
  $('#manage-nav').hidden=user.role!=='knowledge-manager';
  $('#profile-select').innerHTML=profiles.map(p=>`<option value="${escape(p.id)}">${escape(p.name)} · ${escape(p.company)}</option>`).join('');
  $('#profile-select').value=user.id;
  document.querySelectorAll('.nav-item').forEach(button=>{const active=button.dataset.view===state.view;button.classList.toggle('active',active);if(active)button.setAttribute('aria-current','page');else button.removeAttribute('aria-current');});
  $('#breadcrumb-view').textContent=state.view==='manage'?'Wissenspflege':state.view==='knowledge'?'Wissensbasis':state.view==='tickets'?'Support-Tickets':'Anfragen';
  $('#chat-context-label').textContent=state.selected?`${state.selected} · Anfragekontext`:'Allgemeine Frage';
  $('#clear-context').hidden=!state.selected;
  $('#chat-mode-label').textContent=state.mode==='ollama'?'Lokales Modell · mit Rückfall auf Demo':'Regelbasierte Demo · kein Sprachmodell';
}
async function bootstrap(){state.data=await api('/api/bootstrap');if(state.selected&&!state.data.requests.some(r=>r.id===state.selected))state.selected=null;syncHeader();}
function navigate(hash){if(location.hash===hash)renderPage();else location.hash=hash;}
function heading(title,description,action=''){return `<div class="page-heading"><div><span class="eyebrow">DEIN WORKSPACE</span><h1>${escape(title)}</h1><p>${escape(description)}</p></div>${action}</div>`;}
function renderRequests(){
  const all=state.data.requests;
  const filtered=all.filter(r=>state.filter==='all'||state.filter==='open'&&!['booking_confirmed','cancelled'].includes(r.status)||state.filter==='confirmed'&&r.status==='booking_confirmed').filter(r=>`${r.title} ${r.city} ${r.id}`.toLowerCase().includes(state.search.toLowerCase()));
  const active=all.filter(r=>['awaiting_responses','booking_pending'].includes(r.status)).length;
  return `${heading('Anfragen','Alle Veranstaltungen und Hotelangebote im Blick.',`<button class="button primary" data-action="new-request">${icon('plus')}Neue Anfrage</button>`)}
  <div class="stats-grid"><div class="stat-card"><span class="stat-icon">${icon('clock')}</span><p>In Bearbeitung</p><strong>${active}</strong><small>Rückmeldung oder Prüfung offen</small></div><div class="stat-card"><span class="stat-icon">${icon('file')}</span><p>Angebote verfügbar</p><strong>${all.filter(r=>r.status==='offers_available').length}</strong><small>Bereit zum Vergleichen</small></div><div class="stat-card"><span class="stat-icon">${icon('check')}</span><p>Buchungen bestätigt</p><strong>${all.filter(r=>r.status==='booking_confirmed').length}</strong><small>Mit Buchungsreferenz</small></div></div>
  <section class="data-panel" aria-label="Anfrageliste"><div class="table-toolbar"><div class="tabs" aria-label="Anfragen filtern"><button data-filter="all" class="filter-tab ${state.filter==='all'?'active':''}">Alle Anfragen <span>(${all.length})</span></button><button data-filter="open" class="filter-tab ${state.filter==='open'?'active':''}">Offen</button><button data-filter="confirmed" class="filter-tab ${state.filter==='confirmed'?'active':''}">Bestätigt</button></div><div class="search-wrap">${icon('search')}<input id="request-search" aria-label="Anfragen durchsuchen" placeholder="Anfragen durchsuchen" value="${escape(state.search)}"></div></div>
  <table><thead><tr><th>Anfrage</th><th class="location-column">Ort</th><th class="date-column">Termin</th><th>Status</th><th><span class="sr-only">Öffnen</span></th></tr></thead><tbody>${filtered.length?filtered.map(r=>`<tr><td><button class="request-title" data-request="${escape(r.id)}">${escape(r.title)}</button><div class="request-sub">${escape(r.id)} · ${r.participants} Personen</div></td><td class="location-column">${escape(r.city)}</td><td class="date-column">${date(r.event_date)}</td><td>${status(r)}</td><td><button class="row-arrow" data-request="${escape(r.id)}" aria-label="${escape(r.id)} öffnen">${icon('arrow-right')}</button></td></tr>`).join(''):'<tr><td colspan="5"><div class="empty-state">Keine Anfragen für diesen Filter.</div></td></tr>'}</tbody></table><div class="table-footer"><span>${filtered.length} von ${all.length} Anfragen</span><span>Nur für dein Profil freigegebene Vorgänge</span></div></section>
  <p class="snapshot-note">${icon('info')}Fiktive Ausgangsdaten · Stand ${date(state.data.snapshot_at)}. Neue Entwürfe werden nur lokal gespeichert.</p>
  <div class="welcome-note">${icon('book')}<div><h3>Vom Angebot zur Buchung</h3><p>Eine Angebotsübersicht ist noch keine Buchungsbestätigung. Hier findest du die einzelnen Schritte.</p></div><button class="text-button" data-article="KB-002">Ablauf ansehen →</button></div>`;
}
function renderDetail(request){
  const steps=['Anfrage erfasst','Hotels angefragt','Angebote sichtbar','Buchung bestätigt'];
  const index=request.status==='draft'?0:request.status==='awaiting_responses'?1:['offers_available','booking_pending'].includes(request.status)?2:request.status==='booking_confirmed'?3:-1;
  const explanation=request.status==='draft'?['Noch nicht abgesendet','Deine Anfrage ist als Entwurf gespeichert. In dieser Demo wird kein Hotel kontaktiert.']:request.status==='booking_pending'?['Buchungsprüfung läuft','Das Angebot wurde angenommen. Eine endgültige Bestätigung steht noch aus.']:request.status==='booking_confirmed'?['Buchung bestätigt',`Die Referenz lautet ${request.booking_reference}. Der E-Mail-Empfang ist in diesen Daten nicht dokumentiert.`]:request.status==='cancelled'?['Vorgang storniert','Der gespeicherte Status lautet storniert. Details zu Gebühren sind in der Demo nicht hinterlegt.']:request.visible_offers?['Angebote bereit zum Vergleichen',`${request.visible_offers} Angebote sind zur Ansicht freigegeben. Eine Angebotsübersicht allein bestätigt noch keine Buchung.`]:request.responses_received?['Rückmeldungen werden geprüft',`${request.responses_received} Hotelrückmeldungen liegen vor. Die Angebote sind noch nicht zur Ansicht freigegeben.`]:['Wir warten auf Rückmeldungen','Bisher ist keine Hotelantwort gespeichert. Ein verbindlicher Antworttermin kann daraus nicht abgeleitet werden.'];
  return `<button class="back-link" data-action="back">${icon('back')}Alle Anfragen</button><div class="detail-heading"><div><span class="eyebrow">${escape(request.id)}</span><h1>${escape(request.title)}</h1><p>${escape(request.city)} · ${date(request.event_date,true)} · ${request.participants} Personen</p></div>${status(request)}</div><section class="detail-card"><h2>Veranstaltungsdetails</h2><dl class="detail-data"><div><dt>Ort</dt><dd>${escape(request.city)}</dd></div><div><dt>Termin</dt><dd>${date(request.event_date,true)}</dd></div><div><dt>Teilnehmerzahl</dt><dd>${request.participants} Personen</dd></div><div><dt>Anfragenummer</dt><dd>${escape(request.id)}</dd></div><div><dt>Workspace</dt><dd>${escape(state.data.company.name)}</dd></div><div><dt>Aktualisiert</dt><dd>${date(request.updated_at)}</dd></div></dl><div class="progress-track">${steps.map((text,i)=>`<div class="progress-step ${i<=index?'done':''}">${text}</div>`).join('')}</div></section><div class="offer-grid"><div class="offer-stat"><strong>${request.hotels_contacted}</strong><p>Hotels angefragt</p></div><div class="offer-stat"><strong>${request.responses_received}</strong><p>Rückmeldungen eingegangen</p></div><div class="offer-stat"><strong>${request.visible_offers}</strong><p>Angebote kundensichtbar</p></div></div><section class="detail-card"><h2>Aktueller Stand</h2><div class="explanation">${icon('info')}<div><h3>${escape(explanation[0])}</h3><p>${escape(explanation[1])}</p></div></div><div class="detail-actions"><button class="button secondary" data-action="ask-status">${icon('chat')}Status im Chat erklären</button><button class="text-button" data-action="ticket">Support kontaktieren</button></div></section><p class="snapshot-note">${icon('shield')}Vorgangsdaten werden separat und berechtigt abgefragt. Der Chat speichert sie nicht im allgemeinen Wissensindex.</p>`;
}
function renderKnowledge(){return `${heading('Wissensbasis','Geprüfte Anleitungen für deine nächsten Schritte.')}<div class="knowledge-grid">${state.data.articles.map(a=>`<article class="knowledge-card"><span class="article-icon">${icon('file')}</span><div><button class="request-title" data-article="${escape(a.id)}"><h2>${escape(a.title)}</h2></button><p>${escape(a.id)} · Version ${escape(a.version)} · Freigegeben</p></div><button class="row-arrow" data-article="${escape(a.id)}" aria-label="Artikel ${escape(a.id)} öffnen">${icon('arrow-right')}</button></article>`).join('')}</div><p class="snapshot-note">${icon('info')}Die Anleitungen beschreiben die Abläufe des fiktiven Produkts RaumPilot.</p>`;}
function markdown(text){
  const lines=text.split('\n');let out='',list=null;
  for(const line of lines){
    const item=/^(\d+\.|-)\s+(.*)/.exec(line);
    if(item){const type=item[1]==='-'?'ul':'ol';if(list!==type){if(list)out+=`</${list}>`;out+=`<${type}>`;list=type;}out+=`<li>${escape(item[2])}</li>`;continue;}
    if(list){out+=`</${list}>`;list=null;}
    if(line.startsWith('# '))continue;
    if(line.startsWith('## '))out+=`<h2>${escape(line.slice(3))}</h2>`;else if(line.trim())out+=`<p>${escape(line)}</p>`;
  }if(list)out+=`</${list}>`;return out;
}
function renderTickets(){
  const tickets=state.data.tickets;
  return `${heading('Support-Tickets','Deine Übergaben an den Support im Demoworkspace.',`<button class="button primary" data-action="ticket">${icon('plus')}Neues Ticket</button>`)}${tickets.length?tickets.map(t=>`<article class="ticket-card"><div class="ticket-meta"><span>${escape(t.id)} ${t.request_id?`· ${escape(t.request_id)}`:''}</span><span>Offen · ${date(t.created_at)}</span></div><h2>${escape(t.subject)}</h2><p>${escape(t.description)}</p></article>`).join(''):`<section class="data-panel"><div class="empty-state"><h2>Keine offenen Übergaben</h2><p>Wenn eine Frage im Chat nicht geklärt werden kann, halte den Fall hier als Ticket fest.</p><button class="button secondary" data-action="ticket">Support-Ticket anlegen</button></div></section>`}<p class="snapshot-note">${icon('info')}Tickets werden in dieser Demo nur lokal und bis zum Serverneustart gespeichert.</p>`;
}
const articleStateLabel={draft:'Entwurf',in_review:'In Prüfung',approved:'Freigegeben',archived:'Archiviert',superseded:'Ersetzt'};
function renderManagement(data){
  const index=data.index;
  return `${heading('Wissenspflege','Wiederverwenden, prüfen und gezielt verbessern.',`<button class="button primary" data-action="new-article">${icon('plus')}Neuer Artikel</button>`)}<div class="index-strip"><span>${icon('server')}<strong>${index.ready?'Suchindex aktuell':index.building?'Index wird aktualisiert':'Suchindex nicht aktuell'}</strong></span><span>${index.articles} Artikel · ${index.chunks} Abschnitte</span><button class="text-button" data-action="reindex">Index aktualisieren</button></div><p class="field-help">${index.error?escape(index.error):'Nur aktuelle, für Kunden freigegebene Fassungen gehören in den Suchindex. Bei einem veralteten Index nutzt der Chat die aktuellen Originalartikel.'}</p><h2 class="section-heading">Offene Wissenslücken <span>${data.gaps.filter(g=>g.state==='open').length}</span></h2><div class="gap-list">${data.gaps.filter(g=>g.state==='open').map(g=>`<article class="gap-card"><div><span class="eyebrow">${escape(g.id)} · ${g.count} MAL ERFASST</span><h3>${escape(g.question)}</h3><p>Zuletzt ${date(g.last_seen)} · Rohdaten bleiben im lokalen Arbeitsbereich</p></div><button class="button secondary" data-gap="${escape(g.id)}">Artikelentwurf</button></article>`).join('')||'<div class="empty-inline">Noch keine offenen Wissenslücken. Eine unbeantwortete Chatfrage oder negatives Feedback wird hier erfasst.</div>'}</div><h2 class="section-heading">Artikel und Fassungen</h2><section class="data-panel"><table class="management-table"><thead><tr><th>Artikel / Fassung</th><th>Status</th><th>Abrufe / Feedback</th><th>Aktion</th></tr></thead><tbody>${data.articles.slice().reverse().map(a=>{const usage=data.usage[a.revision_id]??{};return `<tr><td><strong>${escape(a.title)}</strong><div class="request-sub">${escape(a.id)} · v${escape(a.version)} · ${escape(a.owner)}</div></td><td><span class="status ${a.state==='approved'?'offers_available':a.state==='in_review'?'booking_pending':'draft'}">${articleStateLabel[a.state]}</span></td><td class="usage-cell">${usage.retrievals??0} Abrufe<br><small>${usage.helpful??0} hilfreich · ${usage.unhelpful??0} Lücken</small></td><td><div class="revision-actions">${a.state==='draft'?`<button class="text-button" data-edit="${escape(a.revision_id)}">Bearbeiten</button><button class="text-button" data-transition="review" data-revision="${escape(a.revision_id)}">Zur Prüfung</button>`:a.state==='in_review'?`<button class="text-button" data-approve="${escape(a.revision_id)}">Prüfen & freigeben</button><button class="text-button" data-transition="revise" data-revision="${escape(a.revision_id)}">Überarbeiten</button>`:a.state==='approved'?`<button class="text-button" data-new-version="${escape(a.revision_id)}">Neue Fassung</button><button class="text-button" data-transition="archive" data-revision="${escape(a.revision_id)}">Archivieren</button>`:'<span class="muted">Historie erhalten</span>'}</div></td></tr>`;}).join('')}</tbody></table></section><p class="snapshot-note">${icon('info')}Quellenabrufe und Nutzerfeedback sind Lernsignale, keine gemessene Lösungsquote.</p><h2 class="section-heading">Änderungsprotokoll</h2><div class="audit-list">${data.audit.slice(-8).reverse().map(event=>`<p><span>${escape(new Date(event.at).toLocaleString('de-DE'))}</span>${escape(event.action)} · ${escape(event.revision_id)}</p>`).join('')||'<p>Noch keine redaktionellen Änderungen.</p>'}</div>`;
}
function openEditor({article=null,gap=null,approve=false,newVersion=false}={}){
  const form=$('#article-form');form.reset();state.editor={article,gap,approve,newVersion};
  $('#editor-heading').textContent=approve?'Fachliche Prüfung':newVersion?'Neue Fassung':article?'Entwurf bearbeiten':'Neuer Artikelentwurf';
  $('#editor-context').textContent=article?`${article.id} · Version ${article.version} · ${articleStateLabel[article.state]}`:gap?`Aus ${gap.id} · Bitte keine konkreten Kundendaten in den allgemeinen Artikel übernehmen.`:'Entwürfe sind nicht für Kundenantworten freigegeben.';
  form.elements.title.value=article?.title??gap?.question??'';form.elements.owner.value=article?.owner??'Support Knowledge Owner';
  form.elements.search_description.value=article?.search_description??'';form.elements.search_description.readOnly=approve;
  form.elements.content.value=article?.content??`# ${gap?.question??'Titel'}\n\n## Problem aus Kundensicht\n${gap?.question??'Welche Frage hat der Kunde?'}\n\n## Gültigkeitsbereich\nFür welche Produktfunktion und Bedingungen gilt die Lösung?\n\n## Bearbeitungsweg\nBeschreibe geprüfte Fundstellen und konkrete Lösungsschritte.\n\n## Ausnahmen und Übergabe\nWann dürfen wir nicht antworten, und wer übernimmt?`;
  form.elements.title.readOnly=approve;form.elements.owner.readOnly=approve;form.elements.content.readOnly=approve;
  $('#review-note-field').hidden=!approve;form.elements.reviewNote.required=approve;$('#article-error').textContent='';$('#editor-submit').textContent=approve?'Fassung freigeben':'Entwurf speichern';$('#article-dialog').showModal();
}
async function transitionArticle(id,action){
  try{await post('/api/knowledge/revisions/'+encodeURIComponent(id)+'/'+action,{});await bootstrap();await renderPage();notify(action==='archive'?'Fassung archiviert; sie wird nicht mehr für Kundenantworten verwendet.':'Artikelstatus aktualisiert.');}catch(error){notify(error.message);}
}
let renderSequence=0,indexPoll=null;
async function renderPage(){
  if(!state.data)return;const sequence=++renderSequence;clearTimeout(indexPoll);
  const [view,id]=location.hash.slice(1).split('/');
  state.view=['knowledge','tickets','manage'].includes(view)?view:'requests';syncHeader();
  try{
    if(state.view==='requests'&&id){const request=await api('/api/requests/'+encodeURIComponent(id));if(sequence!==renderSequence)return;state.selected=request.id;syncHeader();$('#page-content').innerHTML=renderDetail(request);renderSuggestions();}
    else if(state.view==='knowledge'&&id){const article=await api('/api/articles/'+encodeURIComponent(id));if(sequence!==renderSequence)return;$('#page-content').innerHTML=`<button class="back-link" data-action="back-knowledge">${icon('back')}Alle Artikel</button>${heading(article.title,'Geprüfte Anleitung · fiktives Produkt')}<div class="article-meta"><span>${escape(article.id)}</span><span>Version ${escape(article.version)}</span><span>Freigegeben</span><span>Geprüft ${date(article.reviewed_at)}</span></div><article class="article-body">${markdown(article.content)}</article>`;}
    else if(state.view==='manage'){state.management=await api('/api/knowledge/admin');if(sequence!==renderSequence)return;$('#page-content').innerHTML=renderManagement(state.management);if(state.management.index.building)indexPoll=setTimeout(()=>{if(state.view==='manage'&&!$('#article-dialog').open)renderPage();},1000);}
    else $('#page-content').innerHTML=state.view==='knowledge'?renderKnowledge():state.view==='tickets'?renderTickets():renderRequests();
  }catch(error){if(sequence===renderSequence)$('#page-content').innerHTML=`<div class="request-error-page">${escape(error.message)} <button class="text-button" data-action="back">Zur Anfrageübersicht</button></div>`;}
}
function intro(){return `<div class="chat-intro"><div class="mini-label">${icon('support')}DEIN SUPPORT IM WORKSPACE</div><h3>Was möchtest du<br>zu deiner Anfrage wissen?</h3><p>Frag nach dem aktuellen Stand oder einem Schritt im Buchungsprozess. Die verwendeten Quellen bleiben nachvollziehbar.</p><div class="capabilities"><div>${icon('clock')}Anfrage- und Angebotsstatus</div><div>${icon('book')}Geprüfte Hilfeartikel</div><div>${icon('shield')}Nur berechtigte Vorgangsdaten</div></div></div>`;}
function messageHtml(message){
  if(message.role==='user')return `<div class="message user"><div class="user-bubble">${escape(message.text)}</div></div>`;
  const result=message.result;
  return `<div class="message assistant"><div class="message-header"><span class="agent-symbol">r</span>RaumPilot Support<small>${result.mode==='ollama'?'Lokales Modell':result.mode==='policy'?'Geprüfte Rückfrage':'Demoantwort'}</small></div><div class="message-answer">${escape(result.answer)}</div>${result.notice?`<p class="message-notice">${escape(result.notice)}</p>`:''}<div class="message-sources">${(result.sources??[]).map(source=>`<button class="source-button" data-article="${escape(source.id)}">${icon('file')}${escape(source.id)} · v${escape(source.version)}</button>`).join('')}</div><details class="proof"><summary>Nachweise ansehen</summary><div class="proof-content"><div>${escape(result.reason)}</div>${result.caseData?`<div>Vorgang: ${escape(result.caseData.id)} · ${escape(result.caseData.status)}</div><div>Datensatz aktualisiert: ${escape(new Date(result.caseData.updated_at).toLocaleString('de-DE'))}</div>`:''}<div>Abfrage: ${escape(new Date(result.checked_at).toLocaleTimeString('de-DE'))}</div><div>Suche: ${result.retrieval?.method==='vector'?'semantischer Vektorabruf':result.retrieval?.method==='keyword-fallback'?'Stichwort-Fallback':'Zugriffsprüfung'}</div>${result.retrieval?.index_built_at?`<div>Index: ${escape(new Date(result.retrieval.index_built_at).toLocaleString('de-DE'))}</div>`:''}${result.retrieval?.top_score!==null&&result.retrieval?.top_score!==undefined?`<div>Ähnlichkeit: ${result.retrieval.top_score.toFixed(3)} · keine Erfolgswahrscheinlichkeit</div>`:''}${result.model?`<div>Modell: ${escape(result.model)}</div>`:''}</div></details>${result.gap_id?`<p class="gap-notice">Wissenslücke ${escape(result.gap_id)} zur Prüfung erfasst.</p>`:''}${result.reply_id?`<div class="answer-feedback"><span>${result.feedback?'Feedback gespeichert':'War das hilfreich?'}</span><button data-feedback="yes" data-reply="${escape(result.reply_id)}" ${result.feedback?'disabled':''}>Ja</button><button data-feedback="no" data-reply="${escape(result.reply_id)}" ${result.feedback?'disabled':''}>Es fehlt etwas</button></div>`:''}${result.handoff?'<button class="text-button inline-handoff" data-action="ticket">Fall an Support übergeben →</button>':''}</div>`;
}
function renderChat(){
  const log=$('#chat-messages');log.innerHTML=state.messages.length?state.messages.map(messageHtml).join(''):intro();
  if(state.busy)log.insertAdjacentHTML('beforeend',`<div class="chat-working"><span class="working-dot"></span>${state.mode==='ollama'?'Lokales Modell wird abgefragt …':'Antwort wird vorbereitet …'}</div>`);
  log.scrollTop=log.scrollHeight;$('#send-message').disabled=state.busy;$('#chat-input').disabled=state.busy;renderSuggestions();
}
function renderSuggestions(){const questions=state.selected?['Wie ist der aktuelle Status?','Ist bereits verbindlich gebucht?']:['Wie erstelle ich eine Anfrage?','Wann ist eine Buchung bestätigt?'];$('#chat-suggestions').innerHTML=state.messages.length>3?'':questions.map(q=>`<button class="suggestion" data-question="${escape(q)}" ${state.busy?'disabled':''}>${escape(q)}</button>`).join('');}
function openChat(){$('#chat-panel').classList.add('is-open');}
async function send(message){
  if(state.busy||!message.trim())return;
  const epoch=state.epoch;state.messages.push({role:'user',text:message.trim()});state.busy=true;$('#chat-input').value='';renderChat();openChat();
  try{const result=await post('/api/chat',{message:message.trim(),requestId:state.selected,mode:state.mode,model:state.modelName});if(epoch===state.epoch)state.messages.push({role:'assistant',result});}
  catch(error){if(epoch===state.epoch)state.messages.push({role:'assistant',result:{answer:error.message+' Bitte versuche es erneut oder lege ein Support-Ticket an.',mode:'policy',sources:[],reason:'Verbindung zur lokalen Anwendung fehlgeschlagen.',checked_at:new Date().toISOString(),handoff:true}});}
  finally{if(epoch===state.epoch){state.busy=false;renderChat();$('#chat-input').focus();}}
}
async function refreshModel(){
  try{state.model=await api('/api/model');const names=state.model.models;$('#local-model-select').innerHTML=names.length?names.map(name=>`<option value="${escape(name)}">${escape(name)}</option>`).join(''):'<option value="">Noch kein Modell verfügbar</option>';if(names.includes(state.modelName))$('#local-model-select').value=state.modelName;else if(names.includes(state.model.configured))$('#local-model-select').value=state.model.configured;$('#model-name').textContent='Ollama · lokal';$('#model-info-text').textContent=names.length?'Lokales Modell installiert. Wähle es oben für den Chat aus.':state.model.reachable?'Ollama läuft. Noch kein lokales Modell vollständig installiert.':'Ollama ist lokal nicht erreichbar.';}catch{$('#model-info-text').textContent='Modellstatus konnte nicht geladen werden.';}
}
function openSettings(){$('#profile-select').value=state.data.user.id;$('#mode-select').value=state.mode;$('#settings-error').textContent='';$('#settings-dialog').showModal();refreshModel();}
function openRequest(){const form=$('#request-form');form.reset();form.elements.event_date.min=new Date().toISOString().slice(0,10);$('#request-error').textContent='';$('#request-dialog').showModal();}
function openTicket(){const form=$('#ticket-form');form.reset();form.elements.subject.value=state.selected?`Frage zu ${state.selected}`:'';form.elements.description.value=state.messages.filter(m=>m.role==='user').at(-1)?.text??'';$('#ticket-error').textContent='';$('#ticket-dialog').showModal();}
document.addEventListener('click',event=>{
  const button=event.target.closest('button');if(!button)return;
  if(button.dataset.close){$('#'+button.dataset.close).close();return;}
  if(button.dataset.view){navigate('#'+button.dataset.view);return;}
  if(button.dataset.request){state.selected=button.dataset.request;navigate('#requests/'+state.selected);syncHeader();renderSuggestions();return;}
  if(button.dataset.article){navigate('#knowledge/'+button.dataset.article);return;}
  if(button.dataset.question){send(button.dataset.question);return;}
  if(button.dataset.filter){state.filter=button.dataset.filter;const saved=state.search;$('#page-content').innerHTML=renderRequests();state.search=saved;return;}
  if(button.dataset.feedback){const message=state.messages.find(m=>m.result?.reply_id===button.dataset.reply);post('/api/chat/feedback',{replyId:button.dataset.reply,helpful:button.dataset.feedback==='yes'}).then(()=>{if(message){message.result.feedback=true;renderChat();}notify('Feedback für die Wissenspflege gespeichert.');}).catch(error=>notify(error.message));return;}
  if(button.dataset.gap){openEditor({gap:state.management.gaps.find(g=>g.id===button.dataset.gap)});return;}
  if(button.dataset.edit){openEditor({article:state.management.articles.find(a=>a.revision_id===button.dataset.edit)});return;}
  if(button.dataset.newVersion){openEditor({article:state.management.articles.find(a=>a.revision_id===button.dataset.newVersion),newVersion:true});return;}
  if(button.dataset.approve){openEditor({article:state.management.articles.find(a=>a.revision_id===button.dataset.approve),approve:true});return;}
  if(button.dataset.transition){transitionArticle(button.dataset.revision,button.dataset.transition);return;}
  const action=button.dataset.action;
  if(action==='new-article'){openEditor();return;}
  if(action==='reindex'){button.disabled=true;button.textContent='Index wird aktualisiert …';post('/api/knowledge/reindex',{}).then(()=>renderPage()).catch(error=>{notify(error.message);renderPage();});return;}
  if(action==='new-request')openRequest();else if(action==='back')navigate('#requests');else if(action==='back-knowledge')navigate('#knowledge');else if(action==='ticket')openTicket();else if(action==='ask-status')send('Wie ist der aktuelle Status meiner Anfrage?');
});
document.addEventListener('input',event=>{if(event.target.id==='request-search'){const position=event.target.selectionStart;state.search=event.target.value;$('#page-content').innerHTML=renderRequests();$('#request-search').focus();$('#request-search').setSelectionRange(position,position);}});
$('#chat-form').addEventListener('submit',event=>{event.preventDefault();send($('#chat-input').value);});
$('#chat-input').addEventListener('keydown',event=>{if(event.key==='Enter'&&!event.shiftKey&&!event.isComposing){event.preventDefault();send(event.target.value);}});
$('#clear-context').addEventListener('click',()=>{state.selected=null;syncHeader();renderSuggestions();});
$('#mobile-chat').addEventListener('click',openChat);$('#close-chat').addEventListener('click',()=>$('#chat-panel').classList.remove('is-open'));
$('#chat-handoff').addEventListener('click',openTicket);$('#open-settings').addEventListener('click',openSettings);$('#profile-button').addEventListener('click',openSettings);$('#refresh-model').addEventListener('click',refreshModel);
$('#request-form').addEventListener('submit',async event=>{
  event.preventDefault();const form=event.target,button=form.querySelector('[type=submit]');button.disabled=true;
  try{const fields=Object.fromEntries(new FormData(form));const result=await post('/api/requests',{...fields,participants:Number(fields.participants)});await bootstrap();$('#request-dialog').close();state.selected=result.id;navigate('#requests/'+result.id);notify('Entwurf gespeichert. Es wurde kein Hotel kontaktiert.');}
  catch(error){$('#request-error').textContent=error.message;}finally{button.disabled=false;}
});
$('#ticket-form').addEventListener('submit',async event=>{
  event.preventDefault();const form=event.target,button=form.querySelector('[type=submit]');button.disabled=true;
  try{const result=await post('/api/tickets',{...Object.fromEntries(new FormData(form)),requestId:state.selected});await bootstrap();$('#ticket-dialog').close();navigate('#tickets');notify(`${result.id} im lokalen Workspace angelegt.`);}
  catch(error){$('#ticket-error').textContent=error.message;}finally{button.disabled=false;}
});
$('#settings-form').addEventListener('submit',async event=>{
  event.preventDefault();const form=event.target,button=form.querySelector('[type=submit]');button.disabled=true;
  try{const value=Object.fromEntries(new FormData(form));const changed=value.userId!==state.data.user.id;
    if(changed){await post('/api/demo-session',{userId:value.userId});state.epoch++;state.messages=[];state.busy=false;state.selected=null;state.search='';state.filter='all';}
    state.mode=value.mode;state.modelName=value.model||null;await bootstrap();$('#settings-dialog').close();if(changed)navigate('#requests');await renderPage();renderChat();notify('Demo-Einstellungen übernommen.');
  }catch(error){$('#settings-error').textContent=error.message;}finally{button.disabled=false;}
});
$('#article-form').addEventListener('submit',async event=>{
  event.preventDefault();const form=event.target,button=$('#editor-submit');button.disabled=true;
  try{const fields=Object.fromEntries(new FormData(form)),editor=state.editor;
    if(editor.approve)await post('/api/knowledge/revisions/'+encodeURIComponent(editor.article.revision_id)+'/approve',{reviewNote:fields.reviewNote});
    else if(editor.article&&!editor.newVersion)await post('/api/knowledge/revisions/'+encodeURIComponent(editor.article.revision_id)+'/edit',{...fields,expectedUpdatedAt:editor.article.updated_at});
    else await post('/api/knowledge/drafts',{...fields,baseId:editor.newVersion?editor.article.id:null,gapId:editor.gap?.id??null});
    $('#article-dialog').close();await bootstrap();await renderPage();notify(editor.approve?'Fassung freigegeben. Der Suchindex wird aktualisiert.':'Entwurf gespeichert; noch nicht für Kundenantworten verfügbar.');
  }catch(error){$('#article-error').textContent=error.message;}finally{button.disabled=false;}
});
window.addEventListener('hashchange',renderPage);
try{await bootstrap();state.selected=state.data.requests[0]?.id??null;syncHeader();await renderPage();renderChat();refreshModel();}catch(error){$('#page-content').innerHTML=`<div class="request-error-page">${escape(error.message)} Bitte starte den lokalen Server und lade die Seite neu.</div>`;}
