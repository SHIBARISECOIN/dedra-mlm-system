// Firebase SDK (ESM)
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import {
  getAuth, onAuthStateChanged, signOut,
  signInWithCredential, EmailAuthProvider,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail, updatePassword, reauthenticateWithCredential
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';
import {
  getFirestore, collection, query, where, getDocs, onSnapshot,
  addDoc, doc, getDoc, setDoc, updateDoc, orderBy,
  Timestamp, limit, serverTimestamp, increment, deleteDoc, writeBatch
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';
import {
  getMessaging, getToken, onMessage
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging.js';

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

// ── FCM Messaging 초기화 ─────────────────────────────────────────────────
let messaging = null;
try {
  messaging = getMessaging(app);
} catch(e) {
  console.warn('[FCM] messaging 초기화 실패 (지원 안 되는 환경):', e.message);
}

// VAPID 공개키 (Firebase Console → 프로젝트 설정 → 클라우드 메시징 → 웹 푸시 인증서)
// TODO: Firebase Console에서 발급 후 아래 키로 교체하세요
const FCM_VAPID_KEY = 'BND1xb0pPx4ADH9POB3AVi9ZPRztqQ4leZ9QfnmHg6hYunkbgSy9-a5P91fUaoPLkRnvuJYwSHmhOZ9o1GvZTIs';

/**
 * FCM 푸시 알림 권한 요청 및 토큰 등록
 * 로그인 성공 후 호출됩니다.
 */
async function initFCMToken(userId) {
  try {
    if (!messaging) return null;
    if (!('Notification' in window)) return null;

    // 이미 저장된 토큰 확인 (재요청 방지)
    const savedToken = localStorage.getItem('deedra_fcm_token');
    const savedUserId = localStorage.getItem('deedra_fcm_uid');
    if (savedToken && savedUserId === userId) {
      console.log('[FCM] 기존 토큰 사용');
      return savedToken;
    }

    // 알림 권한 요청
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.log('[FCM] 알림 권한 거부됨');
      return null;
    }

    // SW 등록 확인
    const sw = await navigator.serviceWorker.ready;
    const token = await getToken(messaging, {
      vapidKey: FCM_VAPID_KEY,
      serviceWorkerRegistration: sw,
    });

    if (!token) {
      console.warn('[FCM] 토큰 발급 실패');
      return null;
    }

    console.log('[FCM] 토큰 발급 성공:', token.slice(0, 20) + '...');

    // 서버에 토큰 저장 (/api/fcm/register)
    await fetch('/api/fcm/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        token,
        platform: 'web',
        userAgent: navigator.userAgent.slice(0, 100),
      }),
    });

    localStorage.setItem('deedra_fcm_token', token);
    localStorage.setItem('deedra_fcm_uid', userId);
    return token;

  } catch(e) {
    console.warn('[FCM] 토큰 초기화 실패:', e.message);
    return null;
  }
}

/**
 * FCM 포그라운드 메시지 수신 핸들러
 * 앱이 열려 있을 때 수신된 메시지를 앱 내 알림으로 표시합니다.
 */
function setupFCMForeground() {
  if (!messaging) return;
  onMessage(messaging, (payload) => {
    console.log('[FCM] 포그라운드 메시지 수신:', payload);
    const { title, body } = payload.notification || {};
    const data = payload.data || {};

    // 앱 내 토스트/알림 표시
    if (typeof window.showToast === 'function') {
      window.showToast(`🔔 ${title || 'DEEDRA 알림'}: ${body || ''}`, 'info');
    }

    // 알림 벨 업데이트
    if (typeof window.refreshNotifications === 'function') {
      window.refreshNotifications();
    }

    // 커스텀 이벤트 발행 (앱에서 처리 가능)
    window.dispatchEvent(new CustomEvent('fcm-message', { detail: { title, body, data } }));
  });
}

// ── 로그인: EmailAuthProvider.credential + signInWithCredential ──────────
async function loginWithEmail(authObj, email, password) {
  try {
    const credential = EmailAuthProvider.credential(email, password);
    const result = await signInWithCredential(authObj, credential);
    console.log('[Firebase] signInWithCredential 성공:', result.user.email);
    return result;
  } catch (e) {
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
  window.FB._idToken = data.idToken;
  window.FB._currentUser = { uid: data.localId, email: data.email };
  window.FB._useRestAPI = true;
  if (typeof window.onAuthReady === 'function') {
    window.onAuthReady(window.FB._currentUser);
  }
  return { user: window.FB._currentUser };
}

// 전역으로 노출
window.FB = {
  firebaseConfig,
  app, auth, db, messaging,
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
    localStorage.removeItem('deedra_fcm_token');
    localStorage.removeItem('deedra_fcm_uid');
    try { await signOut(authObj); } catch(e) {}
  },
  signInWithEmailAndPassword: loginWithEmail,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail, updatePassword, reauthenticateWithCredential, EmailAuthProvider,
  // firestore functions
  collection, query, where, getDocs, onSnapshot, addDoc,
  doc, getDoc, setDoc, updateDoc, deleteDoc, orderBy,
  Timestamp, limit, serverTimestamp, increment, writeBatch,
  // FCM functions
  initFCMToken,
  setupFCMForeground,
};

// ── FCM 포그라운드 핸들러 즉시 등록 ────────────────────────────────────────
setupFCMForeground();

// ── 인증 상태 감지 ───────────────────────────────────────────────────────
onAuthStateChanged(auth, (user) => {
  if (user) {
    console.log('[Firebase] SDK 인증 성공:', user.email);
    window.FB._currentUser = { uid: user.uid, email: user.email };
    localStorage.setItem('deedra_session', JSON.stringify({ uid: user.uid, email: user.email }));

    // FCM 토큰 초기화 (백그라운드, 오류 무시)
    initFCMToken(user.uid).catch(() => {});

    if (typeof window.onAuthReady === 'function') {
      window.onAuthReady(window.FB._currentUser);
    } else {
      // app.js has not loaded yet, save state to window
      window._pendingAuthUser = window.FB._currentUser;
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
        // 세션 복원 시에도 FCM 토큰 초기화
        initFCMToken(session.uid).catch(() => {});
        if (typeof window.onAuthReady === 'function') {
          window.onAuthReady(session);
        } else {
          window._pendingAuthUser = session;
        }
        return;
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
      console.warn("app.js failed to load within 5 seconds, forcing auth screen fallback");
      const ls = document.getElementById('loadingScreen');
      const as = document.getElementById('authScreen');
      if (ls) ls.classList.add('hidden');
      if (as) as.classList.remove('hidden');
    }
  }, 50);
});

console.log('[Firebase] 초기화 완료');
