import { auth, db, onAuthStateChanged, signOut, collection, collectionGroup, doc, addDoc, getDoc, getDocs, setDoc, updateDoc, query, where, orderBy, serverTimestamp, onSnapshot, limit, getCountFromServer } from "./firebase.js";
import { configurarSelectEstadoCidade, obterLocalidade } from "./ibge.js";
import { abrirWhatsAppRegistrando, csvDownload, jsonDownload } from "./comercial.js";
import { setupDashboardTabs, safeText, statusClass, statusLabel, money, whatsappUrl, mapsUrl, directionsUrl, buildFreightCode, formatDate, showMessage, openModal, requestLocationPermission, MANAGER_PHONE, $ } from "./ui.js";

setupDashboardTabs("dashboard");
configurarSelectEstadoCidade({ estadoId: "originState", cidadeId: "originCity", estadoPlaceholder: "Estado origem", cidadePlaceholder: "Cidade origem" });
configurarSelectEstadoCidade({ estadoId: "destinationState", cidadeId: "destinationCity", estadoPlaceholder: "Estado destino", cidadePlaceholder: "Cidade destino" });
$("logoutBtn")?.addEventListener("click", logout); $("logoutMobileBtn")?.addEventListener("click", logout);
async function logout(){ await signOut(auth); location.href="login.html"; }
let currentUser, companies=[], freights=[], drivers=[], apps=[], tracks=[], commissions=[];

onAuthStateChanged(auth, async user => {
  if (!user) return location.href="login.html";
  const profile = (await getDoc(doc(db,"usuarios",user.uid))).data();
  if ((profile?.tipo || profile?.role) !== "gestor") return location.href="login.html";
  currentUser = user;
  requestLocationPermission(null, (text,type)=>showMessage($("formMessage"), text, type));
  listenAll(); refreshCounters();
});

function listenAll(){
  onSnapshot(query(collection(db,"empresas"), limit(80)), s => { companies=s.docs.map(d=>({id:d.id,...d.data()})); fillCompanySelect(); renderCompanies(); }, e=>warn("empresas",e));
  onSnapshot(query(collection(db,"fretes"), orderBy("createdAt","desc"), limit(80)), async s => { freights=s.docs.map(d=>({id:d.id,...d.data()})); await attachApplications(); renderFreights(); renderDashboardAlerts(); refreshCounters(); }, e=>warn("fretes",e));
  onSnapshot(query(collection(db,"caminhoneiros"), limit(100)), s => { drivers=s.docs.map(d=>({id:d.id,...d.data()})); renderDrivers(); }, e=>warn("caminhoneiros",e));
  onSnapshot(query(collectionGroup(db,"rastreamento"), limit(100)), s => { tracks=s.docs.map(d=>({id:d.id,...d.data()})); renderTracking(); }, e=>warn("rastreamento",e));
  onSnapshot(query(collection(db,"comissoes"), orderBy("createdAt","desc"), limit(100)), s => { commissions=s.docs.map(d=>({id:d.id,...d.data()})); renderCommissions(); refreshCounters(); }, e=>warn("comissões",e));
}
function warn(area,e){ console.error(area,e); }
async function refreshCounters(){
  try{
    const [abertos, pend, dr, veh] = await Promise.all([
      getCountFromServer(query(collection(db,"fretes"), where("status","==","aberto"))),
      getCountFromServer(query(collectionGroup(db,"candidaturas"), where("status","==","pendente"))),
      getCountFromServer(collection(db,"caminhoneiros")),
      getCountFromServer(collectionGroup(db,"veiculos"))
    ]);
    $("openFreights").textContent=abertos.data().count; $("applicationsCount").textContent=pend.data().count; $("driversCount").textContent=dr.data().count;
    const pendingValue = commissions.filter(c=>c.status!=="paga" && c.status!=="cancelada").reduce((sum,c)=>sum+Number(c.valorComissao||0),0);
    $("pendingCommissions").textContent=money(pendingValue);
    await setDoc(doc(db,"publico","resumo"), { fretesAtivos: abertos.data().count, caminhoneiros: dr.data().count, veiculos: veh.data().count, updatedAt: serverTimestamp() }, { merge:true });
  }catch(e){ console.warn("contadores",e); }
}
async function attachApplications(){
  apps=[];
  await Promise.all(freights.map(async f=>{
    try{ const s=await getDocs(query(collection(db,"fretes",f.id,"candidaturas"), limit(30))); f.applications=s.docs.map(d=>({id:d.id,...d.data()})); apps.push(...f.applications); }
    catch{ f.applications=[]; }
  }));
}
function fillCompanySelect(){ const el=$("companySelect"); if(!el) return; el.innerHTML=`<option value="">Empresa responsável</option>`+companies.map(c=>`<option value="${c.id}">${safeText(c.empresaNome||c.nome)}</option>`).join(""); }

$("freightForm")?.addEventListener("submit", async e=>{
  e.preventDefault(); const origin=obterLocalidade("originState","originCity"), dest=obterLocalidade("destinationState","destinationCity"); const empresa=companies.find(c=>c.id===$("companySelect").value);
  const code=buildFreightCode(); const price=Number($("price").value||0), cv=Number($("commissionValue").value||0), ct=$("commissionType").value;
  const commissionAmount = ct === "percentual" ? price * cv / 100 : cv;
  const freight={ code, empresaId: empresa?.id||"", empresaNome: empresa?.empresaNome||empresa?.nome||"Operação interna", originText: origin.texto, originUf:origin.uf, originCity:origin.cidade, destinationText:dest.texto, destinationUf:dest.uf, destinationCity:dest.cidade, cargoType:$("cargoType").value.trim(), weight:Number($("weight").value||0), price, vehicleType:$("vehicleType").value, deadline:$("deadline").value, description:$("description").value.trim(), managerPhone:MANAGER_PHONE, status:"aberto", commissionType:ct, commissionValue:cv, commissionAmount, createdBy:currentUser.uid, createdAt:serverTimestamp(), updatedAt:serverTimestamp() };
  const ref=await addDoc(collection(db,"fretes"), freight);
  await setDoc(doc(db,"fretes",ref.id,"privado","detalhes"), { pickupAddress:$("pickupAddress").value.trim(), deliveryAddress:$("deliveryAddress").value.trim(), pickupContactName:$("pickupContactName").value.trim(), pickupContactPhone:$("pickupContactPhone").value.trim(), managerPhone:MANAGER_PHONE, createdAt:serverTimestamp() });
  await addEvent(ref.id, "Frete criado", `Código ${code} publicado pelo gestor.`);
  e.target.reset(); showMessage($("formMessage"), `Frete ${code} publicado.`);
});
async function addEvent(freightId, title, detail){ await addDoc(collection(db,"fretes",freightId,"eventos"), { title, detail, createdAt:serverTimestamp(), createdBy: currentUser?.uid||"sistema" }); }

["statusFilter","freightSearch"].forEach(id=>$(id)?.addEventListener("input",renderFreights));
function renderFreights(){ const q=($("freightSearch")?.value||"").toLowerCase(), st=$("statusFilter")?.value||"todos"; let list=freights.filter(f=>(st==="todos"||f.status===st)&&`${f.code} ${f.empresaNome} ${f.originText} ${f.destinationText} ${f.cargoType}`.toLowerCase().includes(q)); const el=$("freightsList"); if(!el)return; if(!list.length){el.innerHTML=`<p class="empty">Nenhum frete encontrado.</p>`;return;} el.innerHTML=list.map(f=>`<article class="item freight-card"><div class="item-header"><div><h3>${safeText(f.code)} • ${safeText(f.originText)} → ${safeText(f.destinationText)}</h3><p>${safeText(f.empresaNome)} • ${safeText(f.cargoType)} • ${safeText(f.vehicleType)} • ${money(f.price)}</p></div><span class="badge ${statusClass(f.status)}">${statusLabel(f.status)}</span></div><p>${safeText(f.description,"Operação disponível.")}</p><div class="actions"><button onclick="abrirComprovante('${f.id}')">Comprovante</button><a class="button-link" href="acompanhar.html?codigo=${encodeURIComponent(f.code)}" target="_blank">Acompanhar</a><button onclick="finalizarFrete('${f.id}')">Finalizar</button><button class="danger" onclick="cancelarFrete('${f.id}')">Cancelar</button></div><div class="applications-box"><strong>Candidaturas (${f.applications?.length||0})</strong>${(f.applications||[]).map(a=>renderApplication(f,a)).join("")||`<p class="muted">Sem candidaturas.</p>`}</div></article>`).join(""); }
function renderApplication(f,a){ const can=a.status==="pendente"&&f.status==="aberto"; return `<div class="application-row"><div><strong>${safeText(a.driverName)}</strong><p>${safeText(a.driverPhone)} • ${safeText(a.vehicleLabel)} • Proposta ${money(a.proposedValue||f.price)}</p></div><span class="badge ${statusClass(a.status)}">${statusLabel(a.status)}</span><div class="actions"><a class="button-link" target="_blank" href="${whatsappUrl(a.driverPhone,`Olá, sobre sua candidatura no frete ${f.code}.`)}">WhatsApp</a>${can?`<button class="success" onclick="aprovarCandidatura('${f.id}','${a.driverId}')">Liberar</button><button class="danger" onclick="recusarCandidatura('${f.id}','${a.driverId}')">Recusar</button>`:""}</div></div>`; }
window.aprovarCandidatura=async(freightId,driverId)=>{ const f=freights.find(x=>x.id===freightId); const a=f?.applications?.find(x=>x.driverId===driverId); if(!f||!a)return; const priv=(await getDoc(doc(db,"fretes",freightId,"privado","detalhes"))).data()||{}; const payload={status:"liberado", freightStatus:"em_andamento", releasedAt:serverTimestamp(), pickupAddress:priv.pickupAddress||"", deliveryAddress:priv.deliveryAddress||"", pickupContactName:priv.pickupContactName||"", pickupContactPhone:priv.pickupContactPhone||"", managerPhone:MANAGER_PHONE, operationCode:f.code, updatedAt:serverTimestamp()}; await updateDoc(doc(db,"fretes",freightId),{status:"em_andamento", selectedDriverId:driverId, selectedDriverName:a.driverName, selectedDriverPhone:a.driverPhone, selectedVehicle:a.vehicleLabel, updatedAt:serverTimestamp()}); await updateDoc(doc(db,"fretes",freightId,"candidaturas",driverId),payload); await setDoc(doc(db,"caminhoneiros",driverId,"minhasCandidaturas",freightId),{...a,...payload, ...copyFreight(f)}, {merge:true}); await setDoc(doc(db,"comissoes",freightId),{freightId, code:f.code, empresaId:f.empresaId||"", empresaNome:f.empresaNome||"", driverId, driverName:a.driverName, valorFrete:f.price, tipoComissao:f.commissionType||"percentual", taxaComissao:f.commissionValue||5, valorComissao:f.commissionAmount||Number(f.price||0)*0.05, status:"pendente", vencimento:f.deadline||"", createdAt:serverTimestamp(), updatedAt:serverTimestamp()},{merge:true}); await addEvent(freightId,"Caminhoneiro liberado",`${a.driverName} foi autorizado para o frete ${f.code}.`); };
function copyFreight(f){return{freightId:f.id, code:f.code, originText:f.originText,destinationText:f.destinationText,cargoType:f.cargoType,price:f.price,deadline:f.deadline,vehicleType:f.vehicleType,empresaNome:f.empresaNome};}
window.recusarCandidatura=async(fid,did)=>{ await updateDoc(doc(db,"fretes",fid,"candidaturas",did),{status:"recusado",updatedAt:serverTimestamp()}); await setDoc(doc(db,"caminhoneiros",did,"minhasCandidaturas",fid),{status:"recusado",updatedAt:serverTimestamp()},{merge:true}); await addEvent(fid,"Candidatura recusada","Uma candidatura foi recusada pelo gestor."); };
window.finalizarFrete=async(fid)=>{ await updateDoc(doc(db,"fretes",fid),{status:"finalizado",updatedAt:serverTimestamp(),finishedAt:serverTimestamp()}); await updateDoc(doc(db,"comissoes",fid),{status:"a_faturar",updatedAt:serverTimestamp()}).catch(()=>{}); await addEvent(fid,"Frete finalizado","Operação finalizada pelo gestor."); };
window.cancelarFrete=async(fid)=>{ const motivo=prompt("Motivo do cancelamento:")||"Cancelado pelo gestor"; await updateDoc(doc(db,"fretes",fid),{status:"cancelado",cancelReason:motivo,updatedAt:serverTimestamp()}); await addEvent(fid,"Frete cancelado",motivo); };
window.abrirComprovante=async(fid)=>{ const f=freights.find(x=>x.id===fid); const events=(await getDocs(query(collection(db,"fretes",fid,"eventos"),orderBy("createdAt","asc"),limit(50)))).docs.map(d=>d.data()); openModal(`<div class="modal-header"><div><p class="eyebrow">Comprovante de intermediação</p><h2>${safeText(f.code)}</h2></div><button class="modal-close" onclick="fecharModal()">×</button></div><div class="modal-grid"><article><span>Empresa</span><strong>${safeText(f.empresaNome)}</strong></article><article><span>Caminhoneiro</span><strong>${safeText(f.selectedDriverName,"Aguardando liberação")}</strong></article><article><span>Rota</span><strong>${safeText(f.originText)} → ${safeText(f.destinationText)}</strong></article><article><span>Valor</span><strong>${money(f.price)}</strong></article><article><span>Comissão</span><strong>${money(f.commissionAmount||Number(f.price||0)*0.05)}</strong></article><article><span>Status</span><strong>${statusLabel(f.status)}</strong></article></div><h3>Linha do tempo</h3><div class="modal-list">${events.map(e=>`<div><strong>${safeText(e.title)}</strong><p>${safeText(e.detail)} • ${formatDate(e.createdAt)}</p></div>`).join("")||"<p class='empty'>Sem eventos.</p>"}</div>`); };

["companySearch"].forEach(id=>$(id)?.addEventListener("input",renderCompanies));
function renderCompanies(){ const q=($("companySearch")?.value||"").toLowerCase(); const list=companies.filter(c=>`${c.empresaNome} ${c.nome} ${c.responsavel} ${c.telefone} ${c.baseLocation}`.toLowerCase().includes(q)); const el=$("companiesList"); if(!el)return; el.innerHTML=list.map(c=>`<article class="item"><div class="item-header"><div><h3>${safeText(c.empresaNome||c.nome)}</h3><p>${safeText(c.responsavel)} • ${safeText(c.telefone)} • ${safeText(c.baseLocation)}</p></div><span class="badge open">ativa</span></div><div class="actions"><a class="button-link" target="_blank" href="${whatsappUrl(c.telefone, "Olá, sobre suas cargas no FreteHub.")}">WhatsApp</a></div></article>`).join("")||`<p class="empty">Nenhuma empresa encontrada.</p>`; }
["driverSearch","driverAvailabilityFilter"].forEach(id=>$(id)?.addEventListener("input",renderDrivers));
async function renderDrivers(){ const q=($("driverSearch")?.value||"").toLowerCase(), f=$("driverAvailabilityFilter")?.value||"todos"; const list=drivers.filter(d=>(f==="todos"||(f==="favorito"?d.favorito:d.disponibilidade===f))&&`${d.nome} ${d.telefone} ${d.baseLocation} ${d.cargoPreferences} ${d.preferredRoutes}`.toLowerCase().includes(q)); const el=$("driversList"); if(!el)return; if(!list.length){el.innerHTML=`<p class="empty">Nenhum caminhoneiro encontrado.</p>`;return;} const html=[]; for(const d of list){ let vs=[]; try{vs=(await getDocs(query(collection(db,"caminhoneiros",d.id,"veiculos"),limit(5)))).docs.map(x=>x.data());}catch{} html.push(`<article class="item clickable" onclick="abrirCaminhoneiro('${d.id}')"><div class="item-header"><div><h3>${safeText(d.nome)}</h3><p>${safeText(d.telefone)} • ${safeText(d.baseLocation)} • ${statusLabel(d.disponibilidade||"disponivel")}</p></div><span class="badge ${d.favorito?'open':'pending'}">${d.favorito?'Favorito':'Perfil'}</span></div><div class="mini-list">${vs.map(v=>`<span>${safeText(v.type)} ${safeText(v.model)} • ${safeText(v.plate)}</span>`).join("")||"<span>Sem veículos.</span>"}</div></article>`);} el.innerHTML=html.join(""); }
window.abrirCaminhoneiro=async(id)=>{ const d=drivers.find(x=>x.id===id); const [vs,as,rv]=await Promise.all([getDocs(query(collection(db,"caminhoneiros",id,"veiculos"),limit(20))),getDocs(query(collection(db,"caminhoneiros",id,"minhasCandidaturas"),limit(30))),getDocs(query(collection(db,"avaliacoes"),where("driverId","==",id),limit(20)))]); const vehicles=vs.docs.map(x=>x.data()), appl=as.docs.map(x=>x.data()), reviews=rv.docs.map(x=>x.data()); const avg=reviews.length?(reviews.reduce((s,r)=>s+Number(r.nota||0),0)/reviews.length).toFixed(1):"-"; openModal(`<div class="modal-header"><div><p class="eyebrow">Caminhoneiro</p><h2>${safeText(d.nome)}</h2></div><button class="modal-close" onclick="fecharModal()">×</button></div><div class="modal-grid"><article><span>WhatsApp</span><strong>${safeText(d.telefone)}</strong></article><article><span>Base</span><strong>${safeText(d.baseLocation)}</strong></article><article><span>Disponibilidade</span><strong>${statusLabel(d.disponibilidade)}</strong></article><article><span>Avaliação</span><strong>${avg}</strong></article><article><span>Documento</span><strong>${safeText(d.document)}</strong></article><article><span>CNH</span><strong>${safeText(d.cnh)}</strong></article></div><div class="actions modal-actions"><a class="button-link" target="_blank" href="${whatsappUrl(d.telefone,"Olá, tenho uma oportunidade de frete pelo FreteHub.")}">Chamar no WhatsApp</a><button onclick="toggleFavorito('${id}', ${!d.favorito})">${d.favorito?'Remover favorito':'Favoritar'}</button><button class="danger" onclick="toggleBloqueado('${id}', ${!d.bloqueado})">${d.bloqueado?'Desbloquear':'Bloquear'}</button></div><h3>Veículos</h3><div class="modal-list">${vehicles.map(v=>`<div><strong>${safeText(v.type)} ${safeText(v.model)}</strong><p>Placa ${safeText(v.plate)} • Ano ${safeText(v.year)} • ${safeText(v.capacity)} kg • ${safeText(v.status)}</p></div>`).join("")||"<p class='empty'>Sem veículos.</p>"}</div><h3>Histórico</h3><div class="modal-list">${appl.map(a=>`<div><strong>${safeText(a.code)} • ${safeText(a.originText)} → ${safeText(a.destinationText)}</strong><p>${statusLabel(a.status)} • ${money(a.price)} • ${formatDate(a.createdAt)}</p></div>`).join("")||"<p class='empty'>Sem histórico.</p>"}</div>`); };
window.toggleFavorito=async(id,val)=>{ await updateDoc(doc(db,"caminhoneiros",id),{favorito:val,updatedAt:serverTimestamp()}); await updateDoc(doc(db,"usuarios",id),{favorito:val,updatedAt:serverTimestamp()}).catch(()=>{}); };
window.toggleBloqueado=async(id,val)=>{ await updateDoc(doc(db,"caminhoneiros",id),{bloqueado:val,status:val?"bloqueado":"ativo",updatedAt:serverTimestamp()}); };
["trackingSearch","trackingFilter"].forEach(id=>$(id)?.addEventListener("input",renderTracking));
function renderTracking(){ const q=($("trackingSearch")?.value||"").toLowerCase(), mode=$("trackingFilter")?.value||"ativos"; const list=tracks.filter(t=>(mode==="todos"||t.active!==false)&&`${t.driverName} ${t.code} ${t.originText}`.toLowerCase().includes(q)).sort((a,b)=>(b.updatedAt?.seconds||0)-(a.updatedAt?.seconds||0)); const el=$("trackingList"); if(!el)return; el.innerHTML=list.map(t=>`<article class="item"><div class="item-header"><div><h3>${safeText(t.driverName)} • ${safeText(t.code)}</h3><p>${safeText(t.originText)} → ${safeText(t.destinationText)} • ${formatDate(t.updatedAt)} • precisão ${Math.round(t.accuracy||0)}m</p></div><span class="badge progress">ao vivo</span></div><div class="actions"><a class="button-link" target="_blank" href="${mapsUrl(`${t.lat},${t.lng}`)}">Abrir mapa</a></div></article>`).join("")||`<p class="empty">Nenhum rastreamento ativo.</p>`; }
["commissionSearch","commissionStatusFilter"].forEach(id=>$(id)?.addEventListener("input",renderCommissions));
function renderCommissions(){ const q=($('commissionSearch')?.value||'').toLowerCase(), st=$('commissionStatusFilter')?.value||'todos'; const list=commissions.filter(c=>(st==='todos'||c.status===st)&&`${c.code} ${c.empresaNome} ${c.driverName}`.toLowerCase().includes(q)); const totalPendente=list.filter(c=>c.status!=='paga'&&c.status!=='cancelada').reduce((s,c)=>s+Number(c.valorComissao||0),0); const el=$('commissionsList'); if(!el)return; el.innerHTML=`<div class="finance-grid"><article><span>Total filtrado</span><strong>${money(totalPendente)}</strong></article><article><span>Pendentes</span><strong>${list.filter(c=>c.status==="pendente").length}</strong></article><article><span>Pagas</span><strong>${list.filter(c=>c.status==="paga").length}</strong></article><article><span>Vencidas</span><strong>${list.filter(c=>c.status==="atrasada"||c.status==="vencida").length}</strong></article></div>` + (list.map(c=>`<article class="item"><div class="item-header"><div><h3>${safeText(c.code)} • ${safeText(c.empresaNome)}</h3><p>Caminhoneiro: ${safeText(c.driverName)} • Frete ${money(c.valorFrete)} • Comissão ${money(c.valorComissao)}</p></div><span class="badge ${statusClass(c.status)}">${statusLabel(c.status)}</span></div><div class="actions"><button onclick="setCommission('${c.id}','cobrada')">Marcar cobrada</button><button class="success" onclick="setCommission('${c.id}','paga')">Marcar paga</button><button onclick="cobrarComissao('${c.id}')">Cobrar no WhatsApp</button><button onclick="gerarRecibo('${c.id}')">Recibo</button><button onclick="abrirComprovante('${c.freightId||c.id}')">Comprovante</button></div></article>`).join('')||`<p class="empty">Nenhuma comissão.</p>`); }
window.setCommission=async(id,status)=>updateDoc(doc(db,"comissoes",id),{status,updatedAt:serverTimestamp()});
function renderDashboardAlerts(){ const el=$("dashboardAlerts"); if(!el)return; const pend=apps.filter(a=>a.status==="pendente").slice(0,5); el.innerHTML=pend.map(a=>`<article class="item"><strong>${safeText(a.driverName)}</strong><p>Candidatura pendente no frete ${safeText(a.code||a.freightId)}</p></article>`).join("")||`<p class="empty">Operação em dia.</p>`; }

// Camada comercial e operacional adicional
function initCommercialTools(){
  const base = location.origin + location.pathname.replace(/gestor\.html$/, '');
  if($("driverInvite")) $("driverInvite").textContent = `${base}cadastro-caminhoneiro.html?ref=GESTOR`;
  if($("companyInvite")) $("companyInvite").textContent = `${base}cadastro-empresa.html?ref=GESTOR`;
  $("exportFreights")?.addEventListener("click",()=>csvDownload("fretes.csv", freights.map(f=>({codigo:f.code, empresa:f.empresaNome, origem:f.originText, destino:f.destinationText, status:f.status, valor:f.price, comissao:f.commissionAmount, motorista:f.selectedDriverName||""}))));
  $("exportCommissions")?.addEventListener("click",()=>csvDownload("comissoes.csv", commissions.map(c=>({codigo:c.code, empresa:c.empresaNome, motorista:c.driverName, frete:c.valorFrete, comissao:c.valorComissao, status:c.status, vencimento:c.vencimento||""}))));
  $("exportDrivers")?.addEventListener("click",()=>csvDownload("caminhoneiros.csv", drivers.map(d=>({nome:d.nome, telefone:d.telefone, base:d.baseLocation, disponibilidade:d.disponibilidade, favorito:!!d.favorito, bloqueado:!!d.bloqueado, origem:d.origemCadastro||""}))));
  $("exportCompanies")?.addEventListener("click",()=>csvDownload("empresas.csv", companies.map(c=>({empresa:c.empresaNome||c.nome, responsavel:c.responsavel, telefone:c.telefone, base:c.baseLocation, aceiteComissao:!!c.aceiteComissao, origem:c.origemCadastro||""}))));
  $("backupJson")?.addEventListener("click",()=>jsonDownload("fretehub-backup.json", {freights, commissions, drivers, companies, exportedAt:new Date().toISOString()}));
  $("refreshQuality")?.addEventListener("click", renderQualityPanel);
}
setTimeout(initCommercialTools, 800);
function renderQualityPanel(){
  const el=$("qualityPanel"); if(!el) return;
  const semVeiculo = drivers.filter(d=>!d.temVeiculo && !(d.vehicleCount>0));
  const semBase = drivers.filter(d=>!d.baseLocation);
  const empSemTelefone = companies.filter(c=>!c.telefone);
  const freteSemValor = freights.filter(f=>!Number(f.price));
  const freteSemComissao = freights.filter(f=>!Number(f.commissionAmount));
  el.innerHTML = [
    ["Caminhoneiros sem veiculo confirmado", semVeiculo.length],
    ["Caminhoneiros sem cidade base", semBase.length],
    ["Empresas sem telefone", empSemTelefone.length],
    ["Fretes sem valor", freteSemValor.length],
    ["Fretes sem comissao", freteSemComissao.length],
    ["Empresas com aceite de comissao", companies.filter(c=>c.aceiteComissao).length]
  ].map(x=>`<article class="quality-card"><span>${x[0]}</span><strong>${x[1]}</strong></article>`).join("");
}
window.cobrarComissao = async (commissionId) => {
  const c = commissions.find(x=>x.id===commissionId); if(!c) return;
  await updateDoc(doc(db,"comissoes",commissionId),{status:"cobrada",ultimaCobranca:serverTimestamp(),updatedAt:serverTimestamp()}).catch(()=>{});
  abrirWhatsAppRegistrando(c.empresaTelefone||MANAGER_PHONE, `Ola, referente ao frete ${c.code}, consta comissao pendente no valor de ${money(c.valorComissao)} pela intermediacao realizada via FreteHub.`, {codigo:c.code, freteId:c.freightId||commissionId, origem:"gestor_comissoes"});
};
window.gerarRecibo = (commissionId) => { window.open(`recibo.html?comissao=${encodeURIComponent(commissionId)}`, "_blank"); };
window.validarCodigo = (code) => { window.open(`validar.html?codigo=${encodeURIComponent(code)}`, "_blank"); };
window.registrarTagInterna = async (driverId, tag) => {
  await addDoc(collection(db,"caminhoneiros",driverId,"tagsInternas"),{tag, createdAt:serverTimestamp(), createdBy:currentUser?.uid||"gestor"});
  alert("Registro interno salvo.");
};
window.confirmarContratacaoGestor = async (freightId) => {
  const f=freights.find(x=>x.id===freightId); if(!f) return;
  await updateDoc(doc(db,"fretes",freightId),{contratacaoConfirmada:true,status:"em_andamento",updatedAt:serverTimestamp()});
  await addEvent(freightId,"Contratacao confirmada","A contratacao do caminhoneiro foi confirmada no painel do gestor.");
  await setDoc(doc(db,"comissoes",freightId),{freightId, code:f.code, empresaId:f.empresaId||"", empresaNome:f.empresaNome||"", empresaTelefone:f.empresaTelefone||"", driverId:f.selectedDriverId||"", driverName:f.selectedDriverName||"", valorFrete:Number(f.price||0), valorComissao:Number(f.commissionAmount||Number(f.price||0)*0.05), status:"pendente", vencimento:f.commissionDueDate||"", createdAt:serverTimestamp(), updatedAt:serverTimestamp()},{merge:true});
};
