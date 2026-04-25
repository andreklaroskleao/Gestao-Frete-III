import {
  auth, db, onAuthStateChanged, signOut, collection, collectionGroup, doc,
  addDoc, getDoc, getDocs, setDoc, updateDoc, query, where, serverTimestamp, onSnapshot
} from "./firebase.js";
import { configurarSelectEstadoCidade, obterLocalidade } from "./ibge.js";
import { setupDashboardTabs, safeText, statusClass, statusLabel, mapsUrl, whatsappUrl, requestLocationPermission } from "./ui.js";

setupDashboardTabs("dashboard");
const MANAGER_PHONE = "53999932927";
const logoutBtn = document.getElementById("logoutBtn");
const logoutMobileBtn = document.getElementById("logoutMobileBtn");
const freightForm = document.getElementById("freightForm");
const formMessage = document.getElementById("formMessage");
const freightsList = document.getElementById("freightsList");
const driversList = document.getElementById("driversList");
const trackingList = document.getElementById("trackingList");
const statusFilter = document.getElementById("statusFilter");
const openFreights = document.getElementById("openFreights");
const applicationsCount = document.getElementById("applicationsCount");
const driversCount = document.getElementById("driversCount");
const vehiclesCount = document.getElementById("vehiclesCount");
let freights = [], driversCache = [], currentUser = null, unsubscribeApps = [];
let publicSummary = { fretesAtivos: 0, caminhoneiros: 0, veiculos: 0 };
let publishSummaryTimer = null;

configurarSelectEstadoCidade({ estadoId: "originState", cidadeId: "originCity", estadoPlaceholder: "Estado de origem", cidadePlaceholder: "Cidade de origem" });
configurarSelectEstadoCidade({ estadoId: "destinationState", cidadeId: "destinationCity", estadoPlaceholder: "Estado de destino", cidadePlaceholder: "Cidade de destino" });

async function logout() { await signOut(auth); window.location.href = "login.html"; }
logoutBtn?.addEventListener("click", logout);
logoutMobileBtn?.addEventListener("click", logout);
function showMessage(element, text, type = "success") { if (element) { element.textContent = text; element.className = `message ${type}`; } }
function handleSnapshotError(area, error) { console.error(`Erro ao carregar ${area}:`, error); if (error?.code === "permission-denied") alert(`Sem permissão para carregar ${area}. Publique as regras do Firestore incluídas no README.`); }
function publishPublicSummary() { clearTimeout(publishSummaryTimer); publishSummaryTimer = setTimeout(() => setDoc(doc(db, "publico", "resumo"), { ...publicSummary, updatedAt: serverTimestamp() }, { merge: true }).catch(error => console.warn("Não foi possível atualizar o resumo público.", error)), 500); }

onAuthStateChanged(auth, async (user) => {
  if (!user) return window.location.href = "login.html";
  const snap = await getDoc(doc(db, "usuarios", user.uid));
  const profile = snap.data();
  if ((profile?.tipo || profile?.role) !== "gestor") return window.location.href = "login.html";
  currentUser = user;
  requestLocationPermission();
  startRealtime();
});

async function attachPrivateDetails(items) {
  return Promise.all(items.map(async freight => {
    try {
      const privateSnap = await getDoc(doc(db, "fretes", freight.id, "privado", "detalhes"));
      const fallback = { pickupAddress: freight.pickupAddress, pickupContactName: freight.pickupContactName, pickupContactPhone: freight.pickupContactPhone, managerPhone: MANAGER_PHONE };
      return { ...freight, privado: privateSnap.data() || fallback };
    } catch { return freight; }
  }));
}

function startRealtime() {
  onSnapshot(collection(db, "fretes"), async snapshot => {
    freights = await attachPrivateDetails(snapshot.docs.map(item => ({ id: item.id, ...item.data(), applications: [] })));
    publicSummary.fretesAtivos = freights.filter(f => ["aberto", "em_andamento"].includes(f.status)).length;
    openFreights.textContent = freights.filter(f => f.status === "aberto").length;
    publishPublicSummary(); listenFreightApplications(); renderFreights();
  }, error => handleSnapshotError("fretes", error));

  onSnapshot(collection(db, "usuarios"), snapshot => {
    driversCache = snapshot.docs.map(item => ({ id: item.id, ...item.data() })).filter(user => [user.tipo, user.role].includes("caminhoneiro"));
    publicSummary.caminhoneiros = driversCache.length; driversCount.textContent = driversCache.length; publishPublicSummary(); renderDrivers(driversCache);
  }, error => handleSnapshotError("usuários", error));

  onSnapshot(collectionGroup(db, "veiculos"), snapshot => { publicSummary.veiculos = snapshot.size; vehiclesCount.textContent = snapshot.size; publishPublicSummary(); }, error => handleSnapshotError("veículos", error));
  onSnapshot(collectionGroup(db, "candidaturas"), snapshot => { applicationsCount.textContent = snapshot.docs.filter(item => item.data().status === "pendente").length; }, error => handleSnapshotError("candidaturas", error));
  onSnapshot(collectionGroup(db, "rastreamento"), snapshot => renderTracking(snapshot.docs.map(item => ({ id: item.id, ...item.data() }))), error => handleSnapshotError("rastreamento", error));
}

function listenFreightApplications() {
  unsubscribeApps.forEach(unsub => unsub()); unsubscribeApps = [];
  freights.forEach(freight => unsubscribeApps.push(onSnapshot(collection(db, "fretes", freight.id, "candidaturas"), snapshot => {
    const index = freights.findIndex(item => item.id === freight.id); if (index < 0) return;
    freights[index].applications = snapshot.docs.map(item => ({ id: item.id, ...item.data() })); renderFreights();
  }, error => handleSnapshotError("candidaturas do frete", error))));
}

freightForm?.addEventListener("submit", async (event) => {
  event.preventDefault(); showMessage(formMessage, "Publicando frete...", "success");
  const origem = obterLocalidade("originState", "originCity"); const destino = obterLocalidade("destinationState", "destinationCity");
  const privatePayload = { pickupAddress: document.getElementById("pickupAddress").value.trim(), pickupContactName: document.getElementById("pickupContactName").value.trim(), pickupContactPhone: document.getElementById("pickupContactPhone").value.trim(), managerPhone: MANAGER_PHONE, updatedAt: serverTimestamp() };
  const publicPayload = { origem, destino, originText: origem.texto, destinationText: destino.texto, cargoType: document.getElementById("cargoType").value.trim(), weight: Number(document.getElementById("weight").value), price: Number(document.getElementById("price").value), deadline: document.getElementById("deadline").value, vehicleType: document.getElementById("vehicleType").value, description: document.getElementById("description").value.trim(), managerPhone: MANAGER_PHONE, status: "aberto", createdBy: currentUser.uid, createdAt: serverTimestamp(), updatedAt: serverTimestamp() };
  try { const freightRef = await addDoc(collection(db, "fretes"), publicPayload); await setDoc(doc(db, "fretes", freightRef.id, "privado", "detalhes"), privatePayload, { merge: true }); freightForm.reset(); showMessage(formMessage, "Frete publicado com sucesso.", "success"); } catch (error) { showMessage(formMessage, `Erro ao publicar: ${error.message}`, "error"); }
});
statusFilter?.addEventListener("change", renderFreights);

function renderFreights() {
  const filter = statusFilter?.value || "todos"; const visible = filter === "todos" ? freights : freights.filter(f => f.status === filter);
  if (!visible.length) { freightsList.innerHTML = `<p class="empty">Nenhum frete encontrado para este filtro.</p>`; return; }
  freightsList.innerHTML = visible.map(freight => {
    const apps = freight.applications || []; const privateInfo = freight.privado || {};
    const privateBlock = freight.status !== "aberto" ? `<div class="private-box"><strong>Dados de carregamento</strong><p>${safeText(privateInfo.pickupAddress)} • ${safeText(privateInfo.pickupContactName)} • ${safeText(privateInfo.pickupContactPhone)}</p></div>` : "";
    return `<article class="item freight-card"><div class="item-header"><div><h3>${safeText(freight.cargoType)} • ${safeText(freight.originText)} → ${safeText(freight.destinationText)}</h3><p>${safeText(freight.vehicleType)} • ${safeText(freight.weight)} kg • R$ ${Number(freight.price || 0).toLocaleString("pt-BR")} • Prazo ${safeText(freight.deadline)}</p></div><span class="badge ${statusClass(freight.status)}">${statusLabel(freight.status)}</span></div><p>${safeText(freight.description, "Frete disponível para candidaturas.")}</p>${privateBlock}<div class="actions"><a class="button-link" target="_blank" href="${whatsappUrl(MANAGER_PHONE, `Olá, vim falar sobre o frete ${freight.cargoType || ""} ${freight.originText || ""} para ${freight.destinationText || ""}`)}">Chamar gestor no WhatsApp</a></div><div class="applications-box"><strong>Candidaturas (${apps.length})</strong>${apps.length ? apps.map(app => renderApplication(freight, app)).join("") : `<p class="muted">Ainda sem candidaturas.</p>`}</div></article>`;
  }).join("");
}

function renderApplication(freight, app) {
  const canApprove = app.status === "pendente" && freight.status === "aberto";
  return `<div class="application-row"><div><strong>${safeText(app.driverName || app.nome)}</strong><p>${safeText(app.driverPhone)} • veículo: ${safeText(app.vehicleLabel)}</p></div><span class="badge ${statusClass(app.status)}">${statusLabel(app.status)}</span><div class="actions">${app.driverPhone ? `<a class="button-link" target="_blank" href="${whatsappUrl(app.driverPhone, "Olá, vim falar sobre sua candidatura no FreteHub.")}">WhatsApp</a>` : ""}${canApprove ? `<button class="success" onclick="aprovarCandidatura('${freight.id}', '${app.driverId}')">Liberar</button><button class="danger" onclick="recusarCandidatura('${freight.id}', '${app.driverId}')">Recusar</button>` : ""}</div></div>`;
}

window.aprovarCandidatura = async (freightId, driverId) => {
  const freight = freights.find(item => item.id === freightId); const app = freight?.applications?.find(item => item.driverId === driverId || item.id === driverId); if (!freight || !app) return;
  const privateInfo = freight.privado || {};
  const approvedPayload = { status: "liberado", releasedAt: serverTimestamp(), pickupAddress: privateInfo.pickupAddress || "", pickupContactName: privateInfo.pickupContactName || "", pickupContactPhone: privateInfo.pickupContactPhone || "", managerPhone: MANAGER_PHONE, freightStatus: "em_andamento", updatedAt: serverTimestamp() };
  await updateDoc(doc(db, "fretes", freightId), { status: "em_andamento", driverId, driverName: app.driverName || app.nome || "Caminhoneiro", releasedAt: serverTimestamp(), updatedAt: serverTimestamp() });
  await updateDoc(doc(db, "fretes", freightId, "candidaturas", driverId), approvedPayload);
  await setDoc(doc(db, "caminhoneiros", driverId, "minhasCandidaturas", freightId), { ...app, ...approvedPayload, freightId, originText: freight.originText, destinationText: freight.destinationText, cargoType: freight.cargoType, price: freight.price, deadline: freight.deadline, vehicleType: freight.vehicleType }, { merge: true });
};
window.recusarCandidatura = async (freightId, driverId) => { await updateDoc(doc(db, "fretes", freightId, "candidaturas", driverId), { status: "recusado", updatedAt: serverTimestamp() }); await setDoc(doc(db, "caminhoneiros", driverId, "minhasCandidaturas", freightId), { status: "recusado", updatedAt: serverTimestamp() }, { merge: true }); };

async function renderDrivers(drivers) {
  if (!drivers.length) { driversList.innerHTML = `<p class="empty">Nenhum caminhoneiro cadastrado.</p>`; return; }
  const cards = [];
  for (const driver of drivers) {
    const vehiclesSnap = await getDocs(collection(db, "caminhoneiros", driver.id, "veiculos")); const vehicles = vehiclesSnap.docs.map(item => ({ id: item.id, ...item.data() }));
    cards.push(`<article class="item clickable" role="button" tabindex="0" onclick="abrirCaminhoneiro('${driver.id}')" onkeydown="if(event.key==='Enter'){abrirCaminhoneiro('${driver.id}')}"><div class="item-header"><div><h3>${safeText(driver.nome || driver.name)}</h3><p>${safeText(driver.email)} • ${safeText(driver.telefone || driver.phone)} • Base ${safeText(driver.baseLocation || driver.cidade)}</p></div><span class="badge open">${vehicles.length} veículo(s)</span></div><div class="mini-list">${vehicles.map(v => `<span>${safeText(v.type)} ${safeText(v.model)} • ${safeText(v.plate)}</span>`).join("") || "<span>Sem veículos cadastrados.</span>"}</div></article>`);
  }
  driversList.innerHTML = cards.join("");
}

window.abrirCaminhoneiro = async (driverId) => {
  const driver = driversCache.find(item => item.id === driverId); if (!driver) return;
  const [vehiclesSnap, appsSnap, reviewsSnap] = await Promise.all([getDocs(collection(db, "caminhoneiros", driverId, "veiculos")), getDocs(collection(db, "caminhoneiros", driverId, "minhasCandidaturas")), getDocs(query(collection(db, "avaliacoes"), where("driverId", "==", driverId)))]);
  const vehicles = vehiclesSnap.docs.map(item => ({ id: item.id, ...item.data() })); const apps = appsSnap.docs.map(item => ({ id: item.id, ...item.data() })); const reviews = reviewsSnap.docs.map(item => ({ id: item.id, ...item.data() }));
  const phone = driver.telefone || driver.phone || ""; const avgRating = reviews.length ? (reviews.reduce((sum, review) => sum + Number(review.nota || 0), 0) / reviews.length).toFixed(1) : "Sem avaliações";
  openModal(`<div class="modal-header"><div><p class="eyebrow">Caminhoneiro</p><h2>${safeText(driver.nome || driver.name)}</h2></div><button class="modal-close" onclick="fecharModal()">×</button></div><div class="modal-grid"><article><span>E-mail</span><strong>${safeText(driver.email)}</strong></article><article><span>Telefone</span><strong>${safeText(phone)}</strong></article><article><span>Base</span><strong>${safeText(driver.baseLocation || `${driver.cidade || ""} ${driver.uf || ""}`)}</strong></article><article><span>Avaliação</span><strong>${avgRating}</strong></article><article><span>Documento</span><strong>${safeText(driver.document)}</strong></article><article><span>CNH</span><strong>${safeText(driver.cnh)}</strong></article><article><span>Status</span><strong>${safeText(driver.status, "ativo")}</strong></article><article><span>Candidaturas</span><strong>${apps.length}</strong></article></div><div class="actions modal-actions">${phone ? `<a class="button-link" target="_blank" href="${whatsappUrl(phone, "Olá, vim falar sobre oportunidades de frete pelo FreteHub.")}">Chamar no WhatsApp</a>` : ""}<a class="button-link secondary-link" href="mailto:${safeText(driver.email, "")}">Enviar e-mail</a></div><h3>Veículos cadastrados</h3><div class="modal-list">${vehicles.length ? vehicles.map(v => `<div><strong>${safeText(v.type)} ${safeText(v.model)}</strong><p>Placa ${safeText(v.plate)} • Ano ${safeText(v.year)} • Capacidade ${safeText(v.capacity)} kg</p></div>`).join("") : `<p class="empty">Nenhum veículo cadastrado.</p>`}</div><h3>Fretes e candidaturas</h3><div class="modal-list">${apps.length ? apps.map(app => `<div><strong>${safeText(app.cargoType)} • ${safeText(app.originText)} → ${safeText(app.destinationText)}</strong><p>Status: ${statusLabel(app.status)} • ${safeText(app.vehicleLabel)}</p></div>`).join("") : `<p class="empty">Nenhuma candidatura registrada.</p>`}</div>`);
};
function openModal(content) { let overlay = document.getElementById("driverModal"); if (!overlay) { overlay = document.createElement("div"); overlay.id = "driverModal"; overlay.className = "modal-overlay"; overlay.innerHTML = `<div class="modal-card"></div>`; overlay.addEventListener("click", event => { if (event.target.id === "driverModal") fecharModal(); }); document.body.appendChild(overlay); } overlay.querySelector(".modal-card").innerHTML = content; overlay.classList.add("show"); }
window.fecharModal = () => document.getElementById("driverModal")?.classList.remove("show");

function renderTracking(tracks) {
  const active = tracks.filter(track => track.active !== false).sort((a, b) => (b.updatedAt?.seconds || 0) - (a.updatedAt?.seconds || 0));
  if (!active.length) { trackingList.innerHTML = `<p class="empty">Nenhum caminhoneiro enviando localização agora.</p>`; return; }
  trackingList.innerHTML = active.map(track => { const address = `${track.lat},${track.lng}`; const when = track.updatedAt?.toDate ? track.updatedAt.toDate().toLocaleString("pt-BR") : "agora"; return `<article class="item"><div class="item-header"><div><h3>${safeText(track.driverName)} indo para ${safeText(track.originText || "a carga")}</h3><p>Última posição: ${Number(track.lat).toFixed(5)}, ${Number(track.lng).toFixed(5)} • ${when}</p></div><span class="badge progress">ao vivo</span></div><div class="actions"><a class="button-link" target="_blank" href="${mapsUrl(address)}">Abrir no mapa</a></div></article>`; }).join("");
}
