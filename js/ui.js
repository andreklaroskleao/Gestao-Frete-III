export const MANAGER_PHONE = "53999932927";

export function $(id) { return document.getElementById(id); }
export function safeText(value, fallback = "") {
  const text = value === undefined || value === null || value === "" ? fallback : String(value);
  return text.replace(/[&<>'"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#039;", '"': "&quot;" }[c]));
}
export function onlyDigits(value = "") { return String(value).replace(/\D/g, ""); }
export function money(value) { return Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }); }
export function formatDate(value) {
  if (!value) return "";
  const date = value?.toDate ? value.toDate() : new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}
export function formatDateOnly(value) {
  if (!value) return "";
  const date = value?.toDate ? value.toDate() : new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString("pt-BR");
}
export function whatsappUrl(phone, text = "") {
  return `https://wa.me/55${onlyDigits(phone)}?text=${encodeURIComponent(text)}`;
}
export function mapsUrl(address) { return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address || "")}`; }
export function directionsUrl(destination) { return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination || "")}`; }
export function wazeUrl(destination) { return `https://waze.com/ul?q=${encodeURIComponent(destination || "")}&navigate=yes`; }
export function statusLabel(status) {
  const map = {
    aberto: "Disponível", pendente: "Pendente", liberado: "Liberado", recusado: "Recusado",
    em_andamento: "Em andamento", indo_coleta: "Indo para carga", chegou_coleta: "Chegou na coleta",
    carregado: "Carregado", em_viagem: "Em viagem", chegou_destino: "Chegou no destino",
    finalizado: "Finalizado", cancelado: "Cancelado", disponivel: "Disponível", ocupado: "Ocupado", indisponivel: "Indisponível",
    cobrada: "Cobrada", paga: "Paga", atrasada: "Atrasada", a_faturar: "A faturar", contratacao_confirmada: "Contratacao confirmada", validado: "Validado", vencida: "Vencida", comissao_pendente: "Comissao pendente"
  };
  return map[status] || status || "-";
}
export function statusClass(status) {
  if (["aberto", "disponivel", "paga"].includes(status)) return "open";
  if (["pendente", "a_faturar", "cobrada", "comissao_pendente", "vencida"].includes(status)) return "pending";
  if (["liberado", "em_andamento", "indo_coleta", "chegou_coleta", "carregado", "em_viagem", "chegou_destino"].includes(status)) return "progress";
  if (["finalizado"].includes(status)) return "done";
  return "closed";
}
export function setupDashboardTabs(defaultTab = "dashboard") {
  const links = [...document.querySelectorAll("[data-tab-target]")];
  const panels = [...document.querySelectorAll("[data-tab-panel]")];
  const title = $("mobileSectionTitle");
  function activate(id) {
    panels.forEach(panel => panel.classList.toggle("active-panel", panel.id === id));
    links.forEach(link => link.classList.toggle("active", link.dataset.tabTarget === id));
    const activeLink = links.find(link => link.dataset.tabTarget === id);
    if (title && activeLink) title.textContent = activeLink.textContent.trim();
    history.replaceState(null, "", `#${id}`);
  }
  links.forEach(link => link.addEventListener("click", (event) => { event.preventDefault(); activate(link.dataset.tabTarget); }));
  activate(location.hash?.replace("#", "") || defaultTab);
}
export function showMessage(element, text, type = "success") {
  if (!element) return;
  element.textContent = text;
  element.className = `message ${type}`;
}
export function openModal(content) {
  let overlay = $("globalModal");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "globalModal";
    overlay.className = "modal-overlay";
    overlay.innerHTML = `<div class="modal-card"></div>`;
    overlay.addEventListener("click", event => { if (event.target.id === "globalModal") closeModal(); });
    document.body.appendChild(overlay);
  }
  overlay.querySelector(".modal-card").innerHTML = content;
  overlay.classList.add("show");
}
export function closeModal() { $("globalModal")?.classList.remove("show"); }
window.fecharModal = closeModal;

export function requestLocationPermission(success, fail) {
  if (!navigator.geolocation) {
    fail?.("Seu navegador não oferece localização automática. Você ainda pode usar rotas e atualizações manuais.", "error");
    return;
  }
  navigator.geolocation.getCurrentPosition(
    pos => success?.(pos),
    error => {
      const text = error.code === 1
        ? "A localização foi bloqueada. Para rastreamento em tempo real, toque no cadeado do navegador e permita Localização para este site."
        : "Não foi possível obter a localização agora. Confira internet, GPS e permissão do navegador.";
      fail?.(text, "error");
    },
    { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 }
  );
}

export function buildFreightCode() {
  const now = new Date();
  const y = now.getFullYear();
  const n = Math.floor(100000 + Math.random() * 900000);
  return `FRT-${y}-${n}`;
}
export function textoLocal(item) { return `${item?.cidade || item?.nome || ""}${item?.uf ? " - " + item.uf : ""}`.trim(); }
