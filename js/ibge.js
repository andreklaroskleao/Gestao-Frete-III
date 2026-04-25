const IBGE_BASE_URL = "https://servicodados.ibge.gov.br/api/v1/localidades";

const estadosCache = { data: null };
const municipiosCache = new Map();

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("Não foi possível carregar dados do IBGE.");
  }
  return response.json();
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

export async function buscarEstados() {
  if (!estadosCache.data) {
    estadosCache.data = await fetchJson(`${IBGE_BASE_URL}/estados?orderBy=nome`);
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

  estadoSelect.innerHTML = "";
  cidadeSelect.innerHTML = "";
  estadoSelect.appendChild(option("", estadoPlaceholder));
  cidadeSelect.appendChild(option("", cidadePlaceholder));
  cidadeSelect.disabled = true;

  try {
    const estados = await buscarEstados();
    estados.forEach(estado => {
      estadoSelect.appendChild(option(estado.sigla, `${estado.nome} (${estado.sigla})`, { nome: estado.nome }));
    });
  } catch (error) {
    estadoSelect.innerHTML = "";
    estadoSelect.appendChild(option("", "Erro ao carregar estados"));
    cidadeSelect.innerHTML = "";
    cidadeSelect.appendChild(option("", "Erro ao carregar cidades"));
    console.error(error);
  }

  estadoSelect.addEventListener("change", async () => {
    const uf = estadoSelect.value;
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
      cidadeSelect.innerHTML = "";
      cidadeSelect.appendChild(option("", "Erro ao carregar cidades"));
      console.error(error);
    }
  });
}

export function obterLocalidade(estadoId, cidadeId) {
  const estadoSelect = document.getElementById(estadoId);
  const cidadeSelect = document.getElementById(cidadeId);
  const estadoOption = estadoSelect?.selectedOptions?.[0];

  const uf = estadoSelect?.value || "";
  const estadoNome = estadoOption?.dataset?.nome || estadoOption?.textContent?.replace(` (${uf})`, "") || "";
  const cidade = cidadeSelect?.value || "";

  return {
    uf,
    estado: estadoNome,
    cidade,
    texto: cidade && uf ? `${cidade} - ${uf}` : ""
  };
}
