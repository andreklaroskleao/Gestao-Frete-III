import { auth, db, onAuthStateChanged, signOut, collection, doc, addDoc, setDoc, getDoc, getDocs, updateDoc, query, where, orderBy, serverTimestamp, onSnapshot, limit } from "./firebase.js";
import { configurarSelectEstadoCidade, obterLocalidade } from "./ibge.js";
import { abrirWhatsAppRegistrando } from "./comercial.js";
import { setupDashboardTabs, safeText, statusClass, statusLabel, money, whatsappUrl, buildFreightCode, formatDate, showMessage, requestLocationPermission, MANAGER_PHONE, $ } from "./ui.js";

setupDashboardTabs("dashboard");
configurarSelectEstadoCidade({ estadoId:"originState", cidadeId:"originCity", estadoPlaceholder:"Estado origem", cidadePlaceholder:"Cidade origem" });
configurarSelectEstadoCidade({ estadoId:"destinationState", cidadeId:"destinationCity", estadoPlaceholder:"Estado destino", cidadePlaceholder:"Cidade destino" });
$("logoutBtn")?.addEventListener("click", logout); $("logoutMobileBtn")?.addEventListener("click", logout);
async function logout(){ await signOut(auth); location.href="login.html"; }
let uid, profile={}, freights=[], commissions=[];
onAuthStateChanged(auth, async user=>{ if(!user)return location.href="login.html"; uid=user.uid; profile=(await getDoc(doc(db,"usuarios",uid))).data()||{}; if((profile.tipo||profile.role)!=="empresa") return location.href="login.html"; $("companyTitle").textContent=profile.empresaNome||profile.nome||"Painel da empresa"; requestLocationPermission(null,()=>{}); listen(); });
function listen(){ onSnapshot(query(collection(db,"fretes"), where("empresaId","==",uid), orderBy("createdAt","desc"), limit(80)), async s=>{ freights=s.docs.map(d=>({id:d.id,...d.data()})); await attachApps(); renderFreights(); updateCards(); }, console.error); onSnapshot(query(collection(db,"comissoes"), where("empresaId","==",uid), limit(80)), s=>{ commissions=s.docs.map(d=>({id:d.id,...d.data()})); renderCommissions(); updateCards(); }, console.error); }
async function attachApps(){ await Promise.all(freights.map(async f=>{ try{ const s=await getDocs(query(collection(db,"fretes",f.id,"candidaturas"),limit(30))); f.applications=s.docs.map(d=>({id:d.id,...d.data()})); }catch{ f.applications=[]; } })); }
function updateCards(){ $("companyActiveFreights").textContent=freights.filter(f=>f.status!=="finalizado"&&f.status!=="cancelado").length; $("companyApplications").textContent=freights.reduce((s,f)=>s+(f.applications?.length||0),0); $("companyCommissions").textContent=money(commissions.filter(c=>c.status!=="paga").reduce((s,c)=>s+Number(c.valorComissao||0),0)); }
$("companyFreightForm")?.addEventListener("submit", async e=>{ e.preventDefault(); const origin=obterLocalidade("originState","originCity"), dest=obterLocalidade("destinationState","destinationCity"); const price=Number($("price").value||0); const code=buildFreightCode(); const freight={ code, empresaId:uid, empresaNome:profile.empresaNome||profile.nome, originText:origin.texto, destinationText:dest.texto, originUf:origin.uf, destinationUf:dest.uf, cargoType:$("cargoType").value.trim(), weight:Number($("weight").value||0), price, vehicleType:$("vehicleType").value, deadline:$("deadline").value, description:$("description").value.trim(), managerPhone:MANAGER_PHONE, status:"aberto", commissionType:"percentual", commissionValue:5, commissionAmount:price*0.05, createdBy:uid, createdAt:serverTimestamp(), updatedAt:serverTimestamp() }; const ref=await addDoc(collection(db,"fretes"),freight); await setDoc(doc(db,"fretes",ref.id,"privado","detalhes"),{pickupAddress:$("pickupAddress").value.trim(),deliveryAddress:$("deliveryAddress").value.trim(),pickupContactName:$("pickupContactName").value.trim(),pickupContactPhone:$("pickupContactPhone").value.trim(),managerPhone:MANAGER_PHONE,createdAt:serverTimestamp()}); await addDoc(collection(db,"fretes",ref.id,"eventos"),{title:"Frete criado",detail:`Empresa ${freight.empresaNome} publicou o frete ${code}.`,createdAt:serverTimestamp(),createdBy:uid}); e.target.reset(); showMessage($("formMessage"),`Frete ${code} publicado.`); });
["freightSearch","statusFilter"].forEach(id=>$(id)?.addEventListener("input",renderFreights));
function renderFreights(){ const q=($("freightSearch")?.value||"").toLowerCase(), st=$("statusFilter")?.value||"todos"; const list=freights.filter(f=>(st==="todos"||f.status===st)&&`${f.code} ${f.originText} ${f.destinationText} ${f.cargoType}`.toLowerCase().includes(q)); const el=$("freightsList"); if(!el)return; el.innerHTML=list.map(f=>`<article class="item"><div class="item-header"><div><h3>${safeText(f.code)} • ${safeText(f.originText)} → ${safeText(f.destinationText)}</h3><p>${safeText(f.cargoType)} • ${money(f.price)} • ${statusLabel(f.status)}</p></div><span class="badge ${statusClass(f.status)}">${statusLabel(f.status)}</span></div><div class="actions"><a class="button-link" href="acompanhar.html?codigo=${encodeURIComponent(f.code)}" target="_blank">Acompanhar</a><a class="button-link" href="${whatsappUrl(MANAGER_PHONE,`Olá, sou da empresa ${profile.empresaNome||profile.nome}. Quero falar sobre o frete ${f.code}.`)}" target="_blank">Chamar gestor</a><button onclick="confirmarContratacao('${f.id}')">Confirmar contratação</button><button onclick="confirmarEntrega('${f.id}')">Confirmar entrega</button><a class="button-link" href="validar.html?codigo=${encodeURIComponent(f.code)}" target="_blank">Validar código</a></div><div class="applications-box"><strong>Candidaturas</strong>${(f.applications||[]).map(a=>`<div class="application-row"><div><strong>${safeText(a.driverName)}</strong><p>${safeText(a.driverPhone)} • ${safeText(a.vehicleLabel)} • ${money(a.proposedValue||f.price)}</p></div><span class="badge ${statusClass(a.status)}">${statusLabel(a.status)}</span><a class="button-link" target="_blank" href="${whatsappUrl(a.driverPhone,`Olá, sou da empresa responsável pelo frete ${f.code}.`)}">WhatsApp</a></div>`).join("")||"<p class='muted'>Sem candidaturas.</p>"}</div></article>`).join("")||`<p class="empty">Nenhum frete encontrado.</p>`; }
window.confirmarContratacao=async id=>{ const f=freights.find(x=>x.id===id); if(!f)return; await updateDoc(doc(db,"fretes",id),{contratacaoConfirmada:true,status:"em_andamento",updatedAt:serverTimestamp()}); await setDoc(doc(db,"comissoes",id),{freightId:id, code:f.code, empresaId:uid, empresaNome:profile.empresaNome||profile.nome, empresaTelefone:profile.telefone, driverId:f.selectedDriverId||"", driverName:f.selectedDriverName||"", valorFrete:Number(f.price||0), valorComissao:Number(f.commissionAmount||Number(f.price||0)*0.05), status:"pendente", createdAt:serverTimestamp(), updatedAt:serverTimestamp()},{merge:true}); await addDoc(collection(db,"fretes",id,"eventos"),{title:"Contratacao confirmada",detail:"A empresa confirmou a contratacao pela plataforma.",createdAt:serverTimestamp(),createdBy:uid}); alert("Contratacao confirmada e comissao registrada."); };
window.confirmarEntrega=async id=>{ await updateDoc(doc(db,"fretes",id),{status:"finalizado",confirmedByCompany:true,updatedAt:serverTimestamp()}); await addDoc(collection(db,"fretes",id,"eventos"),{title:"Entrega confirmada",detail:"A empresa confirmou a conclusão da operação.",createdAt:serverTimestamp(),createdBy:uid}); };
function renderCommissions(){ const el=$("commissionsList"); if(!el)return; el.innerHTML=commissions.map(c=>`<article class="item"><div class="item-header"><div><h3>${safeText(c.code)}</h3><p>Caminhoneiro ${safeText(c.driverName)} • Comissão ${money(c.valorComissao)} • Criada em ${formatDate(c.createdAt)}</p></div><span class="badge ${statusClass(c.status)}">${statusLabel(c.status)}</span></div></article>`).join("")||`<p class="empty">Nenhuma comissão registrada.</p>`; }

setTimeout(()=>{ const el=$("companyReferralLink"); if(el) el.textContent=location.origin+location.pathname.replace(/empresa\.html$/,"")+"cadastro-empresa.html?ref="+uid; }, 800);
window.chamarGestorEmpresa=(code)=>abrirWhatsAppRegistrando(MANAGER_PHONE,`Ola, sou da empresa ${profile.empresaNome||profile.nome}. Quero falar sobre o frete ${code}.`,{codigo:code,origem:"empresa"});

// UX premium: proximas acoes, chat com gestor, contatos, locais e perfil da empresa
function renderCompanyNextActions(){
  const el = $("companyNextActions"); if(!el) return;
  const abertas = freights.filter(f=>f.status === "aberto").length;
  const candidaturas = freights.reduce((s,f)=>s+(f.applications||[]).filter(a=>a.status==="pendente").length,0);
  const pendentes = commissions.filter(c=>c.status!=="paga"&&c.status!=="cancelada").length;
  const rows = [
    [`${abertas} carga(s) aberta(s)`, "Acompanhe candidaturas e confirme a contratacao quando escolher o caminhoneiro."],
    [`${candidaturas} candidato(s) aguardando`, "Analise os perfis e converse com o gestor antes de confirmar."],
    [`${pendentes} comissao(oes) pendente(s)`, "Consulte vencimentos e recibos no financeiro da empresa."]
  ];
  el.innerHTML = rows.map(r=>`<article class="item next-action"><div><strong>${safeText(r[0])}</strong><p>${safeText(r[1])}</p></div></article>`).join("");
}
const previousUpdateCards = updateCards;
updateCards = function(){ previousUpdateCards(); renderCompanyNextActions(); };

let companyContacts = [], companyPlaces = [];
function listenCompanyExtras(){
  if(!uid) return;
  onSnapshot(query(collection(db,"empresas",uid,"contatos"), orderBy("createdAt","desc"), limit(30)), s=>{ companyContacts=s.docs.map(d=>({id:d.id,...d.data()})); renderCompanyContacts(); }, console.warn);
  onSnapshot(query(collection(db,"empresas",uid,"locais"), orderBy("createdAt","desc"), limit(30)), s=>{ companyPlaces=s.docs.map(d=>({id:d.id,...d.data()})); renderCompanyPlaces(); }, console.warn);
}
function renderCompanyContacts(){
  const el=$("companyContactsList"); if(!el) return;
  el.innerHTML = companyContacts.map(c=>`<article class="item"><div class="item-header"><div><h3>${safeText(c.nome)}</h3><p>${safeText(c.cargo)} • ${safeText(c.telefone)}</p><p>${safeText(c.observacoes)}</p></div><a class="button-link" target="_blank" href="${whatsappUrl(c.telefone,`Olá, sou da ${profile.empresaNome||profile.nome}.`)}">WhatsApp</a></div></article>`).join("") || `<p class="empty">Nenhum contato cadastrado ainda.</p>`;
}
function renderCompanyPlaces(){
  const el=$("companyPlacesList"); if(!el) return;
  el.innerHTML = companyPlaces.map(l=>`<article class="item"><div class="item-header"><div><h3>${safeText(l.nome)}</h3><p>${safeText(l.endereco)}</p><p>${safeText(l.cidade)} • ${safeText(l.responsavel)} • ${safeText(l.telefone)}</p><p>${safeText(l.observacoes)}</p></div><a class="button-link" target="_blank" href="${whatsappUrl(l.telefone,`Olá, sou da ${profile.empresaNome||profile.nome}.`)}">WhatsApp</a></div></article>`).join("") || `<p class="empty">Nenhum local frequente cadastrado ainda.</p>`;
}
$("companyContactForm")?.addEventListener("submit", async e=>{
  e.preventDefault();
  await addDoc(collection(db,"empresas",uid,"contatos"), { nome:$("contactName").value.trim(), cargo:$("contactRole").value.trim(), telefone:$("contactPhone").value.trim(), observacoes:$("contactNotes").value.trim(), createdAt:serverTimestamp(), updatedAt:serverTimestamp() });
  e.target.reset();
});
$("companyPlaceForm")?.addEventListener("submit", async e=>{
  e.preventDefault();
  await addDoc(collection(db,"empresas",uid,"locais"), { nome:$("placeName").value.trim(), endereco:$("placeAddress").value.trim(), cidade:$("placeCity").value.trim(), responsavel:$("placeResponsible").value.trim(), telefone:$("placePhone").value.trim(), observacoes:$("placeNotes").value.trim(), createdAt:serverTimestamp(), updatedAt:serverTimestamp() });
  e.target.reset();
});
function fillCompanyProfileForm(){
  const map = { profileCompanyName:profile.empresaNome||profile.nome||"", profileLegalName:profile.razaoSocial||"", profileCnpj:profile.cnpj||"", profileResponsible:profile.responsavel||"", profilePhone:profile.telefone||"", profileCity:profile.baseLocation||profile.cidade||"", profileCargoTypes:profile.tiposCarga||"", profileNotes:profile.observacoesOperacionais||"" };
  Object.entries(map).forEach(([id,val])=>{ if($(id)) $(id).value=val; });
}
$("companyProfileForm")?.addEventListener("submit", async e=>{
  e.preventDefault();
  const payload={ empresaNome:$("profileCompanyName").value.trim(), nome:$("profileCompanyName").value.trim(), razaoSocial:$("profileLegalName").value.trim(), cnpj:$("profileCnpj").value.trim(), responsavel:$("profileResponsible").value.trim(), telefone:$("profilePhone").value.trim(), baseLocation:$("profileCity").value.trim(), tiposCarga:$("profileCargoTypes").value.trim(), observacoesOperacionais:$("profileNotes").value.trim(), updatedAt:serverTimestamp() };
  await setDoc(doc(db,"empresas",uid), payload, {merge:true});
  await setDoc(doc(db,"usuarios",uid), payload, {merge:true});
  profile={...profile,...payload};
  showMessage($("companyProfileMessage"), "Dados da empresa atualizados.");
});

let companyChatUnsub = null;
function startCompanyChat(){
  if(!uid) return;
  const chatId = uid;
  const ref = doc(db,"conversas",chatId);
  setDoc(ref,{ empresaId:uid, empresaNome:profile.empresaNome||profile.nome||"Empresa", atualizadoEm:serverTimestamp(), ultimaMensagem:"Canal aberto" },{merge:true}).catch(console.warn);
  $("chatWhatsappCompany")?.setAttribute("href", whatsappUrl(MANAGER_PHONE, `Olá, sou da empresa ${profile.empresaNome||profile.nome}. Quero falar pelo FreteHub.`));
  companyChatUnsub?.();
  companyChatUnsub = onSnapshot(query(collection(db,"conversas",chatId,"mensagens"), orderBy("criadoEm","asc"), limit(80)), snap=>{
    const msgs=snap.docs.map(d=>({id:d.id,...d.data()}));
    const el=$("companyChatMessages"); if(!el) return;
    el.innerHTML = msgs.map(m=>`<div class="bubble ${m.autorTipo==="empresa"?"me":"other"}"><strong>${m.autorTipo==="empresa"?"Você":"Gestor FreteHub"}</strong>${safeText(m.texto)}<small>${formatDate(m.criadoEm)}</small></div>`).join("") || `<div class="empty">Envie a primeira mensagem para o gestor.</div>`;
    el.scrollTop=el.scrollHeight;
    const last=msgs[msgs.length-1]; if(last && $("companyChatPreview")) $("companyChatPreview").textContent=last.texto;
    updateDoc(ref,{naoLidasEmpresa:0}).catch(()=>{});
    if($("companyUnreadChats")) $("companyUnreadChats").textContent = "0";
  }, console.warn);
}
$("companyChatForm")?.addEventListener("submit", async e=>{
  e.preventDefault();
  const input=$("companyChatInput"); const text=(input?.value||"").trim(); if(!text) return;
  const chatId=uid;
  await addDoc(collection(db,"conversas",chatId,"mensagens"), { autorId:uid, autorTipo:"empresa", texto:text, criadoEm:serverTimestamp(), lida:false });
  await setDoc(doc(db,"conversas",chatId), { empresaId:uid, empresaNome:profile.empresaNome||profile.nome||"Empresa", ultimaMensagem:text, atualizadoEm:serverTimestamp(), naoLidasGestor:1 }, {merge:true});
  input.value="";
});
const oldListen = listen;
listen = function(){ oldListen(); setTimeout(()=>{ fillCompanyProfileForm(); listenCompanyExtras(); startCompanyChat(); }, 500); };
