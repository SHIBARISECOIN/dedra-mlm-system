/**
 * DedraAPI - Firestore 직접 접근 클래스
 * admin.html 에서 사용하는 모든 API 메서드를 Firebase Firestore로 구현
 */
import {
  collection, doc, getDoc as _fsGetDoc, getDocs as _fsGetDocs, setDoc, addDoc, updateDoc, deleteDoc,
  query, where, orderBy, limit, serverTimestamp, writeBatch, increment, runTransaction
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

const ok  = data => ({ success: true, data });
const err = e    => ({ success: false, error: e?.message || String(e) });

// ── 보조계정 프록시 헬퍼 (모듈 레벨) ──────────────────────────────────────────
// _saToken이 설정되면 아래 함수들이 프록시로 동작
let _globalSaToken = null;

async function _saQueryFetch(colName, filters = [], lim = 500) {
  const res = await fetch('/api/subadmin/query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${_globalSaToken}` },
    body: JSON.stringify({ collection: colName, filters, limit: lim })
  });
  return res.json();
}

// colName 추출 유틸 (collection/query 객체)
function _colName(qoc) {
  const segs = qoc?._query?.path?.segments
    || qoc?.path?.segments
    || qoc?._path?.segments
    || [];
  if (segs.length > 0) return segs[segs.length - 1] || '';
  
  // Also handle if qoc is directly a CollectionReference (v10)
  if (qoc?.type === 'collection') return qoc.path;
  if (qoc?.type === 'query') return qoc._query?.path?.segments?.[qoc._query.path.segments.length - 1] || qoc.path || '';

  return '';
}

// Firebase SDK v10 filter 값 추출
function _fsVal(v) {
  if (!v) return undefined;
  if ('stringValue'  in v) return v.stringValue;
  if ('integerValue' in v) return parseInt(v.integerValue);
  if ('doubleValue'  in v) return v.doubleValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('nullValue'    in v) return null;
  return undefined;
}

// Firebase SDK v10 필터 재귀 파싱 (compositeFilter 지원)
function _extractFs(filterOrArr) {
  const out = [];
  const arr = Array.isArray(filterOrArr) ? filterOrArr : (filterOrArr ? [filterOrArr] : []);
  const opMap = {
    'EQUAL':'EQUAL','LESS_THAN':'LESS_THAN','LESS_THAN_OR_EQUAL':'LESS_THAN_OR_EQUAL',
    'GREATER_THAN':'GREATER_THAN','GREATER_THAN_OR_EQUAL':'GREATER_THAN_OR_EQUAL',
    'NOT_EQUAL':'NOT_EQUAL','ARRAY_CONTAINS':'ARRAY_CONTAINS','IN':'IN',
    '==':'EQUAL','>':'GREATER_THAN','<':'LESS_THAN',
    '>=':'GREATER_THAN_OR_EQUAL','<=':'LESS_THAN_OR_EQUAL','!=':'NOT_EQUAL'
  };
  for (const f of arr) {
    if (!f) continue;
    if (f.compositeFilter) { out.push(..._extractFs(f.compositeFilter.filters)); continue; }
    if (f.filters) { out.push(..._extractFs(f.filters)); continue; }
    const ff = f.fieldFilter || f;
    const field = ff?.field?.segments?.[0] || ff?.field?.fieldPath || '';
    const op = opMap[ff?.op] || 'EQUAL';
    const value = _fsVal(ff?.value);
    if (field && value !== undefined) out.push({ field, op, value });
  }
  return out;
}

// 프록시 getDocs: 보조계정이면 백엔드 경유
async function getDocs(q) {
  if (!_globalSaToken) return _fsGetDocs(q);
  const colName = _colName(q);
  if (!colName) return { docs: [], empty: true, size: 0, forEach: ()=>{} };

  // Firebase SDK v10 compositeFilter 포함 필터 파싱
  const rawFilters = q?._query?.filters || [];
  const filters = _extractFs(rawFilters);

  const lim = q?._query?.limit ?? 500;
  try {
    const json = await _saQueryFetch(colName, filters, lim);
    const docs = (json.docs || []).map(d => ({
      id: d.id || d._id || '',
      data: () => ({ ...d }),
      exists: () => true,
    }));
    return { docs, empty: docs.length === 0, size: docs.length, forEach: fn => docs.forEach(fn) };
  } catch(e) {
    console.error(`[api.js proxy getDocs:${colName}]`, e.message);
    return { docs: [], empty: true, size: 0, forEach: ()=>{} };
  }
}

// 프록시 getDoc: 보조계정이면 백엔드 경유
async function getDoc(docRef) {
  if (!_globalSaToken) return _fsGetDoc(docRef);
  const segs = docRef?._key?.path?.segments || docRef?.path?.segments || [];
  const docId   = segs[segs.length - 1] || '';
  const colName = segs[segs.length - 2] || '';
  if (!colName || !docId) return { id: '', exists: () => false, data: () => null };
  try {
    const res = await fetch('/api/subadmin/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${_globalSaToken}` },
      body: JSON.stringify({ collection: colName, docId, limit: 1 })
    });
    const json = await res.json();
    const d = json.docs?.[0] || null;
    return { id: docId, exists: () => !!d, data: () => d ? { ...d } : null };
  } catch(e) {
    console.error(`[api.js proxy getDoc:${colName}/${docId}]`, e.message);
    return { id: docId, exists: () => false, data: () => null };
  }
}

export class DedraAPI {
  constructor(db, subAdminToken = null) {
    this.db = db;
    this._saToken = subAdminToken; // 보조계정 JWT 토큰 (있으면 프록시 API 사용)
    // 모듈 레벨 토큰 동기화
    if (subAdminToken) _globalSaToken = subAdminToken;
  }

  // 보조계정 모드 여부
  get _isSubAdmin() { return !!this._saToken; }

  // 보조계정 전용 Fetch 헬퍼
  async _saFetch(path, options = {}) {
    const res = await fetch(path, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this._saToken}`,
        ...(options.headers || {})
      }
    });
    return res.json();
  }

  // 보조계정: 컬렉션 전체 조회 (하위 호환성 유지 - 실제로는 모듈 레벨 getDocs가 처리)
  async _saGetDocs(colName, filters = [], lim = 1000) {
    const json = await this._saFetch('/api/subadmin/query', {
      method: 'POST',
      body: JSON.stringify({ collection: colName, filters, limit: lim })
    });
    const docs = (json.docs || []).map(d => ({
      id: d.id,
      data: () => ({ ...d }),
      exists: () => true,
    }));
    return { docs, empty: docs.length === 0 };
  }

  // 보조계정: 단일 문서 조회 (하위 호환성 유지)
  async _saGetDoc(colName, docId) {
    const json = await this._saFetch('/api/subadmin/query', {
      method: 'POST',
      body: JSON.stringify({ collection: colName, docId, limit: 1 })
    });
    const d = (json.docs || [])[0];
    if (!d) return { exists: () => false, data: () => ({}) };
    return { id: d.id, data: () => ({ ...d }), exists: () => true };
  }

  // ─────────────────────────────────────────────────
  // 대시보드 통계
  // ─────────────────────────────────────────────────
  async getBadgesStats() {
    try {
      if (this._isSubAdmin) {
        const json = await this._saFetch("/api/subadmin/dashboard-badges");
        return json.success ? ok(json.data) : err(new Error(json.error));
      }
      const db = this.db;
      const [depSnap, withSnap] = await Promise.all([
        getDocs(query(collection(db, "transactions"), where("type", "==", "deposit"), where("status", "==", "pending"))),
        getDocs(query(collection(db, "transactions"), where("type", "==", "withdrawal"), where("status", "==", "pending")))
      ]);
      return ok({
        pendingDeposits: depSnap.size,
        pendingWithdrawals: withSnap.size
      });
    } catch(e) { return err(e); }
  }

  async getDashboardStats() {
    try {
      // 보조계정: 전용 API 사용
      if (this._isSubAdmin) {
        const json = await this._saFetch('/api/subadmin/dashboard-stats');
        return json.success ? ok(json.data) : err(new Error(json.error));
      }
      const db = this.db;
      // gamelogs는 보안규칙상 컬렉션 전체 읽기 불가 → 각각 catch로 처리
      const [usersSnap, txSnap, invSnap] = await Promise.all([
        getDocs(collection(db, 'users')),
        getDocs(collection(db, 'transactions')),
        getDocs(collection(db, 'investments')).catch(() => ({ docs: [] })),
      ]);
      // gamelogs는 별도로 시도 (실패해도 무시)
      
      // gamelogs는 별도로 시도 (실패해도 무시)
      let games = [];
      try {
        const gameSnap = await getDocs(query(collection(db, 'gamelogs'), orderBy('createdAt', 'desc'), limit(10)));
        games = gameSnap.docs.map(d => d.data());
      } catch(_) {}

      let tickets = [];
      try {
        const tSnap = await getDocs(query(collection(db, 'tickets'), where('status', '==', 'open'), orderBy('createdAt', 'asc'), limit(5)));
        tickets = tSnap.docs.map(d => d.data());
      } catch(_) {}


      const users = usersSnap.docs.map(d => d.data());
      const txs   = txSnap.docs.map(d => d.data());
      const invs  = invSnap.docs.map(d => d.data());

      const deposits    = txs.filter(t => t.type === 'deposit');
      const withdrawals = txs.filter(t => t.type === 'withdrawal');

      return ok({
        totalUsers:            users.filter(u => u.role !== 'admin').length,
        activeUsers:           users.filter(u => u.status === 'active' && u.role !== 'admin').length,
        onlineUsers:           users.filter(u => u.lastSeenAt && (Date.now() - u.lastSeenAt < 120000)).length,
        onlineUserList:        users.filter(u => u.lastSeenAt && (Date.now() - u.lastSeenAt < 120000)).map(u => ({uid:u.uid, name:u.name, email:u.email, rank:u.rank, lastSeenAt:u.lastSeenAt})),
        pendingDeposits:       deposits.filter(t => t.status === 'pending').length,
        pendingWithdrawals:    withdrawals.filter(t => t.status === 'pending').length,
        totalDepositAmount:    deposits.filter(t => t.status === 'approved').reduce((s, t) => s + (t.amount || 0), 0),
        totalWithdrawalAmount: withdrawals.filter(t => t.status === 'approved').reduce((s, t) => s + (t.amount || 0), 0),
        totalGameBet:          games.reduce((s, g) => s + (g.betAmount || 0), 0),
        activeInvestments:     invs.filter(i => i.status === 'active').length,
        totalInvestAmount:     invs.reduce((s, i) => s + (i.amount || 0), 0),
        totalStakedAmount:     invs.filter(i => i.status === 'active').reduce((s, i) => s + (i.amount || 0), 0),
      });
    } catch(e) { return err(e); }
  }

  // ─────────────────────────────────────────────────
  // 회사 지갑 주소
  // ─────────────────────────────────────────────────
  async getCompanyWallets() {
    try {
      const snap = await getDoc(doc(this.db, 'settings', 'companyWallets'));
      const data = snap.exists() ? snap.data() : {};
      const wallets = data.wallets || [
        { network: 'Solana (SOL)', address: '' },
        { network: 'Solana (SOL)', address: '' },
        { network: 'Solana (SOL)', address: '' },
      ];
      return ok(wallets);
    } catch(e) { return err(e); }
  }

  async saveCompanyWallets(adminId, wallets) {
    try {
      await setDoc(doc(this.db, 'settings', 'companyWallets'), {
        wallets, updatedAt: serverTimestamp(), updatedBy: adminId
      });
      await this._auditLog(adminId, 'wallet', '회사 지갑 주소 업데이트', { count: wallets.length });
      return ok(true);
    } catch(e) { return err(e); }
  }

  // ─────────────────────────────────────────────────
  // 입금 처리
  // ─────────────────────────────────────────────────
  async approveDeposit(txId, adminId, memo = '') {
    try {
      const db = this.db;
      // --- 이중 승인 방지용 Lock ---
      try {
        await runTransaction(db, async (t) => {
          const txRef = doc(db, 'transactions', txId);
          const tDoc = await t.get(txRef);
          if (!tDoc.exists()) throw new Error('거래 없음');
          const tData = tDoc.data();
          if (tData.status !== 'pending' && tData.status !== 'processing') throw new Error('처리 가능한 상태가 아닙니다 (' + tData.status + ')');
          t.update(txRef, { status: 'processing_lock' });
        });
      } catch (e) {
        throw new Error('이중 승인 방지: 이미 처리 중이거나 처리된 거래입니다. (' + e.message + ')');
      }
      // --- Lock 끝 ---

      const txSnap = await getDoc(doc(db, 'transactions', txId));
      if (!txSnap.exists()) throw new Error('거래 없음');
      const tx = txSnap.data();
      if (tx.status !== 'pending' && tx.status !== 'processing' && tx.status !== 'processing_lock') throw new Error('처리 가능한 상태가 아닙니다 (' + tx.status + ')');
      
      // 관리자 수동 승인 시 TXID 중복 재검증 (다른 문서에 이미 승인된 같은 TXID가 있는지)
      if (tx.txid) {
          const dupQ = await getDocs(query(collection(db, 'transactions'), where('txid', '==', tx.txid), where('status', '==', 'approved'), limit(1)));
          if (!dupQ.empty && dupQ.docs[0].id !== txId) {
              throw new Error('중복 승인 방지: 이 TXID는 이미 다른 요청에서 승인되었습니다.');
          }
      }

      const batch = writeBatch(db);
      
      const walletQ = query(collection(db, 'wallets'), where('userId', '==', tx.userId));
      const wSnap = await getDocs(walletQ);
      
      let bonusUsdt = 0;
      let bonusPct = 0;
      let originalAmount = parseFloat(tx.amount) || 0;
      let isEligibleForBonus = true;

      if (!wSnap.empty) {
        const wData = wSnap.docs[0].data();
        if ((wData.totalWithdrawal || 0) > 0) {
          // 출금 이력이 있으면 15일 이내인지 체크
          const txQ = query(collection(db, 'transactions'), where('userId', '==', tx.userId), where('type', '==', 'withdrawal'));
          const txSnap = await getDocs(txQ);
          let latestWithdrawalTime = 0;
          txSnap.forEach(d => {
            const data = d.data();
            const time = data.createdAt?.toMillis?.() || (data.createdAt?.seconds ? data.createdAt.seconds * 1000 : 0);
            if (time > latestWithdrawalTime) latestWithdrawalTime = time;
          });
          const days15 = 10 * 24 * 60 * 60 * 1000;
          if (latestWithdrawalTime > 0 && (Date.now() - latestWithdrawalTime) < days15) {
            isEligibleForBonus = false; // 30일 이내 출금자는 제외
          }
        }
      }

            if (isEligibleForBonus) {
        try {
          // 1. Country Bonus Check (Highest Priority)
          const userSnap = await getDoc(doc(db, 'users', tx.userId));
          const userData = userSnap.exists() ? userSnap.data() : {};
          
          const cbSnap = await getDoc(doc(db, 'settings', 'countryBonus'));
          let countryBonusApplied = false;
          
          if (cbSnap.exists()) {
             const cbData = cbSnap.data();
             if (cbData.rules && Array.isArray(cbData.rules)) {
                 const rule = cbData.rules.find(r => r.country === userData.country && r.enabled);
                 if (rule && rule.bonusPct > 0) {
                     bonusPct = rule.bonusPct;
                     bonusUsdt = originalAmount * (bonusPct / 100);
                     countryBonusApplied = true;
                 }
             }
          }
          
          // 2. Bear Market Event Check (Only if Country Bonus was NOT applied)
          if (!countryBonusApplied) {
              const evSnap = await getDoc(doc(db, 'settings', 'bearMarketEvent'));
              if (evSnap.exists()) {
                const evData = evSnap.data();
                const now = new Date();
                let isWithinTime = false;
                
                if (evData.enabled) {
                  if (evData.startDate && evData.endDate) {
                    const sDate = new Date(evData.startDate);
                    const eDate = new Date(evData.endDate);
                    if (now >= sDate && now <= eDate) {
                      isWithinTime = true;
                    }
                  } else if (evData.endDate) {
                     const eDate = new Date(evData.endDate);
                     if (now <= eDate) isWithinTime = true;
                  } else {
                     isWithinTime = true;
                  }
                }
                
                if (isWithinTime) {
                  const priceSnap = await getDoc(doc(db, 'settings', 'deedraPrice'));
                  if (priceSnap.exists()) {
                    const pData = priceSnap.data();
                    const drop = parseFloat(pData.priceChange24h || 0);
                    if (drop < 0) {
                      bonusPct = Math.floor(Math.abs(drop));
                      bonusUsdt = originalAmount * (bonusPct / 100);
                    }
                  }
                }
              }
          }
        } catch(err) {
          console.error("Bonus check failed:", err);
        }
      }

      let depositToUsdt = originalAmount;
      let depositToProduct = 0;
      
      // 1+1 프로모션은 메모에 1+1, 원플러스원, 원플 등이 들어갈 때만 활성화됩니다.
      const is1plus1 = (memo || '').includes('1+1') || (tx.memo || '').includes('1+1') || (memo || '').includes('원플') || (tx.memo || '').includes('원플') || (memo || '').includes('12개') || (tx.memo || '').includes('12개');
      
      if (is1plus1) {
          depositToProduct = originalAmount;
          depositToUsdt = 0;
      }

      const totalAddUsdt = depositToUsdt + bonusUsdt;

      batch.update(doc(db, 'transactions', txId), {
        status: 'approved', 
        approvedAt: serverTimestamp(), 
        approvedBy: adminId,
        bonusUsdt: bonusUsdt,
        bonusPct: bonusPct,
        totalCredited: totalAddUsdt,
        convertedToProduct: depositToProduct
      });
      
      // 지갑 잔액 증가 (주간 잭팟 티켓 추가 포함)
      const newTickets = Math.floor(originalAmount / 100);
      
      if (depositToProduct > 0) {
        const newInvRef = doc(collection(db, 'investments'));
        const startDate = new Date();
        const endDate = new Date(startDate.getTime() + 360 * 86400000);
        batch.set(newInvRef, {
          userId: tx.userId,
          productId: 'vb7CsNewjaepbGZBCI3h',
          productName: '12개월',
          amount: depositToProduct,
          amountUsdt: depositToProduct,
          durationDays: 360,
          dailyRate: 0.007,
          roiPercent: 0, 
          expectedReturn: 0,
          status: 'active',
          startDate: startDate,
          endDate: endDate,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          isManual1plus1: true,
          noRollup: true,
          rollupEligible: false,
          commissionEligible: false,
          networkSalesEligible: false
        });
      }

      if (!wSnap.empty) {
        batch.update(wSnap.docs[0].ref, {
          usdtBalance: increment(totalAddUsdt),
          totalDeposit: increment(totalAddUsdt),
          weeklyTickets: increment(newTickets)
        });
      }
      
      // 주간 잭팟 전체 티켓 수 증가
      if (newTickets > 0) {
        batch.update(doc(db, 'events', 'weekly_jackpot'), {
           totalTickets: increment(newTickets)
        });
      }
      // 실제 입금 승인 시 출금 제한 해제
      batch.update(doc(db, 'users', tx.userId), { withdrawSuspended: false });
      
      await batch.commit();
      await this._auditLog(adminId, 'deposit', `입금 승인 ${tx.amount} USDT`, { txId, userId: tx.userId });

      // 4. [센터/부센터피] (Center & Sub-Center Fee) - 별도 지갑(centerBalance, subCenterBalance) 누적
      try {
        const uSnap = await getDoc(doc(db, 'users', tx.userId));
        if (uSnap.exists()) {
          const uData = uSnap.data();
          if (uData.centerId) {
            const cSnap = await getDoc(doc(db, 'centers', uData.centerId));
            if (cSnap.exists()) {
              const cData = cSnap.data();
              const ratesSnap = await getDoc(doc(db, 'settings', 'rates'));
              const centerFeePct = ratesSnap.exists() ? (Number(ratesSnap.data().rate_centerFee) || 5) : 5;
              const priceSnap = await getDoc(doc(db, 'settings', 'deedraPrice'));
              const dedraRate = priceSnap.exists() ? (Number(priceSnap.data().price) || 0.5) : 0.5;
              const amount = parseFloat(tx.amount) || 0;

              // 4-1. 센터장 수수료 (centerBalance)
              if (cData.managerId && centerFeePct > 0) {
                const feeUsdt = amount * (centerFeePct / 100);
                const mWalletQ = query(collection(db, 'wallets'), where('userId', '==', cData.managerId));
                const mWSnap = await getDocs(mWalletQ);
                if (!mWSnap.empty) {
                  const mWalletRef = mWSnap.docs[0].ref;
                  await updateDoc(mWalletRef, {
                    centerBalance: increment(feeUsdt),
                    totalCenterEarnings: increment(feeUsdt)
                  });
                  await addDoc(collection(db, 'bonuses'), {
                    userId: cData.managerId,
                    fromUserId: tx.userId,
                    type: 'center_fee',
                    amount: parseFloat((feeUsdt / dedraRate).toFixed(8)),
                    amountUsdt: parseFloat(feeUsdt.toFixed(8)),
                    reason: `센터피 ${centerFeePct}% (기준: ${uData.name || tx.userId}, 입금: ${amount} USDT)`,
                    grantedBy: adminId || 'system',
                    createdAt: serverTimestamp()
                  });
                }
              }

              // 4-2. 부센터장 수수료 (subCenterBalance)
              if (cData.subCenters && Array.isArray(cData.subCenters)) {
                for (const sub of cData.subCenters) {
                  if (sub.userId && sub.rate && Number(sub.rate) > 0) {
                    const subRate = Number(sub.rate);
                    const subFeeUsdt = amount * (subRate / 100);
                    const subQ = query(collection(db, 'wallets'), where('userId', '==', sub.userId));
                    const subSnap = await getDocs(subQ);
                    if (!subSnap.empty) {
                      const subWalletRef = subSnap.docs[0].ref;
                      await updateDoc(subWalletRef, {
                        subCenterBalance: increment(subFeeUsdt),
                        totalSubCenterEarnings: increment(subFeeUsdt)
                      });
                      await addDoc(collection(db, 'bonuses'), {
                        userId: sub.userId,
                        fromUserId: tx.userId,
                        type: 'sub_center_fee',
                        amount: parseFloat((subFeeUsdt / dedraRate).toFixed(8)),
                        amountUsdt: parseFloat(subFeeUsdt.toFixed(8)),
                        reason: `부센터피 ${subRate}% (기준: ${uData.name || tx.userId}, 입금: ${amount} USDT)`,
                        grantedBy: adminId || 'system',
                        createdAt: serverTimestamp()
                      });
                    }
                  }
                }
              }
            }
          }
        }
      } catch (e) {
        console.error("Center/Sub-center fee error during manual approve:", e);
      }


      // ── 관리자 알림: 수동 입금 승인 (SYSTEM 자동승인이 아닌 경우만) ──
      if (adminId !== 'SYSTEM_AUTO_APPROVE') {
        await this._sendAdminNotification(
          'deposit_success',
          '✅ 입금 수동 승인 완료',
          `${tx.userEmail || tx.userId} 님의 ${tx.amount} USDT 입금을 수동 승인했습니다.`,
          { txId, userId: tx.userId, amount: tx.amount }
        );
      }

      // ── 🔔 자동 규칙: 입금 완료 알림 ──────────────────────────────
      try {
        const depUserSnap = await getDoc(doc(db, 'users', tx.userId));
        const depUser = depUserSnap.exists() ? depUserSnap.data() : {};
        await this.fireAutoRules('deposit_complete', tx.userId, {
          name:   depUser.name || depUser.referralCode || tx.userId,
          amount: tx.amount || 0,
          rank:   depUser.rank || 'G0',
        }, adminId);
        
        // [신규] 하부 회원이 입금했을 때 상위 추천인들에게 마스킹된 입금 알림 전송
        if (depUserSnap.exists()) {
          await this.fireReferralDepositNotification(tx.userId, depUser, tx.amount || 0);
        }
      } catch(e) { console.warn('deposit_complete noti error', e); }

      // ── 직급차 풀 보너스: 입금 승인 즉시 실시간 처리 ──────────────
      // enableRankGapBonus + realtimeOnDeposit 둘 다 true 일 때만 실행
      // 기준 금액 = 입금액(tx.amount) 자체를 D 로 사용
      try {
        const ratesR2 = await this.getRates();
        const rates2  = ratesR2.success ? ratesR2.data : {};
        if (rates2.enableRankGapBonus && rates2.rankGapRealtimeOnDeposit) {
          const todayStr = new Date().toISOString().slice(0, 10);
          await this._processRankGapBonus(
            tx.userId, tx.amount || 0, rates2,
            this.db, `deposit_realtime:${adminId}`, todayStr, null
          );
        }
      } catch (rgbErr) {
        console.warn('[RankGapBonus] 실시간 입금 보너스 실패:', rgbErr);
      }

      // ※ 유니레벨 보너스는 입금 즉시가 아니라,
      //   회원이 USDT로 투자 상품을 구매하고
      //   그 상품에서 매일 발생하는 ROI(D)를 기준으로 지급됩니다.
      //   → runDailyROISettlement() 를 통해 일별 정산 시 처리됩니다.

      // ── enableAutoPromotion: 입금 승인 시 자동 직급 승진 체크 ──────────────
      // 입금자 본인 + 위쪽 추천인 체인 전원 동시 체크
      try {
        const settingsR = await this.getRankPromotionSettings();
        if (settingsR.success && settingsR.data.enableAutoPromotion) {
          const promoSettings = settingsR.data;

          // 체인 구성: 입금자부터 위로 모든 추천인 수집
          const usersSnap = await getDocs(collection(this.db, 'users'));
          const userMap   = Object.fromEntries(
            usersSnap.docs.map(d => [d.id, { id: d.id, ...d.data() }])
          );

          const chainIds = [];
          let cur = tx.userId;
          const visited = new Set();
          while (cur && !visited.has(cur)) {
            visited.add(cur);
            chainIds.push(cur);
            cur = userMap[cur]?.referredBy;
          }

          // 전원 병렬 체크 (입금자 → 최상위 추천인 순)
          await Promise.allSettled(
            chainIds.map(uid => this._checkAndPromoteSingleUser(uid, promoSettings, adminId))
          );
        }
      } catch (promoErr) {
        // 자동 승진 실패해도 입금 승인은 성공으로 처리
        console.warn('[AutoPromotion] 자동 직급 체크 실패:', promoErr);
      }

      return ok(true);
    } catch(e) { return err(e); }
  }

  async rejectDeposit(txId, adminId, reason) {
    try {
      await updateDoc(doc(this.db, 'transactions', txId), {
        status: 'rejected', rejectedAt: serverTimestamp(), rejectedBy: adminId, rejectReason: reason
      });
      await this._auditLog(adminId, 'deposit', `입금 거부: ${reason}`, { txId });
      return ok(true);
    } catch(e) { return err(e); }
  }

  // ─────────────────────────────────────────────────
  // 지갑 연동 입금 제출 + 온체인 검증 후 자동 승인
  // ─────────────────────────────────────────────────
  /**
   * 회원이 Phantom/TokenPocket 으로 전송 완료 후 호출
   * 1. Firestore에 pending 거래 저장
   * 2. 온체인 검증 (Solana RPC)
   * 3. 검증 성공 시 자동 승인 (approveDeposit 호출)
   *
   * @param {string} userId
   * @param {string} userEmail
   * @param {number} amount       USDT 금액
   * @param {string} signature    Solana 트랜잭션 서명 해시
   * @param {string} fromAddress  보낸 지갑 주소
   * @param {string} toAddress    받는 지갑 주소 (회사)
   */
  async submitWalletDeposit(userId, userEmail, amount, signature, fromAddress, toAddress) {
    try {
      const db = this.db;

      // 중복 서명 체크
      const dupQ = await getDocs(query(
        collection(db, 'transactions'),
        where('txid', '==', signature),
        limit(1)
      ));
      if (!dupQ.empty) throw new Error('이미 처리된 트랜잭션입니다');

      // 1. Firestore에 거래 저장 (pending)
      const txRef = await addDoc(collection(db, 'transactions'), {
        userId, userEmail,
        type:        'deposit',
        amount:      parseFloat(amount),
        currency:    'USDT',
        txid:        signature,
        fromAddress,
        toAddress,
        source:      'wallet_connect',  // 지갑 연동 입금 표시
        status:      'pending',
        createdAt:   serverTimestamp(),
      });
      const txId = txRef.id;

      // 2. 온체인 검증 (Solana RPC)
      const SOLANA_RPC = 'https://solana-rpc.publicnode.com';
      let verified = false;
      let verifyError = '';

      try {
        // 최대 30초 대기 (블록 확인 시간)
        for (let i = 0; i < 15; i++) {
          const res = await fetch(SOLANA_RPC, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              jsonrpc:'2.0', id:1, method:'getTransaction',
              params: [signature, { encoding:'jsonParsed', maxSupportedTransactionVersion:0 }]
            })
          });
          const data = await res.json();
          const tx = data?.result;
          if (!tx) { await new Promise(r => setTimeout(r, 2000)); continue; }

          // 에러 확인
          if (tx.meta?.err) { verifyError = 'TX_ON_CHAIN_ERROR'; break; }

          // 회사 지갑들 가져오기
          let companyWallets = [];
          try {
            const cwSnap = await getDoc(doc(db, 'settings', 'companyWallets'));
            if (cwSnap.exists() && cwSnap.data().wallets) {
              companyWallets = cwSnap.data().wallets
                .filter(w => w.network.includes('Solana') && w.address)
                .map(w => w.address);
            }
          } catch(e) {}
          // 기본 지갑 폴백
          if (companyWallets.length === 0) companyWallets.push('9Cix8agTnPSy26JiPGeq7hoBqBQbc8zsaXpmQSBsaTMW');
          
          const usdtMint = 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB';
          
          // 잔고 변화 기반 검증 (가장 정확함)
          const pre = tx.meta?.preTokenBalances || [];
          const post = tx.meta?.postTokenBalances || [];
          
          let totalReceivedByCompany = 0;
          
          for (const cw of companyWallets) {
            let preAmount = 0;
            let postAmount = 0;
            
            for (const b of pre) {
              if (b.owner === cw && b.mint === usdtMint) {
                preAmount = parseFloat(b.uiTokenAmount?.uiAmountString || '0');
              }
            }
            for (const b of post) {
              if (b.owner === cw && b.mint === usdtMint) {
                postAmount = parseFloat(b.uiTokenAmount?.uiAmountString || '0');
              }
            }
            totalReceivedByCompany += (postAmount - preAmount);
          }
          
          if (totalReceivedByCompany >= amount * 0.99) {
            verified = true;
            break;
          }
          await new Promise(r => setTimeout(r, 2000));
        }
      } catch(verErr) {
        verifyError = verErr.message;
      }

      // 3. 검증 결과 처리
      if (verified) {
        // 자동 승인 (SYSTEM 계정으로)
        await this.approveDeposit(txId, 'SYSTEM_AUTO_APPROVE');
        await updateDoc(doc(db, 'transactions', txId), {
          autoApproved: true, autoApprovedAt: serverTimestamp()
        });
        // ── 관리자 알림: 자동 승인 성공 ──────────────────────────
        await this._sendAdminNotification(
          'deposit_success',
          '✅ 입금 자동 승인 완료',
          `${userEmail} 님의 ${amount} USDT 입금이 온체인 검증 후 자동 승인되었습니다.`,
          { txId, userId, userEmail, amount, signature }
        );
        return ok({ txId, autoApproved: true, signature });
      } else {
        // 검증 실패 → pending 유지 (관리자 수동 확인)
        await updateDoc(doc(db, 'transactions', txId), {
          verifyFailed: true, verifyError, verifyAttemptedAt: serverTimestamp()
        });
        // ── 관리자 알림: 자동 승인 실패 → 수동 확인 필요 ────────
        await this._sendAdminNotification(
          'deposit_failed',
          '⚠️ 입금 수동 확인 필요',
          `${userEmail} 님의 ${amount} USDT 입금 온체인 검증 실패. 수동 승인이 필요합니다. (사유: ${verifyError || '확인 불가'})`,
          { txId, userId, userEmail, amount, signature, verifyError }
        );
        
        try {
          await fetch('/api/admin/notify-deposit-request', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              amount: amount,
              email: userEmail || userId,
              txid: signature,
              docId: txId
            })
          });
        } catch(e) { console.error('Telegram notification error', e); }

        return ok({ txId, autoApproved: false, signature, verifyError });
      }
    } catch(e) { return err(e); }
  }

  // ─────────────────────────────────────────────────
  // 출금 처리
  // ─────────────────────────────────────────────────

  
  async markWithdrawalProcessing(txId, adminId) {
    try {
      const db = this.db;
      // We do a transaction to ensure no double-processing
      const txRef = doc(db, 'transactions', txId);
      const res = await runTransaction(db, async (t) => {
        const txSnap = await t.get(txRef);
        if (!txSnap.exists()) throw new Error('거래 없음');
        const tx = txSnap.data();
        if (tx.status !== 'pending' && tx.status !== 'held' && tx.status !== 'failed') {
          if (tx.status === 'processing') throw new Error('이미 다른 관리자가 처리 중(송금 진행 중)인 건입니다. 중복 송금 위험이 있어 차단되었습니다.');
          throw new Error('이미 처리된 거래입니다. 상태: ' + tx.status);
        }
        // Mark as processing
        t.update(txRef, {
          status: 'processing',
          processingAt: serverTimestamp(),
          processingBy: adminId
        });
        return true;
      });
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  async failWithdrawalProcessing(txId, adminId, reason = '') {
    try {
      const db = this.db;
      await updateDoc(doc(db, 'transactions', txId), {
        status: 'failed',
        processingFailedAt: serverTimestamp(),
        adminMemo: reason || '송금 실패'
      });
      return { success: true };
    } catch(e) {
      return { success: false };
    }
  }

  async approveWithdrawal(txId, adminId, txid, memo, amountDedra) {
    try {
      const db = this.db;
      const txSnap = await getDoc(doc(db, 'transactions', txId));
      if (!txSnap.exists()) throw new Error('거래 없음');
      const tx = txSnap.data();
      if (tx.status !== 'pending' && tx.status !== 'processing' && tx.status !== 'held' && tx.status !== 'failed') throw new Error('처리 가능한 상태가 아닙니다: ' + tx.status);

      const updateData = {
        status: 'approved', approvedAt: serverTimestamp(), approvedBy: adminId,
        txid: txid || ''
      };
      if (memo) updateData.adminMemo = memo;
      if (amountDedra !== undefined && amountDedra !== null) {
          updateData.amount = amountDedra;
          updateData.amountDedra = amountDedra;
      }

      await updateDoc(doc(db, 'transactions', txId), updateData);
      const loggedAmount = amountDedra !== undefined ? amountDedra : tx.amount;
      await this._auditLog(adminId, 'withdrawal', `출금 승인 ${tx.amountUsdt || tx.amount} USDT → ${loggedAmount} DDRA (TXID: ${txid})`, { txId, userId: tx.userId });
      // ── 관리자 알림: 출금 승인 ────────────────────────────────
      await this._sendAdminNotification(
        'withdrawal',
        '💸 출금 승인 완료',
        `${tx.userEmail || tx.userId} 님의 ${tx.amountUsdt || tx.amount} USDT 출금 신청이 승인되었습니다.`,
        { txId, userId: tx.userId, amount: tx.amountUsdt || tx.amount }
      );

      // ── 🔔 자동 규칙: 출금 완료/승인 알림 ─────────────────────────────
      try {
        const wdUserSnap = await getDoc(doc(db, 'users', tx.userId));
        const wdUser = wdUserSnap.exists() ? wdUserSnap.data() : {};
        const wdVars = {
          name:   wdUser.name || wdUser.referralCode || tx.userId,
          amount: tx.amountUsdt || tx.amount || 0,
          rank:   wdUser.rank || 'G0',
        };
        await this.fireAutoRules('withdrawal_complete', tx.userId, wdVars, adminId);
        await this.fireAutoRules('withdrawal_approved', tx.userId, wdVars, adminId);
      } catch(_) { /* 자동 규칙 실패 시 출금 승인에 영향 없음 */ }

      return ok(true);
    } catch(e) { return err(e); }
  }

  async rejectWithdrawal(txId, adminId, reason) {
    try {
      const db = this.db;
      const txSnap = await getDoc(doc(db, 'transactions', txId));
      if (!txSnap.exists()) throw new Error('거래 없음');
      const tx = txSnap.data();

      const batch = writeBatch(db);
      // 거부된 출금은 이력에 남기지 않고 삭제 (요청사항 반영)
      batch.delete(doc(db, 'transactions', txId));
      
      // bonusBalance 복구 (출금 신청 시 bonusBalance에서 USDT를 차감했으므로 되돌림)
      const usdtAmt = tx.amountUsdt || tx.amount || 0;
      const walletRef = doc(db, 'wallets', tx.userId);
      const wSnap = await getDoc(walletRef);
      let ticketsToRestore = tx.burnedWeeklyTickets || 0; // 출금 신청시 소진된 티켓
      
      if (wSnap.exists()) {
        batch.update(walletRef, {
          bonusBalance: increment(usdtAmt),
          totalWithdrawal: increment(-usdtAmt),
          weeklyTickets: increment(ticketsToRestore)
        });
      } else {
        const walletQ = query(collection(db, 'wallets'), where('userId', '==', tx.userId));
        const wsSnap = await getDocs(walletQ);
        if (!wsSnap.empty) {
          batch.update(wsSnap.docs[0].ref, {
            bonusBalance: increment(usdtAmt),
            totalWithdrawal: increment(-usdtAmt),
            weeklyTickets: increment(ticketsToRestore)
          });
        }
      }

/*
      // 주간 잭팟에서 적립되었던 상금 및 티켓 원상복구
      let feeUsdt = 0;
      if (tx.feeRate && tx.amountUsdt) {
         feeUsdt = tx.amountUsdt * (tx.feeRate / 100);
      }
      
      if (feeUsdt > 0 || ticketsToRestore > 0) {
        try {
          const jpSnap = await getDoc(doc(db, 'events', 'weekly_jackpot'));
          let amountToSubtract = 0;
          if (jpSnap.exists()) {
            const jpData = jpSnap.data();
            const accumRate = jpData.feeAccumulationRate !== undefined ? Number(jpData.feeAccumulationRate) : 100;
            amountToSubtract = feeUsdt * (accumRate / 100);
          } else {
            amountToSubtract = feeUsdt;
          }
          
          const jpUpdates = { lastUpdate: serverTimestamp() };
          if (amountToSubtract > 0) jpUpdates.amount = increment(-amountToSubtract); // 차감
          if (ticketsToRestore > 0) jpUpdates.totalTickets = increment(ticketsToRestore); // 차감됐던 티켓 복구
          
          if (amountToSubtract > 0 || ticketsToRestore > 0) {
            batch.set(doc(db, 'events', 'weekly_jackpot'), jpUpdates, { merge: true });
          }
        } catch(jpErr) { console.error('Jackpot revert error:', jpErr); }
      }
*/

      // 회원에게 출금 반려 알림 발송
      const userNotiRef = doc(collection(db, 'notifications'));
      batch.set(userNotiRef, {
        userId: tx.userId,
        title: '❌ 출금 신청 반려 안내',
        message: `회원님의 출금 신청이 반려/취소되었습니다.\n사유: ${reason}\n\n취소된 금액은 지갑 잔액으로 자동 복구되었습니다. 사유 확인(지갑 주소 확인 등) 후 다시 신청해주시기 바랍니다.`,
        type: 'system',
        priority: 'high',
        icon: '⚠️',
        color: '#ef4444',
        isRead: false,
        createdAt: serverTimestamp()
      });

      await batch.commit();
      await this._auditLog(adminId, 'withdrawal', `출금 거부: ${reason}`, { txId });
      // ── 관리자 알림: 출금 거부 ────────────────────────────────
      await this._sendAdminNotification(
        'withdrawal',
        '❌ 출금 거부 처리',
        `${tx.userEmail || tx.userId} 님의 출금 신청이 거부되었습니다. (사유: ${reason})`,
        { txId, userId: tx.userId, reason }
      );
      // ── 🔔 자동 규칙: 출금 거부 알림 ─────────────────────────────
      try {
        const wdUserSnap = await getDoc(doc(db, 'users', tx.userId));
        const wdUser = wdUserSnap.exists() ? wdUserSnap.data() : {};
        await this.fireAutoRules('withdrawal_rejected', tx.userId, {
          name:   wdUser.name || wdUser.referralCode || tx.userId,
          amount: tx.amountUsdt || tx.amount || 0,
          rank:   wdUser.rank || 'G0',
        }, adminId);
      } catch(_) { /* 자동 규칙 실패 시 출금 거부에 영향 없음 */ }
      return ok(true);
    } catch(e) { return err(e); }
  }

  // ─────────────────────────────────────────────────
  // 회원 관리
  // ─────────────────────────────────────────────────
  async updateMemberInfo(adminId, userId, updates) {
    try {
      await updateDoc(doc(this.db, 'users', userId), { ...updates, updatedAt: serverTimestamp() });
      await this._auditLog(adminId, 'member', `회원 정보 수정: ${userId}`, updates);
      return ok(true);
    } catch(e) { return err(e); }
  }

  async adjustWalletBalance(adminId, userId, field, newVal, reason) {
    try {
      const db = this.db;
      // wallets 문서ID = userId (setDoc(doc(db,'wallets',uid)) 방식)
      // 먼저 문서ID로 직접 조회, 없으면 userId 필드로 fallback
      let wRef = null, oldData = {};
      const directSnap = await getDoc(doc(db, 'wallets', userId));
      if (directSnap.exists()) {
        wRef = directSnap.ref;
        oldData = directSnap.data();
      } else {
        const walletQ = query(collection(db, 'wallets'), where('userId', '==', userId));
        const wSnap = await getDocs(walletQ);
        if (wSnap.empty) throw new Error('지갑 없음');
        wRef = wSnap.docs[0].ref;
        oldData = wSnap.docs[0].data();
      }
      const oldVal = parseFloat(oldData[field] || 0);
      const nv     = parseFloat(newVal);
      const delta  = nv - oldVal;

      await updateDoc(wRef, { [field]: nv, updatedAt: serverTimestamp() });

      // ── 유저 트랜잭션 이력 기록 (유저가 직접 볼 수 있게) ──
      const FIELD_LABELS = {
        bonusBalance:  '출금가능 잔액',
        usdtBalance:   '총 USDT 잔액',
        totalDeposit:  '총 입금액',
        totalEarnings: '누적 수익',
        totalInvested: '운용중 금액',
        dedraBalance:  'DDRA 잔액',
      };
      
      // bonusBalance 변경이면 bonuses 컬렉션에도 저장 (유저의 수익 내역에 표시됨)
      if (field === 'bonusBalance') {
        await addDoc(collection(db, 'bonuses'), {
          userId,
          adminId,
          type: 'manual_bonus',
          amount: delta, // DDRA rate consideration? usually it shows as usdt if we set amountUsdt
          amountUsdt: delta,
          reason: `[${FIELD_LABELS[field] || field} 직접 수정] $ ${oldVal.toFixed(2)} → $ ${nv.toFixed(2)}`,
          status: 'approved',
          createdAt: serverTimestamp(),
        });
      }

      await addDoc(collection(db, 'transactions'), {
        userId,
        type: 'admin_adjust',
        amount: Math.abs(delta),
        prevAmount: oldVal,
        delta: delta,
        field: field,
        withdrawable: true,
        reason: `[${FIELD_LABELS[field] || field} 직접 수정] $ ${oldVal.toFixed(2)} → $ ${nv.toFixed(2)}`,
        status: 'approved',
        adminId,
        createdAt: serverTimestamp(),
      });


      // ── 변경 이력 저장 (memberEditLogs 컬렉션) ──
      await addDoc(collection(db, 'memberEditLogs'), {
        userId,
        adminId,
        field,
        fieldLabel:  FIELD_LABELS[field] || field,
        oldVal,
        newVal:      nv,
        delta,
        reason:      reason || '',
        createdAt:   serverTimestamp(),
      });

      await this._auditLog(adminId, 'wallet_adjust',
        `잔액 수정 (${FIELD_LABELS[field]||field}): ${oldVal.toFixed(2)} → ${nv.toFixed(2)} (${delta >= 0 ? '+' : ''}${delta.toFixed(2)})`,
        { userId, reason, field, oldVal, newVal: nv, delta }
      );
      return ok({ oldVal, newVal: nv, delta });
    } catch(e) { return err(e); }
  }

  // ─────────────────────────────────────────────────
  // 회원 키워드 검색 (아이디/이름/이메일 한두 글자도 검색)
  // ─────────────────────────────────────────────────
  async searchUsersByKeyword(keyword) {
    try {
      const db = this.db;
      const snap = await getDocs(query(collection(db, 'users'), where('role', '!=', 'admin')));
      const kw = (keyword || '').trim().toLowerCase();
      if (!kw) return ok([]);
      const results = [];
      for (const d of snap.docs) {
        const u = { id: d.id, ...d.data() };
        const idMatch    = (u.id || '').toLowerCase().includes(kw);
        const nameMatch  = (u.name || '').toLowerCase().includes(kw);
        const emailMatch = (u.email || '').toLowerCase().includes(kw);
        if (idMatch || nameMatch || emailMatch) results.push(u);
        if (results.length >= 20) break; // 최대 20명
      }
      return ok(results);
    } catch(e) { return err(e); }
  }

  // ─────────────────────────────────────────────────
  // 회원 USDT 잔액 직접 수정
  //   - sourceType: 'manual_add' | 'manual_set'
  //   - withdrawable: true = 인출 가능 / false = 인출 불가 (상품 구매만 가능)
  // ─────────────────────────────────────────────────
  async setUsdtBalanceDirect(adminId, userId, newAmount, withdrawable, reason) {
    try {
      const db = this.db;
      const amt = parseFloat(newAmount);
      if (isNaN(amt) || amt < 0) throw new Error('유효하지 않은 금액입니다');

      // 지갑 조회
      const walletQ = query(collection(db, 'wallets'), where('userId', '==', userId));
      const wSnap   = await getDocs(walletQ);
      if (wSnap.empty) throw new Error('지갑이 없습니다');
      const wRef  = wSnap.docs[0].ref;
      const wData = wSnap.docs[0].data();

      const oldUsdt   = wData.usdtBalance   || 0;
      const oldLocked = wData.lockedBalance  || 0; // 인출불가 누적

      // 인출 불가 금액은 lockedBalance 에 따로 누적
      // usdtBalance 는 항상 전체 잔액 (인출가능 + 불가 합산)
      const updateData = {
        usdtBalance:  amt,
        updatedAt:    serverTimestamp(),
      };
      if (!withdrawable) {
        // 기존 lockedBalance + 증가분을 누적
        const delta  = amt - oldUsdt;
        const newLocked = Math.max(0, oldLocked + (delta > 0 ? delta : 0));
        updateData.lockedBalance = newLocked;
      }

      await updateDoc(wRef, updateData);

      // 트랜잭션 이력 기록
      await addDoc(collection(db, 'transactions'), {
        userId,
        type:           'admin_adjust',
        amount:         amt,
        prevAmount:     oldUsdt,
        delta:          amt - oldUsdt,
        withdrawable:   withdrawable === true,
        reason:         reason || '관리자 직접 수정',
        status:         'approved',
        adminId,
        createdAt:      serverTimestamp(),
        approvedAt:     serverTimestamp(),
      });

      await this._auditLog(adminId, 'wallet_adjust',
        `USDT 직접 수정: ${oldUsdt.toFixed(2)} → ${amt.toFixed(2)} USDT (${withdrawable ? '인출가능' : '인출불가'})`,
        { userId, oldUsdt, newUsdt: amt, withdrawable, reason }
      );
      return ok({ oldUsdt, newUsdt: amt });
    } catch(e) { return err(e); }
  }

  // ─────────────────────────────────────────────────
  // 회원 지갑 정보 + 활성 투자 여부 조회 (USDT 수정 패널용)
  // ─────────────────────────────────────────────────
  async getUserWalletInfo(userId) {
    try {
      const db = this.db;
      const [walletSnap, invSnap] = await Promise.all([
        getDocs(query(collection(db, 'wallets'), where('userId', '==', userId))),
        getDocs(query(collection(db, 'investments'), where('userId', '==', userId), where('status', '==', 'active'))),
      ]);
      if (walletSnap.empty) throw new Error('지갑 없음');
      const wallet = walletSnap.docs[0].data();
      const hasActiveInvestment = !invSnap.empty;
      const totalInvested = invSnap.docs.reduce((s, d) => s + (d.data().amount || 0), 0);
      return ok({
        usdtBalance:   wallet.usdtBalance   || 0,
        lockedBalance: wallet.lockedBalance  || 0,
        bonusBalance:  wallet.bonusBalance   || 0,
        hasActiveInvestment,
        totalInvested,
      });
    } catch(e) { return err(e); }
  }

  async giveManualBonus(adminId, userId, amount, reason, bonusType = 'balance', prodInfo = null) {
    try {
      const db = this.db;
      const amt = parseFloat(amount);
      const walletQ = query(collection(db, 'wallets'), where('userId', '==', userId));
      const wSnap = await getDocs(walletQ);
      if (wSnap.empty) throw new Error('지갑 없음');
      
      const batch = writeBatch(db);
      
      if (bonusType === 'freeze') {
        if (!prodInfo) throw new Error('상품 정보가 필요합니다.');
        // Create an investment document for the user
        const startDate = new Date();
        const endDate = new Date(startDate.getTime() + prodInfo.days * 86400000);
        const expectedReturn = (amt * prodInfo.roi / 100);
        
        const invRef = doc(collection(db, 'investments'));
        batch.set(invRef, {
          userId: userId, productId: prodInfo.id,
          productName: prodInfo.name, amount: amt, amountUsdt: amt,
          roiPercent: prodInfo.roi, durationDays: prodInfo.days,
          expectedReturn, status: 'active',
          startDate: serverTimestamp(), endDate,
          createdAt: serverTimestamp(),
          isBonus: true, excludeFromSales: true // Important flags for bonus
        });
        
        // Add to bonusInvest
        batch.update(wSnap.docs[0].ref, {
          bonusInvest: increment(amt)
        });
        
        // Log bonus
        const bonusRef = doc(collection(db, 'bonuses'));
        batch.set(bonusRef, {
          userId, amount: amt, reason: `[프리즈상품] ${reason}`, type: 'manual_bonus',
          grantedBy: adminId, createdAt: serverTimestamp()
        });
        
        await batch.commit();
        await this._auditLog(adminId, 'bonus', `수동 보너스 프리즈상품 ${amt} USDT 지급`, { userId, reason, prodInfo });
      } else {
        // 기존 방식
        batch.update(wSnap.docs[0].ref, { bonusBalance: increment(amt), totalEarnings: increment(amt) });
        const bonusRef = doc(collection(db, 'bonuses'));
        batch.set(bonusRef, {
          userId, amount: amt, reason, type: 'manual_bonus',
          grantedBy: adminId, createdAt: serverTimestamp()
        });
        await batch.commit();
        await this._auditLog(adminId, 'bonus', `수동 보너스 수익잔액 ${amt} USDT 지급`, { userId, reason });
      }
      
      return ok(true);
    } catch(e) { return err(e); }
  }

  async updateUserRank(userId, newRank, adminId) {
    try {
      await updateDoc(doc(this.db, 'users', userId), { rank: newRank, updatedAt: serverTimestamp() });
      await this._auditLog(adminId, 'rank', `직급 변경: ${userId} → ${newRank}`, { userId, newRank });
      return ok(true);
    } catch(e) { return err(e); }
  }

  async appointCenterManager(adminId, userId, memberName) {
    try {
      // 1. 기존 centers 컬렉션에서 이 회원이 이미 센터를 갖고 있는지 확인
      const existSnap = await getDocs(query(collection(this.db, 'centers'), where('leaderId', '==', userId)));
      let centerId;
      if (!existSnap.empty) {
        // 이미 센터 있음 → 재활성화만
        centerId = existSnap.docs[0].id;
        await updateDoc(doc(this.db, 'centers', centerId), { isActive: true, updatedAt: serverTimestamp() });
      } else {
        // 새 센터 문서 생성
        const centerRef = await addDoc(collection(this.db, 'centers'), {
          name:         `${memberName} 센터`,
          leaderId:     userId,
          leaderName:   memberName,
          managerName:  memberName,
          region:       '',
          address:      '',
          managerEmail: '',
          managerPhone: '',
          description:  '',
          memberCount:  0,
          isActive:     true,
          createdAt:    serverTimestamp(),
          updatedAt:    serverTimestamp(),
        });
        centerId = centerRef.id;
      }
      // 2. users 문서에 센터장 정보 업데이트
      await updateDoc(doc(this.db, 'users', userId), {
        isCenterManager:  true,
        managingCenterId: centerId,
        updatedAt:        serverTimestamp(),
      });
      await this._auditLog(adminId, 'member', `센터장 임명: ${memberName}`, { userId, centerId });
      return ok({ centerId });
    } catch(e) { return err(e); }
  }

  async revokeCenterManager(adminId, userId) {
    try {
      // centers 컬렉션에서 비활성화
      const snap = await getDocs(query(collection(this.db, 'centers'), where('leaderId', '==', userId)));
      for (const d of snap.docs) {
        await updateDoc(doc(this.db, 'centers', d.id), { isActive: false, updatedAt: serverTimestamp() });
      }
      await updateDoc(doc(this.db, 'users', userId), {
        isCenterManager:  false,
        managingCenterId: null,
        updatedAt:        serverTimestamp(),
      });
      await this._auditLog(adminId, 'member', `센터장 해임: ${userId}`, { userId });
      return ok(true);
    } catch(e) { return err(e); }
  }

  // ─────────────────────────────────────────────────
  // 공지사항
  // ─────────────────────────────────────────────────
  async getAnnouncements() {
    try {
      const snap = await getDocs(collection(this.db, 'announcements'));
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      return ok(data);
    } catch(e) { return err(e); }
  }

  // 번역 API 호출 헬퍼 (백엔드 /api/translate/announcement)
  async _fetchTranslations(title, content) {
    try {
      const res = await fetch('/api/translate/announcement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, content })
      });
      if (!res.ok) return {};
      const data = await res.json();
      return data.translations || {};
    } catch (_) {
      return {}; // 번역 실패해도 저장은 진행
    }
  }

  async createAnnouncement(adminId, title, content, category, isPinned) {
    try {
      // 한국어 원문 저장 + 자동 번역 (en/vi/th)
      const translations = await this._fetchTranslations(title, content);
      const ref = await addDoc(collection(this.db, 'announcements'), {
        title, content, category: category || 'general',
        isPinned: !!isPinned, isActive: true,
        // 번역 필드 (번역 실패 시 빈 문자열)
        title_en: translations.title_en || '',
        title_vi: translations.title_vi || '',
        title_th: translations.title_th || '',
        content_en: translations.content_en || '',
        content_vi: translations.content_vi || '',
        content_th: translations.content_th || '',
        translatedAt: (translations.title_en) ? serverTimestamp() : null,
        createdBy: adminId, createdAt: serverTimestamp(), updatedAt: serverTimestamp()
      });
      await this._auditLog(adminId, 'notice', `공지 생성: ${title}`, { id: ref.id });
      return ok({ id: ref.id });
    } catch(e) { return err(e); }
  }

  async updateAnnouncement(adminId, noticeId, updates) {
    try {
      // 제목/내용 변경 시 번역 재수행
      let extraFields = {};
      if (updates.title || updates.content) {
        const translations = await this._fetchTranslations(updates.title, updates.content);
        extraFields = {
          title_en: translations.title_en || '',
          title_vi: translations.title_vi || '',
          title_th: translations.title_th || '',
          content_en: translations.content_en || '',
          content_vi: translations.content_vi || '',
          content_th: translations.content_th || '',
          translatedAt: (translations.title_en) ? serverTimestamp() : null,
        };
      }
      await updateDoc(doc(this.db, 'announcements', noticeId), {
        ...updates, ...extraFields, updatedAt: serverTimestamp()
      });
      await this._auditLog(adminId, 'notice', `공지 수정: ${updates.title || noticeId}`, { id: noticeId });
      return ok(true);
    } catch(e) { return err(e); }
  }

  async deleteAnnouncement(adminId, noticeId) {
    try {
      await deleteDoc(doc(this.db, 'announcements', noticeId));
      await this._auditLog(adminId, 'notice', `공지 삭제: ${noticeId}`, { id: noticeId });
      return ok(true);
    } catch(e) { return err(e); }
  }

  // ─────────────────────────────────────────────────
  // 뉴스 / 소식
  // ─────────────────────────────────────────────────
  async getNews() {
    try {
      const snap = await getDocs(collection(this.db, 'news'));
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      return ok(data);
    } catch(e) { return err(e); }
  }

  async createNews(adminId, newsData) {
    try {
      // 자동 번역 요청
      let translations = {};
      try {
        const res = await fetch('/api/translate/news', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            title: newsData.title || '', 
            summary: newsData.summary || '', 
            content: newsData.content || '' 
          })
        });
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.translations) {
            translations = data.translations;
          }
        }
      } catch (err) {
        console.error('News translation API error:', err);
      }

      const ref = await addDoc(collection(this.db, 'news'), {
        ...newsData, 
        // 번역 데이터 병합
        title_en: translations.title_en || '',
        title_vi: translations.title_vi || '',
        title_th: translations.title_th || '',
        summary_en: translations.summary_en || '',
        summary_vi: translations.summary_vi || '',
        summary_th: translations.summary_th || '',
        content_en: translations.content_en || '',
        content_vi: translations.content_vi || '',
        content_th: translations.content_th || '',
        translatedAt: (translations.title_en) ? serverTimestamp() : null,
        
        createdBy: adminId, 
        createdAt: serverTimestamp(), 
        updatedAt: serverTimestamp()
      });
      return ok({ id: ref.id });
    } catch(e) { return err(e); }
  }

  async updateNews(adminId, newsId, newsData) {
    try {
      await updateDoc(doc(this.db, 'news', newsId), { ...newsData, updatedAt: serverTimestamp() });
      return ok(true);
    } catch(e) { return err(e); }
  }

  async deleteNews(adminId, newsId) {
    try {
      await deleteDoc(doc(this.db, 'news', newsId));
      await this._auditLog(adminId, 'news', `뉴스 삭제: ${newsId}`, { id: newsId });
      return ok(true);
    } catch(e) { return err(e); }
  }

  // ─────────────────────────────────────────────────
  // 게임 로그
  // ─────────────────────────────────────────────────
  async getGameLogs(maxCount = 200) {
    try {
      const snap = await getDocs(query(collection(this.db, 'gamelogs'), limit(maxCount)));
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      return ok(data);
    } catch(e) { return err(e); }
  }

  // ─────────────────────────────────────────────────
  // 감사 로그
  // ─────────────────────────────────────────────────
  async getAuditLogs(maxCount = 500) {
    try {
      const snap = await getDocs(query(collection(this.db, 'auditLogs'), limit(maxCount)));
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        // timestamp(신규) 또는 createdAt(구형) 둘 다 지원
        .sort((a, b) => {
          const ta = a.timestamp?.seconds || a.createdAt?.seconds || 0;
          const tb = b.timestamp?.seconds || b.createdAt?.seconds || 0;
          return tb - ta;
        });
      return ok(data);
    } catch(e) { return err(e); }
  }

  // ─────────────────────────────────────────────────
  // 1:1 문의
  // ─────────────────────────────────────────────────
  async getAllTickets(statusFilter) {
    try {
      let q = collection(this.db, 'tickets');
      if (statusFilter) q = query(q, where('status', '==', statusFilter));
      const snap = await getDocs(q);
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      return ok(data);
    } catch(e) { return err(e); }
  }

  async replyTicket(adminId, ticketId, reply) {
    try {
      await updateDoc(doc(this.db, 'tickets', ticketId), {
        reply, repliedAt: serverTimestamp(), repliedBy: adminId, status: 'answered'
      });
      await this._auditLog(adminId, 'ticket', `문의 답변: ${ticketId}`, { ticketId });
      return ok(true);
    } catch(e) { return err(e); }
  }

  async closeTicket(adminId, ticketId) {
    try {
      await updateDoc(doc(this.db, 'tickets', ticketId), {
        status: 'closed', closedAt: serverTimestamp(), closedBy: adminId
      });
      return ok(true);
    } catch(e) { return err(e); }
  }

  // ─────────────────────────────────────────────────
  // 시스템 설정
  // ─────────────────────────────────────────────────
  async getSystemSettings() {
    try {
      const snap = await getDoc(doc(this.db, 'settings', 'system'));
      return ok(snap.exists() ? snap.data() : {});
    } catch(e) { return err(e); }
  }

  async updateSystemSettings(adminId, cfg) {
    try {
      await setDoc(doc(this.db, 'settings', 'system'), {
        ...cfg, updatedAt: serverTimestamp(), updatedBy: adminId
      }, { merge: true });
      await this._auditLog(adminId, 'settings', '시스템 설정 업데이트', cfg);
      return ok(true);
    } catch(e) { return err(e); }
  }

  async saveDedraRate(adminId, price, pairAddress = null, liveEnabled = false, source = null, priceChange24h = null) {
    try {
      const data = {
        price: parseFloat(price),
        updatedAt: serverTimestamp(),
        updatedBy: adminId,
        liveEnabled: !!liveEnabled,
      };
      // pairAddress: DEX 페어 주소 (Raydium DDRA/SOL 등)
      if (pairAddress !== null) {
        data.pairAddress = pairAddress;
        data.mintAddress = pairAddress; // 하위 호환성 유지
      }
      if (source      !== null) data.source      = source;
      if (priceChange24h !== null) data.priceChange24h = priceChange24h;
      await setDoc(doc(this.db, 'settings', 'deedraPrice'), data, { merge: true });
      await this._auditLog(adminId, 'settings', `DDRA 시세 변경: $${price}${liveEnabled ? ' (실시간)' : ' (수동)'}`, { price, liveEnabled, source, pairAddress });
      return ok(true);
    } catch(e) { return err(e); }
  }

  // ─────────────────────────────────────────────────
  // 보너스 지급 패턴 설정 (Bonus Payment Config)
  // Firestore: settings/bonusPaymentConfig
  // ─────────────────────────────────────────────────

  /**
   * 전역 옵션 + 상품별 지급 패턴 설정 가져오기
   * 구조: {
   *   globalOptions: { usePaymentPattern, useProductRate, useDynamicCalc },
   *   products: { [productId]: { paymentStartType, paymentFrequency, customPattern,
   *                              paymentDurationType, durationValue, isActive,
   *                              baseRate, policyARate, policyBRate } }
   * }
   */
  async getBonusPaymentConfig() {
    try {
      const snap = await getDoc(doc(this.db, 'settings', 'bonusPaymentConfig'));
      if (snap.exists()) return ok(snap.data());
      // 기본값
      return ok({
        globalOptions: {
          usePaymentPattern: false,   // 지급 패턴 설정 사용
          useProductRate:    false,   // 상품별 이율 관리 사용
          useDynamicCalc:    false,   // 구매 이력 기반 동적 계산 사용
        },
        products: {}
      });
    } catch(e) { return err(e); }
  }

  /**
   * 전역 옵션 + 상품별 지급 패턴 설정 저장
   */
  async saveBonusPaymentConfig(adminId, config) {
    try {
      await setDoc(doc(this.db, 'settings', 'bonusPaymentConfig'), {
        ...config, updatedAt: serverTimestamp(), updatedBy: adminId
      });
      await this._auditLog(adminId, 'settings', '보너스 지급 패턴 설정 변경', config.globalOptions || {});
      return ok(true);
    } catch(e) { return err(e); }
  }

  /**
   * 특정 날짜(Date)가 지급 패턴에 해당하는 날인지 체크
   * @param {object} productConfig  products[productId]
   * @param {Date}   targetDate
   * @param {Date}   purchaseStartDate  수익 지급 시작일
   * @returns {boolean}
   */
  _isPaymentDay(productConfig, targetDate, purchaseStartDate) {
    if (!productConfig || !productConfig.isActive) return false;
    if (targetDate < purchaseStartDate) return false;

    const freq = productConfig.paymentFrequency || 'DAILY';
    if (freq === 'DAILY') return true;

    const dayNames = ['SUN','MON','TUE','WED','THU','FRI','SAT'];
    const dow = dayNames[targetDate.getDay()];

    if (freq === 'WEEKLY') {
      // customPattern: ['MON'] 등 요일 1개
      const pattern = productConfig.customPattern || ['MON'];
      return pattern.includes(dow);
    }
    if (freq === 'MONTHLY') {
      // customPattern: [1] 등 일자
      const pattern = productConfig.customPattern || [1];
      return pattern.includes(targetDate.getDate());
    }
    if (freq === 'CUSTOM_PATTERN') {
      // customPattern: ['MON','WED','FRI'] 등 복수 요일
      const pattern = productConfig.customPattern || [];
      return pattern.includes(dow);
    }
    return true;
  }

  /**
   * ─────────────────────────────────────────────────────────────────
   * 핵심 보너스 분배 로직 (Policy A — 유니레벨)
   * ─────────────────────────────────────────────────────────────────
   * 호출 시점: 매일 정산 배치(runDailyROISettlement)에서 각 회원의
   *           일일 ROI 수익 D가 확정된 후 호출됩니다.
   *
   * 흐름:
   *   회원 A가 투자 상품에서 오늘 D USDT 수익 발생
   *   → 1대 추천인에게 D × unilevelRate[0] 지급
   *   → 2대 추천인에게 D × unilevelRate[1] 지급
   *   → ... (최대 10단계) — 직급 체크 없이 모든 추천인에게 분배
   *   → 직급 차이 보너스 포함
   *
   * @param {string} investUserId  투자(수익 발생) 회원 uid
   * @param {number} dailyIncome   해당 회원의 당일 ROI 수익 D (USDT 기준)
   * @param {object} rates         getRates() 결과 데이터
   * @param {object} db
   * @param {string} triggerBy     'daily_settlement' 등
   * @param {string} settlementDate  'YYYY-MM-DD' 정산 날짜
   */
  async _processUnilevelBonus(investUserId, dailyIncome, rates, db, triggerBy, settlementDate) {
    try {
      if (!dailyIncome || dailyIncome <= 0) return 0;

      const enableDirectBonus   = rates.enableDirectBonus   !== false;
      const enableUnilevel      = rates.enableUnilevel      !== false;
      const enableRankDiffBonus = rates.enableRankDiffBonus !== false;
      const unilevelRates       = rates.unilevelRates       || [10,7,5,4,3,2,2,1,1,1];
      const directBonus1        = rates.directBonus1        ?? 5;
      const directBonus2        = rates.directBonus2        ?? 2;
      const rankDiffRate        = rates.rankDiffBonusRate   ?? 0;

      if (!enableDirectBonus && !enableUnilevel) return 0;

      // 전체 회원 로드 (추천 체인 구성용)
      const usersSnap = await getDocs(collection(db, 'users'));
      const userMap   = Object.fromEntries(
        usersSnap.docs.map(d => [d.id, { id: d.id, ...d.data() }])
      );

      const investor = userMap[investUserId];
      if (!investor) return 0;

      const RANK_ORDER = ['G0','G1','G2','G3','G4','G5','G6','G7','G8','G9','G10'];
      const rankIdx = (r) => Math.max(0, RANK_ORDER.indexOf(r || 'G0'));

      let totalPaid  = 0;
      let currentId  = investor.referredBy;
      let level      = 1;

      while (currentId && level <= 10) {
        const ancestor = userMap[currentId];
        if (!ancestor || ancestor.role === 'admin') break;

        let bonusRate = 0;

        // Policy A — 단계별 이율 결정
        if (level === 1 && enableDirectBonus) {
          bonusRate = directBonus1 / 100;
        } else if (level === 2 && enableDirectBonus) {
          bonusRate = directBonus2 / 100;
        } else if (enableUnilevel) {
          bonusRate = (unilevelRates[level - 1] || 0) / 100;
        }

        // 직급 차이 보너스 (상위 추천인 직급 > 투자자 직급일 때 추가)
        if (enableRankDiffBonus && rankDiffRate > 0) {
          const diff = rankIdx(ancestor.rank) - rankIdx(investor.rank);
          if (diff > 0) bonusRate += (diff * rankDiffRate) / 100;
        }

        if (bonusRate > 0) {
          const bonusAmt = parseFloat((dailyIncome * bonusRate).toFixed(8));

          // 지갑 잔액 증가 (USDT 기준 bonusBalance)
          const walletQ = query(collection(db, 'wallets'), where('userId', '==', ancestor.id));
          const wSnap   = await getDocs(walletQ);
          if (!wSnap.empty) {
            await updateDoc(wSnap.docs[0].ref, {
              bonusBalance:  increment(bonusAmt),
              totalEarnings: increment(bonusAmt),
            });
          }

          // 보너스 이력 기록
          await addDoc(collection(db, 'bonuses'), {
            userId:         ancestor.id,
            fromUserId:     investUserId,
            amount:         bonusAmt,
            type:           level <= 2 && enableDirectBonus ? 'direct_bonus' : 'unilevel_bonus',
            level,
            baseIncome:     dailyIncome,    // 기준이 된 투자자의 D 값
            rate:           bonusRate,
            settlementDate: settlementDate || '',
            reason:         `유니레벨 ${level}단계 보너스 (정산일: ${settlementDate||'수동'})`,
            grantedBy:      triggerBy || 'system',
            createdAt:      serverTimestamp(),
          });

          // 🔔 자동 규칙: 보너스 수령 알림
          try {
            await this.fireAutoRules('bonus_received', ancestor.id, {
              name:   ancestor.name || ancestor.referralCode || ancestor.id,
              amount: bonusAmt.toFixed(4),
              rank:   ancestor.rank || 'G0',
            }, triggerBy || 'SYSTEM');
          } catch(_) { /* 자동 규칙 실패 시 보너스 처리에 영향 없음 */ }

          totalPaid += bonusAmt;
        }

        currentId = ancestor.referredBy;
        level++;
      }

      return totalPaid;
    } catch(e) {
      console.error('_processUnilevelBonus error:', e);
      return 0;
    }
  }

  /**
   * ─────────────────────────────────────────────────────────────────
   * Policy B — 2세대 고정 직접 추천 보너스 (직급 무관)
   * ─────────────────────────────────────────────────────────────────
   * enableDirectBonus2Gen = true 일 때 유니레벨 로직과 **별개로** 추가 실행됩니다.
   *
   * 규칙:
   *   - 투자자 기준 1대 위 추천인 → 투자자의 당일 ROI D × gen1Rate% 지급
   *   - 투자자 기준 2대 위 추천인 → 투자자의 당일 ROI D × gen2Rate% 지급
   *   - 직급 조건 없음 (무조건 지급)
   *   - 2대까지만 (3대 이상은 미지급)
   *
   * @param {string} investUserId
   * @param {number} dailyIncome   당일 ROI D
   * @param {object} rates         { enableDirectBonus2Gen, directBonus2GenRate1, directBonus2GenRate2 }
   * @param {object} db
   * @param {string} triggerBy
   * @param {string} settlementDate
   */
  async _processDirectBonus2Gen(investUserId, dailyIncome, rates, db, triggerBy, settlementDate) {
    try {
      if (!dailyIncome || dailyIncome <= 0) return 0;
      if (!rates.enableDirectBonus2Gen) return 0;

      const gen1Rate = (rates.directBonus2GenRate1 ?? 10) / 100;  // 기본 10%
      const gen2Rate = (rates.directBonus2GenRate2 ?? 5)  / 100;  // 기본 5%
      if (gen1Rate <= 0 && gen2Rate <= 0) return 0;

      // 전체 회원 로드 (추천 체인 구성용)
      const usersSnap = await getDocs(collection(db, 'users'));
      const userMap   = Object.fromEntries(
        usersSnap.docs.map(d => [d.id, { id: d.id, ...d.data() }])
      );

      const investor = userMap[investUserId];
      if (!investor) return 0;

      let totalPaid = 0;
      const GEN_RATES = [gen1Rate, gen2Rate];

      let currentId = investor.referredBy;
      for (let gen = 1; gen <= 2; gen++) {
        if (!currentId) break;
        const ancestor = userMap[currentId];
        if (!ancestor || ancestor.role === 'admin') break;

        const rate = GEN_RATES[gen - 1];
        if (rate > 0) {
          const bonusAmt = parseFloat((dailyIncome * rate).toFixed(8));

          // 지갑 잔액 증가 (wallets/{uid} 직접 접근)
          const walletRef = doc(db, 'wallets', ancestor.id);
          const wSnap = await getDoc(walletRef);
          if (wSnap.exists()) {
            await updateDoc(walletRef, {
              bonusBalance:  increment(bonusAmt),
              totalEarnings: increment(bonusAmt),
            });
          } else {
            const walletQ = query(collection(db, 'wallets'), where('userId', '==', ancestor.id));
            const wsSnap  = await getDocs(walletQ);
            if (!wsSnap.empty) {
              await updateDoc(wsSnap.docs[0].ref, {
                bonusBalance:  increment(bonusAmt),
                totalEarnings: increment(bonusAmt),
              });
            }
          }

          // 보너스 이력 기록
          await addDoc(collection(db, 'bonuses'), {
            userId:         ancestor.id,
            fromUserId:     investUserId,
            amount:         bonusAmt,
            type:           'direct2gen_bonus',  // Policy B 전용 타입
            level:          gen,
            baseIncome:     dailyIncome,
            rate,
            settlementDate: settlementDate || '',
            reason:         `직접추천 ${gen}대 보너스 [PolicyB] (${(rate*100).toFixed(1)}% × D${dailyIncome.toFixed(4)})`,
            grantedBy:      triggerBy || 'system',
            createdAt:      serverTimestamp(),
          });

          // 🔔 자동 규칙: 보너스 수령 알림
          try {
            await this.fireAutoRules('bonus_received', ancestor.id, {
              name:   ancestor.name || ancestor.referralCode || ancestor.id,
              amount: bonusAmt.toFixed(4),
              rank:   ancestor.rank || 'G0',
            }, triggerBy || 'SYSTEM');
          } catch(_) { /* 자동 규칙 실패 시 보너스 처리에 영향 없음 */ }

          totalPaid += bonusAmt;
        }

        currentId = ancestor.referredBy;
      }

      return totalPaid;
    } catch(e) {
      console.error('_processDirectBonus2Gen error:', e);
      return 0;
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // 센터피(Center Fee) — 소속 회원의 Daily ROI D × centerFeeRate% 를 센터장에게 지급
  // ─────────────────────────────────────────────────────────────────
  /**
   * @param {string}  investUserId   ROI 발생 회원 uid
   * @param {number}  dailyIncome    당일 ROI D (USDT)
   * @param {object}  rates          getRates() 결과 (enableCenterFee, centerFeeRate)
   * @param {object}  userMap        { [uid]: userData } 전체 회원 맵
   * @param {object}  db
   * @param {string}  triggerBy
   * @param {string}  settlementDate 'YYYY-MM-DD'
   */
  async _processCenterFee(investUserId, dailyIncome, rates, userMap, db, triggerBy, settlementDate) {
    try {
      if (!dailyIncome || dailyIncome <= 0) return 0;
      if (!rates.enableCenterFee) return 0;
      const feeRate = (rates.centerFeeRate ?? 5) / 100;
      if (feeRate <= 0) return 0;

      const investor = userMap[investUserId];
      if (!investor || !investor.centerId) return 0; // 센터 소속이 아니면 패스

      // 센터 문서에서 센터장 uid 조회
      const centerSnap = await getDoc(doc(db, 'centers', investor.centerId));
      if (!centerSnap.exists()) return 0;
      const centerLeaderId = centerSnap.data().leaderId;
      if (!centerLeaderId || centerLeaderId === investUserId) return 0;

      const feeAmt = parseFloat((dailyIncome * feeRate).toFixed(8));

      // 센터장 지갑에 적립 (USDT 기준 bonusBalance)
      const leaderWalletRef = doc(db, 'wallets', centerLeaderId);
      const lwSnap = await getDoc(leaderWalletRef);
      if (lwSnap.exists()) {
        await updateDoc(leaderWalletRef, {
          bonusBalance:  increment(feeAmt),
          totalEarnings: increment(feeAmt),
        });
      } else {
        const q = query(collection(db, 'wallets'), where('userId', '==', centerLeaderId));
        const qs = await getDocs(q);
        if (!qs.empty) {
          await updateDoc(qs.docs[0].ref, {
            bonusBalance:  increment(feeAmt),
            totalEarnings: increment(feeAmt),
          });
        }
      }

      await addDoc(collection(db, 'bonuses'), {
        userId:         centerLeaderId,
        fromUserId:     investUserId,
        amount:         feeAmt,
        type:           'center_fee',
        centerId:       investor.centerId,
        baseIncome:     dailyIncome,
        rate:           feeRate,
        settlementDate: settlementDate || '',
        reason:         `센터피 (${(feeRate*100).toFixed(1)}% × D${dailyIncome.toFixed(4)}, 정산일: ${settlementDate||'수동'})`,
        grantedBy:      triggerBy || 'system',
        createdAt:      serverTimestamp(),
      });

      return feeAmt;
    } catch(e) {
      console.error('_processCenterFee error:', e);
      return 0;
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // 직급차 풀(Pool) 분배 보너스 — "직급 갭 보너스"
  // ─────────────────────────────────────────────────────────────────
  /**
   * 규칙 (관리자 정의 설명 그대로):
   *
   *  ① 투자자(investUserId) 데일리 D 발생 시,
   *     풀(pool) = D × rankGapPoolRate%  (예: 10%)
   *
   *  ② 투자자로부터 위로 추천 체인을 무한 탐색한다.
   *
   *  ③ 각 상위 추천인(ancestor)을 만날 때:
   *     - 직급이 아직까지 만난 가장 높은 직급보다 "높으면" → 구간 분배 수령자
   *     - 직급이 같거나 낮으면 → 건너뜀(skip), 탐색 계속
   *
   *  ④ 구간 분배 계산:
   *     내 직급(rankIdx_me) - 직전 차단점 직급(rankIdx_prev)
   *     = gap 단계 수  →  gap × rankGapRatePerStep%  을 수령
   *     (단, rankGapRatePerStep = 풀의 "단계당 비율", 관리자 설정)
   *
   *  ⑤ 동급/상급 차단 + 패스스루(Passthrough) 1%:
   *     - 이미 나보다 동급 또는 상급인 사람을 만나면 탐색 STOP.
   *     - 단, 그 차단자에게는 "차단자 본인 데일리 × passThruRate%(기본 1%)" 지급
   *       (차단자 데일리는 그 사람의 실시간 투자 ROI 로 추산)
   *
   *  ⑥ 보너스는 회사 재원 (투자자 손해 없음)
   *
   * @param {string} investUserId   발생 투자자 UID
   * @param {number} dailyIncome    투자자 당일 D (USDT)
   * @param {object} rates          getRates() 결과
   * @param {object} db             Firestore db instance
   * @param {string} triggerBy      'daily_settlement' | 'deposit_realtime' 등
   * @param {string} settlementDate 'YYYY-MM-DD'
   * @param {object} [userMap]      선택적으로 미리 로드한 userMap (없으면 내부에서 로드)
   */
  async _processRankGapBonus(investUserId, dailyIncome, rates, db, triggerBy, settlementDate, userMap = null) {
    try {
      if (!dailyIncome || dailyIncome <= 0) return 0;
      if (!rates.enableRankGapBonus) return 0;

      const poolRate       = (rates.rankGapPoolRate     ?? 10) / 100;  // 풀 비율 (기본 10%)
      const ratePerStep    = (rates.rankGapRatePerStep  ?? 10) / 100;  // 단계당 분배 비율 (기본 10%)
      const passThruRate   = (rates.rankGapPassThruRate ?? 1)  / 100;  // 패스스루 비율 (기본 1%)
      const gapMode        = rates.rankGapMode || 'A';  // 'A'=균등+50%할인 | 'B'=균등(할인없음) | 'C'=감쇄
      const passThruRule   = rates.rankGapPassThruRule || 'same';  // 'same'=동급만 | 'same_or_higher'=동급+상위

      const pool = parseFloat((dailyIncome * poolRate).toFixed(8));
      if (pool <= 0) return 0;

      // 회원 맵 (외부에서 전달받거나 직접 로드)
      if (!userMap) {
        const snap = await getDocs(collection(db, 'users'));
        userMap = Object.fromEntries(snap.docs.map(d => [d.id, { id: d.id, ...d.data() }]));
      }

      const investor = userMap[investUserId];
      if (!investor) return 0;

      const RANK_ORDER = ['G0','G1','G2','G3','G4','G5','G6','G7','G8','G9','G10'];
      const rankIdx = (r) => Math.max(0, RANK_ORDER.indexOf(r || 'G0'));

      const investorRankIdx = rankIdx(investor.rank);

      // ── 수령자 목록 계산 ──────────────────────────────────────────
      // 체인을 탐색하면서 "가장 최근에 만난 최고 직급" 을 추적한다.
      // 그보다 높은 직급을 만날 때마다 그 사람이 구간 보너스를 받는다.
      const recipients = [];    // { ancestor, gapSteps, rankIdxMe, rankIdxPrev }
      let currentId       = investor.referredBy;
      let highestRankSeen = investorRankIdx;  // 지금까지 만난 최고 직급 인덱스
      let blocked         = false;

      while (currentId && !blocked) {
        const ancestor = userMap[currentId];
        if (!ancestor || ancestor.role === 'admin') break;

        const aRankIdx = rankIdx(ancestor.rank);

        if (aRankIdx > highestRankSeen) {
          // ── 새 구간 수령자 발견 ──
          const gap = aRankIdx - highestRankSeen;           // 직급 격차 단계 수
          recipients.push({ ancestor, gap, rankIdxMe: aRankIdx, rankIdxPrev: highestRankSeen });
          highestRankSeen = aRankIdx;
        }

        // 나(루트 기준) 보다 동급 또는 상급이면 탐색 STOP
        // (여기서는 "나" = 투자자 바로 위로부터 올라오다가 처음 만나는
        //  투자자보다 높은 직급자를 기준으로 함.
        //  즉 highestRankSeen 가 investorRankIdx 초과가 된 첫 번째 시점)
        if (aRankIdx > investorRankIdx && blocked === false) {
          // 아직 첫 번째 "나보다 높은" 인물을 넘어서도 계속 탐색 가능.
          // 단, 동직급 이상의 사람이 이전에 본 최고 직급과 같으면 → STOP
          // (이미 highestRankSeen 가 aRankIdx 와 같아졌으므로 다음 iteration에서
          //  같거나 낮은 직급이면 skip, 높으면 계속)
        }

        // 실제 차단 조건: 최상위 직급(G10)에 도달하거나 체인 끊김
        if (aRankIdx >= RANK_ORDER.length - 1) { blocked = true; }

        currentId = ancestor.referredBy;
      }

      if (recipients.length === 0) return 0;

      // ── 패스스루(Passthrough) 처리 ──────────────────────────────
      // 체인에서 "내 직급 이상인 자" 가 처음 등장한 그 위쪽 체인은
      // 해당 사람이 더 이상 올라가지 못하도록 차단하되,
      // 차단된 지점에서 패스스루를 적용한다.
      // (패스스루 = 차단자의 본인 dailyIncome 추산치 × passThruRate)
      //
      // 여기서는 간단히: pool × passThruRate 를 체인 최상위 수령자에게 추가 지급.
      // (차단자 본인 데일리를 실시간 계산하려면 투자 조회가 필요하므로,
      //  동일 pool 기반으로 계산하는 방식이 더 안전하고 빠름)

      let totalPaid = 0;
      let decayFactor = 1.0;  // 방식 C 감쇄용
      let decayApplied = false;

      // 수령자별 지급
      for (const { ancestor, gap } of recipients) {
        // 방식에 따른 보너스 계산
        let bonusAmt = 0;
        if (gapMode === 'A') {
          // 방식 A: 균등분할 + 50% 할인
          bonusAmt = parseFloat((pool * gap * ratePerStep * 0.5).toFixed(8));
        } else if (gapMode === 'B') {
          // 방식 B: 균등분할 (할인 없음)
          bonusAmt = parseFloat((pool * gap * ratePerStep).toFixed(8));
        } else {
          // 방식 C: 단계별 직접 지급 (하부 감쇄)
          bonusAmt = parseFloat((pool * gap * ratePerStep * decayFactor).toFixed(8));
          if (!decayApplied) { decayApplied = true; } else { decayFactor *= 0.5; }
        }
        if (bonusAmt <= 0) continue;

        // 지갑 적립
        const walletQ = query(collection(db, 'wallets'), where('userId', '==', ancestor.id));
        const wSnap   = await getDocs(walletQ);
        if (!wSnap.empty) {
          await updateDoc(wSnap.docs[0].ref, {
            bonusBalance:  increment(bonusAmt),
            totalEarnings: increment(bonusAmt),
          });
        }

        // 보너스 이력 기록
        await addDoc(collection(db, 'bonuses'), {
          userId:         ancestor.id,
          fromUserId:     investUserId,
          amount:         bonusAmt,
          type:           'rank_gap_bonus',
          gap,
          poolBase:       pool,
          ratePerStep,
          baseIncome:     dailyIncome,
          settlementDate: settlementDate || '',
          reason:         `직급차 풀 보너스 ${gap}단계 × ${(ratePerStep*100).toFixed(1)}% (pool $${pool.toFixed(4)})`,
          grantedBy:      triggerBy || 'system',
          createdAt:      serverTimestamp(),
        });

        totalPaid += bonusAmt;
      }

      // ── 패스스루: 건너뜀 추천인들에게 pool × passThruRate 지급 ──
      //
      // 패스스루 대상 = 직급이 올라가는 "구간 수령자"가 아닌 모든 건너뜀 노드
      //
      // ★ 중요: 투자자(나)를 기준으로, 나보다 낮은 직급의 상위 추천인에게도
      //         반드시 패스스루를 지급해야 한다.
      //         → 체인 전체를 끝까지 탐색하며, 수령자가 아닌 노드에 대해
      //            선택된 규칙으로 지급 여부를 결정한다.
      //
      // passThruRule = 'same':
      //   건너뜀 노드 중 투자자(나)와 동급 이하인 추천인에게 지급
      //   (나보다 낮은 직급 포함, 나보다 높은 직급 제외)
      //
      // passThruRule = 'same_or_higher':
      //   건너뜀 노드 중 투자자(나)와 동급이거나 더 높은 직급인 추천인에게 지급
      //   (나보다 낮은 직급 제외, 동급 + 상위 직급만 포함)
      //
      if (passThruRate > 0) {
        let ptCurrentId = investor.referredBy;
        const recipientIds = new Set(recipients.map(r => r.ancestor.id));
        while (ptCurrentId) {
          const ptNode = userMap[ptCurrentId];
          if (!ptNode || ptNode.role === 'admin') break;
          const ptRankIdx = rankIdx(ptNode.rank);

          // 수령자가 아닌 건너뜀 노드 중 규칙에 해당하는 경우 패스스루 지급
          if (!recipientIds.has(ptNode.id)) {
            // 'same': 나(투자자) 직급 이하 (낮거나 같은) — 나보다 높은 직급 제외
            // 'same_or_higher': 나 직급 이상 (같거나 높은) — 나보다 낮은 직급 제외
            const qualifies = passThruRule === 'same_or_higher'
              ? ptRankIdx >= investorRankIdx   // 동급 + 상위 직급만
              : ptRankIdx <= investorRankIdx;  // 동급 이하 (낮은 직급 포함)
            if (qualifies) {
              const passAmt = parseFloat((pool * passThruRate).toFixed(8));
              if (passAmt > 0) {
                const walletQ = query(collection(db, 'wallets'), where('userId', '==', ptNode.id));
                const wSnap   = await getDocs(walletQ);
                if (!wSnap.empty) {
                  await updateDoc(wSnap.docs[0].ref, {
                    bonusBalance:  increment(passAmt),
                    totalEarnings: increment(passAmt),
                  });
                }
                await addDoc(collection(db, 'bonuses'), {
                  userId:         ptNode.id,
                  fromUserId:     investUserId,
                  amount:         passAmt,
                  type:           'rank_gap_passthru',
                  poolBase:       pool,
                  passThruRate,
                  passThruRule,
                  baseIncome:     dailyIncome,
                  settlementDate: settlementDate || '',
                  reason:         `직급차 패스스루 (${passThruRule==='same_or_higher'?'동급+상위직급':'동급이하'}) ${(passThruRate*100).toFixed(1)}%`,
                  grantedBy:      triggerBy || 'system',
                  createdAt:      serverTimestamp(),
                });
                totalPaid += passAmt;
              }
            }
          }

          // 체인 종료 조건: 체인 끝(referredBy 없음) 또는 G10 최상위에 도달하면 중단
          // ★ 수령자 여부와 무관하게 체인 전체를 탐색해야 낮은 직급 노드도 처리됨
          if (!ptNode.referredBy || ptRankIdx >= RANK_ORDER.length - 1) break;
          ptCurrentId = ptNode.referredBy;
        }
      }

      // 🔔 자동 규칙: 직급차 보너스 수령자들에게 알림
      try {
        for (const { ancestor, gap } of recipients) {
          const bonusAmt = parseFloat((pool * gap * ratePerStep).toFixed(8));
          if (bonusAmt > 0) {
            await this.fireAutoRules('bonus_received', ancestor.id, {
              name:   ancestor.name || ancestor.referralCode || ancestor.id,
              amount: bonusAmt.toFixed(4),
              rank:   ancestor.rank || 'G0',
            }, triggerBy || 'SYSTEM');
          }
        }
      } catch(_) { /* 자동 규칙 실패 시 보너스 처리에 영향 없음 */ }

      return totalPaid;
    } catch(e) {
      console.error('_processRankGapBonus error:', e);
      return 0;
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // 직급 달성 보너스(Rank Achieve Bonus) — 특정 직급이 되면 일정 금액 지급 (N일 주기)
  // ─────────────────────────────────────────────────────────────────
  /**
   * 운영 방식:
   *   - cycleDays === 0  → 최초 직급 달성 시 1회만 지급 (bonuses 컬렉션에 기록, 중복 방지)
   *   - cycleDays > 0   → N일마다 반복 지급 (마지막 지급일 기록, N일 이상 지났으면 재지급)
   *
   * 호출 시점: runDailyROISettlement 내부 또는 별도 배치 실행
   * @param {string} adminId
   * @param {string} targetDateStr 'YYYY-MM-DD'
   */
  async runRankAchieveBonusBatch(adminId, targetDateStr = null) {
    try {
      const db = this.db;
      const ratesR = await this.getRates();
      const rates  = ratesR.success ? ratesR.data : {};
      if (!rates.enableRankAchieveBonus) return ok({ skipped: true, reason: '직급 보너스 비활성' });

      const cycleDays   = rates.rankAchieveBonusCycleDays ?? 0;
      const bonusAmounts= rates.rankAchieveBonusAmounts   || {};

      const dateStr = targetDateStr
        || (new Date()).toISOString().slice(0, 10);

      const usersSnap = await getDocs(
        query(collection(db, 'users'), where('role', '!=', 'admin'))
      );

      let paidCount = 0;
      let totalPaid = 0;

      for (const ud of usersSnap.docs) {
        const user = { id: ud.id, ...ud.data() };
        const rank = user.rank || 'G0';
        if (rank === 'G0') continue;

        const bonusAmt = parseFloat(bonusAmounts[rank] || 0);
        if (bonusAmt <= 0) continue;

        if (cycleDays === 0) {
          // ── 1회 지급: 이미 지급된 기록이 있으면 스킵 ──
          const prev = await getDocs(query(
            collection(db, 'bonuses'),
            where('userId', '==', user.id),
            where('type',   '==', 'rank_achieve_bonus'),
            where('rank',   '==', rank),
            limit(1)
          ));
          if (!prev.empty) continue; // 이미 지급됨
        } else {
          // ── N일 반복: 마지막 지급일 확인 ──
          const prev = await getDocs(query(
            collection(db, 'bonuses'),
            where('userId', '==', user.id),
            where('type',   '==', 'rank_achieve_bonus'),
            where('rank',   '==', rank),
            limit(1)
          ));
          if (!prev.empty) {
            const lastBonus = prev.docs[0].data();
            const lastDate = lastBonus.settlementDate || '';
            if (lastDate) {
              const lastMs  = new Date(lastDate + 'T00:00:00').getTime();
              const todayMs = new Date(dateStr   + 'T00:00:00').getTime();
              const daysDiff = (todayMs - lastMs) / 86400000;
              if (daysDiff < cycleDays) continue; // 아직 주기 안 됨
            }
          }
        }

        // 지갑 적립 (USDT 기준 bonusBalance)
        const walletRef = doc(db, 'wallets', user.id);
        const wSnap = await getDoc(walletRef);
        if (wSnap.exists()) {
          await updateDoc(walletRef, {
            bonusBalance:  increment(bonusAmt),
            totalEarnings: increment(bonusAmt),
          });
        } else {
          const q = query(collection(db, 'wallets'), where('userId', '==', user.id));
          const qs = await getDocs(q);
          if (!qs.empty) {
            await updateDoc(qs.docs[0].ref, {
              bonusBalance:  increment(bonusAmt),
              totalEarnings: increment(bonusAmt),
            });
          }
        }

        await addDoc(collection(db, 'bonuses'), {
          userId:         user.id,
          amount:         bonusAmt,
          type:           'rank_achieve_bonus',
          rank,
          cycleDays,
          settlementDate: dateStr,
          reason:         `직급 달성 보너스 [${rank}] ${bonusAmt} USDT${cycleDays > 0 ? ` (${cycleDays}일 주기)` : ' (1회)'}`,
          grantedBy:      adminId,
          createdAt:      serverTimestamp(),
        });

        paidCount++;
        totalPaid += bonusAmt;
      }

      await this._auditLog(adminId, 'settlement',
        `직급 달성 보너스 배치 [${dateStr}]: ${paidCount}건 / ${totalPaid.toFixed(4)} USDT`,
        { date: dateStr, paidCount, totalPaid }
      );

      return ok({ date: dateStr, paidCount, totalPaid });
    } catch(e) { return err(e); }
  }

  // ─────────────────────────────────────────────────────────────────
  // 일일 ROI 정산 배치
  // ─────────────────────────────────────────────────────────────────
  /**
   * ⚠️ 정산은 반드시 백엔드 /api/admin/run-settlement 를 통해서만 실행됩니다.
   * 프론트엔드에서 직접 Firestore에 쓰는 기존 로직은 제거되었습니다.
   * 이유: 다중 경로(CRON + admin페이지 자동실행 + 수동버튼) 동시 실행 시
   *       settlements 락이 race condition으로 뚫려 중복 정산 발생 위험.
   *
   * @param {string} adminId
   * @param {string|null} targetDateStr  'YYYY-MM-DD' (null이면 오늘)
   */
  async runDailyROISettlement(adminId, targetDateStr = null) {
    try {
      const dateStr = targetDateStr || new Date().toISOString().slice(0, 10);

      // 백엔드 API 호출 (백엔드에서 atomic 중복 방지 + 단일 정산 엔진으로 실행)
      const res = await fetch('/api/admin/run-settlement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetDate: dateStr })
      });
      const data = await res.json();

      if (!res.ok) return err(new Error(data.error || '정산 API 오류'));
      if (data.skipped) {
        return ok({ skipped: true, reason: data.message || `${dateStr} 정산이 이미 실행되었습니다.`, date: dateStr });
      }

      return ok({
        date: data.date || dateStr,
        roiPaidCount: data.processedCount || 0,
        totalRoiAmount: data.totalPaid || 0,
        bonusPaidCount: 0,
        totalBonusAmount: 0,
        totalInvestments: data.processedCount || 0,
      });
    } catch(e) { return err(e); }
  }

  /**
   * 정산 이력 조회
   * Firestore: settlements/{YYYY-MM-DD}
   */
  async getSettlementHistory(maxCount = 30) {
    try {
      const snap = await getDocs(query(collection(this.db, 'settlements'), limit(maxCount)));
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => {
          // 날짜 문자열 내림차순
          if (a.date > b.date) return -1;
          if (a.date < b.date) return 1;
          return 0;
        });
      return ok(data);
    } catch(e) { return err(e); }
  }

  // ─────────────────────────────────────────────────
  // 환율/레이트
  // ─────────────────────────────────────────────────
  async getRates() {
    try {
      const snap = await getDoc(doc(this.db, 'settings', 'rates'));
      const defaults = {
        dedraRate: 0.5, usdKrw: 1350,
        enableDirectBonus: true,
        directBonus1: 5, directBonus2: 2,
        enableUnilevel: true,
        unilevelRates: [10,7,5,4,3,2,2,1,1,1],
        enableRankDiffBonus: false, rankDiffBonusRate: 0,
        enableRankBonus: false,
        // Policy B: 2세대 고정 직접 보너스
        enableDirectBonus2Gen: false,
        directBonus2GenRate1: 10,   // 1대 위 추천인에게 D × 10%
        directBonus2GenRate2: 5,    // 2대 위 추천인에게 D × 5%
        // 자동 정산 설정
        autoSettlement: false,      // true = 자동 정산 활성화
        autoSettlementHour: 0,      // 정산 실행 시각 (0~23, UTC 기준)
        autoSettlementMinute: 0,
        // 센터피 설정 (Center Fee)
        enableCenterFee: false,     // true = 센터피 활성화
        centerFeeRate: 5,           // 센터 소속 회원 ROI D 의 N% 를 센터장에게 지급
        // 직급 보너스 설정 (Rank Achievement Bonus)
        enableRankAchieveBonus: false, // true = 직급 달성 보너스 활성화
        rankAchieveBonusCycleDays: 0,  // 0=직급달성1회만, N>0=N일마다 반복 지급
        rankAchieveBonusAmounts: {     // 직급별 지급 금액 (USDT)
          G1:0, G2:0, G3:0, G4:0, G5:0,
          G6:0, G7:0, G8:0, G9:0, G10:0,
        },
        // 직급차 풀 분배 보너스 (Rank Gap Bonus)
        enableRankGapBonus: false,        // true = 직급차 풀 보너스 활성화
        rankGapPoolRate: 10,              // D 의 몇%를 풀로 쓸지 (기본 10%)
        rankGapRatePerStep: 10,           // 직급 차 1단계당 풀의 몇% 지급 (기본 10%)
        rankGapPassThruRate: 1,           // 패스스루: 건너뜀 추천인에게 풀의 몇% 지급 (기본 1%)
        rankGapRealtimeOnDeposit: false,  // true = 입금 승인 즉시 실시간 처리
        rankGapMode: 'A',                 // 'A'=균등+50%할인 | 'B'=균등(할인없음) | 'C'=단계별감쇄
        rankGapPassThruRule: 'same',      // 'same'=동급만 | 'same_or_higher'=동급+상위직급
      };
      return ok(snap.exists() ? { ...defaults, ...snap.data() } : defaults);
    } catch(e) { return err(e); }
  }

  async updateRates(adminId, rates) {
    try {
      // boolean 필드들은 반드시 boolean 타입으로 저장 (Firestore 타입 안전)
      const boolFields = [
        'enableDirectBonus','enableUnilevel','enableDirectBonus2Gen',
        'enableRankDiffBonus','enableRankBonus','autoSettlement',
        'enableCenterFee','enableRankAchieveBonus',
        'enableRankGapBonus','rankGapRealtimeOnDeposit'
      ];
      const safeRates = { ...rates };
      boolFields.forEach(f => {
        if (f in safeRates) safeRates[f] = safeRates[f] === true;
      });

      await setDoc(doc(this.db, 'settings', 'rates'), {
        ...safeRates, updatedAt: serverTimestamp(), updatedBy: adminId
      }, { merge: true });
      // 히스토리 기록
      await addDoc(collection(this.db, 'rateHistory'), {
        ...safeRates, adminId, createdAt: serverTimestamp()
      });
      await this._auditLog(adminId, 'settings', '환율 설정 변경', safeRates);
      return ok(true);
    } catch(e) { return err(e); }
  }

  async getRateHistory(maxCount = 15) {
    try {
      const snap = await getDocs(query(collection(this.db, 'rateHistory'), limit(maxCount)));
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      return ok(data);
    } catch(e) { return err(e); }
  }

  // ─────────────────────────────────────────────────
  // 직급 승진 조건 설정
  // ─────────────────────────────────────────────────
  /**
   * 직급 승진 조건 설정 가져오기
   * Firestore: settings/rankPromotion
   * 기본값: 각 직급(G0~G10)에 대해 { minSelfInvest, networkDepth, minNetworkSales, minNetworkMembers } 설정
   */
  async getRankPromotionSettings() {
    try {
      const snap = await getDoc(doc(this.db, 'settings', 'rankPromotion'));
      if (snap.exists()) {
        const raw = snap.data();
        // criteriaJson 필드가 있으면 파싱, 없으면 criteria 필드 직접 사용 (하위 호환)
        if (raw.criteriaJson) {
          try { raw.criteria = JSON.parse(raw.criteriaJson); } catch(e) {}
        }
        // criteria가 없거나 각 rank에 minBalancedVolume 누락 시 보완
        const ranks = ['G1','G2','G3','G4','G5','G6','G7','G8','G9','G10'];
        if (!raw.criteria) raw.criteria = {};
        ranks.forEach(rank => {
          if (!raw.criteria[rank]) raw.criteria[rank] = {};
          const c = raw.criteria[rank];
          if (c.minBalancedVolume  == null) c.minBalancedVolume  = 0;
          if (c.minSelfInvest      == null) c.minSelfInvest      = 0;
          if (c.minNetworkSales    == null) c.minNetworkSales    = 0;
          if (c.minNetworkMembers  == null) c.minNetworkMembers  = 0;
        });
        return ok(raw);
      }
      // 기본값 반환 (추천인 수 기반 레거시와 호환)
      const defaults = {
        networkDepth: 3,              // 산하 계산 깊이 (1~10)
        promotionMode: 'all',         // 'all' = 모든 조건 충족, 'any' = 하나라도 충족
        useBalancedVolume: false,     // true = 산하 매출 계산 시 최대 라인 제외 (균형 매출)
        excludeTopLines: 1,           // 제외할 최대 라인 수 (기본 1)
        enableAutoPromotion: false,   // true = 입금 승인 시 자동 승진 체크
        preventDowngrade: true,       // true = 이미 획득한 직급 강등 방지
        requireActiveInvestment: false, // true = 활성 투자가 있어야 직급 유지
        reCheckIntervalDays: 0,       // 0 = 수동 실행만, N > 0 = N일마다 자동 재검사
        countOnlyDirectReferrals: false, // true = 직접 추천(1대)만 인원 카운트
        criteria: {
          G1:  { minSelfInvest: 0,    minNetworkSales: 0,     minBalancedVolume: 0,  minNetworkMembers: 3    },
          G2:  { minSelfInvest: 0,    minNetworkSales: 0,     minBalancedVolume: 0,  minNetworkMembers: 10   },
          G3:  { minSelfInvest: 0,    minNetworkSales: 0,     minBalancedVolume: 0,  minNetworkMembers: 20   },
          G4:  { minSelfInvest: 0,    minNetworkSales: 0,     minBalancedVolume: 0,  minNetworkMembers: 40   },
          G5:  { minSelfInvest: 0,    minNetworkSales: 0,     minBalancedVolume: 0,  minNetworkMembers: 80   },
          G6:  { minSelfInvest: 0,    minNetworkSales: 0,     minBalancedVolume: 0,  minNetworkMembers: 150  },
          G7:  { minSelfInvest: 0,    minNetworkSales: 0,     minBalancedVolume: 0,  minNetworkMembers: 300  },
          G8:  { minSelfInvest: 0,    minNetworkSales: 0,     minBalancedVolume: 0,  minNetworkMembers: 600  },
          G9:  { minSelfInvest: 0,    minNetworkSales: 0,     minBalancedVolume: 0,  minNetworkMembers: 1200 },
          G10: { minSelfInvest: 0,    minNetworkSales: 0,     minBalancedVolume: 0,  minNetworkMembers: 2000 },
        }
      };
      return ok(defaults);
    } catch(e) { return err(e); }
  }

  /**
   * 직급 승진 조건 설정 저장
   * @param {string} adminId
   * @param {object} settings  { networkDepth, promotionMode, criteria: { G1: {...}, ... } }
   */
  async saveRankPromotionSettings(adminId, settings) {
    try {
      // criteria를 JSON 문자열로 직렬화하여 저장 (Firestore 중첩 Map 누락 방지)
      const toSave = {
        networkDepth:             settings.networkDepth,
        promotionMode:            settings.promotionMode,
        useBalancedVolume:        settings.useBalancedVolume,
        excludeTopLines:          settings.excludeTopLines,
        enableAutoPromotion:      settings.enableAutoPromotion ?? false,
        preventDowngrade:         settings.preventDowngrade ?? true,
        requireActiveInvestment:  settings.requireActiveInvestment ?? false,
        reCheckIntervalDays:      settings.reCheckIntervalDays ?? 0,
        countOnlyDirectReferrals: settings.countOnlyDirectReferrals ?? false,
        criteriaJson:             JSON.stringify(settings.criteria || {}),
        updatedAt:                serverTimestamp(),
        updatedBy:                adminId
      };
      await setDoc(doc(this.db, 'settings', 'rankPromotion'), toSave);
      await this._auditLog(adminId, 'settings', '직급 승진 조건 설정 변경', settings);
      return ok(true);
    } catch(e) { return err(e); }
  }

  /**
   * 균형 매출(Balanced Volume) 계산
   * 전체 산하 매출에서 직1대 하위 중 매출이 가장 큰 N개 라인의 매출을 제외한 값을 반환
   *
   * @param {string}   userId       기준 회원 ID
   * @param {string[]} allDownline  전체 산하 회원 ID 목록
   * @param {object[]} allUsers     전체 회원 목록 (id, referredBy 포함)
   * @param {number}   totalSales   전체 산하 매출 합계
   * @param {number}   excludeN     제외할 최대 라인 수 (기본 1)
   * @param {object}   db           Firestore db 인스턴스
   * @returns {number}              균형 매출 값
   */
  async _calcBalancedVolume(userId, allDownline, allUsers, totalSales, excludeN = 1, db) {
    try {
      if (allDownline.length === 0) return 0;

      // 직1대 하위 목록
      const direct1st = allUsers.filter(u => u.referredBy === userId).map(u => u.id);
      if (direct1st.length === 0) return totalSales;

      // 직1대별 산하 전체(자기포함) ID 수집 헬퍼 (BFS)
      const getLineIds = (rootId) => {
        const ids = new Set([rootId]);
        let frontier = [rootId];
        while (frontier.length > 0) {
          const next = allUsers.filter(u => frontier.includes(u.referredBy)).map(u => u.id);
          next.forEach(id => ids.add(id));
          frontier = next;
        }
        return [...ids];
      };

      // 직1대별 매출 계산
      const lineSales = [];
      for (const d1Id of direct1st) {
        const lineIds = getLineIds(d1Id).filter(id => allDownline.includes(id));
        if (lineIds.length === 0) { lineSales.push({ id: d1Id, sales: 0 }); continue; }
        let sales = 0;
        const chunks = [];
        for (let i = 0; i < lineIds.length; i += 30) chunks.push(lineIds.slice(i, i + 30));
        for (const chunk of chunks) {
          const wSnap = await getDocs(query(
            collection(db, 'wallets'),
            where('userId', 'in', chunk)
          ));
          sales += wSnap.docs.reduce((s, d) => s + (d.data().totalInvest || d.data().totalInvested || 0), 0);
        }
        lineSales.push({ id: d1Id, sales });
      }

      // 매출 내림차순 정렬, 상위 excludeN개 제외
      lineSales.sort((a, b) => b.sales - a.sales);
      const excluded = lineSales.slice(0, excludeN).reduce((s, l) => s + l.sales, 0);
      return Math.max(0, totalSales - excluded);
    } catch(e) {
      console.error('_calcBalancedVolume error:', e);
      return totalSales; // 오류 시 전체 매출로 폴백
    }
  }

  /**
   * 특정 회원의 직급 승진 자격 계산
   * - 본인 투자 총액
   * - networkDepth까지 산하 매출(입금 승인액) 합산
   * - useBalancedVolume=true 시 균형 매출(최대 라인 제외) 추가 계산
   * - networkDepth까지 산하 인원 수 합산
   * @param {string} userId
   * @param {object} settings  getRankPromotionSettings 결과
   */
  async calcRankEligibility(userId, settings) {
    try {
      const db = this.db;
      const depth           = settings.networkDepth    || 3;
      const useBalancedVol  = settings.useBalancedVolume === true;
      const excludeTopLines = settings.excludeTopLines || 1;

      // 전체 회원 로드 (referredBy 관계로 조직도 구성)
      const usersSnap = await getDocs(collection(db, 'users'));
      const allUsers  = usersSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      // BFS로 userId의 산하 depth단계까지 구성원 수집
      const downline = [];
      let currentLevel = [userId];
      for (let d = 0; d < depth; d++) {
        const nextLevel = allUsers.filter(u => currentLevel.includes(u.referredBy)).map(u => u.id);
        downline.push(...nextLevel);
        currentLevel = nextLevel;
        if (!nextLevel.length) break;
      }

      // 본인 투자 합산
      const selfInvSnap = await getDocs(query(
        collection(db, 'investments'),
        where('userId', '==', userId),
        where('status', '==', 'active')
      ));
      const selfInvest = selfInvSnap.docs.reduce((s, d) => s + (d.data().amount || 0), 0);

      // 산하 승인 입금 합산 (매출)
      let networkSales = 0;
      let networkMembers = downline.length;

      if (downline.length > 0) {
        const chunks = [];
        for (let i = 0; i < downline.length; i += 30) chunks.push(downline.slice(i, i + 30));
        for (const chunk of chunks) {
            const wSnap = await getDocs(query(
              collection(db, 'wallets'),
              where('userId', 'in', chunk)
            ));
            networkSales += wSnap.docs.reduce((s, d) => s + (d.data().totalInvest || d.data().totalInvested || 0), 0);
        }
      }

      // 균형 매출 계산 (useBalancedVolume=true일 때)
      let balancedVolume = networkSales;
      if (useBalancedVol && downline.length > 0) {
        balancedVolume = await this._calcBalancedVolume(userId, downline, allUsers, networkSales, excludeTopLines, db);
      }

      return ok({ selfInvest, networkSales, balancedVolume, networkMembers, downlineIds: downline });
    } catch(e) { return err(e); }
  }

  /**
   * 단일 회원 직급 승진 체크 (입금 승인 시 자동 트리거)
   * enableAutoPromotion = true 일 때 approveDeposit() 에서 호출됨
   * @param {string} userId
   * @param {object} settings  getRankPromotionSettings 결과
   * @param {string} adminId
   */
  async _checkAndPromoteSingleUser(userId, settings, adminId) {
    const db = this.db;
    const RANK_ORDER = ['G0','G1','G2','G3','G4','G5','G6','G7','G8','G9','G10'];
    const criteria         = settings.criteria || {};
    const mode             = settings.promotionMode || 'all';
    const preventDowngrade = settings.preventDowngrade !== false;
    const countOnlyDirect  = settings.countOnlyDirectReferrals === true;
    const useBalancedVol   = settings.useBalancedVolume === true;
    const excludeTopLines  = settings.excludeTopLines || 1;
    const depth = countOnlyDirect ? 1 : (settings.networkDepth || 3);

    // 회원 정보 가져오기
    const userSnap = await getDoc(doc(db, 'users', userId));
    if (!userSnap.exists()) return;
    const member = { id: userSnap.id, ...userSnap.data() };
    if (member.role === 'admin') return;
    // [수정] 수동으로 직급이 지정된 회원이라도, 조건 충족 시 '상향' 승급은 허용합니다. (하향은 불가)
    // if (member.manualRankSet) return;

    const curRank = member.rank || 'G0';
    const curIdx  = RANK_ORDER.indexOf(curRank);
    if (curIdx < 0) return;

    // 전체 유저 로드 (BFS용)
    const usersSnap = await getDocs(collection(db, 'users'));
    const allUsers  = usersSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    // 산하 계산
    const downline = [];
    let lvl = [userId];
    for (let d = 0; d < depth; d++) {
      const next = allUsers.filter(u => lvl.includes(u.referredBy)).map(u => u.id);
      downline.push(...next);
      lvl = next;
      if (!next.length) break;
    }

    // 본인 활성 투자액
    const selfInvSnap = await getDocs(query(
      collection(db, 'investments'),
      where('userId', '==', userId),
      where('status', '==', 'active')
    ));
    const selfInvest = selfInvSnap.docs.reduce((s, d) => s + (d.data().amount || 0), 0);

    // 산하 네트워크 매출
    let networkSales = 0;
    if (downline.length > 0) {
      const chunks = [];
      for (let i = 0; i < downline.length; i += 30) chunks.push(downline.slice(i, i + 30));
      for (const chunk of chunks) {
        const wSnap = await getDocs(query(
          collection(db, 'wallets'),
          where('userId', 'in', chunk)
        ));
        networkSales += wSnap.docs.reduce((s, d) => s + (d.data().totalInvest || d.data().totalInvested || 0), 0);
      }
    }

    // 균형 매출 계산 (useBalancedVolume=true일 때)
    let balancedVolume = networkSales;
    if (useBalancedVol && downline.length > 0) {
      balancedVolume = await this._calcBalancedVolume(userId, downline, allUsers, networkSales, excludeTopLines, db);
    }

    const networkMembers = downline.length;

    // [수정] 어떤 경우에도 하향은 허용하지 않음 (preventDowngrade 무조건 true 처리)
    let bestRank = curRank;
    let bestIdx  = RANK_ORDER.indexOf(bestRank);

    for (let i = RANK_ORDER.length - 1; i >= 1; i--) {
      const rankKey = RANK_ORDER[i];
      const c = criteria[rankKey];
      if (!c) continue;

      const meetsInvest  = selfInvest      >= (c.minSelfInvest     || 0);
      const meetsSales   = networkSales    >= (c.minNetworkSales   || 0);
      const meetsBV      = balancedVolume  >= (c.minBalancedVolume || 0);
      const meetsMembers = networkMembers  >= (c.minNetworkMembers || 0);

      // 균형 매출 조건: minBalancedVolume > 0 이면 체크, 0이면 무조건 통과
      const bvRequired = (c.minBalancedVolume || 0) > 0;

      // ──────────────────────────────────────────────────────────
      // [요청사항 적용] 직급 승격은 오직 "본인 투자금"과 "균형 매출" 2가지만 봅니다.
      // 산하 총 매출(meetsSales)이나 하부 인원수(meetsMembers)는 조건에서 무시합니다.
      // 수동 승격된 유저는 여기서 제외되도록 이 함수 시작부분에 처리됨.
      // ──────────────────────────────────────────────────────────
      const passes = meetsInvest && meetsBV;

      if (passes) {
        if (i > bestIdx) { bestRank = rankKey; bestIdx = i; }
        break;
      }
    }

    if (bestRank !== curRank) {
      await updateDoc(doc(db, 'users', userId), { rank: bestRank, updatedAt: serverTimestamp() });
      await this._auditLog(adminId, 'rank',
        `[자동승진] ${member.name || userId}: ${curRank} → ${bestRank} (입금 승인 트리거)`,
        { userId, oldRank: curRank, newRank: bestRank, trigger: 'deposit_approval' }
      );
      // ── 관리자 알림: 직급 승진 ─────────────────────────────────
      const isUpgrade = RANK_ORDER.indexOf(bestRank) > curIdx;
      await this._sendAdminNotification(
        'rank_up',
        isUpgrade ? '🏆 직급 승진 알림' : '📉 직급 변경 알림',
        `${member.name || userId} 님이 ${curRank} → ${bestRank} 로 ${isUpgrade ? '승진' : '변경'}했습니다. (입금 승인 트리거)`,
        { userId, userName: member.name, oldRank: curRank, newRank: bestRank }
      );

      // ── 🔔 자동 규칙: 직급 승급 알림 (승진인 경우만) ──────────────
      if (isUpgrade) {
        try {
          await this.fireAutoRules('rank_upgrade', userId, {
            name:   member.name || member.referralCode || userId,
            rank:   bestRank,
            amount: '',
          }, adminId);
        } catch(_) { /* 자동 규칙 실패 무시 */ }
      }
    }
  }

  /**
   * 전체 회원 직급 일괄 재계산 (관리자 수동 실행)
   * 승진 조건에 맞는 회원을 찾아 자동 승격
   * @returns {{ upgraded: number, details: Array }}
   */
  
  async runRankAllClear(adminId) {
    try {
      const db = this.db;
      const usersSnap = await getDocs(collection(db, 'users'));
      const members = usersSnap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(u => u.role !== 'admin');

      let changedCount = 0;
      // 1. 모든 회원의 직급을 G0으로 강등 (수동 설정자 제외 여부: "관리자가 강제로 주입시킨 거는 제외" -> 수동 설정자는 초기화 안함)
      const chunks = [];
      for (let i = 0; i < members.length; i += 500) chunks.push(members.slice(i, i + 500));
      for (const chunk of chunks) {
        const batch = writeBatch(db);
        let hasOps = false;
        for (const u of chunk) {
          if (!u.manualRankSet && u.rank !== 'G0') {
            batch.update(doc(db, 'users', u.id), { rank: 'G0' });
            hasOps = true;
            changedCount++;
          }
        }
        if (hasOps) await batch.commit();
      }

      // 2. 전체 재계산 실행
      await this.runBatchRankPromotion(adminId);

      return ok(`초기화 후 전체 재심사 완료! (초기화된 일반 회원: ${changedCount}명)`);
    } catch(e) { return err(e); }
  }

  async runBatchRankPromotion(adminId) {
    try {
      const db = this.db;
      const settingsR = await this.getRankPromotionSettings();
      if (!settingsR.success) throw new Error('승진 조건 설정 로드 실패');
      const settings  = settingsR.data;
      const criteria  = settings.criteria || {};
      const mode      = settings.promotionMode || 'all';
      const preventDowngrade        = settings.preventDowngrade !== false;      // 기본 true
      const requireActiveInvestment = settings.requireActiveInvestment === true; // 기본 false
      const countOnlyDirect         = settings.countOnlyDirectReferrals === true; // 기본 false
      const useBalancedVol          = settings.useBalancedVolume === true;          // 기본 false
      const excludeTopLines         = settings.excludeTopLines || 1;

      const RANK_ORDER = ['G0','G1','G2','G3','G4','G5','G6','G7','G8','G9','G10'];

      const usersSnap = await getDocs(collection(db, 'users'));
      const members   = usersSnap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(u => u.role !== 'admin');

      const depth = countOnlyDirect ? 1 : (settings.networkDepth || 3);
      // BFS 전체 조직도
      const allUsers = usersSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      const upgraded   = [];
      const downgraded = [];
      for (const member of members) {
        const curRank    = member.rank || 'G0';
        const curIdx     = RANK_ORDER.indexOf(curRank);
        if (curIdx < 0) continue;

        // 산하 계산 (countOnlyDirectReferrals=true면 1대만)
        const downline = [];
        let lvl = [member.id];
        const scanDepth = countOnlyDirect ? 1 : depth;
        for (let d = 0; d < scanDepth; d++) {
          const next = allUsers.filter(u => lvl.includes(u.referredBy)).map(u => u.id);
          downline.push(...next);
          lvl = next;
          if (!next.length) break;
        }

        // 본인 활성 투자액
        const selfInvSnap = await getDocs(query(
          collection(db, 'investments'),
          where('userId', '==', member.id),
          where('status', '==', 'active')
        ));
        const selfInvest = selfInvSnap.docs.reduce((s, d) => s + (d.data().amount || 0), 0);

        // requireActiveInvestment: 활성 투자 없으면 G0으로 강등 가능
        if (requireActiveInvestment && selfInvest === 0 && curIdx > 0) {
          if (!preventDowngrade) {
            // 강등 허용이면 G0으로
            await updateDoc(doc(db, 'users', member.id), { rank: 'G0', updatedAt: serverTimestamp() });
            await this._auditLog(adminId, 'rank', `[활성투자 없음 강등] ${member.name||member.id}: ${curRank} → G0`,
              { userId: member.id, oldRank: curRank, newRank: 'G0', reason: 'no_active_investment' });
            downgraded.push({ userId: member.id, name: member.name, oldRank: curRank, newRank: 'G0', reason: '활성 투자 없음' });
          }
          continue;
        }

        let networkSales = 0;
        if (downline.length > 0) {
          const chunks = [];
          for (let i = 0; i < downline.length; i += 30) chunks.push(downline.slice(i, i + 30));
          for (const chunk of chunks) {
            const wSnap = await getDocs(query(
              collection(db, 'wallets'),
              where('userId', 'in', chunk)
            ));
            networkSales += wSnap.docs.reduce((s, d) => s + (d.data().totalInvest || d.data().totalInvested || 0), 0);
          }
        }

        // 균형 매출 계산
        let balancedVolume = networkSales;
        if (useBalancedVol && downline.length > 0) {
          balancedVolume = await this._calcBalancedVolume(member.id, downline, allUsers, networkSales, excludeTopLines, db);
        }

        const networkMembers = downline.length;

        // 달성 가능한 최고 직급 찾기 (전체 범위 스캔)
        let targetIdx = 0; // 아무 조건도 안 맞으면 G0
        for (let i = RANK_ORDER.length - 1; i >= 1; i--) {
          const rankId = RANK_ORDER[i];
          const crit   = criteria[rankId];
          if (!crit) continue;
          const cInvest  = selfInvest     >= (crit.minSelfInvest     || 0);
          const cSales   = networkSales   >= (crit.minNetworkSales   || 0);
          const cBV      = balancedVolume >= (crit.minBalancedVolume || 0);
          const cMembers = networkMembers >= (crit.minNetworkMembers || 0);
          // 조건이 모두 0이면 해당 직급 조건 없음으로 간주 (건너뜀)
          const hasAnyCrit = (crit.minSelfInvest||0)>0 || (crit.minNetworkSales||0)>0 || (crit.minBalancedVolume||0)>0 || (crit.minNetworkMembers||0)>0;
          if (!hasAnyCrit) continue;
          const bvRequired = (crit.minBalancedVolume || 0) > 0;
          // [요청사항 적용] 배치 승격도 "본인 투자금"과 "균형 매출" 2가지만 봅니다.
          const pass = cInvest && cBV;
          if (pass) { targetIdx = i; break; }
        }

        // preventDowngrade: targetIdx < curIdx 이면 강등 방지
        if (preventDowngrade && targetIdx < curIdx) {
          targetIdx = curIdx; // 현재 직급 유지
        }

        // Update sales stats ALWAYS
        const newRank = RANK_ORDER[targetIdx];
        const updatePayload = {
            totalInvested: selfInvest,
            networkSales: networkSales,
            updatedAt: serverTimestamp()
        };
        if (targetIdx !== curIdx) {
            updatePayload.rank = newRank;
        }
        await updateDoc(doc(db, 'users', member.id), updatePayload);
        
        if (targetIdx !== curIdx) {
          if (targetIdx > curIdx) {
            await this._auditLog(adminId, 'rank', `[일괄승격] ${member.name||member.id}: ${curRank} → ${newRank}`,
              { userId: member.id, oldRank: curRank, newRank, selfInvest, networkSales, balancedVolume, networkMembers });
            upgraded.push({ userId: member.id, name: member.name, oldRank: curRank, newRank });
          } else {
            await this._auditLog(adminId, 'rank', `[일괄강등] ${member.name||member.id}: ${curRank} → ${newRank}`,
              { userId: member.id, oldRank: curRank, newRank, selfInvest, networkSales, balancedVolume, networkMembers });
            downgraded.push({ userId: member.id, name: member.name, oldRank: curRank, newRank });
          }
        }
      }
      return ok({ upgraded: upgraded.length, downgraded: downgraded.length, details: upgraded, downgradedDetails: downgraded });
    } catch(e) { return err(e); }
  }

  // ─────────────────────────────────────────────────
  // 투자 상품
  // ─────────────────────────────────────────────────
  async getProducts(type) {
    try {
      let q = collection(this.db, 'products');
      if (type) q = query(q, where('type', '==', type));
      const snap = await getDocs(q);
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (a.order || 0) - (b.order || 0));
      return ok(data);
    } catch(e) { return err(e); }
  }

  async createProduct(adminId, data) {
    try {
      const ref = await addDoc(collection(this.db, 'products'), {
        ...data, createdBy: adminId, createdAt: serverTimestamp(), updatedAt: serverTimestamp()
      });
      await this._auditLog(adminId, 'product', `상품 생성: ${data.name}`, { id: ref.id });
      return ok({ id: ref.id });
    } catch(e) { return err(e); }
  }

  async updateProduct(adminId, productId, updates) {
    try {
      await updateDoc(doc(this.db, 'products', productId), { ...updates, updatedAt: serverTimestamp() });
      await this._auditLog(adminId, 'product', `상품 수정: ${productId}`, updates);
      return ok(true);
    } catch(e) { return err(e); }
  }

  async deleteProduct(adminId, productId) {
    try {
      await deleteDoc(doc(this.db, 'products', productId));
      await this._auditLog(adminId, 'product', `상품 삭제: ${productId}`, { id: productId });
      return ok(true);
    } catch(e) { return err(e); }
  }

  // ─────────────────────────────────────────────────
  // 투자 목록
  // ─────────────────────────────────────────────────
  async getAllInvestments(statusFilter) {
    try {
      let q = collection(this.db, 'investments');
      if (statusFilter) q = query(q, where('status', '==', statusFilter));
      const snap = await getDocs(q);
      const data = snap.docs.map(d => {
        const raw = { id: d.id, ...d.data() };
        // 필드명 정규화: 임포트 데이터(amount/productId/productName) ↔ UI기대(amountUsdt/packageId/packageName)
        return {
          ...raw,
          amountUsdt:   raw.amountUsdt   ?? raw.amount       ?? 0,
          packageId:    raw.packageId    ?? raw.productId    ?? '',
          packageName:  raw.packageName  ?? raw.productName  ?? '-',
          packageIcon:  raw.packageIcon  ?? raw.icon         ?? '💼',
          dailyRoi:     raw.dailyRoi     ?? 0,
          duration:     raw.duration     ?? 0,
          startDate:    raw.startDate    ?? raw.purchaseDate ?? null,
          endDate:      raw.endDate      ?? null,
          totalClaimed: raw.totalClaimed ?? raw.totalEarned  ?? 0,
        };
      }).sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      return ok(data);
    } catch(e) { return err(e); }
  }

  async getInvestmentAnalytics(dateFrom, dateTo, expireMode) {
    try {
      // 모듈 레벨 getDocs가 보조계정 여부에 따라 자동으로 프록시 경유
      const [invSnap, prodSnap, walSnap] = await Promise.all([
          getDocs(collection(this.db, 'investments')),
          getDocs(collection(this.db, 'products')),
          getDocs(collection(this.db, 'wallets')),
      ]);
      // 필드명 정규화
      const normalize = (d) => {
        const raw = { id: d.id, ...d.data() };
        return {
          ...raw,
          amountUsdt:   raw.amountUsdt   ?? raw.amount      ?? 0,
          packageId:    raw.packageId    ?? raw.productId   ?? '',
          packageName:  raw.packageName  ?? raw.productName ?? '-',
          packageIcon:  raw.packageIcon  ?? raw.icon        ?? '💼',
          dailyRoi:     raw.dailyRoi     ?? 0,
          duration:     raw.duration     ?? 0,
          startDate:    raw.startDate    ?? raw.purchaseDate ?? null,
          endDate:      raw.endDate      ?? null,
          totalClaimed: raw.totalClaimed ?? raw.totalEarned ?? 0,
        };
      };
      let data = invSnap.docs.map(normalize);
      if (dateFrom) data = data.filter(i => (i.createdAt?.seconds || 0) >= dateFrom / 1000);
      if (dateTo)   data = data.filter(i => (i.createdAt?.seconds || 0) <= dateTo / 1000);

      // 현재 시간 기준
      const nowSec = Date.now() / 1000;
      const endSec = (i) => i.endDate?.seconds ?? (i.endDate ? new Date(i.endDate).getTime()/1000 : 0);

      // 만료 필터
      if (expireMode === 'expiringSoon') {
        const soon = nowSec + 7 * 86400;
        data = data.filter(i => endSec(i) > 0 && endSec(i) <= soon && i.status === 'active');
      } else if (expireMode === 'expired') {
        data = data.filter(i => i.status === 'expired' || i.status === 'completed' || (i.status === 'active' && endSec(i) > 0 && endSec(i) < nowSec));
      }

      // 상품 목록
      const prodMap = {};
      prodSnap.docs.forEach(d => { prodMap[d.id] = { id: d.id, ...d.data() }; });

      // KPI 요약
      const active    = data.filter(i => i.status === 'active');
      const completed = data.filter(i => i.status === 'completed' || i.status === 'expired');
      const totalInvestAmt   = data.reduce((s,i) => s + (i.amountUsdt||0), 0);
      const totalExpectedRoi = data.reduce((s,i) => s + (i.amountUsdt||0)*(i.dailyRoi||0)*(i.duration||0), 0);
      const totalClaimed     = data.reduce((s,i) => s + (i.totalClaimed||0), 0);

      // wallets 합계
      const totalDeposit    = walSnap.docs.reduce((s,d) => s + (d.data().totalDeposit||0), 0);
      const totalWithdrawal = walSnap.docs.reduce((s,d) => s + (d.data().totalWithdrawal||0), 0);

      const summary = {
        totalDeposit, totalWithdrawal,
        totalInvestAmt, totalInvestCount: data.length,
        activeInvCount: active.length, completedCount: completed.length,
        totalExpectedRoi, totalClaimed,
      };

      // 상품별 집계
      const byProductMap = {};
      data.forEach(i => {
        const pid = i.packageId || 'unknown';
        if (!byProductMap[pid]) {
          byProductMap[pid] = {
            product: prodMap[pid] || { name: i.packageName||pid, icon: i.packageIcon||'💼', dailyRoi: i.dailyRoi||0, duration: i.duration||0 },
            count:0, activeCount:0, completedCount:0,
            totalAmtUsdt:0, totalRoi:0, totalClaimed:0, expiringCount:0, expiringAmtUsdt:0
          };
        }
        const b = byProductMap[pid];
        b.count++;
        b.totalAmtUsdt += (i.amountUsdt||0);
        b.totalRoi     += (i.amountUsdt||0)*(i.dailyRoi||0)*(i.duration||0);
        b.totalClaimed += (i.totalClaimed||0);
        if (i.status === 'active') {
          b.activeCount++;
          const es = endSec(i);
          if (es > 0 && es <= nowSec + 30*86400) { b.expiringCount++; b.expiringAmtUsdt += (i.amountUsdt||0); }
        } else {
          b.completedCount++;
        }
      });
      const byProduct = Object.values(byProductMap);

      // 월별 추이 (최근 6개월)
      const monthlyMap = {};
      data.forEach(i => {
        const sec = i.createdAt?.seconds || i.startDate?.seconds || 0;
        if (!sec) return;
        const d = new Date(sec * 1000);
        const label = `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}`;
        if (!monthlyMap[label]) monthlyMap[label] = { label, investCount:0, investAmt:0, roi:0, claimed:0, depositAmt:0, withdrawalAmt:0 };
        monthlyMap[label].investCount++;
        monthlyMap[label].investAmt += (i.amountUsdt||0);
        monthlyMap[label].roi       += (i.amountUsdt||0)*(i.dailyRoi||0)*(i.duration||0);
        monthlyMap[label].claimed   += (i.totalClaimed||0);
      });
      const monthly = Object.values(monthlyMap).sort((a,b) => a.label.localeCompare(b.label));

      // 만료 예정 목록
      const expiringList = active
        .filter(i => { const es = endSec(i); return es > 0 && es <= nowSec + 90*86400; })
        .sort((a,b) => endSec(a) - endSec(b));
      const expiring = {
        mode: expireMode || 'week',
        totalCount:     expiringList.length,
        totalAmtUsdt:   expiringList.reduce((s,i)=>s+(i.amountUsdt||0),0),
        totalReturnUsdt:expiringList.reduce((s,i)=>s+(i.amountUsdt||0)*(1+(i.dailyRoi||0)*(i.duration||0)),0),
        list:           expiringList,
      };

      return ok({ summary, byProduct, monthly, expiring, rawData: data });
    } catch(e) { return err(e); }
  }

  async getProductSalesStats(dateFrom, dateTo) {
    try {
      // investments 전체 로드
      const invSnap  = await getDocs(collection(this.db, 'investments'));
      const prodSnap = await getDocs(collection(this.db, 'products'));

      // products 맵
      const prodMap = {};
      prodSnap.docs.forEach(d => { prodMap[d.id] = { id: d.id, ...d.data() }; });

      // 날짜 필터 범위
      const fromSec = dateFrom ? dateFrom.getTime() / 1000 : 0;
      const toSec   = dateTo   ? (dateTo.getTime() / 1000 + 86400) : Infinity;

      // 상품별 집계
      const byProduct = {};

      invSnap.docs.forEach(d => {
        const inv = { id: d.id, ...d.data() };
        // 필드 정규화
        const pid    = inv.productId  || inv.packageId  || 'unknown';
        const amount = inv.amount     || inv.amountUsdt || 0;
        const pDate  = inv.purchaseDate || inv.startDate || inv.createdAt;
        const pSec   = pDate?.seconds ?? (pDate ? new Date(pDate).getTime()/1000 : 0);

        // 날짜 필터
        if (pSec < fromSec || pSec > toSec) return;

        if (!byProduct[pid]) {
          const prod = prodMap[pid] || {
            id: pid,
            name: inv.productName || inv.packageName || pid,
            type: 'investment',
            icon: inv.packageIcon || '💼',
            duration: inv.duration || 0,
            dailyRoi: inv.dailyRoi || 0,
            isActive: true,
          };
          byProduct[pid] = {
            product: prod,
            totalCount: 0,
            activeCount: 0,
            completedCount: 0,
            totalAmountUsdt: 0,
            // 날짜별 집계 (구매일 기준)
            byDate: {},
          };
        }

        const b = byProduct[pid];
        b.totalCount++;
        b.totalAmountUsdt += amount;
        if (inv.status === 'active')                                   b.activeCount++;
        else if (inv.status === 'completed' || inv.status === 'expired') b.completedCount++;
        else                                                            b.activeCount++; // 기본 active 취급

        // 날짜별 집계
        if (pSec > 0) {
          const dayKey = new Date(pSec * 1000).toISOString().slice(0, 10);
          if (!b.byDate[dayKey]) b.byDate[dayKey] = { count: 0, amount: 0 };
          b.byDate[dayKey].count++;
          b.byDate[dayKey].amount += amount;
        }
      });

      // products 정렬 (sortOrder 기준)
      const result = Object.values(byProduct)
        .sort((a, b) => (a.product.sortOrder || 99) - (b.product.sortOrder || 99));

      return ok(result);
    } catch(e) { return err(e); }
  }

  // ─────────────────────────────────────────────────
  // 월별 통계
  // ─────────────────────────────────────────────────
  async getMonthlyStats(months = 6) {
    try {
      const snap = await getDocs(collection(this.db, 'transactions'));
      const txs = snap.docs.map(d => d.data());
      const now = new Date();
      const result = [];
      for (let i = months - 1; i >= 0; i--) {
        const m = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const label = `${m.getFullYear()}.${String(m.getMonth() + 1).padStart(2, '0')}`;
        const startSec = m.getTime() / 1000;
        const endSec   = new Date(m.getFullYear(), m.getMonth() + 1, 1).getTime() / 1000;
        const monthTxs = txs.filter(t => {
          const s = t.createdAt?.seconds || 0;
          return s >= startSec && s < endSec;
        });
        result.push({
          label,
          deposits:    monthTxs.filter(t => t.type === 'deposit' && t.status === 'approved').reduce((s, t) => s + (t.amount || 0), 0),
          withdrawals: monthTxs.filter(t => t.type === 'withdrawal' && t.status === 'approved').reduce((s, t) => s + (t.amount || 0), 0),
          newUsers:    0 // users 컬렉션에서 별도 계산 필요
        });
      }
      return ok(result);
    } catch(e) { return err(e); }
  }

  async getRankDistribution() {
    try {
      const snap = await getDocs(collection(this.db, 'users'));
      const dist = {};
      snap.docs.forEach(d => {
        const rank = d.data().rank || 'G0';
        if (d.data().role === 'admin') return;
        dist[rank] = (dist[rank] || 0) + 1;
      });
      return ok(dist);
    } catch(e) { return err(e); }
  }

  // ─────────────────────────────────────────────────
  // CSV 내보내기
  // ─────────────────────────────────────────────────
  async exportMembersCSV() {
    try {
      const snap = await getDocs(collection(this.db, 'users'));
      const rows = snap.docs.map(d => d.data()).filter(u => u.role !== 'admin');
      const header = ['이름', '이메일', '직급', '상태', '추천인수', '가입일'];
      const lines = rows.map(u => [
        u.name || '', u.email || '', u.rank || 'G0', u.status || '',
        u.totalReferrals || 0,
        u.createdAt ? new Date(u.createdAt.seconds * 1000).toLocaleDateString('ko-KR') : ''
      ].join(','));
      const csv = [header.join(','), ...lines].join('\n');
      this._downloadCSV(csv, 'members.csv');
      return ok(true);
    } catch(e) { return err(e); }
  }

  async exportTransactionsCSV() {
    try {
      const snap = await getDocs(collection(this.db, 'transactions'));
      const rows = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      const header = ['ID', '유형', '금액', '상태', '회원UID', '일시'];
      const lines = rows.map(r => [
        r.id, r.type || '', r.amount || 0, r.status || '',
        r.userId || '',
        r.createdAt ? new Date(r.createdAt.seconds * 1000).toLocaleString('ko-KR') : ''
      ].join(','));
      const csv = [header.join(','), ...lines].join('\n');
      this._downloadCSV(csv, 'transactions.csv');
      return ok(true);
    } catch(e) { return err(e); }
  }

  _downloadCSV(csv, filename) {
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  }

  // ─────────────────────────────────────────────────
  // 조직도
  // ─────────────────────────────────────────────────
  async getOrgTree(rootUserId, maxDepth = 5) {
    try {
      // users + wallets 병렬 로드
      
      let userSnap, walletSnap;
      try {
        userSnap = await getDocs(collection(this.db, 'users'));
      } catch (e) {
        console.error('Failed to get users', e);
        return fail(e);
      }
      
      const walletMap = new Map();
      try {
        walletSnap = await getDocs(collection(this.db, 'wallets'));
        if (walletSnap && walletSnap.docs) {
            walletSnap.docs.forEach(d => walletMap.set(d.id, d.data()));
        }
      } catch (e) {
        console.warn('Failed to get wallets (permission denied usually for non-admins)', e.message);
        // continue without wallets
      }


      const allDocs = userSnap.docs.map(d => {
        const data = d.data();
        const uid  = data.uid || d.id;
        const wallet = walletMap.get(uid) || walletMap.get(d.id) || {};
        return {
          ...data,
          id: d.id,
          _uid: uid,
          totalInvested: wallet.totalInvested || wallet.totalInvest || data.totalInvested || data.totalInvest || 0,
          bonusBalance:  wallet.bonusBalance  || data.bonusBalance  || 0,
        };
      });
      const users = allDocs.filter(u => u.role !== 'admin');

      // _uid 집합
      const uidSet = new Set(users.map(u => u._uid));

      // referredBy 정규화
      const getRef = (u) => {
        const r = u.referredBy;
        return (r && r !== '') ? r : null;
      };

      // 자식 맵 사전 구축
      const childrenMap = new Map();
      for (const u of users) childrenMap.set(u._uid, []);
      for (const u of users) {
        const ref = getRef(u);
        if (ref && childrenMap.has(ref)) childrenMap.get(ref).push(u);
      }

      // ── 전체 노드에 대한 하부 조직 통계(인원, 매출) 사전 계산 ──
      const statsMap = new Map();
      const computeStats = (uid) => {
        if (statsMap.has(uid)) return statsMap.get(uid);
        // 순환참조 무한루프 방지
        statsMap.set(uid, { subCount: 0, subSales: 0, gen1Count: 0, gen1Sales: 0, gen2Count: 0, gen2Sales: 0 });
        
        let subCount = 0; let subSales = 0;
        let gen1Count = 0; let gen1Sales = 0;
        let gen2Count = 0; let gen2Sales = 0;

        const children = childrenMap.get(uid) || [];
        gen1Count = children.length;

        for (const child of children) {
          const inv = Number(child.totalInvested || 0);
          gen1Sales += inv;
          subCount += 1;
          subSales += inv;

          const childStats = computeStats(child._uid);
          gen2Count += childStats.gen1Count;
          gen2Sales += childStats.gen1Sales;
          subCount += childStats.subCount;
          subSales += childStats.subSales;
        }

        const res = { subCount, subSales, gen1Count, gen1Sales, gen2Count, gen2Sales };
        statsMap.set(uid, res);
        return res;
      };
      // 모든 유저에 대해 통계 계산 실행
      for (const u of users) {
        if (!statsMap.has(u._uid)) computeStats(u._uid);
      }

      // depth 제한 + 순환참조 방지 트리 빌드
      const buildTree = (rootUid) => {
        const visited = new Set();
        const buildNode = (uid, depth) => {
          if (visited.has(uid)) return [];
          visited.add(uid);
          const children = childrenMap.get(uid) || [];
          if (depth >= maxDepth) {
            return children.map(child => ({
              ...child,
              _stats: statsMap.get(child._uid),
              children: [],
              hasMore: (childrenMap.get(child._uid) || []).length > 0
            }));
          }
          return children.map(child => ({
            ...child,
            _stats: statsMap.get(child._uid),
            children: buildNode(child._uid, depth + 1),
            hasMore: false
          }));
        };
        return buildNode(rootUid, 0);
      };

      if (rootUserId) {
        const root = users.find(u => u.id === rootUserId || u._uid === rootUserId);
        if (!root) return ok([]);
        return ok([{ ...root, _stats: statsMap.get(root._uid), children: buildTree(root._uid), hasMore: false }]);
      } else {
        const roots = users.filter(u => {
          const ref = getRef(u);
          return !ref || !uidSet.has(ref);
        });
        return ok(roots.map(r => ({ ...r, _stats: statsMap.get(r._uid), children: buildTree(r._uid), hasMore: false })));
      }
    } catch(e) {
      console.error('[getOrgTree] 에러:', e);
      return err(e);
    }
  }

  // ─────────────────────────────────────────────────
  // 조직도 - 특정 회원 기준 위아래 트리
  // ─────────────────────────────────────────────────
  async getOrgTreeCentered(targetUserId, upDepth = 2, downDepth = 3) {
    try {
      
      let userSnap, walletSnap;
      try {
        userSnap = await getDocs(collection(this.db, 'users'));
      } catch (e) {
        console.error('Failed to get users', e);
        return fail(e);
      }
      
      const walletMap = new Map();
      try {
        walletSnap = await getDocs(collection(this.db, 'wallets'));
        if (walletSnap && walletSnap.docs) {
            walletSnap.docs.forEach(d => walletMap.set(d.id, d.data()));
        }
      } catch (e) {
        console.warn('Failed to get wallets (permission denied usually for non-admins)', e.message);
        // continue without wallets
      }


      const allDocs = userSnap.docs.map(d => {
        const data = d.data();
        const uid  = data.uid || d.id;
        const wallet = walletMap.get(uid) || walletMap.get(d.id) || {};
        return {
          ...data,
          id: d.id,
          _uid: uid,
          totalInvested: wallet.totalInvested || wallet.totalInvest || data.totalInvested || data.totalInvest || 0,
          bonusBalance:  wallet.bonusBalance  || data.bonusBalance  || 0,
        };
      });
      
      // uid → user 맵 (관리자 포함)
      const userMap = new Map();
      allDocs.forEach(u => { userMap.set(u._uid, u); userMap.set(u.id, u); });

      // 자식 맵
      const childrenMap = new Map();
      allDocs.forEach(u => childrenMap.set(u._uid, []));
      allDocs.forEach(u => {
        // 관리자는 누군가의 하위로 들어가지 않게 처리
        if (u.role === 'admin') return;
        const ref = u.referredBy;
        if (ref && ref !== '' && childrenMap.has(ref)) {
           childrenMap.get(ref).push(u);
        } else if (!ref || ref === 'admin' || ref === 'COMPANY ROOT') {
           // Admin의 하위로 명시적으로 연결
           // admin uid를 찾아서 넣거나, 그냥 최상위 admin에게 연결
           const admins = allDocs.filter(a => a.role === 'admin');
           if (admins.length > 0) {
               const adminUid = admins[0]._uid;
               if (childrenMap.has(adminUid)) {
                   childrenMap.get(adminUid).push(u);
               }
           }
        }
      });


      const target = userMap.get(targetUserId);
      if (!target) return ok(null);

      // ── 위로 올라가기 (부모 체인) ──
      // 반환: [{user, level}] level=1이 바로 위 부모, level=upDepth가 최상위
      const parentChain = [];
      let cur = target;
      for (let i = 0; i < upDepth; i++) {
        const ref = cur.referredBy;
        if (!ref || ref === '') break;
        const parent = userMap.get(ref);
        if (!parent) break;
        parentChain.unshift({ ...parent, _level: -(i + 1) }); // 음수 = 위
        cur = parent;
      }

      // ── 아래로 내려가기 (자식 트리) ──
      const buildDown = (uid, depth) => {
        const visited = new Set();
        const go = (u, d) => {
          if (visited.has(u._uid)) return [];
          visited.add(u._uid);
          const children = childrenMap.get(u._uid) || [];
          if (d >= depth) return children.map(c => ({ ...c, children: [], hasMore: (childrenMap.get(c._uid)||[]).length > 0 }));
          return children.map(c => ({ ...c, children: go(c, d + 1), hasMore: false }));
        };
        return go(userMap.get(uid) || {_uid: uid}, 0);
      };

      const targetNode = { ...target, children: buildDown(target._uid, downDepth), hasMore: false, _isCenter: true };

      return ok({ target: targetNode, parents: parentChain });
    } catch(e) {
      console.error('[getOrgTreeCentered] 에러:', e);
      return err(e);
    }
  }

  // ─────────────────────────────────────────────────
  // 센터 관리
  // ─────────────────────────────────────────────────
  async getCenters() {
    try {
      const snap = await getDocs(collection(this.db, 'centers'));
      return ok(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch(e) { return err(e); }
  }

  async createCenter(adminId, data) {
    try {
      const ref = await addDoc(collection(this.db, 'centers'), {
        ...data, createdBy: adminId, createdAt: serverTimestamp()
      });
      // 부센터장 권한 부여
      if (data.subCenters && Array.isArray(data.subCenters)) {
        for (const sub of data.subCenters) {
          if (sub.userId) {
            await updateDoc(doc(this.db, 'users', sub.userId), { isSubCenterManager: true, managingSubCenterId: ref.id }).catch(() => {});
          }
        }
      }
      return ok({ id: ref.id });
    } catch(e) { return err(e); }
  }

  async updateCenter(adminId, centerId, updates) {
    try {
      const centerDoc = await getDoc(doc(this.db, 'centers', centerId));
      if (centerDoc.exists()) {
        const oldData = centerDoc.data();
        if (oldData.subCenters && Array.isArray(oldData.subCenters)) {
          for (const oldSub of oldData.subCenters) {
            if (oldSub.userId) {
              await updateDoc(doc(this.db, 'users', oldSub.userId), { isSubCenterManager: false, managingSubCenterId: null }).catch(() => {});
            }
          }
        }
      }

      await updateDoc(doc(this.db, 'centers', centerId), { ...updates, updatedAt: serverTimestamp() });
      
      // 새 부센터장 권한 부여
      if (updates.subCenters && Array.isArray(updates.subCenters)) {
        for (const sub of updates.subCenters) {
          if (sub.userId) {
            await updateDoc(doc(this.db, 'users', sub.userId), { isSubCenterManager: true, managingSubCenterId: centerId }).catch(() => {});
          }
        }
      }
      return ok(true);
    } catch(e) { return err(e); }
  }

  async deleteCenter(adminId, centerId) {
    try {
      await deleteDoc(doc(this.db, 'centers', centerId));
      return ok(true);
    } catch(e) { return err(e); }
  }

  async getCenterMembers(centerId) {
    try {
      const q = query(collection(this.db, 'users'), where('centerId', '==', centerId));
      const snap = await getDocs(q);
      return ok(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch(e) { return err(e); }
  }

  // ─────────────────────────────────────────────────
  // 브로드캐스트 (푸시 알림)
  // ─────────────────────────────────────────────────
  async broadcastPush(adminId, payload) {
    try {
      const ref = await addDoc(collection(this.db, 'broadcasts'), {
        ...payload, sentBy: adminId, sentAt: serverTimestamp(), status: 'sent'
      });
      // 대상 회원 알림 컬렉션에 저장
      const usersSnap = await getDocs(collection(this.db, 'users'));
      const batch = writeBatch(this.db);
      let count = 0;
      usersSnap.docs.forEach(ud => {
        const u = ud.data();
        if (u.role === 'admin') return;
        // targetGroup 필터 적용
        const tg = payload.targetGroup || 'all';
        if (tg !== 'all') {
          if (tg === 'active' && u.status !== 'active') return;
          if (tg === 'vip' && !['G5','G6','G7','G8','G9','G10'].includes(u.rank)) return;
          if (tg === 'new') {
            const ts = u.createdAt?.seconds ? u.createdAt.seconds * 1000 : 0;
            if (Date.now() - ts > 7 * 86400000) return;
          }
        }
        const nRef = doc(collection(this.db, 'notifications'));
        batch.set(nRef, {
          userId: ud.id, title: payload.title, message: payload.message,
          type: payload.type || 'system', isRead: false,
          broadcastId: ref.id, createdAt: serverTimestamp()
        });
        count++;
      });
      await batch.commit();
      await updateDoc(doc(this.db, 'broadcasts', ref.id), { count });
      await this._auditLog(adminId, 'broadcast', `브로드캐스트: ${payload.title}`, { id: ref.id, count });
      return ok({ id: ref.id, count });
    } catch(e) { return err(e); }
  }

  async getBroadcastHistory(maxCount = 100) {
    try {
      const snap = await getDocs(query(collection(this.db, 'broadcasts'), limit(maxCount)));
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (b.sentAt?.seconds || 0) - (a.sentAt?.seconds || 0));
      return ok(data);
    } catch(e) { return err(e); }
  }

  async getScheduledBroadcasts(statusFilter) {
    try {
      let q = collection(this.db, 'scheduledBroadcasts');
      if (statusFilter) q = query(q, where('status', '==', statusFilter));
      const snap = await getDocs(q);
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (a.scheduledAt?.seconds || 0) - (b.scheduledAt?.seconds || 0));
      return ok(data);
    } catch(e) { return err(e); }
  }

  async createScheduledBroadcast(adminId, payload) {
    try {
      const ref = await addDoc(collection(this.db, 'scheduledBroadcasts'), {
        ...payload, createdBy: adminId, createdAt: serverTimestamp(), status: 'pending'
      });
      return ok({ id: ref.id });
    } catch(e) { return err(e); }
  }

  async cancelScheduledBroadcast(adminId, id) {
    try {
      await updateDoc(doc(this.db, 'scheduledBroadcasts', id), { status: 'cancelled', cancelledBy: adminId });
      return ok(true);
    } catch(e) { return err(e); }
  }

  async executeScheduledBroadcast(adminId, id) {
    try {
      const snap = await getDoc(doc(this.db, 'scheduledBroadcasts', id));
      if (!snap.exists()) throw new Error('예약 없음');
      const r = await this.broadcastPush(adminId, snap.data());
      if (r.success) {
        await updateDoc(doc(this.db, 'scheduledBroadcasts', id), { status: 'sent', sentAt: serverTimestamp() });
      }
      return r;
    } catch(e) { return err(e); }
  }

  async checkAndFireScheduledBroadcasts(adminId) {
    try {
      const now = Date.now() / 1000;
      const q = query(collection(this.db, 'scheduledBroadcasts'), where('status', '==', 'pending'));
      const snap = await getDocs(q);
      let fired = 0;
      for (const d of snap.docs) {
        const data = d.data();
        if ((data.scheduledAt?.seconds || 0) <= now) {
          await this.executeScheduledBroadcast(adminId, d.id);
          fired++;
        }
      }
      return ok({ fired });
    } catch(e) { return err(e); }
  }

  // ─────────────────────────────────────────────────
  // 자동 규칙
  // ─────────────────────────────────────────────────
  async getAutoRules() {
    try {
      const snap = await getDocs(collection(this.db, 'autoRules'));
      return ok(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch(e) { return err(e); }
  }

  async createAutoRule(adminId, data) {
    try {
      const ref = await addDoc(collection(this.db, 'autoRules'), {
        ...data, createdBy: adminId, createdAt: serverTimestamp(), isActive: true
      });
      return ok({ id: ref.id });
    } catch(e) { return err(e); }
  }

  async updateAutoRule(adminId, id, updates) {
    try {
      await updateDoc(doc(this.db, 'autoRules', id), { ...updates, updatedAt: serverTimestamp() });
      return ok(true);
    } catch(e) { return err(e); }
  }

  async deleteAutoRule(adminId, id) {
    try {
      await deleteDoc(doc(this.db, 'autoRules', id));
      return ok(true);
    } catch(e) { return err(e); }
  }

  // ─────────────────────────────────────────────────
  // 자동 규칙 엔진 - 이벤트 발생 시 호출
  // ─────────────────────────────────────────────────
  /**
   * 특정 이벤트 발생 시 활성화된 자동 규칙을 검색하고 해당 알림을 발송합니다.
   *
   * @param {string} eventType  - 'deposit_complete' | 'withdrawal_complete' | 'withdrawal_rejected' |
   *                              'rank_upgrade' | 'referral_joined' | 'investment_start' |
   *                              'investment_expire' | 'roi_claimed' | 'bonus_received'
   * @param {string} targetUserId - 이벤트의 주체 userId (알림 수신자)
   * @param {object} vars       - 메시지 치환 변수 { name, amount, rank, date, referrerName, ... }
   * @param {string} [actorId]  - 이벤트를 발생시킨 adminId (로그용)
   */
  async fireAutoRules(eventType, targetUserId, vars = {}, actorId = 'SYSTEM') {
    try {
      // 1) 활성화된 자동 규칙 중 해당 트리거만 필터
      const rulesSnap = await getDocs(collection(this.db, 'autoRules'));
      const rules = rulesSnap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(r => r.isActive !== false && r.triggerEvent === eventType);

      if (!rules.length) return ok({ fired: 0 });

      // 2) 수신 대상 회원 정보 조회
      const userSnap = await getDoc(doc(this.db, 'users', targetUserId));
      if (!userSnap.exists()) return ok({ fired: 0 });
      const user = userSnap.data();

      // 3) 각 규칙에 대해 대상 필터링 후 알림 발송
      const batch = writeBatch(this.db);
      let fired = 0;

      for (const rule of rules) {
        // 대상 그룹 필터
        const tg = rule.targetGroup || 'all';
        if (tg !== 'all') {
          if (tg === 'active' && user.status !== 'active') continue;
          if (tg === 'invested') {
            // 투자 중인 회원만 - wallets에 totalInvested > 0 확인
            const wSnap = await getDoc(doc(this.db, 'wallets', targetUserId));
            if (!wSnap.exists() || !((wSnap.data().totalInvested || wSnap.data().totalInvest) > 0)) continue;
          }
          // 직급 필터 (G0~G10: 해당 직급 이상)
          const rankOrder = ['G0','G1','G2','G3','G4','G5','G6','G7','G8','G9','G10'];
          if (rankOrder.includes(tg)) {
            const userRankIdx = rankOrder.indexOf(user.rank || 'G0');
            const ruleRankIdx = rankOrder.indexOf(tg);
            if (userRankIdx < ruleRankIdx) continue;
          }
        }

        // 메시지 변수 치환
        const today = new Date().toLocaleDateString('ko-KR');
        const replaceVars = {
          '{{name}}':   vars.name   || user.name  || user.referralCode || targetUserId,
          '{{amount}}': vars.amount !== undefined ? `${vars.amount}` : '',
          '{{rank}}':   vars.rank   || user.rank  || 'G0',
          '{{date}}':   vars.date   || today,
          '{{referrerName}}': vars.referrerName || '',
          '{{productName}}':  vars.productName  || '',
        };

        let finalTitle   = rule.title   || '';
        let finalMessage = rule.message || '';
        for (const [k, v] of Object.entries(replaceVars)) {
          finalTitle   = finalTitle.replace(new RegExp(k.replace('{{','\\{\\{').replace('}}','\\}\\}'), 'g'), v);
          finalMessage = finalMessage.replace(new RegExp(k.replace('{{','\\{\\{').replace('}}','\\}\\}'), 'g'), v);
        }

        // 발송 지연 처리 (delayMinutes > 0 이면 scheduledBroadcasts에 예약)
        const delayMinutes = rule.delayMinutes || 0;
        if (delayMinutes > 0) {
          const scheduledAt = new Date(Date.now() + delayMinutes * 60000);
          await addDoc(collection(this.db, 'scheduledBroadcasts'), {
            title: finalTitle,
            message: finalMessage,
            type: rule.type || 'push',
            priority: rule.priority || 'normal',
            icon: rule.icon || '🔔',
            color: rule.color || '#10b981',
            targetGroup: 'specific',
            specificUserId: targetUserId,
            scheduledAt: scheduledAt,
            status: 'pending',
            autoRuleId: rule.id,
            triggerEvent: eventType,
            createdBy: actorId,
            createdAt: serverTimestamp(),
          });
        } else {
          // 즉시 발송 - notifications 컬렉션에 직접 저장
          const nRef = doc(collection(this.db, 'notifications'));
          batch.set(nRef, {
            userId: targetUserId,
            title: finalTitle,
            message: finalMessage,
            type: rule.type || 'push',
            priority: rule.priority || 'normal',
            icon: rule.icon || '🔔',
            color: rule.color || '#10b981',
            isRead: false,
            autoRuleId: rule.id,
            triggerEvent: eventType,
            createdAt: serverTimestamp(),
          });
        }

        // 규칙 발송 횟수 증가
        const ruleRef = doc(this.db, 'autoRules', rule.id);
        batch.update(ruleRef, { triggerCount: increment(1), lastFiredAt: serverTimestamp() });

        fired++;
      }

      await batch.commit();
      return ok({ fired });
    } catch(e) {
      console.warn('[fireAutoRules] 오류:', e);
      return err(e);
    }
  }

  /**
   * 하부 조직(다단계) 추천인 체인 전체에 '하부 가입 알림' 발송
   * 신규 회원이 가입했을 때 referredBy 체인을 타고 올라가며 모두 알림
   *
   * @param {string} newUserId  - 신규 가입 회원 userId
   * @param {object} newUser    - { name, referralCode, referredBy }
   */
  async fireReferralChainNotification(newUserId, newUser) {
    try {
      // 활성 referral_joined 규칙이 없으면 조기 종료
      const rulesSnap = await getDocs(collection(this.db, 'autoRules'));
      const hasReferralRule = rulesSnap.docs.some(
        d => d.data().isActive !== false && d.data().triggerEvent === 'referral_joined'
      );
      if (!hasReferralRule) return ok({ fired: 0 });

      // 전체 회원 맵 구성 (referralCode → userId 매핑)
      const usersSnap = await getDocs(collection(this.db, 'users'));
      const codeToUid = {};
      const userMap   = {};
      usersSnap.docs.forEach(d => {
        const u = d.data();
        userMap[d.id] = { id: d.id, ...u };
        if (u.referralCode) codeToUid[u.referralCode] = d.id;
      });

      // referredBy 체인을 따라 올라가며 상위 추천인 수집
      const chain = [];
      let cur = newUser.referredBy ? (codeToUid[newUser.referredBy] || newUser.referredBy) : null;
      const visited = new Set([newUserId]);
      let depth = 0;
      while (cur && !visited.has(cur) && depth < 20) {
        visited.add(cur);
        if (userMap[cur]) chain.push(cur);
        cur = userMap[cur]?.referredBy
          ? (codeToUid[userMap[cur].referredBy] || userMap[cur].referredBy)
          : null;
        depth++;
      }

      // 각 상위 추천인에게 알림 발송
      let fired = 0;
      for (const referrerId of chain) {
        const referrer = userMap[referrerId];
        if (!referrer || referrer.role === 'admin') continue;
        const r = await this.fireAutoRules('referral_joined', referrerId, {
          name: referrer.name || referrer.referralCode || referrerId,
          referrerName: newUser.name || newUser.referralCode || newUserId,
          amount: '',
          rank: referrer.rank || 'G0',
        }, 'SYSTEM');
        if (r.success) fired += r.data?.fired || 0;
      }

      return ok({ fired, chainLength: chain.length });
    } catch(e) {
      console.warn('[fireReferralChainNotification] 오류:', e);
      return err(e);
    }
  }


  /**
   * 하부 조직(다단계) 추천인 체인 전체에 '하부 입금 알림' 발송
   */
  async fireReferralDepositNotification(depositUserId, depositUser, depositAmount) {
    try {
      // 활성 대상 규칙이 없으면 조기 종료 (별도로 'deposit_complete' 트리거를 공유하거나, 하부 입금 전용 트리거가 없으므로 알림 직접 발송)
      
      // 전체 회원 맵 구성
      const usersSnap = await getDocs(collection(this.db, 'users'));
      const codeToUid = {};
      const userMap   = {};
      usersSnap.docs.forEach(d => {
        const u = d.data();
        userMap[d.id] = { id: d.id, ...u };
        if (u.referralCode) codeToUid[u.referralCode] = d.id;
      });

      // 체인 구성 (1대 추천인까지만 보낼지, 체인 전체에 보낼지 - 요청에 따라 상위 스폰서에게 발송, 보통 1~2대 또는 전체)
      const chain = [];
      let cur = depositUser.referredBy ? (codeToUid[depositUser.referredBy] || depositUser.referredBy) : null;
      const visited = new Set([depositUserId]);
      let depth = 0;
      while (cur && !visited.has(cur) && depth < 20) {
        visited.add(cur);
        if (userMap[cur]) chain.push(cur);
        cur = userMap[cur]?.referredBy
          ? (codeToUid[userMap[cur].referredBy] || userMap[cur].referredBy)
          : null;
        depth++;
      }

      if (!chain.length) return ok({ fired: 0 });

      // 이름 마스킹 (예: 홍길동 -> 홍*동, kims@gmail.com -> ki***)
      let maskedName = '익명';
      if (depositUser.name && depositUser.name.length > 1) {
        maskedName = depositUser.name.substring(0, 1) + '*'.repeat(depositUser.name.length - 1);
      } else if (depositUser.email) {
        maskedName = depositUser.email.split('@')[0].substring(0, 2) + '***';
      }

      const batch = writeBatch(this.db);
      let fired = 0;
      
      for (const referrerId of chain) {
        // 즉시 발송 - notifications 컬렉션에 직접 저장
        const nRef = doc(collection(this.db, 'notifications'));
        batch.set(nRef, {
          userId: referrerId,
          title: '💰 하부 파트너 입금 안내',
          message: `[${maskedName}] 파트너님이 ${depositAmount} USDT를 입금하여 하부 매출이 증가했습니다!`,
          type: 'push',
          priority: 'normal',
          icon: '💰',
          color: '#10b981',
          isRead: false,
          triggerEvent: 'downline_deposit',
          createdAt: serverTimestamp(),
        });
        fired++;
      }
      
      await batch.commit();
      return ok({ fired });
    } catch(e) {
      console.warn('[fireReferralDepositNotification] 오류:', e);
      return err(e);
    }
  }

  /**
   * 하부 조직(다단계) 추천인 체인 전체에 '하부 투자 알림' 발송
   * 하부 회원이 투자를 했을 때 referredBy 체인을 타고 올라가며 모두 알림
   */
  async fireReferralInvestmentNotification(investUserId, investUser, investAmount) {
    try {
      // 활성 investment_start 규칙이 없으면 조기 종료
      const rulesSnap = await getDocs(collection(this.db, 'autoRules'));
      const hasInvestRule = rulesSnap.docs.some(
        d => d.data().isActive !== false && d.data().triggerEvent === 'investment_start'
      );
      if (!hasInvestRule) return ok({ fired: 0 });

      // 전체 회원 맵 구성
      const usersSnap = await getDocs(collection(this.db, 'users'));
      const codeToUid = {};
      const userMap   = {};
      usersSnap.docs.forEach(d => {
        const u = d.data();
        userMap[d.id] = { id: d.id, ...u };
        if (u.referralCode) codeToUid[u.referralCode] = d.id;
      });

      // 체인 구성
      const chain = [];
      let cur = investUser.referredBy ? (codeToUid[investUser.referredBy] || investUser.referredBy) : null;
      const visited = new Set([investUserId]);
      let depth = 0;
      while (cur && !visited.has(cur) && depth < 20) {
        visited.add(cur);
        if (userMap[cur]) chain.push(cur);
        cur = userMap[cur]?.referredBy
          ? (codeToUid[userMap[cur].referredBy] || userMap[cur].referredBy)
          : null;
        depth++;
      }

      if (!chain.length) return ok({ fired: 0 });

      // 이름 마스킹 (예: 홍길동 -> 홍*동, kims@gmail.com -> ki***)
      let maskedName = '익명';
      if (investUser.name && investUser.name.length > 1) {
        maskedName = investUser.name.substring(0, 1) + '*'.repeat(investUser.name.length - 1);
      } else if (investUser.email) {
        maskedName = investUser.email.split('@')[0].substring(0, 2) + '***';
      }

      let fired = 0;
      for (const referrerId of chain) {
        const r = await this.fireAutoRules('investment_start', referrerId, {
          investorName: maskedName,
          amount: investAmount
        });
        if (r.success) fired += r.data.fired || 0;
      }
      return ok({ fired });
    } catch(e) {
      console.warn('[fireReferralInvestmentNotification] 오류:', e);
      return err(e);
    }
  }

  // ─────────────────────────────────────────────────
  // 관리자 알림 저장

  // ─────────────────────────────────────────────────
  /**
   * Firestore adminNotifications 컬렉션에 관리자용 알림을 저장합니다.
   * @param {string} type  - 'deposit_failed' | 'deposit_success' | 'rank_up' | 'withdrawal' | 'system'
   * @param {string} title - 알림 제목
   * @param {string} body  - 알림 내용
   * @param {object} meta  - 추가 데이터 (userId, txId 등)
   */
  async _sendAdminNotification(type, title, body, meta = {}) {
    try {
      await addDoc(collection(this.db, 'adminNotifications'), {
        type, title, body, meta,
        isRead: false,
        createdAt: serverTimestamp()
      });
    } catch(_) { /* 알림 저장 실패는 무시 */ }
  }

  async getAdminNotifications(maxCount = 50) {
    try {
      const snap = await getDocs(
        query(
          collection(this.db, 'adminNotifications'),
          orderBy('createdAt', 'desc'),
          limit(maxCount)
        )
      );
      return ok(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch(e) { return err(e); }
  }

  async markAdminNotificationRead(notifId) {
    try {
      await updateDoc(doc(this.db, 'adminNotifications', notifId), { isRead: true });
      return ok(true);
    } catch(e) { return err(e); }
  }

  async markAllAdminNotificationsRead() {
    try {
      const snap = await getDocs(
        query(collection(this.db, 'adminNotifications'), where('isRead', '==', false))
      );
      if (snap.empty) return ok(0);
      const batch = writeBatch(this.db);
      snap.docs.forEach(d => batch.update(d.ref, { isRead: true }));
      await batch.commit();
      return ok(snap.size);
    } catch(e) { return err(e); }
  }

  async deleteAdminNotification(notifId) {
    try {
      await deleteDoc(doc(this.db, 'adminNotifications', notifId));
      return ok(true);
    } catch(e) { return err(e); }
  }

  // ─────────────────────────────────────────────────
  // 내부 감사 로그 기록
  // ─────────────────────────────────────────────────
  async _auditLog(adminId, rawCategory, action, meta = {}) {
    try {
      // rawCategory → UI 통계 탭(rank/asset/auth/member/system/notify/support/etc)으로 정규화
      const CAT_MAP = {
        rank:         'rank',
        wallet_adjust:'asset',
        bonus:        'asset',
        deposit:      'asset',
        withdrawal:   'asset',
        settlement:   'asset',
        member:       'member',
        auth:         'auth',
        system:       'system',
        settings:     'system',
        product:      'system',
        broadcast:    'notify',
        notify:       'notify',
        ticket:       'support',
        support:      'support',
        notice:       'system',
        news:         'system',
        wallet:       'asset',
      };
      const category = CAT_MAP[rawCategory] || rawCategory;
      await addDoc(collection(this.db, 'auditLogs'), {
        adminId, category, rawCategory, action, meta,
        timestamp: serverTimestamp()   // ← createdAt → timestamp 로 통일
      });
    } catch(_) { /* 감사 로그 실패는 무시 */ }
  }

  // ─────────────────────────────────────────────────
  // 범용 Firestore 헬퍼 (settings 등 직접 접근용)
  // ─────────────────────────────────────────────────

  /** settings/{docId} 단일 문서 스냅샷 반환 */
  async getRawDoc(collectionName, docId) {
    return await getDoc(doc(this.db, collectionName, docId));
  }

  /** settings/{docId} 문서 덮어쓰기 (merge:true) */
  async setRawDoc(collectionName, docId, data) {
    await setDoc(doc(this.db, collectionName, docId), data, { merge: true });
  }

  /** settings/{docId} 문서 완전 교체 (이전 필드 모두 삭제) */
  async setRawDocFull(collectionName, docId, data) {
    await setDoc(doc(this.db, collectionName, docId), data);
  }

  /** 감사 로그 공개 인터페이스 */
  async addAuditLog(adminId, action, meta = {}) {
    await this._auditLog(adminId, 'system', action, meta);
  }

  async updateAllSalesStats(adminId) {
    try {
      const { collection, getDocs, db, updateDoc, doc, serverTimestamp } = window.FB || this;
      const usersSnap = await getDocs(collection(db, 'users'));
      const walletsSnap = await getDocs(collection(db, 'wallets'));
      
      const allUsers = usersSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const walletMap = {};
      walletsSnap.docs.forEach(d => {
        walletMap[d.id] = d.data().totalInvested || d.data().totalInvest || 0;
      });
      
      const childrenMap = {};
      const userMap = {};
      allUsers.forEach(u => {
          childrenMap[u.id] = [];
          userMap[u.id] = u;
      });
      allUsers.forEach(u => {
          if (u.referredBy && childrenMap[u.referredBy]) {
              childrenMap[u.referredBy].push(u.id);
          }
      });
      
      const nodeStats = {};
      allUsers.forEach(u => {
          nodeStats[u.id] = {
              selfInvest: walletMap[u.id] || 0,
              networkSales: 0
          };
      });
      
      const computeNetworkSales = (uid) => {
          if (nodeStats[uid].networkSalesComputed) return nodeStats[uid].networkSales;
          let sales = 0;
          let maxLegSales = 0;
          const children = childrenMap[uid] || [];
          for (const childId of children) {
              const childSelf = nodeStats[childId].selfInvest;
              const childNet = computeNetworkSales(childId);
              const childTotal = childSelf + childNet;
              
              sales += childTotal;
              if (childTotal > maxLegSales) {
                  maxLegSales = childTotal;
              }
          }
          nodeStats[uid].networkSales = sales;
          nodeStats[uid].otherLegSales = sales - maxLegSales;
          nodeStats[uid].networkSalesComputed = true;
          return sales;
      };
      
      allUsers.forEach(u => computeNetworkSales(u.id));
      
      let updatedCount = 0;
      for (const u of allUsers) {
          const stats = nodeStats[u.id];
          const hasChanges = (u.totalInvested || 0) !== stats.selfInvest || (u.networkSales || 0) !== stats.networkSales || (u.otherLegSales || 0) !== stats.otherLegSales;
          
          if (hasChanges) {
              await updateDoc(doc(db, 'users', u.id), {
                  totalInvested: stats.selfInvest,
                  networkSales: stats.networkSales,
                  otherLegSales: stats.otherLegSales,
                  updatedAt: serverTimestamp()
              });
              updatedCount++;
          }
      }
      
      await this._auditLog(adminId, 'system', `매출 데이터 동기화 완료: ${updatedCount}명 업데이트`);
      return { success: true, data: { updatedCount } };
    } catch(e) {
      console.error(e);
      return { success: false, error: e.message };
    }
  }

}