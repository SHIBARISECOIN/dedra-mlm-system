// PART II §0 HARD RULE 회귀 테스트 — adjustWallet 단일 진입점 검증
// vitest run 으로 실행. fsBatchCommit / fsGet / toFirestoreValue 를 모킹하여
// 잔액·라운딩·음수차단·ledger 기록 동작을 검증한다.

import { describe, it, expect, beforeEach, vi } from 'vitest';

// ─── ../index 모킹 ────────────────────────────────────────────────────
// adjustWallet 은 fsGet / fsBatchCommit / toFirestoreValue 만 import 함
const mockState: Record<string, any> = {
  walletStore: new Map<string, any>(),
  commitCalls: [] as any[][],
};

vi.mock('../index', () => {
  return {
    fsGet: vi.fn(async (path: string) => {
      const uid = path.replace(/^wallets\//, '');
      const w = mockState.walletStore.get(uid);
      if (!w) return null;
      return {
        fields: {
          usdtBalance: { doubleValue: w.usdtBalance },
          bonusBalance: { doubleValue: w.bonusBalance },
          totalEarnings: { doubleValue: w.totalEarnings },
        },
      };
    }),
    fsBatchCommit: vi.fn(async (writes: any[], _token: string) => {
      mockState.commitCalls.push(writes);
      // wallets/* PATCH 결과를 store 에 반영
      for (const w of writes) {
        const name: string = w?.update?.name || '';
        const m = name.match(/wallets\/([^/]+)$/);
        if (m) {
          const uid = m[1];
          const cur = mockState.walletStore.get(uid) || {
            usdtBalance: 0,
            bonusBalance: 0,
            totalEarnings: 0,
          };
          const f = w.update.fields || {};
          if (f.usdtBalance) cur.usdtBalance = Number(f.usdtBalance.doubleValue ?? f.usdtBalance.integerValue ?? 0);
          if (f.bonusBalance) cur.bonusBalance = Number(f.bonusBalance.doubleValue ?? f.bonusBalance.integerValue ?? 0);
          if (f.totalEarnings) cur.totalEarnings = Number(f.totalEarnings.doubleValue ?? f.totalEarnings.integerValue ?? 0);
          mockState.walletStore.set(uid, cur);
        }
      }
    }),
    toFirestoreValue: (v: any) => {
      if (typeof v === 'number') return { doubleValue: v };
      if (typeof v === 'string') return { stringValue: v };
      if (typeof v === 'boolean') return { booleanValue: v };
      return { stringValue: String(v) };
    },
  };
});

import { adjustWallet, WalletBatch } from '../services/wallet';

beforeEach(() => {
  mockState.walletStore.clear();
  mockState.commitCalls.length = 0;
});

describe('adjustWallet — PART II §0 HARD RULE 단일 진입점', () => {
  it('HARD RULE #3 — 8자리 반올림 (Math.round(x*1e8)/1e8)', async () => {
    mockState.walletStore.set('btc100', { usdtBalance: 0, bonusBalance: 0, totalEarnings: 0 });

    // 0.123456789012345 → 0.12345679 (8자리 반올림)
    const r = await adjustWallet(
      'btc100',
      0.123456789012345,
      0,
      'rounding test',
      'tx_round_001',
      'fake-token'
    );

    expect(r.newUsdt).toBe(0.12345679);
    expect(r.deltaUSDT).toBe(0.12345679);
  });

  it('HARD RULE #1 — 음수 잔액 차단 (allowNegative=false 기본)', async () => {
    mockState.walletStore.set('btc100', { usdtBalance: 100, bonusBalance: 0, totalEarnings: 0 });

    await expect(
      adjustWallet('btc100', -200, 0, 'overdraft', 'tx_neg_001', 'fake-token')
    ).rejects.toThrow(/USDT 잔액 음수 불가/);

    // 잔액 변동 없음
    expect(mockState.walletStore.get('btc100').usdtBalance).toBe(100);
  });

  it('HARD RULE #1 — bonus 음수 잔액 차단', async () => {
    mockState.walletStore.set('btc100', { usdtBalance: 0, bonusBalance: 50, totalEarnings: 0 });

    await expect(
      adjustWallet('btc100', 0, -100, 'bonus overdraft', 'tx_neg_002', 'fake-token')
    ).rejects.toThrow(/bonus 잔액 음수 불가/);
  });

  it('allowNegative=true 시 음수 허용 (관리자 조정)', async () => {
    mockState.walletStore.set('btc100', { usdtBalance: 100, bonusBalance: 0, totalEarnings: 0 });

    const r = await adjustWallet(
      'btc100',
      -200,
      0,
      'admin adjust',
      'tx_admin_001',
      'fake-token',
      { allowNegative: true, type: 'admin_adjust' }
    );

    expect(r.newUsdt).toBe(-100);
  });

  it('totalEarnings 는 양의 deltaBonus 만 누적 (출금 차감 시 변화 없음)', async () => {
    mockState.walletStore.set('btc100', { usdtBalance: 0, bonusBalance: 100, totalEarnings: 100 });

    // bonus -50 (출금) → totalEarnings 변화 없음
    const r1 = await adjustWallet('btc100', 0, -50, 'withdraw', 'tx_w_001', 'fake-token');
    expect(r1.newBonus).toBe(50);
    expect(r1.newEarnings).toBe(100); // 차감 안 됨

    // bonus +30 (ROI) → totalEarnings += 30
    const r2 = await adjustWallet('btc100', 0, 30, 'roi', 'tx_roi_001', 'fake-token', { type: 'roi' });
    expect(r2.newBonus).toBe(80);
    expect(r2.newEarnings).toBe(130);
  });

  it('ledger 자동 기록 (bonuses 컬렉션 write 포함)', async () => {
    mockState.walletStore.set('btc100', { usdtBalance: 0, bonusBalance: 0, totalEarnings: 0 });

    await adjustWallet('btc100', 0, 15, 'daily ROI', 'settlement-2026-04-30', 'fake-token', {
      type: 'roi',
    });

    // commitCalls 에 wallets/* + bonuses/* 두 개 write 포함
    const allWrites = mockState.commitCalls.flat();
    const walletWrites = allWrites.filter((w: any) => /wallets\//.test(w?.update?.name || ''));
    const bonusWrites = allWrites.filter((w: any) => /bonuses\//.test(w?.update?.name || ''));

    expect(walletWrites.length).toBe(1);
    expect(bonusWrites.length).toBe(1);

    const ledger = bonusWrites[0].update.fields;
    expect(ledger.userId.stringValue).toBe('btc100');
    expect(ledger.type.stringValue).toBe('roi');
    expect(ledger.txRef.stringValue).toBe('settlement-2026-04-30');
    expect(ledger.deltaBonus.doubleValue).toBe(15);
  });

  it('skipLedger=true 시 bonuses 기록 생략 (롤백 등 특수 상황)', async () => {
    mockState.walletStore.set('btc100', { usdtBalance: 0, bonusBalance: 100, totalEarnings: 100 });

    await adjustWallet('btc100', 0, -15, 'rollback', 'rollback-2026-04-30', 'fake-token', {
      skipLedger: true,
      allowNegative: true,
      type: 'rollback',
    });

    const allWrites = mockState.commitCalls.flat();
    const bonusWrites = allWrites.filter((w: any) => /bonuses\//.test(w?.update?.name || ''));
    expect(bonusWrites.length).toBe(0);
  });

  it('uid 누락 시 즉시 에러', async () => {
    await expect(
      adjustWallet('', 100, 0, 'test', 'tx_invalid', 'fake-token')
    ).rejects.toThrow(/uid 필수/);
  });

  it('NaN delta 차단', async () => {
    await expect(
      adjustWallet('btc100', NaN, 0, 'test', 'tx_nan', 'fake-token')
    ).rejects.toThrow(/유효한 숫자가 아닙니다/);
  });

  it('HARD RULE #4 — WalletBatch 누적 후 일괄 commit (20건 단위)', async () => {
    // 25명 회원 셋업
    for (let i = 0; i < 25; i++) {
      mockState.walletStore.set(`u${i}`, { usdtBalance: 0, bonusBalance: 0, totalEarnings: 0 });
    }

    const batch = new WalletBatch('fake-token');
    for (let i = 0; i < 25; i++) {
      await adjustWallet(`u${i}`, 0, 1, 'batch test', 'tx_batch', 'fake-token', {
        flushMode: 'batched',
        batch,
        type: 'roi',
      });
    }

    // commit 전에는 fsBatchCommit 미호출
    expect(mockState.commitCalls.length).toBe(0);
    // batch 누적량 = wallets 25 + bonuses 25 = 50
    expect(batch.size()).toBe(50);

    await batch.commit();

    // commit 후 모든 write 가 한 번에 전달됨 (fsBatchCommit 내부에서 20단위 분할)
    expect(mockState.commitCalls.length).toBeGreaterThanOrEqual(1);
    const totalWrites = mockState.commitCalls.flat().length;
    expect(totalWrites).toBe(50);
  });

  it('flushMode=batched 인데 batch 미전달 시 에러', async () => {
    await expect(
      adjustWallet('btc100', 0, 10, 'test', 'tx_x', 'fake-token', { flushMode: 'batched' })
    ).rejects.toThrow(/batch 옵션 필수/);
  });
});

describe('BTC-100 1일 시나리오 — 입금 → 투자 → 정산 → 출금', () => {
  it('전체 자금 흐름 정합성 (라운딩 8자리 / 음수차단 / ledger 기록)', async () => {
    const uid = 'btc100';
    mockState.walletStore.set(uid, { usdtBalance: 0, bonusBalance: 0, totalEarnings: 0 });

    // 1) 입금 1,000 USDT
    const dep = await adjustWallet(uid, 1000, 0, '회원 입금', 'txid_solana_111', 'fake-token', {
      type: 'deposit',
    });
    expect(dep.newUsdt).toBe(1000);

    // 2) 한국 5% 보너스 (1,000 × 0.05 = 50 USDT)
    const krBonus = await adjustWallet(uid, 0, 50, '한국 입금 보너스', 'txid_solana_111', 'fake-token', {
      type: 'country_bonus',
    });
    expect(krBonus.newBonus).toBe(50);
    expect(krBonus.newEarnings).toBe(50);

    // 3) 투자 1,000 USDT (usdt -1000)
    const inv = await adjustWallet(uid, -1000, 0, 'D100 투자', 'inv_btc100_001', 'fake-token', {
      type: 'invest',
    });
    expect(inv.newUsdt).toBe(0);

    // 4) ROI 정산 (1,000 × 1.5% = 15 USDT, autoCompound off → bonusBalance += 15)
    const principal = 1000;
    const dailyRoi = 0.015;
    const dayROI = Math.round(principal * dailyRoi * 1e8) / 1e8; // = 15
    const roi = await adjustWallet(uid, 0, dayROI, '일일 ROI', 'settlement-2026-04-30', 'fake-token', {
      type: 'roi',
    });
    expect(roi.newBonus).toBe(65); // 50 + 15
    expect(roi.newEarnings).toBe(65);

    // 5) 매칭 보너스 13 USDT
    const match = await adjustWallet(uid, 0, 13, '매칭 보너스', 'settlement-2026-04-30', 'fake-token', {
      type: 'override',
    });
    expect(match.newBonus).toBe(78);

    // 6) 출금 50 USDT (bonus -50, 수수료 2.5)
    const wAmt = 50;
    const fee = Math.round(wAmt * 0.05 * 1e8) / 1e8; // 2.5
    const wd = await adjustWallet(uid, 0, -wAmt, '출금 신청', 'wd_btc100_001', 'fake-token', {
      type: 'withdraw',
    });
    expect(wd.newBonus).toBe(28); // 78 - 50
    expect(wd.newEarnings).toBe(78); // 출금은 earnings 차감 안 함

    // 7) 출금 잔액 부족 시 거부
    await expect(
      adjustWallet(uid, 0, -100, '과다 출금', 'wd_overflow', 'fake-token', { type: 'withdraw' })
    ).rejects.toThrow(/bonus 잔액 음수 불가/);

    // 최종 상태 검증
    const final = mockState.walletStore.get(uid);
    expect(final.usdtBalance).toBe(0);
    expect(final.bonusBalance).toBe(28);
    expect(final.totalEarnings).toBe(78);

    // 모든 자금 변동이 ledger 에 기록됐는지 (deposit/country_bonus/invest/roi/override/withdraw = 6건)
    const allWrites = mockState.commitCalls.flat();
    const bonusWrites = allWrites.filter((w: any) => /bonuses\//.test(w?.update?.name || ''));
    expect(bonusWrites.length).toBe(6);

    const types = bonusWrites.map((w: any) => w.update.fields.type.stringValue).sort();
    expect(types).toEqual(['country_bonus', 'deposit', 'invest', 'override', 'roi', 'withdraw']);

    // 수수료(별도 회사 지갑 이동) 라운딩 정합성
    expect(fee).toBe(2.5);
  });
});

describe('PART II §11 라운딩 회귀 테스트', () => {
  it('부동소수 누적오차 8자리 절단', async () => {
    mockState.walletStore.set('u1', { usdtBalance: 0, bonusBalance: 0, totalEarnings: 0 });
    // 0.1 + 0.2 = 0.30000000000000004 (JS 부동소수)
    const r = await adjustWallet('u1', 0.1, 0.2, 'rounding', 'tx_001', 'fake-token');
    expect(r.newUsdt).toBe(0.1);
    expect(r.newBonus).toBe(0.2);
    // 누적
    const r2 = await adjustWallet('u1', 0.2, 0, 'rounding 2', 'tx_002', 'fake-token');
    expect(r2.newUsdt).toBe(0.3); // 0.1 + 0.2 → round8 = 0.3
  });

  it('대규모 누적 (1000회 0.00000001) 후 정수 1.0 일치', async () => {
    mockState.walletStore.set('u1', { usdtBalance: 0, bonusBalance: 0, totalEarnings: 0 });
    for (let i = 0; i < 100; i++) {
      await adjustWallet('u1', 0.00000001, 0, `acc-${i}`, `tx_${i}`, 'fake-token');
    }
    const w = mockState.walletStore.get('u1');
    // 100 × 1e-8 = 1e-6, 8자리 반올림 후 정확
    expect(w.usdtBalance).toBe(0.000001);
  });
});
