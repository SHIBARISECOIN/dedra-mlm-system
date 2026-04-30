
import { 
  fromFirestoreValue, toFirestoreValue, fsGet, fsPatch, fsSet, processScheduledBroadcasts, checkInactiveUsers,  
  fsQuery, fsCreate, fsCreateOnlyIfAbsent, fsBatchCommit, getAdminToken, 
  firestoreDocToObj, getGlobalEnv
} from '../index';


const RANK_ORDER = ['G0', 'G1', 'G2', 'G3', 'G4', 'G5', 'G6', 'G7', 'G8', 'G9', 'G10'];
function getRankLevel(rankStr: string): number {
  if (!rankStr) return 0;
  const idx = RANK_ORDER.indexOf(rankStr.toUpperCase());
  return idx >= 0 ? idx : 0;
}

function roundSettlementAmount(value: any): number {
  const n = Number(value) || 0;
  return Math.round(n * 1e8) / 1e8;
}

function eligiblePrincipalAmount(inv: any): number {
  const principal = Number(inv?.amount ?? inv?.amountUsdt ?? 0) || 0;
  const autoCompoundPrincipal = Number(inv?.autoCompoundPrincipal || 0) || 0;
  const promoLockedPrincipal = Number(
    inv?.promoLockedPrincipal ||
    inv?.promotionLockedPrincipal ||
    inv?.promoBonusPrincipal ||
    inv?.lockedPromoPrincipal ||
    inv?.bonusLockedPrincipal ||
    0
  ) || 0;

  if (
    autoCompoundPrincipal <= 0 &&
    promoLockedPrincipal <= 0 &&
    (inv?.rollupEligible === false || inv?.commissionEligible === false || inv?.networkSalesEligible === false)
  ) {
    return 0;
  }

  return Math.max(0, roundSettlementAmount(principal - autoCompoundPrincipal - promoLockedPrincipal));
}

function getKstDateString(): string {
  return new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
}

function settlementInputError(message: string) {
  const err: any = new Error(message);
  err.statusCode = 400;
  return err;
}

function resolveSettlementDate(overrideDate?: string | null, options: { allowFuture?: boolean } = {}): string {
  const today = getKstDateString();
  if (overrideDate === undefined || overrideDate === null || overrideDate === '') return today;

  const rawDate = String(overrideDate).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
    throw settlementInputError('정산 날짜는 YYYY-MM-DD 형식이어야 합니다.');
  }

  const parsed = new Date(`${rawDate}T00:00:00.000Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== rawDate) {
    throw settlementInputError('존재하지 않는 정산 날짜입니다.');
  }

  if (!options.allowFuture && rawDate > today) {
    throw settlementInputError('미래 날짜 정산은 실행할 수 없습니다.');
  }

  if (rawDate < '2020-01-01') {
    throw settlementInputError('정산 날짜가 허용 범위보다 오래되었습니다.');
  }

  return rawDate;
}

export async function runSettle(c: any, overrideDate?: string | null) {
  const startTime = Date.now()
  try {
    const adminToken = await getAdminToken()
    const today = resolveSettlementDate(overrideDate)

    // ── Atomic 중복 정산 방지 (Distributed Lock) ────────────────────────────
    const existing = await fsGet(`settlements/${today}`, adminToken)
    if (existing && existing.fields) {
      const existStatus = fromFirestoreValue(existing.fields.status || { stringValue: '' })
      if (existStatus === 'done' || existStatus === 'processing') {
        return c.json({ success: true, message: `이미 ${today} 정산 처리됨 (status:${existStatus})`, date: today, skipped: true })
      }
    }

    const processId = `settle_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
    const lockAcquired = await fsCreateOnlyIfAbsent(`settlements/${today}`, {
      date: today,
      status: 'processing',
      processId,
      startedAt: new Date().toISOString(),
      source: 'backend'
    }, adminToken)

    if (!lockAcquired) {
      return c.json({ success: true, message: `${today} 정산이 이미 다른 프로세스에서 실행 중 또는 완료됨`, date: today, skipped: true })
    }

    await new Promise(r => setTimeout(r, 200))
    const lockDoc = await fsGet(`settlements/${today}`, adminToken)
    if (lockDoc && lockDoc.fields) {
      const lockPid = fromFirestoreValue(lockDoc.fields.processId || { stringValue: '' })
      const lockStatus = fromFirestoreValue(lockDoc.fields.status || { stringValue: '' })
      if (lockStatus === 'done') {
        return c.json({ success: true, message: '이미 정산 완료 (재확인)', date: today, skipped: true })
      }
      if (lockPid !== processId) {
        return c.json({ success: true, message: '다른 프로세스가 lock 선점 (재확인)', date: today, skipped: true })
      }
    }


    // --- 시스템 유지보수 모드 ON ---
    try {
      await fsPatch('settings/system', {
        maintenanceMode: true,
        maintenanceMessage: '현재 안정적인 서비스 제공과 정확한 수익 정산을 위해<br>시스템 동기화 작업을 진행하고 있습니다.<br><br><span style="color:#ef4444;font-size:13px;">작업 중에는 접속이 제한되오니 조금만 기다려주세요.</span>'
      }, adminToken);
    } catch(e) { console.error('Failed to set maintenance mode', e); }

    const investments = await fsQuery('investments', adminToken, [], 100000)
    const activeInvestments = investments.filter((inv: any) => inv.status === 'active')

    const settingsRaw = await fsGet('settings/main', adminToken)
    const settingsData = settingsRaw?.fields ? firestoreDocToObj(settingsRaw) : {}
    
    const priceDoc = await fsGet('settings/deedraPrice', adminToken)
    const dedraRate = priceDoc?.fields?.price ? Number(priceDoc.fields.price.doubleValue || priceDoc.fields.price.integerValue || 0.5) : 0.5;

    const ratesDoc = await fsGet('settings/rates', adminToken)
    const ratesData = ratesDoc?.fields ? firestoreDocToObj(ratesDoc) : {}
    const config = {
      direct1: Number(ratesData.rate_direct1 ?? 10),
      direct2: Number(ratesData.rate_direct2 ?? 5),
      rankGap: Number(ratesData.rate_rankGap ?? 10), // Requirement: rank difference * 10%
      override: Number(ratesData.rate_override ?? 10), // Requirement: 10% of total allowance
      rankGapMode: ratesData.rankGapMode || 'gap'
    }

    const autoRules = await fsQuery('autoRules', adminToken).catch(()=>[]);
    const allUsers = await fsQuery('users', adminToken, [], 100000)
    const wallets = await fsQuery('wallets', adminToken, [], 100000)
    
    // NEW: Fetch products to cap autoCompound (H-4)
    const products = await fsQuery('products', adminToken, [], 100)
    const productMap = new Map();
    for (const p of products) {
      productMap.set(p.id || p.name || '', p);
    }

    const abusingDoc = await fsGet('settings/abusing', adminToken);
    const abusingData = abusingDoc?.fields ? firestoreDocToObj(abusingDoc) : {
      globalNoDepositRollupBlock: false,
      globalNoDepositWithdrawBlock: false,
      customRules: []
    };

        const realDepositTxs = await fsQuery('transactions', adminToken, [
      { fieldFilter: { field: { fieldPath: 'type' }, op: 'EQUAL', value: { stringValue: 'deposit' } } },
      { fieldFilter: { field: { fieldPath: 'status' }, op: 'EQUAL', value: { stringValue: 'approved' } } }
    ], 100000);
    const realDepositors = new Set(realDepositTxs.map((t: any) => t.userId));

    // [FIX 2026-04-30] uid → countryCode 매핑 (어뷰징 국가 규칙 평가용)
    const userCountryByUid = new Map<string, string>();
    for (const u of allUsers) {
      const code = String(u.countryCode || u.country || '')
        .trim().toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3);
      if (code) userCountryByUid.set(u.id, code);
    }

    // NEW LOGIC: memberMap tracking all financials (strict separation of dividend and allowance)
    const memberMap = new Map();
    for (const u of allUsers) {
      memberMap.set(u.id, {
        id: u.id,
        name: u.name || u.id,
        parent_member_id: u.referredBy && u.referredBy !== u.id ? u.referredBy : null,
        rank_level: getRankLevel(u.rank || 'G0'),
        daily_dividend: 0,
        auto_compound_dividend: 0,
        auto_compound_overflow: 0,
        recommend_bonus: 0,
        rank_bonus: 0,
        total_allowance: 0,
        depth: 0,
        autoCompound: u.autoCompound === true || String(u.autoCompound) === 'true'
      });
    }

    // Determine isBlockedFromRollup
    const abusingRules = Array.isArray(abusingData.customRules) ? abusingData.customRules : [];
    // 회원 단위 / 국가 단위 규칙 분리
    const abusingUserRules = abusingRules.filter((r: any) => (r.ruleType || 'user') === 'user');
    const abusingCountryRules = abusingRules.filter((r: any) => r.ruleType === 'country');
    for (const m of memberMap.values()) {
        let isReal = realDepositors.has(m.id);
        let blocked = abusingData.globalNoDepositRollupBlock && !isReal;

        // 1차: 회원 단위 규칙 (기존 로직 유지) — 자기 자신부터 부모 라인 따라 올라가며 첫 매칭 룰 적용
        let curr = m.id;
        const seenRulePath = new Set<string>();
        let appliedRule = null;
        while (curr && !seenRulePath.has(curr)) {
            seenRulePath.add(curr);
            let rSelf = abusingUserRules.find((r:any) => r.uid === curr && r.scope === 'self' && curr === m.id);
            let rGroup = abusingUserRules.find((r:any) => r.uid === curr && r.scope === 'group');

            if (rSelf) { appliedRule = rSelf; break; }
            if (rGroup) { appliedRule = rGroup; break; }

            const p = memberMap.get(curr);
            const next = p ? p.parent_member_id : null;
            curr = next && next !== curr ? next : null;
        }

        // 2차: 국가 단위 규칙 — 본인 국가코드 매칭 (회원 단위 규칙 미존재 시 적용)
        if (!appliedRule && abusingCountryRules.length) {
            const myCode = userCountryByUid.get(m.id) || '';
            if (myCode) {
                const cRule = abusingCountryRules.find((r: any) => r.countryCode === myCode);
                if (cRule) appliedRule = cRule;
            }
        }

        if (appliedRule) {
            if (appliedRule.rollup === 'allow') blocked = false;
            else if (appliedRule.rollup === 'block') blocked = true;
        }
        m.isBlockedFromRollup = blocked;
    }

    const depthCache = new Map();
    function getDepth(mid: string): number {
      if (depthCache.has(mid)) return depthCache.get(mid)!;
      const visiting = new Set<string>();
      const stack: string[] = [];
      let curr: string | null = mid;
      while (curr && !depthCache.has(curr)) {
        if (visiting.has(curr)) break;
        visiting.add(curr);
        stack.push(curr);
        const m = memberMap.get(curr);
        const parent = m ? m.parent_member_id : null;
        curr = parent && parent !== curr && memberMap.has(parent) ? parent : null;
      }
      let depth = curr && depthCache.has(curr) ? depthCache.get(curr)! : 0;
      for (let i = stack.length - 1; i >= 0; i--) {
        const id = stack[i];
        const m = memberMap.get(id);
        const parent = m ? m.parent_member_id : null;
        if (!parent || parent === id || !memberMap.has(parent)) depth = 0;
        else depth += 1;
        depthCache.set(id, depth);
      }
      return depthCache.get(mid) || 0;
    }
    for (const m of memberMap.values()) m.depth = getDepth(m.id);

    const walletUpdates = new Map();
    for (const w of wallets) {
      walletUpdates.set(w.id, {
        bonusBalanceToAdd: 0,
        totalInvestToAdd: 0,
        autoCompoundInvestToAdd: 0,
        totalEarningsToAdd: 0,
        currentBonusBalance: w.bonusBalance || 0,
        currentTotalInvest: w.totalInvest || 0,
        currentAutoCompoundTotalInvest: w.autoCompoundTotalInvest || 0,
        currentTotalEarnings: w.totalEarnings || 0
      });
    }

    const bonusLogs: any[] = [];
    let totalPaid = 0;
    let processedCount = 0;
    let skippedCount = 0;
    const settlementLedger: any[] = [];
    const roiSettlementPlans = new Map<string, any>();
    const postSettlementWrites: any[] = [];
    
    // 세부 내역 집계 객체로 변경
    const details = {
      debugUsers: allUsers.length,
      debugInvs: investments.length,
      debugRealTx: realDepositTxs.length,
      debugMap: memberMap.size,
      debugConfigDir1: config.direct1,
      roiAmount: 0,
      directBonus: 0,
      rankRollup: 0,
      rankMatching: 0,
      autoCompoundReinvest: 0,
      autoCompoundOverflow: 0
    };
    const writes: any[] = [];

    
    const FIRESTORE_URL = 'https://firestore.googleapis.com/v1/projects/dedra-mlm/databases/(default)/documents';
    async function flushWrites(force = false) {

      if (writes.length === 0) return;
      if (writes.length >= 20 || force) {
        const batch = writes.splice(0, 20);
        await fetch(`${FIRESTORE_URL}:commit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
          body: JSON.stringify({ writes: batch })
        });
      }
    }


    // ─── [H-2 Chunking & M-2 Error Handling] ────────────────────────────────────
    const CHUNK_SIZE = 500;
    const errors: any[] = [];
    const pushWrite = (w: any) => {
      writes.push(w);
    };

    function queuePostSettlementNotification(userId: string, title: string, message: string, type = 'system') {
      const nid = crypto.randomUUID().replace(/-/g,'');
      postSettlementWrites.push({
        update: {
          name: `projects/dedra-mlm/databases/(default)/documents/notifications/${nid}`,
          fields: {
            userId: toFirestoreValue(userId),
            type: toFirestoreValue(type),
            title: toFirestoreValue(title),
            message: toFirestoreValue(message),
            isRead: toFirestoreValue(false),
            createdAt: toFirestoreValue(new Date().toISOString()),
            fcmPending: toFirestoreValue(true),
            settlementDate: toFirestoreValue(today),
            source: toFirestoreValue('post_settlement')
          }
        }
      });
    }

    function getWalletUpdate(uid: string) {
      let wup = walletUpdates.get(uid);
      if (!wup) {
        wup = {
          bonusBalanceToAdd: 0,
          totalInvestToAdd: 0,
          autoCompoundInvestToAdd: 0,
          totalEarningsToAdd: 0,
          currentBonusBalance: 0,
          currentTotalInvest: 0,
          currentAutoCompoundTotalInvest: 0,
          currentTotalEarnings: 0
        };
        walletUpdates.set(uid, wup);
      }
      return wup;
    }

    // [FIX 2026-04-30] 동일 일자(today) + 동일 (userId, fromUserId, type, level) 조합 중복 발생 방지
    // 기존: 정산이 1일에 여러 번 실행되거나 하부 회원 중복 처리로 동일 sponsor 에게 동일 source 의 동일 type
    //       보너스가 N번 누적되어 rank_bonus 가 1일 200~600건씩 발생하던 문제를 차단.
    const ledgerDedupKeys = new Set<string>();
    function makeLedgerKey(e: any) {
      return `${today}|${e.userId}|${e.fromUserId || ''}|${e.type || ''}|${e.level ?? ''}|${e.investmentId || ''}`;
    }
    function addSettlementLedger(entry: any) {
      const amountUsdt = roundSettlementAmount(entry.amountUsdt);
      if (amountUsdt <= 0) return;
      const dedupKey = makeLedgerKey(entry);
      if (ledgerDedupKeys.has(dedupKey)) {
        // 동일 일자 + 동일 sponsor/member/type 조합은 1회만 적립
        return;
      }
      ledgerDedupKeys.add(dedupKey);
      const walletBonusAmount = roundSettlementAmount(entry.walletBonusAmount || 0);
      const walletInvestAmount = roundSettlementAmount(entry.walletInvestAmount || 0);
      settlementLedger.push({
        ...entry,
        amountUsdt,
        originalAmountUsdt: amountUsdt,
        walletBonusAmount,
        walletInvestAmount,
        totalEarningsAmount: roundSettlementAmount(entry.totalEarningsAmount ?? amountUsdt),
        dedupKey,
      });
    }

    function reduceLedgerEntry(entry: any, reduction: number): number {
      let remaining = roundSettlementAmount(reduction);
      if (remaining <= 0 || entry.amountUsdt <= 0) return 0;

      const reduceBonus = Math.min(entry.walletBonusAmount || 0, remaining);
      entry.walletBonusAmount = roundSettlementAmount((entry.walletBonusAmount || 0) - reduceBonus);
      remaining = roundSettlementAmount(remaining - reduceBonus);

      const reduceInvest = Math.min(entry.walletInvestAmount || 0, remaining);
      entry.walletInvestAmount = roundSettlementAmount((entry.walletInvestAmount || 0) - reduceInvest);
      remaining = roundSettlementAmount(remaining - reduceInvest);

      const reduced = roundSettlementAmount(reduction - remaining);
      entry.amountUsdt = roundSettlementAmount(entry.amountUsdt - reduced);
      entry.totalEarningsAmount = roundSettlementAmount((entry.totalEarningsAmount || 0) - reduced);
      entry.payoutCapReducedAmount = roundSettlementAmount((entry.originalAmountUsdt || 0) - entry.amountUsdt);
      return remaining;
    }

    function applyPayoutCapToLedger() {
      const summary: any = { applied: false, totalReduced: 0, users: {} };
      const maxPayoutRatio = Number(settingsData.maxPayoutRatio ?? 3);
      if (!settingsData.enableMaxPayoutCap || !(maxPayoutRatio > 0)) return summary;

      const entriesByUser = new Map<string, any[]>();
      for (const entry of settlementLedger) {
        if (entry.amountUsdt <= 0) continue;
        if (!entriesByUser.has(entry.userId)) entriesByUser.set(entry.userId, []);
        entriesByUser.get(entry.userId)!.push(entry);
      }

      for (const [uid, entries] of entriesByUser.entries()) {
        const wup = getWalletUpdate(uid);
        const requestedEarnings = roundSettlementAmount(entries.reduce((sum, e) => sum + (e.totalEarningsAmount || 0), 0));
        const requestedInvest = roundSettlementAmount(entries.reduce((sum, e) => sum + (e.walletInvestAmount || 0), 0));
        const totalInvest = roundSettlementAmount((wup.currentTotalInvest || 0) + requestedInvest);
        const maxAllowedEarnings = roundSettlementAmount(totalInvest * maxPayoutRatio);
        const availableEarnings = Math.max(0, roundSettlementAmount(maxAllowedEarnings - (wup.currentTotalEarnings || 0)));
        let overflow = roundSettlementAmount(requestedEarnings - availableEarnings);
        if (overflow <= 0) continue;

        const originalOverflow = overflow;
        for (const entry of [...entries].reverse()) {
          if (overflow <= 0) break;
          overflow = reduceLedgerEntry(entry, overflow);
        }

        const reduced = roundSettlementAmount(originalOverflow - overflow);
        if (reduced > 0) {
          summary.applied = true;
          summary.totalReduced = roundSettlementAmount(summary.totalReduced + reduced);
          summary.users[uid] = {
            requestedEarnings,
            availableEarnings,
            reduced,
            maxAllowedEarnings
          };
        }
      }

      return summary;
    }

    function rebuildFinancialOutputsFromLedger(capSummary: any) {
      for (const wup of walletUpdates.values()) {
        wup.bonusBalanceToAdd = 0;
        wup.totalInvestToAdd = 0;
        wup.autoCompoundInvestToAdd = 0;
        wup.totalEarningsToAdd = 0;
      }

      bonusLogs.length = 0;
      totalPaid = 0;
      details.roiAmount = 0;
      details.directBonus = 0;
      details.rankRollup = 0;
      details.rankMatching = 0;
      details.autoCompoundReinvest = 0;
      details.autoCompoundOverflow = 0;

      for (const entry of settlementLedger) {
        const amountUsdt = roundSettlementAmount(entry.amountUsdt);
        if (amountUsdt <= 0) continue;

        const wup = getWalletUpdate(entry.userId);
        wup.bonusBalanceToAdd = roundSettlementAmount(wup.bonusBalanceToAdd + (entry.walletBonusAmount || 0));
        wup.totalInvestToAdd = roundSettlementAmount(wup.totalInvestToAdd + (entry.walletInvestAmount || 0));
        if (entry.autoCompound === true) {
          wup.autoCompoundInvestToAdd = roundSettlementAmount((wup.autoCompoundInvestToAdd || 0) + (entry.walletInvestAmount || 0));
          details.autoCompoundReinvest = roundSettlementAmount(details.autoCompoundReinvest + (entry.walletInvestAmount || 0));
          details.autoCompoundOverflow = roundSettlementAmount(details.autoCompoundOverflow + (entry.walletBonusAmount || 0));
        }
        wup.totalEarningsToAdd = roundSettlementAmount(wup.totalEarningsToAdd + (entry.totalEarningsAmount || amountUsdt));

        if (entry.detailBucket && (details as any)[entry.detailBucket] !== undefined) {
          (details as any)[entry.detailBucket] = roundSettlementAmount((details as any)[entry.detailBucket] + amountUsdt);
        }
        totalPaid = roundSettlementAmount(totalPaid + amountUsdt);

        bonusLogs.push({
          userId: entry.userId,
          fromUserId: entry.fromUserId,
          type: entry.type,
          amount: roundSettlementAmount(amountUsdt / dedraRate),
          amountUsdt,
          reason: entry.reason,
          level: entry.level || 0,
          investmentId: entry.investmentId,
          walletBonusAmount: roundSettlementAmount(entry.walletBonusAmount || 0),
          walletInvestAmount: roundSettlementAmount(entry.walletInvestAmount || 0),
          originalAmountUsdt: roundSettlementAmount(entry.originalAmountUsdt || amountUsdt),
          payoutCapReducedAmount: roundSettlementAmount(entry.payoutCapReducedAmount || 0),
          autoCompound: entry.autoCompound === true,
          rollupEligible: entry.rollupEligible !== false,
          commissionEligible: entry.commissionEligible !== false,
          rankEligible: entry.rankEligible !== false,
          networkSalesEligible: entry.networkSalesEligible !== false,
          source: entry.source || 'settlement'
        });
      }

      const walletEarningsTotal = roundSettlementAmount(Array.from(walletUpdates.values()).reduce((sum: number, wup: any) => sum + (wup.totalEarningsToAdd || 0), 0));
      if (Math.abs(walletEarningsTotal - totalPaid) > 0.00000001) {
        throw new Error(`Settlement ledger mismatch: wallet earnings ${walletEarningsTotal} != total paid ${totalPaid}`);
      }

      (details as any).payoutCapApplied = capSummary.applied === true;
      (details as any).payoutCapReduced = roundSettlementAmount(capSummary.totalReduced || 0);
      (details as any).ledgerEntryCount = bonusLogs.length;
    }

    async function runPostSettlementTasks() {
      const postStatus: any = {
        notificationWrites: postSettlementWrites.length,
        notifications: postSettlementWrites.length ? 'pending' : 'skipped',
        scheduledBroadcasts: 'pending',
        rankUpgrade: 'pending',
        errors: [],
        startedAt: new Date().toISOString()
      };

      try {
        if (postSettlementWrites.length > 0) {
          await fsBatchCommit(postSettlementWrites, adminToken);
          postStatus.notifications = 'done';
        }
      } catch (e: any) {
        postStatus.notifications = 'error';
        postStatus.errors.push({ task: 'notifications', message: e.message || String(e) });
      }

      try {
        await processScheduledBroadcasts(adminToken);
        postStatus.scheduledBroadcasts = 'done';
      } catch (e: any) {
        postStatus.scheduledBroadcasts = 'error';
        postStatus.errors.push({ task: 'scheduledBroadcasts', message: e.message || String(e) });
      }

      // [FIX 2026-04-30 B-9] 정산 직후 매출(networkSales/otherLegSales) 자동 재집계
      // - 투자 즉시 가산(bumpUpline)된 networkSales 누적치 정합성 보정
      // - autoUpgradeAllRanks 가 최신 매출로 승급 판정하도록 사전 보장
      postStatus.salesSync = 'pending';
      try {
        const freshUsers = await fsQuery('users', adminToken, [], 100000).catch(() => allUsers);
        const freshWallets = await fsQuery('wallets', adminToken, [], 100000).catch(() => wallets);

        const walletMap: Record<string, number> = {};
        freshWallets.forEach((w: any) => {
          walletMap[w.id] = (w.totalInvest !== undefined ? w.totalInvest : w.totalInvested) || 0;
        });

        const childrenMap: Record<string, string[]> = {};
        freshUsers.forEach((u: any) => { childrenMap[u.id] = []; });
        freshUsers.forEach((u: any) => {
          if (u.referredBy && childrenMap[u.referredBy]) childrenMap[u.referredBy].push(u.id);
        });

        const nodeStats: Record<string, any> = {};
        freshUsers.forEach((u: any) => {
          nodeStats[u.id] = { selfInvest: walletMap[u.id] || 0, networkSales: 0, otherLegSales: 0, computed: false };
        });

        const computeNetworkSales = (uid: string): number => {
          if (!nodeStats[uid]) return 0;
          if (nodeStats[uid].computed) return nodeStats[uid].networkSales;
          let sales = 0;
          let maxLegSales = 0;
          const children = childrenMap[uid] || [];
          for (const childId of children) {
            if (nodeStats[childId]) {
              const childSelf = nodeStats[childId].selfInvest;
              const childNet = computeNetworkSales(childId);
              const childTotal = childSelf + childNet;
              sales += childTotal;
              if (childTotal > maxLegSales) maxLegSales = childTotal;
            }
          }
          nodeStats[uid].networkSales = sales;
          nodeStats[uid].otherLegSales = sales - maxLegSales;
          nodeStats[uid].computed = true;
          return sales;
        };

        freshUsers.forEach((u: any) => computeNetworkSales(u.id));

        // 변경분만 patch (불필요한 쓰기 최소화)
        const syncWrites: any[] = [];
        for (const u of freshUsers) {
          const stats = nodeStats[u.id];
          if (!stats) continue;
          const currentSelf = u.totalInvested || 0;
          const currentNet = u.networkSales || 0;
          const currentOther = u.otherLegSales || 0;
          if (currentSelf !== stats.selfInvest || currentNet !== stats.networkSales || currentOther !== stats.otherLegSales) {
            const fields = {
              totalInvested: toFirestoreValue(stats.selfInvest),
              networkSales: toFirestoreValue(stats.networkSales),
              otherLegSales: toFirestoreValue(stats.otherLegSales),
              salesUpdatedAt: toFirestoreValue(new Date().toISOString())
            };
            syncWrites.push({
              update: {
                name: `projects/dedra-mlm/databases/(default)/documents/users/${u.id}`,
                fields
              },
              updateMask: { fieldPaths: Object.keys(fields) }
            });
          }
        }
        if (syncWrites.length > 0) {
          // batch=20 (B-4 표준)
          for (let i = 0; i < syncWrites.length; i += 20) {
            await fsBatchCommit(syncWrites.slice(i, i + 20), adminToken);
          }
          // 메모리상 allUsers 도 갱신해 후속 autoUpgradeAllRanks 가 최신 매출로 판정
          for (const u of allUsers) {
            const s = nodeStats[u.id];
            if (s) {
              u.totalInvested = s.selfInvest;
              u.networkSales = s.networkSales;
              u.otherLegSales = s.otherLegSales;
            }
          }
        }
        postStatus.salesSync = 'done';
        postStatus.salesSyncCount = syncWrites.length;
      } catch (e: any) {
        postStatus.salesSync = 'error';
        postStatus.errors.push({ task: 'salesSync', message: e.message || String(e) });
      }

      try {
        await autoUpgradeAllRanks(adminToken, allUsers, wallets, activeInvestments);
        postStatus.rankUpgrade = 'done';
      } catch (e: any) {
        postStatus.rankUpgrade = 'error';
        postStatus.errors.push({ task: 'rankUpgrade', message: e.message || String(e) });
      }

      postStatus.completedAt = new Date().toISOString();
      try {
        await fsPatch(`settlements/${today}`, {
          postSettlement: postStatus,
          postSettlementErrorCount: postStatus.errors.length
        }, adminToken);
      } catch (e) {
        console.error('Post-settlement status patch failed', e);
      }
    }
    
    // [Step 1] Compute daily_dividend
    for (const inv of activeInvestments) {
      try {
        const endDate = new Date(inv.endDate)
        if (endDate < new Date()) {
          const firestoreFields: any = { status: toFirestoreValue('expired') };
          pushWrite({
            update: {
              name: `projects/dedra-mlm/databases/(default)/documents/investments/${inv.id}`,
              fields: firestoreFields
            },
            updateMask: { fieldPaths: ['status'] }
          });
          await flushWrites();
          const expRules = autoRules.filter((r:any) => r.isActive && r.triggerEvent === 'investment_expire');
          for (const rule of expRules) {
            let t = rule.title || ''; let m = rule.message || '';
            t = t.replace('{productName}', inv.packageName||inv.productName||'').replace('{amount}', String(inv.amountUsdt||0));
            m = m.replace('{productName}', inv.packageName||inv.productName||'').replace('{amount}', String(inv.amountUsdt||0));
            queuePostSettlementNotification(inv.userId, t, m);
          }
          continue
        }

        const daysLeft = Math.ceil((endDate.getTime() - Date.now()) / 86400000)
        if (daysLeft === 7) {
          const soonRules = autoRules.filter((r:any) => r.isActive && r.triggerEvent === 'investment_expire_soon');
          for (const rule of soonRules) {
            let t = rule.title || ''; let m = rule.message || '';
            t = t.replace('{productName}', inv.packageName||inv.productName||'').replace('{daysLeft}', '7');
            m = m.replace('{productName}', inv.packageName||inv.productName||'').replace('{daysLeft}', '7');
            queuePostSettlementNotification(inv.userId, t, m);
          }
        }

        let startDate = inv.lastSettledAt || inv.approvedAt || inv.createdAt;
        if (!startDate) continue;
        const targetD = new Date(today + "T00:00:00Z");
        const startD = new Date(String(startDate).slice(0, 10) + "T00:00:00Z");
        let daysPassed = Math.floor((targetD.getTime() - startD.getTime()) / 86400000);
        if (daysPassed <= 0) { skippedCount++; continue; }
        
        // [ADMIN REQUIREMENT] No retroactive multi-day payouts. Everyone gets exactly 1 day.
        if (daysPassed > 1) {
            daysPassed = 1;
        }

        const dailyRoiPct = inv.dailyRoi || inv.roiPercent || inv.roiPct || 0;
        const principal = inv.amount || inv.amountUsdt || 0;
        const oneDayEarning = Math.round(principal * (dailyRoiPct / 100) * 1e8) / 1e8;
        const dailyEarning = Math.round(oneDayEarning * daysPassed * 1e8) / 1e8;
        
        if (dailyEarning <= 0) continue;

        const member = memberMap.get(inv.userId);
        const isAutoCompoundRoi = member && member.autoCompound;

        let wup = walletUpdates.get(inv.userId);
        if (!wup) {
           wup = { bonusBalanceToAdd: 0, totalInvestToAdd: 0, autoCompoundInvestToAdd: 0, totalEarningsToAdd: 0, currentBonusBalance: 0, currentTotalInvest: 0, currentAutoCompoundTotalInvest: 0, currentTotalEarnings: 0 };
           walletUpdates.set(inv.userId, wup);
        }

        const product = productMap.get(inv.productId) || {};
        const maxAmt = product.maxAmt || product.maxAmount || Infinity;

        let roiWalletInvestAmount = 0;
        let roiWalletBonusAmount = 0;
        if (isAutoCompoundRoi) {
          if (principal + dailyEarning <= maxAmt) {
            wup.totalInvestToAdd += dailyEarning;
            wup.autoCompoundInvestToAdd += dailyEarning;
            roiWalletInvestAmount = dailyEarning;
          } else {
            const allowedInvest = Math.max(0, maxAmt - principal);
            const remainder = dailyEarning - allowedInvest;
            wup.totalInvestToAdd += allowedInvest;
            wup.autoCompoundInvestToAdd += allowedInvest;
            wup.bonusBalanceToAdd += remainder;
            roiWalletInvestAmount = allowedInvest;
            roiWalletBonusAmount = remainder;
          }
          if (member) {
            member.auto_compound_dividend = roundSettlementAmount((member.auto_compound_dividend || 0) + roiWalletInvestAmount);
            member.auto_compound_overflow = roundSettlementAmount((member.auto_compound_overflow || 0) + roiWalletBonusAmount);
          }
        } else {
          wup.bonusBalanceToAdd += dailyEarning;
          roiWalletBonusAmount = dailyEarning;
          if (member && inv.noRollup !== true && inv.isManual1plus1 !== true) member.daily_dividend = roundSettlementAmount((member.daily_dividend || 0) + dailyEarning);
        }
        wup.totalEarningsToAdd += dailyEarning;

        roiSettlementPlans.set(inv.id, {
          inv,
          principal,
          dailyRoiPct,
          paidRoi: inv.paidRoi || 0,
          autoCompoundPrincipal: inv.autoCompoundPrincipal || 0
        });
        addSettlementLedger({
          userId: inv.userId,
          fromUserId: 'system',
          type: 'roi',
          amountUsdt: dailyEarning,
          walletBonusAmount: roiWalletBonusAmount,
          walletInvestAmount: roiWalletInvestAmount,
          totalEarningsAmount: dailyEarning,
          reason: `일일 데일리 수익 (${today} / ${daysPassed}일치)`,
          level: 0,
          investmentId: inv.id,
          detailBucket: 'roiAmount',
          autoCompound: isAutoCompoundRoi === true,
          rollupEligible: isAutoCompoundRoi !== true,
          commissionEligible: isAutoCompoundRoi !== true,
          rankEligible: isAutoCompoundRoi !== true,
          networkSalesEligible: isAutoCompoundRoi !== true,
          source: isAutoCompoundRoi ? 'auto_compound_roi' : 'settlement_roi'
        });
        
        const roiRules = autoRules.filter((r:any) => r.isActive && r.triggerEvent === 'roi_claimed');
        for (const rule of roiRules) {
          let t = rule.title || ''; let m = rule.message || '';
          t = t.replace('{amount}', dailyEarning.toFixed(4)).replace('{date}', today);
          m = m.replace('{amount}', dailyEarning.toFixed(4)).replace('{date}', today);
          queuePostSettlementNotification(inv.userId, t, m);
        }
        processedCount++;
      } catch (e: any) {
        console.error("Investment error:", e);
        errors.push({ type: 'investment_error', id: inv.id, message: e.message || 'Unknown error' });
      }
    }

    // [Step 2] Recommend Bonus
    for (const member of memberMap.values()) {
      // if (member.isBlockedFromRollup) continue; // Now they GENERATE bonuses normally, they just don't RECEIVE them.
      if (member.daily_dividend > 0) {
        const p1 = memberMap.get(member.parent_member_id);
        if (p1) {
          if (p1.isBlockedFromRollup) {
              // invisible p1, but direct bonus doesn't compress usually. We'll just skip giving them money.
          } else {
            const amt1 = member.daily_dividend * (config.direct1 / 100);
            if (amt1 > 0) {
              p1.recommend_bonus += amt1;
            let w1 = walletUpdates.get(p1.id);
            if (!w1) { w1 = { bonusBalanceToAdd:0, totalInvestToAdd:0, totalEarningsToAdd:0, currentBonusBalance:0, currentTotalInvest:0, currentTotalEarnings:0 }; walletUpdates.set(p1.id, w1); }
            w1.bonusBalanceToAdd += amt1;
            w1.totalEarningsToAdd += amt1;
            addSettlementLedger({ userId: p1.id, fromUserId: member.id, type: 'direct_bonus', amountUsdt: amt1, walletBonusAmount: amt1, walletInvestAmount: 0, totalEarningsAmount: amt1, reason: `1대 추천 수당 (기준: ${member.name})`, level: 1, detailBucket: 'directBonus' });
            }
          }

          const p2 = memberMap.get(p1.parent_member_id);
          if (p2) {
            if (p2.isBlockedFromRollup) {} else {
            const amt2 = member.daily_dividend * (config.direct2 / 100);
            if (amt2 > 0) {
              p2.recommend_bonus += amt2;
              let w2 = walletUpdates.get(p2.id);
              if (!w2) { w2 = { bonusBalanceToAdd:0, totalInvestToAdd:0, totalEarningsToAdd:0, currentBonusBalance:0, currentTotalInvest:0, currentTotalEarnings:0 }; walletUpdates.set(p2.id, w2); }
              w2.bonusBalanceToAdd += amt2;
              w2.totalEarningsToAdd += amt2;
              addSettlementLedger({ userId: p2.id, fromUserId: member.id, type: 'direct_bonus', amountUsdt: amt2, walletBonusAmount: amt2, walletInvestAmount: 0, totalEarningsAmount: amt2, reason: `2대 추천 수당 (기준: ${member.name})`, level: 2, detailBucket: 'directBonus' });
            }
            } // close else block
          }
        }
      }
    }

    // [Step 3 & 4] Rank Bonus (Bottom-Up)
    const sortedMembers = Array.from(memberMap.values()).sort((a, b) => b.depth - a.depth);
    for (const member of sortedMembers) {
      member.total_allowance = member.recommend_bonus + member.rank_bonus;
      // if (member.isBlockedFromRollup) continue; // Now they GENERATE bonuses normally, they just don't RECEIVE them.
      if (!member.parent_member_id || (member.daily_dividend <= 0 && member.total_allowance <= 0)) continue;

      let sponsor = memberMap.get(member.parent_member_id);
      let pathMaxRank = member.rank_level;
      const sponsorPath = new Set<string>();

      while (sponsor) {
        if (sponsorPath.has(sponsor.id)) break;
        sponsorPath.add(sponsor.id);
        if (sponsor.rank_level === 0) {
          const nextSponsorId = sponsor.parent_member_id;
          sponsor = nextSponsorId && nextSponsorId !== sponsor.id ? memberMap.get(nextSponsorId) : null;
          continue; // Invisible sponsor
        }

        if (sponsor.id === member.parent_member_id && sponsor.rank_level <= member.rank_level) {
          let matchingAmt = member.daily_dividend * (config.override / 100); // Changed to daily_dividend to exclude bonuses from rollup
          if (matchingAmt > 0) {
            if (sponsor.isBlockedFromRollup) {
                // BLACKHOLE: Absorbed by company. Do not add to sponsor's wallet.
            } else {
                sponsor.rank_bonus += matchingAmt;
                sponsor.total_allowance = sponsor.recommend_bonus + sponsor.rank_bonus;
                let ws = walletUpdates.get(sponsor.id);
                if (!ws) { ws = { bonusBalanceToAdd:0, totalInvestToAdd:0, totalEarningsToAdd:0, currentBonusBalance:0, currentTotalInvest:0, currentTotalEarnings:0 }; walletUpdates.set(sponsor.id, ws); }
                ws.bonusBalanceToAdd += matchingAmt;
                ws.totalEarningsToAdd += matchingAmt;
                addSettlementLedger({ userId: sponsor.id, fromUserId: member.id, type: 'rank_matching', amountUsdt: matchingAmt, walletBonusAmount: matchingAmt, walletInvestAmount: 0, totalEarningsAmount: matchingAmt, reason: `1대 직급 매칭 수당 ${config.override}% (기준: ${member.name} 총수당)`, level: 0, detailBucket: 'rankMatching' });
            }
          }
        }

          // 1. 차액 롤업 방식 (강제 고정)
          if (sponsor.rank_level > pathMaxRank) {
            let rankDiff = sponsor.rank_level - pathMaxRank;
            let rollupAmt = member.daily_dividend * (rankDiff * (config.rankGap / 100));
            if (rollupAmt > 0) {
              if (sponsor.isBlockedFromRollup) {
                  // BLACKHOLE: Absorbed by company
              } else {
                  sponsor.rank_bonus += rollupAmt;
                  sponsor.total_allowance = sponsor.recommend_bonus + sponsor.rank_bonus;
                  let ws = walletUpdates.get(sponsor.id);
                  if (!ws) { ws = { bonusBalanceToAdd:0, totalInvestToAdd:0, totalEarningsToAdd:0, currentBonusBalance:0, currentTotalInvest:0, currentTotalEarnings:0 }; walletUpdates.set(sponsor.id, ws); }
                  ws.bonusBalanceToAdd += rollupAmt;
                  ws.totalEarningsToAdd += rollupAmt;
                  addSettlementLedger({ userId: sponsor.id, fromUserId: member.id, type: 'rank_bonus', amountUsdt: rollupAmt, walletBonusAmount: rollupAmt, walletInvestAmount: 0, totalEarningsAmount: rollupAmt, reason: `직급 수당 롤업 ${rankDiff * config.rankGap}% (기준: ${member.name})`, level: 0, detailBucket: 'rankRollup' });
              }
            }
            pathMaxRank = sponsor.rank_level;
          }
        
        const nextSponsorId = sponsor.parent_member_id;
        sponsor = nextSponsorId && nextSponsorId !== sponsor.id ? memberMap.get(nextSponsorId) : null;
      }
    }

    // [Step 5] Apply payout caps to the dry-run ledger before writing money records.
    const capSummary = applyPayoutCapToLedger();
    rebuildFinancialOutputsFromLedger(capSummary);

    for (const [investmentId, plan] of roiSettlementPlans.entries()) {
      const entry = settlementLedger.find((x: any) => x.investmentId === investmentId);
      const paidRoi = roundSettlementAmount(entry?.amountUsdt || 0);
      const principalToAdd = roundSettlementAmount(entry?.walletInvestAmount || 0);
      const autoCompoundPrincipalToAdd = entry?.autoCompound === true ? principalToAdd : 0;
      const newAmount = roundSettlementAmount(plan.principal + principalToAdd);
      const nextAutoCompoundPrincipal = roundSettlementAmount((plan.autoCompoundPrincipal || 0) + autoCompoundPrincipalToAdd);
      const newExpectedReturn = roundSettlementAmount(newAmount * ((plan.dailyRoiPct || 0) / 100));
      const invFields: any = {
        amount: newAmount,
        amountUsdt: newAmount,
        expectedReturn: newExpectedReturn,
        paidRoi: roundSettlementAmount((plan.paidRoi || 0) + paidRoi),
        lastSettledAt: `${today}T23:59:59.000Z`
      };
      if (autoCompoundPrincipalToAdd > 0 || Number(plan.autoCompoundPrincipal || 0) > 0) {
        invFields.autoCompoundPrincipal = nextAutoCompoundPrincipal;
        invFields.commissionEligiblePrincipal = eligiblePrincipalAmount({
          amount: newAmount,
          amountUsdt: newAmount,
          autoCompoundPrincipal: nextAutoCompoundPrincipal,
          promoLockedPrincipal: plan.inv?.promoLockedPrincipal || 0
        });
        invFields.lastAutoCompoundedAt = autoCompoundPrincipalToAdd > 0 ? `${today}T23:59:59.000Z` : (plan.inv.lastAutoCompoundedAt || null);
        invFields.networkSalesEligible = true;
        invFields.autoCompoundProtected = true;
      }
      const invFirestoreFields: any = {};
      for (const [k, v] of Object.entries(invFields)) {
        invFirestoreFields[k] = toFirestoreValue(v);
      }
      pushWrite({
        update: {
          name: `projects/dedra-mlm/databases/(default)/documents/investments/${investmentId}`,
          fields: invFirestoreFields
        },
        updateMask: {
          fieldPaths: Object.keys(invFields)
        }
      });
      await flushWrites();
    }

    // Write wallet updates and bonuses to DB using the capped ledger.

    for (const [uid, wup] of walletUpdates.entries()) {
      if (wup.bonusBalanceToAdd > 0 || wup.totalInvestToAdd > 0 || wup.totalEarningsToAdd > 0) {
        const fields: any = {
          bonusBalance: Math.round((wup.currentBonusBalance + wup.bonusBalanceToAdd) * 1e8) / 1e8,
          totalInvest: Math.round((wup.currentTotalInvest + wup.totalInvestToAdd) * 1e8) / 1e8,
          autoCompoundTotalInvest: Math.round(((wup.currentAutoCompoundTotalInvest || 0) + (wup.autoCompoundInvestToAdd || 0)) * 1e8) / 1e8,
          totalEarnings: Math.round((wup.currentTotalEarnings + wup.totalEarningsToAdd) * 1e8) / 1e8
        };
        const firestoreFields: any = {};
        for (const [k, v] of Object.entries(fields)) {
          firestoreFields[k] = toFirestoreValue(v);
        }
        
        pushWrite({
          update: {
            name: `projects/dedra-mlm/databases/(default)/documents/wallets/${uid}`,
            fields: firestoreFields
          },
          updateMask: {
            fieldPaths: Object.keys(fields)
          }
        });
        await flushWrites();
      }
    }

    for (const log of bonusLogs) {
        const docId = crypto.randomUUID().replace(/-/g, '');
        const data = { ...log, settlementDate: today, createdAt: new Date() };
        const firestoreFields: any = {};
        for (const [k, v] of Object.entries(data)) {
          firestoreFields[k] = toFirestoreValue(v);
        }
        pushWrite({
          update: {
            name: `projects/dedra-mlm/databases/(default)/documents/bonuses/${docId}`,
            fields: firestoreFields
          }
        });
        await flushWrites();
      }

    if (writes.length > 0) {
      await flushWrites(true);
    }

    // 정산 기록 먼저 저장!
    await fsSet(`settlements/${today}`, {
      date: today,
      totalPaid,
      totalUsers: processedCount,
      skippedCount,
      details,
      errors: errors.length > 0 ? errors : null,
      postSettlement: {
        notificationWrites: postSettlementWrites.length,
        status: 'queued'
      },
      status: 'done',
      source: 'cron',
      duration: Date.now() - startTime,
      startedAt: new Date().toISOString(),
      createdAt: new Date().toISOString()
    }, adminToken);

    // --- 시스템 유지보수 모드 OFF ---
    try {
      await fsPatch('settings/system', { maintenanceMode: false }, adminToken);
    } catch(e) {}

    const postTask = runPostSettlementTasks();
    if (c?.executionCtx?.waitUntil) {
      c.executionCtx.waitUntil(postTask);
    } else {
      await postTask;
    }

    return c.json({ success: true, date: today, totalPaid, processedCount, postSettlementWrites: postSettlementWrites.length, duration: Date.now() - startTime })
  } catch (e: any) {
    if (e.statusCode !== 400) {
      try {
        const adminToken2 = await getAdminToken()
        const today2 = (() => {
          try { return resolveSettlementDate(overrideDate) }
          catch (_) { return getKstDateString() }
        })()
        
        // 정산 실패 시에도 유지보수 모드는 해제해야 함
        await fsPatch('settings/system', { maintenanceMode: false }, adminToken2);
        
        await fsPatch(`settlements/${today2}`, {
          status: 'error',
          error: e.message,
          errorAt: new Date().toISOString()
        }, adminToken2)
      } catch (_) {}
    }
    return c.json({ success: false, error: e.message }, e.statusCode || 500)
  }
}

export async function runSettleDryRun(c: any, overrideDate?: string | null, limit = 250) {
  const startTime = Date.now();
  let stage = 'init';
  try {
    stage = 'auth';
    const adminToken = await getAdminToken();
    const today = resolveSettlementDate(overrideDate, { allowFuture: true });
    const rowLimit = Math.min(Math.max(Number(limit) || 250, 1), 1000);

    stage = 'existing-settlement';
    const existing = await fsGet(`settlements/${today}`, adminToken).catch(() => null);
    const existingStatus = existing?.fields ? fromFirestoreValue(existing.fields.status || { stringValue: '' }) : null;

    stage = 'load-investments';
    const investments = await fsQuery('investments', adminToken, [], 100000);
    const activeInvestments = investments.filter((inv: any) => inv.status === 'active');

    stage = 'load-settings';
    const settingsRaw = await fsGet('settings/main', adminToken);
    const settingsData = settingsRaw?.fields ? firestoreDocToObj(settingsRaw) : {};

    const priceDoc = await fsGet('settings/deedraPrice', adminToken);
    const dedraRate = priceDoc?.fields?.price ? Number(priceDoc.fields.price.doubleValue || priceDoc.fields.price.integerValue || 0.5) : 0.5;

    const ratesDoc = await fsGet('settings/rates', adminToken);
    const ratesData = ratesDoc?.fields ? firestoreDocToObj(ratesDoc) : {};
    const config = {
      direct1: Number(ratesData.rate_direct1 ?? 10),
      direct2: Number(ratesData.rate_direct2 ?? 5),
      rankGap: Number(ratesData.rate_rankGap ?? 10),
      override: Number(ratesData.rate_override ?? 10),
      rankGapMode: ratesData.rankGapMode || 'gap'
    };

    stage = 'load-users-wallets-products';
    const allUsers = await fsQuery('users', adminToken, [], 100000);
    const wallets = await fsQuery('wallets', adminToken, [], 100000);
    const products = await fsQuery('products', adminToken, [], 100);
    const productMap = new Map();
    for (const p of products) productMap.set(p.id || p.name || '', p);

    const abusingDoc = await fsGet('settings/abusing', adminToken);
    const abusingData = abusingDoc?.fields ? firestoreDocToObj(abusingDoc) : {
      globalNoDepositRollupBlock: false,
      globalNoDepositWithdrawBlock: false,
      customRules: []
    };

    stage = 'load-real-deposits';
    const realDepositTxs = await fsQuery('transactions', adminToken, [
      { fieldFilter: { field: { fieldPath: 'type' }, op: 'EQUAL', value: { stringValue: 'deposit' } } },
      { fieldFilter: { field: { fieldPath: 'status' }, op: 'EQUAL', value: { stringValue: 'approved' } } }
    ], 100000);
    const realDepositors = new Set(realDepositTxs.map((t: any) => t.userId));

    const memberMap = new Map();
    for (const u of allUsers) {
      memberMap.set(u.id, {
        id: u.id,
        name: u.name || u.email || u.id,
        parent_member_id: u.referredBy && u.referredBy !== u.id ? u.referredBy : null,
        rank: u.rank || 'G0',
        rank_level: getRankLevel(u.rank || 'G0'),
        daily_dividend: 0,
        auto_compound_dividend: 0,
        auto_compound_overflow: 0,
        recommend_bonus: 0,
        rank_bonus: 0,
        total_allowance: 0,
        depth: 0,
        autoCompound: u.autoCompound === true || String(u.autoCompound) === 'true'
      });
    }

    // [FIX 2026-04-30] uid → countryCode 매핑 (어뷰징 국가 규칙 평가용)
    const userCountryByUid = new Map<string, string>();
    for (const u of allUsers) {
      const code = String(u.countryCode || u.country || '')
        .trim().toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3);
      if (code) userCountryByUid.set(u.id, code);
    }

    const abusingRules = Array.isArray(abusingData.customRules) ? abusingData.customRules : [];
    const abusingUserRules = abusingRules.filter((r: any) => (r.ruleType || 'user') === 'user');
    const abusingCountryRules = abusingRules.filter((r: any) => r.ruleType === 'country');
    for (const m of memberMap.values()) {
      let blocked = abusingData.globalNoDepositRollupBlock && !realDepositors.has(m.id);
      let curr = m.id;
      const seenRulePath = new Set<string>();
      let appliedRule = null;
      while (curr && !seenRulePath.has(curr)) {
        seenRulePath.add(curr);
        const rSelf = abusingUserRules.find((r: any) => r.uid === curr && r.scope === 'self' && curr === m.id);
        const rGroup = abusingUserRules.find((r: any) => r.uid === curr && r.scope === 'group');
        if (rSelf) { appliedRule = rSelf; break; }
        if (rGroup) { appliedRule = rGroup; break; }
        const p = memberMap.get(curr);
        const next = p ? p.parent_member_id : null;
        curr = next && next !== curr ? next : null;
      }
      // 2차: 국가 단위 규칙 (회원 단위 규칙 미존재 시)
      if (!appliedRule && abusingCountryRules.length) {
        const myCode = userCountryByUid.get(m.id) || '';
        if (myCode) {
          const cRule = abusingCountryRules.find((r: any) => r.countryCode === myCode);
          if (cRule) appliedRule = cRule;
        }
      }
      if (appliedRule) {
        if (appliedRule.rollup === 'allow') blocked = false;
        else if (appliedRule.rollup === 'block') blocked = true;
      }
      m.isBlockedFromRollup = blocked;
    }

    const depthCache = new Map();
    function getDepth(mid: string): number {
      if (depthCache.has(mid)) return depthCache.get(mid)!;
      const visiting = new Set<string>();
      const stack: string[] = [];
      let curr: string | null = mid;
      while (curr && !depthCache.has(curr)) {
        if (visiting.has(curr)) break;
        visiting.add(curr);
        stack.push(curr);
        const m = memberMap.get(curr);
        const parent = m ? m.parent_member_id : null;
        curr = parent && parent !== curr && memberMap.has(parent) ? parent : null;
      }
      let depth = curr && depthCache.has(curr) ? depthCache.get(curr)! : 0;
      for (let i = stack.length - 1; i >= 0; i--) {
        const id = stack[i];
        const m = memberMap.get(id);
        const parent = m ? m.parent_member_id : null;
        if (!parent || parent === id || !memberMap.has(parent)) depth = 0;
        else depth += 1;
        depthCache.set(id, depth);
      }
      return depthCache.get(mid) || 0;
    }
    stage = 'compute-depth';
    for (const m of memberMap.values()) m.depth = getDepth(m.id);

    const walletStates = new Map();
    for (const w of wallets) {
      walletStates.set(w.id, {
        currentBonusBalance: Number(w.bonusBalance || 0),
        currentTotalInvest: Number(w.totalInvest || 0),
        currentTotalEarnings: Number(w.totalEarnings || 0)
      });
    }
    function getWalletState(uid: string) {
      if (!walletStates.has(uid)) {
        walletStates.set(uid, { currentBonusBalance: 0, currentTotalInvest: 0, currentTotalEarnings: 0 });
      }
      return walletStates.get(uid);
    }

    const settlementLedger: any[] = [];
    const details: any = {
      debugUsers: allUsers.length,
      debugInvs: investments.length,
      debugRealTx: realDepositTxs.length,
      debugMap: memberMap.size,
      debugConfigDir1: config.direct1,
      roiAmount: 0,
      directBonus: 0,
      rankRollup: 0,
      rankMatching: 0,
      autoCompoundReinvest: 0,
      autoCompoundOverflow: 0
    };
    const errors: any[] = [];
    let processedCount = 0;
    let skippedCount = 0;
    let expiredCount = 0;

    // [FIX 2026-04-30] dry-run 에도 동일 일자 + 동일 (userId, fromUserId, type, level, investmentId) 중복 방지
    const dryRunLedgerDedupKeys = new Set<string>();
    function makeDryRunLedgerKey(e: any) {
      return `${today}|${e.userId}|${e.fromUserId || ''}|${e.type || ''}|${e.level ?? ''}|${e.investmentId || ''}`;
    }
    function addLedger(entry: any) {
      const amountUsdt = roundSettlementAmount(entry.amountUsdt);
      if (amountUsdt <= 0) return;
      const dedupKey = makeDryRunLedgerKey(entry);
      if (dryRunLedgerDedupKeys.has(dedupKey)) return;
      dryRunLedgerDedupKeys.add(dedupKey);
      settlementLedger.push({
        ...entry,
        amountUsdt,
        originalAmountUsdt: amountUsdt,
        walletBonusAmount: roundSettlementAmount(entry.walletBonusAmount || 0),
        walletInvestAmount: roundSettlementAmount(entry.walletInvestAmount || 0),
        totalEarningsAmount: roundSettlementAmount(entry.totalEarningsAmount ?? amountUsdt),
        dedupKey,
      });
    }

    function reduceEntry(entry: any, reduction: number): number {
      let remaining = roundSettlementAmount(reduction);
      if (remaining <= 0 || entry.amountUsdt <= 0) return 0;
      const reduceBonus = Math.min(entry.walletBonusAmount || 0, remaining);
      entry.walletBonusAmount = roundSettlementAmount((entry.walletBonusAmount || 0) - reduceBonus);
      remaining = roundSettlementAmount(remaining - reduceBonus);
      const reduceInvest = Math.min(entry.walletInvestAmount || 0, remaining);
      entry.walletInvestAmount = roundSettlementAmount((entry.walletInvestAmount || 0) - reduceInvest);
      remaining = roundSettlementAmount(remaining - reduceInvest);
      const reduced = roundSettlementAmount(reduction - remaining);
      entry.amountUsdt = roundSettlementAmount(entry.amountUsdt - reduced);
      entry.totalEarningsAmount = roundSettlementAmount((entry.totalEarningsAmount || 0) - reduced);
      entry.payoutCapReducedAmount = roundSettlementAmount((entry.originalAmountUsdt || 0) - entry.amountUsdt);
      return remaining;
    }

    function applyDryRunCap() {
      const summary: any = { applied: false, totalReduced: 0, users: {} };
      const maxPayoutRatio = Number(settingsData.maxPayoutRatio ?? 3);
      if (!settingsData.enableMaxPayoutCap || !(maxPayoutRatio > 0)) return summary;

      const entriesByUser = new Map<string, any[]>();
      for (const entry of settlementLedger) {
        if (entry.amountUsdt <= 0) continue;
        if (!entriesByUser.has(entry.userId)) entriesByUser.set(entry.userId, []);
        entriesByUser.get(entry.userId)!.push(entry);
      }

      for (const [uid, entries] of entriesByUser.entries()) {
        const wallet = getWalletState(uid);
        const requestedEarnings = roundSettlementAmount(entries.reduce((sum, e) => sum + (e.totalEarningsAmount || 0), 0));
        const requestedInvest = roundSettlementAmount(entries.reduce((sum, e) => sum + (e.walletInvestAmount || 0), 0));
        const totalInvest = roundSettlementAmount((wallet.currentTotalInvest || 0) + requestedInvest);
        const maxAllowedEarnings = roundSettlementAmount(totalInvest * maxPayoutRatio);
        const availableEarnings = Math.max(0, roundSettlementAmount(maxAllowedEarnings - (wallet.currentTotalEarnings || 0)));
        let overflow = roundSettlementAmount(requestedEarnings - availableEarnings);
        if (overflow <= 0) continue;

        const originalOverflow = overflow;
        for (const entry of [...entries].reverse()) {
          if (overflow <= 0) break;
          overflow = reduceEntry(entry, overflow);
        }
        const reduced = roundSettlementAmount(originalOverflow - overflow);
        if (reduced > 0) {
          summary.applied = true;
          summary.totalReduced = roundSettlementAmount(summary.totalReduced + reduced);
          summary.users[uid] = { requestedEarnings, availableEarnings, reduced, maxAllowedEarnings };
        }
      }
      return summary;
    }

    stage = 'calculate-roi';
    for (const inv of activeInvestments) {
      try {
        const endDate = new Date(inv.endDate);
        if (endDate < new Date()) { expiredCount++; continue; }

        const startDate = inv.lastSettledAt || inv.approvedAt || inv.createdAt;
        if (!startDate) continue;
        const targetD = new Date(today + 'T00:00:00Z');
        const startD = new Date(String(startDate).slice(0, 10) + 'T00:00:00Z');
        let daysPassed = Math.floor((targetD.getTime() - startD.getTime()) / 86400000);
        if (daysPassed <= 0) { skippedCount++; continue; }
        if (daysPassed > 1) daysPassed = 1;

        const dailyRoiPct = inv.dailyRoi || inv.roiPercent || inv.roiPct || 0;
        const principal = Number(inv.amount || inv.amountUsdt || 0);
        const oneDayEarning = roundSettlementAmount(principal * (dailyRoiPct / 100));
        const dailyEarning = roundSettlementAmount(oneDayEarning * daysPassed);
        if (dailyEarning <= 0) continue;

        const member = memberMap.get(inv.userId);
        const isAutoCompoundRoi = member && member.autoCompound;

        const product = productMap.get(inv.productId) || {};
        const maxAmt = product.maxAmt || product.maxAmount || Infinity;
        let walletInvestAmount = 0;
        let walletBonusAmount = 0;
        if (isAutoCompoundRoi) {
          if (principal + dailyEarning <= maxAmt) {
            walletInvestAmount = dailyEarning;
          } else {
            walletInvestAmount = Math.max(0, maxAmt - principal);
            walletBonusAmount = roundSettlementAmount(dailyEarning - walletInvestAmount);
          }
          if (member) {
            member.auto_compound_dividend = roundSettlementAmount((member.auto_compound_dividend || 0) + walletInvestAmount);
            member.auto_compound_overflow = roundSettlementAmount((member.auto_compound_overflow || 0) + walletBonusAmount);
          }
        } else {
          walletBonusAmount = dailyEarning;
          if (member && inv.noRollup !== true && inv.isManual1plus1 !== true) member.daily_dividend = roundSettlementAmount(member.daily_dividend + dailyEarning);
        }

        addLedger({
          userId: inv.userId,
          fromUserId: 'system',
          type: 'roi',
          amountUsdt: dailyEarning,
          walletBonusAmount,
          walletInvestAmount,
          totalEarningsAmount: dailyEarning,
          reason: `일일 데일리 수익 (${today} / ${daysPassed}일치)`,
          level: 0,
          investmentId: inv.id,
          productName: inv.packageName || inv.productName || inv.productId || '',
          detailBucket: 'roiAmount',
          autoCompound: isAutoCompoundRoi === true,
          rollupEligible: isAutoCompoundRoi !== true,
          commissionEligible: isAutoCompoundRoi !== true,
          rankEligible: isAutoCompoundRoi !== true,
          networkSalesEligible: isAutoCompoundRoi !== true,
          source: isAutoCompoundRoi ? 'auto_compound_roi' : 'settlement_roi'
        });
        processedCount++;
      } catch (e: any) {
        errors.push({ type: 'investment_error', id: inv.id, message: e.message || 'Unknown error' });
      }
    }

    stage = 'calculate-direct-bonus';
    for (const member of memberMap.values()) {
      if (member.daily_dividend > 0) {
        const p1 = memberMap.get(member.parent_member_id);
        if (p1) {
          if (!p1.isBlockedFromRollup) {
            const amt1 = roundSettlementAmount(member.daily_dividend * (config.direct1 / 100));
            if (amt1 > 0) {
              p1.recommend_bonus = roundSettlementAmount(p1.recommend_bonus + amt1);
              addLedger({ userId: p1.id, fromUserId: member.id, type: 'direct_bonus', amountUsdt: amt1, walletBonusAmount: amt1, walletInvestAmount: 0, totalEarningsAmount: amt1, reason: `1대 추천 수당 (기준: ${member.name})`, level: 1, detailBucket: 'directBonus' });
            }
          }

          const p2 = memberMap.get(p1.parent_member_id);
          if (p2 && !p2.isBlockedFromRollup) {
            const amt2 = roundSettlementAmount(member.daily_dividend * (config.direct2 / 100));
            if (amt2 > 0) {
              p2.recommend_bonus = roundSettlementAmount(p2.recommend_bonus + amt2);
              addLedger({ userId: p2.id, fromUserId: member.id, type: 'direct_bonus', amountUsdt: amt2, walletBonusAmount: amt2, walletInvestAmount: 0, totalEarningsAmount: amt2, reason: `2대 추천 수당 (기준: ${member.name})`, level: 2, detailBucket: 'directBonus' });
            }
          }
        }
      }
    }

    stage = 'calculate-rank-bonus';
    const sortedMembers = Array.from(memberMap.values()).sort((a: any, b: any) => b.depth - a.depth);
    for (const member of sortedMembers as any[]) {
      member.total_allowance = member.recommend_bonus + member.rank_bonus;
      if (!member.parent_member_id || (member.daily_dividend <= 0 && member.total_allowance <= 0)) continue;

      let sponsor = memberMap.get(member.parent_member_id);
      let pathMaxRank = member.rank_level;
      const sponsorPath = new Set<string>();
      while (sponsor) {
        if (sponsorPath.has(sponsor.id)) break;
        sponsorPath.add(sponsor.id);
        if (sponsor.rank_level === 0) {
          const nextSponsorId = sponsor.parent_member_id;
          sponsor = nextSponsorId && nextSponsorId !== sponsor.id ? memberMap.get(nextSponsorId) : null;
          continue;
        }

        if (sponsor.id === member.parent_member_id && sponsor.rank_level <= member.rank_level) {
          const matchingAmt = roundSettlementAmount(member.daily_dividend * (config.override / 100));
          if (matchingAmt > 0 && !sponsor.isBlockedFromRollup) {
            sponsor.rank_bonus = roundSettlementAmount(sponsor.rank_bonus + matchingAmt);
            sponsor.total_allowance = sponsor.recommend_bonus + sponsor.rank_bonus;
            addLedger({ userId: sponsor.id, fromUserId: member.id, type: 'rank_matching', amountUsdt: matchingAmt, walletBonusAmount: matchingAmt, walletInvestAmount: 0, totalEarningsAmount: matchingAmt, reason: `1대 직급 매칭 수당 ${config.override}% (기준: ${member.name} 총수당)`, level: 0, detailBucket: 'rankMatching' });
          }
        }

        if (sponsor.rank_level > pathMaxRank) {
          const rankDiff = sponsor.rank_level - pathMaxRank;
          const rollupAmt = roundSettlementAmount(member.daily_dividend * (rankDiff * (config.rankGap / 100)));
          if (rollupAmt > 0 && !sponsor.isBlockedFromRollup) {
            sponsor.rank_bonus = roundSettlementAmount(sponsor.rank_bonus + rollupAmt);
            sponsor.total_allowance = sponsor.recommend_bonus + sponsor.rank_bonus;
            addLedger({ userId: sponsor.id, fromUserId: member.id, type: 'rank_bonus', amountUsdt: rollupAmt, walletBonusAmount: rollupAmt, walletInvestAmount: 0, totalEarningsAmount: rollupAmt, reason: `직급 수당 롤업 ${rankDiff * config.rankGap}% (기준: ${member.name})`, level: 0, detailBucket: 'rankRollup' });
          }
          pathMaxRank = sponsor.rank_level;
        }

        const nextSponsorId = sponsor.parent_member_id;
        sponsor = nextSponsorId && nextSponsorId !== sponsor.id ? memberMap.get(nextSponsorId) : null;
      }
    }

    stage = 'summarize';
    const capSummary = applyDryRunCap();
    const perUser = new Map();
    let totalPaid = 0;
    let walletBonusTotal = 0;
    let walletInvestTotal = 0;
    let totalEarningsDelta = 0;
    details.roiAmount = 0;
    details.directBonus = 0;
    details.rankRollup = 0;
    details.rankMatching = 0;
    details.autoCompoundReinvest = 0;
    details.autoCompoundOverflow = 0;

    for (const entry of settlementLedger) {
      const amountUsdt = roundSettlementAmount(entry.amountUsdt);
      if (amountUsdt <= 0) continue;
      const member = memberMap.get(entry.userId) || {};
      if (!perUser.has(entry.userId)) {
        perUser.set(entry.userId, {
          userId: entry.userId,
          name: member.name || entry.userId,
          rank: member.rank || 'G0',
          roi: 0,
          directBonus: 0,
          rankMatching: 0,
          rankRollup: 0,
          walletBonusAmount: 0,
          walletInvestAmount: 0,
          autoCompoundReinvest: 0,
          autoCompoundOverflow: 0,
          totalEarningsAmount: 0,
          originalAmountUsdt: 0,
          payoutCapReducedAmount: 0
        });
      }
      const row = perUser.get(entry.userId);
      if (entry.type === 'roi') row.roi = roundSettlementAmount(row.roi + amountUsdt);
      else if (entry.type === 'direct_bonus') row.directBonus = roundSettlementAmount(row.directBonus + amountUsdt);
      else if (entry.type === 'rank_matching') row.rankMatching = roundSettlementAmount(row.rankMatching + amountUsdt);
      else if (entry.type === 'rank_bonus') row.rankRollup = roundSettlementAmount(row.rankRollup + amountUsdt);

      row.walletBonusAmount = roundSettlementAmount(row.walletBonusAmount + (entry.walletBonusAmount || 0));
      row.walletInvestAmount = roundSettlementAmount(row.walletInvestAmount + (entry.walletInvestAmount || 0));
      if (entry.autoCompound === true) {
        row.autoCompoundReinvest = roundSettlementAmount((row.autoCompoundReinvest || 0) + (entry.walletInvestAmount || 0));
        row.autoCompoundOverflow = roundSettlementAmount((row.autoCompoundOverflow || 0) + (entry.walletBonusAmount || 0));
        details.autoCompoundReinvest = roundSettlementAmount(details.autoCompoundReinvest + (entry.walletInvestAmount || 0));
        details.autoCompoundOverflow = roundSettlementAmount(details.autoCompoundOverflow + (entry.walletBonusAmount || 0));
      }
      row.totalEarningsAmount = roundSettlementAmount(row.totalEarningsAmount + (entry.totalEarningsAmount || amountUsdt));
      row.originalAmountUsdt = roundSettlementAmount(row.originalAmountUsdt + (entry.originalAmountUsdt || amountUsdt));
      row.payoutCapReducedAmount = roundSettlementAmount(row.payoutCapReducedAmount + (entry.payoutCapReducedAmount || 0));

      if (entry.detailBucket && details[entry.detailBucket] !== undefined) {
        details[entry.detailBucket] = roundSettlementAmount(details[entry.detailBucket] + amountUsdt);
      }
      totalPaid = roundSettlementAmount(totalPaid + amountUsdt);
      walletBonusTotal = roundSettlementAmount(walletBonusTotal + (entry.walletBonusAmount || 0));
      walletInvestTotal = roundSettlementAmount(walletInvestTotal + (entry.walletInvestAmount || 0));
      totalEarningsDelta = roundSettlementAmount(totalEarningsDelta + (entry.totalEarningsAmount || amountUsdt));
    }

    details.payoutCapApplied = capSummary.applied === true;
    details.payoutCapReduced = roundSettlementAmount(capSummary.totalReduced || 0);
    details.ledgerEntryCount = settlementLedger.filter((x: any) => x.amountUsdt > 0).length;

    const rows = Array.from(perUser.values()).sort((a: any, b: any) => b.totalEarningsAmount - a.totalEarningsAmount);
    const originalTotalPaid = roundSettlementAmount(totalPaid + (capSummary.totalReduced || 0));

    stage = 'respond';
    return c.json({
      success: true,
      dryRun: true,
      date: today,
      existingSettlementStatus: existingStatus,
      config,
      counts: {
        users: allUsers.length,
        wallets: wallets.length,
        investments: investments.length,
        activeInvestments: activeInvestments.length,
        realDepositors: realDepositors.size,
        expiredInvestments: expiredCount
      },
      totals: {
        originalTotalPaid,
        totalPaid,
        payoutCapReduced: roundSettlementAmount(capSummary.totalReduced || 0),
        walletBonusAmount: walletBonusTotal,
        walletInvestAmount: walletInvestTotal,
        totalEarningsDelta
      },
      details,
      capSummary,
      processedCount,
      skippedCount,
      errors,
      rowCount: rows.length,
      truncated: rows.length > rowLimit,
      rows: rows.slice(0, rowLimit),
      duration: Date.now() - startTime
    });
  } catch (e: any) {
    return c.json({ success: false, dryRun: true, stage, error: e?.message || String(e) || 'Unknown dry-run error' }, e?.statusCode || 500);
  }
}


// ==== AUTO UPGRADE RANKS LOGIC ====
export async function autoUpgradeAllRanks(adminToken: string, allUsers: any[], wallets: any[], activeInvestments: any[]) {
  try {
    const rankSetDoc = await fsGet('settings/rankPromotion', adminToken).catch(()=>null);
    if (!rankSetDoc || !rankSetDoc.fields) return;

    const setFields = rankSetDoc.fields;
    const enableAutoPromotion = setFields.enableAutoPromotion?.booleanValue === true;
    if (!enableAutoPromotion) return;

    // We force preventDowngrade = true as requested
    const useBalancedVolume = setFields.useBalancedVolume?.booleanValue === true;
    const excludeTopLines = Number(setFields.excludeTopLines?.integerValue || setFields.excludeTopLines?.doubleValue || 1);
    const countOnlyDirect = setFields.countOnlyDirectReferrals?.booleanValue === true;
    const networkDepth = Number(setFields.networkDepth?.integerValue || setFields.networkDepth?.doubleValue || 3);
    const depth = countOnlyDirect ? 1 : networkDepth;

    // Parse criteria map
    const criteriaObj = setFields.criteria?.mapValue?.fields || {};
    const criteria: any = {};
    for (const key of Object.keys(criteriaObj)) {
      const c = criteriaObj[key]?.mapValue?.fields || {};
      criteria[key] = {
        minSelfInvest: Number(c.minSelfInvest?.integerValue || c.minSelfInvest?.doubleValue || 0),
        minBalancedVolume: Number(c.minBalancedVolume?.integerValue || c.minBalancedVolume?.doubleValue || 0),
      };
    }

    const RANK_ORDER = ['G0','G1','G2','G3','G4','G5','G6','G7','G8','G9','G10'];
    const candidates = [];

    // Precalculate investments
    const invsByUser: Record<string, number> = {};
    for (const inv of activeInvestments) {
      const uid = inv.userId;
      if (!invsByUser[uid]) invsByUser[uid] = 0;
      invsByUser[uid] += eligiblePrincipalAmount(inv);
    }

    // Precalculate wallets
    const walletsMap: Record<string, any> = {};
    for (const w of wallets) {
      walletsMap[w.userId || w.id] = w;
    }

    for (const target of allUsers) {
      if (target.role === 'admin') continue;
      // Do NOT skip manualRankSet users anymore to allow upgrades.

      const currentRank = target.rank || 'G0';
      const curIdx = RANK_ORDER.indexOf(currentRank);
      if (curIdx < 0) continue;

      const selfInvest = invsByUser[target.id] || 0;

      const downline = [];
      let lvl = [target.id];
      for (let d = 0; d < depth; d++) {
          const next = allUsers.filter((u: any) => lvl.includes(u.referredBy)).map((u: any) => u.id);
          downline.push(...next);
          lvl = next;
          if (!next.length) break;
      }

      let networkSales = 0;
      for (const dlId of downline) {
          networkSales += invsByUser[dlId] || 0;
      }

      let balancedVolume = networkSales;
      if (useBalancedVolume && downline.length > 0) {
          const directReferrals = allUsers.filter((x: any) => x.referredBy === target.id).map((x: any) => x.id);
          if (directReferrals.length === 0) {
              balancedVolume = 0;
          } else {
              let legVolumes = [];
              for (const dr of directReferrals) {
                  let legVol = 0;
                  let legDl = [dr];
                  let currentLvl = [dr];
                  for (let d = 1; d < depth; d++) {
                      const next = allUsers.filter((x: any) => currentLvl.includes(x.referredBy)).map((x: any) => x.id);
                      legDl.push(...next);
                      currentLvl = next;
                      if (!next.length) break;
                  }
                  for (const lId of legDl) {
                      legVol += invsByUser[lId] || 0;
                  }
                  legVolumes.push({ id: dr, vol: legVol });
              }
              legVolumes.sort((a,b) => b.vol - a.vol);
              
              balancedVolume = 0;
              for (let i = excludeTopLines; i < legVolumes.length; i++) {
                  balancedVolume += legVolumes[i].vol;
              }
          }
      }

      // NO downgrade!
      let bestRank = currentRank;
      let bestIdx = curIdx;

      for (let i = RANK_ORDER.length - 1; i >= 1; i--) {
          const rankKey = RANK_ORDER[i];
          const c = criteria[rankKey];
          if (!c) continue;

          const meetsInvest  = selfInvest >= (c.minSelfInvest || 0);
          const meetsBV      = balancedVolume >= (c.minBalancedVolume || 0);
          const passes = meetsInvest && meetsBV;

          if (passes) {
              if (i > bestIdx) { bestRank = rankKey; bestIdx = i; }
              break;
          }
      }

      if (bestIdx > curIdx) {
          candidates.push({
              id: target.id,
              name: target.name || target.email || target.userId,
              oldRank: currentRank,
              newRank: bestRank
          });
      }
    }

    // Apply upgrades using fsPatch
    for (const c of candidates) {
        await fsPatch(`users/${c.id}`, {
            rank: c.newRank,
            updatedAt: new Date().toISOString()
        }, adminToken).catch(err => console.error(`Failed to auto-upgrade ${c.id}`, err));
        
        // Audit log
        await fsCreate(`adminLogs`, {
            adminId: 'SYSTEM',
            targetId: c.id,
            action: 'rank',
            reason: `[자동승진] ${c.name}: ${c.oldRank} → ${c.newRank} (일일정산시 확인)`,
            details: JSON.stringify({ oldRank: c.oldRank, newRank: c.newRank, trigger: 'daily_settlement' }),
            createdAt: new Date().toISOString()
        }, adminToken).catch(()=>{});
        
        // Notification for the user
        await fsCreate(`notifications`, {
            userId: c.id,  // Direct to the user
            type: 'rank_upgrade',
            title: '🎉 직급 승급을 진심으로 축하합니다!',
            message: `회원님의 직급이 [${c.oldRank}]에서 [${c.newRank}] 직급으로 자동 승급되었습니다! 🚀\n앞으로 산하 롤업(Rollup) 보너스 비율이 상승하여 매일 더 큰 수익을 기대하실 수 있습니다.`,
            isRead: false,
            createdAt: new Date().toISOString()
        }, adminToken).catch(()=>{});
    }

  } catch(e) {
    console.error('Error during autoUpgradeAllRanks:', e);
  }
}
