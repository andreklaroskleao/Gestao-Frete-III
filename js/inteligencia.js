import { auth, db, onAuthStateChanged, collection, collectionGroup, doc, addDoc, getDoc, query, where, orderBy, serverTimestamp, onSnapshot, limit } from "./firebase.js";
import { $, safeText, money, formatDate, statusLabel, statusClass, showMessage } from "./ui.js";

let uid="", profile={}, role="", freights=[], drivers=[], companies=[], applications=[];
const openStatuses=["aberto","pendente"];
const activeStatuses=["liberado","indo_coleta","em_andamento","carregado","em_viagem"];

onAuthStateChanged(auth, async user => {
  if(!user) return;
  uid=user.uid;
  try{
    profile=(await getDoc(doc(db,"usuarios",uid))).data()||{};
    role=profile.tipo||profile.role||"";
    listen();
    bind();
  }catch(e){ renderError("Não foi possível iniciar os recursos inteligentes agora."); }
});

function listen(){
  const freteQuery = role==="empresa" ? query(collection(db,"fretes"), where("empresaId","==",uid), orderBy("createdAt","desc"), limit(80)) : query(collection(db,"fretes"), orderBy("createdAt","desc"), limit(80));
  onSnapshot(freteQuery, s=>{ freights=s.docs.map(d=>({id:d.id,...d.data()})); renderAll(); }, ()=>renderError("Não foi possível carregar os fretes."));
  if(["gestor","gestor_admin","gestor_operacional","empresa"].includes(role)){
    onSnapshot(query(collection(db,"caminhoneiros"), limit(120)), s=>{drivers=s.docs.map(d=>({id:d.id,...d.data()})); renderAll();}, ()=>{});
  }
  if(["gestor","gestor_admin","gestor_operacional"].includes(role)){
    onSnapshot(query(collection(db,"empresas"), limit(120)), s=>{companies=s.docs.map(d=>({id:d.id,...d.data()})); renderAll();}, ()=>{});
  }
  try{
    const appQuery = role==="caminhoneiro" ? query(collectionGroup(db,"candidaturas"), where("driverId","==",uid), orderBy("createdAt","desc"), limit(120)) : query(collectionGroup(db,"candidaturas"), orderBy("createdAt","desc"), limit(160));
    onSnapshot(appQuery, s=>{ applications=s.docs.map(d=>({id:d.id,freightId:d.ref.parent.parent?.id||"",...d.data()})); renderAll(); }, ()=>{applications=[]; renderAll();});
  }catch(_){ applications=[]; }
}

function bind(){
  document.addEventListener("submit", async e=>{
    const form=e.target.closest(".negotiation-form"); if(!form) return;
    e.preventDefault();
    const value=Number(form.querySelector("input[name='valor']")?.value||0);
    const message=form.querySelector("textarea[name='mensagem']")?.value.trim()||"";
    const target=form.querySelector(".message");
    if(!value) return showMessage(target,"Informe um valor para registrar a negociação.",true);
    try{
      await addDoc(collection(db,"fretes",form.dataset.freightId,"negociacoes"),{valor:value,mensagem:message,autorId:uid,autorTipo:role,autorNome:profile.empresaNome||profile.nome||profile.name||"Usuário",criadoEm:serverTimestamp()});
      showMessage(target,"Negociação registrada com sucesso."); form.reset();
    }catch(err){ showMessage(target,"Não foi possível registrar a negociação agora.",true); }
  });
  document.addEventListener("change", e=>{ if(["smartWallFilter","slaFilter","compareFreightSelect","companyCompareFreightSelect"].includes(e.target.id)) renderAll(); });
}
function renderAll(){ renderSla(); renderNegotiation(); renderScores(); renderSmartWall(); renderComparator(); }
function daysFrom(v){ if(!v) return null; const d=v.toDate?v.toDate():new Date(v); return Number.isNaN(d.getTime())?null:Math.floor((Date.now()-d.getTime())/86400000); }
function today(){ return new Date().toISOString().slice(0,10); }
function freightApps(id){ return applications.filter(a=>a.freightId===id); }
function scoreClass(s){ return s>=85?"score-high":s>=65?"score-mid":"score-low"; }
function calcDriverScore(d, done=0, cancels=0){ const rating=Number(d.ratingAvg||d.avaliacaoMedia||0); let s=55+Math.min(done,8)*4+rating*6; if((d.disponibilidade||"").toLowerCase().includes("dispon")) s+=8; if(d.telefone||d.phone) s+=4; if(d.baseCity||d.cidadeBase) s+=4; s-=cancels*7; return Math.max(0,Math.min(100,Math.round(s))); }
function calcCompanyScore(c){ const fs=freights.filter(f=>f.empresaId===c.id); let s=60+Math.min(fs.filter(f=>f.status==="finalizado").length,10)*3; if(c.telefone||c.companyPhone) s+=6; if(c.cidade||c.baseCity) s+=4; s-=fs.filter(f=>f.status==="cancelado").length*8; return Math.max(0,Math.min(100,Math.round(s))); }
function renderSla(){ const els=[$("slaPanel"),$("companySlaPanel")].filter(Boolean); if(!els.length) return; const filter=$("slaFilter")?.value||"todos"; const alerts=[]; freights.forEach(f=>{ const age=daysFrom(f.createdAt), date=f.pickupDate||f.deadline, apps=Number(f.candidatosCount||freightApps(f.id).length||0); if(openStatuses.includes(f.status)&&apps===0&&age!==null&&age>=1) alerts.push(["Frete sem candidato",f,"Revise valor, veículo e divulgue novamente.","warning"]); if(activeStatuses.includes(f.status)&&!f.lastTrackingAt&&age!==null&&age>=1) alerts.push(["Sem atualização de localização",f,"Peça atualização ao caminhoneiro autorizado.","danger"]); if(date&&date<today()&&!["finalizado","cancelado"].includes(f.status)) alerts.push(["Prazo vencido",f,"Verifique coleta, entrega ou status atual.","danger"]); if(date===today()&&!["finalizado","cancelado"].includes(f.status)) alerts.push(["Operação para hoje",f,"Acompanhe horários e contatos.","info"]); if(f.status==="finalizado"&&!f.comissaoConfirmada) alerts.push(["Comissão a conferir",f,"Confirme cobrança, pagamento ou recibo.","warning"]); }); const list=filter==="todos"?alerts:alerts.filter(a=>a[3]===filter); els.forEach(el=>el.innerHTML=list.slice(0,30).map(([title,f,action,level])=>`<article class="sla-card ${level}"><div><strong>${safeText(title)}</strong><p>${safeText(f.code)} • ${safeText(f.originText)} → ${safeText(f.destinationText)}</p><small>Próxima ação: ${safeText(action)}</small></div><span class="badge ${statusClass(f.status)}">${statusLabel(f.status)}</span></article>`).join("")||`<p class="empty">Nenhum alerta operacional para este filtro.</p>`); }
function renderNegotiation(){ const els=[$("negotiationPanel"),$("companyNegotiationPanel")].filter(Boolean); if(!els.length) return; const list=freights.filter(f=>!["cancelado","finalizado"].includes(f.status)).slice(0,20); const html=list.map(f=>`<article class="item negotiation-card"><div class="item-header"><div><h3>${safeText(f.code)} • ${safeText(f.originText)} → ${safeText(f.destinationText)}</h3><p>Valor ofertado: ${money(f.price)} • Valor final: ${money(f.valorFinal||f.finalValue||f.price)}</p></div><span class="badge ${statusClass(f.status)}">${statusLabel(f.status)}</span></div><form class="grid-form compact-form negotiation-form" data-freight-id="${safeText(f.id)}"><input name="valor" type="number" min="0" step="0.01" placeholder="Novo valor sugerido" required/><textarea name="mensagem" placeholder="Observação da negociação"></textarea><button type="submit">Registrar negociação</button><p class="message"></p></form></article>`).join("")||`<p class="empty">Não há fretes em negociação no momento.</p>`; els.forEach(el=>el.innerHTML=html); }
function renderScores(){ const manager=$("scorePanel"), company=$("companyScorePanel"); if(manager){ const ds=drivers.slice(0,12).map(d=>{ const done=freights.filter(f=>f.selectedDriverId===d.id&&f.status==="finalizado").length, cancels=freights.filter(f=>f.selectedDriverId===d.id&&f.status==="cancelado").length, sc=calcDriverScore(d,done,cancels); return `<article class="score-card ${scoreClass(sc)}"><span>Caminhoneiro</span><strong>${safeText(d.nome||d.name)}</strong><div class="score-ring">${sc}%</div><p>${done} frete(s) finalizado(s) • ${safeText(d.baseCity||d.cidadeBase||"cidade não informada")}</p></article>`; }).join(""); const cs=companies.slice(0,12).map(c=>{ const sc=calcCompanyScore(c); return `<article class="score-card ${scoreClass(sc)}"><span>Empresa</span><strong>${safeText(c.empresaNome||c.nome)}</strong><div class="score-ring">${sc}%</div><p>${freights.filter(f=>f.empresaId===c.id).length} frete(s) • ${safeText(c.baseCity||c.cidade||"cidade não informada")}</p></article>`; }).join(""); manager.innerHTML=ds+cs||`<p class="empty">Os scores aparecerão quando houver dados suficientes.</p>`; } if(company){ const sc=calcCompanyScore({id:uid,...profile}); company.innerHTML=`<article class="score-card ${scoreClass(sc)}"><span>Confiabilidade da empresa</span><strong>${safeText(profile.empresaNome||profile.nome||"Sua empresa")}</strong><div class="score-ring">${sc}%</div><p>O score considera operações finalizadas, dados completos e histórico operacional.</p></article>`; } }
function renderSmartWall(){ const el=$("smartFreightWall"); if(!el) return; const filter=$("smartWallFilter")?.value||"todos", state=profile.baseState||profile.estadoBase, vehicle=(profile.vehicleTypes||profile.tipoVeiculo||"").toString().toLowerCase(); let list=freights.filter(f=>openStatuses.includes(f.status)); if(filter==="estado"&&state) list=list.filter(f=>[f.originState,f.destinationState].includes(state)); if(filter==="hoje") list=list.filter(f=>(f.pickupDate||f.deadline)===today()); if(filter==="valor") list=[...list].sort((a,b)=>Number(b.price||0)-Number(a.price||0)); if(filter==="veiculo"&&vehicle) list=list.filter(f=>(f.vehicleType||"").toLowerCase().includes(vehicle)); el.innerHTML=list.slice(0,30).map(f=>{ const tags=[]; if((f.pickupDate||f.deadline)===today()) tags.push("Coleta hoje"); if(Number(f.price||0)>=2000) tags.push("Melhor valor"); if(state&&[f.originState,f.destinationState].includes(state)) tags.push("Mesmo estado"); return `<article class="opportunity-card"><div class="item-header"><div><h3>${safeText(f.originText)} → ${safeText(f.destinationText)}</h3><p>${safeText(f.cargoType)} • ${safeText(f.vehicleType)} • ${money(f.price)}</p></div><span class="badge open">Disponível</span></div><div class="tag-row">${tags.map(b=>`<span>${safeText(b)}</span>`).join("")||`<span>Oportunidade</span>`}</div><p>Prazo: ${safeText(f.pickupDate||f.deadline||"a combinar")}</p></article>`; }).join("")||`<p class="empty">Nenhuma oportunidade encontrada para este filtro.</p>`; }
function renderComparator(){ const select=$("compareFreightSelect")||$("companyCompareFreightSelect"), panel=$("candidateComparator")||$("candidateComparatorCompany"); if(!select||!panel) return; const current=select.value; const opts=freights.filter(f=>!["cancelado","finalizado"].includes(f.status)).slice(0,40); select.innerHTML=`<option value="">Selecione um frete</option>`+opts.map(f=>`<option value="${safeText(f.id)}" ${f.id===current?"selected":""}>${safeText(f.code)} • ${safeText(f.originText)} → ${safeText(f.destinationText)}</option>`).join(""); if(!select.value){ panel.innerHTML=`<p class="empty">Selecione um frete para comparar candidatos lado a lado.</p>`; return; } const cands=freightApps(select.value).slice(0,12); if(!cands.length){ panel.innerHTML=`<p class="empty">Este frete ainda não possui candidaturas carregadas para comparação.</p>`; return; } panel.innerHTML=cands.map(a=>{ const d=drivers.find(x=>x.id===a.driverId)||{}, done=freights.filter(f=>f.selectedDriverId===a.driverId&&f.status==="finalizado").length, sc=calcDriverScore(d,done,0); return `<article class="compare-card"><div class="compare-score ${scoreClass(sc)}">${sc}%</div><h3>${safeText(a.driverName||d.nome||d.name)}</h3><p>${safeText(a.vehicleLabel||d.vehicleType||"Veículo não informado")}</p><p>${safeText(d.baseCity||d.cidadeBase||"Cidade não informada")}</p><p>Valor proposto: <strong>${money(a.proposedValue||a.valorProposto||0)}</strong></p><span class="badge ${statusClass(a.status)}">${statusLabel(a.status)}</span></article>`; }).join(""); }
function renderError(msg){ ["slaPanel","companySlaPanel","scorePanel","smartFreightWall","candidateComparator","candidateComparatorCompany"].forEach(id=>{ if($(id)) $(id).innerHTML=`<p class="empty">${safeText(msg)}</p>`; }); }
