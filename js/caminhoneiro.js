import {
  auth,
  db,
  onAuthStateChanged,
  signOut,
  collection,
  doc,
  addDoc,
  setDoc,
  getDoc,
  updateDoc,
  serverTimestamp,
  onSnapshot
} from "./firebase.js";
import { setupDashboardTabs, safeText, statusClass, statusLabel, mapsUrl, wazeUrl } from "./ui.js";

setupDashboardTabs("perfil");

const logoutBtn = document.getElementById("logoutBtn");
const logoutMobileBtn = document.getElementById("logoutMobileBtn");
const welcomeTitle = document.getElementById("welcomeTitle");
const myVehiclesCount = document.getElementById("myVehiclesCount");
const availableFreightsCount = document.getElementById("availableFreightsCount");
const myApplicationsCount = document.getElementById("myApplicationsCount");
const vehicleForm = document.getElementById("vehicleForm");
const vehicleMessage = document.getElementById("vehicleMessage");
const vehiclesList = document.getElementById("vehiclesList");
const availableFreightsList = document.getElementById("availableFreightsList");
const freightSearch = document.getElementById("freightSearch");
const myApplicationsList = document.getElementById("myApplicationsList");
const reviewForm = document.getElementById("reviewForm");
const reviewMessage = document.getElementById("reviewMessage");
const myReviewsList = document.getElementById("myReviewsList");

let currentUser = null;
let profile = null;
let myVehicles = [];
let freights = [];
let myApplications = [];
let watchIds = {};

async function logout() {
  Object.values(watchIds).forEach(id => navigator.geolocation?.clearWatch(id));
  await signOut(auth);
  window.location.href = "login.html";
}
logoutBtn?.addEventListener("click", logout);
logoutMobileBtn?.addEventListener("click", logout);

function showMessage(element, text, type = "success") {
  if (!element) return;
  element.textContent = text;
  element.className = `message ${type}`;
}

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "login.html";
    return;
  }

  const snap = await getDoc(doc(db, "usuarios", user.uid));
  profile = snap.data();
  const type = profile?.tipo || profile?.role;
  if (type !== "caminhoneiro") {
    window.location.href = "login.html";
    return;
  }

  currentUser = user;
  welcomeTitle.textContent = `Olá, ${profile.nome || profile.name || "caminhoneiro"}`;
  startRealtime();
});

function startRealtime() {
  onSnapshot(collection(db, "caminhoneiros", currentUser.uid, "veiculos"), snapshot => {
    myVehicles = snapshot.docs.map(item => ({ id: item.id, ...item.data() }));
    myVehiclesCount.textContent = myVehicles.length;
    renderVehicles();
    renderAvailableFreights();
  });

  onSnapshot(collection(db, "fretes"), snapshot => {
    freights = snapshot.docs.map(item => ({ id: item.id, ...item.data() })).filter(freight => freight.status === "aberto");
    availableFreightsCount.textContent = freights.length;
    renderAvailableFreights();
  });

  onSnapshot(collection(db, "caminhoneiros", currentUser.uid, "minhasCandidaturas"), snapshot => {
    myApplications = snapshot.docs.map(item => ({ id: item.id, ...item.data() }));
    myApplicationsCount.textContent = myApplications.length;
    renderMyApplications();
    renderAvailableFreights();
  });

  onSnapshot(collection(db, "avaliacoes"), snapshot => {
    const reviews = snapshot.docs.map(item => ({ id: item.id, ...item.data() })).filter(item => item.driverId === currentUser.uid);
    renderMyReviews(reviews);
  });
}

vehicleForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const vehicle = {
    plate: document.getElementById("plate").value.trim().toUpperCase(),
    model: document.getElementById("model").value.trim(),
    year: Number(document.getElementById("year").value),
    type: document.getElementById("type").value,
    capacity: Number(document.getElementById("capacity").value),
    status: "ativo",
    createdAt: serverTimestamp()
  };

  try {
    await addDoc(collection(db, "caminhoneiros", currentUser.uid, "veiculos"), vehicle);
    vehicleForm.reset();
    showMessage(vehicleMessage, "Veículo adicionado com sucesso.", "success");
  } catch (error) {
    showMessage(vehicleMessage, `Erro ao salvar veículo: ${error.message}`, "error");
  }
});

function renderVehicles() {
  if (!myVehicles.length) {
    vehiclesList.innerHTML = `<p class="empty">Cadastre seu primeiro veículo para se candidatar aos fretes.</p>`;
    return;
  }
  vehiclesList.innerHTML = myVehicles.map(vehicle => `
    <article class="item">
      <div class="item-header">
        <div>
          <h3>${safeText(vehicle.type)} ${safeText(vehicle.model)}</h3>
          <p>Placa ${safeText(vehicle.plate)} • ${safeText(vehicle.year)} • ${safeText(vehicle.capacity)} kg</p>
        </div>
        <span class="badge open">ativo</span>
      </div>
    </article>
  `).join("");
}

freightSearch?.addEventListener("input", renderAvailableFreights);

function renderAvailableFreights() {
  const search = freightSearch?.value?.toLowerCase().trim() || "";
  const appliedIds = new Set(myApplications.map(app => app.freightId || app.id));
  const visible = freights.filter(freight => {
    const text = `${freight.originText} ${freight.destinationText} ${freight.cargoType}`.toLowerCase();
    return !search || text.includes(search);
  });

  if (!visible.length) {
    availableFreightsList.innerHTML = `<p class="empty">Nenhum frete aberto encontrado.</p>`;
    return;
  }

  availableFreightsList.innerHTML = visible.map(freight => {
    const alreadyApplied = appliedIds.has(freight.id);
    return `
      <article class="item freight-card">
        <div class="item-header">
          <div>
            <h3>${safeText(freight.cargoType)} • ${safeText(freight.originText)} → ${safeText(freight.destinationText)}</h3>
            <p>${safeText(freight.vehicleType)} • ${safeText(freight.weight)} kg • R$ ${Number(freight.price || 0).toLocaleString("pt-BR")} • Prazo ${safeText(freight.deadline)}</p>
          </div>
          <span class="badge open">Aberto</span>
        </div>
        <p>${safeText(freight.description, "Sem descrição pública.")}</p>
        <div class="private-box locked"><strong>Endereço e contato:</strong><p>Disponível somente depois que o gestor liberar sua candidatura.</p></div>
        <div class="actions">
          ${alreadyApplied ? `<button disabled>Candidatura enviada</button>` : `<button onclick="candidatarFrete('${freight.id}')" ${myVehicles.length ? "" : "disabled"}>Candidatar-se</button>`}
        </div>
      </article>
    `;
  }).join("");
}

window.candidatarFrete = async (freightId) => {
  const freight = freights.find(item => item.id === freightId);
  if (!freight) return;
  if (!myVehicles.length) {
    alert("Cadastre ao menos um veículo antes de se candidatar.");
    return;
  }

  const vehicle = myVehicles[0];
  const payload = {
    freightId,
    driverId: currentUser.uid,
    driverName: profile.nome || profile.name || "Caminhoneiro",
    driverPhone: profile.telefone || profile.phone || "",
    driverEmail: profile.email || currentUser.email,
    vehicleId: vehicle.id,
    vehicleLabel: `${vehicle.type} ${vehicle.model} • ${vehicle.plate}`,
    originText: freight.originText,
    destinationText: freight.destinationText,
    cargoType: freight.cargoType,
    price: freight.price,
    deadline: freight.deadline,
    vehicleType: freight.vehicleType,
    status: "pendente",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };

  await setDoc(doc(db, "fretes", freightId, "candidaturas", currentUser.uid), payload);
  await setDoc(doc(db, "caminhoneiros", currentUser.uid, "minhasCandidaturas", freightId), payload);
};

function renderMyApplications() {
  if (!myApplications.length) {
    myApplicationsList.innerHTML = `<p class="empty">Você ainda não se candidatou a nenhum frete.</p>`;
    return;
  }

  myApplicationsList.innerHTML = myApplications
    .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
    .map(app => {
      const released = app.status === "liberado" || app.freightStatus === "em_andamento";
      return `
        <article class="item freight-card">
          <div class="item-header">
            <div>
              <h3>${safeText(app.cargoType)} • ${safeText(app.originText)} → ${safeText(app.destinationText)}</h3>
              <p>${safeText(app.vehicleLabel || app.vehicleType)} • R$ ${Number(app.price || 0).toLocaleString("pt-BR")} • Prazo ${safeText(app.deadline)}</p>
            </div>
            <span class="badge ${statusClass(app.status)}">${statusLabel(app.status)}</span>
          </div>
          ${released ? releasedDetails(app) : lockedDetails(app)}
        </article>
      `;
    }).join("");
}

function lockedDetails(app) {
  return `<div class="private-box locked"><strong>Aguardando liberação</strong><p>O endereço e o contato do local serão exibidos aqui depois da aprovação do gestor.</p></div>`;
}

function releasedDetails(app) {
  const address = app.pickupAddress || app.originText;
  const tracking = watchIds[app.freightId || app.id] ? `<button class="danger" onclick="pararRastreamento('${app.freightId || app.id}')">Parar localização</button>` : `<button class="success" onclick="iniciarRastreamento('${app.freightId || app.id}')">Enviar localização em tempo real</button>`;
  return `
    <div class="private-box">
      <strong>Dados liberados para carregamento</strong>
      <p><b>Endereço:</b> ${safeText(app.pickupAddress)}</p>
      <p><b>Contato:</b> ${safeText(app.pickupContactName)} • ${safeText(app.pickupContactPhone)}</p>
    </div>
    <div class="actions">
      <a class="button-link" target="_blank" href="${mapsUrl(address)}">Ir pelo Google Maps</a>
      <a class="button-link" target="_blank" href="${wazeUrl(address)}">Ir pelo Waze</a>
      ${tracking}
    </div>
  `;
}

window.iniciarRastreamento = (freightId) => {
  if (!navigator.geolocation) {
    alert("Seu navegador não suporta localização em tempo real.");
    return;
  }
  if (watchIds[freightId]) return;

  const app = myApplications.find(item => (item.freightId || item.id) === freightId);
  watchIds[freightId] = navigator.geolocation.watchPosition(async (position) => {
    const payload = {
      freightId,
      driverId: currentUser.uid,
      driverName: profile.nome || profile.name || "Caminhoneiro",
      originText: app?.originText || "",
      lat: position.coords.latitude,
      lng: position.coords.longitude,
      accuracy: position.coords.accuracy,
      active: true,
      updatedAt: serverTimestamp()
    };
    await setDoc(doc(db, "fretes", freightId, "rastreamento", currentUser.uid), payload, { merge: true });
    await setDoc(doc(db, "caminhoneiros", currentUser.uid, "minhasCandidaturas", freightId), { lastLocation: payload, updatedAt: serverTimestamp() }, { merge: true });
  }, (error) => {
    alert(`Não foi possível obter a localização: ${error.message}`);
  }, {
    enableHighAccuracy: true,
    maximumAge: 10000,
    timeout: 15000
  });
  renderMyApplications();
};

window.pararRastreamento = async (freightId) => {
  if (watchIds[freightId]) {
    navigator.geolocation.clearWatch(watchIds[freightId]);
    delete watchIds[freightId];
  }
  await setDoc(doc(db, "fretes", freightId, "rastreamento", currentUser.uid), { active: false, updatedAt: serverTimestamp() }, { merge: true });
  renderMyApplications();
};

reviewForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const payload = {
    driverId: currentUser.uid,
    nome: profile.nome || profile.name || "Caminhoneiro",
    nota: Number(document.getElementById("reviewRating").value),
    texto: document.getElementById("reviewText").value.trim(),
    publico: document.getElementById("reviewPublic").value === "true",
    createdAt: serverTimestamp()
  };

  try {
    await addDoc(collection(db, "avaliacoes"), payload);
    reviewForm.reset();
    showMessage(reviewMessage, "Avaliação enviada com sucesso.", "success");
  } catch (error) {
    showMessage(reviewMessage, `Erro ao enviar avaliação: ${error.message}`, "error");
  }
});

function renderMyReviews(reviews) {
  if (!reviews.length) {
    myReviewsList.innerHTML = `<p class="empty">Você ainda não enviou avaliações.</p>`;
    return;
  }

  myReviewsList.innerHTML = reviews.map(review => `
    <article class="item">
      <div class="item-header">
        <div><h3>${"★".repeat(Number(review.nota || 5))}</h3><p>${safeText(review.texto)}</p></div>
        <span class="badge ${review.publico ? "open" : "closed"}">${review.publico ? "pública" : "privada"}</span>
      </div>
    </article>
  `).join("");
}
