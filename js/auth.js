import { auth, db, signInWithEmailAndPassword, createUserWithEmailAndPassword, doc, setDoc, getDoc, serverTimestamp } from "./firebase.js";
import { configurarSelectEstadoCidade, obterLocalidade } from "./ibge.js";
import { showMessage, $, requestLocationPermission } from "./ui.js";
import { captureReferral, referralCode } from "./comercial.js";

captureReferral();
const message = $("message");
configurarSelectEstadoCidade({ estadoId: "baseState", cidadeId: "baseCity", estadoPlaceholder: "Estado", cidadePlaceholder: "Cidade" });
function firebaseError(error) {
  const map = { "auth/email-already-in-use": "Este e-mail ja esta cadastrado.", "auth/invalid-email": "E-mail invalido.", "auth/weak-password": "A senha precisa ter pelo menos 6 caracteres.", "auth/invalid-credential": "E-mail ou senha incorretos.", "auth/user-not-found": "Usuario nao encontrado.", "auth/wrong-password": "Senha incorreta." };
  return map[error.code] || `Erro: ${error.message}`;
}
function requireAccept(id, text){ const el=$(id); if(el && !el.checked){ showMessage(message, text, "error"); return false; } return true; }
$("loginForm")?.addEventListener("submit", async (event) => {
  event.preventDefault(); showMessage(message, "Entrando...");
  try {
    const credential = await signInWithEmailAndPassword(auth, $("email").value.trim(), $("password").value);
    const snap = await getDoc(doc(db, "usuarios", credential.user.uid));
    if (!snap.exists()) return showMessage(message, "Conta sem perfil vinculado.", "error");
    const tipo = snap.data().tipo || snap.data().role;
    requestLocationPermission(null, () => {});
    if (tipo === "gestor") window.location.href = "gestor.html";
    else if (tipo === "empresa") window.location.href = "empresa.html";
    else window.location.href = "caminhoneiro.html";
  } catch (error) { showMessage(message, firebaseError(error), "error"); }
});
$("registerDriverForm")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  if(!requireAccept("driverTerms", "Aceite o termo de uso para continuar.")) return;
  showMessage(message, "Criando cadastro...");
  const base = obterLocalidade("baseState", "baseCity");
  const ref = referralCode();
  const payload = { nome: $("name").value.trim(), name: $("name").value.trim(), telefone: $("phone").value.trim(), phone: $("phone").value.trim(), document: $("document").value.trim(), cnh: $("cnh").value.trim(), cidade: base.cidade, uf: base.uf, estado: base.estado, baseLocation: base.texto, email: $("email").value.trim(), tipo: "caminhoneiro", role: "caminhoneiro", status: "ativo", disponibilidade: "disponivel", favorito: false, bloqueado: false, origemCadastro: ref, campanha: ref, aceiteTermoUso: true, dataAceiteTermoUso: serverTimestamp(), createdAt: serverTimestamp() };
  try {
    const credential = await createUserWithEmailAndPassword(auth, payload.email, $("password").value);
    await setDoc(doc(db, "usuarios", credential.user.uid), payload);
    await setDoc(doc(db, "caminhoneiros", credential.user.uid), payload);
    showMessage(message, "Cadastro criado. Abrindo seu painel...");
    setTimeout(() => window.location.href = "caminhoneiro.html", 700);
  } catch (error) { showMessage(message, firebaseError(error), "error"); }
});
$("registerCompanyForm")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  if(!requireAccept("commissionAccept", "Aceite a politica de comissao para criar o acesso.")) return;
  showMessage(message, "Criando acesso...");
  const base = obterLocalidade("baseState", "baseCity");
  const ref = referralCode();
  const payload = { empresaNome: $("companyName").value.trim(), nome: $("companyName").value.trim(), responsavel: $("contactName").value.trim(), telefone: $("companyPhone").value.trim(), cnpj: $("cnpj").value.trim(), cidade: base.cidade, uf: base.uf, estado: base.estado, baseLocation: base.texto, email: $("email").value.trim(), tipo: "empresa", role: "empresa", status: "ativo", origemCadastro: ref, campanha: ref, aceiteComissao: true, dataAceiteComissao: serverTimestamp(), nomeResponsavelAceite: $("contactName").value.trim(), origemAceite: "web", createdAt: serverTimestamp() };
  try {
    const credential = await createUserWithEmailAndPassword(auth, payload.email, $("password").value);
    await setDoc(doc(db, "usuarios", credential.user.uid), payload);
    await setDoc(doc(db, "empresas", credential.user.uid), payload);
    showMessage(message, "Acesso criado. Abrindo painel da empresa...");
    setTimeout(() => window.location.href = "empresa.html", 700);
  } catch (error) { showMessage(message, firebaseError(error), "error"); }
});
