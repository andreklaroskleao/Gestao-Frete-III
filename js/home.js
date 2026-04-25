import { db, doc, collection, query, where, orderBy, limit, onSnapshot } from "./firebase.js";
import { safeText, formatDateOnly, $ } from "./ui.js";

$("menuToggle")?.addEventListener("click", () => $("mainNav")?.classList.toggle("open"));

onSnapshot(doc(db, "publico", "resumo"), snap => {
  const data = snap.data() || {};
  $("homeFreights").textContent = data.fretesAtivos || 0;
  $("homeDrivers").textContent = data.caminhoneiros || 0;
  $("homeVehicles").textContent = data.veiculos || 0;
  $("liveStatus").textContent = "Online";
  $("liveStatus").classList.add("online");
}, () => { $("liveStatus").textContent = "Indisponível"; });

let allReviews = []; let shown = 6;
onSnapshot(query(collection(db, "avaliacoes"), where("publico", "==", true), orderBy("createdAt", "desc"), limit(30)), snap => {
  allReviews = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  renderReviews();
});
$("seeMoreReviews")?.addEventListener("click", () => { shown += 6; renderReviews(); });
function renderReviews() {
  const target = $("reviewsList"); if (!target) return;
  const items = allReviews.slice(0, shown);
  if (!items.length) { target.innerHTML = `<p class="empty wide-empty">As avaliações aparecerão aqui conforme forem publicadas.</p>`; return; }
  target.innerHTML = items.map(r => `<article class="review-card"><div class="stars">${"★".repeat(Number(r.nota || r.rating || 5))}</div><p>“${safeText(r.texto || r.reviewText || "Ótima experiência com a plataforma.")}”</p><strong>${safeText(r.driverName || r.nome || "Usuário FreteHub")}</strong><small>Avaliado em ${formatDateOnly(r.createdAt) || "data registrada"}</small></article>`).join("");
  $("seeMoreReviews").hidden = shown >= allReviews.length;
}
