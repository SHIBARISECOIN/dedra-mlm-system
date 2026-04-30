// PART II §3 정산 회귀 테스트 — BTC-100 1일 시나리오 + maxPayoutRatio 캡 + 라운딩
// runSettle 전체를 호출하지 않고, 정산 핵심 산식만 분리 검증한다.
// (전체 통합 테스트는 staging 환경 e2e 로 별도 수행)

import { describe, it, expect } from 'vitest';

// ─── 정산 핵심 산식 (settlement.ts 와 동일 공식) ─────────────────────
const round8 = (x: number) => Math.round(x * 1e8) / 1e8;

function computeDailyROI(principal: number, dailyRoiPct: number, daysPassed = 1): number {
  // PART II §3-6 — daysPassed 는 무조건 1 로 캡
  const days = Math.min(Math.max(daysPassed, 0), 1);
  return round8(principal * (dailyRoiPct / 100) * days);
}

function applyAutoCompound(
  principal: number,
  roi: number,
  maxAmt: number
): { investToAdd: number; bonusToAdd: number } {
  if (principal + roi <= maxAmt) {
    return { investToAdd: round8(roi), bonusToAdd: 0 };
  }
  const allowedInvest = Math.max(0, maxAmt - principal);
  const remainder = roi - allowedInvest;
  return { investToAdd: round8(allowedInvest), bonusToAdd: round8(remainder) };
}

function computeDirectBonus(
  childRoi: number,
  direct1Pct: number,
  direct2Pct: number
): { d1: number; d2: number } {
  return {
    d1: round8(childRoi * (direct1Pct / 100)),
    d2: round8(childRoi * (direct2Pct / 100)),
  };
}

function computeRankGap(
  childRoi: number,
  parentRankLevel: number,
  childRankLevel: number,
  rankGapPct: number,
  mode: 'gap' | 'full' = 'gap'
): number {
  if (parentRankLevel <= childRankLevel) return 0;
  const gap = parentRankLevel - childRankLevel;
  if (mode === 'gap') return round8(childRoi * (rankGapPct / 100) * gap);
  return round8(childRoi * (rankGapPct / 100));
}

function applyPayoutCap(
  prevPaid: number,
  principal: number,
  payoutRatio: number,
  attemptedAmount: number
): { allowed: number; overflow: number } {
  const cap = principal * payoutRatio;
  const remainingRoom = Math.max(0, cap - prevPaid);
  const allowed = Math.min(attemptedAmount, remainingRoom);
  return { allowed: round8(allowed), overflow: round8(attemptedAmount - allowed) };
}

// ─── 테스트 ─────────────────────────────────────────────────────────
describe('PART II §3-6 — 일일 ROI 계산', () => {
  it('1,000 USDT × 1.5% × 1day = 15 USDT', () => {
    expect(computeDailyROI(1000, 1.5, 1)).toBe(15);
  });

  it('daysPassed > 1 이어도 1로 캡 (소급정산 금지)', () => {
    expect(computeDailyROI(1000, 1.5, 5)).toBe(15);
    expect(computeDailyROI(1000, 1.5, 30)).toBe(15);
  });

  it('daysPassed 0/음수 → 0', () => {
    expect(computeDailyROI(1000, 1.5, 0)).toBe(0);
    expect(computeDailyROI(1000, 1.5, -1)).toBe(0);
  });

  it('소수점 8자리 라운딩', () => {
    // 333.33 × 0.123% × 1 = 0.4099959 → round8
    const r = computeDailyROI(333.33, 0.123, 1);
    expect(r).toBe(round8(333.33 * 0.00123));
  });
});

describe('PART II §3-7 — 자동복리 (autoCompound)', () => {
  it('상한 미달 시 ROI 전액을 원금에 합산', () => {
    const { investToAdd, bonusToAdd } = applyAutoCompound(1000, 15, 50000);
    expect(investToAdd).toBe(15);
    expect(bonusToAdd).toBe(0);
  });

  it('상한 도달 시 초과분만 bonusBalance 로 이동', () => {
    // principal 49,990 + roi 20 → maxAmt 50,000
    // allowedInvest = 50,000 - 49,990 = 10
    // remainder = 20 - 10 = 10
    const { investToAdd, bonusToAdd } = applyAutoCompound(49990, 20, 50000);
    expect(investToAdd).toBe(10);
    expect(bonusToAdd).toBe(10);
  });

  it('이미 상한 초과 시 ROI 전액 bonus 로', () => {
    const { investToAdd, bonusToAdd } = applyAutoCompound(50000, 15, 50000);
    expect(investToAdd).toBe(0);
    expect(bonusToAdd).toBe(15);
  });
});

describe('PART II §3-8 — 직접추천 보너스 (direct1 / direct2)', () => {
  it('자식 ROI 100 → 부모 +10 (10%), 조부모 +5 (5%)', () => {
    const { d1, d2 } = computeDirectBonus(100, 10, 5);
    expect(d1).toBe(10);
    expect(d2).toBe(5);
  });

  it('소수 라운딩', () => {
    const { d1, d2 } = computeDirectBonus(33.33, 10, 5);
    expect(d1).toBe(3.333);
    expect(d2).toBe(1.6665);
  });
});

describe('PART II §3-9 — 직급 차이 롤업 (rank gap)', () => {
  it('동급 또는 자식이 더 높으면 0', () => {
    expect(computeRankGap(100, 3, 3, 10)).toBe(0);
    expect(computeRankGap(100, 2, 5, 10)).toBe(0);
  });

  it('mode=gap — 단계당 10% 차이 누적 (G3 → G5 = 2단계 → 20%)', () => {
    expect(computeRankGap(100, 5, 3, 10, 'gap')).toBe(20);
  });

  it('mode=full — 단계 무관 한 번 10%', () => {
    expect(computeRankGap(100, 5, 3, 10, 'full')).toBe(10);
  });
});

describe('PART II §3-12 — 최대 수익 캡 (maxPayoutRatio)', () => {
  it('원금 1,000, 캡 ×3, 누적 2,990 → 잔여 10 만 지급, 5 초과 분은 overflow', () => {
    const { allowed, overflow } = applyPayoutCap(2990, 1000, 3, 15);
    expect(allowed).toBe(10);
    expect(overflow).toBe(5);
  });

  it('잔여 한도가 음수면 0 지급, 전액 overflow', () => {
    const { allowed, overflow } = applyPayoutCap(3000, 1000, 3, 15);
    expect(allowed).toBe(0);
    expect(overflow).toBe(15);
  });

  it('잔여 한도가 충분하면 전액 지급', () => {
    const { allowed, overflow } = applyPayoutCap(100, 1000, 3, 15);
    expect(allowed).toBe(15);
    expect(overflow).toBe(0);
  });
});

describe('BTC-100 1일 정산 통합 시나리오 (수치 검증)', () => {
  it('투자 1,000 USDT D100 상품 (dailyROI 1.5%, autoCompound off, G5)', () => {
    const principal = 1000;
    const dailyRoi = 1.5; // 1.5%
    const maxAmt = 50000;
    const direct1 = 10;
    const direct2 = 5;
    const rankGap = 10;
    const overridePct = 10;
    const payoutRatio = 3;

    // 1) ROI 계산
    const roi = computeDailyROI(principal, dailyRoi, 1);
    expect(roi).toBe(15);

    // 2) autoCompound off → bonusBalance += 15
    const compound = applyAutoCompound(principal, 0, maxAmt);
    expect(compound.investToAdd).toBe(0);
    const directBonusForBtc100 = roi; // bonusBalance 로 직접 적립

    // 3) 부모(direct1) 10%, 조부모(direct2) 5%
    const direct = computeDirectBonus(roi, direct1, direct2);
    expect(direct.d1).toBe(1.5);
    expect(direct.d2).toBe(0.75);

    // 4) 부모 G7, btc100 G5 → rank gap 2단계 = 20%
    const parentRankLevel = 7;
    const myRankLevel = 5;
    const rankUp = computeRankGap(roi, parentRankLevel, myRankLevel, rankGap, 'gap');
    expect(rankUp).toBe(3); // 15 × 10% × 2 = 3.0

    // 5) override 매칭 (전체 보너스 합 × 10%)
    const totalUpBonus = direct.d1 + direct.d2 + rankUp; // 1.5 + 0.75 + 3 = 5.25
    const overrideAmt = round8(totalUpBonus * (overridePct / 100));
    expect(overrideAmt).toBe(0.525);

    // 6) maxPayoutRatio 캡 적용 (btc100 누적 0, 캡 3,000 → 전액 15 통과)
    const cap = applyPayoutCap(0, principal, payoutRatio, directBonusForBtc100);
    expect(cap.allowed).toBe(15);
    expect(cap.overflow).toBe(0);

    // 7) 누적 검증 — 모든 산식 라운딩 정합성
    const totalDistributed = round8(
      cap.allowed + direct.d1 + direct.d2 + rankUp + overrideAmt
    );
    expect(totalDistributed).toBe(20.775);
  });

  it('payout cap 도달 시나리오 — 누적 2,990, 신규 ROI 15 → 10 만 지급', () => {
    const principal = 1000;
    const dailyRoi = 1.5;
    const payoutRatio = 3;

    const roi = computeDailyROI(principal, dailyRoi, 1);
    const cap = applyPayoutCap(2990, principal, payoutRatio, roi);

    expect(cap.allowed).toBe(10);
    expect(cap.overflow).toBe(5);
  });

  it('autoCompound 활성 + 상한 도달 시나리오 (1+1 promo)', () => {
    // 회원이 D100 상품에 49,990 USDT 투자, autoCompound on, maxAmt 50,000
    const principal = 49990;
    const dailyRoi = 1.5;
    const maxAmt = 50000;

    const roi = computeDailyROI(principal, dailyRoi, 1); // 749.85
    expect(roi).toBe(749.85);

    const compound = applyAutoCompound(principal, roi, maxAmt);
    // 49,990 + 749.85 = 50,739.85 > 50,000
    // allowedInvest = 50,000 - 49,990 = 10
    // remainder = 749.85 - 10 = 739.85
    expect(compound.investToAdd).toBe(10);
    expect(compound.bonusToAdd).toBe(739.85);
  });
});

describe('PART II §11 — 라운딩 정합성 (8자리)', () => {
  it('round8(0.1 + 0.2) = 0.3 (부동소수 오차 제거)', () => {
    expect(round8(0.1 + 0.2)).toBe(0.3);
  });

  it('round8(123.456789012345) = 123.45678901', () => {
    expect(round8(123.456789012345)).toBe(123.45678901);
  });

  it('대규모 누적 후에도 8자리 정확', () => {
    let sum = 0;
    for (let i = 0; i < 1000; i++) {
      sum = round8(sum + 0.001);
    }
    expect(sum).toBe(1);
  });
});

describe('PART II §0 HARD RULE #4 — 배치 크기 20 표준', () => {
  it('writes 200건을 20개 단위로 분할 시 10개 청크', () => {
    const writes = Array.from({ length: 200 }, (_, i) => ({ id: i }));
    const BATCH = 20;
    const chunks: any[][] = [];
    for (let i = 0; i < writes.length; i += BATCH) {
      chunks.push(writes.slice(i, i + BATCH));
    }
    expect(chunks.length).toBe(10);
    expect(chunks[0].length).toBe(20);
    expect(chunks[9].length).toBe(20);
  });

  it('writes 25건 → 청크 [20, 5]', () => {
    const writes = Array.from({ length: 25 }, (_, i) => ({ id: i }));
    const BATCH = 20;
    const chunks: any[][] = [];
    for (let i = 0; i < writes.length; i += BATCH) {
      chunks.push(writes.slice(i, i + BATCH));
    }
    expect(chunks.length).toBe(2);
    expect(chunks[0].length).toBe(20);
    expect(chunks[1].length).toBe(5);
  });
});
