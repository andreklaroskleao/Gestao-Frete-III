import {
  auth,
  db,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  doc,
  setDoc,
  getDoc,
  serverTimestamp
} from "./firebase.js";
import { configurarSelectEstadoCidade, obterLocalidade } from "./ibge.js";

const message = document.getElementById("message");
const loginForm = document.getElementById("loginForm");
const registerDriverForm = document.getElementById("registerDriverForm");

configurarSelectEstadoCidade({
  estadoId: "baseState",
  cidadeId: "baseCity",
  estadoPlaceholder: "Estado base",
  cidadePlaceholder: "Cidade base"
});

function showMessage(text, type = "success") {
  if (!message) return;
  message.textContent = text;
  message.className = `message ${type}`;
}

function firebaseError(error) {
  const map = {
    "auth/email-already-in-use": "Este e-mail já está cadastrado.",
    "auth/invalid-email": "E-mail inválido.",
    "auth/weak-password": "A senha precisa ter pelo menos 6 caracteres.",
    "auth/invalid-credential": "E-mail ou senha incorretos.",
    "auth/user-not-found": "Usuário não encontrado.",
    "auth/wrong-password": "Senha incorreta."
  };
  return map[error.code] || `Erro: ${error.message}`;
}

loginForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  showMessage("Entrando...", "success");

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  try {
    const credential = await signInWithEmailAndPassword(auth, email, password);
    const userRef = doc(db, "usuarios", credential.user.uid);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      showMessage("Conta sem perfil. Procure o administrador.", "error");
      return;
    }

    const user = userSnap.data();
    const userType = user.role || user.tipo;

    if (!userType) {
      showMessage("Perfil sem tipo de acesso. No Firestore, adicione tipo: gestor ou caminhoneiro.", "error");
      return;
    }

    window.location.href = userType === "gestor" ? "gestor.html" : "caminhoneiro.html";
  } catch (error) {
    showMessage(firebaseError(error), "error");
  }
});

registerDriverForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  showMessage("Criando cadastro...", "success");

  const base = obterLocalidade("baseState", "baseCity");

  const payload = {
    name: document.getElementById("name").value.trim(),
    nome: document.getElementById("name").value.trim(),
    phone: document.getElementById("phone").value.trim(),
    document: document.getElementById("document").value.trim(),
    cnh: document.getElementById("cnh").value.trim(),
    city: base.cidade,
    cidade: base.cidade,
    state: base.uf,
    estado: base.estado,
    uf: base.uf,
    baseLocation: base.texto,
    email: document.getElementById("email").value.trim(),
    role: "caminhoneiro",
    tipo: "caminhoneiro",
    status: "ativo",
    createdAt: serverTimestamp()
  };

  const password = document.getElementById("password").value;

  try {
    const credential = await createUserWithEmailAndPassword(auth, payload.email, password);
    await setDoc(doc(db, "usuarios", credential.user.uid), payload);
    await setDoc(doc(db, "caminhoneiros", credential.user.uid), payload);
    showMessage("Cadastro criado! Redirecionando para o painel...", "success");
    setTimeout(() => window.location.href = "caminhoneiro.html", 900);
  } catch (error) {
    showMessage(firebaseError(error), "error");
  }
});
