import {
  db,
  collection,
  collectionGroup,
  onSnapshot
} from "./firebase.js";

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
  liveStatus.textContent = ok ? "Ao vivo" : "Offline";
  liveStatus.className = ok ? "live-pill online" : "live-pill";
}

onSnapshot(collection(db, "fretes"), snapshot => {
  const active = snapshot.docs.filter(doc => ["aberto", "em_andamento"].includes(doc.data().status)).length;
  homeActiveFreights.textContent = active;
  setLive(true);
}, () => setLive(false));

onSnapshot(collection(db, "usuarios"), snapshot => {
  const drivers = snapshot.docs.filter(doc => [doc.data().tipo, doc.data().role].includes("caminhoneiro")).length;
  homeDrivers.textContent = drivers;
  setLive(true);
}, () => setLive(false));

onSnapshot(collectionGroup(db, "veiculos"), snapshot => {
  homeVehicles.textContent = snapshot.size;
  setLive(true);
}, () => setLive(false));

onSnapshot(collection(db, "avaliacoes"), snapshot => {
  const reviews = snapshot.docs
    .map(doc => ({ id: doc.id, ...doc.data() }))
    .filter(review => review.publico !== false)
    .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
    .slice(0, 6);

  if (!reviews.length) {
    reviewsList.innerHTML = `<p class="empty wide-empty">Ainda não há avaliações públicas. Elas aparecerão aqui em tempo real.</p>`;
    return;
  }

  reviewsList.innerHTML = reviews.map(review => {
    const rating = Number(review.nota || review.rating || 5);
    return `
      <article class="review-card">
        <div class="stars">${"★".repeat(rating)}${"☆".repeat(5 - rating)}</div>
        <p>“${review.texto || review.review || "Avaliação sem comentário."}”</p>
        <strong>${review.nome || review.driverName || "Caminhoneiro"}</strong>
      </article>
    `;
  }).join("");
}, () => {
  reviewsList.innerHTML = `<p class="empty wide-empty">Não foi possível carregar avaliações agora.</p>`;
});
