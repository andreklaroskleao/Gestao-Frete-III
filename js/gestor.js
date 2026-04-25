import {
  auth,
  db,
  onAuthStateChanged,
  signOut,
  collection,
  collectionGroup,
  doc,
  addDoc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  serverTimestamp,
  onSnapshot
} from "./firebase.js";
import { configurarSelectEstadoCidade, obterLocalidade } from "./ibge.js";
import { setupDashboardTabs, safeText, statusClass, statusLabel, mapsUrl } from "./ui.js";

setupDashboardTabs("dashboard");

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

let freights = [];
let currentUser = null;
let unsubscribeApps = [];

configurarSelectEstadoCidade({ estadoId: "originState", cidadeId: "originCity", estadoPlaceholder: "Estado de origem", cidadePlaceholder: "Cidade de origem" });
configurarSelectEstadoCidade({ estadoId: "destinationState", cidadeId: "destinationCity", estadoPlaceholder: "Estado de destino", cidadePlaceholder: "Cidade de destino" });

async function logout() {
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
  const profile = snap.data();
  const type = profile?.tipo || profile?.role;
  if (type !== "gestor") {
    window.location.href = "login.html";
    return;
  }

  currentUser = user;
  startRealtime();
});

function startRealtime() {
  onSnapshot(collection(db, "fretes"), snapshot => {
    freights = snapshot.docs.map(item => ({ id: item.id, ...item.data(), applications: [] }));
    openFreights.textContent = freights.filter(f => f.status === "aberto").length;
    listenFreightApplications();
    renderFreights();
  });

  onSnapshot(collection(db, "usuarios"), snapshot => {
    const drivers = snapshot.docs
      .map(item => ({ id: item.id, ...item.data() }))
      .filter(user => [user.tipo, user.role].includes("caminhoneiro"));
    driversCount.textContent = drivers.length;
    renderDrivers(drivers);
  });

  onSnapshot(collectionGroup(db, "veiculos"), snapshot => {
    vehiclesCount.textContent = snapshot.size;
  });

  onSnapshot(collectionGroup(db, "candidaturas"), snapshot => {
    const pending = snapshot.docs.filter(item => item.data().status === "pendente").length;
    applicationsCount.textContent = pending;
  });

  onSnapshot(collectionGroup(db, "rastreamento"), snapshot => {
    const tracks = snapshot.docs.map(item => ({ id: item.id, ...item.data() }));
    renderTracking(tracks);
  });
}

function listenFreightApplications() {
  unsubscribeApps.forEach(unsub => unsub());
  unsubscribeApps = [];

  freights.forEach(freight => {
    const unsub = onSnapshot(collection(db, "fretes", freight.id, "candidaturas"), snapshot => {
      const index = freights.findIndex(item => item.id === freight.id);
      if (index < 0) return;
      freights[index].applications = snapshot.docs.map(item => ({ id: item.id, ...item.data() }));
      renderFreights();
    });
    unsubscribeApps.push(unsub);
  });
}

freightForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  showMessage(formMessage, "Publicando frete...", "success");

  const origem = obterLocalidade("originState", "originCity");
  const destino = obterLocalidade("destinationState", "destinationCity");

  const payload = {
    origem,
    destino,
    originText: origem.texto,
    destinationText: destino.texto,
    cargoType: document.getElementById("cargoType").value.trim(),
    weight: Number(document.getElementById("weight").value),
    price: Number(document.getElementById("price").value),
    deadline: document.getElementById("deadline").value,
    vehicleType: document.getElementById("vehicleType").value,
    description: document.getElementById("description").value.trim(),
    pickupAddress: document.getElementById("pickupAddress").value.trim(),
    pickupContactName: document.getElementById("pickupContactName").value.trim(),
    pickupContactPhone: document.getElementById("pickupContactPhone").value.trim(),
    status: "aberto",
    createdBy: currentUser.uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };

  try {
    await addDoc(collection(db, "fretes"), payload);
    freightForm.reset();
    showMessage(formMessage, "Frete publicado com sucesso.", "success");
  } catch (error) {
    showMessage(formMessage, `Erro ao publicar: ${error.message}`, "error");
  }
});

statusFilter?.addEventListener("change", renderFreights);

function renderFreights() {
  const filter = statusFilter?.value || "todos";
  const visible = filter === "todos" ? freights : freights.filter(f => f.status === filter);

  if (!visible.length) {
    freightsList.innerHTML = `<p class="empty">Nenhum frete encontrado para este filtro.</p>`;
    return;
  }

  freightsList.innerHTML = visible.map(freight => {
    const apps = freight.applications || [];
    const privateBlock = freight.status !== "aberto" ? `
      <div class="private-box">
        <strong>Dados privados liberados:</strong>
        <p>${safeText(freight.pickupAddress)} • ${safeText(freight.pickupContactName)} • ${safeText(freight.pickupContactPhone)}</p>
      </div>` : "";

    return `
      <article class="item freight-card">
        <div class="item-header">
          <div>
            <h3>${safeText(freight.cargoType)} • ${safeText(freight.originText)} → ${safeText(freight.destinationText)}</h3>
            <p>${safeText(freight.vehicleType)} • ${safeText(freight.weight)} kg • R$ ${Number(freight.price || 0).toLocaleString("pt-BR")} • Prazo ${safeText(freight.deadline)}</p>
          </div>
          <span class="badge ${statusClass(freight.status)}">${statusLabel(freight.status)}</span>
        </div>
        <p>${safeText(freight.description, "Sem descrição pública.")}</p>
        ${privateBlock}
        <div class="applications-box">
          <strong>Candidaturas (${apps.length})</strong>
          ${apps.length ? apps.map(app => renderApplication(freight, app)).join("") : `<p class="muted">Ainda sem candidaturas.</p>`}
        </div>
      </article>
    `;
  }).join("");
}

function renderApplication(freight, app) {
  const canApprove = app.status === "pendente" && freight.status === "aberto";
  return `
    <div class="application-row">
      <div>
        <strong>${safeText(app.driverName || app.nome)}</strong>
        <p>${safeText(app.driverPhone)} • veículo: ${safeText(app.vehicleLabel)}</p>
      </div>
      <span class="badge ${statusClass(app.status)}">${statusLabel(app.status)}</span>
      <div class="actions">
        ${canApprove ? `<button class="success" onclick="aprovarCandidatura('${freight.id}', '${app.driverId}')">Liberar</button><button class="danger" onclick="recusarCandidatura('${freight.id}', '${app.driverId}')">Recusar</button>` : ""}
      </div>
    </div>`;
}

window.aprovarCandidatura = async (freightId, driverId) => {
  const freight = freights.find(item => item.id === freightId);
  const app = freight?.applications?.find(item => item.driverId === driverId || item.id === driverId);
  if (!freight || !app) return;

  const approvedPayload = {
    status: "liberado",
    releasedAt: serverTimestamp(),
    pickupAddress: freight.pickupAddress,
    pickupContactName: freight.pickupContactName,
    pickupContactPhone: freight.pickupContactPhone,
    freightStatus: "em_andamento"
  };

  await updateDoc(doc(db, "fretes", freightId), {
    status: "em_andamento",
    driverId,
    driverName: app.driverName || app.nome || "Caminhoneiro",
    releasedAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  await updateDoc(doc(db, "fretes", freightId, "candidaturas", driverId), approvedPayload);
  await setDoc(doc(db, "caminhoneiros", driverId, "minhasCandidaturas", freightId), {
    ...app,
    ...approvedPayload,
    freightId,
    originText: freight.originText,
    destinationText: freight.destinationText,
    cargoType: freight.cargoType,
    price: freight.price,
    deadline: freight.deadline,
    vehicleType: freight.vehicleType
  }, { merge: true });
};

window.recusarCandidatura = async (freightId, driverId) => {
  await updateDoc(doc(db, "fretes", freightId, "candidaturas", driverId), { status: "recusado", updatedAt: serverTimestamp() });
  await setDoc(doc(db, "caminhoneiros", driverId, "minhasCandidaturas", freightId), { status: "recusado", updatedAt: serverTimestamp() }, { merge: true });
};

async function renderDrivers(drivers) {
  if (!drivers.length) {
    driversList.innerHTML = `<p class="empty">Nenhum caminhoneiro cadastrado.</p>`;
    return;
  }

  const cards = [];
  for (const driver of drivers) {
    const vehiclesSnap = await getDocs(collection(db, "caminhoneiros", driver.id, "veiculos"));
    const vehicles = vehiclesSnap.docs.map(item => item.data());
    cards.push(`
      <article class="item">
        <div class="item-header">
          <div>
            <h3>${safeText(driver.nome || driver.name)}</h3>
            <p>${safeText(driver.email)} • ${safeText(driver.telefone || driver.phone)} • Base ${safeText(driver.baseLocation || driver.cidade)}</p>
          </div>
          <span class="badge open">${vehicles.length} veículo(s)</span>
        </div>
        <div class="mini-list">${vehicles.map(v => `<span>${safeText(v.type)} ${safeText(v.model)} • ${safeText(v.plate)}</span>`).join("") || "<span>Sem veículos cadastrados.</span>"}</div>
      </article>
    `);
  }
  driversList.innerHTML = cards.join("");
}

function renderTracking(tracks) {
  const active = tracks.filter(track => track.active !== false).sort((a, b) => (b.updatedAt?.seconds || 0) - (a.updatedAt?.seconds || 0));
  if (!active.length) {
    trackingList.innerHTML = `<p class="empty">Nenhum caminhoneiro enviando localização agora.</p>`;
    return;
  }

  trackingList.innerHTML = active.map(track => {
    const address = `${track.lat},${track.lng}`;
    const when = track.updatedAt?.toDate ? track.updatedAt.toDate().toLocaleString("pt-BR") : "agora";
    return `
      <article class="item">
        <div class="item-header">
          <div>
            <h3>${safeText(track.driverName)} indo para ${safeText(track.originText || "a carga")}</h3>
            <p>Última posição: ${Number(track.lat).toFixed(5)}, ${Number(track.lng).toFixed(5)} • ${when}</p>
          </div>
          <span class="badge progress">ao vivo</span>
        </div>
        <div class="actions"><a class="button-link" target="_blank" href="${mapsUrl(address)}">Abrir no mapa</a></div>
      </article>`;
  }).join("");
}
