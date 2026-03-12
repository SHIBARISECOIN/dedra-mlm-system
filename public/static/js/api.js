/**
 * DedraAPI - Firestore 직접 접근 클래스
 * admin.html 에서 사용하는 모든 API 메서드를 Firebase Firestore로 구현
 */
import {
  collection, doc, getDoc, getDocs, setDoc, addDoc, updateDoc, deleteDoc,
  query, where, orderBy, limit, serverTimestamp, writeBatch, increment
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

const ok  = data => ({ success: true, data });
const err = e    => ({ success: false, error: e?.message || String(e) });

export class DedraAPI {
  constructor(db) { this.db = db; }

  // ─────────────────────────────────────────────────
  // 대시보드 통계
  // ─────────────────────────────────────────────────
  async getDashboardStats() {
    try {
      const db = this.db;
      const [usersSnap, txSnap, gameSnap, invSnap] = await Promise.all([
        getDocs(collection(db, 'users')),
        getDocs(collection(db, 'transactions')),
        getDocs(collection(db, 'gameLogs')),
        getDocs(collection(db, 'investments')),
      ]);

      const users = usersSnap.docs.map(d => d.data());
      const txs   = txSnap.docs.map(d => d.data());
      const games = gameSnap.docs.map(d => d.data());
      const invs  = invSnap.docs.map(d => d.data());

      const deposits    = txs.filter(t => t.type === 'deposit');
      const withdrawals = txs.filter(t => t.type === 'withdrawal');

      return ok({
        totalUsers:            users.filter(u => u.role !== 'admin').length,
        activeUsers:           users.filter(u => u.status === 'active' && u.role !== 'admin').length,
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
  async approveDeposit(txId, adminId) {
    try {
      const db = this.db;
      const txSnap = await getDoc(doc(db, 'transactions', txId));
      if (!txSnap.exists()) throw new Error('거래 없음');
      const tx = txSnap.data();
      if (tx.status !== 'pending') throw new Error('이미 처리된 거래입니다');

      const batch = writeBatch(db);
      batch.update(doc(db, 'transactions', txId), {
        status: 'approved', approvedAt: serverTimestamp(), approvedBy: adminId
      });
      // 지갑 잔액 증가
      const walletQ = query(collection(db, 'wallets'), where('userId', '==', tx.userId));
      const wSnap = await getDocs(walletQ);
      if (!wSnap.empty) {
        batch.update(wSnap.docs[0].ref, {
          usdtBalance: increment(tx.amount || 0),
          totalDeposit: increment(tx.amount || 0),
        });
      }
      await batch.commit();
      await this._auditLog(adminId, 'deposit', `입금 승인 ${tx.amount} USDT`, { txId, userId: tx.userId });

      // ※ 유니레벨 보너스는 입금 즉시가 아니라,
      //   회원이 USDT로 투자 상품을 구매하고
      //   그 상품에서 매일 발생하는 ROI(D)를 기준으로 지급됩니다.
      //   → runDailyROISettlement() 를 통해 일별 정산 시 처리됩니다.

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
  // 출금 처리
  // ─────────────────────────────────────────────────
  async approveWithdrawal(txId, adminId, txid) {
    try {
      const db = this.db;
      const txSnap = await getDoc(doc(db, 'transactions', txId));
      if (!txSnap.exists()) throw new Error('거래 없음');
      const tx = txSnap.data();
      if (tx.status !== 'pending') throw new Error('이미 처리된 거래입니다');

      await updateDoc(doc(db, 'transactions', txId), {
        status: 'approved', approvedAt: serverTimestamp(), approvedBy: adminId,
        txid: txid || ''
      });
      await this._auditLog(adminId, 'withdrawal', `출금 승인 ${tx.amount} DEEDRA (TXID: ${txid})`, { txId, userId: tx.userId });
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
      batch.update(doc(db, 'transactions', txId), {
        status: 'rejected', rejectedAt: serverTimestamp(), rejectedBy: adminId, rejectReason: reason
      });
      // 잔액 복구
      const walletQ = query(collection(db, 'wallets'), where('userId', '==', tx.userId));
      const wSnap = await getDocs(walletQ);
      if (!wSnap.empty) {
        batch.update(wSnap.docs[0].ref, { dedraBalance: increment(tx.amount || 0) });
      }
      await batch.commit();
      await this._auditLog(adminId, 'withdrawal', `출금 거부: ${reason}`, { txId });
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
      const walletQ = query(collection(db, 'wallets'), where('userId', '==', userId));
      const wSnap = await getDocs(walletQ);
      if (wSnap.empty) throw new Error('지갑 없음');
      const oldData = wSnap.docs[0].data();
      const oldVal = oldData[field] || 0;
      await updateDoc(wSnap.docs[0].ref, { [field]: parseFloat(newVal), updatedAt: serverTimestamp() });
      await this._auditLog(adminId, 'wallet_adjust', `잔액 수정 (${field}): ${oldVal} → ${newVal}`, { userId, reason });
      return ok(true);
    } catch(e) { return err(e); }
  }

  async giveManualBonus(adminId, userId, amount, reason) {
    try {
      const db = this.db;
      const amt = parseFloat(amount);
      const walletQ = query(collection(db, 'wallets'), where('userId', '==', userId));
      const wSnap = await getDocs(walletQ);
      if (wSnap.empty) throw new Error('지갑 없음');
      const batch = writeBatch(db);
      batch.update(wSnap.docs[0].ref, { dedraBalance: increment(amt), totalEarnings: increment(amt) });
      const bonusRef = doc(collection(db, 'bonuses'));
      batch.set(bonusRef, {
        userId, amount: amt, reason, type: 'manual_bonus',
        grantedBy: adminId, createdAt: serverTimestamp()
      });
      await batch.commit();
      await this._auditLog(adminId, 'bonus', `수동 보너스 ${amt} DEEDRA 지급`, { userId, reason });
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
      await updateDoc(doc(this.db, 'users', userId), { isCenterManager: true, updatedAt: serverTimestamp() });
      await this._auditLog(adminId, 'member', `센터장 임명: ${memberName}`, { userId });
      return ok(true);
    } catch(e) { return err(e); }
  }

  async revokeCenterManager(adminId, userId) {
    try {
      await updateDoc(doc(this.db, 'users', userId), { isCenterManager: false, updatedAt: serverTimestamp() });
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

  async createAnnouncement(adminId, title, content, category, isPinned) {
    try {
      const ref = await addDoc(collection(this.db, 'announcements'), {
        title, content, category: category || 'general',
        isPinned: !!isPinned, isActive: true,
        createdBy: adminId, createdAt: serverTimestamp(), updatedAt: serverTimestamp()
      });
      await this._auditLog(adminId, 'notice', `공지 생성: ${title}`, { id: ref.id });
      return ok({ id: ref.id });
    } catch(e) { return err(e); }
  }

  async updateAnnouncement(adminId, noticeId, updates) {
    try {
      await updateDoc(doc(this.db, 'announcements', noticeId), { ...updates, updatedAt: serverTimestamp() });
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
      const ref = await addDoc(collection(this.db, 'news'), {
        ...newsData, createdBy: adminId, createdAt: serverTimestamp(), updatedAt: serverTimestamp()
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
      const snap = await getDocs(query(collection(this.db, 'gameLogs'), limit(maxCount)));
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
        .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
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

  async saveDedraRate(adminId, price) {
    try {
      await setDoc(doc(this.db, 'settings', 'deedraPrice'), {
        price: parseFloat(price), updatedAt: serverTimestamp(), updatedBy: adminId
      }, { merge: true });
      await this._auditLog(adminId, 'settings', `DEEDRA 시세 변경: $${price}`, { price });
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
   *   → ... (최대 10단계)
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

          // 지갑 잔액 증가
          const walletQ = query(collection(db, 'wallets'), where('userId', '==', ancestor.id));
          const wSnap   = await getDocs(walletQ);
          if (!wSnap.empty) {
            await updateDoc(wSnap.docs[0].ref, {
              dedraBalance:  increment(bonusAmt),
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

  // ─────────────────────────────────────────────────────────────────
  // 일일 ROI 정산 배치
  // ─────────────────────────────────────────────────────────────────
  /**
   * 관리자가 매일 실행하는 정산 배치.
   * 실행 흐름:
   *   1. 전체 활성(active) 투자 조회
   *   2. 투자 상품별 지급 패턴(bonusPaymentConfig) 체크
   *   3. 오늘이 지급일이면 D = 투자금액 × dailyRoi% 계산
   *   4. 회원 지갑에 D 적립 (본인 ROI 수익)
   *   5. D를 기준으로 추천 체인에 유니레벨 보너스 분배
   *   6. 투자 만료(기간/횟수) 처리
   *
   * @param {string} adminId
   * @param {string|null} targetDateStr  'YYYY-MM-DD' (null이면 오늘)
   */
  async runDailyROISettlement(adminId, targetDateStr = null) {
    try {
      const db = this.db;

      // 정산 날짜 설정
      const targetDate = targetDateStr ? new Date(targetDateStr + 'T00:00:00') : new Date();
      const dateStr    = targetDate.toISOString().slice(0, 10); // YYYY-MM-DD

      // 중복 정산 방지: 같은 날 이미 실행했으면 차단
      const settlementDocRef = doc(db, 'settlements', dateStr);
      const existingSnap = await getDoc(settlementDocRef);
      if (existingSnap.exists()) {
        return ok({ skipped: true, reason: `${dateStr} 정산이 이미 실행되었습니다.`, date: dateStr });
      }

      // 이율 설정 및 지급 패턴 설정 로드
      const [ratesR, bpR] = await Promise.all([
        this.getRates(),
        this.getBonusPaymentConfig(),
      ]);
      const rates    = ratesR.success ? ratesR.data : {};
      const bpConfig = bpR.success    ? bpR.data    : {};
      const bpProducts    = bpConfig.products    || {};
      const globalOptions = bpConfig.globalOptions|| {};

      // 모든 활성 투자 조회
      const invSnap = await getDocs(
        query(collection(db, 'investments'), where('status', '==', 'active'))
      );
      const activeInvestments = invSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      let roiPaidCount   = 0;
      let bonusPaidCount = 0;
      let totalRoiAmount = 0;
      let totalBonusAmount = 0;
      const details = [];

      for (const inv of activeInvestments) {
        try {
          // ── 투자 만료 체크 ──
          const endDate = inv.endDate instanceof Date ? inv.endDate
            : inv.endDate?.toDate ? inv.endDate.toDate()
            : new Date(inv.endDate);
          if (targetDate > endDate) {
            // 만료 처리
            await updateDoc(doc(db, 'investments', inv.id), {
              status: 'completed', completedAt: serverTimestamp()
            });
            continue;
          }

          // ── 지급 패턴 체크 ──
          const productCfg = globalOptions.usePaymentPattern ? bpProducts[inv.productId] : null;
          if (productCfg && productCfg.isActive) {
            // 지급 시작일 체크
            const rawStart = inv.startDate?.toDate ? inv.startDate.toDate()
              : inv.startDate instanceof Date ? inv.startDate
              : new Date(inv.startDate || Date.now());
            const paymentStartDate = productCfg.paymentStartType === 'PURCHASE_DAY'
              ? rawStart
              : new Date(rawStart.getTime() + 86400000); // 익일
            if (!this._isPaymentDay(productCfg, targetDate, paymentStartDate)) continue;

            // 횟수 제한 체크
            if (productCfg.paymentDurationType === 'LIMITED_COUNTS') {
              const remaining = inv.remainingPayments ?? productCfg.durationValue ?? 999;
              if (remaining <= 0) {
                await updateDoc(doc(db, 'investments', inv.id), { status: 'completed', completedAt: serverTimestamp() });
                continue;
              }
            }
          }

          // ── D 계산: 일일 ROI 수익 ──
          // 상품별 이율 우선, 없으면 inv.roiPercent 사용
          let dailyRoiRate = 0;
          if (globalOptions.useProductRate && productCfg?.baseRate) {
            dailyRoiRate = productCfg.baseRate / 100;
          } else {
            dailyRoiRate = (inv.roiPercent || inv.dailyRoi || 0) / 100;
          }

          const D = parseFloat((inv.amount * dailyRoiRate).toFixed(8));
          if (D <= 0) continue;

          // ── 회원 지갑에 ROI 적립 ──
          const walletQ = query(collection(db, 'wallets'), where('userId', '==', inv.userId));
          const wSnap   = await getDocs(walletQ);
          if (!wSnap.empty) {
            await updateDoc(wSnap.docs[0].ref, {
              dedraBalance:  increment(D),
              totalEarnings: increment(D),
            });
          }

          // ROI 수익 이력 기록
          await addDoc(collection(db, 'bonuses'), {
            userId:         inv.userId,
            amount:         D,
            type:           'roi_income',
            investmentId:   inv.id,
            productId:      inv.productId,
            productName:    inv.productName || '',
            investAmount:   inv.amount,
            rate:           dailyRoiRate,
            settlementDate: dateStr,
            reason:         `투자 ROI 수익 (${inv.productName||'상품'} × ${(dailyRoiRate*100).toFixed(2)}%)`,
            grantedBy:      adminId,
            createdAt:      serverTimestamp(),
          });

          roiPaidCount++;
          totalRoiAmount += D;

          // ── 유니레벨 보너스 분배 (D 기준) ──
          const bonusPaid = await this._processUnilevelBonus(
            inv.userId, D, rates, db, adminId, dateStr
          );
          if (bonusPaid > 0) { bonusPaidCount++; totalBonusAmount += bonusPaid; }

          // ── 횟수 제한 차감 ──
          if (productCfg?.paymentDurationType === 'LIMITED_COUNTS') {
            const remaining = inv.remainingPayments ?? (productCfg.durationValue ?? 999);
            await updateDoc(doc(db, 'investments', inv.id), {
              remainingPayments: Math.max(0, remaining - 1)
            });
          }

          details.push({ userId: inv.userId, investId: inv.id, D, bonusPaid });

        } catch(invErr) {
          console.warn(`투자 정산 오류 [${inv.id}]:`, invErr);
        }
      }

      // 정산 완료 기록 (중복 방지용)
      await setDoc(settlementDocRef, {
        date: dateStr,
        executedBy: adminId,
        executedAt: serverTimestamp(),
        roiPaidCount,
        bonusPaidCount,
        totalRoiAmount,
        totalBonusAmount,
        totalInvestments: activeInvestments.length,
      });

      await this._auditLog(adminId, 'settlement',
        `일일 ROI 정산 완료 [${dateStr}]: ROI ${roiPaidCount}건 / 보너스 ${bonusPaidCount}건`,
        { date: dateStr, totalRoiAmount, totalBonusAmount }
      );

      return ok({
        date: dateStr,
        roiPaidCount,
        bonusPaidCount,
        totalRoiAmount,
        totalBonusAmount,
        totalInvestments: activeInvestments.length,
        details,
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
      return ok(snap.exists() ? snap.data() : { dedraRate: 0.5, usdKrw: 1350 });
    } catch(e) { return err(e); }
  }

  async updateRates(adminId, rates) {
    try {
      await setDoc(doc(this.db, 'settings', 'rates'), {
        ...rates, updatedAt: serverTimestamp(), updatedBy: adminId
      }, { merge: true });
      // 히스토리 기록
      await addDoc(collection(this.db, 'rateHistory'), {
        ...rates, adminId, createdAt: serverTimestamp()
      });
      await this._auditLog(adminId, 'settings', '환율 설정 변경', rates);
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
      if (snap.exists()) return ok(snap.data());
      // 기본값 반환 (추천인 수 기반 레거시와 호환)
      const defaults = {
        networkDepth: 3,              // 산하 계산 깊이 (1~10)
        promotionMode: 'all',         // 'all' = 모든 조건 충족, 'any' = 하나라도 충족
        enableAutoPromotion: false,   // true = 입금 승인 시 자동 승진 체크
        preventDowngrade: true,       // true = 이미 획득한 직급 강등 방지
        requireActiveInvestment: false, // true = 활성 투자가 있어야 직급 유지
        reCheckIntervalDays: 0,       // 0 = 수동 실행만, N > 0 = N일마다 자동 재검사
        countOnlyDirectReferrals: false, // true = 직접 추천(1대)만 인원 카운트
        criteria: {
          G1:  { minSelfInvest: 0,    minNetworkSales: 0,     minNetworkMembers: 3    },
          G2:  { minSelfInvest: 0,    minNetworkSales: 0,     minNetworkMembers: 10   },
          G3:  { minSelfInvest: 0,    minNetworkSales: 0,     minNetworkMembers: 20   },
          G4:  { minSelfInvest: 0,    minNetworkSales: 0,     minNetworkMembers: 40   },
          G5:  { minSelfInvest: 0,    minNetworkSales: 0,     minNetworkMembers: 80   },
          G6:  { minSelfInvest: 0,    minNetworkSales: 0,     minNetworkMembers: 150  },
          G7:  { minSelfInvest: 0,    minNetworkSales: 0,     minNetworkMembers: 300  },
          G8:  { minSelfInvest: 0,    minNetworkSales: 0,     minNetworkMembers: 600  },
          G9:  { minSelfInvest: 0,    minNetworkSales: 0,     minNetworkMembers: 1200 },
          G10: { minSelfInvest: 0,    minNetworkSales: 0,     minNetworkMembers: 2000 },
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
      await setDoc(doc(this.db, 'settings', 'rankPromotion'), {
        ...settings, updatedAt: serverTimestamp(), updatedBy: adminId
      });
      await this._auditLog(adminId, 'settings', '직급 승진 조건 설정 변경', settings);
      return ok(true);
    } catch(e) { return err(e); }
  }

  /**
   * 특정 회원의 직급 승진 자격 계산
   * - 본인 투자 총액
   * - networkDepth까지 산하 매출(입금 승인액) 합산
   * - networkDepth까지 산하 인원 수 합산
   * @param {string} userId
   * @param {object} settings  getRankPromotionSettings 결과
   */
  async calcRankEligibility(userId, settings) {
    try {
      const db = this.db;
      const depth = settings.networkDepth || 3;

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
        // Firestore in 쿼리는 최대 30개씩 분할
        const chunks = [];
        for (let i = 0; i < downline.length; i += 30) chunks.push(downline.slice(i, i + 30));
        for (const chunk of chunks) {
          const txSnap = await getDocs(query(
            collection(db, 'transactions'),
            where('userId', 'in', chunk),
            where('type', '==', 'deposit'),
            where('status', '==', 'approved')
          ));
          networkSales += txSnap.docs.reduce((s, d) => s + (d.data().amount || 0), 0);
        }
      }

      return ok({ selfInvest, networkSales, networkMembers, downlineIds: downline });
    } catch(e) { return err(e); }
  }

  /**
   * 전체 회원 직급 일괄 재계산 (관리자 수동 실행)
   * 승진 조건에 맞는 회원을 찾아 자동 승격
   * @returns {{ upgraded: number, details: Array }}
   */
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
            const txSnap = await getDocs(query(
              collection(db, 'transactions'),
              where('userId', 'in', chunk),
              where('type', '==', 'deposit'),
              where('status', '==', 'approved')
            ));
            networkSales += txSnap.docs.reduce((s, d) => s + (d.data().amount || 0), 0);
          }
        }
        const networkMembers = downline.length;

        // 달성 가능한 최고 직급 찾기 (전체 범위 스캔)
        let targetIdx = 0; // 아무 조건도 안 맞으면 G0
        for (let i = RANK_ORDER.length - 1; i >= 1; i--) {
          const rankId = RANK_ORDER[i];
          const crit   = criteria[rankId];
          if (!crit) continue;
          const cInvest  = selfInvest     >= (crit.minSelfInvest     || 0);
          const cSales   = networkSales   >= (crit.minNetworkSales    || 0);
          const cMembers = networkMembers >= (crit.minNetworkMembers  || 0);
          // 조건이 모두 0이면 해당 직급 조건 없음으로 간주 (건너뜀)
          const hasAnyCrit = (crit.minSelfInvest||0)>0 || (crit.minNetworkSales||0)>0 || (crit.minNetworkMembers||0)>0;
          if (!hasAnyCrit) continue;
          const pass = mode === 'any' ? (cInvest || cSales || cMembers)
                                      : (cInvest && cSales && cMembers);
          if (pass) { targetIdx = i; break; }
        }

        // preventDowngrade: targetIdx < curIdx 이면 강등 방지
        if (preventDowngrade && targetIdx < curIdx) {
          targetIdx = curIdx; // 현재 직급 유지
        }

        if (targetIdx !== curIdx) {
          const newRank = RANK_ORDER[targetIdx];
          await updateDoc(doc(db, 'users', member.id), { rank: newRank, updatedAt: serverTimestamp() });
          if (targetIdx > curIdx) {
            await this._auditLog(adminId, 'rank', `[일괄승격] ${member.name||member.id}: ${curRank} → ${newRank}`,
              { userId: member.id, oldRank: curRank, newRank, selfInvest, networkSales, networkMembers });
            upgraded.push({ userId: member.id, name: member.name, oldRank: curRank, newRank });
          } else {
            await this._auditLog(adminId, 'rank', `[일괄강등] ${member.name||member.id}: ${curRank} → ${newRank}`,
              { userId: member.id, oldRank: curRank, newRank, selfInvest, networkSales, networkMembers });
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
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      return ok(data);
    } catch(e) { return err(e); }
  }

  async getInvestmentAnalytics(dateFrom, dateTo, expireMode) {
    try {
      const snap = await getDocs(collection(this.db, 'investments'));
      let data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      if (dateFrom) data = data.filter(i => (i.createdAt?.seconds || 0) >= dateFrom / 1000);
      if (dateTo)   data = data.filter(i => (i.createdAt?.seconds || 0) <= dateTo / 1000);
      if (expireMode === 'expiringSoon') {
        const soon = Date.now() / 1000 + 7 * 86400;
        data = data.filter(i => (i.expireAt?.seconds || 0) <= soon && i.status === 'active');
      } else if (expireMode === 'expired') {
        data = data.filter(i => i.status === 'expired' || i.status === 'completed');
      }
      return ok(data);
    } catch(e) { return err(e); }
  }

  async getProductSalesStats() {
    try {
      const snap = await getDocs(collection(this.db, 'investments'));
      const byProduct = {};
      snap.docs.forEach(d => {
        const inv = d.data();
        const pid = inv.productId || 'unknown';
        if (!byProduct[pid]) byProduct[pid] = { count: 0, total: 0, name: inv.productName || pid };
        byProduct[pid].count++;
        byProduct[pid].total += (inv.amount || 0);
      });
      return ok(Object.entries(byProduct).map(([id, v]) => ({ id, ...v })));
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
  async getOrgTree(rootUserId) {
    try {
      const snap = await getDocs(collection(this.db, 'users'));
      const users = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      const build = (parentId) => {
        const children = users.filter(u => u.referredBy === parentId);
        return children.map(u => ({ ...u, children: build(u.id) }));
      };
      const root = rootUserId
        ? users.find(u => u.id === rootUserId)
        : users.find(u => u.role !== 'admin');
      if (!root) return ok([]);
      return ok([{ ...root, children: build(root.id) }]);
    } catch(e) { return err(e); }
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
      return ok({ id: ref.id });
    } catch(e) { return err(e); }
  }

  async updateCenter(adminId, centerId, updates) {
    try {
      await updateDoc(doc(this.db, 'centers', centerId), { ...updates, updatedAt: serverTimestamp() });
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
      usersSnap.docs.forEach(ud => {
        const u = ud.data();
        if (u.role === 'admin') return;
        const nRef = doc(collection(this.db, 'notifications'));
        batch.set(nRef, {
          userId: ud.id, title: payload.title, message: payload.message,
          type: payload.type || 'info', isRead: false,
          broadcastId: ref.id, createdAt: serverTimestamp()
        });
      });
      await batch.commit();
      await this._auditLog(adminId, 'broadcast', `브로드캐스트: ${payload.title}`, { id: ref.id });
      return ok({ id: ref.id });
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
  // 내부 감사 로그 기록
  // ─────────────────────────────────────────────────
  async _auditLog(adminId, category, action, meta = {}) {
    try {
      await addDoc(collection(this.db, 'auditLogs'), {
        adminId, category, action, meta,
        createdAt: serverTimestamp()
      });
    } catch(_) { /* 감사 로그 실패는 무시 */ }
  }
}
