export function setupDashboardTabs(defaultTab = null) {
  const links = Array.from(document.querySelectorAll("[data-tab-target]"));
  const sections = Array.from(document.querySelectorAll("[data-tab-panel]"));
  const mobileTitle = document.getElementById("mobileSectionTitle");

  function activate(target) {
    sections.forEach(section => section.classList.toggle("active-panel", section.id === target));
    links.forEach(link => {
      const isActive = link.dataset.tabTarget === target;
      link.classList.toggle("active", isActive);
      if (isActive && mobileTitle) mobileTitle.textContent = link.textContent.trim();
    });
    history.replaceState(null, "", `#${target}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  links.forEach(link => link.addEventListener("click", event => {
    event.preventDefault();
    activate(link.dataset.tabTarget);
  }));

  const initial = location.hash?.replace("#", "") || defaultTab || sections[0]?.id;
  if (initial) activate(initial);
}

export function safeText(value, fallback = "Não informado") {
  return value === undefined || value === null || value === "" ? fallback : String(value);
}

export function statusLabel(status) {
  const labels = { aberto: "Aberto", pendente: "Pendente", liberado: "Liberado", recusado: "Recusado", em_andamento: "Em andamento", finalizado: "Finalizado" };
  return labels[status] || status || "Não informado";
}

export function statusClass(status) {
  if (["aberto", "liberado"].includes(status)) return "open";
  if (["pendente", "em_andamento"].includes(status)) return "progress";
  if (["recusado", "finalizado"].includes(status)) return "closed";
  return "open";
}

export function mapsUrl(endereco) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(endereco)}`;
}

export function wazeUrl(endereco) {
  return `https://waze.com/ul?q=${encodeURIComponent(endereco)}&navigate=yes`;
}

export function whatsappUrl(phone, text = "") {
  const digits = String(phone || "").replace(/\D/g, "");
  const withCountry = digits.startsWith("55") ? digits : `55${digits}`;
  return `https://wa.me/${withCountry}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}

export function requestLocationPermission(onSuccess = null) {
  if (!navigator.geolocation) return;
  navigator.geolocation.getCurrentPosition(
    position => { if (typeof onSuccess === "function") onSuccess(position); },
    error => console.info("Permissão de localização não concedida ou indisponível:", error.message),
    { enableHighAccuracy: true, maximumAge: 60000, timeout: 12000 }
  );
}
