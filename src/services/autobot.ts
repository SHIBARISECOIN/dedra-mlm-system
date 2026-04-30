// src/services/autobot.ts
// 오토봇 트레이딩 콘솔 백엔드 헬퍼
// — 시세 통합 / 솔라나 잔고 / Jupiter 견적 / 봇 활동 로그 / AI 시그널

import {
  fsGet,
  fsSet,
  fsPatch,
  fsCreate,
  fsQuery,
  toFirestoreValue,
  firestoreDocToObj,
} from '../index';

// ─── 토큰 메타 ─────────────────────────────────────────────────────
export const TOKEN_META: Record<string, { mint: string; decimals: number; name: string }> = {
  SOL:  { mint: 'So11111111111111111111111111111111111111112', decimals: 9, name: 'Solana' },
  USDT: { mint: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', decimals: 6, name: 'Tether USD' },
  USDC: { mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', decimals: 6, name: 'USD Coin' },
  DDRA: { mint: 'DDRADez92SA7jLhzL2bjBkWBK9idqvrhX1CuAZFaAgyv', decimals: 6, name: 'DEEDRA' },
};

const round8 = (x: number) => Math.round(x * 1e8) / 1e8;

// ─── 솔라나 RPC 폴백 헬퍼 ─────────────────────────────────────────
const SOL_RPCS = [
  'https://solana-rpc.publicnode.com',
  'https://api.mainnet-beta.solana.com',
  'https://solana.api.onfinality.io/public',
  'https://rpc.ankr.com/solana',
];

export async function solanaRpc(method: string, params: any[], timeoutMs = 6000): Promise<any> {
  let lastErr: any = null;
  for (const url of SOL_RPCS) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!res.ok) {
        lastErr = new Error(`HTTP ${res.status} @ ${url}`);
        continue;
      }
      const json: any = await res.json();
      if (json.error) {
        lastErr = new Error(json.error.message || 'rpc error');
        continue;
      }
      return json.result;
    } catch (e: any) {
      lastErr = e;
    }
  }
  throw lastErr || new Error('all_rpcs_failed');
}

// ─── 솔라나 지갑 잔고 (SOL + 모든 SPL 토큰) ────────────────────
export async function getSolanaWalletBalances(pubkey: string): Promise<{
  pubkey: string;
  sol: number;
  usdt: number;
  usdc: number;
  ddra: number;
  others: { mint: string; amount: number }[];
}> {
  const result = {
    pubkey,
    sol: 0,
    usdt: 0,
    usdc: 0,
    ddra: 0,
    others: [] as { mint: string; amount: number }[],
  };

  try {
    const solBal = await solanaRpc('getBalance', [pubkey]);
    result.sol = (solBal?.value || 0) / 1e9;
  } catch (_) { /* keep 0 */ }

  try {
    const tokens = await solanaRpc('getTokenAccountsByOwner', [
      pubkey,
      { programId: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' },
      { encoding: 'jsonParsed' },
    ]);
    const list = tokens?.value || [];
    for (const item of list) {
      const info = item?.account?.data?.parsed?.info;
      if (!info) continue;
      const mint = info.mint;
      const amount = Number(info.tokenAmount?.uiAmount || 0);
      if (mint === TOKEN_META.USDT.mint) result.usdt = amount;
      else if (mint === TOKEN_META.USDC.mint) result.usdc = amount;
      else if (mint === TOKEN_META.DDRA.mint) result.ddra = amount;
      else if (amount > 0) result.others.push({ mint, amount });
    }
  } catch (_) { /* keep 0 */ }

  return result;
}

// ─── 시세 통합: DexScreener 우선, GeckoTerminal/Jupiter 폴백 ──
export interface PriceTick {
  symbol: string;
  price: number;
  priceChange24h: number;
  volume24h: number;
  liquidity: number;
  marketCap?: number;
  fdv?: number;
  source: string;
  updatedAt: number;
}

export async function fetchPriceForMint(mint: string, symbol: string): Promise<PriceTick | null> {
  // 1) DexScreener
  try {
    const r = await fetch(`https://api.dexscreener.com/tokens/v1/solana/${mint}`, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(6000),
    });
    if (r.ok) {
      const data: any = await r.json();
      const pairs: any[] = Array.isArray(data) ? data : (data.pairs || []);
      if (pairs.length) {
        pairs.sort((a, b) => (b.volume?.h24 || 0) - (a.volume?.h24 || 0));
        const best = pairs[0];
        const price = parseFloat(best.priceUsd || '0');
        if (price > 0) {
          return {
            symbol,
            price,
            priceChange24h: best.priceChange?.h24 || 0,
            volume24h: best.volume?.h24 || 0,
            liquidity: best.liquidity?.usd || 0,
            marketCap: best.marketCap || 0,
            fdv: best.fdv || 0,
            source: 'dexscreener',
            updatedAt: Date.now(),
          };
        }
      }
    }
  } catch (_) { /* fallback */ }

  // 2) GeckoTerminal
  try {
    const r = await fetch(`https://api.geckoterminal.com/api/v2/networks/solana/tokens/${mint}`, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(6000),
    });
    if (r.ok) {
      const data: any = await r.json();
      const attrs = data?.data?.attributes;
      if (attrs && parseFloat(attrs.price_usd || '0') > 0) {
        return {
          symbol,
          price: parseFloat(attrs.price_usd),
          priceChange24h: attrs.price_change_percentage?.h24 || 0,
          volume24h: attrs.volume_usd?.h24 || 0,
          liquidity: 0,
          marketCap: parseFloat(attrs.market_cap_usd || '0'),
          fdv: parseFloat(attrs.fdv_usd || '0'),
          source: 'geckoterminal',
          updatedAt: Date.now(),
        };
      }
    }
  } catch (_) { /* fallback */ }

  // 3) Jupiter
  try {
    const r = await fetch(`https://api.jup.ag/price/v2?ids=${mint}`, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(6000),
    });
    if (r.ok) {
      const data: any = await r.json();
      const tokenData = data.data?.[mint];
      if (tokenData && parseFloat(tokenData.price || '0') > 0) {
        return {
          symbol,
          price: parseFloat(tokenData.price),
          priceChange24h: 0,
          volume24h: 0,
          liquidity: 0,
          source: 'jupiter',
          updatedAt: Date.now(),
        };
      }
    }
  } catch (_) { /* none */ }

  return null;
}

// ─── 멀티 토큰 시세 일괄 조회 (병렬) ──────────────────────────
export async function fetchMultiTokenPrices(symbols: string[]): Promise<Record<string, PriceTick | null>> {
  const out: Record<string, PriceTick | null> = {};
  await Promise.all(
    symbols.map(async (sym) => {
      const meta = TOKEN_META[sym];
      if (!meta) { out[sym] = null; return; }
      out[sym] = await fetchPriceForMint(meta.mint, sym);
    })
  );
  return out;
}

// ─── BTC/ETH 등 CEX 시세 (CoinGecko) ──────────────────────────
export async function fetchCoinGeckoPrices(ids: string[]): Promise<Record<string, { price: number; change24h: number; volume24h: number; marketCap: number }>> {
  const out: Record<string, any> = {};
  try {
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids.join(',')}&vs_currencies=usd&include_24hr_change=true&include_24hr_vol=true&include_market_cap=true`;
    const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (r.ok) {
      const data: any = await r.json();
      for (const id of ids) {
        const d = data[id];
        if (d) {
          out[id] = {
            price: d.usd || 0,
            change24h: d.usd_24h_change || 0,
            volume24h: d.usd_24h_vol || 0,
            marketCap: d.usd_market_cap || 0,
          };
        }
      }
    }
  } catch (_) { /* empty */ }
  return out;
}

// ─── Jupiter 스왑 견적 (실행 없이 슬리피지·라우팅 미리보기) ─
export async function getJupiterQuote(
  fromSymbol: string,
  toSymbol: string,
  amountUi: number,
  slippageBps = 100
): Promise<any> {
  const inMeta = TOKEN_META[fromSymbol];
  const outMeta = TOKEN_META[toSymbol];
  if (!inMeta || !outMeta) throw new Error('알 수 없는 토큰 심볼');
  const amountLamports = Math.floor(amountUi * Math.pow(10, inMeta.decimals));
  const url = `https://api.jup.ag/swap/v1/quote?inputMint=${inMeta.mint}&outputMint=${outMeta.mint}&amount=${amountLamports}&slippageBps=${slippageBps}`;
  const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!r.ok) throw new Error(`Jupiter HTTP ${r.status}`);
  const q: any = await r.json();
  if (q.error) throw new Error('Jupiter quote error: ' + q.error);

  const inAmount = Number(q.inAmount || 0) / Math.pow(10, inMeta.decimals);
  const outAmount = Number(q.outAmount || 0) / Math.pow(10, outMeta.decimals);
  const otherAmountThreshold = Number(q.otherAmountThreshold || 0) / Math.pow(10, outMeta.decimals);
  const priceImpactPct = parseFloat(q.priceImpactPct || '0');

  return {
    inSymbol: fromSymbol,
    outSymbol: toSymbol,
    inAmount,
    outAmount,
    minOutAmount: otherAmountThreshold,
    priceImpactPct,
    slippageBps,
    route: (q.routePlan || []).map((step: any) => step?.swapInfo?.label).filter(Boolean),
    rate: outAmount > 0 && inAmount > 0 ? round8(outAmount / inAmount) : 0,
    raw: q,
  };
}

// ─── 봇 활동 로그 (botActivities 컬렉션) ────────────────────
export async function logBotActivity(
  adminToken: string,
  data: {
    type: 'trade_buy' | 'trade_sell' | 'deposit' | 'withdraw' | 'config_change' | 'signal' | 'error' | 'info' | 'manual_trade' | 'strategy_run';
    severity?: 'info' | 'warning' | 'error' | 'success';
    message: string;
    detail?: any;
    txid?: string;
    amount?: number;
    symbol?: string;
    actor?: string;
  }
): Promise<void> {
  try {
    await fsCreate('botActivities', {
      type: data.type,
      severity: data.severity || 'info',
      message: data.message,
      detail: data.detail ? JSON.stringify(data.detail).slice(0, 2000) : null,
      txid: data.txid || null,
      amount: data.amount != null ? round8(data.amount) : null,
      symbol: data.symbol || null,
      actor: data.actor || 'admin',
      createdAt: new Date().toISOString(),
    }, adminToken);
  } catch (e) {
    console.error('[autobot] logBotActivity failed', e);
  }
}

export async function listBotActivities(adminToken: string, limit = 50): Promise<any[]> {
  try {
    // fsQuery 가 orderBy 미지원이므로 최근 N×3 가져와 createdAt 내림차순 후 자르기
    const items = await fsQuery('botActivities', adminToken, [], Math.min(500, limit * 5));
    const sorted = (items || []).sort((a: any, b: any) => {
      const ta = new Date(a.createdAt || 0).getTime();
      const tb = new Date(b.createdAt || 0).getTime();
      return tb - ta;
    });
    return sorted.slice(0, limit);
  } catch (e) {
    console.error('[autobot] listBotActivities failed', e);
    return [];
  }
}

// ─── 간단한 AI 시그널: 가격 변화/유동성/거래량 기반 추천 ────
export interface AiSignal {
  action: 'BUY_STRONG' | 'BUY' | 'HOLD' | 'SELL' | 'SELL_STRONG';
  score: number; // -100 ~ +100
  reason: string[];
  confidence: number; // 0~1
  suggestedAmount: number;
  suggestedSlippageBps: number;
}

export function computeAiSignal(tick: PriceTick | null, botSettings: any): AiSignal {
  const reasons: string[] = [];
  let score = 0;

  if (!tick) {
    return {
      action: 'HOLD',
      score: 0,
      reason: ['시세 데이터 없음'],
      confidence: 0,
      suggestedAmount: 0,
      suggestedSlippageBps: 200,
    };
  }

  // 1) 24시간 가격 변화율
  const ch = tick.priceChange24h || 0;
  if (ch < -10) { score += 35; reasons.push(`24h ${ch.toFixed(2)}% 급락 → 저점 매수 기회`); }
  else if (ch < -5) { score += 20; reasons.push(`24h ${ch.toFixed(2)}% 하락 → 매수 우위`); }
  else if (ch < -2) { score += 10; reasons.push(`24h ${ch.toFixed(2)}% 약세 → 분할 매수 권장`); }
  else if (ch > 10) { score -= 30; reasons.push(`24h +${ch.toFixed(2)}% 급등 → 차익실현 권장`); }
  else if (ch > 5) { score -= 15; reasons.push(`24h +${ch.toFixed(2)}% 상승 → 매도 경계`); }
  else { reasons.push(`24h ${ch.toFixed(2)}% 보합 → 횡보 구간`); }

  // 2) 유동성 점수
  if (tick.liquidity > 1_000_000) { score += 5; reasons.push(`유동성 양호 ($${(tick.liquidity / 1000).toFixed(1)}K)`); }
  else if (tick.liquidity > 100_000) { reasons.push(`유동성 보통`); }
  else if (tick.liquidity > 0) { score -= 10; reasons.push(`⚠️ 저유동성 — 슬리피지 주의`); }

  // 3) 봇 설정의 목표 상승률 대비 갭
  const target = Number(botSettings?.targetGrowthPct || 0);
  if (target > 0 && ch < target) {
    score += Math.min(20, (target - ch) * 2);
    reasons.push(`목표 ${target}% 미달 → 매수 비중 확대`);
  }

  // 4) 봇 매도 혼합 확률 가중치
  const sellProb = Number(botSettings?.sellProbability || 0);
  if (sellProb > 50) { score -= 5; reasons.push(`매도 혼합 비율 ${sellProb}% — 매도 비중 반영`); }

  // 점수 → 액션 매핑
  let action: AiSignal['action'] = 'HOLD';
  if (score >= 40) action = 'BUY_STRONG';
  else if (score >= 15) action = 'BUY';
  else if (score <= -25) action = 'SELL_STRONG';
  else if (score <= -10) action = 'SELL';

  // 추천 금액 (봇 설정의 min/max 사이에서 score 비례)
  const minAmt = Number(botSettings?.minAmount || 1);
  const maxAmt = Number(botSettings?.maxAmount || 10);
  const intensity = Math.min(1, Math.abs(score) / 50);
  const suggestedAmount = round8(minAmt + (maxAmt - minAmt) * intensity);

  // 슬리피지: 가격 변동성과 유동성을 반영
  let slip = 100; // 1% 기본
  if (Math.abs(ch) > 10) slip = 300;
  else if (Math.abs(ch) > 5) slip = 200;
  if (tick.liquidity < 50_000) slip += 100;

  return {
    action,
    score: Math.max(-100, Math.min(100, score)),
    reason: reasons,
    confidence: Math.min(1, Math.abs(score) / 60),
    suggestedAmount,
    suggestedSlippageBps: Math.min(500, slip),
  };
}

// ─── 그리드 트레이딩 격자 계산 ───────────────────────────────
export interface GridLevel {
  index: number;
  price: number;
  side: 'BUY' | 'SELL';
  amount: number;
}

export function buildGridLevels(opts: {
  centerPrice: number;
  upperPrice: number;
  lowerPrice: number;
  gridCount: number;
  totalCapital: number;
}): GridLevel[] {
  const { centerPrice, upperPrice, lowerPrice, gridCount, totalCapital } = opts;
  if (gridCount < 2 || upperPrice <= lowerPrice || centerPrice <= 0) return [];
  const step = (upperPrice - lowerPrice) / (gridCount - 1);
  const perLevel = totalCapital / gridCount;
  const levels: GridLevel[] = [];
  for (let i = 0; i < gridCount; i++) {
    const price = round8(lowerPrice + step * i);
    const side: 'BUY' | 'SELL' = price <= centerPrice ? 'BUY' : 'SELL';
    levels.push({
      index: i,
      price,
      side,
      amount: round8(perLevel),
    });
  }
  return levels;
}

// ─── DCA 스케줄 계산 ────────────────────────────────────────
export interface DcaPlan {
  index: number;
  scheduledAt: string;
  amountUsdt: number;
}

export function buildDcaPlan(opts: {
  totalCapital: number;
  steps: number;
  intervalMins: number;
  startAt?: number;
}): DcaPlan[] {
  const { totalCapital, steps, intervalMins, startAt = Date.now() } = opts;
  if (steps < 1 || totalCapital <= 0 || intervalMins <= 0) return [];
  const per = round8(totalCapital / steps);
  const out: DcaPlan[] = [];
  for (let i = 0; i < steps; i++) {
    out.push({
      index: i,
      scheduledAt: new Date(startAt + i * intervalMins * 60000).toISOString(),
      amountUsdt: per,
    });
  }
  return out;
}

// ─── 봇 설정 기본값 (확장된 스펙) ────────────────────────────
export const AUTOBOT_DEFAULTS_FULL = {
  enabled: false,
  targetGrowthPct: 5,
  baseTimeHour: 0,
  baseTimeMinute: 0,
  minAmount: 1,
  maxAmount: 10,
  tradeToken: 'USDT',
  minWaitMins: 5,
  maxWaitMins: 20,
  sellProbability: 0,
  // 신규 확장 필드
  strategy: 'natural', // natural | grid | dca | ai_adaptive
  slippageBps: 100,
  prioritizationFee: 'auto',
  maxDailyVolume: 1000,    // 일 최대 거래량 (USDT)
  maxDailyTrades: 50,      // 일 최대 거래 횟수
  stopLossPct: 0,          // 0이면 비활성
  takeProfitPct: 0,
  pauseOnSpike: true,      // 5분 내 ±5% 이상 변동 시 일시정지
  spikeThresholdPct: 5,
  walletAddress: '',       // 트레이딩용 솔라나 지갑 주소
  // 그리드 전략 설정
  grid: {
    enabled: false,
    upperPrice: 0,
    lowerPrice: 0,
    gridCount: 10,
    totalCapital: 0,
  },
  // DCA 전략 설정
  dca: {
    enabled: false,
    totalCapital: 0,
    steps: 10,
    intervalMins: 60,
  },
  // 알림
  alerts: {
    onTrade: true,
    onError: true,
    onPriceSpike: true,
    telegramChatId: '',
  },
};

// ─── 봇 24시간 거래 통계 (일일 한도 추적) ────────────────────
export async function getBotDailyStats(adminToken: string): Promise<{
  tradesToday: number;
  volumeToday: number;
  pnlToday: number;
  lastTradeAt: string | null;
}> {
  try {
    const acts = await listBotActivities(adminToken, 200);
    const since = Date.now() - 24 * 3600 * 1000;
    let trades = 0;
    let volume = 0;
    let pnl = 0;
    let lastTradeAt: string | null = null;
    for (const a of acts) {
      const t = new Date(a.createdAt || 0).getTime();
      if (t < since) continue;
      if (a.type === 'trade_buy' || a.type === 'trade_sell' || a.type === 'manual_trade') {
        trades++;
        volume += Number(a.amount || 0);
        if (a.type === 'trade_sell') pnl += Number(a.amount || 0);
        else pnl -= Number(a.amount || 0);
        if (!lastTradeAt) lastTradeAt = a.createdAt;
      }
    }
    return {
      tradesToday: trades,
      volumeToday: round8(volume),
      pnlToday: round8(pnl),
      lastTradeAt,
    };
  } catch (e) {
    return { tradesToday: 0, volumeToday: 0, pnlToday: 0, lastTradeAt: null };
  }
}

// ════════════════════════════════════════════════════════════════════
// 확장 헬퍼 (2026-04-30 추가)
// — 캔들 히스토리 / 기술지표 / 비상정지 / 자동 사이클 / 프리셋 / 알림
// ════════════════════════════════════════════════════════════════════

// ─── 가격 캔들 히스토리 (DexScreener 페어 기반) ───────────────────
export interface Candle {
  t: number;       // ms epoch
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

// DexScreener 는 일부 페어에 대해 무료 캔들 API 를 노출하지 않으므로,
// 우리는 botPriceTicks 컬렉션에 5분마다 누적되는 PriceTick 들을 캔들로 집계한다.
export async function fetchPriceHistory(adminToken: string, symbol: string, limit = 96): Promise<Candle[]> {
  try {
    const items = await fsQuery('botPriceTicks', adminToken, [
      { fieldFilter: { field: { fieldPath: 'symbol' }, op: 'EQUAL', value: { stringValue: symbol } } }
    ], Math.min(2000, limit * 12));
    const sorted = (items || []).map((x: any) => ({
      t: new Date(x.createdAt || 0).getTime(),
      p: Number(x.price || 0),
      v: Number(x.volume24h || 0),
    })).filter((x: any) => x.t > 0 && x.p > 0).sort((a: any, b: any) => a.t - b.t);

    // 5분봉으로 집계
    const bucketMs = 5 * 60 * 1000;
    const buckets = new Map<number, Candle>();
    for (const tick of sorted) {
      const k = Math.floor(tick.t / bucketMs) * bucketMs;
      const cur = buckets.get(k);
      if (!cur) {
        buckets.set(k, { t: k, o: tick.p, h: tick.p, l: tick.p, c: tick.p, v: tick.v });
      } else {
        cur.h = Math.max(cur.h, tick.p);
        cur.l = Math.min(cur.l, tick.p);
        cur.c = tick.p;
        cur.v = Math.max(cur.v, tick.v);
      }
    }
    const arr = Array.from(buckets.values()).sort((a, b) => a.t - b.t);
    return arr.slice(-limit);
  } catch (e) {
    console.error('[autobot] fetchPriceHistory failed', e);
    return [];
  }
}

// ─── 가격 틱 누적 저장 (5분 cron 또는 수동 호출에서 사용) ─────────
export async function recordPriceTick(adminToken: string, tick: PriceTick): Promise<void> {
  try {
    await fsCreate('botPriceTicks', {
      symbol: tick.symbol,
      price: tick.price,
      priceChange24h: tick.priceChange24h,
      volume24h: tick.volume24h,
      liquidity: tick.liquidity,
      source: tick.source,
      createdAt: new Date().toISOString(),
    }, adminToken);
  } catch (e) {
    console.error('[autobot] recordPriceTick failed', e);
  }
}

// ─── 기술지표 ─────────────────────────────────────────────────────
export function computeSMA(values: number[], period: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < values.length; i++) {
    if (i < period - 1) { out.push(NaN); continue; }
    let s = 0;
    for (let j = i - period + 1; j <= i; j++) s += values[j];
    out.push(s / period);
  }
  return out;
}

export function computeEMA(values: number[], period: number): number[] {
  const out: number[] = [];
  const k = 2 / (period + 1);
  let prev = NaN;
  for (let i = 0; i < values.length; i++) {
    if (i === 0) { prev = values[0]; out.push(prev); continue; }
    prev = values[i] * k + prev * (1 - k);
    out.push(prev);
  }
  return out;
}

export function computeRSI(values: number[], period = 14): number[] {
  const out: number[] = [];
  let gain = 0, loss = 0;
  for (let i = 0; i < values.length; i++) {
    if (i === 0) { out.push(NaN); continue; }
    const ch = values[i] - values[i - 1];
    if (i <= period) {
      if (ch > 0) gain += ch; else loss -= ch;
      if (i === period) {
        const ag = gain / period, al = loss / period;
        const rs = al === 0 ? 100 : ag / al;
        out.push(100 - 100 / (1 + rs));
      } else { out.push(NaN); }
    } else {
      const ag = (gain * (period - 1) + Math.max(ch, 0)) / period;
      const al = (loss * (period - 1) + Math.max(-ch, 0)) / period;
      gain = ag * period; loss = al * period;
      const rs = al === 0 ? 100 : ag / al;
      out.push(100 - 100 / (1 + rs));
    }
  }
  return out;
}

export function computeBollinger(values: number[], period = 20, mult = 2): { upper: number[]; middle: number[]; lower: number[] } {
  const middle = computeSMA(values, period);
  const upper: number[] = [];
  const lower: number[] = [];
  for (let i = 0; i < values.length; i++) {
    if (i < period - 1) { upper.push(NaN); lower.push(NaN); continue; }
    let s = 0;
    for (let j = i - period + 1; j <= i; j++) s += Math.pow(values[j] - middle[i], 2);
    const sd = Math.sqrt(s / period);
    upper.push(middle[i] + mult * sd);
    lower.push(middle[i] - mult * sd);
  }
  return { upper, middle, lower };
}

// ─── 종합 기술 지표 분석 ──────────────────────────────────────────
export interface TechnicalAnalysis {
  lastPrice: number;
  sma20: number;
  sma50: number;
  ema20: number;
  rsi14: number;
  bbUpper: number;
  bbMiddle: number;
  bbLower: number;
  macdSignal: 'bull' | 'bear' | 'neutral';
  trend: 'up' | 'down' | 'sideways';
  signals: string[];
}

export function analyzeTechnical(closes: number[]): TechnicalAnalysis {
  const last = closes[closes.length - 1] || 0;
  const sma20Arr = computeSMA(closes, 20);
  const sma50Arr = computeSMA(closes, 50);
  const ema20Arr = computeEMA(closes, 20);
  const rsiArr = computeRSI(closes, 14);
  const bb = computeBollinger(closes, 20, 2);
  const sma20 = sma20Arr[sma20Arr.length - 1] || 0;
  const sma50 = sma50Arr[sma50Arr.length - 1] || 0;
  const ema20 = ema20Arr[ema20Arr.length - 1] || 0;
  const rsi = rsiArr[rsiArr.length - 1] || 50;
  const bbU = bb.upper[bb.upper.length - 1] || 0;
  const bbM = bb.middle[bb.middle.length - 1] || 0;
  const bbL = bb.lower[bb.lower.length - 1] || 0;

  const signals: string[] = [];
  if (rsi > 70) signals.push(`RSI ${rsi.toFixed(1)} 과매수 — 매도 경계`);
  else if (rsi < 30) signals.push(`RSI ${rsi.toFixed(1)} 과매도 — 매수 기회`);
  else signals.push(`RSI ${rsi.toFixed(1)} 중립`);

  if (last > bbU) signals.push('볼린저 상단 돌파 — 단기 과열');
  else if (last < bbL) signals.push('볼린저 하단 이탈 — 반등 가능');

  const macdSignal: 'bull' | 'bear' | 'neutral' = sma20 > sma50 ? 'bull' : sma20 < sma50 ? 'bear' : 'neutral';
  if (macdSignal === 'bull') signals.push('SMA20 > SMA50 — 상승 추세');
  else if (macdSignal === 'bear') signals.push('SMA20 < SMA50 — 하락 추세');

  const trend: 'up' | 'down' | 'sideways' =
    last > sma20 && sma20 > sma50 ? 'up'
    : last < sma20 && sma20 < sma50 ? 'down'
    : 'sideways';

  return { lastPrice: last, sma20, sma50, ema20, rsi14: rsi, bbUpper: bbU, bbMiddle: bbM, bbLower: bbL, macdSignal, trend, signals };
}

// ─── 비상정지 (Kill Switch) ──────────────────────────────────────
export async function emergencyStop(adminToken: string, reason: string): Promise<void> {
  await fsPatch('settings/autobot', {
    enabled: false,
    emergencyStopAt: new Date().toISOString(),
    emergencyStopReason: reason,
    updatedAt: new Date().toISOString(),
  }, adminToken);
  await logBotActivity(adminToken, {
    type: 'config_change',
    severity: 'error',
    message: `🚨 비상정지 발동: ${reason}`,
  });
}

// ─── 위험 한도 체크 (일일 한도 초과 여부) ─────────────────────────
export async function checkRiskLimits(adminToken: string, settings: any): Promise<{ allowed: boolean; reason?: string }> {
  const stats = await getBotDailyStats(adminToken);
  const maxVol = Number(settings?.maxDailyVolume || 0);
  const maxTrd = Number(settings?.maxDailyTrades || 0);
  if (maxTrd > 0 && stats.tradesToday >= maxTrd) return { allowed: false, reason: `일 거래 횟수 한도(${maxTrd}) 도달` };
  if (maxVol > 0 && stats.volumeToday >= maxVol) return { allowed: false, reason: `일 거래량 한도(${maxVol} USDT) 도달` };
  if (settings?.emergencyStopAt) return { allowed: false, reason: `비상정지 상태 (${settings.emergencyStopReason || '관리자 발동'})` };
  return { allowed: true };
}

// ─── 가격 변동 스파이크 감지 ──────────────────────────────────────
export function detectPriceSpike(history: Candle[], thresholdPct: number, windowMins = 5): { spiked: boolean; pct: number } {
  if (!history.length) return { spiked: false, pct: 0 };
  const last = history[history.length - 1];
  const cutoff = last.t - windowMins * 60_000;
  const window = history.filter(c => c.t >= cutoff);
  if (window.length < 2) return { spiked: false, pct: 0 };
  const first = window[0].o;
  const cur = last.c;
  const pct = first > 0 ? ((cur - first) / first) * 100 : 0;
  return { spiked: Math.abs(pct) >= thresholdPct, pct };
}

// ─── 전략 프리셋 ─────────────────────────────────────────────────
export const STRATEGY_PRESETS: Record<string, any> = {
  conservative: {
    label: '🛡️ 안전형 (변동성 ↓, 슬리피지 ↓)',
    targetGrowthPct: 2,
    minAmount: 1,
    maxAmount: 5,
    minWaitMins: 30,
    maxWaitMins: 120,
    sellProbability: 30,
    slippageBps: 50,
    maxDailyVolume: 200,
    maxDailyTrades: 20,
    pauseOnSpike: true,
    spikeThresholdPct: 3,
    strategy: 'natural',
  },
  balanced: {
    label: '⚖️ 균형형 (안정적 거래량 유지)',
    targetGrowthPct: 5,
    minAmount: 5,
    maxAmount: 20,
    minWaitMins: 10,
    maxWaitMins: 45,
    sellProbability: 40,
    slippageBps: 100,
    maxDailyVolume: 1000,
    maxDailyTrades: 60,
    pauseOnSpike: true,
    spikeThresholdPct: 5,
    strategy: 'natural',
  },
  aggressive: {
    label: '🚀 공격형 (높은 거래 빈도)',
    targetGrowthPct: 10,
    minAmount: 10,
    maxAmount: 50,
    minWaitMins: 3,
    maxWaitMins: 15,
    sellProbability: 50,
    slippageBps: 200,
    maxDailyVolume: 5000,
    maxDailyTrades: 200,
    pauseOnSpike: false,
    spikeThresholdPct: 10,
    strategy: 'ai_adaptive',
  },
  marketmaker: {
    label: '🏛️ 마켓메이커 (그리드 양면 호가)',
    targetGrowthPct: 0,
    minAmount: 5,
    maxAmount: 20,
    minWaitMins: 5,
    maxWaitMins: 10,
    sellProbability: 50,
    slippageBps: 80,
    maxDailyVolume: 3000,
    maxDailyTrades: 150,
    pauseOnSpike: false,
    spikeThresholdPct: 7,
    strategy: 'grid',
    grid: { enabled: true, upperPrice: 0, lowerPrice: 0, gridCount: 20, totalCapital: 1000 },
  },
  pumpdca: {
    label: '📈 분할매수 (DCA — 약세장 누적)',
    targetGrowthPct: 0,
    minAmount: 10,
    maxAmount: 30,
    minWaitMins: 60,
    maxWaitMins: 60,
    sellProbability: 0,
    slippageBps: 100,
    maxDailyVolume: 500,
    maxDailyTrades: 24,
    pauseOnSpike: false,
    spikeThresholdPct: 0,
    strategy: 'dca',
    dca: { enabled: true, totalCapital: 1000, steps: 24, intervalMins: 60 },
  },
};

// ─── 자동 사이클 1회 실행 (cron 또는 수동 트리거에서 호출) ────────
// 외부 스왑 실행은 manual-trade 엔드포인트에서 처리하므로,
// 이 함수는 "다음 액션 결정 + 활동 로그 기록 + 가격 틱 저장" 까지 담당.
export interface CycleResult {
  ran: boolean;
  decision: 'BUY' | 'SELL' | 'HOLD' | 'SKIP';
  reason: string;
  tick?: PriceTick | null;
  signal?: AiSignal;
  riskBlocked?: boolean;
}

export async function runAutoCycle(adminToken: string, opts?: { recordTick?: boolean }): Promise<CycleResult> {
  const botDoc = await fsGet('settings/autobot', adminToken).catch(() => null);
  const settings = { ...AUTOBOT_DEFAULTS_FULL, ...(botDoc?.fields ? firestoreDocToObj(botDoc) : {}) };

  if (!settings.enabled) {
    return { ran: false, decision: 'SKIP', reason: '봇 비활성' };
  }

  const risk = await checkRiskLimits(adminToken, settings);
  if (!risk.allowed) {
    await logBotActivity(adminToken, {
      type: 'info',
      severity: 'warning',
      message: `⏸ 사이클 스킵: ${risk.reason}`,
    });
    return { ran: false, decision: 'SKIP', reason: risk.reason || '한도 초과', riskBlocked: true };
  }

  const targetSym = (settings.tradeToken && settings.tradeToken !== 'RANDOM') ? String(settings.tradeToken).toUpperCase() : 'DDRA';
  const prices = await fetchMultiTokenPrices([targetSym]);
  const tick = prices[targetSym];

  if (opts?.recordTick && tick) {
    await recordPriceTick(adminToken, tick);
  }

  if (!tick) {
    return { ran: false, decision: 'SKIP', reason: '시세 없음', tick: null };
  }

  // 스파이크 감지 → 일시정지 옵션
  if (settings.pauseOnSpike) {
    const hist = await fetchPriceHistory(adminToken, targetSym, 12);
    const sp = detectPriceSpike(hist, Number(settings.spikeThresholdPct || 5), 5);
    if (sp.spiked) {
      await logBotActivity(adminToken, {
        type: 'info',
        severity: 'warning',
        message: `⚠️ 가격 스파이크 감지(${sp.pct.toFixed(2)}%) — 1회 사이클 스킵`,
      });
      return { ran: false, decision: 'SKIP', reason: `스파이크 ${sp.pct.toFixed(2)}%`, tick };
    }
  }

  const signal = computeAiSignal(tick, settings);
  let decision: CycleResult['decision'] = 'HOLD';
  if (signal.action === 'BUY' || signal.action === 'BUY_STRONG') decision = 'BUY';
  else if (signal.action === 'SELL' || signal.action === 'SELL_STRONG') decision = 'SELL';

  await logBotActivity(adminToken, {
    type: 'signal',
    severity: 'info',
    message: `🤖 사이클 #${Math.floor(Date.now() / 60000) % 9999}: ${decision} — ${signal.reason[0] || '신호'}`,
    detail: { action: signal.action, score: signal.score, suggestedAmount: signal.suggestedAmount, suggestedSlippageBps: signal.suggestedSlippageBps },
    amount: signal.suggestedAmount,
    symbol: targetSym,
  });

  return { ran: true, decision, reason: signal.reason.join(' / '), tick, signal };
}

// ─── 텔레그램 알림 (settings/telegram 사용) ───────────────────────
export async function sendBotTelegram(adminToken: string, msg: string): Promise<{ sent: boolean; reason?: string }> {
  try {
    const tg = await fsGet('settings/telegram', adminToken).catch(() => null);
    const data = tg?.fields ? firestoreDocToObj(tg) : null;
    const token = data?.botToken;
    const chatId = data?.botChatId || data?.adminChatId;
    if (!token || !chatId) return { sent: false, reason: 'telegram 설정 없음' };
    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: msg, parse_mode: 'HTML', disable_web_page_preview: true }),
      signal: AbortSignal.timeout(6000),
    });
    if (!r.ok) return { sent: false, reason: 'telegram HTTP ' + r.status };
    return { sent: true };
  } catch (e: any) {
    return { sent: false, reason: e.message };
  }
}
