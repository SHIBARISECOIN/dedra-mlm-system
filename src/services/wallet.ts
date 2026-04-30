// src/services/wallet.ts
// PART II §0 HARD RULE #9 — 단일 잔액 변경 진입점 (adjustWallet)
// 모든 잔액(usdtBalance / bonusBalance / totalEarnings) 변경은 이 함수만을 통해야 함

import {
  fsGet,
  fsBatchCommit,
  toFirestoreValue,
} from '../index';

/** PART II §0 HARD RULE #3 — 8자리 반올림 */
const round8 = (x: number) => Math.round(x * 1e8) / 1e8;

const FIRESTORE_DOC_BASE =
  'projects/dedra-mlm/databases/(default)/documents';

/**
 * PART II §0 HARD RULE #4 — 20개 단위 배치 커밋 누적기
 * adjustWallet 을 batched 모드로 사용할 때 호출자가 수동으로 commit 호출
 */
export class WalletBatch {
  private writes: any[] = [];
  private bonusLogs: any[] = [];

  constructor(private adminToken: string) {}

  push(write: any) {
    this.writes.push(write);
  }
  pushBonus(log: any) {
    this.bonusLogs.push(log);
  }

  size(): number {
    return this.writes.length + this.bonusLogs.length;
  }

  async commit() {
    // fsBatchCommit 내부에서 20개씩 자동 분할되므로 그대로 전달
    if (this.writes.length > 0) {
      await fsBatchCommit(this.writes, this.adminToken);
      this.writes = [];
    }
    if (this.bonusLogs.length > 0) {
      await fsBatchCommit(this.bonusLogs, this.adminToken);
      this.bonusLogs = [];
    }
  }
}

export interface AdjustOptions {
  /** 'immediate' (default): 즉시 commit. 'batched': WalletBatch 에 누적 후 호출자가 commit */
  flushMode?: 'immediate' | 'batched';
  batch?: WalletBatch;
  /** ledger(bonuses) 기록 비활성 (롤백 등 특수상황) */
  skipLedger?: boolean;
  /** 거래 분류 (deposit / withdrawal / roi / direct_bonus / rank_matching / rank_bonus / jackpot_win / rollback / admin_adjust 등) */
  type?: string;
  /** 음수 잔액 허용 (관리자 조정 등 — 기본 false) */
  allowNegative?: boolean;
}

export interface AdjustResult {
  uid: string;
  prevUsdt: number;
  prevBonus: number;
  prevEarnings: number;
  newUsdt: number;
  newBonus: number;
  newEarnings: number;
  deltaUSDT: number;
  deltaBonus: number;
  reason: string;
  txRef: string;
}

/**
 * 단일 잔액 변경 진입점
 *
 * @param uid           대상 회원 ID
 * @param deltaUSDT     usdtBalance 변동량 (+ 입금/적립, − 차감)
 * @param deltaBonus    bonusBalance 변동량 (+ 보너스 적립, − 출금/차감)
 * @param reason        한국어 사유 (감사로그/알림용)
 * @param txRef         원천 트랜잭션 참조 (txid / docId / settlementDate 등)
 * @param adminToken    Firestore admin token
 * @param opts          flushMode / batch / skipLedger / type / allowNegative
 *
 * @returns AdjustResult — 변경 전/후 잔액 및 메타데이터
 *
 * 보장사항:
 * - 8자리 반올림 (HARD RULE #3)
 * - 20개 단위 배치 (HARD RULE #4 — fsBatchCommit 내부 처리)
 * - 음수 잔액 방지 (allowNegative=false 기본)
 * - bonuses 컬렉션에 자동 ledger 기록 (skipLedger=true 시 스킵)
 * - totalEarnings 는 양의 deltaBonus 에서만 누적 (출금 차감은 totalEarnings 에 영향 없음)
 */
export async function adjustWallet(
  uid: string,
  deltaUSDT: number,
  deltaBonus: number,
  reason: string,
  txRef: string,
  adminToken: string,
  opts: AdjustOptions = {}
): Promise<AdjustResult> {
  if (!uid) throw new Error('adjustWallet: uid 필수');
  if (!Number.isFinite(deltaUSDT) || !Number.isFinite(deltaBonus)) {
    throw new Error(`adjustWallet: delta 가 유효한 숫자가 아닙니다 (uid=${uid})`);
  }

  const walletDoc = await fsGet(`wallets/${uid}`, adminToken).catch(() => null);
  const f = walletDoc?.fields || {};
  const prevUsdt = Number(
    f.usdtBalance?.doubleValue ??
      f.usdtBalance?.integerValue ??
      0
  );
  const prevBonus = Number(
    f.bonusBalance?.doubleValue ??
      f.bonusBalance?.integerValue ??
      0
  );
  const prevEarnings = Number(
    f.totalEarnings?.doubleValue ??
      f.totalEarnings?.integerValue ??
      0
  );

  const newUsdt = round8(prevUsdt + deltaUSDT);
  const newBonus = round8(prevBonus + deltaBonus);
  // totalEarnings 는 양의 deltaBonus 만 누적 (출금/롤백 차감은 별도 처리)
  const earningsDelta = deltaBonus > 0 ? deltaBonus : 0;
  const newEarnings = round8(prevEarnings + earningsDelta);

  if (!opts.allowNegative) {
    if (newUsdt < 0) {
      throw new Error(
        `adjustWallet: USDT 잔액 음수 불가 (uid=${uid}, prev=${prevUsdt}, delta=${deltaUSDT})`
      );
    }
    if (newBonus < 0) {
      throw new Error(
        `adjustWallet: bonus 잔액 음수 불가 (uid=${uid}, prev=${prevBonus}, delta=${deltaBonus})`
      );
    }
  }

  const fields: any = {
    usdtBalance: toFirestoreValue(newUsdt),
    bonusBalance: toFirestoreValue(newBonus),
    totalEarnings: toFirestoreValue(newEarnings),
  };
  const walletWrite = {
    update: {
      name: `${FIRESTORE_DOC_BASE}/wallets/${uid}`,
      fields,
    },
    updateMask: { fieldPaths: ['usdtBalance', 'bonusBalance', 'totalEarnings'] },
  };

  let bonusWrite: any = null;
  if (!opts.skipLedger) {
    const docId = crypto.randomUUID().replace(/-/g, '');
    bonusWrite = {
      update: {
        name: `${FIRESTORE_DOC_BASE}/bonuses/${docId}`,
        fields: {
          userId: toFirestoreValue(uid),
          type: toFirestoreValue(opts.type || 'admin_adjust'),
          deltaUSDT: toFirestoreValue(round8(deltaUSDT)),
          deltaBonus: toFirestoreValue(round8(deltaBonus)),
          amountUsdt: toFirestoreValue(round8(Math.abs(deltaBonus) || Math.abs(deltaUSDT))),
          reason: toFirestoreValue(reason),
          txRef: toFirestoreValue(txRef),
          prevUsdt: toFirestoreValue(prevUsdt),
          prevBonus: toFirestoreValue(prevBonus),
          newUsdt: toFirestoreValue(newUsdt),
          newBonus: toFirestoreValue(newBonus),
          source: toFirestoreValue('adjust_wallet'),
          createdAt: toFirestoreValue(new Date().toISOString()),
        },
      },
    };
  }

  if (opts.flushMode === 'batched') {
    if (!opts.batch) {
      throw new Error('adjustWallet: flushMode=batched 시 batch 옵션 필수');
    }
    opts.batch.push(walletWrite);
    if (bonusWrite) opts.batch.pushBonus(bonusWrite);
  } else {
    const writes = bonusWrite ? [walletWrite, bonusWrite] : [walletWrite];
    await fsBatchCommit(writes, adminToken);
  }

  return {
    uid,
    prevUsdt,
    prevBonus,
    prevEarnings,
    newUsdt,
    newBonus,
    newEarnings,
    deltaUSDT: round8(deltaUSDT),
    deltaBonus: round8(deltaBonus),
    reason,
    txRef,
  };
}
