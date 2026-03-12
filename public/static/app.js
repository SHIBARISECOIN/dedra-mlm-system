/**
 * DEEDRA 회원용 앱 v2.0 - 메인 로직
 * UI 설계안 기반 전면 개편
 */

// ===== 전역 상태 =====
let currentUser = null;
let userData = null;
let walletData = null;
let currentPage = 'home';
let selectedProduct = null;
let gameBalanceVal = 0;
let oeBetVal = 10;
let diceBetVal = 10;
let slotBetVal = 10;
let deedraPrice = 0.50; // DEEDRA 시세 (관리자 설정값)
let currentTheme = 'dark';
let productsCache = [];

// 직급 체계
const RANKS = [
  { rank: 'G0', minRefs: 0, label: 'Bronze' },
  { rank: 'G1', minRefs: 3, label: 'Silver' },
  { rank: 'G2', minRefs: 10, label: 'Gold' },
  { rank: 'G3', minRefs: 20, label: 'Platinum' },
  { rank: 'G4', minRefs: 40, label: 'Diamond' },
  { rank: 'G5', minRefs: 80, label: 'Master' },
  { rank: 'G6', minRefs: 150, label: 'Grand Master' },
  { rank: 'G7', minRefs: 300, label: 'Legend' },
  { rank: 'G8', minRefs: 600, label: 'Mythic' },
  { rank: 'G9', minRefs: 1200, label: 'Elite' },
  { rank: 'G10', minRefs: 2000, label: 'Founder' },
];

const SLOT_SYMBOLS = ['🍋', '🍇', '🍎', '🍊', '⭐', '7️⃣', '💎'];
const DICE_FACES = ['', '1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣'];

// USD → KRW 환율 (고정)
const USD_KRW = 1350;

// ===== 앱 초기화 =====
window.onAuthReady = async (user) => {
  if (user) {
    currentUser = user;
    await initApp();
  } else {
    showScreen('auth');
  }
};

async function initApp() {
  try {
    const { doc, getDoc, db } = window.FB;
    const userSnap = await getDoc(doc(db, 'users', currentUser.uid));

    if (!userSnap.exists()) {
      await createUserData(currentUser);
    } else {
      userData = userSnap.data();
    }

    await loadWalletData();
    await loadDeedraPrice();

    showScreen('main');

    updateHomeUI();
    loadAnnouncements();
    loadRecentTransactions();
    loadDDayCard();

    // 테마 복원
    restoreTheme();

  } catch (err) {
    console.error('앱 초기화 실패:', err);
    showToast('초기화 실패. 다시 시도해주세요.', 'error');
    showScreen('auth');
  }
}

async function createUserData(user) {
  const { doc, setDoc, db, serverTimestamp } = window.FB;
  const referralCode = generateReferralCode(user.uid);

  userData = {
    uid: user.uid,
    email: user.email,
    name: user.displayName || user.email.split('@')[0],
    role: 'member',
    rank: 'G0',
    status: 'active',
    referralCode,
    referredBy: null,
    createdAt: serverTimestamp(),
    phone: '',
    withdrawPin: null,
  };

  await setDoc(doc(db, 'users', user.uid), userData);
  await setDoc(doc(db, 'wallets', user.uid), {
    userId: user.uid,
    usdtBalance: 0,
    dedraBalance: 0,
    bonusBalance: 0,
    totalDeposit: 0,
    totalWithdrawal: 0,
    totalEarnings: 0,
    createdAt: serverTimestamp(),
  });
}

async function loadWalletData() {
  const { doc, getDoc, db } = window.FB;
  const snap = await getDoc(doc(db, 'wallets', currentUser.uid));
  walletData = snap.exists() ? snap.data() : { usdtBalance: 0, dedraBalance: 0, bonusBalance: 0 };
  gameBalanceVal = walletData.dedraBalance || 0;
}

// ===== DEEDRA 시세 로드 =====
async function loadDeedraPrice() {
  try {
    const { doc, getDoc, db } = window.FB;
    const snap = await getDoc(doc(db, 'settings', 'deedraPrice'));
    if (snap.exists()) {
      deedraPrice = snap.data().price || 0.50;
      const updatedAt = snap.data().updatedAt;
      updatePriceTicker(deedraPrice, updatedAt);
    } else {
      updatePriceTicker(0.50, null);
    }
  } catch (err) {
    updatePriceTicker(0.50, null);
  }
}

function updatePriceTicker(price, updatedAt) {
  const el = document.getElementById('deedraPrice');
  const subEl = document.getElementById('deedraUpdated');
  const changeEl = document.getElementById('deedraChange');

  if (el) el.textContent = '$' + price.toFixed(4);
  if (subEl) subEl.textContent = updatedAt ? '업데이트: ' + fmtDate(updatedAt) : '관리자 설정 시세';
  if (changeEl) {
    changeEl.textContent = '1 DEEDRA = $' + price.toFixed(4);
    changeEl.className = 'price-change-value up';
  }

  // splitDedra의 USD 환산 업데이트
  if (walletData) {
    const dedraUsd = (walletData.dedraBalance || 0) * price;
    const el2 = document.getElementById('splitDedraUsd');
    if (el2) el2.textContent = '≈ $' + fmt(dedraUsd);
    const el3 = document.getElementById('moreWalletDedraUsd');
    if (el3) el3.textContent = '≈ $' + fmt(dedraUsd);
    const el4 = document.getElementById('gameBalanceUsd');
    if (el4) el4.textContent = '≈ $' + fmt(gameBalanceVal * price);
  }
}

// ===== 테마 =====
function restoreTheme() {
  const saved = localStorage.getItem('deedra_theme') || 'dark';
  setTheme(saved);
}

function setTheme(theme) {
  currentTheme = theme;
  if (theme === 'light') {
    document.documentElement.setAttribute('data-theme', 'light');
    const icon = document.getElementById('themeIcon');
    if (icon) { icon.className = 'fas fa-sun'; }
    const toggle = document.getElementById('darkModeToggle');
    if (toggle) toggle.className = 'menu-item-toggle';
  } else {
    document.documentElement.removeAttribute('data-theme');
    const icon = document.getElementById('themeIcon');
    if (icon) { icon.className = 'fas fa-moon'; }
    const toggle = document.getElementById('darkModeToggle');
    if (toggle) toggle.className = 'menu-item-toggle on';
  }
  localStorage.setItem('deedra_theme', theme);
}

window.toggleTheme = function() {
  setTheme(currentTheme === 'dark' ? 'light' : 'dark');
};

window.toggleThemeFromMenu = function() {
  setTheme(currentTheme === 'dark' ? 'light' : 'dark');
};

window.toggleNoti = function(btn) {
  btn.classList.toggle('on');
};

window.changeLang = function(lang) {
  showToast('언어 변경 기능은 준비 중입니다.', 'info');
};

// ===== 화면 전환 =====
function showScreen(name) {
  document.getElementById('loadingScreen').classList.add('hidden');
  document.getElementById('authScreen').classList.add('hidden');
  document.getElementById('mainApp').classList.add('hidden');

  if (name === 'loading') document.getElementById('loadingScreen').classList.remove('hidden');
  else if (name === 'auth') document.getElementById('authScreen').classList.remove('hidden');
  else if (name === 'main') document.getElementById('mainApp').classList.remove('hidden');
}

// ===== 탭 전환 =====
window.switchPage = function(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  const pageEl = document.getElementById(page + 'Page');
  const navEl = document.getElementById('nav-' + page);
  if (pageEl) pageEl.classList.add('active');
  if (navEl) navEl.classList.add('active');

  currentPage = page;

  if (page === 'invest') loadInvestPage();
  else if (page === 'network') loadNetworkPage();
  else if (page === 'play') updateGameUI();
  else if (page === 'more') loadMorePage();
};

// ===== 인증 탭 =====
window.switchAuthTab = function(tab) {
  document.getElementById('loginTab').classList.toggle('active', tab === 'login');
  document.getElementById('registerTab').classList.toggle('active', tab === 'register');
  document.getElementById('loginForm').classList.toggle('hidden', tab !== 'login');
  document.getElementById('registerForm').classList.toggle('hidden', tab !== 'register');
};

// ===== 로그인 =====
window.handleLogin = async function() {
  const email = document.getElementById('loginEmail').value.trim();
  const pw = document.getElementById('loginPassword').value;
  if (!email || !pw) { showToast('이메일과 비밀번호를 입력하세요.', 'warning'); return; }

  showScreen('loading');
  try {
    const { signInWithEmailAndPassword, auth } = window.FB;
    await signInWithEmailAndPassword(auth, email, pw);
  } catch (err) {
    showScreen('auth');
    showToast(getAuthErrorMsg(err.code), 'error');
  }
};

// ===== 회원가입 =====
window.handleRegister = async function() {
  const name = document.getElementById('regName').value.trim();
  const email = document.getElementById('regEmail').value.trim();
  const pw = document.getElementById('regPassword').value;
  const refCode = document.getElementById('regReferral').value.trim();

  if (!name || !email || !pw || !refCode) { showToast('모든 필드를 입력해주세요.', 'warning'); return; }
  if (pw.length < 8) { showToast('비밀번호는 8자 이상이어야 합니다.', 'warning'); return; }

  const referrer = await findUserByReferralCode(refCode);
  if (!referrer) { showToast('유효하지 않은 추천인 코드입니다.', 'error'); return; }

  showScreen('loading');
  try {
    const { createUserWithEmailAndPassword, auth, doc, setDoc, db, serverTimestamp } = window.FB;
    const { user } = await createUserWithEmailAndPassword(auth, email, pw);
    const myCode = generateReferralCode(user.uid);

    await setDoc(doc(db, 'users', user.uid), {
      uid: user.uid, email, name, role: 'member', rank: 'G0', status: 'active',
      referralCode: myCode, referredBy: referrer.uid, referredByCode: refCode,
      createdAt: serverTimestamp(), phone: '', withdrawPin: null,
    });
    await setDoc(doc(db, 'wallets', user.uid), {
      userId: user.uid, usdtBalance: 0, dedraBalance: 0, bonusBalance: 0,
      totalDeposit: 0, totalWithdrawal: 0, totalEarnings: 0, createdAt: serverTimestamp(),
    });
    showToast('회원가입 완료! 환영합니다 🎉', 'success');
  } catch (err) {
    showScreen('auth');
    showToast(getAuthErrorMsg(err.code), 'error');
  }
};

// ===== 비밀번호 찾기 =====
window.handleForgotPassword = async function() {
  const email = document.getElementById('loginEmail').value.trim();
  if (!email) { showToast('이메일을 먼저 입력하세요.', 'warning'); return; }
  try {
    const { sendPasswordResetEmail, auth } = window.FB;
    await sendPasswordResetEmail(auth, email);
    showToast('비밀번호 재설정 이메일을 발송했습니다.', 'success');
  } catch (err) {
    showToast(getAuthErrorMsg(err.code), 'error');
  }
};

// ===== 로그아웃 =====
window.handleLogout = async function() {
  if (!confirm('로그아웃 하시겠습니까?')) return;
  const { signOut, auth } = window.FB;
  await signOut(auth);
  currentUser = null; userData = null; walletData = null;
  showScreen('auth');
};

// ===== 홈 UI 업데이트 =====
function updateHomeUI() {
  if (!userData || !walletData) return;

  const hour = new Date().getHours();
  const greeting = hour < 6 ? '새벽에도 열심히네요 🌙' : hour < 12 ? '좋은 아침이에요 ☀️' : hour < 18 ? '안녕하세요 👋' : '좋은 저녁이에요 🌆';

  const greetEl = document.getElementById('greetingMsg');
  const nameEl = document.getElementById('userNameDisplay');
  const rankEl = document.getElementById('userRankBadge');

  if (greetEl) greetEl.textContent = greeting;
  if (nameEl) nameEl.textContent = userData.name || '-';
  if (rankEl) rankEl.textContent = userData.rank || 'G0';

  const usdt = walletData.usdtBalance || 0;
  const dedra = walletData.dedraBalance || 0;
  const bonus = walletData.bonusBalance || 0;
  const dedraInUsd = dedra * deedraPrice;
  const total = usdt + dedraInUsd + bonus;

  const setEl = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };

  setEl('totalAsset', '$' + fmt(total));
  setEl('totalAssetKrw', '≈ ₩' + fmtInt(total * USD_KRW));
  setEl('splitUsdt', fmt(usdt));
  setEl('splitDedra', fmt(dedra));
  setEl('splitDedraUsd', '≈ $' + fmt(dedraInUsd));
}

// ===== D-Day 카드 =====
async function loadDDayCard() {
  try {
    const { collection, query, where, orderBy, getDocs, limit, db } = window.FB;
    const q = query(
      collection(db, 'investments'),
      where('userId', '==', currentUser.uid),
      where('status', '==', 'active'),
      orderBy('startDate', 'desc'),
      limit(1)
    );
    const snap = await getDocs(q);
    if (snap.empty) return;

    const inv = snap.docs[0].data();
    const card = document.getElementById('ddayCard');
    if (!card) return;
    card.classList.remove('hidden');

    const startTs = inv.startDate?.toDate ? inv.startDate.toDate() : new Date(inv.startDate);
    const endTs = inv.endDate?.toDate ? inv.endDate.toDate() : new Date(inv.endDate);
    const now = new Date();

    const totalMs = endTs - startTs;
    const elapsedMs = now - startTs;
    const remainMs = endTs - now;

    const progress = Math.min(100, Math.max(0, (elapsedMs / totalMs) * 100));
    const remainDays = Math.max(0, Math.ceil(remainMs / (1000 * 60 * 60 * 24)));

    const setEl = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };

    setEl('ddayBadge', 'D-' + remainDays);
    setEl('ddayName', inv.productName || '투자 진행 중');
    setEl('ddayStart', fmtDateShort(startTs));
    setEl('ddayEnd', fmtDateShort(endTs));
    setEl('ddayAmount', '$' + fmt(inv.amount));
    setEl('ddayReturn', '+' + fmt(inv.expectedReturn || 0) + ' DEEDRA');
    setEl('ddayRemain', remainDays + '일 남음');

    const fill = document.getElementById('ddayFill');
    if (fill) fill.style.width = progress.toFixed(1) + '%';

  } catch (err) {
    // 조용히 실패
  }
}

// ===== 공지사항 =====
async function loadAnnouncements() {
  const { collection, query, where, orderBy, getDocs, limit, db } = window.FB;
  try {
    const q = query(
      collection(db, 'announcements'),
      where('isActive', '==', true),
      orderBy('isPinned', 'desc'),
      orderBy('createdAt', 'desc'),
      limit(5)
    );
    const snap = await getDocs(q);
    const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderAnnouncements(items, 'announcementList');
    renderAnnouncements(items, 'moreAnnouncementList');
  } catch (err) {
    const el = document.getElementById('announcementList');
    if (el) el.innerHTML = '<div class="empty-state">공지사항이 없습니다</div>';
  }
}

function renderAnnouncements(items, containerId) {
  const el = document.getElementById(containerId);
  if (!el) return;
  if (!items.length) {
    el.innerHTML = '<div class="empty-state"><i class="fas fa-bullhorn"></i>공지사항이 없습니다</div>';
    return;
  }
  el.innerHTML = items.map(a => `
    <div class="announcement-item" onclick="showAnnouncementDetail('${a.id}')">
      <div class="ann-title">
        ${a.isPinned ? '<span class="pin-badge">공지</span>' : ''}${a.title || '제목 없음'}
      </div>
      <div class="ann-date">${fmtDate(a.createdAt)}</div>
    </div>
  `).join('');
}

window.showAnnouncementModal = async function() {
  const { collection, query, where, orderBy, getDocs, db } = window.FB;
  const modal = document.getElementById('announcementModal');
  if (modal) modal.classList.remove('hidden');
  const listEl = document.getElementById('announcementFullList');
  if (listEl) listEl.innerHTML = '<div class="skeleton-item"></div>';
  try {
    const q = query(
      collection(db, 'announcements'),
      where('isActive', '==', true),
      orderBy('isPinned', 'desc'),
      orderBy('createdAt', 'desc')
    );
    const snap = await getDocs(q);
    const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderAnnouncements(items, 'announcementFullList');
  } catch {
    if (listEl) listEl.innerHTML = '<div class="empty-state">불러오기 실패</div>';
  }
};

window.showAnnouncementDetail = function(id) {
  // 추후 상세 구현
};

// ===== 최근 거래 =====
async function loadRecentTransactions() {
  const { collection, query, where, orderBy, getDocs, limit, db } = window.FB;
  try {
    const q = query(
      collection(db, 'transactions'),
      where('userId', '==', currentUser.uid),
      orderBy('createdAt', 'desc'),
      limit(3)
    );
    const snap = await getDocs(q);
    renderTxList(snap.docs.map(d => ({ id: d.id, ...d.data() })), 'recentTxList');
  } catch (err) {
    const el = document.getElementById('recentTxList');
    if (el) el.innerHTML = '<div class="empty-state">거래 내역이 없습니다</div>';
  }
}

function renderTxList(txs, containerId) {
  const el = document.getElementById(containerId);
  if (!el) return;
  if (!txs.length) {
    el.innerHTML = '<div class="empty-state"><i class="fas fa-receipt"></i>거래 내역이 없습니다</div>';
    return;
  }
  const icons = { deposit: '⬇️', withdrawal: '⬆️', bonus: '🎁', invest: '📈', game: '🎮' };
  const statusTxt = { pending: '승인 대기', approved: '완료', rejected: '거부됨' };

  el.innerHTML = txs.map(tx => {
    const isPlus = ['deposit', 'bonus'].includes(tx.type);
    return `
    <div class="tx-item">
      <div class="tx-icon ${tx.type}">${icons[tx.type] || '💱'}</div>
      <div class="tx-info">
        <div class="tx-title">${getTxTypeName(tx.type)}</div>
        <div class="tx-date">${fmtDate(tx.createdAt)}</div>
      </div>
      <div>
        <div class="tx-amount ${isPlus ? 'plus' : 'minus'}">
          ${isPlus ? '+' : '-'}${fmt(tx.amount)} ${tx.currency || 'USDT'}
        </div>
        <div class="tx-status">${statusTxt[tx.status] || tx.status}</div>
      </div>
    </div>`;
  }).join('');
}

// ===== More 페이지 =====
function loadMorePage() {
  if (!userData || !walletData) return;

  const setEl = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };

  setEl('profileName', userData.name || '-');
  setEl('profileEmail', userData.email || '-');
  const rankEl = document.getElementById('profileRank');
  if (rankEl) rankEl.innerHTML = `<i class="fas fa-star" style="font-size:10px"></i> ${userData.rank || 'G0'}`;

  const dedra = walletData.dedraBalance || 0;
  const dedraUsd = dedra * deedraPrice;
  setEl('moreWalletUsdt', fmt(walletData.usdtBalance || 0));
  setEl('moreWalletDedra', fmt(dedra));
  setEl('moreWalletDedraUsd', '≈ $' + fmt(dedraUsd));
  setEl('moreWalletBonus', fmt(walletData.bonusBalance || 0));

  // 다크모드 토글 동기화
  const toggle = document.getElementById('darkModeToggle');
  if (toggle) toggle.className = currentTheme === 'dark' ? 'menu-item-toggle on' : 'menu-item-toggle';

  loadTxHistory('all');
}

async function loadTxHistory(typeFilter) {
  const { collection, query, where, orderBy, getDocs, limit, db } = window.FB;
  const listEl = document.getElementById('txHistoryList');
  if (listEl) listEl.innerHTML = '<div class="skeleton-item"></div><div class="skeleton-item"></div>';

  try {
    let q;
    if (typeFilter === 'all') {
      q = query(collection(db, 'transactions'), where('userId', '==', currentUser.uid), orderBy('createdAt', 'desc'), limit(30));
    } else {
      q = query(collection(db, 'transactions'), where('userId', '==', currentUser.uid), where('type', '==', typeFilter), orderBy('createdAt', 'desc'), limit(30));
    }
    const snap = await getDocs(q);
    renderTxList(snap.docs.map(d => ({ id: d.id, ...d.data() })), 'txHistoryList');
  } catch (err) {
    if (listEl) listEl.innerHTML = '<div class="empty-state">불러오기 실패</div>';
  }
}

window.switchTxTab = function(type, el) {
  document.querySelectorAll('.tx-tab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  loadTxHistory(type);
};

// ===== 입금 신청 =====
window.showDepositModal = function() {
  loadCompanyWallet();
  document.getElementById('depositModal').classList.remove('hidden');
};

async function loadCompanyWallet() {
  try {
    const { doc, getDoc, db } = window.FB;
    const snap = await getDoc(doc(db, 'settings', 'wallets'));
    const addr = document.getElementById('companyWalletAddr');
    if (snap.exists() && addr) addr.textContent = snap.data().trc20 || '주소 미설정 (관리자 문의)';
  } catch {
    const addr = document.getElementById('companyWalletAddr');
    if (addr) addr.textContent = '주소 로드 실패';
  }
}

window.copyWalletAddress = function() {
  const addr = document.getElementById('companyWalletAddr');
  if (addr) navigator.clipboard.writeText(addr.textContent).then(() => showToast('주소가 복사되었습니다!', 'success'));
};

window.submitDeposit = async function() {
  const amount = parseFloat(document.getElementById('depositAmount').value);
  const txid = document.getElementById('depositTxid').value.trim();
  const memo = document.getElementById('depositMemo').value.trim();

  if (!amount || amount <= 0) { showToast('입금 금액을 입력하세요.', 'warning'); return; }
  if (!txid) { showToast('TXID를 입력하세요.', 'warning'); return; }

  const btn = event.target;
  btn.disabled = true; btn.textContent = '처리중...';

  try {
    const { addDoc, collection, db, serverTimestamp } = window.FB;
    await addDoc(collection(db, 'transactions'), {
      userId: currentUser.uid, userEmail: currentUser.email,
      type: 'deposit', amount, currency: 'USDT', txid, memo,
      status: 'pending', createdAt: serverTimestamp(),
    });
    closeModal('depositModal');
    showToast('입금 신청 완료! 관리자 승인을 기다려주세요.', 'success');
    document.getElementById('depositAmount').value = '';
    document.getElementById('depositTxid').value = '';
  } catch (err) {
    showToast('신청 실패: ' + err.message, 'error');
  } finally {
    btn.disabled = false; btn.textContent = '입금 신청';
  }
};

// ===== 출금 신청 =====
window.showWithdrawModal = function() {
  const avEl = document.getElementById('withdrawAvailable');
  if (avEl) avEl.textContent = fmt(walletData?.dedraBalance || 0);
  document.getElementById('withdrawModal').classList.remove('hidden');
};

window.submitWithdraw = async function() {
  const amount = parseFloat(document.getElementById('withdrawAmount').value);
  const address = document.getElementById('withdrawAddress').value.trim();
  const pin = document.getElementById('withdrawPin').value;

  if (!amount || amount <= 0) { showToast('출금 금액을 입력하세요.', 'warning'); return; }
  if (!address) { showToast('출금 주소를 입력하세요.', 'warning'); return; }
  if (!pin || pin.length !== 6) { showToast('출금 PIN 6자리를 입력하세요.', 'warning'); return; }
  if ((walletData?.dedraBalance || 0) < amount) { showToast('잔액이 부족합니다.', 'error'); return; }
  if (userData?.withdrawPin && userData.withdrawPin !== btoa(pin)) { showToast('출금 PIN이 올바르지 않습니다.', 'error'); return; }

  const btn = event.target;
  btn.disabled = true; btn.textContent = '처리중...';

  try {
    const { addDoc, collection, db, serverTimestamp } = window.FB;
    await addDoc(collection(db, 'transactions'), {
      userId: currentUser.uid, userEmail: currentUser.email,
      type: 'withdrawal', amount, currency: 'DEEDRA', walletAddress: address,
      status: 'pending', createdAt: serverTimestamp(),
    });
    closeModal('withdrawModal');
    showToast('출금 신청 완료! 처리까지 1~3 영업일 소요됩니다.', 'success');
    document.getElementById('withdrawAmount').value = '';
    document.getElementById('withdrawAddress').value = '';
    document.getElementById('withdrawPin').value = '';
  } catch (err) {
    showToast('신청 실패: ' + err.message, 'error');
  } finally {
    btn.disabled = false; btn.textContent = '출금 신청';
  }
};

// ===== 투자 페이지 =====
async function loadInvestPage() {
  loadProducts();
  loadMyInvestments();
  loadSimulatorOptions();
}

async function loadProducts() {
  const { collection, query, where, orderBy, getDocs, db } = window.FB;
  const listEl = document.getElementById('productList');
  if (listEl) listEl.innerHTML = '<div class="skeleton-item tall"></div><div class="skeleton-item tall"></div>';
  try {
    const q = query(collection(db, 'products'), where('isActive', '==', true), orderBy('minAmount', 'asc'));
    const snap = await getDocs(q);
    productsCache = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    if (!productsCache.length) {
      if (listEl) listEl.innerHTML = '<div class="empty-state"><i class="fas fa-box-open"></i>투자 상품이 없습니다</div>';
      return;
    }

    const tierMap = { 'Basic': 'basic', 'Standard': 'standard', 'Premium': 'premium', 'VIP': 'vip' };
    const tagMap = { 'Basic': 'tag-basic', 'Standard': 'tag-standard', 'Premium': 'tag-premium', 'VIP': 'tag-vip' };

    if (listEl) listEl.innerHTML = productsCache.map(p => {
      const tier = tierMap[p.name] || 'basic';
      const tag = tagMap[p.name] || 'tag-basic';
      const earning = (p.minAmount * p.roiPercent / 100) / deedraPrice;
      return `
      <div class="product-card">
        <div class="product-tier-bar tier-${tier}"></div>
        <div class="product-top">
          <div>
            <div class="product-name">${p.name}</div>
            <span class="product-tag ${tag}">${p.name}</span>
          </div>
          <div class="product-roi-block">
            <div class="product-roi">${p.roiPercent}%</div>
            <div class="product-roi-label">수익률</div>
          </div>
        </div>
        <div class="product-meta">
          <div class="product-meta-item">기간: <strong>${p.durationDays}일</strong></div>
          <div class="product-meta-item">최소: <strong>$${fmt(p.minAmount)}</strong></div>
          <div class="product-meta-item">최대: <strong>$${fmt(p.maxAmount)}</strong></div>
        </div>
        <div class="product-conversion">
          💡 $${fmt(p.minAmount)} 투자 시 <strong>~${fmt(earning)} DEEDRA</strong> 수익
          (≈ $${fmt(earning * deedraPrice)})
        </div>
        <button class="invest-btn" onclick="openInvestModal('${p.id}','${p.name}',${p.roiPercent},${p.durationDays},${p.minAmount},${p.maxAmount})">
          투자하기
        </button>
      </div>`;
    }).join('');
  } catch (err) {
    console.warn(err);
    if (listEl) listEl.innerHTML = '<div class="empty-state">불러오기 실패</div>';
  }
}

function loadSimulatorOptions() {
  const sel = document.getElementById('simProduct');
  if (!sel || !productsCache.length) return;
  sel.innerHTML = '<option value="">상품 선택</option>';
  productsCache.forEach(p => {
    sel.innerHTML += `<option value="${p.id}" data-roi="${p.roiPercent}" data-days="${p.durationDays}" data-min="${p.minAmount}" data-max="${p.maxAmount}">${p.name} (${p.roiPercent}% / ${p.durationDays}일)</option>`;
  });
}

window.runSimulator = function() {
  const sel = document.getElementById('simProduct');
  const amtEl = document.getElementById('simAmount');
  const result = document.getElementById('simResult');
  if (!sel || !amtEl || !result) return;

  const opt = sel.options[sel.selectedIndex];
  const amount = parseFloat(amtEl.value);
  if (!opt.dataset.roi || !amount || isNaN(amount)) {
    result.classList.remove('show'); return;
  }

  const roi = parseFloat(opt.dataset.roi);
  const days = parseInt(opt.dataset.days);
  const earning = (amount * roi / 100);
  const earningDedra = earning / deedraPrice;

  const setEl = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  setEl('simInputAmount', '$' + fmt(amount));
  setEl('simDays', days + '일');
  setEl('simRoi', roi + '%');
  setEl('simEarning', fmt(earningDedra) + ' DEEDRA');
  setEl('simEarningUsd', '≈ $' + fmt(earning));

  result.classList.add('show');
};

async function loadMyInvestments() {
  const { collection, query, where, orderBy, getDocs, db } = window.FB;
  const listEl = document.getElementById('myInvestList');
  const sumItems = { count: 0, total: 0, returns: 0 };
  if (listEl) listEl.innerHTML = '<div class="skeleton-item"></div>';

  try {
    const q = query(
      collection(db, 'investments'),
      where('userId', '==', currentUser.uid),
      where('status', '==', 'active'),
      orderBy('startDate', 'desc')
    );
    const snap = await getDocs(q);
    const invests = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    invests.forEach(inv => {
      sumItems.count++;
      sumItems.total += inv.amount || 0;
      sumItems.returns += inv.expectedReturn || 0;
    });

    const setEl = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    setEl('activeInvestCount', sumItems.count + '건');
    setEl('totalInvestAmount', '$' + fmt(sumItems.total));
    setEl('expectedReturn', fmt(sumItems.returns) + ' DEEDRA');

    if (!invests.length) {
      if (listEl) listEl.innerHTML = '<div class="empty-state"><i class="fas fa-chart-line"></i>진행 중인 투자가 없습니다</div>';
      return;
    }

    if (listEl) listEl.innerHTML = invests.map(inv => {
      const start = inv.startDate?.toDate ? inv.startDate.toDate() : new Date();
      const end = inv.endDate?.toDate ? inv.endDate.toDate() : new Date();
      const now = new Date();
      const progress = Math.min(100, ((now - start) / (end - start)) * 100);
      const remainDays = Math.max(0, Math.ceil((end - now) / 86400000));

      return `
      <div class="invest-item">
        <div class="invest-item-header">
          <span class="invest-item-name">${inv.productName || '투자'}</span>
          <span class="invest-item-amount">$${fmt(inv.amount)}</span>
        </div>
        <div class="invest-item-detail">
          수익: +${fmt(inv.expectedReturn || 0)} DEEDRA · 잔여 ${remainDays}일
        </div>
        <div class="invest-progress">
          <div class="invest-progress-fill" style="width:${progress.toFixed(1)}%"></div>
        </div>
      </div>`;
    }).join('');

  } catch (err) {
    console.warn(err);
    if (listEl) listEl.innerHTML = '<div class="empty-state">불러오기 실패</div>';
  }
}

window.openInvestModal = function(id, name, roi, days, minAmt, maxAmt) {
  selectedProduct = { id, name, roi, days, minAmt, maxAmt };

  const sumEl = document.getElementById('investProductSummary');
  if (sumEl) sumEl.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
      <div style="font-size:18px;font-weight:800;color:var(--text)">${name}</div>
      <div style="font-size:24px;font-weight:900;color:var(--green)">${roi}%</div>
    </div>
    <div style="font-size:13px;color:var(--text2)">
      기간: <strong>${days}일</strong> · 최소 $${fmt(minAmt)} ~ 최대 $${fmt(maxAmt)}
    </div>`;

  const hintEl = document.getElementById('investAmountHint');
  if (hintEl) hintEl.textContent = `최소 $${fmt(minAmt)} ~ 최대 $${fmt(maxAmt)}`;

  const amtEl = document.getElementById('investAmount');
  if (amtEl) amtEl.value = '';
  const previewEl = document.getElementById('investPreview');
  if (previewEl) previewEl.style.display = 'none';

  document.getElementById('investModal').classList.remove('hidden');
};

window.updateInvestPreview = function() {
  if (!selectedProduct) return;
  const amount = parseFloat(document.getElementById('investAmount').value);
  const previewEl = document.getElementById('investPreview');
  if (!previewEl || !amount || isNaN(amount)) { if (previewEl) previewEl.style.display = 'none'; return; }

  const earning = (amount * selectedProduct.roi / 100) / deedraPrice;
  previewEl.style.display = 'block';
  previewEl.innerHTML = `
    📌 예상 수익: <strong style="color:var(--green)">${fmt(earning)} DEEDRA</strong><br>
    💵 USD 환산: ~$${fmt(earning * deedraPrice)}<br>
    📅 만기일: ${getDaysLaterStr(selectedProduct.days)}`;
};

window.submitInvest = async function() {
  if (!selectedProduct) return;
  const amount = parseFloat(document.getElementById('investAmount').value);

  if (!amount || amount <= 0) { showToast('투자 금액을 입력하세요.', 'warning'); return; }
  if (amount < selectedProduct.minAmt) { showToast(`최소 투자금은 $${selectedProduct.minAmt}입니다.`, 'warning'); return; }
  if (amount > selectedProduct.maxAmt) { showToast(`최대 투자금은 $${selectedProduct.maxAmt}입니다.`, 'warning'); return; }
  if ((walletData?.usdtBalance || 0) < amount) { showToast('USDT 잔액이 부족합니다.', 'error'); return; }

  const btn = event.target;
  btn.disabled = true; btn.textContent = '처리중...';

  try {
    const { addDoc, collection, db, serverTimestamp } = window.FB;
    const startDate = new Date();
    const endDate = new Date(startDate.getTime() + selectedProduct.days * 86400000);
    const expectedReturn = (amount * selectedProduct.roi / 100) / deedraPrice;

    await addDoc(collection(db, 'investments'), {
      userId: currentUser.uid, productId: selectedProduct.id,
      productName: selectedProduct.name, amount,
      roiPercent: selectedProduct.roi, durationDays: selectedProduct.days,
      expectedReturn, status: 'active',
      startDate: serverTimestamp(), endDate,
      createdAt: serverTimestamp(),
    });

    closeModal('investModal');
    showToast('투자 신청 완료! 🎉', 'success');
    loadMyInvestments();
  } catch (err) {
    showToast('신청 실패: ' + err.message, 'error');
  } finally {
    btn.disabled = false; btn.textContent = '투자 신청';
  }
};

// ===== 네트워크 페이지 =====
async function loadNetworkPage() {
  if (!userData) return;

  const setEl = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };

  setEl('myReferralCode', userData.referralCode || '-');
  updateRankUI();
  loadReferralList();
  buildOrgTree();
}

function updateRankUI() {
  if (!userData) return;
  const rank = userData.rank || 'G0';
  const refCount = userData.referralCount || 0;
  const rankIdx = RANKS.findIndex(r => r.rank === rank);
  const nextRank = RANKS[rankIdx + 1];

  const setEl = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  setEl('rankCurrent', rank);
  setEl('rankReferralCount', refCount);

  if (nextRank) {
    const progress = Math.min(100, (refCount / nextRank.minRefs) * 100);
    setEl('rankNextLabel', `${nextRank.rank} (${nextRank.minRefs - refCount}명 필요)`);
    const fill = document.getElementById('rankProgressFill');
    if (fill) fill.style.width = progress.toFixed(1) + '%';
  } else {
    setEl('rankNextLabel', '최고 직급 달성! 🏆');
    const fill = document.getElementById('rankProgressFill');
    if (fill) fill.style.width = '100%';
  }
}

async function loadReferralList() {
  const { collection, query, where, orderBy, getDocs, db } = window.FB;
  const listEl = document.getElementById('referralList');
  const netBonus = document.getElementById('netBonus');
  const netDirect = document.getElementById('netDirectCount');
  if (listEl) listEl.innerHTML = '<div class="skeleton-item"></div><div class="skeleton-item"></div>';

  try {
    const q = query(
      collection(db, 'users'),
      where('referredBy', '==', currentUser.uid),
      orderBy('createdAt', 'desc')
    );
    const snap = await getDocs(q);
    const refs = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    if (netDirect) netDirect.textContent = refs.length;
    if (netBonus) netBonus.textContent = '$' + fmt(walletData?.totalEarnings || 0);

    const setEl = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    setEl('rankReferralCount', refs.length);

    if (!refs.length) {
      if (listEl) listEl.innerHTML = '<div class="empty-state"><i class="fas fa-user-friends"></i>추천인이 없습니다</div>';
      return;
    }

    if (listEl) listEl.innerHTML = refs.map(r => `
      <div class="referral-item">
        <div class="ref-avatar"><i class="fas fa-user"></i></div>
        <div class="ref-info">
          <div class="ref-name">${r.name || '이름 없음'}</div>
          <div class="ref-date">${fmtDate(r.createdAt)}</div>
        </div>
        <div class="ref-rank">${r.rank || 'G0'}</div>
      </div>`).join('');

  } catch (err) {
    if (listEl) listEl.innerHTML = '<div class="empty-state">불러오기 실패</div>';
  }
}

async function buildOrgTree() {
  const treeEl = document.getElementById('orgTree');
  if (!treeEl) return;
  treeEl.innerHTML = '<div class="empty-state"><i class="fas fa-spinner fa-spin"></i>로딩 중...</div>';

  try {
    const { collection, query, where, getDocs, db } = window.FB;
    const q = query(collection(db, 'users'), where('referredBy', '==', currentUser.uid));
    const snap = await getDocs(q);
    const children = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    if (!children.length) {
      treeEl.innerHTML = `
        <div style="text-align:center;padding:30px">
          <div class="org-node me" style="display:inline-block">
            <div class="org-node-name">${userData?.name || '나'}</div>
            <div class="org-node-rank">${userData?.rank || 'G0'}</div>
          </div>
          <div style="margin-top:16px;font-size:13px;color:var(--text3)">
            추천 링크를 공유하여 네트워크를 확장해보세요!
          </div>
        </div>`;
      return;
    }

    const meNode = `
      <div class="org-node-wrap">
        <div class="org-node root" onclick="showOrgTooltip(event, '${userData?.name}', '${userData?.rank}', '나', '')">
          <div class="org-node-name">${userData?.name || '나'}</div>
          <div class="org-node-rank">${userData?.rank || 'G0'}</div>
        </div>
        <div class="org-connector-v"></div>
      </div>`;

    const childNodes = children.map(c => `
      <div class="org-node-wrap">
        <div class="org-connector-v" style="height:12px"></div>
        <div class="org-node" onclick="showOrgTooltip(event, '${c.name}', '${c.rank}', '추천인', '${fmtDateShort(c.createdAt)}')">
          <div class="org-node-name">${c.name || '회원'}</div>
          <div class="org-node-rank">${c.rank || 'G0'}</div>
        </div>
      </div>`).join('');

    treeEl.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;gap:0">
        ${meNode}
        <div style="display:flex;gap:16px;flex-wrap:wrap;justify-content:center">
          ${childNodes}
        </div>
      </div>`;

    setupOrgPanZoom();

  } catch (err) {
    treeEl.innerHTML = '<div class="empty-state">조직도 로드 실패</div>';
  }
}

window.showOrgTooltip = function(event, name, rank, relation, date) {
  const tooltip = document.getElementById('orgTooltip');
  if (!tooltip) return;
  tooltip.innerHTML = `
    <div style="font-weight:700;margin-bottom:4px">${name}</div>
    <div style="color:var(--accent);font-size:12px">${rank} · ${relation}</div>
    ${date ? `<div style="color:var(--text3);font-size:11px;margin-top:2px">가입: ${date}</div>` : ''}`;
  tooltip.style.left = Math.min(event.clientX - 10, window.innerWidth - 220) + 'px';
  tooltip.style.top = (event.clientY + 12) + 'px';
  tooltip.classList.remove('hidden');
  setTimeout(() => tooltip.classList.add('hidden'), 3000);
};

function setupOrgPanZoom() {
  const wrap = document.getElementById('orgChartWrap');
  const tree = document.getElementById('orgTree');
  if (!wrap || !tree) return;

  let scale = 1, startDist = 0, isDragging = false;
  let startX = 0, startY = 0, scrollLeft = 0, scrollTop = 0;

  wrap.addEventListener('mousedown', e => {
    isDragging = true;
    startX = e.pageX - wrap.offsetLeft;
    startY = e.pageY - wrap.offsetTop;
    scrollLeft = wrap.scrollLeft;
    scrollTop = wrap.scrollTop;
  });
  wrap.addEventListener('mousemove', e => {
    if (!isDragging) return;
    wrap.scrollLeft = scrollLeft - (e.pageX - wrap.offsetLeft - startX);
    wrap.scrollTop = scrollTop - (e.pageY - wrap.offsetTop - startY);
  });
  wrap.addEventListener('mouseup', () => { isDragging = false; });

  wrap.addEventListener('touchstart', e => {
    if (e.touches.length === 2) {
      startDist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
    }
  }, { passive: true });

  wrap.addEventListener('touchmove', e => {
    if (e.touches.length === 2) {
      const dist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      scale = Math.min(2, Math.max(0.4, scale * (dist / startDist)));
      tree.style.transform = `scale(${scale})`;
      startDist = dist;
    }
  }, { passive: true });
}

window.resetOrgZoom = function() {
  const tree = document.getElementById('orgTree');
  if (tree) tree.style.transform = 'scale(1)';
};

window.copyReferralCode = function() {
  const code = document.getElementById('myReferralCode');
  if (code) navigator.clipboard.writeText(code.textContent).then(() => showToast('추천 코드 복사 완료!', 'success'));
};

window.shareReferralLink = function() {
  const code = userData?.referralCode || '';
  const url = location.origin + '?ref=' + code;
  if (navigator.share) {
    navigator.share({ title: 'DEEDRA 투자앱 초대', text: '추천 코드: ' + code, url });
  } else {
    navigator.clipboard.writeText(url).then(() => showToast('초대 링크 복사 완료!', 'success'));
  }
};

// ===== 게임 =====
function updateGameUI() {
  const setEl = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  setEl('gameBalance', fmt(gameBalanceVal));
  setEl('gameBalanceUsd', '≈ $' + fmt(gameBalanceVal * deedraPrice));
}

window.chargeGameWallet = function() {
  const avEl = document.getElementById('chargeAvailable');
  if (avEl) avEl.textContent = fmt(walletData?.dedraBalance || 0);
  document.getElementById('chargeModal').classList.remove('hidden');
};

window.submitCharge = function() {
  const amount = parseFloat(document.getElementById('chargeAmount').value);
  if (!amount || amount <= 0) { showToast('충전 금액을 입력하세요.', 'warning'); return; }
  if ((walletData?.dedraBalance || 0) < amount) { showToast('잔액이 부족합니다.', 'error'); return; }
  gameBalanceVal += amount;
  walletData.dedraBalance -= amount;
  closeModal('chargeModal');
  updateGameUI();
  showToast(fmt(amount) + ' DEEDRA 충전 완료!', 'success');
  document.getElementById('chargeAmount').value = '';
};

window.startGame = function(type) {
  if (gameBalanceVal <= 0) {
    showToast('게임 지갑을 먼저 충전해주세요.', 'warning');
    chargeGameWallet();
    return;
  }
  closeAllGames();
  const gameMap = { oddeven: 'gameOddEven', dice: 'gameDice', slot: 'gameSlot' };
  const el = document.getElementById(gameMap[type]);
  if (el) el.classList.remove('hidden');

  // 슬라이더 최대값 설정
  const slider = document.getElementById(type === 'oddeven' ? 'oeBetSlider' : type === 'dice' ? 'diceBetSlider' : 'slotBetSlider');
  if (slider) slider.max = Math.floor(gameBalanceVal);
};

function closeAllGames() {
  ['gameOddEven', 'gameDice', 'gameSlot'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.add('hidden');
  });
}

window.closeGame = function() {
  closeAllGames();
  ['oeResult', 'diceResult', 'slotResult'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.classList.add('hidden'); el.className = 'game-result hidden'; }
  });
};

window.updateBetDisplay = function(type, val) {
  val = parseInt(val);
  if (type === 'oe') { oeBetVal = val; const el = document.getElementById('oeCurrentBet'); if (el) el.textContent = val; }
  else if (type === 'dice') { diceBetVal = val; const el = document.getElementById('diceCurrentBet'); if (el) el.textContent = val; }
  else if (type === 'slot') { slotBetVal = val; const el = document.getElementById('slotCurrentBet'); if (el) el.textContent = val; }
};

window.setBetAmount = function(type, val) {
  val = Math.min(val, gameBalanceVal);
  if (type === 'oe') { oeBetVal = val; const el = document.getElementById('oeCurrentBet'); if (el) el.textContent = val; }
  else if (type === 'dice') { diceBetVal = val; const el = document.getElementById('diceCurrentBet'); if (el) el.textContent = val; }
  else if (type === 'slot') { slotBetVal = val; const el = document.getElementById('slotCurrentBet'); if (el) el.textContent = val; }
};

window.setBetGameHalf = function(type) {
  const half = Math.floor(gameBalanceVal / 2);
  setBetAmount(type, half);
};

window.playOddEven = function(choice) {
  if (gameBalanceVal < oeBetVal) { showToast('잔액 부족', 'error'); return; }
  const result = Math.random() < 0.5 ? 'odd' : 'even';
  const win = choice === result;
  gameBalanceVal = win ? gameBalanceVal + oeBetVal : gameBalanceVal - oeBetVal;
  updateGameUI();

  const el = document.getElementById('oeResult');
  if (el) {
    el.className = 'game-result ' + (win ? 'win' : 'lose');
    el.textContent = (win ? '🎉 승리! +' : '😢 패배 -') + oeBetVal + ' DEEDRA · 결과: ' + (result === 'odd' ? '홀' : '짝');
    el.classList.remove('hidden');
  }
  logGame('홀짝', win, oeBetVal);
};

window.playDice = function(chosenNum) {
  if (gameBalanceVal < diceBetVal) { showToast('잔액 부족', 'error'); return; }
  const result = Math.ceil(Math.random() * 6);
  const win = chosenNum === result;
  gameBalanceVal = win ? gameBalanceVal + diceBetVal * 5 : gameBalanceVal - diceBetVal;
  updateGameUI();

  const diceEl = document.getElementById('diceDisplay');
  if (diceEl) diceEl.textContent = DICE_FACES[result];

  const el = document.getElementById('diceResult');
  if (el) {
    el.className = 'game-result ' + (win ? 'win' : 'lose');
    el.textContent = (win ? '🎉 적중! +' + diceBetVal * 5 : '😢 빗나감 -' + diceBetVal) + ' DEEDRA · 나온 숫자: ' + result;
    el.classList.remove('hidden');
  }
  logGame('주사위', win, diceBetVal);
};

window.playSpin = function() {
  if (gameBalanceVal < slotBetVal) { showToast('잔액 부족', 'error'); return; }

  const spinBtn = document.getElementById('spinBtn');
  if (spinBtn) { spinBtn.disabled = true; spinBtn.textContent = '🎰 스피닝...'; }

  const reels = ['reel1', 'reel2', 'reel3'].map(id => document.getElementById(id));
  reels.forEach(r => { if (r) r.classList.add('spinning'); });

  setTimeout(() => {
    const result = [0,1,2].map(() => SLOT_SYMBOLS[Math.floor(Math.random() * SLOT_SYMBOLS.length)]);
    reels.forEach((r, i) => { if (r) { r.textContent = result[i]; r.classList.remove('spinning'); } });

    let multiplier = 0;
    if (result[0] === result[1] && result[1] === result[2]) {
      multiplier = result[0] === '💎' ? 50 : result[0] === '7️⃣' ? 20 : result[0] === '⭐' ? 10 : 5;
    } else if (result[0] === result[1] || result[1] === result[2]) {
      multiplier = 0;
    }

    const win = multiplier > 0;
    const earned = win ? slotBetVal * multiplier : 0;
    gameBalanceVal = win ? gameBalanceVal + earned : gameBalanceVal - slotBetVal;
    updateGameUI();

    const el = document.getElementById('slotResult');
    if (el) {
      el.className = 'game-result ' + (win ? 'win' : 'lose');
      el.textContent = win ? `🎉 잭팟! ${multiplier}배 +${earned} DEEDRA` : `😢 꽝 -${slotBetVal} DEEDRA`;
      el.classList.remove('hidden');
    }
    if (spinBtn) { spinBtn.disabled = false; spinBtn.innerHTML = '<i class="fas fa-play"></i> 스핀!'; }
    logGame('슬롯머신', win, slotBetVal);
  }, 1200);
};

function logGame(gameName, win, bet) {
  const listEl = document.getElementById('gameLogList');
  if (!listEl) return;

  const emptyEl = listEl.querySelector('.empty-state');
  if (emptyEl) emptyEl.remove();

  const item = document.createElement('div');
  item.className = 'tx-item';
  item.innerHTML = `
    <div class="tx-icon game">${win ? '🎉' : '😢'}</div>
    <div class="tx-info">
      <div class="tx-title">${gameName} ${win ? '승리' : '패배'}</div>
      <div class="tx-date">${new Date().toLocaleTimeString('ko-KR')}</div>
    </div>
    <div class="tx-amount ${win ? 'plus' : 'minus'}">
      ${win ? '+' : '-'}${fmt(bet)} DEEDRA
    </div>`;
  listEl.insertBefore(item, listEl.firstChild);
}

// ===== 마이페이지 (More 탭 내) =====
window.showProfileEdit = function() {
  if (!userData) return;
  const nameEl = document.getElementById('editName');
  const phoneEl = document.getElementById('editPhone');
  if (nameEl) nameEl.value = userData.name || '';
  if (phoneEl) phoneEl.value = userData.phone || '';
  document.getElementById('profileModal').classList.remove('hidden');
};

window.saveProfile = async function() {
  const name = document.getElementById('editName').value.trim();
  const phone = document.getElementById('editPhone').value.trim();
  if (!name) { showToast('이름을 입력하세요.', 'warning'); return; }

  const btn = event.target;
  btn.disabled = true; btn.textContent = '저장 중...';
  try {
    const { doc, updateDoc, db } = window.FB;
    await updateDoc(doc(db, 'users', currentUser.uid), { name, phone });
    userData.name = name; userData.phone = phone;
    closeModal('profileModal');
    showToast('프로필이 저장되었습니다.', 'success');
    loadMorePage();
    updateHomeUI();
  } catch (err) {
    showToast('저장 실패: ' + err.message, 'error');
  } finally {
    btn.disabled = false; btn.textContent = '저장';
  }
};

window.showPasswordChange = function() {
  showToast('비밀번호 변경 이메일을 발송했습니다.', 'info');
  const { sendPasswordResetEmail, auth } = window.FB;
  if (currentUser) sendPasswordResetEmail(auth, currentUser.email).catch(() => {});
};

window.showWithdrawPinSetup = function() {
  document.getElementById('newPin').value = '';
  document.getElementById('confirmPin').value = '';
  document.getElementById('pinModal').classList.remove('hidden');
};

window.saveWithdrawPin = async function() {
  const pin = document.getElementById('newPin').value;
  const confirm = document.getElementById('confirmPin').value;
  if (!pin || pin.length !== 6) { showToast('6자리 PIN을 입력하세요.', 'warning'); return; }
  if (pin !== confirm) { showToast('PIN이 일치하지 않습니다.', 'error'); return; }
  if (!/^\d{6}$/.test(pin)) { showToast('숫자 6자리를 입력하세요.', 'warning'); return; }

  const btn = event.target;
  btn.disabled = true;
  try {
    const { doc, updateDoc, db } = window.FB;
    await updateDoc(doc(db, 'users', currentUser.uid), { withdrawPin: btoa(pin) });
    userData.withdrawPin = btoa(pin);
    closeModal('pinModal');
    showToast('출금 PIN이 설정되었습니다.', 'success');
  } catch (err) {
    showToast('설정 실패: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
  }
};

window.showTickets = async function() {
  const { collection, query, where, orderBy, getDocs, db } = window.FB;
  document.getElementById('ticketModal').classList.remove('hidden');
  const listEl = document.getElementById('ticketList');
  if (listEl) listEl.innerHTML = '<div class="skeleton-item"></div>';

  try {
    const q = query(
      collection(db, 'tickets'),
      where('userId', '==', currentUser.uid),
      orderBy('createdAt', 'desc')
    );
    const snap = await getDocs(q);
    const tickets = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    if (!tickets.length) {
      if (listEl) listEl.innerHTML = '<div class="empty-state">문의 내역이 없습니다</div>';
      return;
    }
    if (listEl) listEl.innerHTML = tickets.map(t => `
      <div class="ticket-item">
        <div class="ticket-title">${t.title}</div>
        <div class="ticket-meta">${fmtDate(t.createdAt)}</div>
        <span class="ticket-status-badge ${t.status === 'closed' ? 'ticket-closed' : 'ticket-open'}">
          ${t.status === 'closed' ? '답변 완료' : '처리 중'}
        </span>
      </div>`).join('');
  } catch (err) {
    if (listEl) listEl.innerHTML = '<div class="empty-state">불러오기 실패</div>';
  }
};

window.submitTicket = async function() {
  const title = document.getElementById('ticketTitle').value.trim();
  const content = document.getElementById('ticketContent').value.trim();
  if (!title || !content) { showToast('제목과 내용을 입력하세요.', 'warning'); return; }

  const btn = event.target;
  btn.disabled = true; btn.textContent = '등록 중...';
  try {
    const { addDoc, collection, db, serverTimestamp } = window.FB;
    await addDoc(collection(db, 'tickets'), {
      userId: currentUser.uid, userEmail: currentUser.email,
      title, content, status: 'open', createdAt: serverTimestamp(),
    });
    document.getElementById('ticketTitle').value = '';
    document.getElementById('ticketContent').value = '';
    closeModal('ticketModal');
    showToast('문의가 등록되었습니다.', 'success');
  } catch (err) {
    showToast('등록 실패: ' + err.message, 'error');
  } finally {
    btn.disabled = false; btn.textContent = '문의 등록';
  }
};

window.showNotifications = function() {
  showToast('새 알림이 없습니다.', 'info');
};

// ===== 모달 =====
window.closeModal = function(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add('hidden');
};

// ===== 유틸 =====
function generateReferralCode(uid) {
  return 'DD' + uid.substring(0, 6).toUpperCase();
}

async function findUserByReferralCode(code) {
  const { collection, query, where, getDocs, db } = window.FB;
  try {
    const q = query(collection(db, 'users'), where('referralCode', '==', code));
    const snap = await getDocs(q);
    return snap.empty ? null : snap.docs[0].data();
  } catch { return null; }
}

function fmt(n) {
  if (n === undefined || n === null || isNaN(n)) return '0.00';
  return parseFloat(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtInt(n) {
  if (!n) return '0';
  return Math.round(n).toLocaleString('ko-KR');
}

function fmtDate(ts) {
  if (!ts) return '-';
  try {
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString('ko-KR', { year: '2-digit', month: '2-digit', day: '2-digit' }) +
           ' ' + d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
  } catch { return '-'; }
}

function fmtDateShort(d) {
  try {
    const dt = d?.toDate ? d.toDate() : d instanceof Date ? d : new Date(d);
    return dt.toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' });
  } catch { return '-'; }
}

function getDaysLaterStr(days) {
  const d = new Date(Date.now() + days * 86400000);
  return fmtDateShort(d);
}

function getTxTypeName(type) {
  const map = { deposit: 'USDT 입금', withdrawal: 'DEEDRA 출금', bonus: '보너스 지급', invest: '투자 신청', game: '게임', referral: '추천 보너스' };
  return map[type] || type;
}

function getAuthErrorMsg(code) {
  const map = {
    'auth/invalid-email': '유효하지 않은 이메일입니다.',
    'auth/user-not-found': '등록되지 않은 이메일입니다.',
    'auth/wrong-password': '비밀번호가 올바르지 않습니다.',
    'auth/email-already-in-use': '이미 사용 중인 이메일입니다.',
    'auth/weak-password': '비밀번호가 너무 약합니다. 6자 이상으로 설정하세요.',
    'auth/invalid-credential': '이메일 또는 비밀번호가 올바르지 않습니다.',
    'auth/too-many-requests': '너무 많은 요청이 있었습니다. 잠시 후 다시 시도하세요.',
    'auth/network-request-failed': '네트워크 오류가 발생했습니다.',
  };
  return map[code] || '오류가 발생했습니다: ' + code;
}

// ===== 토스트 =====
let toastTimer = null;
function showToast(msg, type = 'info') {
  const el = document.getElementById('toast');
  if (!el) return;
  if (toastTimer) { clearTimeout(toastTimer); el.classList.remove('show'); }
  setTimeout(() => {
    el.textContent = msg;
    el.className = `toast show ${type}`;
    toastTimer = setTimeout(() => { el.classList.remove('show'); }, 3200);
  }, 50);
}

console.log('✅ DEEDRA app.js v2.0 로드 완료');
