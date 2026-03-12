// Firebase SDK (ESM)
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import {
  getAuth, onAuthStateChanged, signOut,
  signInWithCredential, EmailAuthProvider,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';
import {
  getFirestore, collection, query, where, getDocs,
  addDoc, doc, getDoc, setDoc, updateDoc, orderBy,
  Timestamp, limit, serverTimestamp, increment, deleteDoc, writeBatch
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

// ── 로그인: EmailAuthProvider.credential + signInWithCredential ──────────
// signInWithEmailAndPassword()는 authDomain iframe 체크를 하지만
// signInWithCredential()은 REST API를 직접 호출해서 도메인 체크를 건너뜁니다
async function loginWithEmail(authObj, email, password) {
  try {
    const credential = EmailAuthProvider.credential(email, password);
    const result = await signInWithCredential(authObj, credential);
    console.log('[Firebase] signInWithCredential 성공:', result.user.email);
    return result;
  } catch (e) {
    // signInWithCredential도 실패하면 서버 프록시 사용
    if (e.code === 'auth/unauthorized-domain' || e.code === 'auth/invalid-credential') {
      console.warn('[Firebase] credential 실패, 프록시 사용:', e.code);
      return await loginViaProxy(email, password);
    }
    throw e;
  }
}

// ── 프록시 로그인 fallback ────────────────────────────────────────────────
async function loginViaProxy(email, password) {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  const data = await res.json();
  if (!res.ok) {
    const msg = data.error || 'UNKNOWN';
    const err = new Error(msg);
    if (msg.includes('INVALID_LOGIN_CREDENTIALS') || msg.includes('INVALID_PASSWORD')) {
      err.code = 'auth/invalid-credential';
    } else if (msg.includes('TOO_MANY_ATTEMPTS')) {
      err.code = 'auth/too-many-requests';
    } else if (msg.includes('USER_NOT_FOUND')) {
      err.code = 'auth/user-not-found';
    } else {
      err.code = 'auth/unknown';
    }
    throw err;
  }
  // idToken을 window.FB._idToken에 저장해서 Firestore 접근에 사용
  window.FB._idToken = data.idToken;
  window.FB._currentUser = { uid: data.localId, email: data.email };

  // Firestore SDK에 idToken 주입 (connectFirestoreEmulator 방식 아님)
  // 대신 Firestore REST API 모드로 전환
  window.FB._useRestAPI = true;

  // onAuthReady 직접 호출
  if (typeof window.onAuthReady === 'function') {
    window.onAuthReady(window.FB._currentUser);
  }
  return { user: window.FB._currentUser };
}

// 전역으로 노출
window.FB = {
  app, auth, db,
  _currentUser: null,
  _idToken: null,
  _useRestAPI: false,
  // auth functions
  onAuthStateChanged,
  signOut: async (authObj) => {
    window.FB._currentUser = null;
    window.FB._idToken = null;
    window.FB._useRestAPI = false;
    localStorage.removeItem('deedra_session');
    try { await signOut(authObj); } catch(e) {}
  },
  signInWithEmailAndPassword: loginWithEmail,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  // firestore functions
  collection, query, where, getDocs, addDoc,
  doc, getDoc, setDoc, updateDoc, deleteDoc, orderBy,
  Timestamp, limit, serverTimestamp, increment, writeBatch
};

// ── 인증 상태 감지 ───────────────────────────────────────────────────────
onAuthStateChanged(auth, (user) => {
  if (user) {
    console.log('[Firebase] SDK 인증 성공:', user.email);
    window.FB._currentUser = { uid: user.uid, email: user.email };
    localStorage.setItem('deedra_session', JSON.stringify({ uid: user.uid, email: user.email }));

    if (typeof window.onAuthReady === 'function') {
      window.onAuthReady(window.FB._currentUser);
    }
    return;
  }

  // SDK 미인증 → localStorage 세션 복원 시도
  const saved = localStorage.getItem('deedra_session');
  if (saved) {
    try {
      const session = JSON.parse(saved);
      if (session && session.uid) {
        console.log('[Firebase] 세션 복원:', session.email);
        window.FB._currentUser = session;
        window.FB._useRestAPI = true;
        if (typeof window.onAuthReady === 'function') {
          window.onAuthReady(session);
          return;
        }
      }
    } catch(e) { localStorage.removeItem('deedra_session'); }
  }

  console.log('[Firebase] onAuthStateChanged: null (비로그인)');

  if (typeof window.onAuthReady === 'function') {
    window.onAuthReady(null);
    return;
  }
  let tries = 0;
  const poll = setInterval(() => {
    tries++;
    if (typeof window.onAuthReady === 'function') {
      clearInterval(poll);
      window.onAuthReady(null);
    } else if (tries >= 100) {
      clearInterval(poll);
      const ls = document.getElementById('loadingScreen');
      const as = document.getElementById('authScreen');
      if (ls) ls.classList.add('hidden');
      if (as) as.classList.remove('hidden');
    }
  }, 50);
});

console.log('[Firebase] 초기화 완료');
