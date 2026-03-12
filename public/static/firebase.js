// Firebase SDK (ESM)
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import {
  getAuth, onAuthStateChanged, signOut,
  signInWithCustomToken,
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

// ── 서버 프록시 경유 로그인 (authorized domain 제한 우회) ─────────────
// /api/auth/login → Hono 서버 → Firebase REST API
// idToken을 받아 signInWithCustomToken 대신 Firestore를 직접 사용

// 로그인: 서버 프록시 경유 → idToken 획득 → window.FB._mockUser 세팅
async function loginWithEmail(authObj, email, password) {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  const data = await res.json();
  if (!res.ok) {
    const rawMsg = data.error || 'UNKNOWN';
    // Firebase REST API 에러 메시지 → SDK 호환 코드 변환
    let code = 'auth/unknown';
    const msg = rawMsg.toUpperCase();
    if (msg.includes('INVALID_LOGIN_CREDENTIALS') || msg.includes('INVALID_PASSWORD') || msg.includes('INVALID_EMAIL')) {
      code = 'auth/invalid-credential';
    } else if (msg.includes('EMAIL_NOT_FOUND') || msg.includes('USER_NOT_FOUND')) {
      code = 'auth/user-not-found';
    } else if (msg.includes('TOO_MANY_ATTEMPTS') || msg.includes('TOO_MANY_REQUESTS')) {
      code = 'auth/too-many-requests';
    } else if (msg.includes('USER_DISABLED')) {
      code = 'auth/user-disabled';
    } else if (msg.includes('WEAK_PASSWORD')) {
      code = 'auth/weak-password';
    } else if (msg.includes('EMAIL_EXISTS')) {
      code = 'auth/email-already-in-use';
    } else {
      code = 'auth/' + rawMsg.toLowerCase().replace(/_/g, '-');
    }
    const err = new Error(rawMsg);
    err.code = code;
    console.error('[Firebase] 로그인 실패:', rawMsg, '→', code);
    throw err;
  }
  // Firebase SDK 로그인 없이 직접 user 객체 시뮬레이션
  const mockUser = {
    uid: data.localId,
    email: data.email,
    idToken: data.idToken,
    refreshToken: data.refreshToken
  };
  window.FB._currentUser = mockUser;
  console.log('[Firebase] 로그인 성공:', mockUser.email, 'uid:', mockUser.uid);
  // onAuthReady 직접 호출
  if (typeof window.onAuthReady === 'function') {
    window.onAuthReady(mockUser);
  }
  return { user: mockUser };
}

// 회원가입: 서버 프록시 경유
async function registerWithEmail(authObj, email, password) {
  const res = await fetch('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  const data = await res.json();
  if (!res.ok) {
    const code = 'auth/' + (data.error || 'UNKNOWN').toLowerCase().replace(/_/g, '-');
    const err = new Error(data.error || 'Register failed');
    err.code = code;
    throw err;
  }
  const mockUser = {
    uid: data.localId,
    email: data.email,
    idToken: data.idToken,
    refreshToken: data.refreshToken
  };
  window.FB._currentUser = mockUser;
  return { user: mockUser };
}

// ── 로그아웃 ──────────────────────────────────────────────────────────
async function signOutUser(authObj) {
  window.FB._currentUser = null;
  // Firebase SDK signOut은 선택적 (SDK 로그인 없으므로 그냥 상태만 초기화)
  try { await signOut(authObj); } catch(e) { /* 무시 */ }
}

// 전역으로 노출
window.FB = {
  app, auth, db,
  _currentUser: null,
  // auth functions (프록시 래퍼)
  onAuthStateChanged,
  signOut: signOutUser,
  signInWithEmailAndPassword: loginWithEmail,
  createUserWithEmailAndPassword: registerWithEmail,
  sendPasswordResetEmail,
  // firestore functions
  collection, query, where, getDocs, addDoc,
  doc, getDoc, setDoc, updateDoc, deleteDoc, orderBy,
  Timestamp, limit, serverTimestamp, increment, writeBatch
};

// ── Firebase SDK onAuthStateChanged는 null만 반환할 것임 ──────────────
// 대신 앱 시작 시 로컬스토리지에서 세션 복원 시도
onAuthStateChanged(auth, (user) => {
  if (user) {
    // Firebase SDK 자체 인증이 된 경우 (기존 세션)
    console.log('[Firebase] SDK onAuthStateChanged:', user.email);
    window.FB._currentUser = { uid: user.uid, email: user.email };
    if (typeof window.onAuthReady === 'function') {
      window.onAuthReady(window.FB._currentUser);
    }
    return;
  }

  // SDK 미인증 → 로컬스토리지 세션 복원 시도
  const saved = localStorage.getItem('deedra_session');
  if (saved) {
    try {
      const session = JSON.parse(saved);
      if (session && session.uid && session.email) {
        console.log('[Firebase] 로컬 세션 복원:', session.email);
        window.FB._currentUser = session;
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

  // onAuthReady가 아직 없으면 최대 5초 폴링
  let tries = 0;
  const poll = setInterval(() => {
    tries++;
    if (typeof window.onAuthReady === 'function') {
      clearInterval(poll);
      window.onAuthReady(null);
    } else if (tries >= 100) {
      clearInterval(poll);
      console.error('[Firebase] onAuthReady 미정의 — 강제로 auth 화면 표시');
      const ls = document.getElementById('loadingScreen');
      const as = document.getElementById('authScreen');
      if (ls) ls.classList.add('hidden');
      if (as) as.classList.remove('hidden');
    }
  }, 50);
});

console.log('[Firebase] 초기화 완료');
