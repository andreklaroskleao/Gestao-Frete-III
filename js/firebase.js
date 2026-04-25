import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-analytics.js";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore,
  collection,
  collectionGroup,
  doc,
  addDoc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyASay7R8Zv0RfIjyNk8IX1WCFcqHXVQ27s",
  authDomain: "gestao-frete-4eb08.firebaseapp.com",
  projectId: "gestao-frete-4eb08",
  storageBucket: "gestao-frete-4eb08.firebasestorage.app",
  messagingSenderId: "509337140725",
  appId: "1:509337140725:web:fb4e6bcec1812a7f0df4bc",
  measurementId: "G-Y0GR98M29D"
};

const app = initializeApp(firebaseConfig);
let analytics = null;
try {
  analytics = getAnalytics(app);
} catch (error) {
  console.warn("Analytics indisponível neste ambiente:", error.message);
}

const auth = getAuth(app);
const db = getFirestore(app);

export {
  app,
  analytics,
  auth,
  db,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  collection,
  collectionGroup,
  doc,
  addDoc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  onSnapshot
};
