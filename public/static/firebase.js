// Firebase SDK (ESM)
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import {
  getAuth, onAuthStateChanged, signOut,
  signInWithEmailAndPassword, createUserWithEmailAndPassword,
  sendPasswordResetEmail
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';
import {
  getFirestore, collection, query, where, getDocs,
  addDoc, doc, getDoc, setDoc, updateDoc, orderBy,
  Timestamp, limit, serverTimestamp, increment
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

const firebaseConfig = {
  apiKey: "AIzaSyCijC0Lfvx0WJFWQc4kukND7yOlA-nABr8",
  authDomain: "dedra-mlm.firebaseapp.com",
  projectId: "dedra-mlm",
  storageBucket: "dedra-mlm.firebasestorage.app",
  messagingSenderId: "990762022325",
  appId: "1:990762022325:web:1b238ef6eca4ffb4b795fc"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// 전역으로 노출
window.FB = {
  app, auth, db,
  // auth functions
  onAuthStateChanged, signOut,
  signInWithEmailAndPassword, createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  // firestore functions
  collection, query, where, getDocs, addDoc,
  doc, getDoc, setDoc, updateDoc, orderBy,
  Timestamp, limit, serverTimestamp, increment
};

// 인증 상태 감지 → 앱 초기화 트리거
onAuthStateChanged(auth, (user) => {
  if (window.onAuthReady) {
    window.onAuthReady(user);
  }
});

console.log('[Firebase] 초기화 완료');
