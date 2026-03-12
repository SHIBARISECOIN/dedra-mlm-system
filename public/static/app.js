/**
 * DEEDRA 회원용 앱 - 메인 로직
 * app.js (Vanilla JS)
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

// 직급 체계
const RANKS = [
  { rank: 'G0', minRefs: 0 },
  { rank: 'G1', minRefs: 3 },
  { rank: 'G2', minRefs: 10 },
  { rank: 'G3', minRefs: 20 },
  { rank: 'G4', minRefs: 40 },
  { rank: 'G5', minRefs: 80 },
  { rank: 'G6', minRefs: 150 },
  { rank: 'G7', minRefs: 300 },
  { rank: 'G8', minRefs: 600 },
  { rank: 'G9', minRefs: 1200 },
  { rank: 'G10', minRefs: 2000 },
];

const SLOT_SYMBOLS = ['🍋', '🍇', '🍎', '🍊', '⭐', '7️⃣', '💎'];
const DICE_FACES = ['', '1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣'];

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

    // 사용자 데이터 로드
    const userSnap = await getDoc(doc(db, 'users', currentUser.uid));

    if (!userSnap.exists()) {
      // 첫 로그인 시 기본 데이터 생성
      await createUserData(currentUser);
    } else {
      userData = userSnap.data();
    }

    // 지갑 데이터 로드
    await loadWalletData();

    // 화면 전환
    showScreen('main');

    // 홈 데이터 로드
    updateHomeUI();
    loadAnnouncements();
    loadRecentTransactions();

  } catch (err) {
    console.error('앱 초기화 실패:', err);
    showToast('초기화 실패. 다시 시도해주세요.', 'error');
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

  // 지갑 생성
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

  // 페이지별 데이터 로드
  if (page === 'wallet') { loadWalletPage(); }
  else if (page === 'invest') { loadInvestPage(); }
  else if (page === 'game') { updateGameUI(); }
  else if (page === 'mypage') { loadMyPage(); }
};

// ===== 인증 탭 전환 =====
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
    // onAuthReady가 자동 호출됨
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

  if (!name || !email || !pw || !refCode) {
    showToast('모든 필드를 입력해주세요.', 'warning'); return;
  }
  if (pw.length < 8) { showToast('비밀번호는 8자 이상이어야 합니다.', 'warning'); return; }

  // 추천인 코드 검증
  const referrer = await findUserByReferralCode(refCode);
  if (!referrer) { showToast('유효하지 않은 추천인 코드입니다.', 'error'); return; }

  showScreen('loading');
  try {
    const { createUserWithEmailAndPassword, auth, doc, setDoc, db, serverTimestamp } = window.FB;
    const { user } = await createUserWithEmailAndPassword(auth, email, pw);
    const myCode = generateReferralCode(user.uid);

    const newUserData = {
      uid: user.uid,
      email: user.email,
      name,
      role: 'member',
      rank: 'G0',
      status: 'active',
      referralCode: myCode,
      referredBy: referrer.uid,
      referredByCode: refCode,
      createdAt: serverTimestamp(),
      phone: '',
      withdrawPin: null,
    };

    await setDoc(doc(db, 'users', user.uid), newUserData);
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
  currentUser = null;
  userData = null;
  walletData = null;
  showScreen('auth');
};

// ===== 홈 UI 업데이트 =====
function updateHomeUI() {
  if (!userData || !walletData) return;

  const hour = new Date().getHours();
  const greeting = hour < 12 ? '좋은 아침이에요' : hour < 18 ? '안녕하세요' : '좋은 저녁이에요';

  document.getElementById('greetingMsg').textContent = greeting;
  document.getElementById('userNameDisplay').textContent = userData.name || '-';
  document.getElementById('userRankBadge').textContent = userData.rank || 'G0';

  const usdt = walletData.usdtBalance || 0;
  const dedra = walletData.dedraBalance || 0;
  const bonus = walletData.bonusBalance || 0;
  const total = usdt + dedra + bonus;

  document.getElementById('totalAsset').textContent = '$' + fmt(total);
  document.getElementById('usdtBalance').textContent = fmt(usdt);
  document.getElementById('dedraBalance').textContent = fmt(dedra);
  document.getElementById('bonusBalance').textContent = fmt(bonus);
}

// ===== 공지사항 로드 =====
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
  } catch (err) {
    console.warn('공지사항 로드 실패:', err);
    document.getElementById('announcementList').innerHTML =
      '<div class="empty-state">공지사항이 없습니다</div>';
  }
}

function renderAnnouncements(items, containerId) {
  const el = document.getElementById(containerId);
  if (!items.length) {
    el.innerHTML = '<div class="empty-state">공지사항이 없습니다</div>';
    return;
  }
  el.innerHTML = items.map(a => `
    <div class="announcement-item">
      <div class="ann-title">
        ${a.isPinned ? '<span class="pin-badge">공지</span>' : ''}${a.title}
      </div>
      <div class="ann-date">${fmtDate(a.createdAt)}</div>
    </div>
  `).join('');
}

window.showAnnouncements = async function() {
  const { collection, query, where, orderBy, getDocs, db } = window.FB;
  const modal = document.getElementById('announcementModal');
  modal.classList.remove('hidden');
  document.getElementById('announcementFullList').innerHTML = '<div class="skeleton-item"></div>';
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
  } catch (err) {
    document.getElementById('announcementFullList').innerHTML = '<div class="empty-state">불러오기 실패</div>';
  }
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
    const txs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderTxList(txs, 'recentTxList');
  } catch (err) {
    console.warn('거래 내역 로드 실패:', err);
    document.getElementById('recentTxList').innerHTML =
      '<div class="empty-state">거래 내역이 없습니다</div>';
  }
}

function renderTxList(txs, containerId) {
  const el = document.getElementById(containerId);
  if (!txs.length) {
    el.innerHTML = '<div class="empty-state">거래 내역이 없습니다</div>';
    return;
  }
  el.innerHTML = txs.map(tx => {
    const isDeposit = tx.type === 'deposit';
    const icons = { deposit: '⬇️', withdrawal: '⬆️', bonus: '🎁', invest: '📈' };
    const sign = isDeposit ? '+' : '-';
    const cls = isDeposit ? 'plus' : 'minus';
    const statusTxt = { pending: '대기중', approved: '완료', rejected: '거부됨' };
    return `
      <div class="tx-item">
        <div class="tx-icon ${tx.type}">${icons[tx.type] || '💱'}</div>
        <div class="tx-info">
          <div class="tx-title">${getTxTypeName(tx.type)}</div>
          <div class="tx-date">${fmtDate(tx.createdAt)}</div>
        </div>
        <div>
          <div class="tx-amount ${cls}">${sign}${fmt(tx.amount)} ${tx.currency || 'USDT'}</div>
          <div class="tx-status">${statusTxt[tx.status] || tx.status}</div>
        </div>
      </div>
    `;
  }).join('');
}

// ===== 지갑 페이지 =====
function loadWalletPage() {
  if (!walletData) return;
  document.getElementById('walletUsdt').textContent = fmt(walletData.usdtBalance || 0);
  document.getElementById('walletDedra').textContent = fmt(walletData.dedraBalance || 0);
  document.getElementById('walletBonus').textContent = fmt(walletData.bonusBalance || 0);
  loadTxHistory('all');
}

async function loadTxHistory(typeFilter) {
  const { collection, query, where, orderBy, getDocs, limit, db } = window.FB;
  document.getElementById('txHistoryList').innerHTML = '<div class="skeleton-item"></div><div class="skeleton-item"></div>';
  try {
    let q;
    if (typeFilter === 'all') {
      q = query(
        collection(db, 'transactions'),
        where('userId', '==', currentUser.uid),
        orderBy('createdAt', 'desc'),
        limit(30)
      );
    } else {
      q = query(
        collection(db, 'transactions'),
        where('userId', '==', currentUser.uid),
        where('type', '==', typeFilter),
        orderBy('createdAt', 'desc'),
        limit(30)
      );
    }
    const snap = await getDocs(q);
    const txs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderTxList(txs, 'txHistoryList');
  } catch (err) {
    console.warn(err);
    document.getElementById('txHistoryList').innerHTML = '<div class="empty-state">불러오기 실패</div>';
  }
}

window.switchTxTab = function(type, el) {
  document.querySelectorAll('.tx-tab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  loadTxHistory(type);
};

// ===== 입금 신청 =====
window.showDepositModal = function() {
  // 회사 지갑 주소 로드
  loadCompanyWallet();
  document.getElementById('depositModal').classList.remove('hidden');
};

async function loadCompanyWallet() {
  const { doc, getDoc, db } = window.FB;
  try {
    const snap = await getDoc(doc(db, 'settings', 'wallets'));
    if (snap.exists()) {
      document.getElementById('companyWalletAddr').textContent = snap.data().trc20 || '주소 미설정 (관리자 문의)';
    } else {
      document.getElementById('companyWalletAddr').textContent = '주소 미설정 (관리자에게 문의하세요)';
    }
  } catch {
    document.getElementById('companyWalletAddr').textContent = '주소 로드 실패';
  }
}

window.copyWalletAddress = function() {
  const addr = document.getElementById('companyWalletAddr').textContent;
  navigator.clipboard.writeText(addr).then(() => showToast('주소가 복사되었습니다!', 'success'));
};

window.submitDeposit = async function() {
  const amount = parseFloat(document.getElementById('depositAmount').value);
  const txid = document.getElementById('depositTxid').value.trim();
  const memo = document.getElementById('depositMemo').value.trim();

  if (!amount || amount <= 0) { showToast('입금 금액을 입력하세요.', 'warning'); return; }
  if (!txid) { showToast('TXID를 입력하세요.', 'warning'); return; }

  const btn = event.target;
  btn.disabled = true;
  btn.textContent = '처리중...';

  try {
    const { addDoc, collection, db, serverTimestamp } = window.FB;
    await addDoc(collection(db, 'transactions'), {
      userId: currentUser.uid,
      userEmail: currentUser.email,
      type: 'deposit',
      amount,
      currency: 'USDT',
      txid,
      memo,
      status: 'pending',
      createdAt: serverTimestamp(),
    });
    closeModal('depositModal');
    showToast('입금 신청이 완료되었습니다! 관리자 승인을 기다려주세요.', 'success');
    loadTxHistory('all');
    document.getElementById('depositAmount').value = '';
    document.getElementById('depositTxid').value = '';
  } catch (err) {
    showToast('신청 실패: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = '입금 신청';
  }
};

// ===== 출금 신청 =====
window.showWithdrawModal = function() {
  document.getElementById('withdrawAvailable').textContent = fmt(walletData?.dedraBalance || 0);
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

  // PIN 검증
  if (userData?.withdrawPin && userData.withdrawPin !== btoa(pin)) {
    showToast('출금 PIN이 올바르지 않습니다.', 'error'); return;
  }

  const btn = event.target;
  btn.disabled = true;
  btn.textContent = '처리중...';

  try {
    const { addDoc, collection, db, serverTimestamp } = window.FB;
    await addDoc(collection(db, 'transactions'), {
      userId: currentUser.uid,
      userEmail: currentUser.email,
      type: 'withdrawal',
      amount,
      currency: 'DEEDRA',
      walletAddress: address,
      status: 'pending',
      createdAt: serverTimestamp(),
    });
    closeModal('withdrawModal');
    showToast('출금 신청이 완료되었습니다! 처리까지 1~3 영업일 소요됩니다.', 'success');
    loadTxHistory('all');
    document.getElementById('withdrawAmount').value = '';
    document.getElementById('withdrawAddress').value = '';
    document.getElementById('withdrawPin').value = '';
  } catch (err) {
    showToast('신청 실패: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = '출금 신청';
  }
};

// ===== 투자 페이지 =====
async function loadInvestPage() {
  loadProducts();
  loadMyInvestments();
}

async function loadProducts() {
  const { collection, query, where, getDocs, db } = window.FB;
  document.getElementById('productList').innerHTML = '<div class="skeleton-item tall"></div><div class="skeleton-item tall"></div>';
  try {
    const q = query(collection(db, 'products'), where('isActive', '==', true));
    const snap = await getDocs(q);
    const products = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    if (!products.length) {
      document.getElementById('productList').innerHTML = '<div class="empty-state">투자 상품이 없습니다</div>';
      return;
    }

    document.getElementById('productList').innerHTML = products.map(p => `
      <div class="product-card">
        <div class="product-header">
          <div>
            <div class="product-name">${p.name}</div>
            <div class="product-detail" style="margin-top:4px">
              기간: <strong>${p.durationDays}일</strong>
            </div>
          </div>
          <div style="text-align:right">
            <div class="product-roi">${p.roiPercent}%</div>
            <div class="product-roi-label">수익률</div>
          </div>
        </div>
        <div class="product-details">
          <div class="product-detail">최소: <strong>$${fmt(p.minAmount)}</strong></div>
          <div class="product-detail">최대: <strong>$${fmt(p.maxAmount)}</strong></div>
        </div>
        <button class="invest-btn" onclick="openInvestModal('${p.id}', '${p.name}', ${p.roiPercent}, ${p.durationDays}, ${p.minAmount}, ${p.maxAmount})">
          투자하기
        </button>
      </div>
    `).join('');
  } catch (err) {
    console.warn(err);
    document.getElementById('productList').innerHTML = '<div class="empty-state">불러오기 실패</div>';
  }
}

async function loadMyInvestments() {
  const { collection, query, where, orderBy, getDocs, db } = window.FB;
  document.getElementById('myInvestList').innerHTML = '<div class="skeleton-item"></div>';
  try {
    const q = query(
      collection(db, 'investments'),
      where('userId', '==', currentUser.uid),
      where('status', '==', 'active'),
      orderBy('startDate', 'desc')
    );
    const snap = await getDocs(q);
    const invests = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    // 요약 업데이트
    const totalAmt = invests.reduce((s, i) => s + (i.amountUsdt || 0), 0);
    const totalRoi = invests.reduce((s, i) => s + (i.amountUsdt * i.roiPercent / 100), 0);
    document.getElementById('activeInvestCount').textContent = invests.length + '건';
    document.getElementById('totalInvestAmount').textContent = '$' + fmt(totalAmt);
    document.getElementById('expectedReturn').textContent = '$' + fmt(totalRoi);

    if (!invests.length) {
      document.getElementById('myInvestList').innerHTML = '<div class="empty-state">활성 투자가 없습니다</div>';
      return;
    }

    document.getElementById('myInvestList').innerHTML = invests.map(i => {
      const startDate = i.startDate?.toDate ? i.startDate.toDate() : new Date(i.startDate);
      const endDate = i.endDate?.toDate ? i.endDate.toDate() : new Date(i.endDate);
      const now = new Date();
      const total = endDate - startDate;
      const passed = now - startDate;
      const progress = Math.min(Math.max((passed / total) * 100, 0), 100);
      const daysLeft = Math.max(0, Math.ceil((endDate - now) / 86400000));
      return `
        <div class="invest-item">
          <div class="invest-item-header">
            <span class="invest-item-name">${i.productName || '투자 상품'}</span>
            <span class="invest-item-amount">$${fmt(i.amountUsdt)}</span>
          </div>
          <div class="invest-item-detail">
            수익률 ${i.roiPercent}% · 만기까지 ${daysLeft}일 남음
          </div>
          <div class="invest-progress">
            <div class="invest-progress-fill" style="width:${progress}%"></div>
          </div>
        </div>
      `;
    }).join('');
  } catch (err) {
    console.warn(err);
    document.getElementById('myInvestList').innerHTML = '<div class="empty-state">불러오기 실패</div>';
  }
}

window.openInvestModal = function(id, name, roi, days, minAmt, maxAmt) {
  selectedProduct = { id, name, roi, days, minAmt, maxAmt };
  document.getElementById('investProductSummary').innerHTML = `
    <strong>${name}</strong><br/>
    <span style="color:var(--success);font-size:18px;font-weight:700">${roi}%</span> 수익률 · ${days}일
  `;
  document.getElementById('investAmountHint').textContent = `최소 $${fmt(minAmt)} ~ 최대 $${fmt(maxAmt)}`;
  document.getElementById('investAmount').oninput = updateInvestPreview;
  document.getElementById('investModal').classList.remove('hidden');
};

function updateInvestPreview() {
  const amount = parseFloat(document.getElementById('investAmount').value) || 0;
  if (!selectedProduct || !amount) {
    document.getElementById('investPreview').style.display = 'none';
    return;
  }
  const profit = amount * selectedProduct.roi / 100;
  document.getElementById('investPreview').style.display = 'block';
  document.getElementById('investPreview').innerHTML = `
    예상 수익: <strong style="color:var(--success)">$${fmt(profit)}</strong><br/>
    만기 총액: <strong>$${fmt(amount + profit)}</strong><br/>
    만기일: <strong>${getEndDate(selectedProduct.days)}</strong>
  `;
}

window.submitInvest = async function() {
  const amount = parseFloat(document.getElementById('investAmount').value);
  if (!amount || !selectedProduct) { showToast('투자 금액을 입력하세요.', 'warning'); return; }
  if (amount < selectedProduct.minAmt) { showToast(`최소 투자금액은 $${selectedProduct.minAmt}입니다.`, 'warning'); return; }
  if (amount > selectedProduct.maxAmt) { showToast(`최대 투자금액은 $${selectedProduct.maxAmt}입니다.`, 'warning'); return; }
  if ((walletData?.usdtBalance || 0) < amount) { showToast('USDT 잔액이 부족합니다.', 'error'); return; }

  const btn = event.target;
  btn.disabled = true;
  btn.textContent = '처리중...';

  try {
    const { addDoc, collection, db, serverTimestamp, Timestamp } = window.FB;
    const startDate = new Date();
    const endDate = new Date(startDate.getTime() + selectedProduct.days * 86400000);

    await addDoc(collection(db, 'investments'), {
      userId: currentUser.uid,
      productId: selectedProduct.id,
      productName: selectedProduct.name,
      amountUsdt: amount,
      roiPercent: selectedProduct.roi,
      durationDays: selectedProduct.days,
      startDate: Timestamp.fromDate(startDate),
      endDate: Timestamp.fromDate(endDate),
      status: 'active',
      createdAt: serverTimestamp(),
    });

    closeModal('investModal');
    showToast('투자 신청이 완료되었습니다! 🎉', 'success');
    await loadWalletData();
    loadInvestPage();
    document.getElementById('investAmount').value = '';
  } catch (err) {
    showToast('신청 실패: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = '투자 신청';
  }
};

// ===== 게임 =====
function updateGameUI() {
  document.getElementById('gameBalance').textContent = fmt(gameBalanceVal);
}

window.startGame = function(type) {
  closeGame();
  if (type === 'oddeven') {
    document.getElementById('gameOddEven').classList.remove('hidden');
    updateBetDisplay('oe', oeBetVal);
  } else if (type === 'dice') {
    document.getElementById('gameDice').classList.remove('hidden');
    updateBetDisplay('dice', diceBetVal);
  } else if (type === 'slot') {
    document.getElementById('gameSlot').classList.remove('hidden');
    updateBetDisplay('slot', slotBetVal);
  }
};

window.closeGame = function() {
  ['gameOddEven', 'gameDice', 'gameSlot'].forEach(id => {
    document.getElementById(id).classList.add('hidden');
  });
};

window.showComingSoon = function() {
  showToast('준비 중입니다! 곧 오픈됩니다 🎉', 'warning');
};

window.updateBetDisplay = function(type, val) {
  val = Math.max(1, Math.min(1000, parseInt(val) || 1));
  if (type === 'oe') {
    oeBetVal = val;
    document.getElementById('oeCurrentBet').textContent = val;
    document.getElementById('oeBetSlider').value = val;
  } else if (type === 'dice') {
    diceBetVal = val;
    document.getElementById('diceCurrentBet').textContent = val;
    document.getElementById('diceBetSlider').value = val;
  } else if (type === 'slot') {
    slotBetVal = val;
    document.getElementById('slotCurrentBet').textContent = val;
    document.getElementById('slotBetSlider').value = val;
  }
};

window.adjustBet = function(type, delta) {
  const curr = type === 'oe' ? oeBetVal : type === 'dice' ? diceBetVal : slotBetVal;
  updateBetDisplay(type, curr + delta);
};

window.setBetAmount = function(type, val) {
  updateBetDisplay(type, val);
};

window.playOddEven = async function(choice) {
  if (gameBalanceVal < oeBetVal) { showToast('DEEDRA 잔액이 부족합니다.', 'error'); return; }
  const roll = Math.floor(Math.random() * 100) + 1;
  const result = roll % 2 === 0 ? 'even' : 'odd';
  const win = choice === result;
  const pnl = win ? oeBetVal : -oeBetVal;
  gameBalanceVal += pnl;

  const el = document.getElementById('oeResult');
  el.className = 'game-result ' + (win ? 'win' : 'lose');
  el.textContent = win
    ? `🎉 승리! +${oeBetVal} DEEDRA (숫자: ${roll})`
    : `😢 패배! -${oeBetVal} DEEDRA (숫자: ${roll})`;
  el.classList.remove('hidden');

  updateGameUI();
  await saveGameLog('oddeven', oeBetVal, win ? oeBetVal : 0, win ? 'win' : 'lose');
};

window.playDice = async function(userGuess) {
  if (gameBalanceVal < diceBetVal) { showToast('DEEDRA 잔액이 부족합니다.', 'error'); return; }
  const roll = Math.floor(Math.random() * 6) + 1;
  document.getElementById('diceDisplay').textContent = DICE_FACES[roll];
  const win = roll === userGuess;
  const winAmt = win ? diceBetVal * 5 : 0;
  const pnl = win ? diceBetVal * 5 : -diceBetVal;
  gameBalanceVal += pnl;

  const el = document.getElementById('diceResult');
  el.className = 'game-result ' + (win ? 'win' : 'lose');
  el.textContent = win
    ? `🎉 정답! +${winAmt} DEEDRA`
    : `😢 틀림! -${diceBetVal} DEEDRA (결과: ${roll})`;
  el.classList.remove('hidden');

  updateGameUI();
  await saveGameLog('dice', diceBetVal, winAmt, win ? 'win' : 'lose');
};

window.playSpin = async function() {
  if (gameBalanceVal < slotBetVal) { showToast('DEEDRA 잔액이 부족합니다.', 'error'); return; }
  const spinBtn = document.getElementById('spinBtn');
  spinBtn.disabled = true;

  const reels = ['reel1', 'reel2', 'reel3'];
  reels.forEach(id => document.getElementById(id).classList.add('spinning'));

  await sleep(800);

  const results = reels.map(() => SLOT_SYMBOLS[Math.floor(Math.random() * SLOT_SYMBOLS.length)]);
  reels.forEach((id, i) => {
    document.getElementById(id).classList.remove('spinning');
    document.getElementById(id).textContent = results[i];
  });

  const allSame = results[0] === results[1] && results[1] === results[2];
  const twoSame = results[0] === results[1] || results[1] === results[2] || results[0] === results[2];
  const isJackpot = allSame && results[0] === '💎';

  let multiplier = 0;
  if (isJackpot) multiplier = 50;
  else if (allSame) multiplier = 10;
  else if (twoSame) multiplier = 2;

  const winAmt = slotBetVal * multiplier;
  const pnl = winAmt - slotBetVal;
  gameBalanceVal += pnl;

  const el = document.getElementById('slotResult');
  if (multiplier > 0) {
    el.className = 'game-result win';
    el.textContent = isJackpot
      ? `💎 JACKPOT! +${winAmt} DEEDRA!!!`
      : `🎉 ${multiplier}배 당첨! +${winAmt} DEEDRA`;
  } else {
    el.className = 'game-result lose';
    el.textContent = `😢 꽝! -${slotBetVal} DEEDRA`;
  }
  el.classList.remove('hidden');

  updateGameUI();
  spinBtn.disabled = false;
  await saveGameLog('slot', slotBetVal, winAmt, multiplier > 0 ? 'win' : 'lose');
};

async function saveGameLog(gameType, betAmt, winAmt, result) {
  try {
    const { addDoc, collection, db, serverTimestamp } = window.FB;
    const log = {
      userId: currentUser.uid,
      gameType,
      betAmount: betAmt,
      winAmount: winAmt,
      result,
      createdAt: serverTimestamp(),
    };
    await addDoc(collection(db, 'game_logs'), log);

    // 게임 기록 UI 업데이트
    const el = document.getElementById('gameLogList');
    const item = document.createElement('div');
    item.className = 'tx-item';
    item.innerHTML = `
      <div class="tx-icon ${result === 'win' ? 'bonus' : 'withdrawal'}">${result === 'win' ? '🏆' : '😢'}</div>
      <div class="tx-info">
        <div class="tx-title">${getGameName(gameType)}</div>
        <div class="tx-date">방금 전</div>
      </div>
      <div class="tx-amount ${result === 'win' ? 'plus' : 'minus'}">
        ${result === 'win' ? '+' + winAmt : '-' + betAmt}
      </div>
    `;
    if (el.querySelector('.empty-state')) el.innerHTML = '';
    el.prepend(item);
  } catch (err) {
    console.warn('게임 로그 저장 실패:', err);
  }
}

// ===== 마이페이지 =====
async function loadMyPage() {
  if (!userData) return;

  document.getElementById('profileName').textContent = userData.name || '-';
  document.getElementById('profileEmail').textContent = userData.email || '-';
  document.getElementById('profileRank').textContent = userData.rank || 'G0';
  document.getElementById('myReferralCode').textContent = userData.referralCode || '-';

  // 직급 현황 계산
  await updateRankDisplay();
}

async function updateRankDisplay() {
  const { collection, query, where, getDocs, db } = window.FB;
  try {
    const q = query(collection(db, 'users'), where('referredBy', '==', currentUser.uid));
    const snap = await getDocs(q);
    const refCount = snap.size;

    const currRankIdx = RANKS.findIndex(r => r.rank === (userData?.rank || 'G0'));
    const nextRank = RANKS[currRankIdx + 1];

    document.getElementById('rankCurrent').textContent = userData?.rank || 'G0';
    document.getElementById('rankReferralCount').textContent = refCount;
    document.getElementById('profileRank').textContent = userData?.rank || 'G0';
    document.getElementById('userRankBadge').textContent = userData?.rank || 'G0';

    if (nextRank) {
      const progress = Math.min((refCount / nextRank.minRefs) * 100, 100);
      document.getElementById('rankNextLabel').textContent = `${nextRank.rank} (${nextRank.minRefs}명 필요)`;
      document.getElementById('rankProgressFill').style.width = progress + '%';
    } else {
      document.getElementById('rankNextLabel').textContent = '최고 직급 달성!';
      document.getElementById('rankProgressFill').style.width = '100%';
    }
  } catch (err) {
    console.warn('직급 업데이트 실패:', err);
  }
}

window.copyReferralCode = function() {
  const code = userData?.referralCode || '';
  navigator.clipboard.writeText(code).then(() => showToast('추천 코드가 복사되었습니다!', 'success'));
};

window.shareReferralLink = function() {
  const link = `${location.origin}?ref=${userData?.referralCode || ''}`;
  if (navigator.share) {
    navigator.share({ title: 'DEEDRA 초대', text: '함께 투자해요!', url: link });
  } else {
    navigator.clipboard.writeText(link).then(() => showToast('추천 링크가 복사되었습니다!', 'success'));
  }
};

// ===== 출금 PIN 설정 =====
window.showWithdrawPinSetup = function() {
  document.getElementById('pinModal').classList.remove('hidden');
};

window.saveWithdrawPin = async function() {
  const pin = document.getElementById('newPin').value;
  const confirmPin = document.getElementById('confirmPin').value;

  if (!pin || pin.length !== 6) { showToast('6자리 PIN을 입력하세요.', 'warning'); return; }
  if (pin !== confirmPin) { showToast('PIN이 일치하지 않습니다.', 'error'); return; }
  if (!/^\d{6}$/.test(pin)) { showToast('숫자 6자리만 입력해주세요.', 'warning'); return; }

  try {
    const { doc, updateDoc, db } = window.FB;
    await updateDoc(doc(db, 'users', currentUser.uid), { withdrawPin: btoa(pin) });
    userData.withdrawPin = btoa(pin);
    closeModal('pinModal');
    showToast('출금 PIN이 설정되었습니다.', 'success');
    document.getElementById('newPin').value = '';
    document.getElementById('confirmPin').value = '';
  } catch (err) {
    showToast('저장 실패: ' + err.message, 'error');
  }
};

// ===== 프로필 수정 =====
window.showProfileEdit = function() {
  document.getElementById('editName').value = userData?.name || '';
  document.getElementById('editPhone').value = userData?.phone || '';
  document.getElementById('profileModal').classList.remove('hidden');
};

window.saveProfile = async function() {
  const name = document.getElementById('editName').value.trim();
  const phone = document.getElementById('editPhone').value.trim();
  if (!name) { showToast('이름을 입력하세요.', 'warning'); return; }

  try {
    const { doc, updateDoc, db } = window.FB;
    await updateDoc(doc(db, 'users', currentUser.uid), { name, phone });
    userData.name = name;
    userData.phone = phone;
    document.getElementById('profileName').textContent = name;
    document.getElementById('userNameDisplay').textContent = name;
    closeModal('profileModal');
    showToast('프로필이 업데이트되었습니다.', 'success');
  } catch (err) {
    showToast('저장 실패: ' + err.message, 'error');
  }
};

// ===== 비밀번호 변경 =====
window.showPasswordChange = function() {
  const email = userData?.email || currentUser?.email || '';
  if (confirm('비밀번호 재설정 이메일을 발송할까요?\n(' + email + ')')) {
    const { sendPasswordResetEmail, auth } = window.FB;
    sendPasswordResetEmail(auth, email)
      .then(() => showToast('이메일을 발송했습니다.', 'success'))
      .catch(err => showToast('발송 실패: ' + err.message, 'error'));
  }
};

// ===== 1:1 문의 =====
window.showTickets = async function() {
  document.getElementById('ticketModal').classList.remove('hidden');
  loadTickets();
};

async function loadTickets() {
  const { collection, query, where, orderBy, getDocs, db } = window.FB;
  try {
    const q = query(
      collection(db, 'tickets'),
      where('userId', '==', currentUser.uid),
      orderBy('createdAt', 'desc')
    );
    const snap = await getDocs(q);
    const tickets = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    const el = document.getElementById('ticketList');
    if (!tickets.length) {
      el.innerHTML = '<div class="empty-state">문의 내역이 없습니다</div>';
      return;
    }
    el.innerHTML = tickets.map(t => `
      <div class="ticket-item">
        <div class="ticket-item-title">${t.title}</div>
        <div class="ticket-item-status">
          ${fmtDate(t.createdAt)} · ${t.status === 'closed' ? '✅ 완료' : t.reply ? '💬 답변완료' : '⏳ 대기중'}
        </div>
        ${t.reply ? `<div style="margin-top:6px;font-size:13px;color:var(--dark)">↩ ${t.reply}</div>` : ''}
      </div>
    `).join('');
  } catch (err) {
    document.getElementById('ticketList').innerHTML = '<div class="empty-state">불러오기 실패</div>';
  }
}

window.submitTicket = async function() {
  const title = document.getElementById('ticketTitle').value.trim();
  const content = document.getElementById('ticketContent').value.trim();
  if (!title || !content) { showToast('제목과 내용을 입력하세요.', 'warning'); return; }

  try {
    const { addDoc, collection, db, serverTimestamp } = window.FB;
    await addDoc(collection(db, 'tickets'), {
      userId: currentUser.uid,
      userEmail: currentUser.email,
      title,
      content,
      status: 'open',
      reply: null,
      createdAt: serverTimestamp(),
    });
    document.getElementById('ticketTitle').value = '';
    document.getElementById('ticketContent').value = '';
    showToast('문의가 등록되었습니다.', 'success');
    loadTickets();
  } catch (err) {
    showToast('등록 실패: ' + err.message, 'error');
  }
};

// ===== 알림 =====
window.showNotifications = async function() {
  showToast('알림함을 준비 중입니다.', 'warning');
};

// ===== 모달 닫기 =====
window.closeModal = function(id) {
  document.getElementById(id).classList.add('hidden');
};

// ===== 유틸리티 =====
function fmt(n) {
  return parseFloat(n || 0).toLocaleString('ko-KR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(ts) {
  if (!ts) return '-';
  const d = ts?.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function generateReferralCode(uid) {
  return uid.substring(0, 8).toUpperCase();
}

async function findUserByReferralCode(code) {
  const { collection, query, where, getDocs, db } = window.FB;
  try {
    const q = query(collection(db, 'users'), where('referralCode', '==', code.toUpperCase()));
    const snap = await getDocs(q);
    return snap.empty ? null : { uid: snap.docs[0].id, ...snap.docs[0].data() };
  } catch { return null; }
}

function getTxTypeName(type) {
  const map = { deposit: 'USDT 입금', withdrawal: 'DEEDRA 출금', bonus: '보너스', invest: '투자' };
  return map[type] || type;
}

function getGameName(type) {
  const map = { oddeven: '홀짝 게임', dice: '주사위 게임', slot: '슬롯머신' };
  return map[type] || type;
}

function getEndDate(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toLocaleDateString('ko-KR');
}

function getAuthErrorMsg(code) {
  const map = {
    'auth/user-not-found': '등록되지 않은 이메일입니다.',
    'auth/wrong-password': '비밀번호가 올바르지 않습니다.',
    'auth/email-already-in-use': '이미 사용 중인 이메일입니다.',
    'auth/weak-password': '비밀번호가 너무 약합니다.',
    'auth/invalid-email': '올바른 이메일 형식이 아닙니다.',
    'auth/too-many-requests': '너무 많은 시도. 잠시 후 다시 시도해주세요.',
    'auth/invalid-credential': '이메일 또는 비밀번호가 올바르지 않습니다.',
  };
  return map[code] || '오류가 발생했습니다. 다시 시도해주세요.';
}

function sleep(ms) {
  return new Promise(res => setTimeout(res, ms));
}

let toastTimer = null;
window.showToast = function(msg, type = '') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = 'toast' + (type ? ' ' + type : '');
  el.classList.remove('hidden');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add('hidden'), 3000);
};

console.log('[App] DEEDRA 앱 로드 완료');
