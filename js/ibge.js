const IBGE_BASE_URL = "https://servicodados.ibge.gov.br/api/v1/localidades";
const FETCH_TIMEOUT_MS = 8000;

const estadosCache = { data: null };
const municipiosCache = new Map();

const ESTADOS_FALLBACK = [
  { sigla: "AC", nome: "Acre" }, { sigla: "AL", nome: "Alagoas" }, { sigla: "AP", nome: "Amapá" },
  { sigla: "AM", nome: "Amazonas" }, { sigla: "BA", nome: "Bahia" }, { sigla: "CE", nome: "Ceará" },
  { sigla: "DF", nome: "Distrito Federal" }, { sigla: "ES", nome: "Espírito Santo" }, { sigla: "GO", nome: "Goiás" },
  { sigla: "MA", nome: "Maranhão" }, { sigla: "MT", nome: "Mato Grosso" }, { sigla: "MS", nome: "Mato Grosso do Sul" },
  { sigla: "MG", nome: "Minas Gerais" }, { sigla: "PA", nome: "Pará" }, { sigla: "PB", nome: "Paraíba" },
  { sigla: "PR", nome: "Paraná" }, { sigla: "PE", nome: "Pernambuco" }, { sigla: "PI", nome: "Piauí" },
  { sigla: "RJ", nome: "Rio de Janeiro" }, { sigla: "RN", nome: "Rio Grande do Norte" }, { sigla: "RS", nome: "Rio Grande do Sul" },
  { sigla: "RO", nome: "Rondônia" }, { sigla: "RR", nome: "Roraima" }, { sigla: "SC", nome: "Santa Catarina" },
  { sigla: "SP", nome: "São Paulo" }, { sigla: "SE", nome: "Sergipe" }, { sigla: "TO", nome: "Tocantins" }
];

async function fetchJson(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error("Não foi possível carregar dados do IBGE.");
    return response.json();
  } finally {
    clearTimeout(timeout);
  }
}

function option(value, text, extra = {}) {
  const item = document.createElement("option");
  item.value = value;
  item.textContent = text;
  Object.entries(extra).forEach(([key, value]) => {
    item.dataset[key] = value;
  });
  return item;
}

function ensureManualCityInput(cidadeSelect) {
  const manualId = `${cidadeSelect.id}Manual`;
  let input = document.getElementById(manualId);

  if (!input) {
    input = document.createElement("input");
    input.id = manualId;
    input.name = manualId;
    input.type = "text";
    input.placeholder = "Digite a cidade manualmente";
    input.className = cidadeSelect.className || "";
    input.style.display = "none";
    cidadeSelect.insertAdjacentElement("afterend", input);
  }

  return input;
}

function setManualMode(cidadeSelect, enabled) {
  const input = ensureManualCityInput(cidadeSelect);
  input.style.display = enabled ? "block" : "none";
  input.required = enabled && cidadeSelect.required;
  cidadeSelect.style.display = enabled ? "none" : "block";
  cidadeSelect.disabled = enabled;
  if (!enabled) input.value = "";
}

export async function buscarEstados() {
  if (!estadosCache.data) {
    try {
      estadosCache.data = await fetchJson(`${IBGE_BASE_URL}/estados?orderBy=nome`);
    } catch (error) {
      console.warn("IBGE indisponível. Usando lista local de estados.", error);
      estadosCache.data = ESTADOS_FALLBACK;
    }
  }
  return estadosCache.data;
}

export async function buscarMunicipios(uf) {
  if (!uf) return [];
  if (!municipiosCache.has(uf)) {
    const municipios = await fetchJson(`${IBGE_BASE_URL}/estados/${uf}/municipios?orderBy=nome`);
    municipiosCache.set(uf, municipios);
  }
  return municipiosCache.get(uf);
}

export async function configurarSelectEstadoCidade({
  estadoId,
  cidadeId,
  estadoPlaceholder = "Selecione o estado",
  cidadePlaceholder = "Selecione a cidade"
}) {
  const estadoSelect = document.getElementById(estadoId);
  const cidadeSelect = document.getElementById(cidadeId);

  if (!estadoSelect || !cidadeSelect) return;

  ensureManualCityInput(cidadeSelect);
  setManualMode(cidadeSelect, false);

  estadoSelect.innerHTML = "";
  cidadeSelect.innerHTML = "";
  estadoSelect.appendChild(option("", estadoPlaceholder));
  cidadeSelect.appendChild(option("", cidadePlaceholder));
  cidadeSelect.disabled = true;

  const estados = await buscarEstados();
  estados.forEach(estado => {
    estadoSelect.appendChild(option(estado.sigla, `${estado.nome} (${estado.sigla})`, { nome: estado.nome }));
  });

  estadoSelect.addEventListener("change", async () => {
    const uf = estadoSelect.value;
    setManualMode(cidadeSelect, false);
    cidadeSelect.innerHTML = "";
    cidadeSelect.appendChild(option("", uf ? "Carregando cidades..." : cidadePlaceholder));
    cidadeSelect.disabled = true;

    if (!uf) {
      cidadeSelect.innerHTML = "";
      cidadeSelect.appendChild(option("", cidadePlaceholder));
      return;
    }

    try {
      const municipios = await buscarMunicipios(uf);
      cidadeSelect.innerHTML = "";
      cidadeSelect.appendChild(option("", cidadePlaceholder));
      municipios.forEach(municipio => {
        cidadeSelect.appendChild(option(municipio.nome, municipio.nome));
      });
      cidadeSelect.disabled = false;
    } catch (error) {
      console.warn("IBGE indisponível para municípios. Liberando digitação manual da cidade.", error);
      cidadeSelect.innerHTML = "";
      cidadeSelect.appendChild(option("", "Cidade manual"));
      setManualMode(cidadeSelect, true);
    }
  });
}

export function obterLocalidade(estadoId, cidadeId) {
  const estadoSelect = document.getElementById(estadoId);
  const cidadeSelect = document.getElementById(cidadeId);
  const cidadeManual = document.getElementById(`${cidadeId}Manual`);
  const estadoOption = estadoSelect?.selectedOptions?.[0];

  const uf = estadoSelect?.value || "";
  const estadoNome = estadoOption?.dataset?.nome || estadoOption?.textContent?.replace(` (${uf})`, "") || "";
  const cidade = cidadeManual?.style.display !== "none" ? cidadeManual.value.trim() : (cidadeSelect?.value || "");

  return {
    uf,
    estado: estadoNome,
    cidade,
    texto: cidade && uf ? `${cidade} - ${uf}` : ""
  };
}
