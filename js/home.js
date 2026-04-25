import { db, collection, doc, onSnapshot, query, where } from "./firebase.js";

const liveStatus = document.getElementById("liveStatus");
const homeActiveFreights = document.getElementById("homeActiveFreights");
const homeDrivers = document.getElementById("homeDrivers");
const homeVehicles = document.getElementById("homeVehicles");
const reviewsList = document.getElementById("reviewsList");
const menuToggle = document.getElementById("menuToggle");
const homeNav = document.getElementById("homeNav");

menuToggle?.addEventListener("click", () => homeNav.classList.toggle("open"));

function setLive(ok = true) {
  if (!liveStatus) return;
  liveStatus.textContent = ok ? "Ao vivo" : "Atualizando";
  liveStatus.className = ok ? "live-pill online" : "live-pill";
}

function setStat(element, value) {
  if (!element) return;
  element.textContent = Number.isFinite(Number(value)) ? Number(value) : "0";
}

onSnapshot(doc(db, "publico", "resumo"), snapshot => {
  const data = snapshot.data() || {};
  setStat(homeActiveFreights, data.fretesAtivos);
  setStat(homeDrivers, data.caminhoneiros);
  setStat(homeVehicles, data.veiculos);
  setLive(true);
}, error => {
  console.warn("Não foi possível carregar o resumo público.", error);
  setLive(false);
});

const publicReviewsQuery = query(collection(db, "avaliacoes"), where("publico", "==", true));
onSnapshot(publicReviewsQuery, snapshot => {
  const reviews = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)).slice(0, 6);
  if (!reviews.length) {
    reviewsList.innerHTML = `<p class="empty wide-empty">As avaliações dos caminhoneiros aparecem aqui.</p>`;
    return;
  }
  reviewsList.innerHTML = reviews.map(review => {
    const rating = Math.max(1, Math.min(5, Number(review.nota || review.rating || 5)));
    return `<article class="review-card"><div class="stars">${"★".repeat(rating)}${"☆".repeat(5 - rating)}</div><p>“${review.texto || review.review || "Excelente experiência."}”</p><strong>${review.nome || review.driverName || "Caminhoneiro"}</strong></article>`;
  }).join("");
}, error => {
  console.warn("Não foi possível carregar avaliações.", error);
  reviewsList.innerHTML = `<p class="empty wide-empty">Avaliações em atualização.</p>`;
});
