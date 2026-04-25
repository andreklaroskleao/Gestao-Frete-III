const ESTADOS = [
  { sigla: "AC", nome: "Acre" }, { sigla: "AL", nome: "Alagoas" }, { sigla: "AP", nome: "Amapá" }, { sigla: "AM", nome: "Amazonas" },
  { sigla: "BA", nome: "Bahia" }, { sigla: "CE", nome: "Ceará" }, { sigla: "DF", nome: "Distrito Federal" }, { sigla: "ES", nome: "Espírito Santo" },
  { sigla: "GO", nome: "Goiás" }, { sigla: "MA", nome: "Maranhão" }, { sigla: "MT", nome: "Mato Grosso" }, { sigla: "MS", nome: "Mato Grosso do Sul" },
  { sigla: "MG", nome: "Minas Gerais" }, { sigla: "PA", nome: "Pará" }, { sigla: "PB", nome: "Paraíba" }, { sigla: "PR", nome: "Paraná" },
  { sigla: "PE", nome: "Pernambuco" }, { sigla: "PI", nome: "Piauí" }, { sigla: "RJ", nome: "Rio de Janeiro" }, { sigla: "RN", nome: "Rio Grande do Norte" },
  { sigla: "RS", nome: "Rio Grande do Sul" }, { sigla: "RO", nome: "Rondônia" }, { sigla: "RR", nome: "Roraima" }, { sigla: "SC", nome: "Santa Catarina" },
  { sigla: "SP", nome: "São Paulo" }, { sigla: "SE", nome: "Sergipe" }, { sigla: "TO", nome: "Tocantins" }
];
const cidadesCache = new Map();
async function fetchJson(url, timeout = 8500) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error("Falha ao buscar localidade");
    return await res.json();
  } finally { clearTimeout(id); }
}
export async function buscarEstados() {
  try {
    const data = await fetchJson("https://brasilapi.com.br/api/ibge/uf/v1");
    return data.map(e => ({ sigla: e.sigla, nome: e.nome })).sort((a, b) => a.nome.localeCompare(b.nome));
  } catch {
    try {
      const data = await fetchJson("https://servicodados.ibge.gov.br/api/v1/localidades/estados?orderBy=nome");
      return data.map(e => ({ sigla: e.sigla, nome: e.nome }));
    } catch { return ESTADOS; }
  }
}
export async function buscarCidades(uf) {
  if (!uf) return [];
  if (cidadesCache.has(uf)) return cidadesCache.get(uf);
  try {
    const data = await fetchJson(`https://brasilapi.com.br/api/ibge/municipios/v1/${uf}?providers=dados-abertos-br,gov,wikipedia`);
    const cidades = data.map(c => c.nome).sort((a, b) => a.localeCompare(b));
    cidadesCache.set(uf, cidades); return cidades;
  } catch {
    try {
      const data = await fetchJson(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf}/municipios`);
      const cidades = data.map(c => c.nome).sort((a, b) => a.localeCompare(b));
      cidadesCache.set(uf, cidades); return cidades;
    } catch { return []; }
  }
}
export async function configurarSelectEstadoCidade({ estadoId, cidadeId, estadoPlaceholder = "Estado", cidadePlaceholder = "Cidade" }) {
  const estado = document.getElementById(estadoId); const cidade = document.getElementById(cidadeId);
  if (!estado || !cidade) return;
  const estados = await buscarEstados();
  estado.innerHTML = `<option value="">${estadoPlaceholder}</option>` + estados.map(e => `<option value="${e.sigla}" data-nome="${e.nome}">${e.nome} - ${e.sigla}</option>`).join("");
  cidade.innerHTML = `<option value="">${cidadePlaceholder}</option>`; cidade.disabled = true;
  estado.addEventListener("change", async () => {
    cidade.disabled = true; cidade.innerHTML = `<option value="">Carregando cidades...</option>`;
    const cidades = await buscarCidades(estado.value);
    if (!cidades.length) {
      cidade.outerHTML = `<input id="${cidadeId}" type="text" placeholder="Digite a cidade" required />`;
      return;
    }
    const nextCidade = document.getElementById(cidadeId);
    nextCidade.disabled = false;
    nextCidade.innerHTML = `<option value="">${cidadePlaceholder}</option>` + cidades.map(nome => `<option value="${nome}">${nome}</option>`).join("");
  });
}
export function obterLocalidade(estadoId, cidadeId) {
  const estado = document.getElementById(estadoId); const cidade = document.getElementById(cidadeId);
  const selected = estado?.selectedOptions?.[0];
  const uf = estado?.value || ""; const estadoNome = selected?.dataset?.nome || selected?.textContent?.replace(` - ${uf}`, "") || "";
  const cidadeNome = cidade?.value || "";
  return { uf, estado: estadoNome, cidade: cidadeNome, texto: cidadeNome && uf ? `${cidadeNome} - ${uf}` : cidadeNome };
}
