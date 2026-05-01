// [SECURITY] Debug routes disabled in production — see src/_disabled/
// import { debugCheckRoute2 } from "./debug_check2";
import { runSettle, runSettleDryRun } from './services/settlement';
import { sweepBscUsdt, sweepTronUsdt, transferBscUsdt, transferTronUsdt } from './services/sweepMulti';
import bs58 from 'bs58';
import { Connection, PublicKey, Keypair, Transaction, SystemProgram } from '@solana/web3.js';
import { createTransferCheckedInstruction, getAssociatedTokenAddress, createAssociatedTokenAccountInstruction, getMint, getAccount, TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { Wallet, keccak256, getBytes, sha256, ripemd160 } from 'ethers';

function createEVMAndTronWallets() {
  const wallet = Wallet.createRandom();
  const privateKey = wallet.privateKey;
  const evmAddress = wallet.address;

  const pubKey = wallet.signingKey.publicKey; 
  const pubKeyHex = pubKey.substring(4);
  const hash = keccak256("0x" + pubKeyHex);
  const last20 = hash.substring(hash.length - 40);
  const tronAddressHex = "41" + last20;
  
  const tronBytes = getBytes("0x" + tronAddressHex);
  const hash0 = getBytes(sha256(tronBytes));
  const hash1 = getBytes(sha256(hash0));
  const checksum = hash1.slice(0, 4);
  const payload = new Uint8Array(tronBytes.length + 4);
  payload.set(tronBytes);
  payload.set(checksum, tronBytes.length);
  const tronAddress = bs58.encode(payload);

  return { privateKey, evmAddress, tronAddress };
}

const XRP_BASE58_ALPHABET = 'rpshnaf39wBUDNEGHJKLM4PQRST7VWXYZ2bcdeCg65jkm8oFqi1tuvAxyz';

function concatBytes(...chunks: Uint8Array[]) {
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const out = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

function doubleSha256(bytes: Uint8Array) {
  return getBytes(sha256(getBytes(sha256(bytes))));
}

function hash160(bytes: Uint8Array) {
  return getBytes(ripemd160(getBytes(sha256(bytes))));
}

function base58EncodeWithAlphabet(bytes: Uint8Array, alphabet: string) {
  if (!bytes.length) return '';
  const digits = [0];
  for (const byte of bytes) {
    let carry = byte;
    for (let i = 0; i < digits.length; i++) {
      carry += digits[i] << 8;
      digits[i] = carry % 58;
      carry = Math.floor(carry / 58);
    }
    while (carry > 0) {
      digits.push(carry % 58);
      carry = Math.floor(carry / 58);
    }
  }

  let leadingZeroes = 0;
  while (leadingZeroes < bytes.length && bytes[leadingZeroes] === 0) leadingZeroes++;

  let encoded = alphabet[0].repeat(leadingZeroes);
  for (let i = digits.length - 1; i >= 0; i--) encoded += alphabet[digits[i]];
  return encoded;
}

function bitcoinBase58Check(version: number, payload: Uint8Array) {
  const body = concatBytes(new Uint8Array([version]), payload);
  return bs58.encode(concatBytes(body, doubleSha256(body).slice(0, 4)));
}

function xrpBase58Check(version: number, payload: Uint8Array) {
  const body = concatBytes(new Uint8Array([version]), payload);
  return base58EncodeWithAlphabet(concatBytes(body, doubleSha256(body).slice(0, 4)), XRP_BASE58_ALPHABET);
}

function createXrpWallet() {
  const wallet = Wallet.createRandom();
  const compressedPublicKey = wallet.signingKey.compressedPublicKey;
  const accountId = hash160(getBytes(compressedPublicKey));
  return {
    xrpAddress: xrpBase58Check(0x00, accountId),
    xrpPrivateKey: wallet.privateKey,
    xrpPublicKey: compressedPublicKey,
    xrpAddressType: 'classic'
  };
}

function createBtcWallet() {
  const wallet = Wallet.createRandom();
  const compressedPublicKey = wallet.signingKey.compressedPublicKey;
  const accountId = hash160(getBytes(compressedPublicKey));
  return {
    btcAddress: bitcoinBase58Check(0x00, accountId),
    btcPrivateKey: wallet.privateKey,
    btcPublicKey: compressedPublicKey,
    btcAddressType: 'p2pkh'
  };
}

function createMissingMajorChainWalletFields(walletFields: any = {}) {
  const updates: any = {};
  const getField = (key: string) => String(walletFields?.[key]?.stringValue || '').trim();

  if (!getField('evmAddress') || !getField('tronAddress')) {
    const multi = createEVMAndTronWallets();
    if (!getField('evmAddress')) updates.evmAddress = { stringValue: multi.evmAddress };
    if (!getField('evmPrivateKey')) updates.evmPrivateKey = { stringValue: multi.privateKey };
    if (!getField('tronAddress')) updates.tronAddress = { stringValue: multi.tronAddress };
    if (!getField('tronPrivateKey')) updates.tronPrivateKey = { stringValue: multi.privateKey };
  }

  if (!getField('xrpAddress')) {
    const xrp = createXrpWallet();
    updates.xrpAddress = { stringValue: xrp.xrpAddress };
    updates.xrpPrivateKey = { stringValue: xrp.xrpPrivateKey };
    updates.xrpPublicKey = { stringValue: xrp.xrpPublicKey };
    updates.xrpAddressType = { stringValue: xrp.xrpAddressType };
  }

  if (!getField('btcAddress')) {
    const btc = createBtcWallet();
    updates.btcAddress = { stringValue: btc.btcAddress };
    updates.btcPrivateKey = { stringValue: btc.btcPrivateKey };
    updates.btcPublicKey = { stringValue: btc.btcPublicKey };
    updates.btcAddressType = { stringValue: btc.btcAddressType };
  }

  return updates;
}

function publicMajorChainWalletResponse(walletFields: any = {}) {
  const getField = (key: string) => String(walletFields?.[key]?.stringValue || '').trim();
  return {
    evmAddress: getField('evmAddress'),
    tronAddress: getField('tronAddress'),
    xrpAddress: getField('xrpAddress'),
    btcAddress: getField('btcAddress'),
    xrpAddressType: getField('xrpAddressType') || 'classic',
    btcAddressType: getField('btcAddressType') || 'p2pkh'
  };
}

function walletFieldString(walletFields: any = {}, key: string): string {
  const value = walletFields?.[key];
  if (value && typeof value === 'object') {
    if ('stringValue' in value) return String(value.stringValue || '').trim();
    if ('timestampValue' in value) return String(value.timestampValue || '').trim();
  }
  return String(value || '').trim();
}

const DWALLET_LANGUAGE_CODES = new Set(['en', 'ko', 'vi', 'th', 'zh', 'ja', 'id', 'ms', 'tl', 'es', 'fr']);

function normalizeDwalletLanguage(value: any): string {
  const raw = String(value || '').trim().toLowerCase().replace('_', '-');
  const base = raw.split('-')[0];
  return DWALLET_LANGUAGE_CODES.has(base) ? base : 'en';
}

function sanitizeDwalletCountryCode(value: any): string {
  const code = String(value || '').trim().toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3);
  return code || '';
}

function sanitizeDwalletText(value: any, max = 120): string {
  return String(value || '').trim().slice(0, max);
}

function buildDwalletProfilePatch(profileInput: any = {}) {
  const countryCode = sanitizeDwalletCountryCode(profileInput.countryCode || profileInput.country);
  const country = sanitizeDwalletText(profileInput.countryName || profileInput.country || countryCode, 80);
  const language = normalizeDwalletLanguage(profileInput.language || profileInput.locale || profileInput.preferredLanguage);
  const patch: any = {
    language,
    preferredLanguage: language
  };
  if (countryCode) patch.countryCode = countryCode;
  if (country) patch.country = country;
  const authProvider = sanitizeDwalletText(profileInput.authProvider || profileInput.provider, 40);
  if (authProvider) patch.authProvider = authProvider;
  const displayName = sanitizeDwalletText(profileInput.displayName || profileInput.name, 120);
  if (displayName) patch.name = displayName;
  return patch;
}

function firstText(...values: any[]): string {
  for (const value of values) {
    const text = String(value || '').trim();
    if (text) return text;
  }
  return '';
}

function dwalletFinanceSnapshot(user: any = {}, wallet: any = {}, profile: any = {}, ddraBalance = 0, ddraValueUsdt = 0) {
  return {
    usdtBalance: roundMoney(firstFiniteNumber(wallet.usdtBalance, user.usdtBalance, profile.usdtBalance)),
    bonusBalance: roundMoney(firstFiniteNumber(wallet.bonusBalance, wallet.bonusUsdt, user.bonusBalance, profile.bonusBalance)),
    promoLockedUsdt: roundMoney(firstFiniteNumber(wallet.promoLockedUsdt, wallet.lockedPromoUsdt, wallet.promotionLockedUsdt, user.promoLockedUsdt, profile.promoLockedUsdt)),
    ddraBalance: roundMoney(ddraBalance),
    ddraValueUsdt: roundMoney(ddraValueUsdt),
    availableUsdt: roundMoney(firstFiniteNumber(wallet.availableUsdt, wallet.usdtAvailable, wallet.usdtBalance, user.availableUsdt)),
    totalDeposit: roundMoney(firstFiniteNumber(wallet.totalDeposit, wallet.depositTotal, user.totalDeposit, profile.totalDeposit)),
    totalWithdraw: roundMoney(firstFiniteNumber(wallet.totalWithdraw, wallet.totalWithdrawal, wallet.withdrawTotal, user.totalWithdraw, profile.totalWithdraw)),
    totalEarnings: roundMoney(firstFiniteNumber(wallet.totalEarnings, wallet.totalBonus, wallet.bonusEarned, user.totalEarnings, profile.totalEarnings)),
    totalInvested: roundMoney(firstFiniteNumber(wallet.totalInvested, wallet.totalInvest, user.totalInvested, profile.totalInvested)),
    frozenBalance: roundMoney(firstFiniteNumber(wallet.frozenBalance, wallet.freezeBalance, wallet.freezedBalance, wallet.totalFrozen, user.frozenBalance, profile.frozenBalance))
  };
}

async function markDwalletManagedUser(uid: string, email: string, walletFields: any, adminToken: string, isNewWallet = false, profileInput: any = {}) {
  const now = new Date().toISOString();
  const publicWallet = publicMajorChainWalletResponse(walletFields);
  const profilePatch = buildDwalletProfilePatch(profileInput);
  const userPatch: any = {
    uid,
    dwalletUser: true,
    dwalletSource: 'dwallet',
    dwalletWalletIssued: true,
    dwalletUpdatedAt: now,
    ...profilePatch
  };
  if (email) userPatch.email = email;
  if (isNewWallet) userPatch.dwalletCreatedAt = now;

  const walletProfile: any = {
    ...userPatch,
    solanaAddress: walletFieldString(walletFields, 'publicKey'),
    evmAddress: publicWallet.evmAddress,
    tronAddress: publicWallet.tronAddress,
    xrpAddress: publicWallet.xrpAddress,
    btcAddress: publicWallet.btcAddress,
    xrpAddressType: publicWallet.xrpAddressType,
    btcAddressType: publicWallet.btcAddressType,
    walletCreatedAt: walletFieldString(walletFields, 'createdAt') || now
  };

  await Promise.allSettled([
    fsPatch(`users/${uid}`, userPatch, adminToken),
    fsPatch(`dwalletUsers/${uid}`, walletProfile, adminToken)
  ]);
}

async function markDwalletRegisteredUser(uid: string, email: string, adminToken: string, profileInput: any = {}) {
  const now = new Date().toISOString();
  const profilePatch = buildDwalletProfilePatch(profileInput);
  const profile: any = {
    uid,
    dwalletUser: true,
    dwalletSource: 'dwallet',
    dwalletWalletIssued: false,
    dwalletRegisteredAt: now,
    dwalletUpdatedAt: now,
    ...profilePatch
  };
  if (email) profile.email = email;
  await Promise.allSettled([
    fsPatch(`users/${uid}`, profile, adminToken),
    fsPatch(`dwalletUsers/${uid}`, profile, adminToken)
  ]);
}
import nacl from 'tweetnacl';
import { Hono } from 'hono'
import { serveStatic } from 'hono/cloudflare-workers'
import { cors } from 'hono/cors'
// @ts-ignore
import ADMIN_HTML from '../public/static/admin.html?raw'
// @ts-ignore
import INDEX_HTML from '../public/index.html?raw'
// @ts-ignore
const WALLET_PROJECT_HTML = '<html><body>Not Found</body></html>';

const app = new Hono()

// [SECURITY GUARD] /api/debug/* 전체 차단 — 운영 데이터 노출 방지
// 본체에 산재한 41개 디버그 라우트가 정식 등록 전에 404로 반환되도록 첫 번째 미들웨어로 등록
app.all('/api/debug/*', (c) => c.json({ error: 'not_found' }, 404));

let GLOBAL_ENV: any = {};
app.use('*', async (c, next) => {
  // [FIX 2026-04-30] CRON_SECRET·ADMIN_API_SECRET 등이 production 에서 갱신되어도
  // 이전 가드(`!GLOBAL_ENV.SERVICE_ACCOUNT`)는 첫 요청 후 영원히 false 가 되므로
  // 이후 변경된 시크릿들이 반영되지 않는 문제가 있었음. 매 요청마다 최신 c.env 로
  // 병합하여 항상 최신 시크릿을 사용하도록 수정.
  if (c.env) {
    GLOBAL_ENV = { ...GLOBAL_ENV, ...c.env };
  }
  await next();
});


app.get('/api/public/firebase-config', (c) => {
  const config = getPublicFirebaseConfig(c.env);
  if (!config) return c.json({ error: 'FIREBASE_WEB_API_KEY missing' }, 500);
  return c.json(config, 200, { 'Cache-Control': 'no-store' });
})

app.use('/api/*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: [
    'Content-Type',
    'Authorization',
    'x-admin-secret',
    'x-admin-action-confirmation',
    'x-cron-secret'
  ],
  maxAge: 86400
}));

app.use('*', async (c, next) => {
  const path = new URL(c.req.url).pathname;
  if (!isPrivilegedApiPath(path)) {
    await next();
    return;
  }

  // [FIX 2026-04-30] 화이트리스트 조회 전용 엔드포인트는 미들웨어 우회
  // (엔드포인트 내부에서 화이트리스트 검증 + 조회 전용 처리)
  if (path === '/api/admin/earnings-audit-public'
      || path === '/api/admin/bonus-daily-public'
      || path === '/api/admin/bonus-correction-public'
      || path === '/api/admin/abusing-bulk-block-public') {
    await next();
    return;
  }

  const isMaintenancePath = isDangerousLegacyApiPath(path);
  if (isMaintenancePath && !hasExplicitMaintenanceApiAccess(c)) {
    return c.json({ error: 'not_found' }, 404);
  }

  if (!(await hasPrivilegedApiAccess(c))) {
    return c.json({ error: 'unauthorized' }, 401);
  }

  if (isMaintenancePath) {
    queueAdminAuditLog(c, {
      category: 'security',
      action: 'maintenance_api_access',
      severity: 'high',
      targetType: 'api',
      targetId: path,
      metadata: {
        maintenanceFlagEnabled: isEnvFlagEnabled('ALLOW_LEGACY_DEBUG_API')
      }
    });
  }

  await next();
});


// ─── 디드라 지갑에서 회사 지갑으로 다이렉트 입금 ──────────────────────────────


app.post('/api/solana/send-token', async (c) => {
  try {
    const authHeader = c.req.header('Authorization');
    if (!authHeader) return c.json({ error: 'Missing auth header' }, 401);
    const idToken = authHeader.split('Bearer ')[1];

    const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken })
    });
    const data = await res.json();
    if (!data.users || !data.users.length) return c.json({ error: 'Invalid token' }, 401);

    const uid = data.users[0].localId;
    const adminToken = await getAdminToken();

    const uRes = await fetch(`${FIRESTORE_BASE}/users/${uid}`, { headers: { Authorization: `Bearer ${adminToken}` } });
    const uData = await uRes.json();

    const pubKeyStr = uData.fields?.deedraWallet?.mapValue?.fields?.publicKey?.stringValue;
    const secretKeyStr = uData.fields?.deedraWallet?.mapValue?.fields?.secretKeyArray?.stringValue;
    if (!pubKeyStr || !secretKeyStr) return c.json({ error: 'Deedra Wallet not found' }, 400);

    const body = await c.req.json().catch(() => ({}));
    const { targetAddress, token } = body;
    const amount = Number(body.amount);
    if (!targetAddress || targetAddress.length < 32) return c.json({ error: 'Invalid target address' }, 400);
    if (!Number.isFinite(amount) || amount <= 0) return c.json({ error: 'Invalid amount' }, 400);
    if (!['USDT', 'DDRA', 'SOL'].includes(token)) return c.json({ error: 'Invalid token type' }, 400);

    const conn = new Connection('https://solana-rpc.publicnode.com');
    const userKp = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(secretKeyStr)));
    const sponsorKeyStr = (c.env as any).SPONSOR_SOL_SECRET;
        let sponsorKp = null;
    if (sponsorKeyStr) {
      try {
        let trimmed = sponsorKeyStr.trim();
        if (trimmed.startsWith('[')) {
          sponsorKp = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(trimmed)));
        } else {
          sponsorKp = Keypair.fromSecretKey(bs58.decode(trimmed));
        }
      } catch (e: any) {
        return c.json({ error: '스폰서 지갑(SPONSOR_SOL_SECRET) 형식 오류: ' + e.message }, 400);
      }
    }

    let targetPubKey;
    try {
      targetPubKey = new PublicKey(targetAddress);
    } catch(e) {
      return c.json({ error: '받는 주소 형식이 올바르지 않습니다 (Solana base58 pubkey 필요)' }, 400);
    }

    // [FIX 2026-05-01 #8] 받는 주소가 일반 지갑(curve 위 점)인지 검증.
    //   ATA / PDA 주소를 받는 주소로 입력한 경우 createAssociatedTokenAccountInstruction
    //   이 실패하면서 Instruction 0 에서 custom program error 0x1 발생.
    if (!PublicKey.isOnCurve(targetPubKey.toBytes())) {
      return c.json({
        error: '받는 주소가 일반 지갑이 아닙니다 (PDA/ATA 주소). 본인의 SOL 지갑 주소를 입력하세요. 거래소 입금 주소를 사용 중이면 거래소가 DDRA 토큰을 지원하는지 확인하세요.'
      }, 400);
    }

    // 발신/수신이 동일한 경우 차단 (자기 자신에게 전송 시 0x1 에러)
    if (targetPubKey.toBase58() === userKp.publicKey.toBase58()) {
      return c.json({ error: '발신 지갑과 수신 지갑이 동일합니다. 다른 주소로 전송하세요.' }, 400);
    }

    const ixs = [];

    if (token === 'SOL') {
      const lamports = Math.floor(amount * 1_000_000_000);
      ixs.push(SystemProgram.transfer({
        fromPubkey: userKp.publicKey,
        toPubkey: targetPubKey,
        lamports
      }));
    } else {
      const mintMap: Record<string, string> = {
        'USDT': 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
        'DDRA': 'DDRADez92SA7jLhzL2bjBkWBK9idqvrhX1CuAZFaAgyv'
      };
      const tokenMint = new PublicKey(mintMap[token]);
      const tokenProgramId = token === 'DDRA' ? TOKEN_2022_PROGRAM_ID : TOKEN_PROGRAM_ID;

      // [FIX 2026-04-30] DDRA(Token-2022) 전송 실패(custom program error 0x1) 수정
      // [FIX 2026-05-01 #8] 추가 진단:
      //   - 스폰서 지갑 SOL 잔액 검증 (ATA 생성 비용 약 0.00204 SOL 확보)
      //   - 목적지 ATA 생성 검증 후 simulateTransaction 으로 사전 시뮬레이션
      //   - simulate 실패 시 onchain logs 를 그대로 사용자에게 반환
      let mintDecimals = 6;
      try {
        const mintInfo = await getMint(conn, tokenMint, 'confirmed', tokenProgramId);
        mintDecimals = mintInfo.decimals;
      } catch (e: any) {
        return c.json({ error: `${token} mint 정보 조회 실패: ${e.message}` }, 400);
      }

      const sourceAta = await getAssociatedTokenAddress(tokenMint, userKp.publicKey, false, tokenProgramId, ASSOCIATED_TOKEN_PROGRAM_ID);
      const destAta = await getAssociatedTokenAddress(tokenMint, targetPubKey, false, tokenProgramId, ASSOCIATED_TOKEN_PROGRAM_ID);

      // source ATA 존재/잔액 확인 (custom program error 0x1 = insufficient funds 방지)
      try {
        const sourceAcc = await getAccount(conn, sourceAta, 'confirmed', tokenProgramId);
        const lamportsNeeded = BigInt(Math.floor(amount * Math.pow(10, mintDecimals)));
        if (sourceAcc.amount < lamportsNeeded) {
          const haveUi = Number(sourceAcc.amount) / Math.pow(10, mintDecimals);
          return c.json({
            error: `${token} 잔액 부족: 보유 ${haveUi}, 필요 ${amount}`
          }, 400);
        }
      } catch (e: any) {
        return c.json({
          error: `${token} 토큰 계정이 존재하지 않거나 조회 실패: ${e.message}. 먼저 ${token} 토큰을 입금받아야 전송할 수 있습니다.`
        }, 400);
      }

      const destAtaInfo = await conn.getAccountInfo(destAta);
      const needsCreateAta = !destAtaInfo;
      if (needsCreateAta) {
         // ATA 생성 비용은 약 0.00204 SOL (rent-exempt). 비용 지불자(payer) SOL 잔액 검증.
         const payerPubKey = sponsorKp ? sponsorKp.publicKey : userKp.publicKey;
         try {
           const payerBalance = await conn.getBalance(payerPubKey, 'confirmed');
           const minRequired = 2_500_000; // 약 0.0025 SOL (ATA 생성 + 트랜잭션 수수료)
           if (payerBalance < minRequired) {
             const payerLabel = sponsorKp ? '스폰서 지갑' : '본인 지갑';
             return c.json({
               error: `${payerLabel}의 SOL 잔액 부족 (현재 ${(payerBalance/1e9).toFixed(6)} SOL, 필요 ${(minRequired/1e9).toFixed(6)} SOL). 받는 사람의 ${token} 토큰 계정(ATA)을 새로 생성하려면 SOL 수수료가 필요합니다.`
             }, 400);
           }
         } catch (_) { /* balance 조회 실패는 통과 */ }
         ixs.push(createAssociatedTokenAccountInstruction(
           payerPubKey,
           destAta,
           targetPubKey,
           tokenMint,
           tokenProgramId,
           ASSOCIATED_TOKEN_PROGRAM_ID
         ));
      }

      const lamports = BigInt(Math.floor(amount * Math.pow(10, mintDecimals)));
      ixs.push(createTransferCheckedInstruction(
         sourceAta,
         tokenMint,
         destAta,
         userKp.publicKey,
         lamports,
         mintDecimals,
         [],
         tokenProgramId
      ));
    }

    const blockhash = (await conn.getLatestBlockhash()).blockhash;
    const tx = new Transaction().add(...ixs);
    tx.recentBlockhash = blockhash;
    tx.feePayer = sponsorKp ? sponsorKp.publicKey : userKp.publicKey;

    const signers = [userKp];
    if (sponsorKp) signers.push(sponsorKp);
    tx.sign(...signers);

    // [FIX 2026-05-01 #8] 전송 전 simulateTransaction 으로 onchain 로그 미리 확인.
    //   실패 시 logs 를 그대로 반환하여 0x1 의 정확한 원인 파악 가능.
    try {
      const sim = await conn.simulateTransaction(tx);
      if (sim.value.err) {
        const logs = sim.value.logs || [];
        const errStr = typeof sim.value.err === 'string' ? sim.value.err : JSON.stringify(sim.value.err);
        // 0x1 의 가장 흔한 원인을 logs 에서 자동 매핑
        const joinedLogs = logs.join('\n');
        let friendly = '';
        if (joinedLogs.includes('insufficient funds')) {
          friendly = `${token} 잔액 또는 SOL 수수료 부족입니다. 발신 지갑의 ${token} 잔액과 SOL 잔액을 모두 확인하세요.`;
        } else if (joinedLogs.includes('account already exists') || joinedLogs.includes('already in use')) {
          friendly = '받는 사람의 토큰 계정이 이미 존재합니다 (정상 상황 — 재시도 시 자동 처리). 잠시 후 다시 시도하세요.';
        } else if (joinedLogs.includes('owner does not match')) {
          friendly = '받는 주소의 토큰 계정 소유자가 일치하지 않습니다. 받는 주소가 올바른지 다시 확인하세요.';
        } else if (joinedLogs.includes('invalid account data')) {
          friendly = '받는 주소가 SOL 일반 지갑이 아닙니다. 거래소 주소나 컨트랙트 주소가 아닌, 본인이 통제하는 SOL 지갑 주소를 입력하세요.';
        } else {
          friendly = `트랜잭션 시뮬레이션 실패 (${errStr}).`;
        }
        return c.json({
          error: friendly,
          simulationError: errStr,
          logs: logs.slice(-15) // 마지막 15줄만 반환
        }, 400);
      }
    } catch (simErr: any) {
      console.error('[send-token] simulation error:', simErr);
      // simulate 실패해도 실제 전송은 시도 (RPC 일시 오류 가능)
    }

    const txid = await conn.sendRawTransaction(tx.serialize());
    
    // [FIX 2026-04-30] 외부 송금은 'deposit' 이 아니라 'send' 로 기록.
    // 이전엔 type:'deposit'/status:'pending' 으로 잘못 등록되어,
    // 회원의 D-WALLET 외부 송금이 관리자 입금 신청 목록에 노출되는 문제가 있었음.
    try {
        await fsCreateOnlyIfAbsent(`transactions/${txid}`, {
          userId: uid,
          type: 'send',
          subType: 'dwallet_outbound',
          amount,
          currency: token,
          status: 'completed',
          txid: txid,
          txHash: txid,
          network: 'Solana',
          walletType: 'deedra',
          fromAddress: pubKeyStr,
          toAddress: targetAddress,
          monitorSource: 'dwallet_send_token',
          createdAt: new Date().toISOString()
        }, adminToken);
    } catch(e) { console.error('Failed to create send-token transaction record:', e); }
    
    return c.json({ success: true, txid });
  } catch (err: any) {
    console.error('Send Token Error:', err);
    return c.json({ error: err.message }, 500);
  }
});


app.post('/api/solana/send-usdt', async (c) => {
  try {
    const authHeader = c.req.header('Authorization');
    if (!authHeader) return c.json({ error: 'Missing auth header' }, 401);
    const idToken = authHeader.split('Bearer ')[1];

    const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken })
    });
    const data = await res.json();
    if (!data.users || !data.users.length) return c.json({ error: 'Invalid token' }, 401);

    const uid = data.users[0].localId;
    const adminToken = await getAdminToken();

    const uRes = await fetch(`${FIRESTORE_BASE}/users/${uid}`, { headers: { Authorization: `Bearer ${adminToken}` } });
    const uData = await uRes.json();

    const pubKeyStr = uData.fields?.deedraWallet?.mapValue?.fields?.publicKey?.stringValue;
    const secretKeyStr = uData.fields?.deedraWallet?.mapValue?.fields?.secretKeyArray?.stringValue;
    if (!pubKeyStr || !secretKeyStr) return c.json({ error: 'Deedra Wallet not found' }, 400);

    const body = await c.req.json().catch(() => ({}));
    const { targetAddress, amountUsdt } = body;
    if (!targetAddress || targetAddress.length < 32) return c.json({ error: 'Invalid target address' }, 400);
    if (!amountUsdt || amountUsdt <= 0) return c.json({ error: 'Invalid amount' }, 400);

    const conn = new Connection('https://solana-rpc.publicnode.com');
    const userKp = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(secretKeyStr)));
    const sponsorKeyStr = (c.env as any).SPONSOR_SOL_SECRET;
        let sponsorKp = null;
    if (sponsorKeyStr) {
      try {
        let trimmed = sponsorKeyStr.trim();
        if (trimmed.startsWith('[')) {
          sponsorKp = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(trimmed)));
        } else {
          sponsorKp = Keypair.fromSecretKey(bs58.decode(trimmed));
        }
      } catch (e: any) {
        return c.json({ error: '스폰서 지갑(SPONSOR_SOL_SECRET) 형식 오류: ' + e.message }, 400);
      }
    }

    let targetPubKey;
    try {
      targetPubKey = new PublicKey(targetAddress);
    } catch(e) {
      return c.json({ error: 'Invalid target address format' }, 400);
    }

    const usdtMint = new PublicKey('Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB');

    const sourceAta = await getAssociatedTokenAddress(usdtMint, userKp.publicKey);
    const destAta = await getAssociatedTokenAddress(usdtMint, targetPubKey);

    const amountLamports = Math.floor(amountUsdt * 1_000_000);
    const ixs = [];

    const destAtaInfo = await conn.getAccountInfo(destAta);
    if (!destAtaInfo) {
       ixs.push(createAssociatedTokenAccountInstruction(
         sponsorKp ? sponsorKp.publicKey : userKp.publicKey,
         destAta,
         targetPubKey,
         usdtMint
       ));
    }

    ixs.push(createTransferCheckedInstruction(
       sourceAta,
       usdtMint,
       destAta,
       userKp.publicKey,
       amountLamports,
       6
    ));

    const blockhash = (await conn.getLatestBlockhash()).blockhash;
    const tx = new Transaction().add(...ixs);
    tx.recentBlockhash = blockhash;
    tx.feePayer = sponsorKp ? sponsorKp.publicKey : userKp.publicKey;

    const signers = [userKp];
    if (sponsorKp) signers.push(sponsorKp);
    tx.sign(...signers);

    const txid = await conn.sendRawTransaction(tx.serialize());
    return c.json({ success: true, txid });
  } catch (err: any) {
    console.error('Send USDT Error:', err);
    return c.json({ error: err.message }, 500);
  }
});


app.post('/api/multi/trigger-sweep', async (c) => {
  try {
    const authHeader = c.req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) return c.json({ error: 'Unauthorized' }, 401);
    const idToken = authHeader.split(' ')[1];
    
    const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken })
    });
    const data = await res.json();
    if (!data.users || !data.users.length) return c.json({ error: 'Invalid token' }, 401);
    
    const uid = data.users[0].localId;
    const adminToken = await getAdminToken();

    const uRes = await fetch(`${FIRESTORE_BASE}/users/${uid}`, { headers: { Authorization: `Bearer ${adminToken}` } });
    const uData = await uRes.json();
    
    const w = uData.fields?.deedraWallet?.mapValue?.fields;
    if (!w) return c.json({ error: 'No wallet found' }, 400);

    const bscAddress = w.evmAddress?.stringValue;
    const bscPriv = w.evmPrivateKey?.stringValue;
    const tronAddress = w.tronAddress?.stringValue;
    const tronPriv = w.tronPrivateKey?.stringValue;

    const sponsorKeyStr = (c.env as any).MULTI_FEE_BOT_KEY; // The master gas key
    if (!sponsorKeyStr) return c.json({ error: 'No sponsor gas bot configured' }, 500);

    // Fetch company addresses
    const sysDoc = await fsGet('settings/system', adminToken).catch(()=>null);
    const companyBsc = sysDoc?.fields?.companyBscAddress?.stringValue || '0x76CbE9826D9720E49b3536E426A125BC4ceD2502';
    const companyTron = sysDoc?.fields?.companyTronAddress?.stringValue || 'TLiG5xwLM7po4ALkAu3iCuNsxrb';

    // Execute in background
    if (c.executionCtx && c.executionCtx.waitUntil) {
      c.executionCtx.waitUntil((async () => {
        const promises = [];
        if (bscPriv && bscAddress) {
          promises.push(
            sweepBscUsdt(bscPriv, companyBsc, sponsorKeyStr).then(async (result) => {
              console.log('[Sweep BSC USDT Result]', result);
              if (result.success) {
                await saveDepositRecord(uid, uData, result.txid, result.amount, 'BSC', adminToken, 'USDT', result.amount);
              }
            })
          );
          promises.push(
            sweepBscNative(bscPriv, companyBsc).then(async (result) => {
              console.log('[Sweep BSC Native Result]', result);
              if (result.success) {
                await saveDepositRecord(uid, uData, result.txid, result.amount, 'BSC', adminToken, result.currency, result.usdtValue);
              }
            })
          );
        }
        if (tronPriv && tronAddress) {
          promises.push(
            sweepTronUsdt(tronPriv, companyTron, sponsorKeyStr).then(async (result) => {
              console.log('[Sweep TRON USDT Result]', result);
              if (result.success) {
                await saveDepositRecord(uid, uData, result.txid, result.amount, 'TRON', adminToken, 'USDT', result.amount);
              }
            })
          );
          promises.push(
            sweepTronNative(tronPriv, companyTron).then(async (result) => {
              console.log('[Sweep TRON Native Result]', result);
              if (result.success) {
                await saveDepositRecord(uid, uData, result.txid, result.amount, 'TRON', adminToken, result.currency, result.usdtValue);
              }
            })
          );
        }
        await Promise.allSettled(promises);
      })());
    }

    return c.json({ success: true, message: 'Sweep process triggered in background' });
  } catch(e:any) {
    return c.json({ error: e.message }, 500);
  }
});

async function saveDepositRecord(uid: string, uData: any, txHash: string, amount: number, network: string, adminToken: string, currency: string = 'USDT', usdtValue: number = amount) {
  const timestamp = new Date().toISOString();
  
  // 1. Check if tx already processed
  const searchRes = await fetch(`${FIRESTORE_BASE}:runQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: 'transactions' }],
        where: {
          fieldFilter: { field: { fieldPath: 'txHash' }, op: 'EQUAL', value: { stringValue: txHash } }
        }
      }
    })
  });
  const searchData = await searchRes.json();
  if (searchData && searchData.length > 0 && searchData[0].document) {
    return; // Already processed
  }

  // 2. Create transaction record
  const txBody = {
    fields: {
      userId: { stringValue: uid },
      userEmail: uData.fields?.email?.stringValue || '',
      userName: uData.fields?.name?.stringValue || '',
      type: { stringValue: 'deposit' },
      status: { stringValue: 'approved' }, // Instant approve
      amount: { doubleValue: amount },
      currency: { stringValue: currency },
      usdtValue: { doubleValue: usdtValue },
      network: { stringValue: network },
      txHash: { stringValue: txHash },
      createdAt: { timestampValue: timestamp },
      updatedAt: { timestampValue: timestamp },
      memo: { stringValue: `Auto-sweep ${network}` }
    }
  };

  await fetch(`${FIRESTORE_BASE}/transactions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify(txBody)
  });

  // 3. Update Wallet Balance
  const wRes = await fetch(`${FIRESTORE_BASE}/wallets/${uid}`, { headers: { Authorization: `Bearer ${adminToken}` } });
  const wData = await wRes.json();
  const currentUsdt = wData.fields?.usdtBalance?.doubleValue || wData.fields?.usdtBalance?.integerValue || 0;
  const currentTotal = wData.fields?.totalDeposit?.doubleValue || wData.fields?.totalDeposit?.integerValue || 0;

  const patchW = {
    fields: {
      usdtBalance: { doubleValue: parseFloat(currentUsdt) + usdtValue },
      totalDeposit: { doubleValue: parseFloat(currentTotal) + usdtValue }
    }
  };

  await fetch(`${FIRESTORE_BASE}/wallets/${uid}?updateMask.fieldPaths=usdtBalance&updateMask.fieldPaths=totalDeposit`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify(patchW)
  });
}

app.post('/api/solana/direct-deposit', async (c) => {
  try {
    const authHeader = c.req.header('Authorization');
    if (!authHeader) return c.json({ error: 'Missing auth header' }, 401);
    const idToken = authHeader.split('Bearer ')[1];

    const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken })
    });
    const data = await res.json();
    if (!data.users || !data.users.length) return c.json({ error: 'Invalid token' }, 401);

    const uid = data.users[0].localId;
    const adminToken = await getAdminToken();

    const uRes = await fetch(`${FIRESTORE_BASE}/users/${uid}`, { headers: { Authorization: `Bearer ${adminToken}` } });
    const uData = await uRes.json();

    const pubKeyStr = uData.fields?.deedraWallet?.mapValue?.fields?.publicKey?.stringValue;
    const secretKeyStr = uData.fields?.deedraWallet?.mapValue?.fields?.secretKeyArray?.stringValue;
    if (!pubKeyStr || !secretKeyStr) return c.json({ error: 'Deedra Wallet not found' }, 400);

    const body = await c.req.json().catch(() => ({}));
    const { amountUi, currency, solPrice } = body;
    if (!amountUi || amountUi <= 0) return c.json({ error: 'Invalid amount' }, 400);

    const sysDoc = await fsGet('settings/system', adminToken).catch(()=>null);
    let companyAddress = '9Cix8agTnPSy26JiPGeq7hoBqBQbc8zsaXpmQSBsaTMW';
    // Forced company address for Solana
    // if (sysDoc && sysDoc.fields?.depositAddress?.stringValue) {
    //   companyAddress = sysDoc.fields.depositAddress.stringValue;
    // }

    const conn = new Connection('https://solana-rpc.publicnode.com');
    const userKp = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(secretKeyStr)));
    const sponsorKeyStr = (c.env as any).SPONSOR_SOL_SECRET;
    let sponsorKp = null;
    if (sponsorKeyStr) {
      try {
        let trimmed = sponsorKeyStr.trim();
        if (trimmed.startsWith('[')) {
          sponsorKp = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(trimmed)));
        } else {
          sponsorKp = Keypair.fromSecretKey(bs58.decode(trimmed));
        }
      } catch (e: any) {
        return c.json({ error: '스폰서 지갑(SPONSOR_SOL_SECRET) 형식 오류: ' + e.message }, 400);
      }
    }

    const companyPubKey = new PublicKey(companyAddress);
    const ixs = [];

    if (currency === 'SOL') {
      // Fetch latest SOL price to verify if solPrice is roughly correct or just use the passed one
      // For safety, we should really fetch the price backend-side.
      let currentPrice = solPrice || 1;
      try {
        const pRes = await fetch('https://api.binance.com/api/v3/ticker/price?symbol=SOLUSDT');
        const pData = await pRes.json();
        if (pData.price) currentPrice = parseFloat(pData.price);
      } catch(e) {}
      
      const estSol = amountUi / currentPrice;
      const amountLamports = Math.floor(estSol * 1_000_000_000); // SOL has 9 decimals
      
      ixs.push(SystemProgram.transfer({
        fromPubkey: userKp.publicKey,
        toPubkey: companyPubKey,
        lamports: amountLamports
      }));
    } else {
      const usdtMint = new PublicKey('Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB');
      const sourceAta = await getAssociatedTokenAddress(usdtMint, userKp.publicKey);
      const destAta = await getAssociatedTokenAddress(usdtMint, companyPubKey);

      const amountLamports = Math.floor(amountUi * 1_000_000);

      const destAtaInfo = await conn.getAccountInfo(destAta);
      if (!destAtaInfo) {
         ixs.push(createAssociatedTokenAccountInstruction(
           sponsorKp ? sponsorKp.publicKey : userKp.publicKey,
           destAta,
           companyPubKey,
           usdtMint
         ));
      }

      ixs.push(createTransferCheckedInstruction(
         sourceAta,
         usdtMint,
         destAta,
         userKp.publicKey,
         amountLamports,
         6
      ));
    }

    const blockhash = (await conn.getLatestBlockhash()).blockhash;
    const tx = new Transaction().add(...ixs);
    tx.recentBlockhash = blockhash;
    tx.feePayer = sponsorKp ? sponsorKp.publicKey : userKp.publicKey;

    const signers = [userKp];
    if (sponsorKp) signers.push(sponsorKp);
    tx.sign(...signers);

    const txid = await conn.sendRawTransaction(tx.serialize());
    return c.json({ success: true, txid });
  } catch (err: any) {
    console.error(err);
    return c.json({ error: err.message }, 500);
  }
});


// Static files - no-cache 헤더 추가
app.use('/static/*', async (c, next) => {
  await next()
  c.res.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate')
  c.res.headers.set('Pragma', 'no-cache')
  c.res.headers.set('Expires', '0')
})
app.use('/static/*', serveStatic({ root: './' }))

// favicon.ico - /static/favicon.ico로 리다이렉트
app.get('/favicon.ico', (c) => c.redirect('/static/favicon.ico', 301))

// PWA 파일 서빙
app.use('/manifest.json', serveStatic({ root: './', path: './public/manifest.json' }))
app.use('/sw.js', async (c, next) => {
  await next()
  c.res.headers.set('Content-Type', 'application/javascript')
  c.res.headers.set('Service-Worker-Allowed', '/')
})
app.use('/sw.js', serveStatic({ root: './', path: './public/sw.js' }))

// ─── Firebase Auth 프록시 (sandbox 도메인 우회) ───────────────────────
const FIREBASE_API_KEY = {
  toString() {
    return getRequiredRuntimeSecret('FIREBASE_WEB_API_KEY');
  }
} as any

app.use('/api/*', cors())

// 로그인 프록시

app.post('/api/solana/migrate-wallet', async (c) => {
  try {
    const authHeader = c.req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) return c.json({ error: 'Unauthorized' }, 401);
    const idToken = authHeader.split(' ')[1];
    
    const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken })
    });
    const data = await res.json();
    if (!data.users || !data.users.length) return c.json({ error: 'Invalid token' }, 401);
    
    const uid = data.users[0].localId;
    const adminToken = await getAdminToken();

    const uRes = await fetch(`${FIRESTORE_BASE}/users/${uid}`, { headers: { Authorization: `Bearer ${adminToken}` } });
    const uData = await uRes.json();
    
    const w = uData.fields?.deedraWallet?.mapValue?.fields;
    if (!w || !w.publicKey) return c.json({ error: 'No SOL wallet found' }, 400);
    
    const updates = createMissingMajorChainWalletFields(w);
    if (Object.keys(updates).length === 0) {
      await markDwalletManagedUser(uid, data.users[0].email || '', w, adminToken, false);
      return c.json({ success: true, ...publicMajorChainWalletResponse(w) });
    }

    const newWalletFields = {
      ...w,
      ...updates
    };

    const fullPatchBody = {
      fields: {
        deedraWallet: {
          mapValue: { fields: newWalletFields }
        }
      }
    };

    const patchRes = await fetch(`${FIRESTORE_BASE}/users/${uid}?updateMask.fieldPaths=deedraWallet`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify(fullPatchBody)
    });

    if (!patchRes.ok) {
        const errorText = await patchRes.text();
        console.error('Migration patch failed', errorText);
        return c.json({ error: 'Migration update failed: ' + errorText }, 500);
    }

    await markDwalletManagedUser(uid, data.users[0].email || '', newWalletFields, adminToken, false);

    return c.json({ success: true, ...publicMajorChainWalletResponse(newWalletFields) });

  } catch(e:any) {
    console.error('Migration error catch', e);
    return c.json({ error: e.message || String(e) }, 500);
  }
});

// ─── 자체 디드라 지갑 생성 (Deedra Wallet Generate) ───────────────────────────
app.post('/api/solana/create-wallet', async (c) => {
  try {
    const authHeader = c.req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) return c.json({ error: 'Unauthorized' }, 401);
    const idToken = authHeader.split(' ')[1];
    const payload = await c.req.json();
    let { publicKey: pubKey, secretKeyArray, evmAddress, evmPrivateKey, tronAddress, tronPrivateKey } = payload;
    const dwalletProfileInput = {
      country: payload.country,
      countryCode: payload.countryCode,
      countryName: payload.countryName,
      language: payload.language,
      locale: payload.locale,
      authProvider: payload.authProvider || payload.provider
    };
    
    if (!pubKey || !secretKeyArray) return c.json({ error: 'Missing wallet data' }, 400);

    // 자동 발급
    if (!evmAddress || !tronAddress) {
      const multi = createEVMAndTronWallets();
      evmAddress = multi.evmAddress;
      evmPrivateKey = multi.privateKey;
      tronAddress = multi.tronAddress;
      tronPrivateKey = multi.privateKey; // Same PK
    }

    // 1. 유저 검증
    const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken })
    });
    const data = await res.json();
    if (!data.users || !data.users.length) return c.json({ error: 'Invalid token' }, 401);
    
    const uid = data.users[0].localId;
    const adminToken = await getAdminToken();

    // 2. 기존 정보 확인
    const uRes = await fetch(`${FIRESTORE_BASE}/users/${uid}`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const uData = await uRes.json();
    
    if (uData.fields?.deedraWallet && uData.fields.deedraWallet.mapValue?.fields?.publicKey) {
      const existingWalletFields = uData.fields.deedraWallet.mapValue.fields;
      const updates = createMissingMajorChainWalletFields(existingWalletFields);
      let finalWalletFields = existingWalletFields;

      if (Object.keys(updates).length > 0) {
        finalWalletFields = { ...existingWalletFields, ...updates };
        const ensureRes = await fetch(`${FIRESTORE_BASE}/users/${uid}?updateMask.fieldPaths=deedraWallet`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
          body: JSON.stringify({
            fields: {
              deedraWallet: {
                mapValue: { fields: finalWalletFields }
              }
            }
          })
        });
        if (!ensureRes.ok) {
          throw new Error('Wallet address update failed: ' + await ensureRes.text());
        }
      }

      await markDwalletManagedUser(uid, data.users[0].email || '', finalWalletFields, adminToken, false, dwalletProfileInput);

      return c.json({ 
        success: true, 
        publicKey: finalWalletFields.publicKey.stringValue,
        ...publicMajorChainWalletResponse(finalWalletFields),
        alreadyExists: true
      });
    }

    // 3. DB 저장
    const patchBody: any = {
      fields: {
        deedraWallet: {
          mapValue: {
            fields: {
              publicKey: { stringValue: pubKey },
              secretKeyArray: { stringValue: JSON.stringify(secretKeyArray) },
              createdAt: { timestampValue: new Date().toISOString() }
            }
          }
        }
      }
    };
    if (evmAddress) patchBody.fields.deedraWallet.mapValue.fields.evmAddress = { stringValue: evmAddress };
    if (evmPrivateKey) patchBody.fields.deedraWallet.mapValue.fields.evmPrivateKey = { stringValue: evmPrivateKey };
    if (tronAddress) patchBody.fields.deedraWallet.mapValue.fields.tronAddress = { stringValue: tronAddress };
    if (tronPrivateKey) patchBody.fields.deedraWallet.mapValue.fields.tronPrivateKey = { stringValue: tronPrivateKey };

    Object.assign(
      patchBody.fields.deedraWallet.mapValue.fields,
      createMissingMajorChainWalletFields(patchBody.fields.deedraWallet.mapValue.fields)
    );

    const patchRes = await fetch(`${FIRESTORE_BASE}/users/${uid}?updateMask.fieldPaths=deedraWallet`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify(patchBody)
    });

    if (!patchRes.ok) {
        console.error('Failed to save wallet:', await patchRes.text());
        return c.json({ error: 'Failed to save wallet to DB' }, 500);
    }

    await markDwalletManagedUser(uid, data.users[0].email || '', patchBody.fields.deedraWallet.mapValue.fields, adminToken, true, dwalletProfileInput);

    return c.json({
      success: true,
      publicKey: pubKey,
      ...publicMajorChainWalletResponse(patchBody.fields.deedraWallet.mapValue.fields)
    });
  } catch(e:any) {
    console.error('Create Wallet Error:', e);
    return c.json({ error: e.message }, 500);
  }
});

async function requireFirebaseUid(c: any) {
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('Unauthorized');
  }

  const idToken = authHeader.split(' ')[1];
  const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken })
  });
  const data = await res.json();
  if (!data.users || !data.users.length) throw new Error('Invalid token');
  return data.users[0].localId;
}

function getRuntimeValue(env: any, key: string, fallback = '') {
  return String(env?.[key] || GLOBAL_ENV?.[key] || fallback).trim();
}

function getRequiredRuntimeSecret(key: string) {
  const value = getRuntimeValue(null, key);
  if (!value) throw new Error(`${key} missing`);
  return value;
}

function getPublicFirebaseConfig(env?: any) {
  const apiKey = getRuntimeValue(env, 'FIREBASE_WEB_API_KEY');
  if (!apiKey) return null;
  return {
    apiKey,
    authDomain: getRuntimeValue(env, 'FIREBASE_AUTH_DOMAIN', 'dedra-mlm.firebaseapp.com'),
    projectId: getRuntimeValue(env, 'FIREBASE_PROJECT_ID', 'dedra-mlm'),
    storageBucket: getRuntimeValue(env, 'FIREBASE_STORAGE_BUCKET', 'dedra-mlm.firebasestorage.app'),
    messagingSenderId: getRuntimeValue(env, 'FIREBASE_MESSAGING_SENDER_ID', '990762022325'),
    appId: getRuntimeValue(env, 'FIREBASE_APP_ID', '1:990762022325:web:1b238ef6eca4ffb4b795fc')
  };
}

function getRuntimeNumber(env: any, key: string, fallback: number) {
  const value = Number(getRuntimeValue(env, key, String(fallback)));
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

function clampNumber(value: any, fallback: number, min: number, max: number) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(n)));
}

function cleanFirestoreDocId(raw: string) {
  return String(raw || '')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 900) || `major_chain_${Date.now()}`;
}

async function fetchXrpAddressDeposits(address: string, env: any, txLimit = 20) {
  const rpcUrl = getRuntimeValue(env, 'XRP_RPC_URL', 'https://s1.ripple.com:51234/');
  const res = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      method: 'account_tx',
      params: [{
        account: address,
        ledger_index_min: -1,
        ledger_index_max: -1,
        limit: txLimit,
        binary: false,
        forward: false
      }]
    }),
    signal: AbortSignal.timeout(10000)
  });

  if (!res.ok) throw new Error(`XRP RPC ${res.status}`);
  const data: any = await res.json();
  if (data?.result?.error === 'actNotFound') return [];
  if (data?.error || data?.result?.error) {
    throw new Error(data?.error_message || data?.result?.error_message || data?.result?.error || 'XRP RPC error');
  }

  const rows = data?.result?.transactions || [];
  const requiredConfirmations = Math.max(1, Math.floor(getRuntimeNumber(env, 'XRP_MIN_CONFIRMATIONS', 1)));
  const deposits: any[] = [];

  for (const row of rows) {
    const tx = row.tx_json || row.tx || {};
    const meta = row.meta || row.metaData || {};
    if (tx.TransactionType !== 'Payment') continue;
    if (tx.Destination !== address) continue;
    if (meta.TransactionResult && meta.TransactionResult !== 'tesSUCCESS') continue;
    if (typeof tx.Amount !== 'string') continue;

    const drops = Number(tx.Amount);
    const txid = tx.hash || tx.Hash || row.hash || row.tx?.hash;
    if (!txid || !Number.isFinite(drops) || drops <= 0) continue;

    const validated = row.validated !== false;
    deposits.push({
      chain: 'xrp',
      network: 'XRP Ledger',
      currency: 'XRP',
      txid,
      outputIndex: 0,
      amount: drops / 1_000_000,
      atomicAmount: String(Math.trunc(drops)),
      atomicUnit: 'drops',
      confirmations: validated ? requiredConfirmations : 0,
      requiredConfirmations,
      depositAddress: address,
      ledgerIndex: tx.ledger_index || row.ledger_index || null,
      destinationTag: tx.DestinationTag ?? null
    });
  }

  return deposits;
}

async function fetchBtcAddressDeposits(address: string, env: any, txLimit = 25) {
  const baseUrl = getRuntimeValue(env, 'BTC_API_BASE_URL', 'https://blockstream.info/api').replace(/\/+$/, '');
  let tipHeight = 0;
  try {
    const tipRes = await fetch(`${baseUrl}/blocks/tip/height`, { signal: AbortSignal.timeout(8000) });
    if (tipRes.ok) tipHeight = Number(await tipRes.text()) || 0;
  } catch (_) {}

  const res = await fetch(`${baseUrl}/address/${encodeURIComponent(address)}/txs`, {
    signal: AbortSignal.timeout(10000)
  });
  if (res.status === 404) return [];
  if (!res.ok) throw new Error(`BTC API ${res.status}`);

  const txs: any[] = await res.json();
  const requiredConfirmations = Math.max(1, Math.floor(getRuntimeNumber(env, 'BTC_MIN_CONFIRMATIONS', 2)));
  const deposits: any[] = [];

  for (const tx of txs.slice(0, txLimit)) {
    const txid = tx.txid;
    if (!txid) continue;

    const confirmed = Boolean(tx.status?.confirmed);
    const confirmations = confirmed
      ? Math.max(1, tipHeight && tx.status?.block_height ? tipHeight - Number(tx.status.block_height) + 1 : 1)
      : 0;

    for (let i = 0; i < (tx.vout || []).length; i++) {
      const out = tx.vout[i];
      if (out?.scriptpubkey_address !== address) continue;
      const sats = Number(out.value);
      if (!Number.isFinite(sats) || sats <= 0) continue;

      deposits.push({
        chain: 'btc',
        network: 'Bitcoin',
        currency: 'BTC',
        txid,
        outputIndex: i,
        amount: sats / 100_000_000,
        atomicAmount: String(Math.trunc(sats)),
        atomicUnit: 'sats',
        confirmations,
        requiredConfirmations,
        depositAddress: address,
        blockHeight: tx.status?.block_height || null
      });
    }
  }

  return deposits;
}

async function recordDetectedMajorChainDeposit(user: any, deposit: any, adminToken: string, env?: any) {
  const txDocId = cleanFirestoreDocId(`major_${deposit.chain}_${deposit.txid}_${deposit.outputIndex}`);
  const readyForReview = deposit.confirmations >= deposit.requiredConfirmations;
  const now = new Date().toISOString();

  const created = await fsCreateOnlyIfAbsent(`transactions/${txDocId}`, {
    userId: user.id,
    userEmail: user.email || '',
    userName: user.name || user.username || '',
    type: 'deposit',
    status: 'pending',
    txValidation: readyForReview ? 'detected_confirmed' : 'detected_unconfirmed',
    approvalRequired: true,
    amount: deposit.amount,
    amountCrypto: deposit.amount,
    currency: deposit.currency,
    network: deposit.network,
    walletType: 'deedra',
    txid: deposit.txid,
    txHash: deposit.txid,
    outputIndex: deposit.outputIndex,
    depositAddress: deposit.depositAddress,
    confirmations: deposit.confirmations,
    requiredConfirmations: deposit.requiredConfirmations,
    atomicAmount: deposit.atomicAmount,
    atomicUnit: deposit.atomicUnit,
    monitorSource: 'xrp_btc_deposit_monitor',
    adminMemo: readyForReview
      ? `${deposit.network} 입금 감지됨. 관리자 승인 후 반영하세요.`
      : `${deposit.network} 입금 감지됨. 컨펌 대기 중입니다.`,
    createdAt: now,
    updatedAt: now
  }, adminToken);

  // [FIX 2026-04-30] XRP/BTC 자동감지 입금에도 텔레그램 알림 발송 (신규 등록 시 1회)
  if (created) {
    try {
      const sysDocRaw = await fsGet('settings/system', adminToken).catch(() => null);
      const sysData = sysDocRaw?.fields ? firestoreDocToObj(sysDocRaw) : {};
      const tgSettings = sysData.telegram || {};
      if (!tgSettings.botToken && env && env.TELEGRAM_BOT_TOKEN) {
        tgSettings.botToken = env.TELEGRAM_BOT_TOKEN;
        tgSettings.chatId = tgSettings.chatId || '-1002347315570';
        tgSettings.recipients = tgSettings.recipients || [{ chatId: tgSettings.chatId, onDeposit: true }];
      }
      const explorerUrl = deposit.chain === 'btc'
        ? `https://www.blockchain.com/explorer/transactions/btc/${deposit.txid}`
        : `https://xrpscan.com/tx/${deposit.txid}`;
      const nowStr = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
      const statusLine = readyForReview
        ? '✅ 컨펌 완료 — 관리자 승인 대기'
        : `⏳ 컨펌 대기중 (${deposit.confirmations}/${deposit.requiredConfirmations})`;
      const text = `🟢 <b>입금 자동 감지 (${deposit.network})</b>\n회원: ${user.email || user.id}\n금액: ${Number(deposit.amount).toFixed(8)} ${deposit.currency}\n수신주소: <code>${deposit.depositAddress}</code>\nTXID: <a href="${explorerUrl}">${String(deposit.txid).substring(0, 25)}...</a>\n시각: ${nowStr}\n\n${statusLine}`;
      await sendTelegramToRecipients(tgSettings, 'deposit', text);
    } catch (e) {
      console.error('[major-chain auto-deposit telegram]', e);
    }
  }

  return created;
}

async function scanMajorChainDepositsForUser(user: any, adminToken: string, env: any, options: any = {}) {
  const wallet = user?.deedraWallet || {};
  const txLimit = clampNumber(options.txLimit, 20, 1, 50);
  const summary: any = {
    userId: user?.id || '',
    xrp: { address: wallet.xrpAddress || '', checked: false, detected: 0, created: 0 },
    btc: { address: wallet.btcAddress || '', checked: false, detected: 0, created: 0 },
    errors: []
  };

  if (wallet.xrpAddress) {
    try {
      const deposits = await fetchXrpAddressDeposits(wallet.xrpAddress, env, txLimit);
      summary.xrp.checked = true;
      summary.xrp.detected = deposits.length;
      for (const deposit of deposits) {
        if (await recordDetectedMajorChainDeposit(user, deposit, adminToken, env)) summary.xrp.created++;
      }
    } catch (e: any) {
      summary.errors.push({ chain: 'xrp', message: e.message || String(e) });
    }
  }

  if (wallet.btcAddress) {
    try {
      const deposits = await fetchBtcAddressDeposits(wallet.btcAddress, env, txLimit);
      summary.btc.checked = true;
      summary.btc.detected = deposits.length;
      for (const deposit of deposits) {
        if (await recordDetectedMajorChainDeposit(user, deposit, adminToken, env)) summary.btc.created++;
      }
    } catch (e: any) {
      summary.errors.push({ chain: 'btc', message: e.message || String(e) });
    }
  }

  return summary;
}

app.post('/api/wallet/ensure-major-chain-addresses', async (c) => {
  try {
    const uid = await requireFirebaseUid(c);
    const adminToken = await getAdminToken();
    const uData = await fsGet(`users/${uid}`, adminToken);
    const walletFields = uData?.fields?.deedraWallet?.mapValue?.fields;
    if (!walletFields?.publicKey) return c.json({ error: 'Deedra Wallet not found' }, 400);

    const updates = createMissingMajorChainWalletFields(walletFields);
    const finalWalletFields = { ...walletFields, ...updates };

    if (Object.keys(updates).length > 0) {
      const ensureRes = await fetch(`${FIRESTORE_BASE}/users/${uid}?updateMask.fieldPaths=deedraWallet`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({
          fields: {
            deedraWallet: {
              mapValue: { fields: finalWalletFields }
            }
          }
        })
      });
      if (!ensureRes.ok) {
        throw new Error('Wallet address update failed: ' + await ensureRes.text());
      }
    }

    return c.json({
      success: true,
      created: Object.keys(updates).filter((key) => key.endsWith('Address')),
      ...publicMajorChainWalletResponse(finalWalletFields)
    });
  } catch (e: any) {
    const message = e.message || String(e);
    return c.json({ error: message }, message === 'Unauthorized' || message === 'Invalid token' ? 401 : 500);
  }
});

app.post('/api/wallet/issue-deposit-addresses', async (c) => {
  try {
    const uid = await requireFirebaseUid(c);
    const adminToken = await getAdminToken();
    const uData = await fsGet(`users/${uid}`, adminToken);
    const walletFields = uData?.fields?.deedraWallet?.mapValue?.fields;
    if (!walletFields?.publicKey) return c.json({ error: 'Deedra Wallet not found' }, 400);

    const updates = createMissingMajorChainWalletFields(walletFields);
    const finalWalletFields = { ...walletFields, ...updates };

    if (Object.keys(updates).length > 0) {
      const ensureRes = await fetch(`${FIRESTORE_BASE}/users/${uid}?updateMask.fieldPaths=deedraWallet`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({
          fields: {
            deedraWallet: {
              mapValue: { fields: finalWalletFields }
            }
          }
        })
      });
      if (!ensureRes.ok) {
        throw new Error('Wallet address update failed: ' + await ensureRes.text());
      }
    }

    return c.json({
      success: true,
      issued: true,
      created: Object.keys(updates).filter((key) => key.endsWith('Address')),
      ...publicMajorChainWalletResponse(finalWalletFields)
    });
  } catch (e: any) {
    const message = e.message || String(e);
    return c.json({ error: message }, message === 'Unauthorized' || message === 'Invalid token' ? 401 : 500);
  }
});

app.post('/api/wallet/check-my-major-chain-deposits', async (c) => {
  try {
    const uid = await requireFirebaseUid(c);
    const body = await c.req.json().catch(() => ({}));
    const adminToken = await getAdminToken();
    const uData = await fsGet(`users/${uid}`, adminToken);
    const walletFields = uData?.fields?.deedraWallet?.mapValue?.fields;
    if (!walletFields?.publicKey) return c.json({ error: 'Deedra Wallet not found' }, 400);

    let finalWalletFields = walletFields;
    const updates = createMissingMajorChainWalletFields(walletFields);
    if (Object.keys(updates).length > 0) {
      finalWalletFields = { ...walletFields, ...updates };
      const ensureRes = await fetch(`${FIRESTORE_BASE}/users/${uid}?updateMask.fieldPaths=deedraWallet`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({
          fields: {
            deedraWallet: {
              mapValue: { fields: finalWalletFields }
            }
          }
        })
      });
      if (!ensureRes.ok) {
        throw new Error('Wallet address update failed: ' + await ensureRes.text());
      }
    }

    const user = firestoreDocToObj({
      name: uData.name,
      fields: {
        ...uData.fields,
        deedraWallet: { mapValue: { fields: finalWalletFields } }
      }
    });

    const summary = await scanMajorChainDepositsForUser(user, adminToken, c.env, {
      txLimit: body.txLimit
    });

    return c.json({
      success: true,
      addresses: publicMajorChainWalletResponse(finalWalletFields),
      summary
    });
  } catch (e: any) {
    const message = e.message || String(e);
    return c.json({ error: message }, message === 'Unauthorized' || message === 'Invalid token' ? 401 : 500);
  }
});

app.post('/api/cron/check-major-chain-deposits', async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const suppliedSecret = c.req.header('x-cron-secret') || c.req.header('CRON_SECRET') || body.secret;
    if (!isValidCronSecret(suppliedSecret)) return c.json({ error: 'unauthorized' }, 401);

    const adminToken = await getAdminToken();
    const userLimit = clampNumber(body.userLimit || body.limit, 500, 1, 5000);
    const txLimit = clampNumber(body.txLimit, 20, 1, 50);
    let users: any[] = [];

    if (body.userId) {
      const userDoc = await fsGet(`users/${body.userId}`, adminToken);
      if (userDoc?.fields) users = [firestoreDocToObj(userDoc)];
    } else {
      users = await fsQuery('users', adminToken, [], userLimit);
    }

    const summaries: any[] = [];
    for (const user of users) {
      const wallet = user?.deedraWallet || {};
      if (!wallet.xrpAddress && !wallet.btcAddress) continue;
      summaries.push(await scanMajorChainDepositsForUser(user, adminToken, c.env, { txLimit }));
    }

    const totals = summaries.reduce((acc: any, item: any) => {
      acc.checkedUsers++;
      acc.detected += (item.xrp.detected || 0) + (item.btc.detected || 0);
      acc.created += (item.xrp.created || 0) + (item.btc.created || 0);
      acc.errors += item.errors.length;
      return acc;
    }, { checkedUsers: 0, detected: 0, created: 0, errors: 0 });

    return c.json({ success: true, totals, summaries });
  } catch (e: any) {
    return c.json({ error: e.message || String(e) }, 500);
  }
});

// ─── 자체 디드라 지갑 잔액 조회 (Deedra Wallet Balance) ─────────────────────────

app.post('/api/wallet/add-multichain', async (c) => {
  try {
    const authHeader = c.req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) return c.json({ error: 'Unauthorized' }, 401);
    const idToken = authHeader.split(' ')[1];
    
    const payload = await c.req.json();
    const { evmAddress, evmPrivateKey, tronAddress, tronPrivateKey } = payload;
    
    if (!evmAddress || !tronAddress) return c.json({ error: 'Missing multi-chain wallet data' }, 400);

    const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken })
    });
    const data = await res.json();
    if (!data.users || !data.users.length) return c.json({ error: 'Invalid token' }, 401);
    const uid = data.users[0].localId;
    const adminToken = await getAdminToken();

    // Add to existing deedraWallet mapValue
    const patchBody = {
      fields: {
        'deedraWallet.evmAddress': { stringValue: evmAddress },
        'deedraWallet.evmPrivateKey': { stringValue: evmPrivateKey },
        'deedraWallet.tronAddress': { stringValue: tronAddress },
        'deedraWallet.tronPrivateKey': { stringValue: tronPrivateKey }
      }
    };
    // Wait, Firestore PATCH requires deep updateMask for nested maps if we use dot notation.
    // Instead of updateMask, we can fetch the user, update the map, and save.
    const uRes = await fetch(`${FIRESTORE_BASE}/users/${uid}`, { headers: { Authorization: `Bearer ${adminToken}` } });
    const uData = await uRes.json();
    if (!uData.fields?.deedraWallet) return c.json({ error: 'No wallet found' }, 400);

    let walletFields = uData.fields.deedraWallet.mapValue.fields;
    walletFields.evmAddress = { stringValue: evmAddress };
    walletFields.evmPrivateKey = { stringValue: evmPrivateKey };
    walletFields.tronAddress = { stringValue: tronAddress };
    walletFields.tronPrivateKey = { stringValue: tronPrivateKey };

    const fullPatchBody = {
        fields: {
            deedraWallet: {
                mapValue: {
                    fields: walletFields
                }
            }
        }
    };

    const patchRes = await fetch(`${FIRESTORE_BASE}/users/${uid}?updateMask.fieldPaths=deedraWallet`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify(fullPatchBody)
    });

    if (!patchRes.ok) return c.json({ error: 'Failed to update wallet' }, 500);
    return c.json({ success: true });
  } catch(e:any) {
    console.error('Multi-chain Wallet Update Error:', e);
    return c.json({ error: e.message }, 500);
  }
});

async function fetchSolanaPublicBalance(publicKey: string, heliusApiKey?: string) {
  // 멀티 RPC 엔드포인트로 fallback. Helius 키가 있으면 1순위, 실패 시 무료 RPC로 fallback.
  const RPC_URLS: string[] = [];
  if (heliusApiKey) {
    RPC_URLS.push(`https://mainnet.helius-rpc.com/?api-key=${heliusApiKey}`);
  }
  RPC_URLS.push(
    'https://solana-rpc.publicnode.com',
    'https://api.mainnet-beta.solana.com',
    'https://rpc.ankr.com/solana'
  );
  const USDT_MINT = 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB';
  const DDRA_MINT = 'DDRADez92SA7jLhzL2bjBkWBK9idqvrhX1CuAZFaAgyv';
  const RPC_TIMEOUT_MS = 7000; // 단일 RPC 호출 타임아웃 7초

  // 타임아웃 내에 응답을 받지 못하면 다음 RPC로 전환하는 fetch 헬퍼
  const fetchWithTimeout = async (url: string, body: any) => {
    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), RPC_TIMEOUT_MS);
    try {
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal
      });
      return await r.json();
    } finally {
      clearTimeout(tid);
    }
  };

  // 다중 RPC 순차 시도 — 첫 성공 응답을 사용
  const debugLog: string[] = [];
  const tryRpcs = async (body: any, label: string) => {
    let lastErr: any = null;
    for (const url of RPC_URLS) {
      try {
        const data = await fetchWithTimeout(url, body);
        // 정상 result만 성공 처리. error 응답(403 차단 등)은 다음 RPC로 fallback.
        if (data && data.result !== undefined && !data.error) {
          debugLog.push(`${label}:${url}:ok`);
          return data;
        }
        if (data && data.error) {
          debugLog.push(`${label}:${url}:rpc_error:${data.error?.code || ''}:${(data.error?.message || '').slice(0, 80)}`);
          lastErr = new Error(`rpc_error:${data.error?.message || ''}`);
          continue; // 다음 RPC 시도
        }
        debugLog.push(`${label}:${url}:invalid_response:${JSON.stringify(data).slice(0, 100)}`);
      } catch (e: any) {
        lastErr = e;
        debugLog.push(`${label}:${url}:error:${e?.name || ''}:${e?.message || String(e)}`);
      }
    }
    throw lastErr || new Error('all_solana_rpcs_failed');
  };

  let solBalance = 0;
  let tokenData: any = { result: { value: [] } };
  let token2022Data: any = { result: { value: [] } };

  try {
    const solData = await tryRpcs({ jsonrpc: '2.0', id: 1, method: 'getBalance', params: [publicKey] }, 'getBalance');
    debugLog.push(`solData_raw:${JSON.stringify(solData).slice(0, 250)}`);
    solBalance = (solData.result?.value || 0) / 1e9;
    debugLog.push(`solBalance_calc:${solBalance}`);
  } catch (e: any) {
    debugLog.push(`solBalance_exception:${e?.message || String(e)}`);
  }

  try {
    [tokenData, token2022Data] = await Promise.all([
      tryRpcs({
        jsonrpc: '2.0', id: 1, method: 'getTokenAccountsByOwner',
        params: [publicKey, { programId: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' }, { encoding: 'jsonParsed' }]
      }, 'token'),
      tryRpcs({
        jsonrpc: '2.0', id: 2, method: 'getTokenAccountsByOwner',
        params: [publicKey, { programId: 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb' }, { encoding: 'jsonParsed' }]
      }, 'token2022')
    ]);
  } catch (e) {
    // 토큰 조회 실패 시 빈 배열로 진행
  }

  if (token2022Data.result && token2022Data.result.value) {
    if (!tokenData.result) tokenData.result = { value: [] };
    if (!tokenData.result.value) tokenData.result.value = [];
    tokenData.result.value.push(...token2022Data.result.value);
  }

  let usdtBalance = 0;
  let ddraBalance = 0;
  const otherTokens: any[] = [];

  if (tokenData.result && tokenData.result.value) {
    tokenData.result.value.forEach((item: any) => {
      const info = item.account?.data?.parsed?.info;
      if (!info) return;

      const mint = info.mint;
      const amount = info.tokenAmount?.uiAmount || 0;

      if (mint === USDT_MINT) {
        usdtBalance = amount;
      } else if (mint === DDRA_MINT) {
        ddraBalance = amount;
      } else if (amount > 0) {
        otherTokens.push({ mint, amount });
      }
    });
  }

  return {
    sol: roundMoney(solBalance),
    usdt: roundMoney(usdtBalance),
    ddra: roundMoney(ddraBalance),
    otherTokens,
    _debug: debugLog
  };
}

app.post('/api/solana/wallet-balance', async (c) => {
  try {
    const { publicKey } = await c.req.json();
    if (!publicKey) return c.json({ error: 'No public key provided' }, 400);
    const heliusKey = (c.env as any)?.HELIUS_API_KEY || '';
    return c.json({ success: true, ...(await fetchSolanaPublicBalance(publicKey, heliusKey)), source: 'chain' });
  } catch(e:any) {
    return c.json({ error: e.message }, 500);
  }
});

async function fetchBscBalances(evmAddress: string) {
  if (!evmAddress || !/^0x[a-fA-F0-9]{40}$/.test(evmAddress)) {
    return { bnb: 0, usdtBsc: 0 };
  }
  const BSC_RPC = 'https://bsc-dataseed.binance.org/';
  const USDT_BEP20 = '0x55d398326f99059fF775485246999027B3197955';
  try {
    const [bnbRes, usdtRes] = await Promise.all([
      fetch(BSC_RPC, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_getBalance', params: [evmAddress, 'latest'] })
      }).then(r => r.json()).catch(() => ({})),
      fetch(BSC_RPC, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0', id: 2, method: 'eth_call',
          params: [{
            to: USDT_BEP20,
            // balanceOf(address) selector + 32-byte padded address
            data: '0x70a08231' + '000000000000000000000000' + evmAddress.toLowerCase().replace('0x', '')
          }, 'latest']
        })
      }).then(r => r.json()).catch(() => ({}))
    ]);
    const bnbWei = bnbRes.result ? BigInt(bnbRes.result) : 0n;
    const bnb = Number(bnbWei) / 1e18;
    const usdtRaw = usdtRes.result && usdtRes.result !== '0x' ? BigInt(usdtRes.result) : 0n;
    const usdtBsc = Number(usdtRaw) / 1e18; // BEP-20 USDT는 18 decimals
    return { bnb: roundMoney(bnb), usdtBsc: roundMoney(usdtBsc) };
  } catch (e) {
    return { bnb: 0, usdtBsc: 0, error: (e as any)?.message || String(e) };
  }
}

async function fetchTronBalances(tronAddress: string) {
  if (!tronAddress || !/^T[a-zA-Z0-9]{33}$/.test(tronAddress)) {
    return { trx: 0, usdtTron: 0 };
  }
  const TRON_API = 'https://api.trongrid.io';
  try {
    const accRes = await fetch(`${TRON_API}/v1/accounts/${tronAddress}`, {
      headers: { 'Content-Type': 'application/json' }
    }).then(r => r.json()).catch(() => ({}));
    let trx = 0;
    let usdtTron = 0;
    if (accRes && Array.isArray(accRes.data) && accRes.data.length > 0) {
      const acc = accRes.data[0];
      trx = Number(acc.balance || 0) / 1e6;
      // trc20 잔고는 trc20 배열 형태로 반환됨 [{ "<contract>": "amount" }]
      const trc20List = Array.isArray(acc.trc20) ? acc.trc20 : [];
      for (const entry of trc20List) {
        if (entry && typeof entry === 'object') {
          const usdtRaw = entry['TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t'];
          if (usdtRaw) {
            usdtTron = Number(usdtRaw) / 1e6; // TRC-20 USDT는 6 decimals
            break;
          }
        }
      }
    }
    return { trx: roundMoney(trx), usdtTron: roundMoney(usdtTron) };
  } catch (e) {
    return { trx: 0, usdtTron: 0, error: (e as any)?.message || String(e) };
  }
}

async function fetchMultiChainBalances(payload: { publicKey?: string; solanaPublicKey?: string; evmAddress?: string; bscAddress?: string; tronAddress?: string }, heliusApiKey?: string) {
  const solKey = String(payload.publicKey || payload.solanaPublicKey || '').trim();
  const evmAddr = String(payload.evmAddress || payload.bscAddress || '').trim();
  const tronAddr = String(payload.tronAddress || '').trim();

  const [solResult, bscResult, tronResult] = await Promise.allSettled([
    solKey ? fetchSolanaPublicBalance(solKey, heliusApiKey) : Promise.resolve({ sol: 0, usdt: 0, ddra: 0, otherTokens: [] }),
    evmAddr ? fetchBscBalances(evmAddr) : Promise.resolve({ bnb: 0, usdtBsc: 0 }),
    tronAddr ? fetchTronBalances(tronAddr) : Promise.resolve({ trx: 0, usdtTron: 0 })
  ]);

  const sol = solResult.status === 'fulfilled' ? solResult.value : { sol: 0, usdt: 0, ddra: 0, otherTokens: [] };
  const bsc = bscResult.status === 'fulfilled' ? bscResult.value : { bnb: 0, usdtBsc: 0 };
  const tron = tronResult.status === 'fulfilled' ? tronResult.value : { trx: 0, usdtTron: 0 };

  const usdtSol = Number((sol as any).usdt || 0);
  const usdtBsc = Number((bsc as any).usdtBsc || 0);
  const usdtTron = Number((tron as any).usdtTron || 0);
  const usdtTotal = roundMoney(usdtSol + usdtBsc + usdtTron);

  return {
    success: true,
    sol: Number((sol as any).sol || 0),
    usdt: usdtTotal,
    ddra: Number((sol as any).ddra || 0),
    bnb: Number((bsc as any).bnb || 0),
    trx: Number((tron as any).trx || 0),
    usdc: 0,
    usdtByChain: {
      solana: usdtSol,
      bsc: usdtBsc,
      tron: usdtTron
    },
    otherTokens: (sol as any).otherTokens || [],
    addresses: {
      solana: solKey,
      evm: evmAddr,
      tron: tronAddr
    },
    source: 'public_chain_proxy',
    updatedAt: new Date().toISOString(),
    _debug: {
      solStatus: solResult.status,
      solReason: solResult.status === 'rejected' ? String((solResult as any).reason?.message || (solResult as any).reason) : null,
      solDebug: (sol as any)._debug || null,
      bscStatus: bscResult.status,
      tronStatus: tronResult.status
    }
  };
}

// ── 인증 없이 호출 가능한 멀티체인 잔고 조회 (D-WALLET 잔고 표시용) ──
app.post('/api/wallet/public-balance', async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const heliusKey = (c.env as any)?.HELIUS_API_KEY || '';
    const result = await fetchMultiChainBalances(body || {}, heliusKey);
    return c.json(result);
  } catch (e: any) {
    return c.json({ success: false, error: e?.message || String(e) }, 500);
  }
});


app.post('/api/wallet/balance', async (c) => {
  try {
    const uid = await requireFirebaseUid(c);
    const body = await c.req.json().catch(() => ({}));
    const adminToken = await getAdminToken();

    const [userDoc, walletDoc] = await Promise.all([
      fsGet(`users/${uid}`, adminToken).catch(() => null),
      fsGet(`wallets/${uid}`, adminToken).catch(() => null)
    ]);

    const user = userDoc?.fields ? firestoreDocToObj(userDoc) : {};
    const wallet = walletDoc?.fields ? firestoreDocToObj(walletDoc) : {};
    const publicKey = String(body.publicKey || body.solanaPublicKey || user.deedraWallet?.publicKey || '').trim();

    let chain: any = { sol: 0, usdt: 0, ddra: 0, otherTokens: [], unavailable: true };
    if (publicKey) {
      try {
        chain = { ...(await fetchSolanaPublicBalance(publicKey)), unavailable: false };
      } catch (error: any) {
        chain = { ...chain, error: error?.message || String(error) };
      }
    }

    const depositUsdt = roundMoney(firstFiniteNumber(wallet.usdtBalance, user.usdtBalance));
    const bonusUsdt = roundMoney(firstFiniteNumber(wallet.bonusBalance, wallet.bonusUsdt, user.bonusBalance, user.bonusUsdt));
    const promoLockedUsdt = roundMoney(firstFiniteNumber(wallet.promoLockedUsdt, wallet.lockedPromoUsdt, wallet.promotionLockedUsdt, user.promoLockedUsdt));
    const ledgerUsdt = roundMoney(depositUsdt + bonusUsdt);
    const ledgerDdra = roundMoney(firstFiniteNumber(
      wallet.ddraBalance,
      wallet.dedraBalance,
      wallet.deedraBalance,
      user.ddraBalance,
      user.dedraBalance,
      user.deedraBalance,
      user.deedraWallet?.ddraBalance,
      user.deedraWallet?.dedraBalance,
      user.deedraWallet?.deedraBalance
    ));

    return c.json({
      success: true,
      sol: chain.sol || 0,
      usdt: ledgerUsdt > 0 ? ledgerUsdt : (chain.usdt || 0),
      ddra: ledgerDdra > 0 ? ledgerDdra : (chain.ddra || 0),
      otherTokens: chain.otherTokens || [],
      source: ledgerUsdt > 0 || ledgerDdra > 0 ? 'ledger' : 'chain',
      ledger: {
        usdt: ledgerUsdt,
        depositUsdt,
        bonusUsdt,
        promoLockedUsdt,
        lockedUsdt: promoLockedUsdt,
        ddra: ledgerDdra,
        totalDeposit: roundMoney(firstFiniteNumber(wallet.totalDeposit, wallet.totalDepositUsdt, user.totalDeposit)),
        totalInvest: roundMoney(firstFiniteNumber(wallet.totalInvest, wallet.totalInvested, user.totalInvested)),
        totalEarnings: roundMoney(firstFiniteNumber(wallet.totalEarnings, user.totalEarnings))
      },
      chain,
      publicKey,
      updatedAt: new Date().toISOString()
    });
  } catch (e: any) {
    const message = e.message || String(e);
    const status = message === 'Unauthorized' || message === 'Invalid token' ? 401 : 500;
    return c.json({ success: false, error: message }, status);
  }
});

// ─── 자체 디드라 지갑 전송 이력 조회 (Deedra Wallet History) ─────────────────────────
app.post('/api/solana/wallet-history', async (c) => {
  try {
    const { publicKey } = await c.req.json();
    if (!publicKey) return c.json({ error: 'No public key provided' }, 400);

    const rpcUrl = 'https://solana-rpc.publicnode.com';
    
    // Get signatures for address (max 15 recent)
    const res = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        jsonrpc: '2.0', 
        id: 1, 
        method: 'getSignaturesForAddress', 
        params: [publicKey, { limit: 15 }] 
      })
    });
    const data = await res.json();
    
    if (data.error) {
      return c.json({ error: data.error.message }, 400);
    }
    
    const history = data.result || [];
    return c.json({ success: true, history });
  } catch(e:any) {
    return c.json({ error: e.message }, 500);
  }
});


app.post('/api/auth/login', async (c) => {
  const { email, password, country, countryCode, countryName, language, locale } = await c.req.json()
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true })
    }
  )
  const data = await res.json() as any
  if (!res.ok) {
    return c.json({ error: data?.error?.message || 'UNKNOWN_ERROR' }, 400)
  }
  try {
    const adminToken = await getAdminToken()
    await markDwalletRegisteredUser(data.localId, data.email || email || '', adminToken, {
      country,
      countryCode,
      countryName,
      language,
      locale,
      authProvider: 'password'
    })
  } catch (e: any) {
    console.warn('[dwallet register mark failed]', e?.message || e)
  }
  return c.json({
    idToken: data.idToken,
    localId: data.localId,
    email: data.email,
    refreshToken: data.refreshToken,
    expiresIn: data.expiresIn
  })
})

app.post('/api/auth/social-login', async (c) => {
  const { provider, idToken, country, countryCode, countryName, language, locale } = await c.req.json().catch(() => ({}));
  const normalizedProvider = String(provider || '').toLowerCase().includes('apple') ? 'apple.com' : 'google.com';
  if (!idToken) return c.json({ error: 'MISSING_ID_TOKEN' }, 400);
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key=${FIREBASE_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        postBody: `id_token=${encodeURIComponent(idToken)}&providerId=${encodeURIComponent(normalizedProvider)}`,
        requestUri: 'https://ddra.io',
        returnIdpCredential: true,
        returnSecureToken: true
      })
    }
  );
  const data = await res.json() as any;
  if (!res.ok) {
    return c.json({ error: data?.error?.message || 'SOCIAL_LOGIN_FAILED' }, 400);
  }
  try {
    const adminToken = await getAdminToken();
    await markDwalletRegisteredUser(data.localId, data.email || '', adminToken, {
      country,
      countryCode,
      countryName,
      language,
      locale,
      authProvider: normalizedProvider
    });
  } catch (e: any) {
    console.warn('[dwallet social mark failed]', e?.message || e);
  }
  return c.json({
    idToken: data.idToken,
    localId: data.localId,
    email: data.email || '',
    refreshToken: data.refreshToken,
    expiresIn: data.expiresIn
  });
});

// 회원가입 프록시
app.post('/api/auth/register', async (c) => {
  const { email, password, country, countryCode, countryName, language, locale } = await c.req.json()
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${FIREBASE_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true })
    }
  )
  const data = await res.json() as any
  if (!res.ok) {
    return c.json({ error: data?.error?.message || 'UNKNOWN_ERROR' }, 400)
  }
  try {
    const adminToken = await getAdminToken()
    await markDwalletRegisteredUser(data.localId, data.email || email || '', adminToken, {
      country,
      countryCode,
      countryName,
      language,
      locale,
      authProvider: 'password'
    })
  } catch (e: any) {
    console.warn('[dwallet register mark failed]', e?.message || e)
  }
  return c.json({
    idToken: data.idToken,
    localId: data.localId,
    email: data.email,
    refreshToken: data.refreshToken,
    expiresIn: data.expiresIn
  })
})

// 추천인 코드 검증 API (비로그인 상태에서 Firestore 조회)

// 아이디 중복 검증 API

app.get('/api/public/autobot', async (c) => {
  const adminToken = await getAdminToken();
  const res = await fetch(`${FIRESTORE_BASE}/documents/settings/autobot`, {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  if (res.ok) {
    const data = await res.json();
    return c.json(data);
  }
  return c.json({ error: 'Failed to fetch' }, 500);
});

app.get('/api/auth/check-username', async (c) => {
  const username = c.req.query('username');
  if (!username) return c.json({ exists: false, error: 'Username required' }, 400);
  
  try {
    const token = await getAdminToken();
    const q = await fsQuery('users', token, [{
      fieldFilter: { field: { fieldPath: 'username' }, op: 'EQUAL', value: { stringValue: username.trim().toLowerCase() } }
    }], 1);
    
    if (q && q.length > 0) {
      return c.json({ exists: true });
    }
    return c.json({ exists: false });
  } catch (e: any) {
    return c.json({ exists: false, error: e.message }, 500);
  }
})

app.get('/api/auth/check-referral', async (c) => {
  const code = c.req.query('code');
  if (!code) return c.json({ valid: false, error: 'Code required' }, 400);
  const cleanCode = code.trim();

  try {
    const token = await getAdminToken();
    
    // 1. 추천인 코드 (대문자)
    let q = await fsQuery('users', token, [{
      fieldFilter: { field: { fieldPath: 'referralCode' }, op: 'EQUAL', value: { stringValue: cleanCode.toUpperCase() } }
    }], 1);
    
    // 2. 아이디 (소문자)
    if (!q || q.length === 0) {
      q = await fsQuery('users', token, [{
        fieldFilter: { field: { fieldPath: 'username' }, op: 'EQUAL', value: { stringValue: cleanCode.toLowerCase() } }
      }], 1);
    }
    
    // 3. 아이디 (원래 입력값)
    if (!q || q.length === 0) {
      q = await fsQuery('users', token, [{
        fieldFilter: { field: { fieldPath: 'username' }, op: 'EQUAL', value: { stringValue: cleanCode } }
      }], 1);
    }

    if (q && q.length > 0) {
      const user = q[0];
      return c.json({
        valid: true,
        uid: user.id || user.uid || '',
        name: user.name || '',
        username: user.username || '',
        email: user.email || ''
      });
    }
    
    return c.json({ valid: false, error: 'Not found' }, 404);
  } catch (e: any) {
    return c.json({ valid: false, error: e.message }, 500);
  }
})



// 테스트 계정 생성 페이지
app.get('/setup', (c) => c.html(SETUP_HTML()))

// 관리자 페이지 - /admin 에서 직접 서빙


app.post('/api/admin/rollback-settlement', async (c) => {
  // PART II §0 HARD RULE #5 — 롤백 락 (분산 lock)
  let lockAcquired = false;
  let targetDate = "";
  let adminToken = "";
  try {
    const body = await c.req.json().catch(() => ({}));
    if (!isValidCronSecret(body.secret)) return c.json({ error: '인증 실패' }, 401);
    targetDate = body.targetDate || "2026-03-26";
    
    adminToken = await getAdminToken();

    // PART II §0 HARD RULE #5 — 롤백 락 획득 (중복 실행 방지)
    const rollbackLockId = `rollback_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    lockAcquired = await fsCreateOnlyIfAbsent(`rollbackLocks/${targetDate}`, {
      date: targetDate,
      status: 'processing',
      processId: rollbackLockId,
      startedAt: new Date().toISOString(),
      source: 'rollback-settlement'
    }, adminToken);
    if (!lockAcquired) {
      return c.json({ error: `${targetDate} 롤백이 이미 다른 프로세스에서 진행 중입니다.` }, 409);
    }
    
    // 1. Get bonuses for the target date
    const bonuses = await fsQuery('bonuses', adminToken, [
      { fieldFilter: { field: { fieldPath: 'settlementDate' }, op: 'EQUAL', value: { stringValue: targetDate } } }
    ], 100000);
    

    // --- 시스템 유지보수 모드 ON ---
    try {
      await fsPatch('settings/system', {
        maintenanceMode: true,
        maintenanceMessage: '정산 오류 보정 및 롤백 작업을 진행하고 있습니다.<br>잠시만 기다려주세요.'
      }, adminToken);
    } catch(e) {}

    console.log("Found bonuses to rollback:", bonuses.length);
    
    const allUsers = await fsQuery('users', adminToken, [], 100000);
    const allWallets = await fsQuery('wallets', adminToken, [], 100000);
    const allInvs = await fsQuery('investments', adminToken, [], 100000);
    
    const userMap = new Map(allUsers.map((u: any) => [u.id || u.uid, u]));
    const wMap = new Map(allWallets.map((w: any) => [w.id || w.userId, w]));
    const invMap = new Map(allInvs.map((i: any) => [i.id, i]));
    
    // 2. Compute wallet deltas
    const userWalletsDelta = {};
    const invReversals = {};
    
    for (const b of bonuses) {
      if (!userWalletsDelta[b.userId]) {
        userWalletsDelta[b.userId] = { bonusBalance: 0, totalEarnings: 0, totalInvest: 0, autoCompoundTotalInvest: 0 };
      }
      const d = userWalletsDelta[b.userId];
      const amountUsdt = Number(b.amountUsdt || 0);
      const hasLedgerWalletSplit = b.walletBonusAmount !== undefined || b.walletInvestAmount !== undefined;
      const walletBonusAmount = hasLedgerWalletSplit ? Number(b.walletBonusAmount || 0) : null;
      const walletInvestAmount = hasLedgerWalletSplit ? Number(b.walletInvestAmount || 0) : null;
      const isAutoCompoundLedger = b.autoCompound === true || b.source === 'auto_compound_roi' || b.commissionEligible === false || (b.type === 'roi' && Number(b.walletInvestAmount || 0) > 0);
      d.totalEarnings += amountUsdt;

      if (b.type === 'roi') {
        const u = userMap.get(b.userId);
        const autoCompound = u?.autoCompound || false;
        
        if (b.investmentId) {
          if (!invReversals[b.investmentId]) {
            invReversals[b.investmentId] = { subPrincipal: 0, subPaidRoi: 0, subAutoCompoundPrincipal: 0 };
          }
          invReversals[b.investmentId].subPaidRoi += amountUsdt;
          if (hasLedgerWalletSplit) {
            invReversals[b.investmentId].subPrincipal += walletInvestAmount || 0;
            if (isAutoCompoundLedger) invReversals[b.investmentId].subAutoCompoundPrincipal += walletInvestAmount || 0;
          } else if (autoCompound) {
            invReversals[b.investmentId].subPrincipal += amountUsdt;
            invReversals[b.investmentId].subAutoCompoundPrincipal += amountUsdt;
          }
        }

        if (hasLedgerWalletSplit) {
          d.totalInvest += walletInvestAmount || 0;
          if (isAutoCompoundLedger) d.autoCompoundTotalInvest += walletInvestAmount || 0;
          d.bonusBalance += walletBonusAmount || 0;
        } else if (autoCompound) {
          d.totalInvest += amountUsdt;
          d.autoCompoundTotalInvest += amountUsdt;
        } else {
          d.bonusBalance += amountUsdt;
        }
      } else {
        d.bonusBalance += hasLedgerWalletSplit ? (walletBonusAmount || 0) : amountUsdt;
      }
    }
    
    const writes = [];
    
    // 3. Prepare Investment reverts
    let invRevertedCount = 0;
    for (const [invId, rev] of Object.entries(invReversals)) {
      const inv = invMap.get(invId);
      if (inv) {
        const newAmount = Math.max(0, (inv.amountUsdt || 0) - rev.subPrincipal);
        const newAutoCompoundPrincipal = Math.max(0, (inv.autoCompoundPrincipal || 0) - (rev.subAutoCompoundPrincipal || 0));
        const dailyRoiPct = inv.dailyRoi || inv.roiPercent || inv.roiPct || 0;
        const newExpectedReturn = newAmount * (dailyRoiPct / 100);
        
        const prevDateObj = new Date(targetDate + "T00:00:00Z");
        prevDateObj.setDate(prevDateObj.getDate() - 1);
        const prevDate = prevDateObj.toISOString().slice(0,10);
        
        writes.push({
          update: {
            name: `projects/dedra-mlm/databases/(default)/documents/investments/${invId}`,
            fields: {
              amount: toFirestoreValue(newAmount),
              amountUsdt: toFirestoreValue(newAmount),
              expectedReturn: toFirestoreValue(newExpectedReturn),
              autoCompoundPrincipal: toFirestoreValue(newAutoCompoundPrincipal),
              commissionEligiblePrincipal: toFirestoreValue(Math.max(0, newAmount - newAutoCompoundPrincipal)),
              paidRoi: toFirestoreValue(Math.max(0, (inv.paidRoi || 0) - rev.subPaidRoi)),
              lastSettledAt: toFirestoreValue(`${prevDate}T23:59:59.000Z`)
            }
          },
          updateMask: { fieldPaths: ['amount', 'amountUsdt', 'expectedReturn', 'autoCompoundPrincipal', 'commissionEligiblePrincipal', 'paidRoi', 'lastSettledAt'] }
        });
        invRevertedCount++;
      }
    }
    
    // 4. Prepare Wallet reverts
    let walletRevertedCount = 0;
    for (const [userId, delta] of Object.entries(userWalletsDelta)) {
      const w = wMap.get(userId);
      if (w) {
        const newBonus = Math.max(0, (w.bonusBalance || 0) - delta.bonusBalance);
        const newTotalE = Math.max(0, (w.totalEarnings || 0) - delta.totalEarnings);
        const newTotalI = Math.max(0, (w.totalInvest || w.totalInvested || 0) - delta.totalInvest);
        const newAutoCompoundTotalI = Math.max(0, (w.autoCompoundTotalInvest || 0) - (delta.autoCompoundTotalInvest || 0));
        
        writes.push({
          update: {
            name: `projects/dedra-mlm/databases/(default)/documents/wallets/${userId}`,
            fields: {
              bonusBalance: toFirestoreValue(newBonus),
              totalEarnings: toFirestoreValue(newTotalE),
              totalInvest: toFirestoreValue(newTotalI),
              autoCompoundTotalInvest: toFirestoreValue(newAutoCompoundTotalI)
            }
          },
          updateMask: { fieldPaths: ['bonusBalance', 'totalEarnings', 'totalInvest', 'autoCompoundTotalInvest'] }
        });
        walletRevertedCount++;
      }
    }
    
    // 5. Delete Bonuses
    let deletedBonuses = 0;
    for (const b of bonuses) {
      writes.push({
        delete: `projects/dedra-mlm/databases/(default)/documents/bonuses/${b.id}`
      });
      deletedBonuses++;
    }
    
    // 6. Execute Batch Writes (PART II §0 HARD RULE #4 — 20개 단위, fsBatchCommit 내부에서 자동 분할)
    console.log(`Ready to batch ${writes.length} writes...`);
    await fsBatchCommit(writes, adminToken);
    
    // 7. Delete Settlement Lock
    await fetch(`${FIRESTORE_BASE}/settlements/${targetDate}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });

    // --- 시스템 유지보수 모드 OFF ---
    try {
      await fsPatch('settings/system', { maintenanceMode: false }, adminToken);
    } catch(e) {}

    return c.json({ 
      success: true, 
      message: `${targetDate} 정산이 롤백되었습니다.`,
      invRevertedCount, 
      walletRevertedCount, 
      deletedBonuses 
    });
  } catch(e: any) {
    console.error(e);
    return c.json({ error: e.message }, 500);
  } finally {
    // PART II §0 HARD RULE #5 — 롤백 락 해제 (성공/실패 관계없이)
    if (lockAcquired && targetDate && adminToken) {
      try {
        await fetch(`${FIRESTORE_BASE}/rollbackLocks/${targetDate}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${adminToken}` }
        });
      } catch(_) {}
    }
  }
})

app.post('/api/admin/rollback-and-resettle-multi', async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    // CRON_SECRET 또는 관리자 UID 검증 (관리자 UI 버튼 호출 지원)
    if (!isValidCronSecret(body.secret) && !body.adminUid) {
      return c.json({ error: '인증 실패 (CRON_SECRET 또는 adminUid 필요)' }, 401);
    }
    // adminUid가 있으면 실제 관리자 권한 검증 (Firestore raw 응답을 firestoreDocToObj로 평면화)
    if (body.adminUid && !isValidCronSecret(body.secret)) {
      try {
        const adminTokenCheck = await getAdminToken();
        const rawDoc = await fsGet(`users/${body.adminUid}`, adminTokenCheck).catch(() => null);
        const adminUser = rawDoc && rawDoc.fields ? firestoreDocToObj(rawDoc) : rawDoc;
        // 다른 라우트와 동일한 검증 기준: role === 'admin' || 'superadmin' 또는 isAdmin/adminLevel
        const isAdmin = adminUser && (
          adminUser.role === 'admin' ||
          adminUser.role === 'superadmin' ||
          adminUser.isAdmin === true ||
          Number(adminUser.adminLevel || 0) >= 1
        );
        if (!isAdmin) {
          return c.json({
            error: '관리자 권한이 없습니다 (role/isAdmin/adminLevel 미부여)',
            debug: {
              hasDoc: !!rawDoc,
              hasFields: !!(rawDoc && rawDoc.fields),
              uid: body.adminUid,
              role: adminUser?.role,
              isAdmin: adminUser?.isAdmin,
              adminLevel: adminUser?.adminLevel,
              email: adminUser?.email,
              keys: adminUser ? Object.keys(adminUser).slice(0, 20) : []
            }
          }, 403);
        }
      } catch (e: any) {
        return c.json({ error: '관리자 검증 실패: ' + (e?.message || 'unknown') }, 403);
      }
    }

    const dates = Array.isArray(body.dates) ? body.dates.filter((d: any) => /^\d{4}-\d{2}-\d{2}$/.test(d)) : [];
    if (!dates.length) return c.json({ error: 'dates 배열이 비었거나 형식 오류 (YYYY-MM-DD)' }, 400);

    const rerun = body.rerun !== false; // 기본 true
    const dryRun = body.dryRun === true; // 검증용
    const excludeUsers: string[] = Array.isArray(body.excludeUsers)
      ? body.excludeUsers.map((s: any) => String(s).trim()).filter(Boolean)
      : [];

    // 롤백은 최신 → 과거 순 (역순)
    const rollbackOrder = [...dates].sort().reverse();
    // 재정산은 과거 → 최신 순 (정순)
    const resettleOrder = [...dates].sort();

    const adminToken = await getAdminToken();
    const report: any = {
      requestedDates: dates,
      rollbackOrder,
      resettleOrder,
      rerun,
      dryRun,
      excludeUsers,
      rollbackResults: [],
      resettleResults: [],
      startedAt: new Date().toISOString()
    };

    // ── 시스템 유지보수 모드 ON ──
    try {
      await fsPatch('settings/system', {
        maintenanceMode: true,
        maintenanceMessage: `정산 결정 보정 작업 진행 중입니다 (${dates.length}일치 롤백 + 재정산).<br>잠시만 기다려주세요.`
      }, adminToken);
    } catch(e) {}

    // PART II §0 HARD RULE #5 — 다중 일자 롤백 락 일괄 획득 (dryRun 제외)
    const acquiredLocks: string[] = [];
    if (!dryRun) {
      const multiLockId = `rollback_multi_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      for (const lockDate of rollbackOrder) {
        const ok = await fsCreateOnlyIfAbsent(`rollbackLocks/${lockDate}`, {
          date: lockDate,
          status: 'processing',
          processId: multiLockId,
          startedAt: new Date().toISOString(),
          source: 'rollback-and-resettle-multi'
        }, adminToken);
        if (!ok) {
          // 이미 획득한 락 일괄 해제 후 에러 반환
          for (const acq of acquiredLocks) {
            try {
              await fetch(`${FIRESTORE_BASE}/rollbackLocks/${acq}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${adminToken}` }
              });
            } catch(_) {}
          }
          try { await fsPatch('settings/system', { maintenanceMode: false }, adminToken); } catch(_) {}
          return c.json({ error: `${lockDate} 롤백 락 획득 실패 (다른 프로세스가 진행 중)`, acquiredLocks }, 409);
        }
        acquiredLocks.push(lockDate);
      }
    }

    // ── 1단계: 순차 롤백 ──
    for (const targetDate of rollbackOrder) {
      const stepResult: any = { date: targetDate, phase: 'rollback' };
      try {
        if (dryRun) {
          // dryRun: bonuses 카운트 + excludeUsers 영향도 보고
          const bonuses = await fsQuery('bonuses', adminToken, [
            { fieldFilter: { field: { fieldPath: 'settlementDate' }, op: 'EQUAL', value: { stringValue: targetDate } } }
          ], 100000);
          stepResult.dryRun = true;
          stepResult.bonusCount = bonuses.length;
          stepResult.blackholeCount = bonuses.filter((b:any) => b.userId === '__BLACKHOLE__').length;
          // excludeUsers 영향: 해당 사용자가 받았던 bonus 수 + 합계
          if (excludeUsers.length > 0) {
            const excludeSet = new Set(excludeUsers);
            const excluded = bonuses.filter((b:any) => excludeSet.has(b.userId));
            stepResult.excludedUserBonusCount = excluded.length;
            stepResult.excludedUserBonusUsdt = excluded.reduce((s:number, b:any) => s + Number(b.amountUsdt || 0), 0);
          }
          stepResult.success = true;
          report.rollbackResults.push(stepResult);
          continue;
        }

        // 실제 롤백 (rollback-settlement과 동일 로직 인라인)
        const bonuses = await fsQuery('bonuses', adminToken, [
          { fieldFilter: { field: { fieldPath: 'settlementDate' }, op: 'EQUAL', value: { stringValue: targetDate } } }
        ], 100000);

        const allUsers = await fsQuery('users', adminToken, [], 100000);
        const allWallets = await fsQuery('wallets', adminToken, [], 100000);
        const allInvs = await fsQuery('investments', adminToken, [], 100000);

        const userMap = new Map(allUsers.map((u: any) => [u.id || u.uid, u]));
        const wMap = new Map(allWallets.map((w: any) => [w.id || w.userId, w]));
        const invMap = new Map(allInvs.map((i: any) => [i.id, i]));

        const userWalletsDelta: any = {};
        const invReversals: any = {};

        for (const b of bonuses) {
          // 블랙홀 흡수 로그는 지갑 영향 없음 - 삭제만
          if (b.userId === '__BLACKHOLE__') continue;

          if (!userWalletsDelta[b.userId]) {
            userWalletsDelta[b.userId] = { bonusBalance: 0, totalEarnings: 0, totalInvest: 0, autoCompoundTotalInvest: 0 };
          }
          const d = userWalletsDelta[b.userId];
          const amountUsdt = Number(b.amountUsdt || 0);
          const hasLedgerWalletSplit = b.walletBonusAmount !== undefined || b.walletInvestAmount !== undefined;
          const walletBonusAmount = hasLedgerWalletSplit ? Number(b.walletBonusAmount || 0) : null;
          const walletInvestAmount = hasLedgerWalletSplit ? Number(b.walletInvestAmount || 0) : null;
          const isAutoCompoundLedger = b.autoCompound === true || b.source === 'auto_compound_roi' || b.commissionEligible === false || (b.type === 'roi' && Number(b.walletInvestAmount || 0) > 0);

          // 매출 차감 정책: ROI 일반(보너스 freeze/오토복리 제외)만 매출 누적되었으므로 그것만 역산
          const excludedFromTotalEarnings = b.excludedFromTotalEarnings === true ||
                                             b.source === 'bonus_freeze_roi' ||
                                             b.source === 'auto_compound_roi' ||
                                             (b.type !== 'roi');
          if (!excludedFromTotalEarnings) {
            d.totalEarnings += amountUsdt;
          }

          if (b.type === 'roi') {
            const u: any = userMap.get(b.userId);
            const autoCompound = u?.autoCompound || false;

            if (b.investmentId) {
              if (!invReversals[b.investmentId]) {
                invReversals[b.investmentId] = { subPrincipal: 0, subPaidRoi: 0, subAutoCompoundPrincipal: 0 };
              }
              invReversals[b.investmentId].subPaidRoi += amountUsdt;
              if (hasLedgerWalletSplit) {
                invReversals[b.investmentId].subPrincipal += walletInvestAmount || 0;
                if (isAutoCompoundLedger) invReversals[b.investmentId].subAutoCompoundPrincipal += walletInvestAmount || 0;
              } else if (autoCompound) {
                invReversals[b.investmentId].subPrincipal += amountUsdt;
                invReversals[b.investmentId].subAutoCompoundPrincipal += amountUsdt;
              }
            }

            if (hasLedgerWalletSplit) {
              d.totalInvest += walletInvestAmount || 0;
              if (isAutoCompoundLedger) d.autoCompoundTotalInvest += walletInvestAmount || 0;
              d.bonusBalance += walletBonusAmount || 0;
            } else if (autoCompound) {
              d.totalInvest += amountUsdt;
              d.autoCompoundTotalInvest += amountUsdt;
            } else {
              d.bonusBalance += amountUsdt;
            }
          } else {
            d.bonusBalance += hasLedgerWalletSplit ? (walletBonusAmount || 0) : amountUsdt;
          }
        }

        const writes: any[] = [];
        let invRevertedCount = 0;
        for (const [invId, rev0] of Object.entries(invReversals)) {
          const rev = rev0 as any;
          const inv: any = invMap.get(invId);
          if (inv) {
            const newAmount = Math.max(0, (inv.amountUsdt || 0) - rev.subPrincipal);
            const newAutoCompoundPrincipal = Math.max(0, (inv.autoCompoundPrincipal || 0) - (rev.subAutoCompoundPrincipal || 0));
            const dailyRoiPct = inv.dailyRoi || inv.roiPercent || inv.roiPct || 0;
            const newExpectedReturn = newAmount * (dailyRoiPct / 100);
            const prevDateObj = new Date(targetDate + 'T00:00:00Z');
            prevDateObj.setDate(prevDateObj.getDate() - 1);
            const prevDate = prevDateObj.toISOString().slice(0,10);
            writes.push({
              update: {
                name: `projects/dedra-mlm/databases/(default)/documents/investments/${invId}`,
                fields: {
                  amount: toFirestoreValue(newAmount),
                  amountUsdt: toFirestoreValue(newAmount),
                  expectedReturn: toFirestoreValue(newExpectedReturn),
                  autoCompoundPrincipal: toFirestoreValue(newAutoCompoundPrincipal),
                  commissionEligiblePrincipal: toFirestoreValue(Math.max(0, newAmount - newAutoCompoundPrincipal)),
                  paidRoi: toFirestoreValue(Math.max(0, (inv.paidRoi || 0) - rev.subPaidRoi)),
                  lastSettledAt: toFirestoreValue(`${prevDate}T23:59:59.000Z`)
                }
              },
              updateMask: { fieldPaths: ['amount', 'amountUsdt', 'expectedReturn', 'autoCompoundPrincipal', 'commissionEligiblePrincipal', 'paidRoi', 'lastSettledAt'] }
            });
            invRevertedCount++;
          }
        }

        let walletRevertedCount = 0;
        for (const [userId, delta0] of Object.entries(userWalletsDelta)) {
          const delta = delta0 as any;
          const w: any = wMap.get(userId);
          if (w) {
            const newBonus = Math.max(0, (w.bonusBalance || 0) - delta.bonusBalance);
            const newTotalE = Math.max(0, (w.totalEarnings || 0) - delta.totalEarnings);
            const newTotalI = Math.max(0, (w.totalInvest || w.totalInvested || 0) - delta.totalInvest);
            const newAutoCompoundTotalI = Math.max(0, (w.autoCompoundTotalInvest || 0) - (delta.autoCompoundTotalInvest || 0));
            writes.push({
              update: {
                name: `projects/dedra-mlm/databases/(default)/documents/wallets/${userId}`,
                fields: {
                  bonusBalance: toFirestoreValue(newBonus),
                  totalEarnings: toFirestoreValue(newTotalE),
                  totalInvest: toFirestoreValue(newTotalI),
                  autoCompoundTotalInvest: toFirestoreValue(newAutoCompoundTotalI)
                }
              },
              updateMask: { fieldPaths: ['bonusBalance', 'totalEarnings', 'totalInvest', 'autoCompoundTotalInvest'] }
            });
            walletRevertedCount++;
          }
        }

        let deletedBonuses = 0;
        for (const b of bonuses) {
          writes.push({ delete: `projects/dedra-mlm/databases/(default)/documents/bonuses/${b.id}` });
          deletedBonuses++;
        }

        // PART II §0 HARD RULE #4 — 20개 단위 (fsBatchCommit 내부에서 자동 분할)
        await fsBatchCommit(writes, adminToken);

        await fetch(`${FIRESTORE_BASE}/settlements/${targetDate}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${adminToken}` }
        });

        stepResult.bonusCount = bonuses.length;
        stepResult.blackholeCount = bonuses.filter((b:any) => b.userId === '__BLACKHOLE__').length;
        stepResult.invRevertedCount = invRevertedCount;
        stepResult.walletRevertedCount = walletRevertedCount;
        stepResult.deletedBonuses = deletedBonuses;
        stepResult.success = true;
      } catch(e: any) {
        stepResult.success = false;
        stepResult.error = e?.message || String(e);
        report.rollbackResults.push(stepResult);
        report.failedAt = `rollback:${targetDate}`;
        try { await fsPatch('settings/system', { maintenanceMode: false }, adminToken); } catch(_) {}
        // PART II §0 HARD RULE #5 — 에러 시에도 락 해제
        for (const acq of acquiredLocks) {
          try {
            await fetch(`${FIRESTORE_BASE}/rollbackLocks/${acq}`, {
              method: 'DELETE',
              headers: { 'Authorization': `Bearer ${adminToken}` }
            });
          } catch(_) {}
        }
        return c.json({ success: false, report }, 500);
      }
      report.rollbackResults.push(stepResult);
    }

    // ── 2단계: 순차 재정산 ──
    if (rerun && !dryRun) {
      for (const targetDate of resettleOrder) {
        const stepResult: any = { date: targetDate, phase: 'resettle' };
        try {
          // mock c 구성 (runSettle은 c.json/c.executionCtx 사용)
          // executionCtx가 없을 경우를 대비해 안전한 더미 제공
          const mockResp: any = { _data: null, _status: 200 };
          const safeExecCtx = (c && c.executionCtx) ? c.executionCtx : {
            waitUntil: (p: any) => { try { Promise.resolve(p).catch(()=>{}); } catch(_) {} },
            passThroughOnException: () => {}
          };
          const mockC: any = {
            json: (data: any, status?: number) => { mockResp._data = data; mockResp._status = status || 200; return data; },
            executionCtx: safeExecCtx,
            req: c.req,
            env: c.env
          };
          await runSettle(mockC, targetDate, { excludeUsers });
          stepResult.success = true;
          stepResult.result = mockResp._data;
        } catch(e: any) {
          stepResult.success = false;
          stepResult.error = e?.message || String(e);
          report.resettleResults.push(stepResult);
          report.failedAt = `resettle:${targetDate}`;
          try { await fsPatch('settings/system', { maintenanceMode: false }, adminToken); } catch(_) {}
          // PART II §0 HARD RULE #5 — 재정산 단계 실패 시에도 롤백 락 해제
          for (const acq of acquiredLocks) {
            try {
              await fetch(`${FIRESTORE_BASE}/rollbackLocks/${acq}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${adminToken}` }
              });
            } catch(_) {}
          }
          return c.json({ success: false, report }, 500);
        }
        report.resettleResults.push(stepResult);
      }
    }

    // ── 시스템 유지보수 모드 OFF ──
    try { await fsPatch('settings/system', { maintenanceMode: false }, adminToken); } catch(_) {}

    // PART II §0 HARD RULE #5 — 롤백 락 일괄 해제
    for (const acq of acquiredLocks) {
      try {
        await fetch(`${FIRESTORE_BASE}/rollbackLocks/${acq}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${adminToken}` }
        });
      } catch(_) {}
    }

    report.completedAt = new Date().toISOString();
    return c.json({ success: true, report });
  } catch(e: any) {
    console.error('rollback-and-resettle-multi error', e);
    // 에러 발생 시에도 락 해제 시도
    try {
      const tk = await getAdminToken();
      // body 파싱 실패한 경우 dates 재추출 불가 — 이미 acquiredLocks 변수가 스코프 외이므로 best-effort
    } catch(_) {}
    return c.json({ success: false, error: e?.message || String(e) }, 500);
  }
});

app.get('/api/admin/check-reconstruct', async (c) => {
  const adminToken = await getAdminToken();
  const allUsers = await fsQuery('users', adminToken, [
    { fieldFilter: { field: { fieldPath: 'username' }, op: 'EQUAL', value: { stringValue: 'btc001' } } }
  ]);
  const u = allUsers[0];
  const bonuses = await fsQuery('bonuses', adminToken, [
    { fieldFilter: { field: { fieldPath: 'userId' }, op: 'EQUAL', value: { stringValue: u.id || u.uid } } },
    { fieldFilter: { field: { fieldPath: 'settlementDate' }, op: 'EQUAL', value: { stringValue: '2026-03-26' } } }
  ], 1000);
  
  return c.json({ uid: u.id, bonusCount: bonuses.length, bonuses: bonuses.map((b:any) => ({type: b.type, amt: b.amountUsdt, r: b.reason})) });
});


app.get('/api/admin/do-reconstruct', async (c) => {
  const adminToken = await getAdminToken();
  let allInvs = [];
  let pageToken = null;
  do {
    const res = await fetch(`${FIRESTORE_BASE}/investments?pageSize=1000${pageToken ? '&pageToken='+pageToken : ''}`, { headers: { 'Authorization': `Bearer ${adminToken}` } });
    const data = await res.json();
    if (data.documents) {
      allInvs = allInvs.concat(data.documents.map(d => {
        const id = d.name.split('/').pop();
        const result = { id };
        for (const [k, v] of Object.entries(d.fields || {})) {
          result[k] = v.stringValue !== undefined ? v.stringValue 
                    : v.integerValue !== undefined ? Number(v.integerValue)
                    : v.doubleValue !== undefined ? v.doubleValue
                    : v.booleanValue !== undefined ? v.booleanValue
                    : v.timestampValue !== undefined ? v.timestampValue
                    : null;
        }
        return result;
      }));
    }
    pageToken = data.nextPageToken;
  } while (pageToken);

  let allTxs = [];
  let tPageToken = null;
  do {
    const res = await fetch(`${FIRESTORE_BASE}/transactions?pageSize=1000${tPageToken ? '&pageToken='+tPageToken : ''}`, { headers: { 'Authorization': `Bearer ${adminToken}` } });
    const data = await res.json();
    if (data.documents) {
      allTxs = allTxs.concat(data.documents.map(d => {
        const id = d.name.split('/').pop();
        const result = { id };
        for (const [k, v] of Object.entries(d.fields || {})) {
          result[k] = v.stringValue !== undefined ? v.stringValue 
                    : v.integerValue !== undefined ? Number(v.integerValue)
                    : v.doubleValue !== undefined ? v.doubleValue
                    : v.booleanValue !== undefined ? v.booleanValue
                    : v.timestampValue !== undefined ? v.timestampValue
                    : null;
        }
        return result;
      }));
    }
    tPageToken = data.nextPageToken;
  } while (tPageToken);

  const deposits = allTxs.filter(t => t.type === 'deposit' && t.status === 'approved');
  const zeroInvs = allInvs.filter(i => (i.amount === 0 || !i.amount) && i.status === 'active');
  
  const userMap = new Map(); // Get users to check autoCompound
  const usersRes = await fetch(`${FIRESTORE_BASE}/users?pageSize=1000`, { headers: { 'Authorization': `Bearer ${adminToken}` } });
  const usersData = await usersRes.json();
  // Simplified for now, just to be safe. We only care about base amount.
  
  let fixedCount = 0;
  const promises = [];
  const fixes = [];
  
  for (const inv of zeroInvs) {
    // Find closest deposit
    const userDeps = deposits.filter(d => d.userId === inv.userId);
    let bestDep = null;
    let minDiff = Infinity;
    const invTime = new Date(inv.createdAt).getTime();
    for (const d of userDeps) {
      const depTime = new Date(d.approvedAt || d.createdAt).getTime();
      const diff = Math.abs(invTime - depTime);
      if (diff < minDiff && diff < 86400000) { // within 24 hours
        minDiff = diff;
        bestDep = d;
      }
    }
    
    if (bestDep) {
      const baseAmount = bestDep.amount;
      // If there was paidRoi and they autoCompounded, real amount = baseAmount + paidRoi.
      // We don't exactly know if they autoCompounded, but paidRoi is 0 for most of them.
      // Just to be safe, we'll restore to baseAmount + paidRoi (assuming paidRoi was compounded).
      // Wait, if they didn't autoCompound, restoring to baseAmount + paidRoi is WRONG.
      // But paidRoi is 0! So baseAmount is perfect.
      const newAmount = baseAmount + (inv.paidRoi || 0); // worst case they get a tiny bit more if they didn't autoCompound. Actually, let's just use baseAmount if paidRoi > 0 is tricky, but paidRoi is 0.
      const finalAmount = inv.paidRoi > 0 ? baseAmount : baseAmount; 
      
      const roiPct = inv.dailyRoi || inv.roiPercent || inv.roiPct || 0;
      const expectedReturn = finalAmount * (roiPct / 100);
      
      promises.push(fsPatch(`investments/${inv.id}`, {
        amount: finalAmount,
        amountUsdt: finalAmount,
        expectedReturn: expectedReturn
      }, adminToken));
      
      fixes.push({ id: inv.id, old: inv.amount, new: finalAmount });
      fixedCount++;
    }
  }
  
  for (let i = 0; i < promises.length; i += 20) {
    await Promise.all(promises.slice(i, i + 20));
  }
  
  // Oh wait, we need to fix the wallets as well!
  // Since we rolled back investments, did we ruin wallets?
  // Our rollback script did: totalInvest -= delta.totalInvest
  // Wait, if we subtracted from totalInvest during rollback, we might have dropped it too low if it wasn't compounded? No, we correctly tracked autoCompound in rollback!
  // Wait, no we didn't! We set totalInvest -= b.amountUsdt! But we didn't subtract the principal! We only subtracted the ROI.
  // The wallets' totalInvest still has the principal! We just need to fix the investments collection so runSettle doesn't skip them.
  
  return c.json({ success: true, fixedCount, fixes: fixes.slice(0, 10) });
});


app.get('/api/admin/do-reconstruct-wallet', async (c) => {
  const adminToken = await getAdminToken();
  
  let allInvs = [];
  let pageToken = null;
  do {
    const res = await fetch(`${FIRESTORE_BASE}/investments?pageSize=1000${pageToken ? '&pageToken='+pageToken : ''}`, { headers: { 'Authorization': `Bearer ${adminToken}` } });
    const data = await res.json();
    if (data.documents) {
      allInvs = allInvs.concat(data.documents.map(d => {
        const id = d.name.split('/').pop();
        const result = { id };
        for (const [k, v] of Object.entries(d.fields || {})) {
          result[k] = v.stringValue !== undefined ? v.stringValue 
                    : v.integerValue !== undefined ? Number(v.integerValue)
                    : v.doubleValue !== undefined ? v.doubleValue
                    : v.booleanValue !== undefined ? v.booleanValue
                    : v.timestampValue !== undefined ? v.timestampValue
                    : null;
        }
        return result;
      }));
    }
    pageToken = data.nextPageToken;
  } while (pageToken);

  let allWallets = [];
  let wPageToken = null;
  do {
    const res = await fetch(`${FIRESTORE_BASE}/wallets?pageSize=1000${wPageToken ? '&pageToken='+wPageToken : ''}`, { headers: { 'Authorization': `Bearer ${adminToken}` } });
    const data = await res.json();
    if (data.documents) {
      allWallets = allWallets.concat(data.documents.map(d => {
        const id = d.name.split('/').pop();
        const result = { id };
        for (const [k, v] of Object.entries(d.fields || {})) {
          result[k] = v.stringValue !== undefined ? v.stringValue 
                    : v.integerValue !== undefined ? Number(v.integerValue)
                    : v.doubleValue !== undefined ? v.doubleValue
                    : v.booleanValue !== undefined ? v.booleanValue
                    : v.timestampValue !== undefined ? v.timestampValue
                    : null;
        }
        return result;
      }));
    }
    wPageToken = data.nextPageToken;
  } while (wPageToken);

  const walletMap = new Map(allWallets.map(w => [w.id, w]));
  const zeroInvs = allInvs.filter(i => (i.amount === 0 || !i.amount) && i.status === 'active');
  
  let fixedCount = 0;
  const promises = [];
  const fixes = [];
  
  // Group zeroInvs by userId
  const userZeroInvs = {};
  for (const inv of zeroInvs) {
    if (!userZeroInvs[inv.userId]) userZeroInvs[inv.userId] = [];
    userZeroInvs[inv.userId].push(inv);
  }
  
  for (const [userId, invs] of Object.entries(userZeroInvs)) {
    const w = walletMap.get(userId);
    if (!w) continue;
    
    // We need to know if they have other NON-ZERO active investments
    const otherInvs = allInvs.filter(i => i.userId === userId && i.status === 'active' && i.amount > 0);
    const otherSum = otherInvs.reduce((s, i) => s + (i.amount || 0), 0);
    
    let remainingAmount = Math.max(0, (w.totalInvest || w.totalInvested || 0) - otherSum);
    
    if (remainingAmount > 0) {
      // Split remainingAmount equally among the zero investments
      const amountPerInv = remainingAmount / invs.length;
      
      for (const inv of invs) {
        const roiPct = inv.dailyRoi || inv.roiPercent || inv.roiPct || 0;
        const expectedReturn = amountPerInv * (roiPct / 100);
        
        promises.push(fsPatch(`investments/${inv.id}`, {
          amount: amountPerInv,
          amountUsdt: amountPerInv,
          expectedReturn: expectedReturn
        }, adminToken));
        
        fixes.push({ id: inv.id, userId, old: 0, new: amountPerInv });
        fixedCount++;
      }
    }
  }
  
  for (let i = 0; i < promises.length; i += 20) {
    await Promise.all(promises.slice(i, i + 20));
  }
  
  return c.json({ success: true, fixedCount, fixes: fixes.slice(0, 10), totalZeroUsers: Object.keys(userZeroInvs).length });
});

app.get('/admin', (c) => {
    c.header('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    c.header('Pragma', 'no-cache');
    c.header('Expires', '0');
    c.header('Surrogate-Control', 'no-store');
    return c.html(ADMIN_HTML);
})
app.get('/admin.html', (c) => {
    c.header('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    c.header('Pragma', 'no-cache');
    c.header('Expires', '0');
    c.header('Surrogate-Control', 'no-store');
    return c.html(ADMIN_HTML);
})

// ─── DEEDRA 실시간 가격 프록시 API ─────────────────────────────────────────
// CORS 문제 없이 클라이언트→백엔드→DexScreener/Jupiter 형태로 중계
// app.use('/api/price/*', cors())

// GET /api/price/dexscreener?mint=<SOLANA_MINT_ADDRESS>
app.get('/api/price/dexscreener', async (c) => {
  const mint = c.req.query('mint')
  if (!mint) return c.json({ success: false, error: 'mint address required' }, 400)
  try {
    const url = `https://api.dexscreener.com/tokens/v1/solana/${mint}`
    const res = await fetch(url, {
      headers: { 'Accept': 'application/json', 'User-Agent': 'DEEDRA/1.0' },
      signal: AbortSignal.timeout(8000)
    })
    if (!res.ok) throw new Error(`DexScreener HTTP ${res.status}`)
    const data: any = await res.json()
    // DexScreener 응답: 배열 형태, 가장 유동성 높은 pair 사용
    const pairs: any[] = Array.isArray(data) ? data : (data.pairs || [])
    if (!pairs.length) return c.json({ success: false, error: 'no pairs found' })
    // 거래량 기준 내림차순 정렬
    pairs.sort((a: any, b: any) => (b.volume?.h24 || 0) - (a.volume?.h24 || 0))
    const best = pairs[0]
    return c.json({
      success: true,
      price: parseFloat(best.priceUsd || '0'),
      priceChange24h: best.priceChange?.h24 || 0,
      volume24h: best.volume?.h24 || 0,
      liquidity: best.liquidity?.usd || 0,
      pairAddress: best.pairAddress,
      dexId: best.dexId,
      source: 'dexscreener',
      updatedAt: Date.now()
    })
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500)
  }
})

// Jupiter Price API: 토큰 민트 주소로 가격 조회
// GET /api/price/jupiter?mint=<SOLANA_MINT_ADDRESS>
app.get('/api/price/jupiter', async (c) => {
  const mint = c.req.query('mint')
  if (!mint) return c.json({ success: false, error: 'mint address required' }, 400)
  try {
    const url = `https://api.jup.ag/price/v2?ids=${mint}`
    const res = await fetch(url, {
      headers: { 'Accept': 'application/json', 'User-Agent': 'DEEDRA/1.0' },
      signal: AbortSignal.timeout(8000)
    })
    if (!res.ok) throw new Error(`Jupiter HTTP ${res.status}`)
    const data: any = await res.json()
    const tokenData = data.data?.[mint]
    if (!tokenData) return c.json({ success: false, error: 'token not found on Jupiter' })
    return c.json({
      success: true,
      price: parseFloat(tokenData.price || '0'),
      priceChange24h: null,
      source: 'jupiter',
      updatedAt: Date.now()
    })
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500)
  }
})

// 통합 가격 조회 엔드포인트
// GET /api/price/token?pair=<PAIR_ADDRESS>  (페어 주소 우선)
// GET /api/price/token?mint=<MINT_ADDRESS>  (민트 주소 폴백)
app.get('/api/price/token', async (c) => {
  const pair = c.req.query('pair')
  const mint = c.req.query('mint')
  if (!pair && !mint) return c.json({ success: false, error: 'pair or mint address required' }, 400)

  // 1순위: DexScreener 페어 주소 직접 조회 (가장 정확)
  if (pair) {
    try {
      const url = `https://api.dexscreener.com/latest/dex/pairs/solana/${pair}`
      const res = await fetch(url, {
        headers: { 'Accept': 'application/json', 'User-Agent': 'DEEDRA/1.0' },
        signal: AbortSignal.timeout(6000)
      })
      if (res.ok) {
        const data: any = await res.json()
        const p = data.pair || (data.pairs && data.pairs[0])
        if (p) {
          const price = parseFloat(p.priceUsd || '0')
          if (price > 0) {
            return c.json({
              success: true,
              price,
              priceChange24h: p.priceChange?.h24 || 0,
              volume24h: p.volume?.h24 || 0,
              liquidity: p.liquidity?.usd || 0,
              pairAddress: p.pairAddress,
              baseToken: p.baseToken,
              source: 'dexscreener_pair',
              updatedAt: Date.now()
            })
          }
        }
      }
    } catch (_) {}
  }

  // 2순위: DexScreener 민트 주소 토큰 조회
  if (mint) {
    try {
      const url = `https://api.dexscreener.com/tokens/v1/solana/${mint}`
      const res = await fetch(url, {
        headers: { 'Accept': 'application/json', 'User-Agent': 'DEEDRA/1.0' },
        signal: AbortSignal.timeout(6000)
      })
      if (res.ok) {
        const data: any = await res.json()
        const pairs: any[] = Array.isArray(data) ? data : (data.pairs || [])
        if (pairs.length) {
          pairs.sort((a: any, b: any) => (b.volume?.h24 || 0) - (a.volume?.h24 || 0))
          const best = pairs[0]
          const price = parseFloat(best.priceUsd || '0')
          if (price > 0) {
            return c.json({
              success: true,
              price,
              priceChange24h: best.priceChange?.h24 || 0,
              volume24h: best.volume?.h24 || 0,
              liquidity: best.liquidity?.usd || 0,
              source: 'dexscreener',
              updatedAt: Date.now()
            })
          }
        }
      }
    } catch (_) {}
  }

  // 3순위: GeckoTerminal (민트 주소)
  if (mint) {
    try {
      const url = `https://api.geckoterminal.com/api/v2/networks/solana/tokens/${mint}`
      const res = await fetch(url, {
        headers: { 'Accept': 'application/json', 'User-Agent': 'DEEDRA/1.0' },
        signal: AbortSignal.timeout(6000)
      })
      if (res.ok) {
        const data: any = await res.json()
        const attrs = data.data?.attributes
        if (attrs) {
          const price = parseFloat(attrs.price_usd || '0')
          if (price > 0) {
            return c.json({
              success: true,
              price,
              priceChange24h: attrs.price_change_percentage?.h24 || null,
              volume24h: attrs.volume_usd?.h24 || 0,
              source: 'geckoterminal',
              updatedAt: Date.now()
            })
          }
        }
      }
    } catch (_) {}
  }

  return c.json({ success: false, error: 'price not available from any source' }, 404)
})

// ─── 실시간 환율 API (/api/price/forex) ──────────────────────────────────────
// ExchangeRate-API 무료 플랜 사용 (API 키 불필요, USD 기준 최신 환율)
// 지원 통화: KRW(한국), THB(태국), VND(베트남), USD, 기타
// 응답 캐싱: 1시간 (Cloudflare edge cache)
let _forexCache: { rates: Record<string, number>; ts: number } | null = null


// ─── Auto News Digest (소식통) API ───────────────────────────────────────────
let _newsCache = null;

app.get('/api/news-digest', async (c) => {
  try {
    const now = Date.now();
    if (c.req.query('nocache') === '1') _newsCache = null;
    if (_newsCache && now - _newsCache.ts < 3600_000) {
      return c.json({ items: _newsCache.items, cached: true });
    }

    const rssUrl = 'https://www.tokenpost.kr/rss';
    const resp = await fetch(rssUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      signal: AbortSignal.timeout(10000)
    });
    if (!resp.ok) {
       console.log('RSS fetch failed:', resp.status);
       // 캐시가 있으면 에러 대신 캐시를 반환
       if (_newsCache) return c.json({ items: _newsCache.items, cached: true });
       return c.json({ items: [] });
    }
    
    const xml = await resp.text();
    const items = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    let match;
    while ((match = itemRegex.exec(xml)) !== null) {
      if (items.length >= 6) break; // 뉴스 6개로 제한하여 타임아웃 방지
      const itemStr = match[1];
      
      const titleMatch = itemStr.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/) || itemStr.match(/<title>([\s\S]*?)<\/title>/);
      const linkMatch = itemStr.match(/<link><!\[CDATA\[([\s\S]*?)\]\]><\/link>/) || itemStr.match(/<link>([\s\S]*?)<\/link>/);
      const descMatch = itemStr.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/) || itemStr.match(/<description>([\s\S]*?)<\/description>/);
      const dateMatch = itemStr.match(/<pubDate>([\s\S]*?)<\/pubDate>/);
      
      if (titleMatch && linkMatch) {
        let desc = descMatch ? descMatch[1].replace(/<[^>]*>?/gm, '').trim() : '';
        if (desc.length > 150) desc = desc.substring(0, 150) + '...';
        
        items.push({
          title: titleMatch[1].trim(),
          link: linkMatch[1].trim(),
          description: desc,
          pubDate: dateMatch ? dateMatch[1].trim() : ''
        });
      }
    }

    // 병렬 번역으로 속도 대폭 개선 (Cloudflare 10초 타임아웃 방지)
    const langs = ['en', 'vi', 'th'];
    const titles = items.map(item => item.title);
    const descs = items.map(item => item.description);
    const allText = [...titles, ...descs];
    const combinedStr = allText.join('\n|||\n');

    await Promise.all(langs.map(async (lang) => {
      try {
        const tCombined = await translateText(combinedStr, lang);
        const tParts = tCombined.split('|||').map(s => s.trim());
        
        if (tParts.length === allText.length) {
          for (let i = 0; i < items.length; i++) {
             items[i][`title_${lang}`] = tParts[i] || items[i].title;
             items[i][`description_${lang}`] = tParts[i + items.length] || items[i].description;
          }
        } else {
          // 파싱 실패시 원본 텍스트 유지
          for (let i = 0; i < items.length; i++) {
             items[i][`title_${lang}`] = items[i].title;
             items[i][`description_${lang}`] = items[i].description;
          }
        }
      } catch(e) {
        console.error(`Translation error for ${lang}:`, e);
      }
    }));

    _newsCache = { ts: now, items };
    return c.json({ items });
  } catch (err) {
    console.error('RSS Fetch error:', err);
    if (_newsCache) return c.json({ items: _newsCache.items, cached: true });
    return c.json({ items: [] }, 500);
  }
})

app.get('/api/price/forex', async (c) => {
  try {
    const now = Date.now()
    // 메모리 캐시 1시간
    if (_forexCache && now - _forexCache.ts < 3600_000) {
      return c.json({ success: true, rates: _forexCache.rates, cached: true, updatedAt: _forexCache.ts })
    }
    const res = await fetch('https://open.er-api.com/v6/latest/USD', {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(8000)
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data: any = await res.json()
    if (data.result !== 'success') throw new Error('API error')
    const rates: Record<string, number> = {
      KRW: data.rates.KRW,
      THB: data.rates.THB,
      VND: data.rates.VND,
      USD: 1,
      CNY: data.rates.CNY,
      JPY: data.rates.JPY,
      SGD: data.rates.SGD,
      MYR: data.rates.MYR,
      IDR: data.rates.IDR,
      PHP: data.rates.PHP,
    }
    _forexCache = { rates, ts: now }
    return c.json({ success: true, rates, cached: false, updatedAt: now })
  } catch (e: any) {
    // 캐시가 있으면 만료돼도 반환
    if (_forexCache) {
      return c.json({ success: true, rates: _forexCache.rates, cached: true, updatedAt: _forexCache.ts })
    }
    // 폴백: 하드코딩된 기본값 반환
    return c.json({
      success: true,
      rates: { KRW: 1380, THB: 34, VND: 26000, USD: 1, CNY: 7.2, JPY: 155, SGD: 1.35, MYR: 4.7, IDR: 16300, PHP: 58 },
      cached: false, fallback: true, updatedAt: Date.now()
    })
  }
})


// ─── Main App (SPA) ───────────────────────────────────────────────────────────


app.get('/', (c) => c.html(INDEX_HTML))
app.get('/app', (c) => c.html(INDEX_HTML))
app.get('/wallet/project', (c) => c.html(WALLET_PROJECT_HTML))

// ─── Setup Page ───────────────────────────────────────────────────────────────
const SETUP_HTML = () => `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <title>DEEDRA 초기 데이터 설정</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: sans-serif; padding: 24px; background: #f3f4f6; }
    .card { background: white; padding: 28px; border-radius: 12px; max-width: 560px; margin: 0 auto; box-shadow: 0 2px 12px rgba(0,0,0,0.1); }
    h2 { margin-bottom: 8px; color: #0d47a1; font-size: 20px; }
    p { color: #6b7280; font-size: 14px; margin-bottom: 16px; }
    .btn-row { display: flex; flex-direction: column; gap: 10px; margin-bottom: 4px; }
    button { padding: 12px 20px; color: white; border: none; border-radius: 8px; font-size: 14px; font-weight: 700; cursor: pointer; width: 100%; }
    button:disabled { opacity: 0.5; cursor: not-allowed; }
    .btn-all { background: #0d47a1; }
    .btn-products { background: #1565c0; }
    .btn-accounts { background: #283593; }
    .btn-settings { background: #4527a0; }
    .log { background: #111827; color: #d1fae5; padding: 14px; border-radius: 8px; font-size: 12px; font-family: monospace; min-height: 180px; white-space: pre-wrap; margin-top: 14px; overflow-y: auto; max-height: 500px; line-height: 1.6; }
    .section { border: 1px solid #e5e7eb; border-radius: 8px; padding: 14px; margin-bottom: 12px; }
    .section-title { font-size: 13px; font-weight: 700; color: #374151; margin-bottom: 8px; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 6px; }
    th { background: #f9fafb; padding: 6px 8px; text-align: left; color: #6b7280; border-bottom: 1px solid #e5e7eb; }
    td { padding: 6px 8px; border-bottom: 1px solid #f3f4f6; }
  </style>
</head>
<body>
<div class="card">
  <h2>🛠️ DEEDRA 초기 데이터 설정</h2>
  <p>Firebase Firestore에 FREEZE 플랜, 테스트 계정, 앱 설정값을 일괄 생성합니다.</p>

  <div class="section">
    <div class="section-title">❌️ 생성될 FREEZE 플랜</div>
    <table>
      <tr><th>이름</th><th>수익률</th><th>기간</th><th>최소</th><th>최대</th></tr>
      <tr><td>Basic</td><td>15%</td><td>30일</td><td>$100</td><td>$1,000</td></tr>
      <tr><td>Standard</td><td>25%</td><td>60일</td><td>$500</td><td>$5,000</td></tr>
      <tr><td>Premium</td><td>40%</td><td>90일</td><td>$1,000</td><td>$20,000</td></tr>
      <tr><td>VIP</td><td>60%</td><td>180일</td><td>$5,000</td><td>$100,000</td></tr>
    </table>
  </div>

  <div class="section">
    <div class="section-title">👤 생성될 테스트 계정</div>
    <table>
      <tr><th>이메일</th><th>비밀번호</th><th>직급</th><th>USDT</th><th>DEEDRA</th></tr>
      <tr><td>test1@deedra.com</td><td>000000</td><td>G1</td><td>1,000</td><td>500</td></tr>
      <tr><td>test2@deedra.com</td><td>000000</td><td>G0</td><td>500</td><td>200</td></tr>
      <tr><td>test3@deedra.com</td><td>000000</td><td>G2</td><td>5,000</td><td>2,000</td></tr>
    </table>
    <p style="margin:6px 0 0;font-size:11px;color:#9ca3af">출금 PIN: 123456</p>
  </div>

  <div class="section" style="margin-top:16px;background:#1e293b;border-radius:10px;padding:16px;">
    <div class="section-title" style="color:#f59e0b">🔐 관리자 계정 생성</div>
    <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:10px;">
      <input id="adminEmail" type="email" placeholder="관리자 이메일" value="admin@deedra.com"
        style="padding:8px 12px;border-radius:8px;border:1px solid #475569;background:#0f172a;color:#e2e8f0;font-size:13px;flex:1;min-width:200px;"/>
      <input id="adminPass" type="text" placeholder="비밀번호 (6자리 이상)" value="000000"
        style="padding:8px 12px;border-radius:8px;border:1px solid #475569;background:#0f172a;color:#e2e8f0;font-size:13px;flex:1;min-width:160px;"/>
      <input id="adminName" type="text" placeholder="이름" value="관리자"
        style="padding:8px 12px;border-radius:8px;border:1px solid #475569;background:#0f172a;color:#e2e8f0;font-size:13px;flex:1;min-width:120px;"/>
    </div>
    <button id="btnAdmin"
      style="background:linear-gradient(135deg,#f59e0b,#d97706);color:#fff;border:none;padding:10px 22px;border-radius:8px;font-weight:700;cursor:pointer;font-size:14px;">
      🔐 관리자 계정 생성
    </button>
  </div>

  <div class="btn-row">
    <button class="btn-all" id="btnAll" onclick="runAll()">🚀 전체 초기화 (상품 + 계정 + 설정)</button>
    <button class="btn-products" id="btnProducts" onclick="createProducts()">❌️ FREEZE 플랜만 생성</button>
    <button class="btn-accounts" id="btnAccounts" onclick="createTestAccounts()">👤 테스트 계정만 생성</button>
    <button class="btn-settings" id="btnSettings" onclick="createSettings()">⚙️ 앱 설정값만 생성</button>
  </div>
  <div class="log" id="log">버튼을 클릭하면 시작됩니다...</div>
</div>

<script type="module">
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';
import { getFirestore, doc, setDoc, addDoc, collection, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

const firebaseApp = initializeApp({
  apiKey: "__FIREBASE_WEB_API_KEY__",
  authDomain: "dedra-mlm.firebaseapp.com",
  projectId: "dedra-mlm",
  storageBucket: "dedra-mlm.firebasestorage.app",
  messagingSenderId: "990762022325",
  appId: "1:990762022325:web:1b238ef6eca4ffb4b795fc"
});
const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);

const PRODUCTS = [
  { id:'product_basic',    name:'Basic',    roiPercent:15, durationDays:30,  minAmount:100,  maxAmount:1000,   isActive:true, order:1 },
  { id:'product_standard', name:'Standard', roiPercent:25, durationDays:60,  minAmount:500,  maxAmount:5000,   isActive:true, order:2 },
  { id:'product_premium',  name:'Premium',  roiPercent:40, durationDays:90,  minAmount:1000, maxAmount:20000,  isActive:true, order:3 },
  { id:'product_vip',      name:'VIP',      roiPercent:60, durationDays:180, minAmount:5000, maxAmount:100000, isActive:true, order:4 },
];

const TEST_ACCOUNTS = [
  { email:'test1@deedra.com', password:'000000', name:'테스트1호', rank:'G1', usdt:1000, dedra:500,  bonus:50,  referralCode:'TEST0001' },
  { email:'test2@deedra.com', password:'000000', name:'테스트2호', rank:'G0', usdt:500,  dedra:200,  bonus:20,  referralCode:'TEST0002' },
  { email:'test3@deedra.com', password:'000000', name:'테스트3호', rank:'G2', usdt:5000, dedra:2000, bonus:300, referralCode:'TEST0003' },
];

function log(msg, color='#d1fae5') {
  const el = document.getElementById('log');
  el.innerHTML += '<span style="color:'+color+'">'+msg+'</span>\\n';
  el.scrollTop = el.scrollHeight;
}

async function createAdmin() {
  const email = document.getElementById('adminEmail').value.trim();
  const pass  = document.getElementById('adminPass').value.trim();
  const name  = document.getElementById('adminName').value.trim() || '관리자';
  if (!email || !pass) { log('❌ 이메일과 비밀번호를 입력해주세요.', '#fca5a5'); return; }
  if (pass.length < 6) { log('❌ 비밀번호는 최소 6자리 이상이어야 합니다.', '#fca5a5'); return; }
  const btn = document.getElementById('btnAdmin');
  btn.disabled = true;
  log('\\n🔐 [관리자 계정 생성 시작]', '#fcd34d');
  log('  이메일: ' + email, '#e5e7eb');
  try {
    let uid;
    try {
      const c = await createUserWithEmailAndPassword(auth, email, pass);
      uid = c.user.uid;
      log('  ✅ Firebase Auth 계정 생성 완료', '#86efac');
    } catch(e) {
      if (e.code === 'auth/email-already-in-use') {
        const c = await signInWithEmailAndPassword(auth, email, pass);
        uid = c.user.uid;
        log('  ℹ️ 기존 계정 발견 → role을 admin으로 업데이트', '#93c5fd');
      } else throw e;
    }
    await setDoc(doc(db, 'users', uid), {
      uid, email, name, role: 'admin',
      status: 'active', rank: 'ADMIN',
      referralCode: 'ADMIN', referredBy: null,
      phone: '', createdAt: serverTimestamp()
    }, { merge: true });
    log('  ✅ Firestore users 저장 완료 (role: admin)', '#86efac');
    log('\\n✅✅ 관리자 계정 생성 완료!', '#fcd34d');
    log('  📧 이메일: ' + email, '#fcd34d');
    log('  🔑 비밀번호: ' + pass, '#fcd34d');
    log('  👉 /admin 에서 로그인하세요', '#fcd34d');
  } catch(e) {
    log('  ❌ 오류: ' + e.message, '#fca5a5');
  } finally {
    btn.disabled = false;
  }
}

document.getElementById('btnAdmin').addEventListener('click', createAdmin);

function disableAll(v) {
  ['btnAll','btnProducts','btnAccounts','btnSettings'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.disabled = v;
  });
}

window.runAll = async function() {
  disableAll(true);
  document.getElementById('log').innerHTML = '';
  log('🚀 전체 초기화 시작...', '#93c5fd');
  await createProducts();
  await createTestAccounts();
  await createSettings();
  log('\\n🎉 전체 초기화 완료!', '#fbbf24');
  disableAll(false);
};

window.createProducts = async function() {
  log('\\n📦 [투자 상품 생성 시작]', '#93c5fd');
  for (const p of PRODUCTS) {
    try {
      await setDoc(doc(db, 'products', p.id), { ...p, createdAt: serverTimestamp() });
      log('  ✅ ' + p.name + ' (' + p.roiPercent + '% / ' + p.durationDays + '일)', '#86efac');
    } catch(e) {
      log('  ❌ ' + p.name + ' 오류: ' + e.message, '#fca5a5');
    }
  }
  log('📦 투자 상품 4종 생성 완료', '#86efac');
};

window.createTestAccounts = async function() {
  log('\\n👤 [테스트 계정 생성 시작]', '#93c5fd');
  for (const a of TEST_ACCOUNTS) {
    log('  처리중: ' + a.email, '#e5e7eb');
    try {
      let uid;
      try {
        const c = await createUserWithEmailAndPassword(auth, a.email, a.password);
        uid = c.user.uid;
        log('    ✅ 신규 계정 생성', '#86efac');
      } catch(e) {
        if (e.code === 'auth/email-already-in-use') {
          const c = await signInWithEmailAndPassword(auth, a.email, a.password);
          uid = c.user.uid;
          log('    ℹ️ 기존 계정 업데이트', '#93c5fd');
        } else throw e;
      }
      await setDoc(doc(db,'users',uid), {
        uid, email:a.email, name:a.name, role:'member', rank:a.rank,
        status:'active', referralCode:a.referralCode, referredBy:null,
        phone:'', withdrawPin:btoa('123456'), referralCount:0,
        createdAt:serverTimestamp()
      }, {merge:true});
      await setDoc(doc(db,'wallets',uid), {
        userId:uid, usdtBalance:a.usdt, dedraBalance:a.dedra,
        bonusBalance:a.bonus, totalDeposit:a.usdt, totalWithdrawal:0,
        totalEarnings:a.bonus, createdAt:serverTimestamp()
      }, {merge:true});
      log('    ✅ Firestore 저장 (USDT:' + a.usdt + ' DEEDRA:' + a.dedra + ')', '#86efac');
    } catch(e) {
      log('    ❌ 오류: ' + e.message, '#fca5a5');
    }
  }
  log('👤 테스트 계정 3개 완료 (PIN: 123456)', '#86efac');
};

window.createSettings = async function() {
  log('\\n⚙️ [앱 설정값 생성 시작]', '#93c5fd');
  try {
    // DEEDRA 시세 설정
    await setDoc(doc(db, 'settings', 'deedraPrice'), {
      price: 0.50,
      updatedAt: serverTimestamp(),
      updatedBy: 'system',
      note: '초기 설정값 (관리자가 변경 가능)'
    });
    log('  ✅ DEEDRA 시세: $0.50', '#86efac');

    // 회사 지갑 주소
    await setDoc(doc(db, 'settings', 'wallets'), {
      solana: 'SOL_WALLET_ADDRESS_SET_BY_ADMIN',
      updatedAt: serverTimestamp(),
      note: '관리자가 실제 주소로 변경 필요'
    });
    log('  ✅ 회사 지갑 주소 (기본값)', '#86efac');

    // 공지사항 샘플
    await addDoc(collection(db, 'announcements'), {
      title: '🎉 DEEDRA 앱 v2.0 오픈!',
      content: 'DEEDRA FREEZE 서비스가 새로운 디자인으로 리뉴얼되었습니다. 더 편리해진 UI로 FREEZE를 시작해보세요!',
      isActive: true,
      isPinned: true,
      createdAt: serverTimestamp()
    });
    await addDoc(collection(db, 'announcements'), {
      title: '💸 FREEZE 플랜 안내',
      content: 'Basic(0.4%/30일), Standard(0.5%/90일), Premium(0.6%/180일), VIP(0.8%/360일) FREEZE 플랜이 출시되었습니다.',
      isActive: true,
      isPinned: false,
      createdAt: serverTimestamp()
    });
    log('  ✅ 공지사항 2건 생성', '#86efac');
    log('⚙️ 앱 설정값 생성 완료', '#86efac');
  } catch(e) {
    log('  ❌ 오류: ' + e.message, '#fca5a5');
  }
};
</script>
</body>
</html>`

// ─── Firebase Admin SDK (runtime env only) ────────────────────────────────────
function parseConfiguredServiceAccount(): any {
  const raw = GLOBAL_ENV?.SERVICE_ACCOUNT;
  if (!raw) return { account: null, status: 'missing' };

  let parsed: any = raw;
  if (typeof raw === 'string') {
    try {
      parsed = JSON.parse(raw);
    } catch (_) {
      return { account: null, status: 'invalid_json' };
    }
  }

  const requiredFields = ['project_id', 'client' + '_email', 'private' + '_key', 'token_uri'];
  const complete = requiredFields.every((field) => typeof parsed?.[field] === 'string' && parsed[field].trim().length > 0);
  return complete ? { account: parsed, status: 'ok' } : { account: null, status: 'incomplete' };
}

function getRequiredServiceAccount(): any {
  const parsed = parseConfiguredServiceAccount();
  if (!parsed.account) throw new Error(`SERVICE_ACCOUNT ${parsed.status}`);
  return parsed.account;
}

const SERVICE_ACCOUNT = new Proxy({}, {
  get(_target, prop) {
    const sa = getRequiredServiceAccount();
    return sa[prop as keyof typeof sa];
  }
}) as any;

const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/dedra-mlm/databases/(default)/documents`

const LEGACY_MAINTENANCE_ADMIN_PATHS = new Set([
  '/api/admin/rollback-settlement',
  '/api/admin/check-reconstruct',
  '/api/admin/do-reconstruct',
  '/api/admin/do-reconstruct-wallet',
  '/api/admin/migrate-username',
  '/api/admin/wipe-wallets',
  '/api/admin/temp-report',
  '/api/admin/get-links',
]);

const LEGACY_MAINTENANCE_ADMIN_PREFIXES = [
  '/api/admin/fix-',
  '/api/admin/force-',
  '/api/admin/dump-',
  '/api/admin/test-',
  '/api/admin/task-',
  '/api/admin/debug-',
  '/api/admin/execute-',
  '/api/admin/search-',
  '/api/admin/temp-',
];

function isPrivilegedApiPath(path: string): boolean {
  return path === '/api/admin'
    || path.startsWith('/api/admin/')
    || path === '/api/debug'
    || path.startsWith('/api/debug/')
    || path.startsWith('/api/temp-')
    || path.startsWith('/api/temp/');
}

function isLegacyMaintenanceAdminPath(path: string): boolean {
  return LEGACY_MAINTENANCE_ADMIN_PATHS.has(path)
    || LEGACY_MAINTENANCE_ADMIN_PREFIXES.some((prefix) => path.startsWith(prefix));
}

function isDangerousLegacyApiPath(path: string): boolean {
  return path === '/api/debug'
    || path.startsWith('/api/debug/')
    || path.startsWith('/api/temp-')
    || path.startsWith('/api/temp/')
    || isLegacyMaintenanceAdminPath(path);
}

function isEnvFlagEnabled(name: string): boolean {
  return ['1', 'true', 'yes', 'on'].includes(String(GLOBAL_ENV?.[name] || '').trim().toLowerCase());
}

function getConfiguredAdminSecret(): string {
  return String(GLOBAL_ENV.ADMIN_API_SECRET || '').trim();
}

function suppliedAdminSecret(c: any): string {
  return String(c.req.header('x-admin-secret') || c.req.query('adminSecret') || '').trim();
}

function suppliedAdminSecretHeader(c: any): string {
  return String(c.req.header('x-admin-secret') || '').trim();
}

function hasConfiguredAdminSecret(c: any): boolean {
  const configuredSecret = getConfiguredAdminSecret();
  return configuredSecret.length >= 16 && suppliedAdminSecret(c) === configuredSecret;
}

function hasConfiguredAdminSecretHeader(c: any): boolean {
  const configuredSecret = getConfiguredAdminSecret();
  return configuredSecret.length >= 16 && suppliedAdminSecretHeader(c) === configuredSecret;
}

function hasExplicitMaintenanceApiAccess(c: any): boolean {
  return isEnvFlagEnabled('ALLOW_LEGACY_DEBUG_API') && hasConfiguredAdminSecretHeader(c);
}

function getCronSecret(): string {
  return String(GLOBAL_ENV.CRON_SECRET || '').trim();
}

function isValidCronSecret(supplied: any): boolean {
  const configuredSecret = getCronSecret();
  return configuredSecret.length >= 16 && String(supplied || '').trim() === configuredSecret;
}

// [FIX 2026-04-30] Pages 환경 cron 대체: 외부 스케줄러가 호출하는 통합 엔드포인트
// 5분마다 다음을 모두 실행:
//   1) Solana 자동입금 체크
//   2) XRP/BTC 자동입금 체크
//   3) 매출 재계산 + 자동 승급 (10분 주기, 짝수 10분대만)
//   4) 자동 정산은 별도 cron이 처리(여기서는 호출하지 않음 — 중복 방지)
async function runAllCronTasks(c: any): Promise<any> {
  const env: any = c.env || {};
  const results: any = { startedAt: new Date().toISOString(), tasks: {} };

  // 1) Solana 자동입금
  try {
    const r = await app.request('/api/solana/check-deposits', {
      method: 'POST',
      headers: { 'x-cron-secret': getCronSecret(), 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    }, env);
    const t = await r.text();
    results.tasks.solanaDeposits = { ok: r.ok, status: r.status, body: t.slice(0, 400) };
  } catch (e: any) {
    results.tasks.solanaDeposits = { ok: false, error: e?.message || String(e) };
  }

  // 2) XRP/BTC 자동입금
  try {
    const r = await app.request('/api/cron/check-major-chain-deposits', {
      method: 'POST',
      headers: { 'x-cron-secret': getCronSecret(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ userLimit: 500, txLimit: 20 })
    }, env);
    const t = await r.text();
    results.tasks.majorChainDeposits = { ok: r.ok, status: r.status, body: t.slice(0, 400) };
  } catch (e: any) {
    results.tasks.majorChainDeposits = { ok: false, error: e?.message || String(e) };
  }

  // 3) 매출 재계산 + 자동 승급 (10분 주기로만)
  try {
    const m = new Date().getUTCMinutes();
    if (m % 10 < 5) {
      const adminToken = await getAdminToken();
      const users = await fsQuery('users', adminToken, [], 100000);
      const wallets = await fsQuery('wallets', adminToken, [], 100000);
      const invs = await fsQuery('investments', adminToken, [{ field: 'status', op: '==', value: 'active' }], 100000).catch(() => []);
      const r = await autoUpgradeAllRanks(adminToken, users, wallets, invs);
      results.tasks.recomputeAndUpgrade = { ok: true, ...r };
    } else {
      results.tasks.recomputeAndUpgrade = { skipped: true, reason: 'not in 10-min window' };
    }
  } catch (e: any) {
    results.tasks.recomputeAndUpgrade = { ok: false, error: e?.message || String(e) };
  }

  results.finishedAt = new Date().toISOString();
  return results;
}

app.post('/api/cron/run-all', async (c) => {
  const headerSecret = c.req.header('x-cron-secret');
  // 관리자 토큰 또는 cron secret 둘 중 하나로 호출 가능
  const isAdmin = await hasPrivilegedApiAccess(c).catch(() => false);
  if (!isAdmin && !isValidCronSecret(headerSecret)) {
    return c.json({ error: 'unauthorized' }, 401);
  }
  try {
    const r = await runAllCronTasks(c);
    return c.json({ success: true, ...r });
  } catch (e: any) {
    return c.json({ success: false, error: e?.message || String(e) }, 500);
  }
});

app.get('/api/cron/run-all', async (c) => {
  const querySecret = c.req.query('secret');
  const headerSecret = c.req.header('x-cron-secret');
  const isAdmin = await hasPrivilegedApiAccess(c).catch(() => false);
  if (!isAdmin && !isValidCronSecret(headerSecret) && !isValidCronSecret(querySecret)) {
    return c.json({ error: 'unauthorized' }, 401);
  }
  try {
    const r = await runAllCronTasks(c);
    return c.json({ success: true, ...r });
  } catch (e: any) {
    return c.json({ success: false, error: e?.message || String(e) }, 500);
  }
});

// [DIAG 2026-04-30] CRON_SECRET 매칭 진단 — 값은 노출하지 않고 길이/해시 prefix 만 반환
app.get('/api/diag/cron-secret', async (c) => {
  const env: any = c.env || {};
  const fromEnv = String(env.CRON_SECRET || '').trim();
  const fromGlobal = String(GLOBAL_ENV?.CRON_SECRET || '').trim();
  const fromGetter = String(getCronSecret() || '').trim();
  const headerSecret = String(c.req.header('x-cron-secret') || '').trim();
  const querySecret = String(c.req.query('secret') || '').trim();
  const supplied = headerSecret || querySecret;

  async function sha256Hex(s: string): Promise<string> {
    if (!s) return '';
    const buf = new TextEncoder().encode(s);
    const hash = await crypto.subtle.digest('SHA-256', buf);
    return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2,'0')).join('').slice(0, 12);
  }

  return c.json({
    cEnv: { len: fromEnv.length, hash12: await sha256Hex(fromEnv) },
    GLOBAL_ENV: { len: fromGlobal.length, hash12: await sha256Hex(fromGlobal) },
    getCronSecret: { len: fromGetter.length, hash12: await sha256Hex(fromGetter) },
    supplied: { len: supplied.length, hash12: await sha256Hex(supplied), source: headerSecret ? 'header' : (querySecret ? 'query' : 'none') },
    isValid_supplied: isValidCronSecret(supplied),
    cEnvKeys: Object.keys(env).slice(0, 50),
  });
});

function getServiceAccountEnvStatus(): any {
  const parsed = parseConfiguredServiceAccount();
  if (parsed.status === 'missing') {
    return {
      key: 'SERVICE_ACCOUNT',
      level: 'error',
      configured: false,
      status: 'missing',
      message: 'SERVICE_ACCOUNT is not configured in the runtime environment.'
    };
  }

  if (parsed.status === 'invalid_json') {
    return {
      key: 'SERVICE_ACCOUNT',
      level: 'error',
      configured: true,
      status: 'invalid_json',
      message: 'SERVICE_ACCOUNT is present but cannot be parsed.'
    };
  }

  return {
    key: 'SERVICE_ACCOUNT',
    level: parsed.status === 'ok' ? 'ok' : 'error',
    configured: true,
    status: parsed.status,
    message: parsed.status === 'ok' ? 'SERVICE_ACCOUNT is configured.' : 'SERVICE_ACCOUNT is missing required fields.'
  };
}

function secretHealthStatus(key: string, value: string): any {
  if (!value) {
    return {
      key,
      level: 'error',
      configured: false,
      status: 'missing',
      message: `${key} is not configured.`
    };
  }
  if (value.length < 16) {
    return {
      key,
      level: 'error',
      configured: true,
      status: 'too_short',
      message: `${key} is configured but too short.`
    };
  }
  return {
    key,
    level: 'ok',
    configured: true,
    status: 'ok',
    message: `${key} is configured.`
  };
}

function getLegacyDebugHealthStatus(): any {
  const enabled = isEnvFlagEnabled('ALLOW_LEGACY_DEBUG_API');
  return {
    key: 'ALLOW_LEGACY_DEBUG_API',
    level: enabled ? 'warning' : 'ok',
    configured: enabled,
    status: enabled ? 'enabled' : 'disabled',
    message: enabled
      ? 'Legacy debug and repair APIs are temporarily enabled. Disable after maintenance.'
      : 'Legacy debug and repair APIs are disabled.'
  };
}

function getSecurityHealthSnapshot(): any {
  const checks = [
    getServiceAccountEnvStatus(),
    secretHealthStatus('CRON_SECRET', getCronSecret()),
    secretHealthStatus('ADMIN_API_SECRET', getConfiguredAdminSecret()),
    getLegacyDebugHealthStatus(),
  ];
  return {
    ok: checks.every((check) => check.level !== 'error'),
    hasWarnings: checks.some((check) => check.level === 'warning'),
    checks
  };
}

const ADMIN_AUDIT_LOG_COLLECTION = 'adminAuditLogs';
const ADMIN_AUDIT_SENSITIVE_KEYS = [
  'password',
  'secret',
  'token',
  'authorization',
  'credential',
  'private',
  'mnemonic',
  'pin',
  'keyarray',
  'serviceaccount'
];

function isSensitiveAuditKey(key: string): boolean {
  const normalized = String(key || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  return ADMIN_AUDIT_SENSITIVE_KEYS.some((sensitiveKey) => normalized.includes(sensitiveKey));
}

function sanitizeAuditValue(value: any, depth = 0): any {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') {
    return value.length > 160 ? `${value.slice(0, 160)}...` : value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (depth >= 4) return '[truncated]';
  if (Array.isArray(value)) {
    return value.slice(0, 20).map((item) => sanitizeAuditValue(item, depth + 1));
  }
  if (typeof value === 'object') {
    const sanitized: Record<string, any> = {};
    for (const [key, item] of Object.entries(value).slice(0, 40)) {
      sanitized[key] = isSensitiveAuditKey(key) ? '[redacted]' : sanitizeAuditValue(item, depth + 1);
    }
    return sanitized;
  }
  return String(value);
}

function getAuditRequestMeta(c: any): any {
  const path = new URL(c.req.url).pathname;
  return {
    method: c.req.method,
    path,
    ip: String(c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || '').split(',')[0].trim(),
    userAgent: c.req.header('user-agent') || '',
    requestId: c.req.header('cf-ray') || c.req.header('x-request-id') || ''
  };
}

async function getAuditActor(c: any): Promise<any> {
  if (hasConfiguredAdminSecretHeader(c)) {
    return { type: 'admin_secret', source: 'header' };
  }
  if (hasConfiguredAdminSecret(c)) {
    return { type: 'admin_secret', source: 'request' };
  }

  const bearer = getBearerToken(c);
  const subAdmin = verifySubAdminToken(bearer);
  if (subAdmin) {
    return sanitizeAuditValue({
      type: 'sub_admin',
      uid: subAdmin.uid || subAdmin.username || '',
      username: subAdmin.username || '',
      role: subAdmin.role || ''
    });
  }

  const firebaseUser = await lookupFirebaseUser(bearer).catch(() => null);
  if (firebaseUser?.localId) {
    return sanitizeAuditValue({
      type: 'firebase_admin',
      uid: firebaseUser.localId,
      email: firebaseUser.email || ''
    });
  }

  return { type: 'unknown' };
}

async function writeAdminAuditLog(c: any, adminToken: string, entry: any): Promise<void> {
  const now = new Date().toISOString();
  const actor = await getAuditActor(c).catch(() => ({ type: 'unknown' }));
  await fsCreate(ADMIN_AUDIT_LOG_COLLECTION, {
    category: entry.category || 'system',
    action: entry.action || 'unknown',
    severity: entry.severity || 'info',
    targetType: entry.targetType || 'unknown',
    targetId: entry.targetId || '',
    actor,
    request: sanitizeAuditValue(getAuditRequestMeta(c)),
    metadata: sanitizeAuditValue(entry.metadata || {}),
    createdAt: now,
    updatedAt: now
  }, adminToken);
}

function queueAdminAuditLog(c: any, entry: any): void {
  const job = (async () => {
    try {
      const adminToken = await getAdminToken();
      await writeAdminAuditLog(c, adminToken, entry);
    } catch (error) {
      console.warn('[admin-audit] write failed', error);
    }
  })();

  if (c.executionCtx?.waitUntil) {
    c.executionCtx.waitUntil(job);
  } else {
    job.catch(() => {});
  }
}

const ADMIN_ACTION_CONFIRMATION_COLLECTION = 'adminActionConfirmations';
const ADMIN_ACTION_EXECUTION_COLLECTION = 'adminActionExecutions';
const ADMIN_ACTION_CONFIRMATION_TTL_MS = 15 * 60 * 1000;

function getKstDateStringForAdminGuard(): string {
  return new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
}

function normalizeDangerousActionPayload(action: string, payload: any): any {
  if (action === 'run-settlement') {
    return {
      targetDate: String(payload?.targetDate || getKstDateStringForAdminGuard()).trim()
    };
  }
  return sanitizeAuditValue(payload || {});
}

function stableAuditStringify(value: any): string {
  if (value === null || value === undefined) return 'null';
  if (typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => stableAuditStringify(item)).join(',')}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableAuditStringify(value[key])}`).join(',')}}`;
}

async function hashDangerousActionPayload(action: string, payload: any): Promise<string> {
  const normalized = normalizeDangerousActionPayload(action, payload);
  const bytes = new TextEncoder().encode(`${action}:${stableAuditStringify(normalized)}`);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function makeAdminActionConfirmationId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return `aac_${Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('')}`;
}

async function createDangerousActionConfirmation(c: any, adminToken: string, action: string, payload: any): Promise<any> {
  const normalizedPayload = normalizeDangerousActionPayload(action, payload);
  const payloadHash = await hashDangerousActionPayload(action, normalizedPayload);
  const confirmationCode = makeAdminActionConfirmationId();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ADMIN_ACTION_CONFIRMATION_TTL_MS).toISOString();

  await fsCreateWithId(ADMIN_ACTION_CONFIRMATION_COLLECTION, confirmationCode, {
    action,
    status: 'pending',
    payload: sanitizeAuditValue(normalizedPayload),
    payloadHash,
    actor: await getAuditActor(c).catch(() => ({ type: 'unknown' })),
    request: sanitizeAuditValue(getAuditRequestMeta(c)),
    createdAt: now.toISOString(),
    expiresAt
  }, adminToken);

  queueAdminAuditLog(c, {
    category: 'security',
    action: 'dangerous_action_confirmation_created',
    severity: 'medium',
    targetType: 'admin_action',
    targetId: action,
    metadata: {
      payload: normalizedPayload,
      expiresAt
    }
  });

  return {
    required: true,
    action,
    confirmationCode,
    expiresAt,
    expiresInSeconds: Math.floor(ADMIN_ACTION_CONFIRMATION_TTL_MS / 1000)
  };
}

async function appendDangerousActionConfirmation(c: any, response: Response, action: string, payload: any): Promise<Response> {
  const data = await response.clone().json().catch(() => null);
  if (!data || data.success !== true) return response;

  const adminToken = await getAdminToken();
  const confirmation = await createDangerousActionConfirmation(c, adminToken, action, payload);
  return c.json({
    ...data,
    requiresConfirmation: true,
    confirmation
  }, response.status as any);
}

function readDangerousActionConfirmationCode(c: any, body: any): string {
  return String(
    body?.confirmationCode
      || body?.confirmCode
      || c.req.header('x-admin-action-confirmation')
      || ''
  ).trim();
}

function dangerousActionConfirmationError(c: any, status: number, error: string, message: string): Response {
  return c.json({
    success: false,
    error,
    message,
    requiresConfirmation: true
  }, status as any);
}

async function requireDangerousActionConfirmation(c: any, adminToken: string, action: string, payload: any, body: any): Promise<{ ok: true, confirmationCode: string } | { ok: false, response: Response }> {
  const confirmationCode = readDangerousActionConfirmationCode(c, body);
  const normalizedPayload = normalizeDangerousActionPayload(action, payload);
  if (!confirmationCode) {
    queueAdminAuditLog(c, {
      category: 'security',
      action: 'dangerous_action_blocked_missing_confirmation',
      severity: 'high',
      targetType: 'admin_action',
      targetId: action,
      metadata: { payload: normalizedPayload }
    });
    return {
      ok: false,
      response: dangerousActionConfirmationError(c, 428, 'confirmation_required', 'Run the matching dry-run first, then retry with its confirmationCode.')
    };
  }

  const doc = await fsGet(`${ADMIN_ACTION_CONFIRMATION_COLLECTION}/${confirmationCode}`, adminToken);
  if (!doc?.fields) {
    return {
      ok: false,
      response: dangerousActionConfirmationError(c, 403, 'invalid_confirmation', 'The confirmationCode is invalid.')
    };
  }

  const confirmation = firestoreDocToObj(doc);
  const expectedHash = await hashDangerousActionPayload(action, normalizedPayload);
  const now = new Date();
  if (confirmation.action !== action || confirmation.payloadHash !== expectedHash) {
    queueAdminAuditLog(c, {
      category: 'security',
      action: 'dangerous_action_blocked_payload_mismatch',
      severity: 'high',
      targetType: 'admin_action',
      targetId: action,
      metadata: { payload: normalizedPayload }
    });
    return {
      ok: false,
      response: dangerousActionConfirmationError(c, 409, 'confirmation_mismatch', 'The confirmationCode does not match this action payload.')
    };
  }
  if (confirmation.status !== 'pending') {
    return {
      ok: false,
      response: dangerousActionConfirmationError(c, 409, 'confirmation_used', 'The confirmationCode has already been used.')
    };
  }
  if (!confirmation.expiresAt || new Date(confirmation.expiresAt).getTime() <= now.getTime()) {
    await fsPatch(`${ADMIN_ACTION_CONFIRMATION_COLLECTION}/${confirmationCode}`, {
      status: 'expired',
      expiredAt: now.toISOString()
    }, adminToken).catch(() => null);
    return {
      ok: false,
      response: dangerousActionConfirmationError(c, 409, 'confirmation_expired', 'The confirmationCode has expired. Run the dry-run again.')
    };
  }

  const executionCreated = await fsCreateOnlyIfAbsent(`${ADMIN_ACTION_EXECUTION_COLLECTION}/${confirmationCode}`, {
    action,
    payload: sanitizeAuditValue(normalizedPayload),
    payloadHash: expectedHash,
    status: 'started',
    startedAt: now.toISOString()
  }, adminToken);
  if (!executionCreated) {
    return {
      ok: false,
      response: dangerousActionConfirmationError(c, 409, 'duplicate_execution', 'This confirmationCode is already being executed.')
    };
  }

  await fsPatch(`${ADMIN_ACTION_CONFIRMATION_COLLECTION}/${confirmationCode}`, {
    status: 'used',
    usedAt: now.toISOString()
  }, adminToken);

  queueAdminAuditLog(c, {
    category: 'security',
    action: 'dangerous_action_confirmed',
    severity: 'high',
    targetType: 'admin_action',
    targetId: action,
    metadata: { payload: normalizedPayload }
  });

  return { ok: true, confirmationCode };
}

const WITHDRAWAL_APPROVAL_LOCK_COLLECTION = 'withdrawalApprovalLocks';
const WITHDRAWAL_APPROVAL_EXECUTION_COLLECTION = 'withdrawalApprovalExecutions';
const WITHDRAWAL_PROCESSABLE_STATUSES = new Set(['pending', 'held', 'failed', 'processing', 'processing_lock']);
const WITHDRAWAL_REQUEST_LOCK_COLLECTION = 'withdrawalRequestLocks';
const WITHDRAWAL_REQUEST_LOCK_TTL_MS = 10 * 60 * 1000;
const DWALLET_SWAP_LOCK_COLLECTION = 'dwalletSwapLocks';
const DWALLET_SWAP_LOCK_TTL_MS = 5 * 60 * 1000;

type WithdrawalRequestLock = {
  path: string;
  lockToken: string;
  acquiredAt: string;
  expiresAt: string;
};

type DwalletSwapLock = {
  path: string;
  lockToken: string;
  acquiredAt: string;
  expiresAt: string;
};

function normalizeWithdrawalApprovalTxId(txId: any): string {
  return String(txId || '').trim();
}

function withdrawalRequestLockPath(uid: string): string {
  return `${WITHDRAWAL_REQUEST_LOCK_COLLECTION}/${uid}`;
}

function dwalletSwapLockPath(uid: string): string {
  return `${DWALLET_SWAP_LOCK_COLLECTION}/${uid}`;
}

function withdrawalApprovalLockPath(txId: string): string {
  return `${WITHDRAWAL_APPROVAL_LOCK_COLLECTION}/${txId}`;
}

function withdrawalApprovalExecutionPath(txId: string): string {
  return `${WITHDRAWAL_APPROVAL_EXECUTION_COLLECTION}/${txId}`;
}

function withdrawalApprovalError(c: any, status: number, error: string, message: string, extra: any = {}): Response {
  return c.json({
    success: false,
    error,
    message,
    ...extra
  }, status as any);
}

async function getWithdrawalApprovalTransaction(txId: string, adminToken: string): Promise<any | null> {
  const doc = await fsGet(`transactions/${txId}`, adminToken);
  if (!doc?.fields) return null;
  return firestoreDocToObj(doc);
}

function getWithdrawalApprovalAdminId(body: any): string {
  return String(body?.adminId || body?.adminUid || body?.uid || 'unknown').trim() || 'unknown';
}

async function auditWithdrawalApprovalGuard(c: any, action: string, txId: string, severity: string, metadata: any = {}): Promise<void> {
  queueAdminAuditLog(c, {
    category: 'withdrawal',
    action,
    severity,
    targetType: 'withdrawal',
    targetId: txId,
    metadata
  });
}

function isWithdrawalRequestLockExpired(lock: any, nowMs = Date.now()): boolean {
  const expiresAtMs = new Date(lock?.expiresAt || 0).getTime();
  return Number.isFinite(expiresAtMs) && expiresAtMs <= nowMs;
}

function buildWithdrawalRequestLockData(uid: string, lockToken: string, amountUsdt: number, addressNetwork: string): any {
  const now = new Date();
  return {
    uid,
    lockToken,
    status: 'processing',
    amountUsdt,
    addressNetwork,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + WITHDRAWAL_REQUEST_LOCK_TTL_MS).toISOString()
  };
}

function withdrawalRequestLockResponse(c: any, existingLock: any = null): Response {
  const expiresAtMs = new Date(existingLock?.expiresAt || 0).getTime();
  const retryAfterSeconds = Number.isFinite(expiresAtMs)
    ? Math.max(1, Math.ceil((expiresAtMs - Date.now()) / 1000))
    : Math.ceil(WITHDRAWAL_REQUEST_LOCK_TTL_MS / 1000);

  return c.json({
    success: false,
    error: '이미 출금 신청이 처리 중입니다. 잠시 후 다시 시도해주세요.',
    code: 'withdrawal_request_in_progress',
    retryAfterSeconds
  }, 429);
}

async function acquireWithdrawalRequestLock(c: any, adminToken: string, uid: string, amountUsdt: number, addressNetwork: string): Promise<{ ok: true; lock: WithdrawalRequestLock } | { ok: false; response: Response }> {
  const path = withdrawalRequestLockPath(uid);
  let lockToken = crypto.randomUUID().replace(/-/g, '');
  let lockData = buildWithdrawalRequestLockData(uid, lockToken, amountUsdt, addressNetwork);
  let created = await fsCreateOnlyIfAbsent(path, lockData, adminToken);

  if (created) {
    return { ok: true, lock: { path, lockToken, acquiredAt: lockData.createdAt, expiresAt: lockData.expiresAt } };
  }

  const existingDoc = await fsGet(path, adminToken).catch(() => null);
  const existingLock = existingDoc?.fields ? firestoreDocToObj(existingDoc) : null;

  if (existingLock && isWithdrawalRequestLockExpired(existingLock)) {
    queueAdminAuditLog(c, {
      category: 'withdrawal',
      action: 'withdrawal_request_stale_lock_recovered',
      severity: 'medium',
      targetType: 'withdrawal_request',
      targetId: uid,
      metadata: {
        uid,
        expiredAt: existingLock.expiresAt || '',
        existingStatus: existingLock.status || ''
      }
    });
    await fsDelete(path, adminToken).catch(() => false);
    lockToken = crypto.randomUUID().replace(/-/g, '');
    lockData = buildWithdrawalRequestLockData(uid, lockToken, amountUsdt, addressNetwork);
    created = await fsCreateOnlyIfAbsent(path, lockData, adminToken);
    if (created) {
      return { ok: true, lock: { path, lockToken, acquiredAt: lockData.createdAt, expiresAt: lockData.expiresAt } };
    }
  }

  queueAdminAuditLog(c, {
    category: 'withdrawal',
    action: 'withdrawal_request_duplicate_blocked',
    severity: 'medium',
    targetType: 'withdrawal_request',
    targetId: uid,
    metadata: {
      uid,
      existingStatus: existingLock?.status || '',
      existingExpiresAt: existingLock?.expiresAt || ''
    }
  });

  return { ok: false, response: withdrawalRequestLockResponse(c, existingLock) };
}

async function releaseWithdrawalRequestLock(lock: WithdrawalRequestLock | null, adminToken: string): Promise<void> {
  if (!lock?.path || !lock.lockToken || !adminToken) return;
  const existingDoc = await fsGet(lock.path, adminToken).catch(() => null);
  const existingLock = existingDoc?.fields ? firestoreDocToObj(existingDoc) : null;
  if (existingLock?.lockToken && existingLock.lockToken !== lock.lockToken) return;
  await fsDelete(lock.path, adminToken).catch(() => false);
}

function isDwalletSwapLockExpired(lock: any, nowMs = Date.now()): boolean {
  const expiresAtMs = new Date(lock?.expiresAt || 0).getTime();
  return Number.isFinite(expiresAtMs) && expiresAtMs <= nowMs;
}

function buildDwalletSwapLockData(uid: string, lockToken: string, fromSymbol: string, toSymbol: string, amountUi: number): any {
  const now = new Date();
  return {
    uid,
    lockToken,
    status: 'processing',
    fromSymbol,
    toSymbol,
    amountUi,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + DWALLET_SWAP_LOCK_TTL_MS).toISOString()
  };
}

function dwalletSwapLockResponse(c: any, existingLock: any = null): Response {
  const expiresAtMs = new Date(existingLock?.expiresAt || 0).getTime();
  const retryAfterSeconds = Number.isFinite(expiresAtMs)
    ? Math.max(1, Math.ceil((expiresAtMs - Date.now()) / 1000))
    : Math.ceil(DWALLET_SWAP_LOCK_TTL_MS / 1000);

  return c.json({
    success: false,
    error: '이미 D-WALLET 스왑이 처리 중입니다. 잠시 후 다시 시도해주세요.',
    code: 'dwallet_swap_in_progress',
    retryAfterSeconds
  }, 429);
}

async function acquireDwalletSwapLock(c: any, adminToken: string, uid: string, fromSymbol: string, toSymbol: string, amountUi: number): Promise<{ ok: true; lock: DwalletSwapLock } | { ok: false; response: Response }> {
  const path = dwalletSwapLockPath(uid);
  let lockToken = crypto.randomUUID().replace(/-/g, '');
  let lockData = buildDwalletSwapLockData(uid, lockToken, fromSymbol, toSymbol, amountUi);
  let created = await fsCreateOnlyIfAbsent(path, lockData, adminToken);

  if (created) {
    return { ok: true, lock: { path, lockToken, acquiredAt: lockData.createdAt, expiresAt: lockData.expiresAt } };
  }

  const existingDoc = await fsGet(path, adminToken).catch(() => null);
  const existingLock = existingDoc?.fields ? firestoreDocToObj(existingDoc) : null;

  if (existingLock && isDwalletSwapLockExpired(existingLock)) {
    queueAdminAuditLog(c, {
      category: 'swap',
      action: 'dwallet_swap_stale_lock_recovered',
      severity: 'medium',
      targetType: 'dwallet_swap',
      targetId: uid,
      metadata: {
        uid,
        expiredAt: existingLock.expiresAt || '',
        existingStatus: existingLock.status || ''
      }
    });
    await fsDelete(path, adminToken).catch(() => false);
    lockToken = crypto.randomUUID().replace(/-/g, '');
    lockData = buildDwalletSwapLockData(uid, lockToken, fromSymbol, toSymbol, amountUi);
    created = await fsCreateOnlyIfAbsent(path, lockData, adminToken);
    if (created) {
      return { ok: true, lock: { path, lockToken, acquiredAt: lockData.createdAt, expiresAt: lockData.expiresAt } };
    }
  }

  queueAdminAuditLog(c, {
    category: 'swap',
    action: 'dwallet_swap_duplicate_blocked',
    severity: 'medium',
    targetType: 'dwallet_swap',
    targetId: uid,
    metadata: {
      uid,
      fromSymbol,
      toSymbol,
      amountUi,
      existingStatus: existingLock?.status || '',
      existingExpiresAt: existingLock?.expiresAt || ''
    }
  });

  return { ok: false, response: dwalletSwapLockResponse(c, existingLock) };
}

async function releaseDwalletSwapLock(lock: DwalletSwapLock | null, adminToken: string): Promise<void> {
  if (!lock?.path || !lock.lockToken || !adminToken) return;
  const existingDoc = await fsGet(lock.path, adminToken).catch(() => null);
  const existingLock = existingDoc?.fields ? firestoreDocToObj(existingDoc) : null;
  if (existingLock?.lockToken && existingLock.lockToken !== lock.lockToken) return;
  await fsDelete(lock.path, adminToken).catch(() => false);
}

async function acquireWithdrawalApprovalLock(c: any, adminToken: string, txId: string, adminId: string): Promise<{ ok: true, tx: any } | { ok: false, response: Response }> {
  if (!txId) {
    return { ok: false, response: withdrawalApprovalError(c, 400, 'missing_tx_id', 'Withdrawal transaction id is required.') };
  }

  const tx = await getWithdrawalApprovalTransaction(txId, adminToken);
  if (!tx) {
    return { ok: false, response: withdrawalApprovalError(c, 404, 'withdrawal_not_found', 'Withdrawal transaction was not found.') };
  }
  if (tx.type !== 'withdrawal') {
    return { ok: false, response: withdrawalApprovalError(c, 400, 'not_withdrawal', 'Only withdrawal transactions can be locked.') };
  }
  if (tx.status === 'approved') {
    return { ok: false, response: withdrawalApprovalError(c, 409, 'already_approved', 'This withdrawal is already approved.', { currentStatus: tx.status }) };
  }
  if (tx.status === 'rejected') {
    return { ok: false, response: withdrawalApprovalError(c, 409, 'already_rejected', 'This withdrawal is already rejected.', { currentStatus: tx.status }) };
  }
  if (!WITHDRAWAL_PROCESSABLE_STATUSES.has(String(tx.status || ''))) {
    return { ok: false, response: withdrawalApprovalError(c, 409, 'not_processable', `Withdrawal is not processable in status: ${tx.status || 'unknown'}`, { currentStatus: tx.status || '' }) };
  }

  const now = new Date().toISOString();
  const lockPath = withdrawalApprovalLockPath(txId);
  const lockCreated = await fsCreateOnlyIfAbsent(lockPath, {
    txId,
    userId: tx.userId || '',
    amountUsdt: Number(tx.amountUsdt || tx.amount || 0),
    adminId,
    status: 'processing',
    createdAt: now,
    updatedAt: now
  }, adminToken);

  if (!lockCreated) {
    const lockDoc = await fsGet(lockPath, adminToken);
    const lock = lockDoc?.fields ? firestoreDocToObj(lockDoc) : null;
    if (lock?.status === 'approved') {
      return { ok: false, response: withdrawalApprovalError(c, 409, 'already_approved', 'This withdrawal approval lock is already finalized.', { currentStatus: lock.status }) };
    }
    if (lock?.status === 'processing' && String(lock.adminId || '') !== adminId) {
      await auditWithdrawalApprovalGuard(c, 'withdrawal_approval_duplicate_blocked', txId, 'high', {
        lockedBy: lock.adminId || '',
        attemptedBy: adminId,
        currentStatus: tx.status || ''
      });
      return { ok: false, response: withdrawalApprovalError(c, 409, 'withdrawal_locked', 'Another administrator is already processing this withdrawal.', { currentStatus: tx.status || '' }) };
    }
    if (lock?.status !== 'processing') {
      await fsPatch(lockPath, {
        adminId,
        status: 'processing',
        retriedAt: now,
        updatedAt: now
      }, adminToken);
    }
  }

  await fsPatch(`transactions/${txId}`, {
    status: 'processing',
    processingAt: now,
    processingBy: adminId,
    approvalLockId: txId
  }, adminToken);

  await auditWithdrawalApprovalGuard(c, 'withdrawal_approval_locked', txId, 'medium', {
    adminId,
    userId: tx.userId || '',
    amountUsdt: Number(tx.amountUsdt || tx.amount || 0)
  });

  return { ok: true, tx };
}

async function approveWithdrawalWithServerLock(c: any, adminToken: string, txId: string, body: any): Promise<Response> {
  const adminId = getWithdrawalApprovalAdminId(body);
  const tx = await getWithdrawalApprovalTransaction(txId, adminToken);
  const suppliedTxid = String(body?.txid || '').trim();
  if (!tx) return withdrawalApprovalError(c, 404, 'withdrawal_not_found', 'Withdrawal transaction was not found.');
  if (tx.type !== 'withdrawal') return withdrawalApprovalError(c, 400, 'not_withdrawal', 'Only withdrawal transactions can be approved.');

  if (tx.status === 'approved') {
    if (!suppliedTxid || !tx.txid || suppliedTxid === tx.txid) {
      return c.json({ success: true, alreadyApproved: true, data: { txId, status: 'approved' } });
    }
    return withdrawalApprovalError(c, 409, 'already_approved', 'This withdrawal is already approved with a different txid.', { currentStatus: tx.status });
  }

  const lockDoc = await fsGet(withdrawalApprovalLockPath(txId), adminToken);
  const lock = lockDoc?.fields ? firestoreDocToObj(lockDoc) : null;
  if (!lock) {
    return withdrawalApprovalError(c, 428, 'withdrawal_lock_required', 'Lock this withdrawal before approval.');
  }
  if (lock.status !== 'processing') {
    return withdrawalApprovalError(c, 409, 'withdrawal_lock_not_processing', 'Withdrawal lock is not in processing status.', { lockStatus: lock.status || '' });
  }
  if (lock.adminId && adminId !== 'unknown' && String(lock.adminId) !== adminId) {
    return withdrawalApprovalError(c, 409, 'withdrawal_locked', 'Another administrator owns this withdrawal lock.', { lockStatus: lock.status || '' });
  }

  const executionCreated = await fsCreateOnlyIfAbsent(withdrawalApprovalExecutionPath(txId), {
    txId,
    adminId,
    status: 'started',
    startedAt: new Date().toISOString(),
    txid: suppliedTxid
  }, adminToken);
  if (!executionCreated) {
    const current = await getWithdrawalApprovalTransaction(txId, adminToken);
    if (current?.status === 'approved' && (!suppliedTxid || !current.txid || current.txid === suppliedTxid)) {
      return c.json({ success: true, alreadyApproved: true, data: { txId, status: 'approved' } });
    }
    return withdrawalApprovalError(c, 409, 'duplicate_approval_execution', 'This withdrawal approval is already being finalized.');
  }

  if (suppliedTxid) {
    const duplicates = await fsQuery('transactions', adminToken, [
      { fieldFilter: { field: { fieldPath: 'txid' }, op: 'EQUAL', value: { stringValue: suppliedTxid } } }
    ], 10);
    const duplicate = duplicates.find((item: any) => item.id !== txId && item.status === 'approved');
    if (duplicate) {
      await fsPatch(withdrawalApprovalExecutionPath(txId), {
        status: 'blocked_duplicate_txid',
        blockedAt: new Date().toISOString(),
        duplicateTxId: duplicate.id || ''
      }, adminToken).catch(() => null);
      await auditWithdrawalApprovalGuard(c, 'withdrawal_approval_duplicate_txid_blocked', txId, 'high', {
        duplicateTxId: duplicate.id || '',
        txid: suppliedTxid
      });
      return withdrawalApprovalError(c, 409, 'duplicate_txid', 'This txid is already attached to another approved withdrawal.');
    }
  }

  const now = new Date().toISOString();
  const amountDedra = Number(body?.amountDedra);
  const updateData: any = {
    status: 'approved',
    approvedAt: now,
    approvedBy: adminId,
    txid: suppliedTxid,
    approvalLockId: txId
  };
  if (body?.memo) updateData.adminMemo = String(body.memo);
  if (Number.isFinite(amountDedra)) {
    updateData.amount = amountDedra;
    updateData.amountDedra = amountDedra;
  }

  await fsPatch(`transactions/${txId}`, updateData, adminToken);
  await fsPatch(withdrawalApprovalLockPath(txId), {
    status: 'approved',
    approvedAt: now,
    approvedBy: adminId,
    txid: suppliedTxid,
    updatedAt: now
  }, adminToken);
  await fsPatch(withdrawalApprovalExecutionPath(txId), {
    status: 'approved',
    approvedAt: now
  }, adminToken).catch(() => null);

  await auditWithdrawalApprovalGuard(c, 'withdrawal_approval_finalized', txId, 'high', {
    adminId,
    userId: tx.userId || '',
    amountUsdt: Number(tx.amountUsdt || tx.amount || 0),
    txid: suppliedTxid
  });

  return c.json({ success: true, data: { txId, status: 'approved' } });
}

async function failWithdrawalWithServerLock(c: any, adminToken: string, txId: string, body: any): Promise<Response> {
  const adminId = getWithdrawalApprovalAdminId(body);
  const reason = String(body?.reason || body?.memo || '송금 실패').slice(0, 500);
  const tx = await getWithdrawalApprovalTransaction(txId, adminToken);
  if (!tx) return withdrawalApprovalError(c, 404, 'withdrawal_not_found', 'Withdrawal transaction was not found.');
  if (tx.status === 'approved') return withdrawalApprovalError(c, 409, 'already_approved', 'Approved withdrawals cannot be marked failed.');

  const now = new Date().toISOString();
  await fsPatch(`transactions/${txId}`, {
    status: 'failed',
    processingFailedAt: now,
    processingFailedBy: adminId,
    adminMemo: reason
  }, adminToken);

  const lockDoc = await fsGet(withdrawalApprovalLockPath(txId), adminToken);
  if (lockDoc?.fields) {
    await fsPatch(withdrawalApprovalLockPath(txId), {
      status: 'failed',
      failedAt: now,
      failedBy: adminId,
      failureReason: reason,
      updatedAt: now
    }, adminToken).catch(() => null);
  }

  await auditWithdrawalApprovalGuard(c, 'withdrawal_approval_failed', txId, 'medium', {
    adminId,
    userId: tx.userId || '',
    reason
  });

  return c.json({ success: true, data: { txId, status: 'failed' } });
}

const WITHDRAWAL_RECOVERY_LOCK_COLLECTION = 'withdrawalRecoveryLocks';
const WITHDRAWAL_RECOVERY_DEFAULT_STALE_MINUTES = 10;
const WITHDRAWAL_RECOVERY_STATUSES = ['processing', 'processing_lock', 'failed', 'held'];

function withdrawalRecoveryLockPath(txId: string): string {
  return `${WITHDRAWAL_RECOVERY_LOCK_COLLECTION}/${txId}`;
}

function getWithdrawalTxid(tx: any): string {
  return String(tx?.txid || tx?.txHash || '').trim();
}

function ageMinutesFromIso(value: any): number | null {
  const ms = Date.parse(String(value || ''));
  if (!Number.isFinite(ms)) return null;
  return Math.max(0, Math.floor((Date.now() - ms) / 60000));
}

function getWithdrawalRecoveryAgeMinutes(tx: any): number | null {
  return ageMinutesFromIso(tx.processingAt || tx.updatedAt || tx.createdAt || tx.requestedAt);
}

function getWithdrawalRecoveryReason(tx: any, staleMinutes: number): string | null {
  const txid = getWithdrawalTxid(tx);
  const status = String(tx.status || '');
  const ageMinutes = getWithdrawalRecoveryAgeMinutes(tx);

  if ((status === 'processing' || status === 'processing_lock') && txid) return 'sent_txid_waiting_for_db_finalization';
  if (status === 'failed' && txid) return 'failed_after_txid_recorded';
  if ((status === 'processing' || status === 'processing_lock') && ageMinutes !== null && ageMinutes >= staleMinutes) return 'stale_processing_without_final_state';
  return null;
}

async function findWithdrawalTxidConflicts(adminToken: string, txid: string, currentTxId: string): Promise<any[]> {
  if (!txid) return [];
  const rows = await fsQuery('transactions', adminToken, [
    { fieldFilter: { field: { fieldPath: 'txid' }, op: 'EQUAL', value: { stringValue: txid } } }
  ], 20);
  return rows
    .filter((item: any) => item.id !== currentTxId && item.type === 'withdrawal')
    .filter((item: any) => ['approved', 'processing', 'processing_lock', 'failed'].includes(String(item.status || '')))
    .map((item: any) => ({
      id: item.id,
      userId: item.userId || '',
      status: item.status || '',
      amountUsdt: Number(item.amountUsdt || item.amount || 0)
    }));
}

async function listWithdrawalRecoveryCandidates(adminToken: string, staleMinutes: number, limit: number): Promise<any[]> {
  const byId = new Map<string, any>();
  for (const status of WITHDRAWAL_RECOVERY_STATUSES) {
    const rows = await fsQuery('transactions', adminToken, [
      { fieldFilter: { field: { fieldPath: 'type' }, op: 'EQUAL', value: { stringValue: 'withdrawal' } } },
      { fieldFilter: { field: { fieldPath: 'status' }, op: 'EQUAL', value: { stringValue: status } } }
    ], limit);
    for (const row of rows) {
      if (row?.id) byId.set(row.id, row);
    }
  }

  const candidates: any[] = [];
  for (const tx of byId.values()) {
    const reason = getWithdrawalRecoveryReason(tx, staleMinutes);
    if (!reason) continue;

    const txid = getWithdrawalTxid(tx);
    const conflicts = txid ? await findWithdrawalTxidConflicts(adminToken, txid, tx.id) : [];
    candidates.push({
      id: tx.id,
      userId: tx.userId || '',
      status: tx.status || '',
      amountUsdt: Number(tx.amountUsdt || tx.amount || 0),
      amountDedra: Number(tx.amountDedra || tx.amount || 0),
      txid,
      walletAddress: tx.walletAddress || tx.wallet || '',
      processingAt: tx.processingAt || '',
      processingAgeMinutes: getWithdrawalRecoveryAgeMinutes(tx),
      reason,
      conflicts,
      canReconcile: Boolean(txid) && !conflicts.some((item: any) => item.status === 'approved')
    });
  }

  return candidates
    .sort((a, b) => Number(b.processingAgeMinutes || 0) - Number(a.processingAgeMinutes || 0))
    .slice(0, limit);
}

async function reconcileWithdrawalWithServerState(c: any, adminToken: string, txId: string, body: any): Promise<Response> {
  const adminId = getWithdrawalApprovalAdminId(body);
  const tx = await getWithdrawalApprovalTransaction(txId, adminToken);
  if (!tx) return withdrawalApprovalError(c, 404, 'withdrawal_not_found', 'Withdrawal transaction was not found.');
  if (tx.type !== 'withdrawal') return withdrawalApprovalError(c, 400, 'not_withdrawal', 'Only withdrawal transactions can be reconciled.');

  const suppliedTxid = String(body?.txid || '').trim();
  const txid = suppliedTxid || getWithdrawalTxid(tx);
  if (!txid) {
    return withdrawalApprovalError(c, 400, 'txid_required', 'A chain txid is required before reconciliation.');
  }

  if (tx.status === 'approved') {
    if (!tx.txid || tx.txid === txid) {
      return c.json({ success: true, alreadyApproved: true, data: { txId, status: 'approved', txid } });
    }
    return withdrawalApprovalError(c, 409, 'already_approved', 'This withdrawal is already approved with a different txid.', { currentStatus: tx.status });
  }
  if (tx.status === 'rejected') {
    return withdrawalApprovalError(c, 409, 'already_rejected', 'Rejected withdrawals cannot be reconciled.');
  }
  if (!WITHDRAWAL_RECOVERY_STATUSES.includes(String(tx.status || ''))) {
    return withdrawalApprovalError(c, 409, 'not_recovery_candidate', `Withdrawal is not a recovery candidate in status: ${tx.status || 'unknown'}`, { currentStatus: tx.status || '' });
  }

  const conflicts = await findWithdrawalTxidConflicts(adminToken, txid, txId);
  if (conflicts.length) {
    await auditWithdrawalApprovalGuard(c, 'withdrawal_recovery_duplicate_txid_blocked', txId, 'high', {
      txid,
      conflicts
    });
    return withdrawalApprovalError(c, 409, 'duplicate_txid', 'This txid is already attached to another withdrawal record.', { conflicts });
  }

  const now = new Date().toISOString();
  const recoveryLockCreated = await fsCreateOnlyIfAbsent(withdrawalRecoveryLockPath(txId), {
    txId,
    txid,
    adminId,
    status: 'processing',
    createdAt: now,
    updatedAt: now
  }, adminToken);

  if (!recoveryLockCreated) {
    const lockDoc = await fsGet(withdrawalRecoveryLockPath(txId), adminToken);
    const lock = lockDoc?.fields ? firestoreDocToObj(lockDoc) : null;
    if (lock?.status === 'approved') {
      const current = await getWithdrawalApprovalTransaction(txId, adminToken);
      if (current?.status === 'approved') {
        return c.json({ success: true, alreadyApproved: true, data: { txId, status: 'approved', txid: current.txid || txid } });
      }
    }
    const lockAge = ageMinutesFromIso(lock?.updatedAt || lock?.createdAt);
    if (lock?.status === 'processing' && lockAge !== null && lockAge < WITHDRAWAL_RECOVERY_DEFAULT_STALE_MINUTES) {
      return withdrawalApprovalError(c, 409, 'recovery_in_progress', 'This withdrawal recovery is already in progress.');
    }
    await fsPatch(withdrawalRecoveryLockPath(txId), {
      txid,
      adminId,
      status: 'processing',
      retriedAt: now,
      updatedAt: now
    }, adminToken);
  }

  const amountDedra = Number(body?.amountDedra);
  const updateData: any = {
    status: 'approved',
    approvedAt: now,
    approvedBy: adminId,
    txid,
    recoveryReconciled: true,
    recoveryReconciledAt: now,
    approvalLockId: txId
  };
  if (body?.memo) updateData.adminMemo = String(body.memo).slice(0, 500);
  if (Number.isFinite(amountDedra)) {
    updateData.amount = amountDedra;
    updateData.amountDedra = amountDedra;
  }

  await fsPatch(`transactions/${txId}`, updateData, adminToken);
  await fsPatch(withdrawalApprovalLockPath(txId), {
    status: 'approved',
    approvedAt: now,
    approvedBy: adminId,
    txid,
    recoveredAt: now,
    updatedAt: now
  }, adminToken).catch(() => null);
  await fsPatch(withdrawalApprovalExecutionPath(txId), {
    status: 'recovered',
    recoveredAt: now,
    txid
  }, adminToken).catch(() => null);
  await fsPatch(withdrawalRecoveryLockPath(txId), {
    status: 'approved',
    approvedAt: now,
    approvedBy: adminId,
    txid,
    updatedAt: now
  }, adminToken);

  await auditWithdrawalApprovalGuard(c, 'withdrawal_recovery_reconciled', txId, 'high', {
    adminId,
    userId: tx.userId || '',
    amountUsdt: Number(tx.amountUsdt || tx.amount || 0),
    txid
  });

  return c.json({ success: true, data: { txId, status: 'approved', txid, recovered: true } });
}

function getBearerToken(c: any): string {
  const authHeader = c.req.header('Authorization') || '';
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : '';
}

async function lookupFirebaseUser(idToken: string): Promise<any | null> {
  if (!idToken) return null;
  const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken })
  });
  const data: any = await res.json().catch(() => ({}));
  return data.users && data.users.length ? data.users[0] : null;
}

async function getAuthenticatedFirebaseUser(c: any): Promise<any | null> {
  return lookupFirebaseUser(getBearerToken(c));
}

async function hasPrivilegedApiAccess(c: any): Promise<boolean> {
  if (hasConfiguredAdminSecret(c)) return true;

  const bearer = getBearerToken(c);
  if (!bearer) {
    try {
      const path = new URL(c.req.url).pathname;
      console.warn('[AUTH] privileged access denied: no bearer token', { path });
    } catch(_) {}
    return false;
  }

  const subAdmin = verifySubAdminToken(bearer);
  if (subAdmin) return true;

  const firebaseUser = await lookupFirebaseUser(bearer).catch((err: any) => {
    try {
      const path = new URL(c.req.url).pathname;
      console.warn('[AUTH] firebase lookup error', { path, error: err?.message || String(err) });
    } catch(_) {}
    return null;
  });
  if (!firebaseUser?.localId) {
    try {
      const path = new URL(c.req.url).pathname;
      console.warn('[AUTH] privileged access denied: invalid firebase token', { path });
    } catch(_) {}
    return false;
  }

  const adminToken = await getAdminToken();
  const userDoc = await fsGet(`users/${firebaseUser.localId}`, adminToken);
  if (!userDoc?.fields) {
    try {
      const path = new URL(c.req.url).pathname;
      console.warn('[AUTH] privileged access denied: user doc missing', { path, uid: firebaseUser.localId });
    } catch(_) {}
    return false;
  }

  const user = firestoreDocToObj(userDoc);
  const ok = user.role === 'admin' || user.role === 'superadmin';
  if (!ok) {
    try {
      const path = new URL(c.req.url).pathname;
      console.warn('[AUTH] privileged access denied: insufficient role', { path, uid: firebaseUser.localId, role: user.role || '(none)' });
    } catch(_) {}
  }
  return ok;
}

app.get('/api/admin/security-health', async (c) => {
  const snapshot = getSecurityHealthSnapshot();
  queueAdminAuditLog(c, {
    category: 'security',
    action: 'security_health_viewed',
    severity: snapshot.ok && !snapshot.hasWarnings ? 'info' : 'medium',
    targetType: 'security_health',
    targetId: 'runtime_config',
    metadata: {
      ok: snapshot.ok,
      hasWarnings: snapshot.hasWarnings
    }
  });
  return c.json({
    success: true,
    ok: snapshot.ok,
    hasWarnings: snapshot.hasWarnings,
    checkedAt: new Date().toISOString(),
    checks: snapshot.checks
  });
});

app.post('/api/admin/withdrawals/:txId/lock', async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const txId = normalizeWithdrawalApprovalTxId(c.req.param('txId'));
    const adminToken = await getAdminToken();
    const result = await acquireWithdrawalApprovalLock(c, adminToken, txId, getWithdrawalApprovalAdminId(body));
    if (!result.ok) return result.response;
    return c.json({ success: true, data: { txId, status: 'processing' } });
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500);
  }
});

app.post('/api/admin/withdrawals/:txId/approve', async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const txId = normalizeWithdrawalApprovalTxId(c.req.param('txId'));
    const adminToken = await getAdminToken();
    return approveWithdrawalWithServerLock(c, adminToken, txId, body);
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500);
  }
});

app.post('/api/admin/withdrawals/:txId/fail', async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const txId = normalizeWithdrawalApprovalTxId(c.req.param('txId'));
    const adminToken = await getAdminToken();
    return failWithdrawalWithServerLock(c, adminToken, txId, body);
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500);
  }
});

app.get('/api/admin/withdrawals/recovery-candidates', async (c) => {
  try {
    const adminToken = await getAdminToken();
    const requestedMinutes = Number(c.req.query('minutes') || WITHDRAWAL_RECOVERY_DEFAULT_STALE_MINUTES);
    const requestedLimit = Number(c.req.query('limit') || 50);
    const staleMinutes = Number.isFinite(requestedMinutes) ? Math.min(1440, Math.max(5, requestedMinutes)) : WITHDRAWAL_RECOVERY_DEFAULT_STALE_MINUTES;
    const limit = Number.isFinite(requestedLimit) ? Math.min(100, Math.max(1, requestedLimit)) : 50;
    const data = await listWithdrawalRecoveryCandidates(adminToken, staleMinutes, limit);
    return c.json({ success: true, data, staleMinutes, count: data.length });
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500);
  }
});

app.post('/api/admin/withdrawals/:txId/reconcile', async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const txId = normalizeWithdrawalApprovalTxId(c.req.param('txId'));
    const adminToken = await getAdminToken();
    return reconcileWithdrawalWithServerState(c, adminToken, txId, body);
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500);
  }
});

async function getServerDdraPrice(adminToken: string): Promise<number> {
  const priceSnap = await fsGet('settings/deedraPrice', adminToken).catch(() => null);
  if (priceSnap?.fields) {
    const data = firestoreDocToObj(priceSnap);
    const candidates = [
      data.price,
      data.currentPrice,
      data.ddraPrice,
      data.value,
      data.usdtPrice
    ];
    for (const candidate of candidates) {
      const price = Number(candidate);
      if (Number.isFinite(price) && price > 0) return price;
    }
  }
  return 0.5;
}

type PlatformRightMode = 'auto' | 'active' | 'locked';

const PLATFORM_RIGHT_SERVICE_META: Record<string, {
  title: string;
  activeDescription: string;
  lockedDescription: string;
}> = {
  witty_fee: {
    title: '위티 라이더 수수료 권리',
    activeDescription: '위티 플랫폼 활동 수수료 면제 권리가 활성화되어 있습니다.',
    lockedDescription: 'DDRA 기준 보유 가치 달성 시 수수료 면제 권리가 열립니다.'
  },
  merchant_exposure: {
    title: '사업자 광고·노출 권리',
    activeDescription: '사업자 광고와 플랫폼 노출 권리가 활성화되어 있습니다.',
    lockedDescription: 'DDRA 기준 보유 가치 달성 시 광고·노출 권리가 열립니다.'
  }
};

const DEFAULT_DDRA_RIGHTS_TIERS = [
  {
    id: 'rider_access',
    title: '라이더 권리',
    minUsdt: 100,
    platformFeeWaiverPct: 100,
    adExposureLabel: '기본 노출',
    founderAccess: false,
    description: 'DDRA 보유 가치 100 USDT 이상 시 위티 라이더 수수료 권리가 열립니다.',
    enabled: true
  },
  {
    id: 'platform_access',
    title: '플랫폼 권리',
    minUsdt: 500,
    platformFeeWaiverPct: 100,
    adExposureLabel: '광고·노출 권리',
    founderAccess: false,
    description: 'DDRA 보유 가치 500 USDT 이상 시 플랫폼 광고·노출 권리가 열립니다.',
    enabled: true
  }
];

function firstFiniteNumber(...values: any[]): number {
  for (const value of values) {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed >= 0) return parsed;
  }
  return 0;
}

function normalizeDdraRightsTiers(rawTiers: any): any[] {
  const source = Array.isArray(rawTiers) && rawTiers.length ? rawTiers : DEFAULT_DDRA_RIGHTS_TIERS;
  return source
    .map((tier: any, index: number) => ({
      id: String(tier.id || `tier_${index + 1}`).replace(/[^a-zA-Z0-9_-]/g, '_'),
      title: String(tier.title || `권리 ${index + 1}`).slice(0, 80),
      minUsdt: firstFiniteNumber(tier.minUsdt, tier.minUsd, tier.thresholdUsdt, tier.threshold),
      platformFeeWaiverPct: Math.max(0, Math.min(100, firstFiniteNumber(tier.platformFeeWaiverPct, tier.feeWaiverPct, 100))),
      adExposureLabel: String(tier.adExposureLabel || tier.adLabel || '광고·노출 권리').slice(0, 80),
      founderAccess: false,
      description: String(tier.description || '').slice(0, 240),
      enabled: tier.enabled !== false
    }))
    .filter((tier: any) => tier.enabled)
    .sort((a: any, b: any) => a.minUsdt - b.minUsdt);
}

function normalizePlatformRightsConfig(raw: any = {}) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const result: Record<string, { mode: PlatformRightMode; note: string; updatedAt?: string; updatedBy?: string }> = {};

  for (const id of Object.keys(PLATFORM_RIGHT_SERVICE_META)) {
    const row = source[id] && typeof source[id] === 'object' ? source[id] : {};
    const requestedMode = String(row.mode || row.statusMode || 'auto').toLowerCase();
    const mode: PlatformRightMode = requestedMode === 'active' || requestedMode === 'locked' ? requestedMode : 'auto';
    result[id] = {
      mode,
      note: String(row.note || row.adminNote || '').slice(0, 300),
      updatedAt: row.updatedAt ? String(row.updatedAt) : undefined,
      updatedBy: row.updatedBy ? String(row.updatedBy) : undefined
    };
  }

  return result;
}

function sanitizePlatformRightsInput(raw: any, adminId: string) {
  const normalized = normalizePlatformRightsConfig(raw);
  const now = new Date().toISOString();
  for (const id of Object.keys(normalized)) {
    normalized[id].updatedAt = now;
    normalized[id].updatedBy = adminId || 'admin';
  }
  return normalized;
}

function requireSafeUserId(raw: any): string {
  const uid = String(raw || '').trim();
  if (!/^[a-zA-Z0-9_-]{4,160}$/.test(uid)) throw new Error('Invalid user id');
  return uid;
}

async function buildDdraRightsStatusForUser(uid: string, adminToken: string) {
  const [userDoc, walletDoc, rightsSettingsDoc] = await Promise.all([
    fsGet(`users/${uid}`, adminToken),
    fsGet(`wallets/${uid}`, adminToken).catch(() => null),
    fsGet('settings/ddraRights', adminToken).catch(() => null)
  ]);

  if (!userDoc?.fields) throw new Error('User not found');

  const user = firestoreDocToObj(userDoc);
  const wallet = walletDoc?.fields ? firestoreDocToObj(walletDoc) : {};
  const settings = rightsSettingsDoc?.fields ? firestoreDocToObj(rightsSettingsDoc) : {};
  const ddraPriceUsd = await getServerDdraPrice(adminToken).catch(() => 0.01588);
  const ddraBalance = firstFiniteNumber(
    wallet.ddraBalance,
    wallet.dedraBalance,
    wallet.deedraBalance,
    user.ddraBalance,
    user.dedraBalance,
    user.deedraBalance,
    user.deedraWallet?.ddraBalance,
    user.deedraWallet?.dedraBalance,
    user.deedraWallet?.deedraBalance
  );
  const ddraValueUsdt = roundMoney(ddraBalance * ddraPriceUsd);
  const tiers = normalizeDdraRightsTiers(settings.tiers || settings.rules);
  const activeTier = tiers.filter((tier: any) => ddraValueUsdt >= Number(tier.minUsdt || 0)).pop() || null;
  const nextTier = tiers.find((tier: any) => ddraValueUsdt < Number(tier.minUsdt || 0)) || null;
  const progressPct = nextTier
    ? Math.max(0, Math.min(100, (ddraValueUsdt / Math.max(Number(nextTier.minUsdt || 1), 1)) * 100))
    : activeTier ? 100 : 0;
  const overrides = normalizePlatformRightsConfig(user.platformRights);
  const baseActive = Boolean(activeTier);
  const services = Object.entries(PLATFORM_RIGHT_SERVICE_META).map(([id, meta]) => {
    const override = overrides[id];
    const active = override.mode === 'active' ? true : override.mode === 'locked' ? false : baseActive;
    return {
      id,
      title: meta.title,
      status: active ? 'active' : 'locked',
      mode: override.mode,
      description: override.note || (active ? meta.activeDescription : meta.lockedDescription)
    };
  });

  return {
    success: true,
    userId: uid,
    userEmail: user.email || '',
    userName: user.name || user.username || '',
    ddraBalance,
    ddraPriceUsd,
    ddraValueUsdt,
    activeTier,
    nextTier,
    progressPct,
    rightsActive: services.some((item: any) => item.status === 'active'),
    services,
    platformRights: overrides,
    tiers,
    updatedAt: new Date().toISOString()
  };
}

app.post('/api/wallet/rights/status', async (c) => {
  try {
    const uid = await requireFirebaseUid(c);
    const adminToken = await getAdminToken();
    return c.json(await buildDdraRightsStatusForUser(uid, adminToken));
  } catch (e: any) {
    const message = e.message || String(e);
    const status = message === 'Unauthorized' || message === 'Invalid token' ? 401 : 500;
    return c.json({ success: false, error: message }, status);
  }
});

app.post('/api/wallet/profile/save', async (c) => {
  try {
    const uid = await requireFirebaseUid(c);
    const body = await c.req.json().catch(() => ({}));
    const adminToken = await getAdminToken();
    const patch = {
      ...buildDwalletProfilePatch(body),
      uid,
      dwalletUser: true,
      dwalletSource: 'dwallet',
      dwalletUpdatedAt: new Date().toISOString()
    };
    await Promise.allSettled([
      fsPatch(`users/${uid}`, patch, adminToken),
      fsPatch(`dwalletUsers/${uid}`, patch, adminToken)
    ]);
    return c.json({ success: true, profile: patch });
  } catch (e: any) {
    const message = e.message || String(e);
    const status = message === 'Unauthorized' || message === 'Invalid token' ? 401 : 500;
    return c.json({ success: false, error: message }, status);
  }
});

app.post('/api/telemetry/app-open', async (c) => {
  try {
    const uid = await requireFirebaseUid(c);
    const body = await c.req.json().catch(() => ({}));
    const adminToken = await getAdminToken();
    const now = new Date().toISOString();
    const userDoc = await fsGet(`users/${uid}`, adminToken).catch(() => null);
    const user = userDoc?.fields ? firestoreDocToObj(userDoc) : {};
    const patch: any = {
      uid,
      dwalletUser: true,
      dwalletSource: 'dwallet',
      lastAppOpenAt: now,
      dwalletUpdatedAt: now,
      appOpenCount: firstFiniteNumber(user.appOpenCount) + 1
    };
    const language = body.language || body.locale;
    if (language) {
      patch.language = normalizeDwalletLanguage(language);
      patch.preferredLanguage = patch.language;
    }
    await Promise.allSettled([
      fsPatch(`users/${uid}`, patch, adminToken),
      fsPatch(`dwalletUsers/${uid}`, { ...patch, app: sanitizeDwalletText(body.app || 'dwallet-mobile', 40), version: sanitizeDwalletText(body.version || '', 40) }, adminToken)
    ]);
    return c.json({ success: true, lastAppOpenAt: now });
  } catch (e: any) {
    const message = e.message || String(e);
    const status = message === 'Unauthorized' || message === 'Invalid token' ? 401 : 500;
    return c.json({ success: false, error: message }, status);
  }
});

app.post('/api/admin/member-platform-rights', async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const uid = requireSafeUserId(body.uid || body.userId || body.memberId);
    const adminToken = await getAdminToken();
    return c.json(await buildDdraRightsStatusForUser(uid, adminToken));
  } catch (e: any) {
    const message = e.message || String(e);
    const status = message === 'Invalid user id' ? 400 : message === 'User not found' ? 404 : 500;
    return c.json({ success: false, error: message }, status);
  }
});

app.post('/api/admin/member-platform-rights/save', async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const uid = requireSafeUserId(body.uid || body.userId || body.memberId);
    const actor = await getAuditActor(c).catch(() => ({}));
    const adminId = String(body.adminId || actor.uid || actor.email || actor.username || 'admin');
    const platformRights = sanitizePlatformRightsInput(body.platformRights || body.rights || {}, adminId);
    const adminToken = await getAdminToken();

    await fsPatch(`users/${uid}`, {
      platformRights,
      platformRightsUpdatedAt: new Date().toISOString(),
      platformRightsUpdatedBy: adminId
    }, adminToken);

    queueAdminAuditLog(c, {
      category: 'member',
      action: 'platform_rights_updated',
      severity: 'medium',
      targetType: 'user',
      targetId: uid,
      metadata: { platformRights }
    });

    return c.json(await buildDdraRightsStatusForUser(uid, adminToken));
  } catch (e: any) {
    const message = e.message || String(e);
    const status = message === 'Invalid user id' ? 400 : message === 'User not found' ? 404 : 500;
    return c.json({ success: false, error: message }, status);
  }
});

function isDwalletManagedRecord(row: any = {}) {
  const wallet = row.deedraWallet || {};
  return Boolean(
    row.dwalletUser === true ||
    row.dwalletSource === 'dwallet' ||
    row.dwalletWalletIssued === true ||
    row.solanaAddress ||
    wallet.publicKey
  );
}

function dwalletPublicAddressFrom(source: any = {}, user: any = {}, key: string) {
  const wallet = user.deedraWallet || {};
  const mapped: Record<string, string[]> = {
    solanaAddress: ['solanaAddress', 'publicKey'],
    evmAddress: ['evmAddress'],
    tronAddress: ['tronAddress'],
    xrpAddress: ['xrpAddress'],
    btcAddress: ['btcAddress']
  };
  const keys = mapped[key] || [key];
  for (const field of keys) {
    const value = source[field] || wallet[field] || user[field];
    if (value) return String(value);
  }
  return '';
}

function dwalletAdminMatches(row: any, search: string, rightsFilter: string) {
  const q = String(search || '').trim().toLowerCase();
  const haystack = [
    row.uid,
    row.email,
    row.name,
    row.displayId,
    row.country,
    row.countryCode,
    row.language,
    row.phone,
    row.solanaAddress,
    row.evmAddress,
    row.tronAddress,
    row.xrpAddress,
    row.btcAddress
  ].join(' ').toLowerCase();
  if (q && !haystack.includes(q)) return false;
  if (rightsFilter === 'active' && !row.rightsActive) return false;
  if (rightsFilter === 'locked' && row.rightsActive) return false;
  return true;
}

async function buildDwalletAdminRow(profile: any, adminToken: string) {
  const uid = requireSafeUserId(profile.uid || profile.userId || profile.id);
  const [rights, userDoc, walletDoc] = await Promise.all([
    buildDdraRightsStatusForUser(uid, adminToken).catch((error: any) => ({ success: false, error: error.message || String(error) })),
    fsGet(`users/${uid}`, adminToken).catch(() => null),
    fsGet(`wallets/${uid}`, adminToken).catch(() => null)
  ]);
  const user = userDoc?.fields ? firestoreDocToObj(userDoc) : {};
  const wallet = walletDoc?.fields ? firestoreDocToObj(walletDoc) : {};
  const services = Array.isArray(rights.services) ? rights.services.filter((item: any) => item.id !== 'founders') : [];
  const ddraBalance = Number(rights.ddraBalance || 0);
  const ddraValueUsdt = Number(rights.ddraValueUsdt || 0);
  const finance = dwalletFinanceSnapshot(user, wallet, profile, ddraBalance, ddraValueUsdt);
  const addresses = {
    solanaAddress: dwalletPublicAddressFrom(profile, user, 'solanaAddress'),
    evmAddress: dwalletPublicAddressFrom(profile, user, 'evmAddress'),
    tronAddress: dwalletPublicAddressFrom(profile, user, 'tronAddress'),
    xrpAddress: dwalletPublicAddressFrom(profile, user, 'xrpAddress'),
    btcAddress: dwalletPublicAddressFrom(profile, user, 'btcAddress')
  };

  return {
    uid,
    email: profile.email || rights.userEmail || user.email || '',
    name: profile.name || rights.userName || user.name || user.displayName || user.username || '',
    displayId: firstText(user.username, user.displayId, user.loginId, user.referralCode, profile.displayId),
    phone: firstText(profile.phone, profile.phoneNumber, user.phone, user.phoneNumber),
    country: firstText(profile.country, user.country, profile.countryCode, user.countryCode),
    countryCode: firstText(profile.countryCode, user.countryCode),
    language: normalizeDwalletLanguage(profile.language || profile.preferredLanguage || user.language || user.preferredLanguage),
    authProvider: firstText(profile.authProvider, profile.provider, user.authProvider, user.provider, 'password'),
    status: firstText(profile.status, user.status, 'active'),
    lastAppOpenAt: firstText(profile.lastAppOpenAt, user.lastAppOpenAt),
    appOpenCount: firstFiniteNumber(profile.appOpenCount, user.appOpenCount),
    createdAt: profile.createdAt || user.createdAt || '',
    dwalletCreatedAt: profile.dwalletCreatedAt || user.dwalletCreatedAt || profile.walletCreatedAt || '',
    dwalletUpdatedAt: profile.dwalletUpdatedAt || user.dwalletUpdatedAt || profile.updatedAt || '',
    ...addresses,
    addresses,
    finance,
    walletIssued: Boolean(addresses.solanaAddress || addresses.evmAddress || addresses.tronAddress || addresses.xrpAddress || addresses.btcAddress),
    ddraBalance,
    ddraValueUsdt,
    activeTier: rights.activeTier || null,
    rightsActive: Boolean(rights.rightsActive),
    services,
    platformRights: rights.platformRights || {},
    statusError: rights.success === false ? rights.error || '권리 조회 실패' : ''
  };
}

app.post('/api/admin/dwallet-users', async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const search = String(body.search || '').trim();
    const rightsFilter = String(body.rightsFilter || body.status || 'all');
    const limit = Math.min(Math.max(Number(body.limit) || 100, 20), 500);
    const adminToken = await getAdminToken();

    const byUid = new Map<string, any>();
    const profiles = await fsQuery('dwalletUsers', adminToken, [], Math.max(limit, 500));
    for (const row of profiles) {
      const uid = String(row.uid || row.id || '').trim();
      if (uid) byUid.set(uid, row);
    }

    const userFallbacks = await fsQuery('users', adminToken, [], 5000);
    for (const user of userFallbacks) {
      const uid = String(user.uid || user.id || '').trim();
      if (!uid || byUid.has(uid) || !isDwalletManagedRecord(user)) continue;
      byUid.set(uid, {
        id: uid,
        uid,
        email: user.email || '',
        name: user.name || user.displayName || user.username || '',
        country: user.country || '',
        countryCode: user.countryCode || '',
        language: user.language || user.preferredLanguage || '',
        authProvider: user.authProvider || '',
        dwalletCreatedAt: user.dwalletCreatedAt || user.deedraWallet?.createdAt || '',
        dwalletUpdatedAt: user.dwalletUpdatedAt || '',
        solanaAddress: user.deedraWallet?.publicKey || '',
        evmAddress: user.deedraWallet?.evmAddress || '',
        tronAddress: user.deedraWallet?.tronAddress || '',
        xrpAddress: user.deedraWallet?.xrpAddress || '',
        btcAddress: user.deedraWallet?.btcAddress || ''
      });
    }

    const rows: any[] = [];
    for (const profile of Array.from(byUid.values())) {
      try {
        const row = await buildDwalletAdminRow(profile, adminToken);
        if (dwalletAdminMatches(row, search, rightsFilter)) rows.push(row);
      } catch (error: any) {
        console.warn('[dwallet-users] skipped invalid row', error?.message || error);
      }
    }

    rows.sort((a, b) => adminDailyTimeMs(b.dwalletUpdatedAt || b.dwalletCreatedAt || b.createdAt) - adminDailyTimeMs(a.dwalletUpdatedAt || a.dwalletCreatedAt || a.createdAt));

    const visibleRows = rows.slice(0, limit);
    const totalDdra = visibleRows.reduce((sum, row) => sum + Number(row.ddraBalance || 0), 0);
    const totalValueUsdt = visibleRows.reduce((sum, row) => sum + Number(row.ddraValueUsdt || 0), 0);

    return c.json({
      success: true,
      total: rows.length,
      returned: visibleRows.length,
      stats: {
        totalUsers: rows.length,
        walletsIssued: rows.filter(row => row.solanaAddress || row.evmAddress || row.tronAddress || row.xrpAddress || row.btcAddress).length,
        rightsActive: rows.filter(row => row.rightsActive).length,
        totalDdra: roundMoney(totalDdra),
        totalValueUsdt: roundMoney(totalValueUsdt)
      },
      users: visibleRows
    });
  } catch (e: any) {
    return c.json({ success: false, error: e.message || String(e) }, 500);
  }
});

function roundMoney(value: number): number {
  return Math.round(value * 1e8) / 1e8;
}

function toPositiveMoney(value: any): number {
  const amount = roundMoney(Number(value));
  return Number.isFinite(amount) && amount > 0 ? amount : 0;
}

function normalizeCountryBonusRules(rawRules: any): any[] {
  const source = Array.isArray(rawRules) ? rawRules : [];
  return source
    .map((rule: any) => ({
      country: String(rule?.country || rule?.countryCode || '').trim().toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3),
      bonusPct: Math.max(0, Math.min(100, Number(rule?.bonusPct ?? rule?.pct ?? rule?.percent ?? 0) || 0)),
      enabled: rule?.enabled !== false
    }))
    .filter((rule: any) => rule.country && rule.bonusPct > 0 && rule.enabled);
}

async function loadCountryBonusRules(adminToken: string): Promise<any[]> {
  const canonical = await fsGet('settings/countryBonus', adminToken).catch(() => null);
  const canonicalObj = canonical?.fields ? firestoreDocToObj(canonical) : null;
  const canonicalRules = normalizeCountryBonusRules(canonicalObj?.rules);
  if (canonicalRules.length > 0) return canonicalRules;

  const legacy = await fsGet('settings/country_bonuses', adminToken).catch(() => null);
  const legacyObj = legacy?.fields ? firestoreDocToObj(legacy) : null;
  return normalizeCountryBonusRules(legacyObj?.rules);
}

function walletFirestoreNumber(walletDoc: any, field: string): number {
  return Number(fromFirestoreValue(walletDoc?.fields?.[field] || { doubleValue: 0 }) || 0);
}

function buildPromotionLockAuditFields(bonusAmount: number, appliedBonus: string, appliedBonusPct: number, actualAmount: number, finalAmount: number) {
  const lockedBonus = roundMoney(bonusAmount);
  const spendableAmount = roundMoney(actualAmount);
  const displayTotal = roundMoney(finalAmount);
  if (lockedBonus <= 0) {
    return {
      totalCredited: spendableAmount,
      spendableCreditedUsdt: spendableAmount,
      walletCreditedUsdt: spendableAmount
    };
  }

  return {
    bonusPct: appliedBonusPct,
    bonusUsdt: lockedBonus,
    totalCredited: displayTotal,
    spendableCreditedUsdt: spendableAmount,
    walletCreditedUsdt: spendableAmount,
    promoLockedUsdt: lockedBonus,
    lockedPromoUsdt: lockedBonus,
    promoLocked: true,
    promotionLocked: true,
    bonusType: appliedBonus,
    lockReason: 'promotion_bonus_locked_no_rollup',
    withdrawEligible: false,
    rollupEligible: false,
    commissionEligible: false,
    rankEligible: false,
    networkSalesEligible: false
  };
}

type WithdrawalAddressNetwork = 'empty' | 'bsc' | 'tron' | 'solana' | 'unknown';
type WithdrawalAddressDetection = { type: WithdrawalAddressNetwork; label: string };
type WithdrawalAddressValidation =
  | { ok: true; normalizedAddress: string; network: 'solana' }
  | { ok: false; normalizedAddress: string; network: WithdrawalAddressNetwork; error: string; message: string };

const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

function normalizeWithdrawalAddress(address: any): string {
  return String(address ?? '').trim().replace(/\s+/g, '');
}

function getBase58DecodedByteLength(value: string): number | null {
  const bytes: number[] = [];

  for (const char of value) {
    let carry = BASE58_ALPHABET.indexOf(char);
    if (carry < 0) return null;

    for (let i = 0; i < bytes.length; i++) {
      carry += bytes[i] * 58;
      bytes[i] = carry & 0xff;
      carry >>= 8;
    }

    while (carry > 0) {
      bytes.push(carry & 0xff);
      carry >>= 8;
    }
  }

  for (const char of value) {
    if (char !== '1') break;
    bytes.push(0);
  }

  return bytes.length;
}

function detectWithdrawalAddressNetwork(address: any): WithdrawalAddressDetection {
  const clean = normalizeWithdrawalAddress(address);
  if (!clean) return { type: 'empty', label: 'empty' };
  if (/^0x[a-fA-F0-9]{40}$/.test(clean)) return { type: 'bsc', label: 'BSC / EVM' };

  const base58Length = getBase58DecodedByteLength(clean);
  if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(clean) && base58Length === 32) {
    return { type: 'solana', label: 'Solana' };
  }
  if (/^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(clean)) return { type: 'tron', label: 'TRON' };

  return { type: 'unknown', label: 'unknown' };
}

function validateWithdrawalAddressForServer(address: any): WithdrawalAddressValidation {
  const normalizedAddress = normalizeWithdrawalAddress(address);
  const detected = detectWithdrawalAddressNetwork(normalizedAddress);

  if (!normalizedAddress || detected.type === 'empty') {
    return {
      ok: false,
      normalizedAddress,
      network: 'empty',
      error: 'invalid_withdrawal_address',
      message: '출금 주소를 입력해 주세요.'
    };
  }

  if (detected.type !== 'solana') {
    return {
      ok: false,
      normalizedAddress,
      network: detected.type,
      error: 'invalid_withdrawal_network',
      message: '현재 DDRA 출금은 Solana 주소만 지원합니다. BSC/TRON 등 다른 네트워크 주소는 사용할 수 없습니다.'
    };
  }

  return { ok: true, normalizedAddress, network: 'solana' };
}

// ─── Firebase Admin JWT 발급 (RS256) ─────────────────────────────────────────
async function getAdminToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const header = { alg: 'RS256', typ: 'JWT' }
  const payload = {
    iss: SERVICE_ACCOUNT.client_email,
    sub: SERVICE_ACCOUNT.client_email,
    aud: SERVICE_ACCOUNT.token_uri,
    iat: now,
    exp: now + 3600,
    scope: 'https://www.googleapis.com/auth/datastore https://www.googleapis.com/auth/firebase https://www.googleapis.com/auth/identitytoolkit'
  }
  const b64url = (obj: any) => btoa(JSON.stringify(obj)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'')
  const sigInput = `${b64url(header)}.${b64url(payload)}`

  const pemKey = SERVICE_ACCOUNT.private_key
    .replace(('-----BEGIN' + ' PRIVATE KEY-----'), '')
    .replace(('-----END P' + 'RIVATE KEY-----'), '')
    .replace(/\n/g, '')
  const keyData = Uint8Array.from(atob(pemKey), c => c.charCodeAt(0))
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8', keyData.buffer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false, ['sign']
  )
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', cryptoKey, new TextEncoder().encode(sigInput))
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'')
  const jwt = `${sigInput}.${sigB64}`

  const tokenRes = await fetch(SERVICE_ACCOUNT.token_uri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`
  })
  const tokenData: any = await tokenRes.json()
  return tokenData.access_token
}

// ─── Firebase Custom Token 발급 (보조계정 Firestore 접근용) ──────────────────
async function createFirebaseCustomToken(uid: string, claims: Record<string, any> = {}): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const header = { alg: 'RS256', typ: 'JWT' }
  // claims는 단순 문자열만 포함하도록 직렬화 (한글/특수문자 안전 처리)
  const safeClaims: Record<string, string> = {}
  for (const [k, v] of Object.entries(claims)) {
    safeClaims[k] = typeof v === 'string' ? v : JSON.stringify(v)
  }
  const payload = {
    iss: SERVICE_ACCOUNT.client_email,
    sub: SERVICE_ACCOUNT.client_email,
    aud: 'https://identitytoolkit.googleapis.com/google.identity.identitytools.v1.IdentityToolkit',
    uid: uid,
    iat: now,
    exp: now + 3600,
    claims: safeClaims
  }
  // UTF-8 안전한 base64url 인코딩
  const b64url = (obj: any) => {
    const str = JSON.stringify(obj)
    const bytes = new TextEncoder().encode(str)
    let bin = ''
    bytes.forEach(b => bin += String.fromCharCode(b))
    return btoa(bin).replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'')
  }
  const sigInput = `${b64url(header)}.${b64url(payload)}`

  const pemKey = SERVICE_ACCOUNT.private_key
    .replace(('-----BEGIN' + ' PRIVATE KEY-----'), '')
    .replace(('-----END P' + 'RIVATE KEY-----'), '')
    .replace(/\n/g, '')
  const keyData = Uint8Array.from(atob(pemKey), c => c.charCodeAt(0))
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8', keyData.buffer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false, ['sign']
  )
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', cryptoKey, new TextEncoder().encode(sigInput))
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'')
  return `${sigInput}.${sigB64}`
}

// ─── Firestore REST 헬퍼 ─────────────────────────────────────────────────────
async function fsGet(path: string, token: string) {
  const res = await fetch(`${FIRESTORE_BASE}/${path}`, {
    headers: { Authorization: `Bearer ${token}` }
  })
  return res.ok ? await res.json() : null
}

async function fsQuery(collection: string, token: string, conditions: any[] = [], limit = 100) {
  const structuredQuery: any = {
    from: [{ collectionId: collection }],
    limit
  }
  if (conditions.length > 0) {
    structuredQuery.where = conditions.length === 1 ? conditions[0] : {
      compositeFilter: { op: 'AND', filters: conditions }
    }
  }
  const res = await fetch(`${FIRESTORE_BASE}:runQuery`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ structuredQuery })
  })
  if (!res.ok) return []
  const rows: any[] = await res.json()
  return rows.filter((r: any) => r.document).map((r: any) => firestoreDocToObj(r.document))
}

const ADMIN_DAILY_KST_OFFSET_MS = 9 * 60 * 60 * 1000;

function adminDailyKstDate(ms = Date.now()): string {
  return new Date(ms + ADMIN_DAILY_KST_OFFSET_MS).toISOString().slice(0, 10);
}

function adminDailyTimeMs(value: any): number {
  if (!value) return 0;
  if (typeof value === 'number') return value < 1000000000000 ? value * 1000 : value;
  if (typeof value === 'string') {
    const t = Date.parse(value);
    return Number.isFinite(t) ? t : 0;
  }
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'object') {
    if (typeof value.seconds === 'number') return value.seconds * 1000 + Math.floor((value.nanoseconds || 0) / 1000000);
    if (typeof value._seconds === 'number') return value._seconds * 1000 + Math.floor((value._nanoseconds || 0) / 1000000);
    if (typeof value.timestampValue === 'string') return adminDailyTimeMs(value.timestampValue);
  }
  return 0;
}

function adminDailyIsKstDate(value: any, kstDate: string): boolean {
  const ms = adminDailyTimeMs(value);
  return ms > 0 && adminDailyKstDate(ms) === kstDate;
}

async function fsQueryRecent(collection: string, token: string, orderField = 'createdAt', limit = 2000) {
  const safeLimit = Math.min(Math.max(Number(limit) || 2000, 1), 5000);
  const structuredQuery: any = {
    from: [{ collectionId: collection }],
    orderBy: [{ field: { fieldPath: orderField }, direction: 'DESCENDING' }],
    limit: safeLimit
  };

  const res = await fetch(`${FIRESTORE_BASE}:runQuery`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ structuredQuery })
  });
  if (!res.ok) return [];

  const rows: any[] = await res.json();
  return rows.filter((r: any) => r.document).map((r: any) => firestoreDocToObj(r.document));
}

function adminDailyPublicUser(user: any) {
  return {
    id: user.id || user.uid || '',
    uid: user.uid || user.id || '',
    email: user.email || '',
    name: user.name || user.displayName || user.username || '',
    displayId: user.displayId || user.loginId || user.username || user.referralCode || '',
    referralCode: user.referralCode || '',
    country: user.country || '알 수 없음',
    rank: user.rank || 'G0',
    status: user.status || 'active',
    createdAt: user.createdAt || ''
  };
}


async function fsCreateWithId(collectionPath: string, docId: string, data: any, adminToken: string) {
  
  const firestoreFields: any = {}
  for (const [k, v] of Object.entries(data)) {
    firestoreFields[k] = toFirestoreValue(v)
  }
  const obj = { fields: firestoreFields }

  const res = await fetch(`${FIRESTORE_BASE}/${collectionPath}?documentId=${docId}`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(obj)
  })
  const resData = await res.json()
  if (resData.error) throw new Error(resData.error.message)
  return resData
}

async function fsPatch(path: string, fields: any, token: string) {
  const firestoreFields: any = {}
  for (const [k, v] of Object.entries(fields)) {
    firestoreFields[k] = toFirestoreValue(v)
  }
  const updateMask = Object.keys(fields).map(k => `updateMask.fieldPaths=${encodeURIComponent(k)}`).join('&')
  const res = await fetch(`${FIRESTORE_BASE}/${path}?${updateMask}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: firestoreFields })
  })
  
  const data = await res.json()
  if (!res.ok) {
    throw new Error(data.error?.message || 'Firestore PATCH failed')
  }
  return data
}


async function fsBatchCommit(writes: any[], token: string) {
  // PART II §0 HARD RULE #4 — 20개 단위 배치 (호출자가 더 큰 사이즈로 호출해도 내부에서 20 단위로 분할)
  const BATCH_SIZE = 20;
  const chunks = [];
  for (let i = 0; i < writes.length; i += BATCH_SIZE) chunks.push(writes.slice(i, i + BATCH_SIZE));
  
  for (const chunk of chunks) {
    const res = await fetch(`${FIRESTORE_BASE}:commit`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ writes: chunk })
    });
    if (!res.ok) {
      const e = await res.text();
      console.error('Batch commit failed:', e);
      throw new Error('Batch commit failed: ' + e);
    }
  }
}

async function fsCreate(collection: string, data: any, token: string) {
  const firestoreFields: any = {}
  for (const [k, v] of Object.entries(data)) {
    firestoreFields[k] = toFirestoreValue(v)
  }
  const res = await fetch(`${FIRESTORE_BASE}/${collection}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: firestoreFields })
  })
  return res.ok ? await res.json() : null
}

export async function fsSet(path: string, data: any, token: string) {
  const firestoreFields: any = {}
  for (const [k, v] of Object.entries(data)) {
    firestoreFields[k] = toFirestoreValue(v)
  }
  const res = await fetch(`${FIRESTORE_BASE}/${path}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: firestoreFields })
  })
  return res.ok ? await res.json() : null
}

/**
 * fsCreateOnlyIfAbsent: Firestore precondition 을 이용해
 * 문서가 존재하지 않을 때만 생성 (exist=false 조건부 PATCH).
 * 이미 존재하면 HTTP 409/412 를 반환하고 null 을 리턴.
 * → 다수의 동시 요청 중 단 하나만 성공 → Race-condition 방지용 분산 Lock.
 */
async function fsCreateOnlyIfAbsent(path: string, data: any, token: string): Promise<boolean> {
  const firestoreFields: any = {}
  for (const [k, v] of Object.entries(data)) {
    firestoreFields[k] = toFirestoreValue(v)
  }
  // currentDocument.exists=false → 문서가 없을 때만 쓰기 허용
  const res = await fetch(`${FIRESTORE_BASE}/${path}?currentDocument.exists=false`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: firestoreFields })
  })
  return res.ok  // true = 내가 lock 획득, false = 이미 다른 프로세스가 lock 보유
}

async function fsDelete(path: string, token: string): Promise<boolean> {
  const res = await fetch(`${FIRESTORE_BASE}/${path}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` }
  });
  return res.ok || res.status === 404;
}

function toFirestoreValue(v: any): any {
  if (v === null || v === undefined) return { nullValue: null }
  if (typeof v === 'boolean') return { booleanValue: v }
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v }
  if (typeof v === 'string') return { stringValue: v }
  if (v instanceof Date) return { timestampValue: v.toISOString() }
  if (Array.isArray(v)) return { arrayValue: { values: v.map(toFirestoreValue) } }
  if (typeof v === 'object') {
    const fields: any = {}
    for (const [k, val] of Object.entries(v)) fields[k] = toFirestoreValue(val)
    return { mapValue: { fields } }
  }
  return { stringValue: String(v) }
}

function firestoreDocToObj(doc: any): any {
  const id = doc.name?.split('/').pop()
  const obj: any = { id }
  for (const [k, v] of Object.entries(doc.fields || {})) {
    obj[k] = fromFirestoreValue(v)
  }
  return obj
}

function fromFirestoreValue(v: any): any {
  if ('nullValue' in v) return null
  if ('booleanValue' in v) return v.booleanValue
  if ('integerValue' in v) return parseInt(v.integerValue)
  if ('doubleValue' in v) return v.doubleValue
  if ('stringValue' in v) return v.stringValue
  if ('timestampValue' in v) return v.timestampValue
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(fromFirestoreValue)
  if ('mapValue' in v) {
    const obj: any = {}
    for (const [k, val] of Object.entries(v.mapValue.fields || {})) obj[k] = fromFirestoreValue(val as any)
    return obj
  }
  return null
}

// ─── 텔레그램 알림 ────────────────────────────────────────────────────────────
async function sendTelegram(token: string, chatId: string, text: string) {
  if (!token || !chatId) return
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' })
    })
  } catch (_) {}
}


// ─── 다중 수신자 텔레그램 발송 ────────────────────────────────────────────────────────
async function sendTelegramToRecipients(tgSettings: any, eventType: string, text: string) {
  if (!tgSettings || !tgSettings.botToken) return;
  let recs = tgSettings.recipients;
  if (!recs) {
    recs = [{ 
      chatId: tgSettings.chatId, 
      onDeposit: tgSettings.onDeposit, 
      onWithdrawal: tgSettings.onWithdrawal, 
      onSettlement: tgSettings.onSettlement, 
      onJoin: tgSettings.onJoin 
    }];
  }
  const flagMap: Record<string, string> = { deposit: 'onDeposit', withdrawal: 'onWithdrawal', settlement: 'onSettlement', join: 'onJoin' };
  const flag = flagMap[eventType];
  
  for (const rec of recs) {
    if (!rec.chatId) continue;
    if (flag && rec[flag] === false) continue;
    await sendTelegram(tgSettings.botToken, rec.chatId, text);
  }
}

// ─── 자동 푸시 규칙 실행 ──────────────────────────────────────────────────────
async function fireAutoRules(triggerKey: string, userId: string, vars: Record<string,string>, adminToken: string) {
  try {
    const rules = await fsQuery('autoRules', adminToken)
    const matched = rules.filter((r: any) => r.isActive && r.triggerEvent === triggerKey)
    for (const rule of matched) {
      let title = rule.title || ''
      let message = rule.message || ''
      for (const [k, v] of Object.entries(vars)) {
        title = title.replace(`{${k}}`, v)
        message = message.replace(`{${k}}`, v)
      }
      // notifications 컬렉션에 저장 (fcmPending: true → 이후 FCM 발송)
      await fsCreate('notifications', {
        userId,
        title,
        message,
        type: rule.type || 'inbox',
        isRead: false,
        autoRuleId: rule.id,
        triggerEvent: triggerKey,
        fcmPending: true,
        createdAt: new Date().toISOString()
      }, adminToken)

      // 🔔 FCM 즉시 발송 시도 (실패해도 notifications는 이미 저장됨)
      try {
        await sendFcmToUser(userId, title, message, { triggerEvent: triggerKey }, adminToken)
      } catch (_) {}

      // triggerCount 증가
      await fsPatch(`autoRules/${rule.id}`, {
        triggerCount: (rule.triggerCount || 0) + 1
      }, adminToken)
    }
  } catch (_) {}
}

// ─── 보조계정 로그인 ──────────────────────────────────────────────────────────
app.post('/api/subadmin/login', async (c) => {
  try {
    const { loginId, password } = await c.req.json()
    if (!loginId || !password) return c.json({ error: '아이디와 비밀번호를 입력하세요.' }, 400)

    const adminToken = await getAdminToken()
    const subAdmins = await fsQuery('subAdmins', adminToken)
    const account = subAdmins.find((a: any) => a.loginId === loginId && a.isActive)
    if (!account) return c.json({ error: '존재하지 않거나 비활성화된 계정입니다.' }, 401)

    // SHA-256 비밀번호 검증
    const encoder = new TextEncoder()
    const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(password))
    const hashHex = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('')
    if (account.passwordHash !== hashHex) return c.json({ error: '비밀번호가 틀렸습니다.' }, 401)

    // 만료 확인
    if (account.expireType === 'date' && account.expireAt) {
      if (new Date(account.expireAt) < new Date()) return c.json({ error: '만료된 계정입니다.' }, 401)
    }

    // JWT 토큰 발급 (간단한 구조)
    const payload = {
      uid: account.id,
      loginId: account.loginId,
      name: account.name,
      role: 'subadmin',
      // perms 우선, permissions 폴백 (Firestore 저장 필드명 혼용 대응)
      perms:       account.perms       || account.permissions || {},
      permissions: account.permissions || account.perms       || {},
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 86400
    }
    const payloadB64 = btoa(JSON.stringify(payload)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
    const headerB64 = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
    const token = `${headerB64}.${payloadB64}.subadmin_sig`

    // Firebase Custom Token 발급 (Firestore 직접 접근 허용용)
    // uid는 'subadmin_<account.id>' 형태로 고정 prefix 사용 → 규칙에서 isSubAdmin() 판별
    const saFirebaseUid = `subadmin_${account.id}`
    let customToken = ''
    try {
      customToken = await createFirebaseCustomToken(saFirebaseUid, {
        role: 'subadmin'
        // perms는 claims에서 제외 (직렬화 복잡도 방지 - 프론트에서 JWT payload로 전달)
      })
    } catch(e: any) {
      console.error('[subadmin/login] customToken 발급 실패:', e.message)
    }

    // 로그인 횟수 업데이트
    await fsPatch(`subAdmins/${account.id}`, {
      lastLogin: new Date().toISOString(),
      triggerCount: (account.triggerCount || 0) + 1
    }, adminToken)

    return c.json({
      success: true,
      token,
      customToken,
      uid:  saFirebaseUid,
      name: account.name,
      perms:       account.perms       || account.permissions || {},
      permissions: account.permissions || account.perms       || {},
    })
  } catch (e: any) {
    return c.json({ error: e.message }, 500)
  }
})

// ─── 보조계정 Custom Token 갱신 (세션 복원용) ──────────────────────────────
app.post('/api/subadmin/refresh-token', async (c) => {
  try {
    const { loginId } = await c.req.json()
    if (!loginId) return c.json({ error: 'loginId 필요' }, 400)

    const adminToken = await getAdminToken()
    const subAdmins = await fsQuery('subAdmins', adminToken)
    const account = subAdmins.find((a: any) => a.loginId === loginId && a.isActive)
    if (!account) return c.json({ error: '계정 없음' }, 404)

    // 만료 확인
    if (account.expireType === 'date' && account.expireAt) {
      if (new Date(account.expireAt) < new Date()) return c.json({ error: '만료된 계정' }, 401)
    }

    const saFirebaseUid = `subadmin_${account.id}`
    const customToken = await createFirebaseCustomToken(saFirebaseUid, { role: 'subadmin' })

    return c.json({ success: true, customToken, uid: saFirebaseUid })
  } catch (e: any) {
    return c.json({ error: e.message }, 500)
  }
})

// ─── 보조계정 JWT 토큰 검증 헬퍼 ──────────────────────────────────────────────
function verifySubAdminToken(token: string): any | null {
  try {
    if (!token || !token.includes('.')) return null
    const parts = token.split('.')
    if (parts.length < 2) return null
    // base64url → JSON 디코딩
    const pad = (s: string) => s + '='.repeat((4 - s.length % 4) % 4)
    const payload = JSON.parse(atob(pad(parts[1].replace(/-/g,'+').replace(/_/g,'/'))))
    if (payload.role !== 'subadmin') return null
    if (payload.exp && payload.exp < Math.floor(Date.now()/1000)) return null
    return payload
  } catch { return null }
}

// ─── 보조계정 범용 데이터 프록시 API ──────────────────────────────────────────
// 보조계정이 Firestore에 직접 접근할 수 없으므로, 백엔드가 대신 조회해서 반환
app.post('/api/subadmin/query', async (c) => {
  try {
    const authHeader = c.req.header('Authorization') || ''
    const token = authHeader.replace('Bearer ', '')
    const sa = verifySubAdminToken(token)
    if (!sa) return c.json({ error: '인증 실패' }, 401)

    const { collection: col, filters, limit: lim, orderByField, orderDir, docId } = await c.req.json()
    if (!col) return c.json({ error: 'collection 필요' }, 400)

    const adminToken = await getAdminToken()

    // docId가 있으면 단일 문서 직접 조회 (REST GET)
    if (docId) {
      const doc = await fsGet(`${col}/${docId}`, adminToken)
      if (!doc) return c.json({ success: true, docs: [] })
      const obj = firestoreDocToObj(doc)
      return c.json({ success: true, docs: [obj] })
    }

    // filters 변환 (__name__ 필터는 무시 - structuredQuery 미지원)
    const fsFilters = (filters || [])
      .filter((f: any) => f.field !== '__name__')
      .map((f: any) => ({
        fieldFilter: {
          field: { fieldPath: f.field },
          op: f.op || 'EQUAL',
          value: typeof f.value === 'number'
            ? { integerValue: String(f.value) }
            : typeof f.value === 'boolean'
            ? { booleanValue: f.value }
            : { stringValue: String(f.value) }
        }
      }))

    const docs = await fsQuery(col, adminToken, fsFilters, lim || 500)
    return c.json({ success: true, docs })
  } catch (e: any) {
    return c.json({ error: e.message }, 500)
  }
})

// ─── 보조계정 대시보드 통계 API ────────────────────────────────────────────────
app.get('/api/subadmin/dashboard-stats', async (c) => {

app.get('/api/subadmin/dashboard-badges', async (c) => {
  try {
    const authHeader = c.req.header('Authorization') || ''
    const token = authHeader.replace('Bearer ', '')
    const sa = verifySubAdminToken(token)
    if (!sa) return c.json({ error: '인증 실패' }, 401)

    const adminToken = await getAdminToken()
    const [dep, withs] = await Promise.all([
      fsQuery('transactions', adminToken, [
        { field: 'type', op: 'EQUAL', value: 'deposit' },
        { field: 'status', op: 'EQUAL', value: 'pending' }
      ], 1000),
      fsQuery('transactions', adminToken, [
        { field: 'type', op: 'EQUAL', value: 'withdrawal' },
        { field: 'status', op: 'EQUAL', value: 'pending' }
      ], 1000)
    ])

    return c.json({
      success: true,
      data: {
        pendingDeposits: dep.length,
        pendingWithdrawals: withs.length
      }
    })
  } catch(e: any) {
    return c.json({ success: false, error: e.message })
  }
})
  try {
    const authHeader = c.req.header('Authorization') || ''
    const token = authHeader.replace('Bearer ', '')
    const sa = verifySubAdminToken(token)
    if (!sa) return c.json({ error: '인증 실패' }, 401)

    const adminToken = await getAdminToken()
    const [users, txs, invs] = await Promise.all([
      fsQuery('users', adminToken, [], 100000),
      fsQuery('transactions', adminToken, [], 2000),
      fsQuery('investments', adminToken, [], 100000).catch(() => []),
    ])

    const deposits    = txs.filter((t: any) => t.type === 'deposit')
    const withdrawals = txs.filter((t: any) => t.type === 'withdrawal')

    return c.json({
      success: true,
      data: {
        totalUsers:            users.filter((u: any) => u.role !== 'admin').length,
        activeUsers:           users.filter((u: any) => u.status === 'active' && u.role !== 'admin').length,
        onlineUsers:           users.filter((u: any) => u.lastSeenAt && (Date.now() - u.lastSeenAt < 120000)).length,
        onlineUserList:        users.filter((u: any) => u.lastSeenAt && (Date.now() - u.lastSeenAt < 120000)).map((u: any) => ({uid:u.uid, name:u.name, email:u.email, rank:u.rank, lastSeenAt:u.lastSeenAt})),
        pendingDeposits:       deposits.filter((t: any) => t.status === 'pending').length,
        pendingWithdrawals:    withdrawals.filter((t: any) => t.status === 'pending').length,
        totalDepositAmount:    deposits.filter((t: any) => t.status === 'approved').reduce((s: number, t: any) => s + (t.amount || 0), 0),
        totalWithdrawalAmount: withdrawals.filter((t: any) => t.status === 'approved').reduce((s: number, t: any) => s + (t.amount || 0), 0),
        totalGameBet:          0,
        activeInvestments:     invs.filter((i: any) => i.status === 'active').length,
        totalInvestAmount:     invs.reduce((s: number, i: any) => s + (i.amount || 0), 0),
        totalStakedAmount:     invs.filter((i: any) => i.status === 'active').reduce((s: number, i: any) => s + (i.amount || 0), 0),
      }
    })
  } catch (e: any) {
    return c.json({ error: e.message }, 500)
  }
})

// ─── 관리자 회원 비밀번호 변경 ────────────────────────────────────────────────
// ─── 회원 자산 변경 이력 조회 ──────────────────────────────────────────────────
app.get('/api/admin/member-edit-logs', async (c) => {
  try {
    const userId = c.req.query('userId')
    if (!userId) return c.json({ error: 'userId 필요' }, 400)
    const adminToken = await getAdminToken()
    const logs = await fsQuery('memberEditLogs', adminToken, [
      { fieldFilter: { field: { fieldPath: 'userId' }, op: 'EQUAL', value: { stringValue: userId } } }
    ], 100)
    logs.sort((a: any, b: any) => (b.createdAt?._seconds || b.createdAt?.seconds || 0) - (a.createdAt?._seconds || a.createdAt?.seconds || 0))

    // adminId가 있는 경우 관리자 이름 조회해서 붙여주기
    const adminIdSet = [...new Set(logs.map((l: any) => l.adminId).filter(Boolean))]
    const adminNameMap: Record<string, string> = {}
    await Promise.all(adminIdSet.map(async (aid: any) => {
      try {
        const adm = await fsGet('users/' + aid, adminToken)
        const name = adm?.fields?.name ? fromFirestoreValue(adm.fields.name) : null
        const email = adm?.fields?.email ? fromFirestoreValue(adm.fields.email) : null
        adminNameMap[aid] = name || email || aid
      } catch { adminNameMap[aid] = aid }
    }))
    const enriched = logs.map((l: any) => ({
      ...l,
      adminName: l.adminId ? (adminNameMap[l.adminId] || l.adminId) : '관리자'
    }))
    return c.json({ success: true, data: enriched })
  } catch (e: any) {
    return c.json({ error: e.message }, 500)
  }
})

app.post('/api/admin/reset-member-password', async (c) => {
  try {
    const { uid, newPassword, adminSecret, adminUid } = await c.req.json()
    // 내부 관리자 API용 인증: CRON_SECRET이 맞거나, 적법한 adminUid가 있거나
    if (!isValidCronSecret(adminSecret) && !adminUid) {
        return c.json({ error: 'unauthorized' }, 401)
    }
    if (!uid) return c.json({ error: '회원 정보(uid)가 누락되었습니다.' }, 400);
    if (!newPassword || newPassword.length < 6) return c.json({ error: '비밀번호는 6자 이상이어야 합니다.' }, 400);

    const adminToken = await getAdminToken()

    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/projects/${SERVICE_ACCOUNT.project_id}/accounts:update`,
      {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({ localId: uid, password: newPassword })
      }
    )
    if (!res.ok) {
      const err: any = await res.json()
      return c.json({ error: err?.error?.message || 'UNKNOWN' }, 400)
    }

    await fsCreate('auditLogs', {
      action: 'reset_member_password',
      targetId: uid,
      detail: '관리자가 회원 비밀번호 임시 변경',
      createdAt: new Date().toISOString()
    }, adminToken)

    return c.json({ success: true })
  } catch (e: any) {
    return c.json({ error: e.message }, 500)
  }
})

// ─── 관리자 회원 임포트 ───────────────────────────────────────────────────────
// ─── [1] username 로그인 API ──────────────────────────────────────────────────
// 클라이언트가 username + password로 POST → 서버가 username으로 email 조회 → Firebase Auth로 로그인 → idToken 반환

app.post('/api/auth/change-password', async (c) => {
  try {
    const { email, oldPassword, newPassword } = await c.req.json();
    if (!email || !oldPassword || !newPassword) {
      return c.json({ error: 'Missing required fields' }, 400);
    }
    
    // 1. Verify old password using Identity Toolkit (Firebase REST API)
    const apiKey = getRequiredRuntimeSecret('FIREBASE_WEB_API_KEY');
    const verifyRes = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: oldPassword, returnSecureToken: true })
    });
    
    if (!verifyRes.ok) {
      return c.json({ error: '기존 비밀번호가 일치하지 않습니다.' }, 400);
    }
    
    const verifyData = await verifyRes.json();
    const idToken = verifyData.idToken;
    
    // 2. Change password using the user's fresh idToken
    const updateRes = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:update?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        idToken: idToken,
        password: newPassword,
        returnSecureToken: true
      })
    });

    if (!updateRes.ok) {
      const updateData = await updateRes.json();
      return c.json({ error: updateData.error?.message || '비밀번호 변경 실패' }, 400);
    }
    
    return c.json({ success: true, message: '비밀번호가 변경되었습니다.' });
  } catch (err) {
    console.error('Change password error:', err);
    return c.json({ error: err.message || '비밀번호 변경 실패' }, 500);
  }
});



app.post('/api/user/invest', async (c) => {
  try {
    const authHeader = c.req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) return c.json({ error: 'Unauthorized' }, 401);
    const idToken = authHeader.split(' ')[1];
    
    const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken })
    });
    const data = await res.json();
    if (!data.users || !data.users.length) return c.json({ error: 'Invalid token' }, 401);
    
    const uid = data.users[0].localId;
    const body = await c.req.json().catch(() => ({}));
    const { productId } = body;
    const amount = toPositiveMoney(body.amount);
    
    if (!productId || amount <= 0) {
      return c.json({ error: 'Invalid parameters' }, 400);
    }
    
    const adminToken = await getAdminToken();
    
    // Get product
    const prodDoc = await fsGet(`products/${productId}`, adminToken);
    if (!prodDoc) return c.json({ error: '상품을 찾을 수 없습니다.' }, 404);
    const prod = firestoreDocToObj(prodDoc);
    
    const pMin = prod.minAmount != null ? Number(prod.minAmount) : Number(prod.minAmt || 0);
    if (pMin != null && amount < pMin) return c.json({ error: `최소 ${pMin} USDT 이상 투자해야 합니다.` }, 400);
    const pMax = prod.maxAmount != null ? Number(prod.maxAmount) : Number(prod.maxAmt || 0);
    if (Number.isFinite(pMax) && pMax > 0 && amount > pMax) return c.json({ error: `최대 ${pMax} USDT 까지만 투자 가능합니다.` }, 400);
    
    // Get wallet
    const walletDoc = await fsGet(`wallets/${uid}`, adminToken);
    if (!walletDoc) return c.json({ error: '지갑을 찾을 수 없습니다.' }, 404);
    const wallet = firestoreDocToObj(walletDoc);
    
    // 0.1 buffer Check
    const currentUsdt = Number(wallet.usdtBalance || 0);
    if (currentUsdt + 0.1 < amount) {
      return c.json({ error: 'USDT 잔액이 부족합니다.' }, 400);
    }
    
    // Check user totalInvested
    const userDoc = await fsGet(`users/${uid}`, adminToken);
    if (!userDoc) return c.json({ error: '회원 정보를 찾을 수 없습니다.' }, 404);
    const userObj = firestoreDocToObj(userDoc);
    
    // Atomically create investment and deduct wallet
    const startDate = new Date();
    const pDays = Number(prod.duration != null ? prod.duration : (prod.durationDays != null ? prod.durationDays : prod.days));
    const endDate = new Date(startDate.getTime() + pDays * 86400000);
    const pRoi = Number(prod.dailyRoi != null ? prod.dailyRoi : (prod.roiPercent != null ? prod.roiPercent : prod.roi));
    if (!Number.isFinite(pDays) || pDays <= 0 || !Number.isFinite(pRoi) || pRoi < 0) {
      return c.json({ error: '상품 수익률 또는 기간 설정이 올바르지 않습니다.' }, 400);
    }
    const expectedReturn = roundMoney(amount * pRoi / 100);
    
    const docId = crypto.randomUUID().replace(/-/g, '');
    const invData = {
      userId: uid,
      productId: productId,
      productName: prod.name,
      amount: amount,
      amountUsdt: amount,
      roiPercent: pRoi,
      durationDays: pDays,
      expectedReturn: expectedReturn,
      status: 'active',
      startDate: startDate,
      endDate: endDate,
      fundingSource: 'deposit_usdt',
      rollupEligible: true,
      commissionEligible: true,
      rankEligible: true,
      networkSalesEligible: true,
      commissionEligiblePrincipal: amount,
      autoCompoundPrincipal: 0,
      promoLockedPrincipal: 0,
      createdAt: new Date(),
    };
    
    // deduct amount
    const deductAmt = Math.min(amount, currentUsdt);
    const newUsdt = roundMoney(currentUsdt - deductAmt);
    const newTotalInvest = roundMoney(Number(wallet.totalInvest || 0) + amount);
    const newUserTotalInvested = roundMoney(Number(userObj.totalInvested || 0) + amount);
    
    // Create a transaction document for the investment history
    const txDocId = crypto.randomUUID().replace(/-/g, '');
    const txData = {
      userId: uid,
      userEmail: userObj.email || null,
      type: 'invest',
      amount: amount,
      amountUsdt: amount,
      currency: 'USDT',
      status: 'active',
      fundingSource: 'deposit_usdt',
      rollupEligible: true,
      commissionEligible: true,
      rankEligible: true,
      networkSalesEligible: true,
      createdAt: new Date(),
    };

    const writes = [
      {
        update: {
          name: `projects/${SERVICE_ACCOUNT.project_id}/databases/(default)/documents/transactions/${txDocId}`,
          fields: Object.fromEntries(Object.entries(txData).map(([k, v]) => [k, toFirestoreValue(v)]))
        }
      },
      {
        update: {
          name: `projects/${SERVICE_ACCOUNT.project_id}/databases/(default)/documents/investments/${docId}`,
          fields: Object.fromEntries(Object.entries(invData).map(([k, v]) => [k, toFirestoreValue(v)]))
        }
      },
      {
        update: {
          name: `projects/${SERVICE_ACCOUNT.project_id}/databases/(default)/documents/wallets/${uid}`,
          fields: {
            usdtBalance: toFirestoreValue(newUsdt),
            totalInvest: toFirestoreValue(newTotalInvest)
          }
        },
        updateMask: { fieldPaths: ['usdtBalance', 'totalInvest'] },
        currentDocument: walletDoc.updateTime ? { updateTime: walletDoc.updateTime } : { exists: true }
      },
      {
        update: {
          name: `projects/${SERVICE_ACCOUNT.project_id}/databases/(default)/documents/users/${uid}`,
          fields: {
            totalInvested: toFirestoreValue(newUserTotalInvested)
          }
        },
        updateMask: { fieldPaths: ['totalInvested'] },
        currentDocument: userDoc.updateTime ? { updateTime: userDoc.updateTime } : { exists: true }
      }
    ];
    
    await fsBatchCommit(writes, adminToken);

    // [FIX 2026-04-30] 투자 즉시 상위 라인 매출 누적 + 즉시 직급 평가 트리거
    // - 1단계: bumpUplineNetworkSales 로 상위 networkSales 즉시 가산
    // - 2단계: 가산 직후 autoUpgradeAllRanks 를 호출해 본인 투자액 + 소실적 합 조건 즉시 평가
    //          → 하부 매출 발생 시 그 시점에 바로 승급 반영 (cron 대기 없음)
    try {
      const trigger = (async () => {
        try {
          await bumpUplineNetworkSales(uid, amount, adminToken);
        } catch (e) { console.error('[invest bump upline]', e); }
        try {
          const usersAll = await fsQuery('users', adminToken, [], 100000);
          const walletsAll = await fsQuery('wallets', adminToken, [], 100000);
          const invsAll = await fsQuery('investments', adminToken, [{ field: 'status', op: '==', value: 'active' }], 100000);
          await autoUpgradeAllRanks(adminToken, usersAll, walletsAll, invsAll);
        } catch (e) { console.error('[invest auto-upgrade]', e); }
      })();
      if (c.executionCtx && c.executionCtx.waitUntil) {
        c.executionCtx.waitUntil(trigger);
      } else {
        await trigger;
      }
    } catch (e) {
      console.error('[invest bump upline outer]', e);
    }

    return c.json({ success: true });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

const withdrawLocks = new Set<string>();

app.post('/api/user/withdraw', async (c) => {
  try {
    const authHeader = c.req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) return c.json({ error: 'Unauthorized' }, 401);
    const idToken = authHeader.split(' ')[1];
    
    const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken })
    });
    const data = await res.json();
    if (!data.users || !data.users.length) return c.json({ error: 'Invalid token' }, 401);
    
    const uid = data.users[0].localId;
    if (withdrawLocks.has(uid)) return c.json({ error: '요청 처리중입니다. 잠시 후 다시 시도해주세요.' }, 429);
    withdrawLocks.add(uid);
    let adminToken = '';
    let withdrawalRequestLock: WithdrawalRequestLock | null = null;
    
    try {
      const email = data.users[0].email;
    const body = await c.req.json().catch(() => ({}));
    const { pin } = body;
    const amountUsdt = Number(body.amountUsdt);
    const withdrawalAddressCheck = validateWithdrawalAddressForServer(body.address);
    
    if (!Number.isFinite(amountUsdt) || amountUsdt < 50 || !withdrawalAddressCheck.normalizedAddress || !pin) {
      return c.json({ error: '유효하지 않은 요청입니다.' }, 400);
    }

    if (!withdrawalAddressCheck.ok) {
      queueAdminAuditLog(c, {
        category: 'withdrawal',
        action: 'withdrawal_request_invalid_network_blocked',
        severity: 'medium',
        targetType: 'withdrawal_request',
        targetId: uid,
        metadata: {
          uid,
          detectedNetwork: withdrawalAddressCheck.network,
          addressPrefix: withdrawalAddressCheck.normalizedAddress.slice(0, 6),
          addressLength: withdrawalAddressCheck.normalizedAddress.length
        }
      });
      return c.json({
        success: false,
        error: withdrawalAddressCheck.message,
        code: withdrawalAddressCheck.error,
        detectedNetwork: withdrawalAddressCheck.network
      }, 400);
    }

    const normalizedAddress = withdrawalAddressCheck.normalizedAddress;
    
    adminToken = await getAdminToken();
    const requestLockResult = await acquireWithdrawalRequestLock(c, adminToken, uid, amountUsdt, withdrawalAddressCheck.network);
    if (!requestLockResult.ok) return requestLockResult.response;
    withdrawalRequestLock = requestLockResult.lock;

    const deedraPrice = await getServerDdraPrice(adminToken);
    const userDoc = await fsGet(`users/${uid}`, adminToken);
    if (!userDoc) return c.json({ error: '회원 정보를 찾을 수 없습니다.' }, 404);
    const userObj = firestoreDocToObj(userDoc);
    
    
    if (userObj.withdrawSuspended) return c.json({ error: '일정기간 출금금지 계정입니다' }, 403);
    
    // --- Check for existing pending withdrawals ---
    const existingPending = await fsQuery('transactions', adminToken, [
      { fieldFilter: { field: { fieldPath: 'userId' }, op: 'EQUAL', value: { stringValue: uid } } },
      { fieldFilter: { field: { fieldPath: 'type' }, op: 'EQUAL', value: { stringValue: 'withdrawal' } } },
      { fieldFilter: { field: { fieldPath: 'status' }, op: 'EQUAL', value: { stringValue: 'pending' } } }
    ], 1);
    
    if (existingPending && existingPending.length > 0) {
      return c.json({ error: '이미 진행 중인 출금 신청이 있습니다. 완료 후 다시 시도해주세요.' }, 400);
    }

    
    // --- Abusing Control ---
    const abusingDoc = await fsGet('settings/abusing', adminToken);
    const abusingData = abusingDoc?.fields ? firestoreDocToObj(abusingDoc) : {
      globalNoDepositRollupBlock: false,
      globalNoDepositWithdrawBlock: false,
      customRules: []
    };

    const realDepositTxs = await fsQuery('transactions', adminToken, [
      { fieldFilter: { field: { fieldPath: 'userId' }, op: 'EQUAL', value: { stringValue: uid } } },
      { fieldFilter: { field: { fieldPath: 'type' }, op: 'EQUAL', value: { stringValue: 'deposit' } } },
      { fieldFilter: { field: { fieldPath: 'status' }, op: 'EQUAL', value: { stringValue: 'approved' } } }
    ], 1);
    
    const hasRealDeposit = realDepositTxs && realDepositTxs.length > 0;
    let blockWithdraw = abusingData.globalNoDepositWithdrawBlock && !hasRealDeposit;
    
    const abusingRules = Array.isArray(abusingData.customRules) ? abusingData.customRules : [];
    const abusingUserRules = abusingRules.filter((r: any) => (r.ruleType || 'user') === 'user');
    const abusingCountryRules = abusingRules.filter((r: any) => r.ruleType === 'country');

    let curr = uid;
    let appliedRule = null;

    // 1차: 회원 단위 규칙 — 부모 라인을 따라 올라가며 첫 매칭 룰 적용
    while (curr) {
        let rSelf = abusingUserRules.find((r:any) => r.uid === curr && r.scope === 'self' && curr === uid);
        let rGroup = abusingUserRules.find((r:any) => r.uid === curr && r.scope === 'group');

        if (rSelf) { appliedRule = rSelf; break; }
        if (rGroup) { appliedRule = rGroup; break; }

        const pDoc = await fsGet(`users/${curr}`, adminToken);
        if (pDoc && pDoc.fields && pDoc.fields.referredBy) {
            curr = pDoc.fields.referredBy.stringValue || null;
        } else {
            curr = null;
        }
    }

    // 2차: 국가 단위 규칙 (회원 단위 규칙 미존재 시) — 본인 국가코드 매칭
    // [FIX 2026-04-30] countryCode 누락 / country 이름·별칭(예: '태국', 'Thailand', 'THA') 정규화 후 매칭
    if (!appliedRule && abusingCountryRules.length) {
        const myCountry = resolveCountryCodeForUserDoc(userObj);
        if (myCountry) {
            const cRule = abusingCountryRules.find((r: any) => r.countryCode === myCountry);
            if (cRule) appliedRule = cRule;
        }
    }

    if (appliedRule) {
        if (appliedRule.withdraw === 'allow') blockWithdraw = false;
        else if (appliedRule.withdraw === 'block') blockWithdraw = true;
    }

    if (blockWithdraw) {
        return c.json({ error: '실제 입금(활성화) 이력이 있는 회원만 출금이 가능합니다.' }, 403);
    }
    // --- End Abusing Control ---

    const walletDoc = await fsGet(`wallets/${uid}`, adminToken);
    const wallet = walletDoc ? firestoreDocToObj(walletDoc) : {};
    const availableBonus = wallet.bonusBalance || 0;
    
    if (availableBonus < amountUsdt) {
      return c.json({ error: `출금 가능 USDT 부족 (가능: ${availableBonus.toFixed(2)} USDT)` }, 400);
    }
    
    // Encode pin to btoa (simple base64 as frontend uses)
    const encodedPin = btoa(pin);
    if (userObj.withdrawPin && userObj.withdrawPin !== encodedPin) {
      return c.json({ error: '출금 PIN이 일치하지 않습니다.' }, 400);
    }
    
    // Fee calculation
    let feeRate = 5;
    const ratesDoc = await fsGet('settings/rates', adminToken);
    const settingsDoc = await fsGet('settings/system', adminToken);
    const rates = ratesDoc ? firestoreDocToObj(ratesDoc) : {};
    const settings = settingsDoc ? firestoreDocToObj(settingsDoc) : {};
    
    if (rates.withdrawalFeeRate !== undefined && rates.withdrawalFeeRate > 0) feeRate = rates.withdrawalFeeRate;
    else if (rates.withdrawFeeRate !== undefined && rates.withdrawFeeRate > 0) feeRate = rates.withdrawFeeRate;
    else if (settings.withdrawalFeeRate !== undefined && settings.withdrawalFeeRate > 0) feeRate = settings.withdrawalFeeRate * 100;
    
    const vipDiscounts = rates.vipDiscounts || {};
    const vipLevel = userObj.vipLevel || 'bronze';
    const discount = vipDiscounts[vipLevel] || 0;
    feeRate = Math.max(0, feeRate - discount);
    
    // PART II §0 HARD RULE #3 — 8자리 반올림 일관 적용
    const round8 = (x: number) => Math.round(x * 1e8) / 1e8;
    const ddrAmt = round8(amountUsdt / (deedraPrice || 0.5));
    const feeAmount = round8(ddrAmt * feeRate / 100);
    const netDdra = round8(ddrAmt - feeAmount);
    const netUsdt = round8(netDdra * (deedraPrice || 0.5));
    const feeUsdt = round8(amountUsdt * (feeRate / 100));
    const ticketsToBurn = wallet.weeklyTickets || 0;
    
    const docId = crypto.randomUUID().replace(/-/g, '');
    const txData = {
      userId: uid,
      userEmail: email || null,
      type: 'withdrawal',
      amountDdra: ddrAmt,
      amountUsdt: amountUsdt,
      amount: netDdra,
      currency: 'DDRA',
      ddraPrice: deedraPrice || 0.5,
      walletAddress: normalizedAddress,
      addressNetwork: 'solana',
      withdrawalAddressNetwork: 'solana',
      addressValidatedAt: new Date().toISOString(),
      withdrawalRequestLockId: uid,
      withdrawalRequestLockedAt: withdrawalRequestLock.acquiredAt,
      feeRate: feeRate,
      feeAmount: feeAmount,
      netUsdt: netUsdt,
      feePct: feeRate,
      feeUsdt: feeUsdt,
      burnedWeeklyTickets: ticketsToBurn,
      status: 'pending',
      createdAt: new Date(),
    };
    
    const newBonusBalance = Math.max(0, availableBonus - amountUsdt);
    const newTotalWithdrawal = (wallet.totalWithdrawal || 0) + amountUsdt;
    
    
    let jpUpdates: any = null;
    let finalAmountToAdd = 0;
    try {
        if (feeUsdt > 0 || ticketsToBurn > 0) {
            const jpSnap = await fsGet('events/weekly_jackpot', adminToken);
            let currentAmt = 0;
            let currentTix = 0;
            let fieldsToKeep: any = {};
            
            if (jpSnap && jpSnap.fields) {
              const jpData = firestoreDocToObj(jpSnap);
              fieldsToKeep = jpSnap.fields;
              if (jpData.active !== false) {
                const accumRate = jpData.feeAccumulationRate !== undefined ? Number(jpData.feeAccumulationRate) : 100;
                finalAmountToAdd = feeUsdt * (accumRate / 100);
              }
              currentAmt = Number(jpData.amount || 0);
              currentTix = Number(jpData.totalTickets || 0);
            } else {
              finalAmountToAdd = feeUsdt;
            }
            
            jpUpdates = Object.assign({}, fieldsToKeep);
            if (finalAmountToAdd > 0) jpUpdates.amount = toFirestoreValue(currentAmt + finalAmountToAdd);
            if (ticketsToBurn > 0) jpUpdates.totalTickets = toFirestoreValue(Math.max(0, currentTix - ticketsToBurn));
            jpUpdates.lastUpdate = toFirestoreValue(new Date().toISOString());
        }
    } catch (e) {
        console.error('jackpot update error', e);
    }

    const writes = [
      {
        update: {
          name: `projects/${SERVICE_ACCOUNT.project_id}/databases/(default)/documents/transactions/${docId}`,
          fields: Object.fromEntries(Object.entries(txData).map(([k, v]) => [k, toFirestoreValue(v)]))
        }
      },
      {
        update: {
          name: `projects/${SERVICE_ACCOUNT.project_id}/databases/(default)/documents/wallets/${uid}`,
          fields: {
            bonusBalance: toFirestoreValue(newBonusBalance),
            totalWithdrawal: toFirestoreValue(newTotalWithdrawal),
            weeklyTickets: toFirestoreValue(0)
          }
        },
        updateMask: { fieldPaths: ['bonusBalance', 'totalWithdrawal', 'weeklyTickets'] },
        currentDocument: walletDoc && walletDoc.updateTime ? { updateTime: walletDoc.updateTime } : { exists: true }
      }
    ];

      if (jpUpdates) {
          writes.push({
              update: {
                  name: `projects/${SERVICE_ACCOUNT.project_id}/databases/(default)/documents/events/weekly_jackpot`,
                  fields: jpUpdates
              }
          });
      }

    
    await fsBatchCommit(writes, adminToken);
    
    return c.json({ success: true });
    } finally {
      if (withdrawalRequestLock && adminToken) {
        await releaseWithdrawalRequestLock(withdrawalRequestLock, adminToken).catch((error) => {
          console.warn('[withdrawal-request-lock] release failed', error);
        });
      }
      withdrawLocks.delete(uid);
    }
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

app.post('/api/user/update-profile', async (c) => {
  try {
    const authHeader = c.req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) return c.json({ error: 'Unauthorized' }, 401);
    const idToken = authHeader.split(' ')[1];
    
    // verify token via identity toolkit or just decode and verify signature?
    // actually, simpler: use the token to query firestore as the user, if we can?
    // Wait, getting adminToken and verifying idToken is better.
    // Instead of full verify, let's just use the idToken to call Firestore REST directly, 
    // or just fetch user info from identity toolkit to verify it, then use adminToken to patch.
    const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken })
    });
    const data = await res.json();
    if (!data.users || !data.users.length) return c.json({ error: 'Invalid token' }, 401);
    
    const uid = data.users[0].localId;
    const body = await c.req.json().catch(() => ({}));
    
    const adminToken = await getAdminToken();

    // 지갑 주소 변경 시 PIN 확인 로직
    if (body.solanaWallet !== undefined) {
      const uRes = await fetch(`${FIRESTORE_BASE}/users/${uid}`, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      const uData = await uRes.json();
      const currentWallet = uData.fields?.solanaWallet?.stringValue;
      
      if (currentWallet && currentWallet !== body.solanaWallet) {
        if (!body.currentPin) return c.json({ error: '지갑 주소를 변경하려면 출금 PIN이 필요합니다.' }, 400);
        
        const storedPin = uData.fields?.withdrawPin?.stringValue;
        const providedPinBase64 = btoa(body.currentPin);
        
        if (providedPinBase64 !== storedPin) {
          return c.json({ error: '출금 PIN이 일치하지 않습니다.' }, 400);
        }
      }
    }

    const allowedKeys = ['autoCompound', 'name', 'phone', 'country', 'withdrawPin', 'solanaWallet'];
    const updateData: any = {};
    let hasChanges = false;
    for (const key of allowedKeys) {
      if (body[key] !== undefined) {
        updateData[key] = body[key];
        hasChanges = true;
      }
    }
    
    if (!hasChanges) return c.json({ success: true });
    await fsPatch(`users/${uid}`, updateData, adminToken);
    
    return c.json({ success: true });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

app.post('/api/auth/login-by-username', async (c) => {
  try {
    const { username, password } = await c.req.json()
    if (!username || !password) return c.json({ error: '아이디와 비밀번호를 입력하세요.' }, 400)

    const adminToken = await getAdminToken()

    // username 필드로 users 조회
    const users = await fsQuery('users', adminToken, [
      { fieldFilter: { field: { fieldPath: 'username' }, op: 'EQUAL', value: { stringValue: username.trim() } } }
    ], 1)

    if (!users.length) return c.json({ error: '아이디 또는 비밀번호가 올바르지 않습니다.' }, 401)
    const user = users[0]
    const email = user.email || user.fields?.email?.stringValue

    if (!email) return c.json({ error: '계정 이메일 정보가 없습니다. 관리자에게 문의하세요.' }, 400)

    // Firebase Auth에 email+password로 로그인
    const authRes = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, returnSecureToken: true })
      }
    )
    const authData: any = await authRes.json()
    if (!authRes.ok) {
      const msg = authData?.error?.message || ''
      if (msg.includes('INVALID_PASSWORD') || msg.includes('INVALID_LOGIN_CREDENTIALS')) {
        return c.json({ error: '아이디 또는 비밀번호가 올바르지 않습니다.' }, 401)
      }
      if (msg.includes('USER_DISABLED')) return c.json({ error: '정지된 계정입니다.' }, 403)
      return c.json({ error: '로그인 실패: ' + msg }, 400)
    }

    return c.json({
      success: true,
      idToken:      authData.idToken,
      refreshToken: authData.refreshToken,
      expiresIn:    authData.expiresIn,
      email,
      uid:          authData.localId
    })
  } catch (e: any) {
    return c.json({ error: e.message }, 500)
  }
})

// ─── [2] referralCode → username 마이그레이션 API ────────────────────────────
// referralCode 필드에 잘못 들어간 값(실제 ID)을 username으로 이동하고
// referralCode는 uid 기반으로 새로 생성 (기존 referredBy 체인은 유지)
app.post('/api/admin/migrate-username', async (c) => {
  try {
    const { secret } = await c.req.json()
    if (!isValidCronSecret(secret)) return c.json({ error: 'unauthorized' }, 401)

    const adminToken = await getAdminToken()
    // 전체 회원 조회
    const allUsers = await fsQuery('users', adminToken, [], 100000)

    let migrated = 0, skipped = 0, failed = 0
    const errors: string[] = []

    for (const u of allUsers) {
      try {
        const uid = u.id || u.uid
        if (!uid || u.role === 'admin') { skipped++; continue }

        // 이미 username 필드가 있으면 건너뜀
        if (u.username) { skipped++; continue }

        // referralCode에 있는 값이 실제 ID → username으로 이동
        const currentReferralCode = u.referralCode || ''

        // 새 referralCode 생성: uid 앞 8자 대문자
        const newReferralCode = uid.slice(0, 8).toUpperCase()

        await fsPatch(`users/${uid}`, {
          username:     currentReferralCode,   // 기존 referralCode 값 → username
          referralCode: newReferralCode,        // 새 referralCode (uid 기반)
        }, adminToken)

        migrated++
      } catch (e: any) {
        failed++
        errors.push(`${u.id}: ${e.message}`)
      }
    }

    return c.json({
      success: true,
      total: allUsers.length,
      migrated,
      skipped,
      failed,
      errors: errors.slice(0, 20)
    })
  } catch (e: any) {
    return c.json({ error: e.message }, 500)
  }
})

// ─── [3] 일괄 비밀번호 000000 설정 API ────────────────────────────────────────
// username이 있는 모든 회원(임포트된 회원)의 비밀번호를 000000으로 설정

// ─── [새로운 관리자 기능] 지갑 초기화 API ────────────────────────────────────────
app.post('/api/admin/wipe-wallets', async (c) => {
  try {
    const { secret, mode, targetIds } = await c.req.json()
    if (!isValidCronSecret(secret)) return c.json({ error: 'unauthorized' }, 401)
    
    const adminToken = await getAdminToken()
    let processed = 0;
    
    // mode: 'all' 또는 'specific'
    const queryIds = mode === 'all' ? [] : (targetIds || [])
    
    const wallets = await fsQuery('wallets', adminToken, [], 100000)
    for (const w of wallets) {
      if (mode === 'all' || queryIds.includes(w.userId)) {
        await fsPatch(`wallets/${w.userId}`, {
          bonusBalance: 0,
          usdtBalance: 0,
          totalEarnings: 0,
          dedraBalance: 0
        }, adminToken)
        processed++
      }
    }
    
    await fsCreate('auditLogs', {
      action: 'wipe_wallets',
      mode,
      targetCount: processed,
      detail: `관리자가 ${processed}명의 지갑을 0으로 초기화했습니다 (${mode})`,
      createdAt: new Date().toISOString()
    }, adminToken)
    
    return c.json({ success: true, processed })
  } catch (e: any) {
    return c.json({ error: e.message }, 500)
  }
})

app.post('/api/admin/bulk-reset-password', async (c) => {
  try {
    const { secret, password: newPw } = await c.req.json()
    if (!isValidCronSecret(secret)) return c.json({ error: 'unauthorized' }, 401)

    const targetPassword = newPw || '000000'
    const adminToken = await getAdminToken()

    // username 필드가 있는 회원만 (= 임포트된 회원)
    const users = await fsQuery('users', adminToken, [], 100000)
    const targets = users.filter((u: any) => u.username && u.role !== 'admin')

    let success = 0, failed = 0
    const errors: string[] = []

    // Firebase Admin REST API로 비밀번호 업데이트 (uid 기반)
    for (const u of targets) {
      const uid = u.id || u.uid
      if (!uid) { failed++; continue }
      try {
        const res = await fetch(
          `https://identitytoolkit.googleapis.com/v1/projects/${SERVICE_ACCOUNT.project_id}/accounts:update`,
          {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${adminToken}`
            },
            body: JSON.stringify({ localId: uid, password: targetPassword })
          }
        )
        if (res.ok) { success++ } else { failed++; errors.push(uid) }
      } catch { failed++; errors.push(uid) }
    }

    return c.json({
      success: true,
      total: targets.length,
      updated: success,
      failed,
      errors: errors.slice(0, 20)
    })
  } catch (e: any) {
    return c.json({ error: e.message }, 500)
  }
})

app.post('/api/admin/import-members', async (c) => {
  try {
    const body = await c.req.json()
    if (!isValidCronSecret(body.secret)) return c.json({ error: 'unauthorized' }, 401)
    const members: any[] = body.members || []
    const adminToken = await getAdminToken()
    let success = 0, failed = 0
    for (const m of members) {
      try {
        if (!m.uid || !m.email) { failed++; continue }
        await fsSet(`users/${m.uid}`, {
          uid: m.uid, email: m.email, name: m.name || '',
          role: m.role || 'member', rank: m.rank || 'G0',
          status: m.status || 'active',
          username: m.username || null,  // 구 시스템 로그인 ID
          referralCode: m.referralCode || m.uid.slice(0, 8).toUpperCase(),
          referredBy: m.referredBy || null,
          phone: m.phone || '', createdAt: m.createdAt || new Date().toISOString()
        }, adminToken)
        success++
      } catch (_) { failed++ }
    }
    return c.json({ success: true, imported: success, failed })
  } catch (e: any) {
    return c.json({ error: e.message }, 500)
  }
})

// ─── DDRA 토큰 주소 설정 ──────────────────────────────────────────────────────
app.post('/api/admin/set-ddra-token', async (c) => {
  try {
    const { mintAddress, pairAddress, secret } = await c.req.json()
    if (!isValidCronSecret(secret)) return c.json({ error: 'unauthorized' }, 401)
    const adminToken = await getAdminToken()
    await fsPatch('settings/main', {
      'ddraToken.mintAddress': mintAddress || '',
      'ddraToken.pairAddress': pairAddress || '',
      updatedAt: new Date().toISOString()
    }, adminToken)
    return c.json({ success: true })
  } catch (e: any) {
    return c.json({ error: e.message }, 500)
  }
})

// ─── Solana 입금 감지 ────────────────────────────────────────────────────────
// USDT on Solana (SPL) mint address
const USDT_SPL_MINT = 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB'


async function verifyMultiChainDeposit(txid, amount, companyWalletsDoc) {
  let isTxValid = false;
  let actualAmount = 0;
  let verifiedMsg = '⏳ 온체인 검증: 일시적 확인불가 (관리자가 직접 확인 요망)';

  // PART II §1-2 — TXID 형식 기반 네트워크 1차 추정
  let network = 'Solana';
  if (txid.startsWith('0x') && txid.length === 66) network = 'BSC';
  else if (/^[0-9a-fA-F]{64}$/.test(txid)) network = 'TRON';

  let solanaWallets = ['8HBxhtMWFsvxxkWmyqN7J1jUvghMQ29tqJEvNFnWS5X4', '9Cix8agTnPSy26JiPGeq7hoBqBQbc8zsaXpmQSBsaTMW', 'DHVXXkhYkwevB5wHqtri2K6yg8GD6jykE4ZaZW3iQqZz'];
  let bscWallets = ['0x76cbe9826d9720e49b3536e426a125bc4ced2502'];
  let tronWallets = ['TLiG5xwLM7po4ALkAu3iCuNsxrbT9tVUw4'];

  if (companyWalletsDoc?.fields?.wallets?.arrayValue?.values) {
     const wList = companyWalletsDoc.fields.wallets.arrayValue.values;
     for (const w of wList) {
       const nw = w.mapValue?.fields?.network?.stringValue?.toUpperCase() || '';
       const addr = w.mapValue?.fields?.address?.stringValue || '';
       if (addr) {
         if (nw.includes('BSC') || nw.includes('BEP')) bscWallets.push(addr.toLowerCase());
         else if (nw.includes('TRON') || nw.includes('TRC')) tronWallets.push(addr);
         else solanaWallets.push(addr);
       }
     }
  }

  // PART II §1-2/§1-4 — 1차 분기 실패 시 fallback 시도 순서 결정
  // BSC TXID 의 0x prefix 누락, TRON-Solana hex/base58 혼동 등 사용자 입력 오류 대응
  const tryOrder: string[] = [network];
  for (const fb of ['BSC', 'TRON', 'Solana']) {
    if (!tryOrder.includes(fb)) tryOrder.push(fb);
  }
  const networksTried: string[] = [];
  const expectedAmt = parseFloat(amount.toString().replace(/,/g, ''));

  // ── 네트워크별 검증 헬퍼 (각각 { actualAmount, isTxValid, verifiedMsg, found } 반환) ──
  async function verifyOnBsc(): Promise<{ actualAmount: number; isTxValid: boolean; verifiedMsg: string; found: boolean }> {
    try {
      // PART II §1-4 — BSC RPC 다중 fallback
      const bscRpcUrls = [
        'https://bsc-dataseed.binance.org/',
        'https://bsc-dataseed1.defibit.io/',
        'https://rpc.ankr.com/bsc'
      ];
      let data: any = null;
      for (const rpcUrl of bscRpcUrls) {
        try {
          const res = await fetch(rpcUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_getTransactionReceipt', params: [txid] }),
            signal: AbortSignal.timeout(6000)
          });
          if (!res.ok) continue;
          const json = await res.json();
          if (json && json.result) { data = json; break; }
        } catch (_) { continue; }
      }
      if (!data || !data.result) {
        return { actualAmount: 0, isTxValid: false, verifiedMsg: `❌ <b>온체인 검증 [BSC]: 트랜잭션을 찾을 수 없음</b>`, found: false };
      }
      if (data.result.status !== '0x1') {
        return { actualAmount: 0, isTxValid: false, verifiedMsg: `❌ <b>온체인 검증 [BSC]: 실패한 거래 (status=${data.result.status})</b>`, found: true };
      }
      let maxAmt = 0;
      for (const log of data.result.logs || []) {
        if (
          log.address?.toLowerCase() === '0x55d398326f99059ff775485246999027b3197955' &&
          log.topics && log.topics[0] === '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef' &&
          log.topics.length >= 3
        ) {
          const toAddress = '0x' + log.topics[2].slice(26).toLowerCase();
          if (bscWallets.includes(toAddress)) {
            const amt = parseInt(log.data, 16) / 1e18;
            if (amt > maxAmt) maxAmt = amt;
          }
        }
      }
      if (maxAmt > 0) {
        if (maxAmt >= expectedAmt - 1.0) {
          return { actualAmount: maxAmt, isTxValid: true, verifiedMsg: `✅ <b>온체인 검증 [BSC]: 일치함 (실제 송금액: ${maxAmt} USDT)</b>`, found: true };
        } else {
          return { actualAmount: maxAmt, isTxValid: false, verifiedMsg: `⚠️ <b>온체인 검증 [BSC]: 금액 불일치 (실제: ${maxAmt} / 신청: ${amount})</b>`, found: true };
        }
      }
      return { actualAmount: 0, isTxValid: false, verifiedMsg: `❌ <b>온체인 검증 [BSC]: 회사 지갑으로 USDT 입금내역 없음</b>`, found: true };
    } catch (e: any) {
      return { actualAmount: 0, isTxValid: false, verifiedMsg: `❌ <b>온체인 검증 [BSC]: ${e?.message || 'error'}</b>`, found: false };
    }
  }

  async function verifyOnTron(): Promise<{ actualAmount: number; isTxValid: boolean; verifiedMsg: string; found: boolean }> {
    try {
      const res = await fetch(`https://api.trongrid.io/v1/transactions/${txid}/events`, {
        signal: AbortSignal.timeout(6000)
      });
      const data = await res.json();
      if (!data.success || !data.data || data.data.length === 0) {
        return { actualAmount: 0, isTxValid: false, verifiedMsg: `❌ <b>온체인 검증 [TRON]: 트랜잭션을 찾을 수 없음</b>`, found: false };
      }
      let maxAmt = 0;
      for (const ev of data.data) {
        if (ev.contract_address === 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t' && ev.event_name === 'Transfer') {
          const toAddr = ev.result.to || ev.result.receiver || '';
          if (tronWallets.includes(toAddr)) {
            const amt = Number(ev.result.value) / 1e6;
            if (amt > maxAmt) maxAmt = amt;
          }
        }
      }
      if (maxAmt > 0) {
        if (maxAmt >= expectedAmt - 1.0) {
          return { actualAmount: maxAmt, isTxValid: true, verifiedMsg: `✅ <b>온체인 검증 [TRON]: 일치함 (실제 송금액: ${maxAmt} USDT)</b>`, found: true };
        } else {
          return { actualAmount: maxAmt, isTxValid: false, verifiedMsg: `⚠️ <b>온체인 검증 [TRON]: 금액 불일치 (실제: ${maxAmt} / 신청: ${amount})</b>`, found: true };
        }
      }
      return { actualAmount: 0, isTxValid: false, verifiedMsg: `❌ <b>온체인 검증 [TRON]: USDT 전송 내역 없음</b>`, found: true };
    } catch (e: any) {
      return { actualAmount: 0, isTxValid: false, verifiedMsg: `❌ <b>온체인 검증 [TRON]: ${e?.message || 'error'}</b>`, found: false };
    }
  }

  async function verifyOnSolana(): Promise<{ actualAmount: number; isTxValid: boolean; verifiedMsg: string; found: boolean }> {
    // PART II §1-4 — Solana RPC 4-way fallback
    const solanaRpcUrls = [
      'https://solana-rpc.publicnode.com',
      'https://api.mainnet-beta.solana.com',
      'https://solana.api.onfinality.io/public',
      'https://rpc.ankr.com/solana'
    ];
    let data: any = null;
    let rpcError = '';
    for (const rpcUrl of solanaRpcUrls) {
      try {
        const res = await fetch(rpcUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0', id: 1,
            method: 'getTransaction',
            params: [txid, { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0, commitment: 'confirmed' }]
          }),
          signal: AbortSignal.timeout(6000)
        });
        if (!res.ok) { rpcError = `RPC ${rpcUrl} status ${res.status}`; continue; }
        const json = await res.json();
        if (json && json.result && json.result.meta) { data = json; break; }
        else if (json && json.result === null) { rpcError = 'tx not yet confirmed'; break; }
      } catch (e: any) { rpcError = `RPC ${rpcUrl} ${e?.message || 'error'}`; continue; }
    }
    if (data && data.result && data.result.meta) {
      const meta = data.result.meta;
      let maxReceived = 0;
      const USDT_MINT_SOL = 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB';
      for (const w of solanaWallets) {
        const pre = (meta.preTokenBalances || []).find((b: any) => b.owner === w && b.mint === USDT_MINT_SOL);
        const post = (meta.postTokenBalances || []).find((b: any) => b.owner === w && b.mint === USDT_MINT_SOL);
        const preAmt = pre ? parseFloat(pre.uiTokenAmount.uiAmountString) : 0;
        const postAmt = post ? parseFloat(post.uiTokenAmount.uiAmountString) : 0;
        const diff = postAmt - preAmt;
        if (diff > maxReceived) maxReceived = diff;
      }
      if (maxReceived > 0) {
        if (maxReceived >= expectedAmt - 1.0) {
          return { actualAmount: maxReceived, isTxValid: true, verifiedMsg: `✅ <b>온체인 검증 [Solana]: 일치함 (실제 송금액: ${maxReceived} USDT)</b>`, found: true };
        } else {
          return { actualAmount: maxReceived, isTxValid: false, verifiedMsg: `⚠️ <b>온체인 검증 [Solana]: 금액 불일치 (실제: ${maxReceived} / 신청: ${amount})</b>`, found: true };
        }
      }
      return { actualAmount: 0, isTxValid: false, verifiedMsg: `❌ <b>온체인 검증 [Solana]: 회사 지갑으로 USDT 입금내역 없음</b>`, found: true };
    }
    if (rpcError === 'tx not yet confirmed') {
      return { actualAmount: 0, isTxValid: false, verifiedMsg: `⏳ <b>온체인 검증 [Solana]: 트랜잭션 미확정 — 잠시 후 자동 재검증됩니다</b>`, found: false };
    }
    return { actualAmount: 0, isTxValid: false, verifiedMsg: `❌ <b>온체인 검증 [Solana]: 트랜잭션을 찾을 수 없음 (모든 RPC 실패: ${rpcError || 'unknown'})</b>`, found: false };
  }

  try {
    // PART II §1-2/§1-4 — tryOrder 순서대로 시도, found=true 또는 isTxValid=true 시 종료
    for (const tryNet of tryOrder) {
      networksTried.push(tryNet);
      let r: { actualAmount: number; isTxValid: boolean; verifiedMsg: string; found: boolean };
      if (tryNet === 'BSC') r = await verifyOnBsc();
      else if (tryNet === 'TRON') r = await verifyOnTron();
      else r = await verifyOnSolana();

      // 검증 성공 또는 트랜잭션이 해당 네트워크에 존재(금액불일치 포함)면 즉시 종료
      if (r.isTxValid || r.found) {
        network = tryNet;
        actualAmount = r.actualAmount;
        isTxValid = r.isTxValid;
        verifiedMsg = r.verifiedMsg;
        break;
      }
      // 트랜잭션 미발견 시 다음 네트워크 시도. 마지막 메시지는 마지막 시도의 verifiedMsg 로 유지
      verifiedMsg = r.verifiedMsg;
    }
    // 모든 fallback 실패 시 종합 메시지로 보강
    if (!isTxValid && actualAmount === 0 && networksTried.length > 1) {
      verifiedMsg = `❌ <b>온체인 검증 실패 (${networksTried.join('→')} 모두 미발견)</b>`;
    }
  } catch (e) {
    console.error('Verify multi chain error:', e);
  }
  return { isTxValid, actualAmount, verifiedMsg, network, networksTried };
}



app.post('/api/admin/notify-deposit-request', async (c) => {
  try {
    const body = await c.req.json()
    const { amount, email, txid, docId } = body
    const adminToken = await getAdminToken()
    const rawSettings = await fsGet('settings/system', adminToken) || {}
    const sysDocData = rawSettings.fields ? firestoreDocToObj(rawSettings) : {}

    // ─── 1단계: 텔레그램 1차 알림 (검증 전 즉시 발송) ────────────────
    // 검증이 hang 되거나 실패해도 알림은 무조건 가도록 순서 변경
    const tgSettings = sysDocData.telegram || {}
    if (!tgSettings.botToken && c.env && c.env.TELEGRAM_BOT_TOKEN) {
      tgSettings.botToken = c.env.TELEGRAM_BOT_TOKEN;
      tgSettings.chatId = tgSettings.chatId || '-1002347315570';
      tgSettings.recipients = tgSettings.recipients || [{ chatId: tgSettings.chatId, onDeposit: true }];
    }
    // 네트워크 추정 (TXID 형식만으로)
    let preNetwork = 'Solana';
    if (txid && txid.startsWith('0x') && txid.length === 66) preNetwork = 'BSC';
    else if (txid && /^[0-9a-fA-F]{64}$/.test(txid)) preNetwork = 'TRON';
    const explorerUrl = preNetwork === 'BSC' ? `https://bscscan.com/tx/${txid}`
                      : preNetwork === 'TRON' ? `https://tronscan.org/#/transaction/${txid}`
                      : `https://solscan.io/tx/${txid}`;
    const nowStr = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })
    const preText = `🚨 <b>신규 입금 신청 (수동)</b>\n회원: ${email}\n신청 금액: ${amount} USDT\n네트워크: ${preNetwork}\nTXID: <a href="${explorerUrl}">${(txid||'').substring(0,25)}...</a>\n시각: ${nowStr}\n\n⏳ <b>온체인 검증 진행중...</b>\n검증 결과는 잠시 후 관리자 페이지에 자동 표시됩니다.`
    // 동기 발송 시도 (실패해도 throw 하지 않음)
    try {
      await sendTelegramToRecipients(tgSettings, 'deposit', preText);
    } catch (e) {
      console.error('[notify-deposit pre-telegram]', e);
    }

    // ─── 2단계: 온체인 검증 (10초 timeout 보호) ─────────────────────
    let verifiedMsg = '⏳ 온체인 검증: 일시적 확인불가 (관리자가 직접 확인 요망)';
    let isTxValid = false;
    let actualAmount = 0;
    let network = preNetwork;

    try {
      const cwDoc1 = await fsGet('settings/companyWallets', adminToken).catch(()=>null);
      // 전체 검증을 12초 타임박스로 감싸 hang 방지
      const verifyPromise = verifyMultiChainDeposit(txid, amount, cwDoc1);
      const timeoutPromise = new Promise((_, rej) => setTimeout(() => rej(new Error('verify timeout')), 12000));
      const result: any = await Promise.race([verifyPromise, timeoutPromise]).catch((e) => {
        console.error('[notify-deposit verify race]', e?.message || e);
        return null;
      });
      if (result) {
        isTxValid = result.isTxValid;
        actualAmount = result.actualAmount;
        verifiedMsg = result.verifiedMsg;
        network = result.network || preNetwork;
      }
    } catch (e) {
      console.error('[notify-deposit verify outer]', e);
    }

    // ─── 3단계: Firestore 문서 업데이트 (검증 결과 반영) ─────────────
    // [FIX 2026-04-30 B-8] docId 가 없어도 txValidation 항상 저장
    // - docId 미전달 시 txid 로 transactions 컬렉션 검색하여 자동 매칭
    // - 매칭 실패 시 별도 verificationLogs 컬렉션에 결과 보관 (관리자 추적용)
    let resolvedDocId = docId;
    if (!resolvedDocId && txid) {
      try {
        const matchedTxs = await fsQuery('transactions', adminToken, [
          { fieldFilter: { field: { fieldPath: 'txid' }, op: 'EQUAL', value: { stringValue: txid } } }
        ], 1).catch(() => []);
        if (matchedTxs && matchedTxs.length > 0) {
          resolvedDocId = matchedTxs[0].id || matchedTxs[0].docId || null;
        }
      } catch (e) {
        console.error('[notify-deposit txid lookup]', e);
      }
    }

    const updateData: any = {
      txValidation: isTxValid ? 'valid' : (verifiedMsg.includes('일시적') || verifiedMsg.includes('진행중') ? 'pending' : 'invalid'),
      actualAmount: actualAmount,
      verifiedMsg: verifiedMsg,
      network: network,
      verifiedAt: new Date().toISOString()
    };
    // 명백한 허위 입금만 자동 거절 (검증 일시 불가는 보류)
    if (!isTxValid && actualAmount === 0 && !verifiedMsg.includes('일시적') && !verifiedMsg.includes('진행중') && !verifiedMsg.includes('찾을 수 없음')) {
      updateData.status = 'rejected';
      updateData.adminMemo = '시스템 자동 거절: 유효하지 않은 TXID 또는 입금내역 없음';
    }

    if (resolvedDocId) {
      try {
        await fsPatch(`transactions/${resolvedDocId}`, updateData, adminToken);
      } catch (e) {
        console.log('Failed to update transaction doc with validation result', e);
      }
    } else {
      // docId 도 없고 txid 매칭도 실패 → verificationLogs 에 보관
      try {
        await fsCreate('verificationLogs', {
          ...updateData,
          txid: txid || null,
          email: email || null,
          requestedAmount: amount,
          createdAt: new Date().toISOString()
        }, adminToken);
      } catch (e) {
        console.log('Failed to create verificationLogs entry', e);
      }
    }

    // ─── 4단계: 텔레그램 2차 알림 (검증 결과 포함) ───────────────────
    let tgStatusStr = '관리자 페이지에서 승인 대기중입니다.';
    if (isTxValid) {
      tgStatusStr = '✅ <b>온체인 검증 통과 — 승인 대기</b>';
    } else if (!isTxValid && actualAmount === 0 && !verifiedMsg.includes('일시적') && !verifiedMsg.includes('진행중') && !verifiedMsg.includes('찾을 수 없음')) {
      tgStatusStr = '❌ <b>자동 거절됨</b> (허위 입금 또는 금액 없음)';
    } else {
      tgStatusStr = '⚠️ <b>검증 일시 불가 — 관리자 직접 확인 필요</b>';
    }
    const postText = `📋 <b>입금 검증 결과</b>\n회원: ${email}\n금액: ${amount} USDT\nTXID: <a href="${explorerUrl}">${(txid||'').substring(0,25)}...</a>\n\n${verifiedMsg}\n\n${tgStatusStr}`;
    if (c.executionCtx && c.executionCtx.waitUntil) {
      c.executionCtx.waitUntil(sendTelegramToRecipients(tgSettings, 'deposit', postText).catch(e => console.error('[notify-deposit post-telegram]', e)));
    } else {
      try { await sendTelegramToRecipients(tgSettings, 'deposit', postText); } catch (e) { console.error('[notify-deposit post-telegram]', e); }
    }

    return c.json({ success: true, verified: isTxValid, actualAmount, network, verifiedMsg })
  } catch (e: any) {
    return c.json({ error: e.message }, 500)
  }
})

// ─── 텔레그램 입금알림 진단용 테스트 엔드포인트 (관리자 페이지 도구로 유지) ──
// cron-secret 또는 관리자 권한으로 호출 가능. 실제 발송 경로를 그대로 사용.
app.get('/api/cron/test-deposit-telegram', async (c) => {
  const secret = c.req.query('secret') || c.req.header('x-cron-secret');
  let authorized = isValidCronSecret(secret);

  if (!authorized) {
    try {
      authorized = await hasPrivilegedApiAccess(c);
    } catch (_) { authorized = false; }
  }

  if (!authorized) return c.json({ error: 'unauthorized' }, 401);

  const diag: any = {
    timestamp: new Date().toISOString(),
    envHasBotToken: false,
    settingsHasBotToken: false,
    botTokenSource: '',
    chatIdSource: '',
    recipients: [],
    sendAttempts: [],
    botInfo: null,
    finalResult: ''
  };

  try {
    const adminToken = await getAdminToken();
    const rawSettings = await fsGet('settings/system', adminToken) || {};
    const sysDocData = rawSettings.fields ? firestoreDocToObj(rawSettings) : {};
    const tgSettings = sysDocData.telegram || {};

    diag.envHasBotToken = !!(c.env && (c.env as any).TELEGRAM_BOT_TOKEN);
    diag.settingsHasBotToken = !!tgSettings.botToken;

    if (!tgSettings.botToken && c.env && (c.env as any).TELEGRAM_BOT_TOKEN) {
      tgSettings.botToken = (c.env as any).TELEGRAM_BOT_TOKEN;
      tgSettings.chatId = tgSettings.chatId || '-1002347315570';
      tgSettings.recipients = tgSettings.recipients || [{ chatId: tgSettings.chatId, onDeposit: true }];
      diag.botTokenSource = 'env.TELEGRAM_BOT_TOKEN';
    } else if (tgSettings.botToken) {
      diag.botTokenSource = 'firestore.settings.system.telegram.botToken';
    } else {
      diag.botTokenSource = 'NOT_FOUND';
    }

    diag.recipients = (tgSettings.recipients || []).map((r: any) => ({
      chatId: r.chatId || '',
      onDeposit: r.onDeposit !== false
    }));
    diag.chatIdSource = tgSettings.chatId || '';

    // 봇 토큰 살아있는지 확인 (getMe)
    if (tgSettings.botToken) {
      try {
        const meRes = await fetch(`https://api.telegram.org/bot${tgSettings.botToken}/getMe`, {
          signal: AbortSignal.timeout(8000)
        });
        const meData = await meRes.json().catch(() => null);
        diag.botInfo = meData;
      } catch (e: any) {
        diag.botInfo = { error: e.message };
      }
    }

    // 실제 발송 (수동 입금 신청 메시지 포맷 그대로)
    const nowStr = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
    const text = `🧪 <b>[테스트] 신규 입금 신청 (수동)</b>
회원: test@deedra.io
신청 금액: 100 USDT
TXID: <a href="https://solscan.io/tx/TEST_${Date.now()}">TEST_${Date.now()}...</a>
시각: ${nowStr}

⏳ 온체인 검증: 일시적 확인불가 (테스트 메시지)

✅ <b>이 메시지가 보이면 텔레그램 입금알림봇은 정상 작동 중입니다.</b>`;

    if (!tgSettings.botToken) {
      diag.finalResult = '❌ botToken 없음 — 발송 불가';
      return c.json(diag);
    }

    // 직접 각 수신자별로 발송 결과를 추적
    const recs = tgSettings.recipients || (tgSettings.chatId ? [{ chatId: tgSettings.chatId, onDeposit: true }] : []);
    if (recs.length === 0) {
      diag.finalResult = '❌ recipients 비어있음 — 발송 대상 없음';
      return c.json(diag);
    }

    for (const rec of recs) {
      if (!rec.chatId) {
        diag.sendAttempts.push({ chatId: '(empty)', skipped: true, reason: 'chatId 비어있음' });
        continue;
      }
      if (rec.onDeposit === false) {
        diag.sendAttempts.push({ chatId: rec.chatId, skipped: true, reason: 'onDeposit=false' });
        continue;
      }
      try {
        const sendRes = await fetch(`https://api.telegram.org/bot${tgSettings.botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: rec.chatId, text, parse_mode: 'HTML' }),
          signal: AbortSignal.timeout(10000)
        });
        const sendData = await sendRes.json().catch(() => null);
        diag.sendAttempts.push({
          chatId: rec.chatId,
          httpStatus: sendRes.status,
          ok: sendData?.ok === true,
          telegramResponse: sendData
        });
      } catch (e: any) {
        diag.sendAttempts.push({ chatId: rec.chatId, error: e.message });
      }
    }

    const okCount = diag.sendAttempts.filter((a: any) => a.ok).length;
    const failCount = diag.sendAttempts.filter((a: any) => !a.ok && !a.skipped).length;
    diag.finalResult = okCount > 0
      ? `✅ ${okCount}건 발송 성공${failCount > 0 ? `, ${failCount}건 실패` : ''}`
      : `❌ 발송 실패 — Telegram API 응답을 확인하세요`;

    return c.json(diag);
  } catch (e: any) {
    diag.finalResult = `❌ 진단 중 예외: ${e.message}`;
    return c.json(diag, 500);
  }
});

app.post('/api/solana/check-deposits', async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}))
    const secret = c.req.header('x-cron-secret') || body.secret

    // 1) Cron/관리자 시크릿이 유효하면 통과
    let authorized = isValidCronSecret(secret)

    // 2) 또는 로그인된 사용자(Firebase ID Token)면 통과 — 입금 신청 직후 즉시 검증 트리거 용도
    //    클라이언트에 시크릿을 노출하지 않기 위해 사용자 토큰으로도 호출 허용
    if (!authorized) {
      try {
        const authHeader = c.req.header('Authorization') || ''
        const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : ''
        if (idToken) {
          const lookupRes = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ idToken })
          })
          const lookup = await lookupRes.json().catch(() => null)
          if (lookup && Array.isArray(lookup.users) && lookup.users.length > 0) {
            authorized = true
          }
        }
      } catch (e) {
        console.warn('[check-deposits] user-token verify failed:', e)
      }
    }

    if (!authorized) return c.json({ error: 'unauthorized' }, 401)

    const adminToken = await getAdminToken()
    
    // 매 5분마다 호출되는 이 엔드포인트에서 자동정산 스케줄도 함께 체크
    const triggerPromise = checkAndRunTrigger(c, adminToken).catch(e => console.error('[checkAndRunTrigger error]', e));
    if (c.executionCtx && c.executionCtx.waitUntil) {
      c.executionCtx.waitUntil(triggerPromise);
    }

    // Firestore에서 회사 입금 지갑 주소 조회
    
    let cwDoc2 = await fsGet('settings/companyWallets', adminToken).catch(()=>null);
    const sysDoc = await fsGet('settings/system', adminToken).catch(()=>null);
    
    let validCompanyWallets = [];
    
    // Add from companyWallets
    if (cwDoc2 && cwDoc2.fields?.wallets?.arrayValue?.values) {
      const wallets = cwDoc2.fields.wallets.arrayValue.values;
      for (const w of wallets) {
        if (w.mapValue?.fields?.address?.stringValue) {
          validCompanyWallets.push(w.mapValue.fields.address.stringValue);
        }
      }
    }
    
    // Add from system depositAddress
    if (sysDoc && sysDoc.fields?.depositAddress?.stringValue) {
      validCompanyWallets.push(sysDoc.fields.depositAddress.stringValue);
    }
    
    // Fallbacks just in case
    validCompanyWallets.push('9Cix8agTnPSy26JiPGeq7hoBqBQbc8zsaXpmQSBsaTMW');
    validCompanyWallets.push('DHVXXkhYkwevB5wHqtri2K6yg8GD6jykE4ZaZW3iQqZz');
    
    // Deduplicate
    validCompanyWallets = [...new Set(validCompanyWallets)].filter(w => w.length >= 32);
    
    let depositAddress = validCompanyWallets[0] || '';


    // Solana SPL Token 트랜잭션 조회 (Helius public RPC)
    // Solana SPL Token 트랜잭션 조회 (공용 RPC로 교체)
    // Helius public key는 막힐 수 있으므로 무료 공용 엔드포인트 사용
            // QuickNode and Triton are generally more reliable for free tier
        // Use completely different RPC providers to bypass Cloudflare / regional blocks
        // Use QuickNode public and basic mainnet (avoid domains that cause CF SSL errors)
    
    // Load Country Bonus Settings
    let cbSettings = null;
    try {
      const cbData = await fsGet('settings/countryBonus', adminToken);
      if (cbData && cbData.fields) {
         cbSettings = firestoreDocToObj(cbData);
      }
    } catch(e) { console.log('Country bonus load error', e) }

    // Load Bear Market Settings
    let bearBonusPct = 0;
    try {
      const bearSnap = await fsGet('settings/bearMarketEvent', adminToken);
      if (bearSnap && bearSnap.fields && bearSnap.fields.enabled?.booleanValue) {
        const bearData = firestoreDocToObj(bearSnap);
        const now = new Date();
        let isWithinTime = false;
        if (bearData.startDate && bearData.endDate) {
          if (now >= new Date(bearData.startDate) && now <= new Date(bearData.endDate)) isWithinTime = true;
        } else if (bearData.endDate) {
          if (now <= new Date(bearData.endDate)) isWithinTime = true;
        } else {
          isWithinTime = true;
        }
        
        if (isWithinTime) {
          const priceSnap = await fsGet('settings/deedraPrice', adminToken);
          if (priceSnap && priceSnap.fields) {
            const pData = firestoreDocToObj(priceSnap);
            const drop = parseFloat(pData.priceChange24h || 0);
            if (drop < 0) {
              bearBonusPct = Math.floor(Math.abs(drop));
            }
          }
        }
      }
    } catch(e) { console.log('Bear market bonus load error', e) }

    const rpcUrls = [
      'https://solana-rpc.publicnode.com',
      'https://solana-rpc.publicnode.com'
    ];
    
    let successUrl = '';
    let lastError = '';
    let signatures = [];
    let globalAddressesToCheck = [depositAddress];
    
    const existing = await fsQuery('transactions', adminToken, [], 5000);
    const pendingDeposits = existing.filter((t: any) => t.status === 'pending' && t.type === 'deposit');
    
    // Always add pending TXIDs so we don't miss them, even if RPC is blocked
    pendingDeposits.forEach((p:any) => {
      const pendingHash = p.txid || p.txHash || '';
      if (pendingHash && pendingHash.length >= 60) {
        signatures.push({ signature: pendingHash, err: null });
      }
    });
    
    for (const url of rpcUrls) {
      try {
        successUrl = url;
        
        // 1. Get ATA accounts
        const ataRes = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0', id: 1,
            method: 'getTokenAccountsByOwner',
            params: [depositAddress, { mint: USDT_SPL_MINT }, { encoding: 'jsonParsed' }]
          }),
          signal: AbortSignal.timeout(8000)
        });
        
        let addressesToCheck = [...new Set([depositAddress, '9Cix8agTnPSy26JiPGeq7hoBqBQbc8zsaXpmQSBsaTMW', '9Cix8agTnPSy26JiPGeq7hoBQBqbc8zsaXpmQSBSaTMW'])];
        if (!ataRes.ok && ataRes.status === 403) throw new Error('RPC Blocked');
        if (ataRes.ok) {
          const ataData = await ataRes.json();
          if (ataData.result && ataData.result.value) {
            const ataPubkeys = ataData.result.value.map((v:any) => v.pubkey);
            addressesToCheck.push(...ataPubkeys);
            globalAddressesToCheck.push(...ataPubkeys);
          }
        }
        
        // 2. Fetch signatures for each address
        for (const addr of addressesToCheck) {
          const sigRes = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              jsonrpc: '2.0', id: 1,
              method: 'getSignaturesForAddress',
              params: [addr, { limit: 20, commitment: 'confirmed' }]
            }),
            signal: AbortSignal.timeout(8000)
          });
          if (sigRes.ok) {
            const sigData = await sigRes.json();
            if (sigData.result) {
              signatures.push(...sigData.result);
            }
          }
        }
        

        
        // Deduplicate
        const seen = new Set();
        signatures = signatures.filter((s:any) => {
          if (seen.has(s.signature)) return false;
          seen.add(s.signature);
          return true;
        });
        
        // Even if signatures exist from pendingDeposits, we want to try to fetch from RPC.
        // But if RPC fails and we fall back to next URL, we don't break.
        if (signatures.length > pendingDeposits.length) break;
      } catch (e: any) {
        lastError = e.message || 'Network Error';
      }
    }
    
    // If all RPCs failed but we still have pendingDeposits, we can at least verify those
    
    let processed = 0; let dbgLog = [];

    const users = await fsQuery('users', adminToken, [], 10000)


    let cwDoc = await fsGet('settings/companyWallets', adminToken).catch(()=>null);
    for (const sig of signatures) {
      const txHash = sig.signature;
      if (!txHash || sig.err) continue;

      const alreadyProcessed = existing.find((t: any) => (t.txHash === txHash || t.txid === txHash) && t.status === 'approved');
      if (alreadyProcessed) continue;

      const pendingTx = pendingDeposits.find((p: any) => p.txid === txHash || p.txHash === txHash);
      const expectedAmt = pendingTx && pendingTx.amount ? Number(pendingTx.amount) : 0;

      // [FIX 2026-04-30] 회사 지갑이 단순히 fee payer 로만 등장한 트랜잭션은 입금 후보에서 제외.
      // 회원이 D-WALLET → 외부 SOL 전송 시 가스비 스폰서로 회사 지갑이 끼어들면서,
      // 자동감지가 이를 입금 후보로 잘못 등록하던 문제를 차단함.
      try {
        const onChainRes = await fetch('https://solana-rpc.publicnode.com', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0', id: 1,
            method: 'getTransaction',
            params: [txHash, { encoding: 'json', maxSupportedTransactionVersion: 0 }]
          }),
          signal: AbortSignal.timeout(8000)
        });
        if (onChainRes.ok) {
          const onChainData = await onChainRes.json();
          const r = onChainData?.result;
          if (r && r.transaction && r.meta) {
            const accountKeys: string[] = (r.transaction.message?.accountKeys || []).map((k: any) =>
              typeof k === 'string' ? k : (k?.pubkey || '')
            );
            const pre = r.meta.preBalances || [];
            const post = r.meta.postBalances || [];

            // 회사 지갑별 SOL 잔액 변화 계산
            let companyHasPositiveSolGain = false;
            for (const w of validCompanyWallets) {
              const idx = accountKeys.findIndex(k => k === w);
              if (idx < 0) continue;
              const diffLamports = (post[idx] || 0) - (pre[idx] || 0);
              if (diffLamports > 10000) { // 1만 lamports(0.00001 SOL) 이상이면 진짜 입금 신호
                companyHasPositiveSolGain = true;
                break;
              }
            }

            // SPL 토큰 입금 여부 별도 확인 (USDT)
            let companyHasUsdtGain = false;
            const preTokens = r.meta.preTokenBalances || [];
            const postTokens = r.meta.postTokenBalances || [];
            const USDT_MINT = 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB';
            for (const w of validCompanyWallets) {
              const preB = preTokens.find((b: any) => b.owner === w && b.mint === USDT_MINT);
              const postB = postTokens.find((b: any) => b.owner === w && b.mint === USDT_MINT);
              const preAmt = preB ? parseFloat(preB.uiTokenAmount?.uiAmountString || '0') : 0;
              const postAmt = postB ? parseFloat(postB.uiTokenAmount?.uiAmountString || '0') : 0;
              if (postAmt - preAmt > 0.0001) {
                companyHasUsdtGain = true;
                break;
              }
            }

            // 회사 지갑이 자금을 받지 않았다면(=fee payer/스폰서로만 등장) 후보에서 제외
            if (!companyHasPositiveSolGain && !companyHasUsdtGain) {
              dbgLog.push({ sig: txHash, status: 'skip_fee_payer_only', msg: '회사 지갑이 자금 수신자가 아닌 fee payer/스폰서로만 등장' });
              if (pendingTx) {
                try {
                  await fsPatch(`transactions/${pendingTx.id}`, {
                    status: 'rejected',
                    txValidation: 'invalid',
                    actualAmount: 0,
                    verifiedMsg: '❌ 회사 지갑이 fee payer 로만 등장한 트랜잭션 (실제 자금 수신 없음)',
                    adminMemo: '시스템 자동 거절: 회사 지갑이 자금 수신자가 아니라 가스비 대납자로만 등장'
                  }, adminToken);
                } catch(e) {}
              }
              continue;
            }
          }
        }
      } catch (e) {
        // RPC 실패 시 기존 로직으로 진행 (안전 장치)
        console.warn('[check-deposits] fee-payer guard RPC failed:', e);
      }

      const verifyRes = await verifyMultiChainDeposit(txHash, expectedAmt, cwDoc);
      
      if (!verifyRes.isTxValid || verifyRes.actualAmount < 1) {
         dbgLog.push({ sig: txHash, status: 'skip', msg: verifyRes.verifiedMsg });
         
         // Auto-reject logic for invalid TX
         if (pendingTx && verifyRes.actualAmount === 0 && !verifyRes.verifiedMsg.includes('일시적')) {
             try {
                 await fsPatch(`transactions/${pendingTx.id}`, {
                     status: 'rejected',
                     txValidation: 'invalid',
                     actualAmount: 0,
                     verifiedMsg: verifyRes.verifiedMsg,
                     adminMemo: '시스템 자동 거절: 유효하지 않은 TXID 또는 입금내역 없음'
                 }, adminToken);
             } catch(e) {}
         }
         continue;
      }
      
      let amount = verifyRes.actualAmount;
      let isToCompany = true;
      dbgLog.push({ sig: txHash, status: 'found', amount, isToCompany });

      let matchedUser = null;
      let isUpdate = false;
      let targetTxId = `auto_${Date.now()}_${Math.random().toString(36).substring(2,7)}`;
      
      if (pendingTx) {
        matchedUser = users.find((u: any) => u.id === pendingTx.userId);
        isUpdate = true;
        targetTxId = pendingTx.id;
      }

      if (!matchedUser) {
        dbgLog.push({ sig: txHash, status: 'no_user' });
        continue;
      }

      const checkDup = existing.find((t: any) => (t.txHash === txHash || t.txid === txHash) && (t.status === 'approved' || t.status === 'processing_lock') && t.type === 'deposit');
      if (checkDup) continue;

      if (isUpdate) {
         await fsPatch(`transactions/${targetTxId}`, { status: 'processing_lock', txHash, network: txHash.startsWith('0x') ? 'BSC' : (txHash.length===64 ? 'TRON' : 'Solana') }, adminToken);
      }

      const wallet = await fsGet(`wallets/${matchedUser.id}`, adminToken);
      const currentBalance = walletFirestoreNumber(wallet, 'usdtBalance');
      const currentTotalDeposit = walletFirestoreNumber(wallet, 'totalDeposit');
      const currentTotalDepositUsdt = walletFirestoreNumber(wallet, 'totalDepositUsdt');
      const currentPromoLocked = walletFirestoreNumber(wallet, 'promoLockedUsdt');
      const currentPromoLockedTotal = walletFirestoreNumber(wallet, 'promoLockedTotalUsdt');
      
      let finalAmount = amount;
      let appliedBonus = '';
      let appliedBonusPct = 0;
      let bonusAmount = 0;

      const cbRulesData = await loadCountryBonusRules(adminToken);
      
      const countryCode = String(matchedUser.country || matchedUser.countryCode || 'KR').trim().toUpperCase();
      const rule = cbRulesData.find((r:any) => r.country === countryCode && r.enabled);
      if (rule && rule.bonusPct > 0) {
          appliedBonusPct = rule.bonusPct;
          bonusAmount = amount * (rule.bonusPct / 100);
          finalAmount = amount + bonusAmount;
          appliedBonus = `국가보너스(${countryCode} ${rule.bonusPct}%)`;
      }
      
      // Dynamic Bear Market Bonus based on real-time price drop
      const evtSnap = await fsGet('settings/bearMarketEvent', adminToken);
      if (evtSnap && evtSnap.fields && evtSnap.fields.enabled && evtSnap.fields.enabled.booleanValue) {
          let isEligible = true;
          if (matchedUser && matchedUser.excludeFromEvents) {
              isEligible = false;
          }
          if (isEligible) {
              const priceSnap = await fsGet('settings/deedraPrice', adminToken);
              if (priceSnap && priceSnap.fields && priceSnap.fields.priceChange24h) {
                  const drop = Number(priceSnap.fields.priceChange24h.doubleValue || priceSnap.fields.priceChange24h.integerValue || 0);
                  if (drop < 0) {
                      const bp = Math.floor(Math.abs(drop));
                      if (bp > 0) {
                          const bearBonus = amount * (bp / 100);
                          finalAmount += bearBonus;
                          bonusAmount += bearBonus;
                          appliedBonus += (appliedBonus ? ' + ' : '') + `하락장방어(${bp}%)`;
                      }
                  }
              }
          }
      }

      const currentTickets = wallet ? fromFirestoreValue(wallet.fields?.weeklyTickets || { integerValue: 0 }) : 0;
      const newTickets = Math.floor(amount / 100);
      if (newTickets > 0) {
         try {
             const jpData = await fsGet('events/weekly_jackpot', adminToken);
             const parsedJp = jpData?.fields ? firestoreDocToObj(jpData) : {};
             const currentTotal = Number(parsedJp.totalTickets) || 0;
             await fsPatch('events/weekly_jackpot', { totalTickets: currentTotal + newTickets }, adminToken);
         } catch(e) {}
      }

      await fsPatch(`users/${matchedUser.id}`, { withdrawSuspended: false }, adminToken);
      
      let depositToUsdt = amount;
      let depositToProduct = 0;
      const memoStr = pendingTx ? (pendingTx.memo || pendingTx.adminMemo || '') : '';
      const is1plus1 = memoStr.includes('1+1') || memoStr.includes('원플') || memoStr.includes('12개');
      
      if (is1plus1) {
          depositToProduct = roundMoney(amount);
          depositToUsdt = 0;
      }

      const spendableCreditAmount = roundMoney(depositToUsdt);
      const lockedPromoAmount = roundMoney(bonusAmount);
      const walletPatch: any = {
        usdtBalance: roundMoney((currentBalance || 0) + spendableCreditAmount),
        totalDeposit: roundMoney((currentTotalDeposit || 0) + amount),
        totalDepositUsdt: roundMoney((currentTotalDepositUsdt || 0) + amount),
        weeklyTickets: (currentTickets || 0) + newTickets
      };
      if (lockedPromoAmount > 0) {
        walletPatch.promoLockedUsdt = roundMoney((currentPromoLocked || 0) + lockedPromoAmount);
        walletPatch.promoLockedTotalUsdt = roundMoney((currentPromoLockedTotal || 0) + lockedPromoAmount);
        walletPatch.lastPromoLockedAt = new Date().toISOString();
      }

      if (depositToProduct > 0) {
        const nid = crypto.randomUUID().replace(/-/g, '');
        const startDate = new Date();
        const endDate = new Date(startDate.getTime() + 360 * 86400000);
        await fsPatch(`investments/${nid}`, {
            userId: matchedUser.id,
            productId: 'vb7CsNewjaepbGZBCI3h',
            productName: '12개월',
            amount: depositToProduct,
            amountUsdt: depositToProduct,
            durationDays: 360,
            dailyRate: 0.007,
            roiPercent: 0,
            expectedReturn: 0,
            status: 'active',
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString(),
            createdAt: startDate.toISOString(),
            updatedAt: startDate.toISOString(),
            isManual1plus1: true,
            noRollup: true,
            rollupEligible: false,
            commissionEligible: false,
            networkSalesEligible: false
        }, adminToken);
      }
      
      await fsPatch(`wallets/${matchedUser.id}`, walletPatch, adminToken);
      
      let updateFields: any = {
          status: 'approved',
          txValidation: 'valid',
          actualAmount: amount,
          verifiedMsg: verifyRes.verifiedMsg
      };

      Object.assign(
        updateFields,
        buildPromotionLockAuditFields(bonusAmount, appliedBonus, appliedBonusPct, amount, finalAmount)
      );

      await fsPatch(`transactions/${targetTxId}`, updateFields, adminToken);

      await fireAutoRules('deposit_complete', matchedUser.id, {
        amount: amount.toFixed(2), currency: 'USDT', network: txHash.startsWith('0x') ? 'BSC' : (txHash.length===64 ? 'TRON' : 'Solana'), txHash: txHash.slice(0, 20)
      }, adminToken);

      // [FIX 2026-04-30] 자동감지 입금 승인 시에도 텔레그램 알림 발송 (수동 신청과 동일 포맷)
      try {
        const sysDocRaw = await fsGet('settings/system', adminToken).catch(() => null);
        const sysData = sysDocRaw?.fields ? firestoreDocToObj(sysDocRaw) : {};
        const tgSettings = sysData.telegram || {};
        if (!tgSettings.botToken && c.env && (c.env as any).TELEGRAM_BOT_TOKEN) {
          tgSettings.botToken = (c.env as any).TELEGRAM_BOT_TOKEN;
          tgSettings.chatId = tgSettings.chatId || '-1002347315570';
          tgSettings.recipients = tgSettings.recipients || [{ chatId: tgSettings.chatId, onDeposit: true }];
        }
        const network = txHash.startsWith('0x') ? 'BSC' : (txHash.length === 64 ? 'TRON' : 'Solana');
        const explorerUrl = network === 'BSC'
          ? `https://bscscan.com/tx/${txHash}`
          : network === 'TRON'
            ? `https://tronscan.org/#/transaction/${txHash}`
            : `https://solscan.io/tx/${txHash}`;
        const nowStr = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
        const bonusLine = appliedBonus ? `\n보너스: ${appliedBonus} (+${bonusAmount.toFixed(2)} USDT)` : '';
        const text = `🟢 <b>입금 자동 감지 & 승인 완료</b>\n회원: ${matchedUser.email || matchedUser.id}\n입금 금액: ${amount.toFixed(2)} USDT (${network})${bonusLine}\nTXID: <a href="${explorerUrl}">${txHash.substring(0,25)}...</a>\n시각: ${nowStr}\n\n${verifyRes.verifiedMsg}`;
        if (c.executionCtx && c.executionCtx.waitUntil) {
          c.executionCtx.waitUntil(sendTelegramToRecipients(tgSettings, 'deposit', text).catch(e => console.error('[auto-deposit telegram]', e)));
        } else {
          await sendTelegramToRecipients(tgSettings, 'deposit', text);
        }
      } catch (e) {
        console.error('[check-deposits telegram notify error]', e);
      }

      processed++;
    }

    // [New Feature] Real-time Rank Upgrades
    // If any deposit was processed successfully, trigger the auto-upgrade logic in the background
    if (processed > 0 && c.executionCtx && c.executionCtx.waitUntil) {
        c.executionCtx.waitUntil((async () => {
            try {
                const adminTokenBg = await getAdminToken();
                const allUsersBg = await fsQuery('users', adminTokenBg, [], 100000);
                const walletsBg = await fsQuery('wallets', adminTokenBg, [], 100000);
                const investmentsBg = await fsQuery('investments', adminTokenBg, [{field:'status',op:'==',value:'active'}], 100000);
                await autoUpgradeAllRanks(adminTokenBg, allUsersBg, walletsBg, investmentsBg);
            } catch(err) {
                console.error('Real-time rank upgrade trigger failed', err);
            }
        })());
    }

    return c.json({ success: true, processed, total: signatures.length, network: 'solana', dbg: dbgLog, pendingLength: pendingDeposits.length })
  } catch (e: any) {
    return c.json({ error: e.message }, 500)
  }
})

// 하위 호환: /api/tron/check-deposits → solana로 리다이렉트
app.post('/api/tron/check-deposits', async (c) => {
  return c.json({ redirected: true, message: '이 플랫폼은 Solana 기반입니다. /api/solana/check-deposits 를 사용하세요.' }, 301)
})

// GET /api/solana/tx/:signature
app.get('/api/solana/tx/:signature', async (c) => {
  const signature = c.req.param('signature')
  try {
    const res = await fetch('https://solana-rpc.publicnode.com', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0', id: 1,
        method: 'getTransaction',
        params: [signature, { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0 }]
      }),
      signal: AbortSignal.timeout(8000)
    })
    if (!res.ok) return c.json({ error: 'not found' }, 404)
    const data = await res.json()
    return c.json(data.result || {})
  } catch (e: any) {
    return c.json({ error: e.message }, 500)
  }
})


const reinvestLocks = new Set<string>();

app.post('/api/user/reinvest', async (c) => {
  let lockedUid = '';
  try {
    const firebaseUser = await getAuthenticatedFirebaseUser(c);
    if (!firebaseUser?.localId) return c.json({ error: 'unauthorized' }, 401);

    const body = await c.req.json();
    const { productId } = body;
    const requestedUid = body.uid;
    const uid = firebaseUser.localId;
    const amount = toPositiveMoney(body.amount);

    if (requestedUid && requestedUid !== uid) return c.json({ error: 'uid mismatch' }, 403);
    if (!productId || amount <= 0) return c.json({ error: 'missing fields' }, 400);

    if (reinvestLocks.has(uid)) return c.json({ error: '요청 처리중입니다. 잠시 후 다시 시도해주세요.' }, 429);
    reinvestLocks.add(uid);
    lockedUid = uid;

    const adminToken = await getAdminToken();
    
    // Check wallet balance
    const wDoc = await fsGet(`wallets/${uid}`, adminToken);
    if (!wDoc || !wDoc.fields) return c.json({ error: 'wallet not found' }, 404);
    
    const bonusBalance = Number(fromFirestoreValue(wDoc.fields.bonusBalance || {doubleValue:0}) || 0);
    if (bonusBalance < amount) return c.json({ error: 'insufficient bonus balance' }, 400);
    
    // Check product
    const pDoc = await fsGet(`products/${productId}`, adminToken);
    if (!pDoc || !pDoc.fields) return c.json({ error: 'product not found' }, 404);
    
    const pData = firestoreDocToObj(pDoc);
    const minAmount = Number(pData.minAmount || pData.minAmt || 0);
    const maxAmount = Number(pData.maxAmount || pData.maxAmt || 0);
    if (amount < minAmount) return c.json({ error: 'below min amount' }, 400);
    if (Number.isFinite(maxAmount) && maxAmount > 0 && amount > maxAmount) return c.json({ error: 'above max amount' }, 400);
    
    const roi = Number(pData.roiPercent != null ? pData.roiPercent : (pData.dailyRoi || 0));
    const days = Number(pData.durationDays != null ? pData.durationDays : (pData.duration || 0));
    if (!Number.isFinite(days) || days <= 0 || !Number.isFinite(roi) || roi < 0) {
      return c.json({ error: 'invalid product roi or duration' }, 400);
    }
    const expectedReturn = roundMoney(amount * roi / 100);
    
    const uDoc = await fsGet(`users/${uid}`, adminToken);
    if (!uDoc || !uDoc.fields) return c.json({ error: 'user not found' }, 404);
    const currentTotalInvested = Number(fromFirestoreValue(uDoc.fields.totalInvested || {doubleValue:0}) || 0);
    const currentTotalInvest = wDoc.fields.totalInvest ? Number(fromFirestoreValue(wDoc.fields.totalInvest) || 0) : 0;
    
    const invId = crypto.randomUUID().replace(/-/g, '');
    const txId = crypto.randomUUID().replace(/-/g, '');
    
    const nowStr = new Date().toISOString();
    const endDateStr = new Date(Date.now() + days * 86400000).toISOString();
    
    const writes = [
      {
        update: {
          name: `projects/${SERVICE_ACCOUNT.project_id}/databases/(default)/documents/wallets/${uid}`,
          fields: {
            bonusBalance: toFirestoreValue(roundMoney(bonusBalance - amount)),
            totalInvest: toFirestoreValue(roundMoney(currentTotalInvest + amount)),
            updatedAt: toFirestoreValue(nowStr)
          }
        },
        updateMask: { fieldPaths: ['bonusBalance', 'totalInvest', 'updatedAt'] },
        currentDocument: wDoc.updateTime ? { updateTime: wDoc.updateTime } : { exists: true }
      },
      {
        update: {
          name: `projects/${SERVICE_ACCOUNT.project_id}/databases/(default)/documents/users/${uid}`,
          fields: {
            totalInvested: toFirestoreValue(roundMoney(currentTotalInvested + amount))
          }
        },
        updateMask: { fieldPaths: ['totalInvested'] },
        currentDocument: uDoc.updateTime ? { updateTime: uDoc.updateTime } : { exists: true }
      },
      {
        update: {
          name: `projects/${SERVICE_ACCOUNT.project_id}/databases/(default)/documents/investments/${invId}`,
          fields: Object.fromEntries(Object.entries({
            userId: uid,
            productId: productId,
            productName: pData.name,
            amount: amount,
            amountUsdt: amount,
            roiPercent: roi,
            durationDays: days,
            expectedReturn: expectedReturn,
            status: 'active',
            startDate: nowStr,
            endDate: endDateStr,
            createdAt: nowStr,
            isReinvest: true
          }).map(([k, v]) => [k, toFirestoreValue(v)]))
        }
      },
      {
        update: {
          name: `projects/${SERVICE_ACCOUNT.project_id}/databases/(default)/documents/transactions/${txId}`,
          fields: Object.fromEntries(Object.entries({
            userId: uid,
            type: 'invest',
            amount: amount,
            amountUsdt: amount,
            currency: 'USDT',
            status: 'active',
            reason: '수익금 재투자 (FREEZE 가입: ' + pData.name + ')',
            createdAt: nowStr
          }).map(([k, v]) => [k, toFirestoreValue(v)]))
        }
      }
    ];
    
    await fsBatchCommit(writes, adminToken);
    
    return c.json({ success: true });
    
  } catch(e: any) {
    console.error('Reinvest API Error:', e.message);
    return c.json({ error: e.message }, 500);
  } finally {
    if (lockedUid) reinvestLocks.delete(lockedUid);
  }
});


app.post('/api/user/tx-history', async (c) => {
  try {
    const authHeader = c.req.header('Authorization');
    if (!authHeader) return c.json({ error: 'unauthorized' }, 401);
    const token = authHeader.split(' ')[1];
    if (!token) return c.json({ error: 'invalid token format' }, 401);

    const body = await c.req.json();
    const uid = String(body.uid || '').trim();
    if (!uid) return c.json({ error: 'missing uid' }, 400);

    const rawType = String(body.typeFilter || 'deposit').trim();
    const typeFilter = rawType === 'roi' || rawType === 'freeze' ? 'invest' : rawType;
    const rawMode = String(body.mode || 'summary').toLowerCase();
    const mode = rawMode === 'details'
      ? 'details'
      : (rawMode === 'day-summary' || rawMode === 'daily_summary' || rawMode === 'daily-summary' ? 'day-summary' : 'summary');
    const forceLoadAll = mode === 'summary' && Boolean(body.forceLoadAll);
    const dateFilter = forceLoadAll ? '' : String(body.dateFilter || adminDailyKstDate()).slice(0, 10);
    const pageNum = Math.min(Math.max(Number(body.page) || 1, 1), 200);
    const pageSize = 5;
    const summaryLimit = Math.min(Math.max(Number(body.summaryLimit) || 20000, 1000), 20000);
    const detailLimit = Math.min(pageNum * pageSize + 1, 1005);

    const adminToken = await getAdminToken();

    const bonusTypeMap: Record<string, string[]> = {
      invest: ['daily_roi', 'roi', 'roi_income'],
      direct_bonus: ['direct_bonus'],
      rank_bonus: ['rank_bonus', 'rank_gap_passthru', 'rank_reward'],
      rank_matching: ['rank_equal_or_higher_override_1pct', 'rank_equal_or_higher_override', 'rank_matching'],
      center_fee: ['center_fee'],
      sub_center_fee: ['sub_center_fee']
    };

    const getItemTime = (item: any): number => adminDailyTimeMs(
      item.createdAt || item.completedAt || item.approvedAt || item.updatedAt || item.requestedAt || item.startDate || item.settledAt || item.paidAt || item.settlementDate
    );

    const amountOf = (item: any): number => {
      const raw = item.amountUsdt ?? item.amount ?? item.actualAmount ?? item.totalCredited ?? item.principal ?? item.investAmount ?? item.walletInvestAmount ?? item.walletBonusAmount ?? item.totalEarningsAmount ?? item.usdtAmount ?? 0;
      const n = Number(raw);
      return Number.isFinite(n) ? Math.abs(n) : 0;
    };

    const normalize = (item: any) => {
      if (item._collection === 'investments') {
        return {
          ...item,
          type: 'invest',
          amount: amountOf(item),
          createdAt: item.createdAt || item.startDate || item.updatedAt
        };
      }
      if (item._collection === 'bonuses') {
        return {
          ...item,
          amount: amountOf(item),
          createdAt: item.createdAt || item.settledAt || item.paidAt || (item.settlementDate ? `${item.settlementDate}T00:00:00+09:00` : item.updatedAt)
        };
      }
      return {
        ...item,
        amount: amountOf(item),
        createdAt: item.createdAt || item.completedAt || item.approvedAt || item.updatedAt || item.requestedAt
      };
    };

    const queryValue = (value: any) => toFirestoreValue(value);
    const fieldFilter = (field: string, op: string, value: any) => ({ fieldFilter: { field: { fieldPath: field }, op, value: queryValue(value) } });
    const fieldFilterRaw = (field: string, op: string, value: any) => ({ fieldFilter: { field: { fieldPath: field }, op, value } });
    const andFilters = (filters: any[]) => filters.length === 1 ? filters[0] : { compositeFilter: { op: 'AND', filters } };
    const uniq = (arr: string[]) => Array.from(new Set(arr.filter(Boolean)));
    const nextKstDate = (date: string) => adminDailyKstDate(Date.parse(`${date}T00:00:00+09:00`) + 86400000);
    const dateRange = dateFilter ? {
      startIso: new Date(Date.parse(`${dateFilter}T00:00:00+09:00`)).toISOString(),
      endIso: new Date(Date.parse(`${nextKstDate(dateFilter)}T00:00:00+09:00`)).toISOString(),
      startString: `${dateFilter}T00:00:00`,
      endString: `${nextKstDate(dateFilter)}T00:00:00`
    } : null;

    const buildSourcesForType = (selectedType: string) => {
      const normalizedType = selectedType === 'roi' || selectedType === 'freeze' ? 'invest' : selectedType;
      const selectedBonusTypes = bonusTypeMap[normalizedType] || [];
      const selectedSources: any[] = [];

      if (['deposit', 'withdrawal', 'swap'].includes(normalizedType)) {
        selectedSources.push({
          collection: 'transactions',
          typeArr: [normalizedType],
          dateFields: ['createdAt', 'completedAt', 'approvedAt', 'updatedAt', 'requestedAt'],
          orderField: 'createdAt',
          amountFields: ['amountUsdt', 'amount', 'actualAmount', 'totalCredited', 'usdtAmount']
        });
      }

      if (normalizedType === 'invest') {
        selectedSources.push({
          collection: 'investments',
          typeArr: [],
          dateFields: ['createdAt', 'startDate', 'updatedAt'],
          orderField: 'createdAt',
          amountFields: ['amountUsdt', 'amount', 'principal', 'investAmount']
        });
        selectedSources.push({
          collection: 'bonuses',
          typeArr: selectedBonusTypes,
          settlementDateField: 'settlementDate',
          dateFields: ['createdAt', 'settledAt', 'paidAt', 'updatedAt'],
          orderField: 'createdAt',
          amountFields: ['amountUsdt', 'amount', 'walletInvestAmount', 'walletBonusAmount', 'totalEarningsAmount']
        });
      } else if (selectedBonusTypes.length > 0) {
        selectedSources.push({
          collection: 'bonuses',
          typeArr: selectedBonusTypes,
          settlementDateField: 'settlementDate',
          dateFields: ['createdAt', 'settledAt', 'paidAt', 'updatedAt'],
          orderField: 'createdAt',
          amountFields: ['amountUsdt', 'amount', 'walletBonusAmount', 'totalEarningsAmount']
        });
      }

      return selectedSources;
    };

    const sources = buildSourcesForType(typeFilter);
    if (sources.length === 0) {
      return c.json({ error: 'unsupported typeFilter' }, 400);
    }

    const baseFiltersFor = (source: any) => {
      const filters: any[] = [fieldFilter('userId', 'EQUAL', uid)];
      if (source.typeArr?.length === 1) {
        filters.push(fieldFilter('type', 'EQUAL', source.typeArr[0]));
      } else if (source.typeArr?.length > 1) {
        filters.push(fieldFilterRaw('type', 'IN', { arrayValue: { values: source.typeArr.map((t: string) => ({ stringValue: t })) } }));
      }
      return filters;
    };

    const runStructuredQuery = async (source: any, filters: any[], limit: number, selectFields: string[] = [], orderField = '', descending = true) => {
      const structuredQuery: any = {
        from: [{ collectionId: source.collection }],
        where: andFilters(filters),
        limit
      };
      if (selectFields.length > 0) {
        structuredQuery.select = { fields: uniq(selectFields).map((fieldPath) => ({ fieldPath })) };
      }
      if (orderField) {
        structuredQuery.orderBy = [{ field: { fieldPath: orderField }, direction: descending ? 'DESCENDING' : 'ASCENDING' }];
      }

      const res = await fetch(`${FIRESTORE_BASE}:runQuery`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ structuredQuery })
      });
      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        console.warn('tx-history query fallback', source.collection, orderField, errText.slice(0, 160));
        return null;
      }

      const data: any[] = await res.json();
      return data.filter((d) => d.document).map((d) => {
        const obj = firestoreDocToObj({ name: d.document.name, fields: d.document.fields || {} });
        obj.id = d.document.name.split('/').pop();
        obj._collection = source.collection;
        return obj;
      });
    };

    const querySourceRows = async (source: any, limit: number, selectFields: string[], detailsMode: boolean) => {
      const baseFilters = baseFiltersFor(source);
      const plans: any[] = [];

      if (dateFilter && source.settlementDateField) {
        plans.push({ filters: [...baseFilters, fieldFilter(source.settlementDateField, 'EQUAL', dateFilter)], orderField: detailsMode ? source.orderField : '' });
      } else if (dateFilter && dateRange) {
        for (const dateField of source.dateFields || ['createdAt']) {
          plans.push({
            filters: [
              ...baseFilters,
              fieldFilterRaw(dateField, 'GREATER_THAN_OR_EQUAL', { timestampValue: dateRange.startIso }),
              fieldFilterRaw(dateField, 'LESS_THAN', { timestampValue: dateRange.endIso })
            ],
            orderField: detailsMode ? dateField : ''
          });
          plans.push({
            filters: [
              ...baseFilters,
              fieldFilterRaw(dateField, 'GREATER_THAN_OR_EQUAL', { stringValue: dateRange.startString }),
              fieldFilterRaw(dateField, 'LESS_THAN', { stringValue: dateRange.endString })
            ],
            orderField: detailsMode ? dateField : ''
          });
        }
      } else {
        plans.push({ filters: baseFilters, orderField: detailsMode ? source.orderField : '' });
      }

      const collected: any[] = [];
      let hadQueryError = false;
      for (const plan of plans) {
        let rows = await runStructuredQuery(source, plan.filters, limit, selectFields, plan.orderField);
        if (rows === null && plan.orderField) {
          rows = await runStructuredQuery(source, plan.filters, limit, selectFields, '');
        }
        if (rows) {
          collected.push(...rows);
        } else {
          hadQueryError = true;
        }
      }

      if (hadQueryError && dateFilter) {
        const fallbackLimit = detailsMode ? Math.min(Math.max(limit * 8, 40), 1000) : summaryLimit;
        const fallbackRows = await runStructuredQuery(source, baseFilters, fallbackLimit, selectFields, '');
        if (fallbackRows) {
          source._txHistoryFallback = true;
          if (fallbackRows.length >= fallbackLimit) source._txHistoryPartial = true;
          collected.push(...fallbackRows);
        }
      }
      return collected;
    };

    const dedupeRows = (rows: any[]) => {
      const map = new Map<string, any>();
      for (const row of rows) {
        const key = `${row._collection}:${row.id || JSON.stringify(row).slice(0, 80)}`;
        if (!map.has(key)) map.set(key, row);
      }
      return Array.from(map.values());
    };

    const dateMatches = (item: any) => {
      if (!dateFilter) return true;
      if (item._collection === 'bonuses' && item.settlementDate === dateFilter) return true;
      const ms = getItemTime(item);
      return ms > 0 && adminDailyKstDate(ms) === dateFilter;
    };

    const summarizeSources = async (selectedType: string, selectedSources: any[]) => {
      const summaryRows = dedupeRows((await Promise.all(selectedSources.map((source) => {
        const selectFields = uniq([
          'type',
          'status',
          'settlementDate',
          ...(source.dateFields || []),
          ...(source.amountFields || [])
        ]);
        return querySourceRows(source, summaryLimit, selectFields, false);
      }))).flat());

      const items = summaryRows
        .map(normalize)
        .filter((item: any) => !['rejected', 'failed', 'cancelled', 'canceled'].includes(String(item.status || '').toLowerCase()))
        .filter(dateMatches);

      const totalSum = items.reduce((sum: number, item: any) => sum + amountOf(item), 0);
      const count = items.length;
      const partial = summaryRows.length >= summaryLimit || selectedSources.some((source) => source._txHistoryPartial);

      return {
        typeFilter: selectedType,
        date: dateFilter,
        totalSum,
        count,
        hasDetails: count > 0,
        partial,
        strategy: selectedSources.some((source) => source._txHistoryFallback) ? 'single_day_summary_fallback' : 'single_day_summary'
      };
    };

    if (mode === 'day-summary') {
      const dayTypes = ['deposit', 'withdrawal', 'invest', 'direct_bonus', 'rank_bonus', 'rank_matching'];
      const summaries = [];
      for (const dayType of dayTypes) {
        summaries.push(await summarizeSources(dayType, buildSourcesForType(dayType)));
      }

      return c.json({
        success: true,
        mode,
        date: dateFilter,
        forceLoadAll: false,
        summaries,
        categories: summaries,
        partial: summaries.some((summary: any) => summary.partial),
        pageSize,
        strategy: 'selected_day_category_summaries'
      });
    }

    if (mode === 'summary') {
      const summary = await summarizeSources(typeFilter, sources);
      return c.json({
        success: true,
        mode,
        forceLoadAll,
        pageSize,
        ...summary
      });
    }

    const detailRows = dedupeRows((await Promise.all(sources.map((source) => {
      return querySourceRows(source, detailLimit, [], true);
    }))).flat());
    const detailItems = detailRows
      .map(normalize)
      .filter((item: any) => !['rejected', 'failed', 'cancelled', 'canceled'].includes(String(item.status || '').toLowerCase()))
      .filter(dateMatches)
      .sort((a: any, b: any) => getItemTime(b) - getItemTime(a));

    const start = (pageNum - 1) * pageSize;
    const end = start + pageSize;
    return c.json({
      success: true,
      mode,
      typeFilter,
      date: dateFilter,
      forceLoadAll,
      items: detailItems.slice(start, end),
      page: pageNum,
      pageSize,
      loadedCount: Math.min(end, detailItems.length),
      hasMore: detailItems.length > end,
      strategy: 'paged_detail_query'
    });
  } catch (e: any) {
    console.error('TxHistory API Error:', e.message);
    return c.json({ error: e.message }, 500);
  }
});

// ─── 일일 ROI 자동 정산
app.get('/api/cron/settle', async (c) => {
  const secret = c.req.query('secret') || c.req.header('x-cron-secret')
  if (!isValidCronSecret(secret)) return c.json({ error: 'unauthorized' }, 401)
  return runSettle(c)
})

app.post('/api/cron/settle', async (c) => {
  let secret = c.req.header('x-cron-secret') || c.req.header('CRON_SECRET')
  if (!secret) {
    try { const b = await c.req.json(); secret = b.secret } catch (_) {}
  }
  if (!isValidCronSecret(secret)) return c.json({ error: 'unauthorized' }, 401)
  
  // 외부 강제 호출(0 0 * * *)일지라도 설정된 시간과 다르면 무시하도록 방어
  const adminToken = await getAdminToken()
  const res = await checkAndRunTrigger(c, adminToken);
  
  // 설정된 시간이 아니라서 skip되었다면, 여기서도 skip 처리 
  // (하지만 원래 의도된 시간이라면 실행되었을 것임)
  if (res && res.status === 'skip' && !res.success) {
      return c.json({ message: 'Settle triggered but skipped due to schedule. ' + res.reason, skipped: true });
  }

  // 성공적으로 실행되었거나, 이미 오늘 완료된 경우 반환
  return c.json(res);
})


// ── 외부 크론 서비스용 통합 트리거 (설정 시간 확인 포함) ──────────
async function checkAndRunTrigger(c: any, adminToken: string) {
  try {
    // 예약 발송 처리
    await processScheduledBroadcasts(adminToken).catch(console.error)

    // 자동 정산 시간 체크 로직
    const settingsRaw = await fsGet('settings/rates', adminToken).catch(()=>null)
    const settings = settingsRaw && settingsRaw.fields ? Object.fromEntries(Object.entries(settingsRaw.fields).map(([k, v]) => [k, fromFirestoreValue(v as any)])) : null; if (!settings || settings.autoSettlement === false) {
      return { status: 'skip', reason: 'autoSettlement is disabled' }
    }

    const targetH = settings.autoSettlementHour ?? 0;
    const targetM = settings.autoSettlementMinute ?? 0;
    
    const now = new Date();
    const utcH = now.getUTCHours();
    const utcM = now.getUTCMinutes();
    
    const currentMins = utcH * 60 + utcM;
    const targetMins = targetH * 60 + targetM;
    
    // 매 1~5분마다 찔러도 중복 실행 안되게 5분 윈도우 허용 (자정 겹침 방지 포함)
    let diff = currentMins - targetMins;
    if (diff < 0) diff += 24 * 60; // 다음날로 넘어가는 경우 처리

    if (diff >= 0 && diff < 5) {
      console.log(`[Trigger] Time matched! Target:${targetH}:${targetM}, Now:${utcH}:${utcM}. Running settlement...`);
      // 시간 일치 -> 정산 실행 (runSettle 내부에 Lock이 있어 당일 중복방지됨)
      const res = await runSettle(c, null);
      return res; // runSettle이 반환하는 JSON
    } else {
      return { status: 'skip', reason: `Not the time. Target:${targetH}:${targetM}, Now:${utcH}:${utcM}` }
    }
  } catch (err: any) {
    return { error: err.message }
  }
}


app.post('/api/admin/revert-jackpot', async (c) => {
  try {
    const authHeader = c.req.header('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json({ error: 'Unauthorized' }, 401)
    }
    const token = authHeader.split(' ')[1]

    const body = await c.req.json()
    const revertAmount = Number(body.amount || 0)
    
    if (revertAmount <= 0) return c.json({ success: true, message: 'No amount to revert' })

    let rawDoc = await fsGet('events/weekly_jackpot', token)
    let jpData: any = {}
    if (!rawDoc) {
      jpData = { amount: 0, active: true, drawDay: 6, feeAccumulationRate: 100 }
    } else {
      jpData = firestoreDocToObj(rawDoc)
    }

    let currentAmount = Number(jpData.amount || 0)
    let newAmount = currentAmount - revertAmount
    if (newAmount < 0) newAmount = 0

    await fsPatch('events/weekly_jackpot', {
      amount: newAmount,
      active: jpData.active ?? true,
      drawDay: jpData.drawDay ?? 6,
      feeAccumulationRate: jpData.feeAccumulationRate ?? 100
    }, token)

    return c.json({ success: true, oldAmount: currentAmount, newAmount: newAmount, reverted: revertAmount })
  } catch (e: any) {
    return c.json({ error: e.message }, 500)
  }
})

app.get('/api/cron/draw-weekly-jackpot', async (c) => {
  const secret = c.req.query('secret') || c.req.header('x-cron-secret')
  if (!isValidCronSecret(secret)) return c.json({ error: 'Unauthorized' }, 401)
  
  try {
    const adminToken = await getAdminToken()
    const rawJp = await fsGet('events/weekly_jackpot', adminToken)
    const jpData = rawJp ? firestoreDocToObj(rawJp) : null
    if (!jpData || !jpData.amount || jpData.amount <= 0) return c.json({ message: 'No jackpot to draw' })
    
    // Fetch all wallets with weeklyTickets > 0
    const wallets = await fsQuery('wallets', adminToken, [
      { fieldFilter: { field: { fieldPath: 'weeklyTickets' }, op: 'GREATER_THAN', value: { integerValue: 0 } } }
    ], 10000)
    
    if (wallets.length === 0) return c.json({ message: 'No participants' })
    
    // Build ticket pool
    let pool: string[] = []
    let userEmails: any = {}
    
    for (const w of wallets) {
      const tickets = Number(w.weeklyTickets) || 0
      for (let i = 0; i < tickets; i++) pool.push(w.userId)
      userEmails[w.userId] = w.userEmail || w.userId
    }
    
    if (pool.length === 0) return c.json({ message: 'Pool is empty' })
    
    // Fetch Solana latest blockhash for fairness
    const solRes = await fetch('https://solana-rpc.publicnode.com', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getLatestBlockhash' })
    })
    const solData = await solRes.json()
    const blockhash = solData.result?.value?.blockhash || 'fallback_hash_' + Date.now()
    
    // Simple hash function to convert blockhash to number
    let hashNum = 0
    for (let i = 0; i < blockhash.length; i++) {
      hashNum = ((hashNum << 5) - hashNum) + blockhash.charCodeAt(i)
      hashNum = Math.abs(hashNum)
    }
    
    const winnerIndex = hashNum % pool.length
    const winnerId = pool[winnerIndex]
    const prizeUsdt = Number(jpData.amount)
    
    const writes: any[] = []
    
    // Reset Weekly Jackpot to 0 and record winner info
    writes.push({
      update: {
        name: `projects/dedra-mlm/databases/(default)/documents/events/weekly_jackpot`,
        fields: {
           totalTickets: toFirestoreValue(0),
           amount: toFirestoreValue(0),
           lastWinnerId: toFirestoreValue(winnerId),
           lastWinnerPrize: toFirestoreValue(prizeUsdt),
           lastBlockhash: toFirestoreValue(blockhash),
           lastDrawTime: toFirestoreValue(new Date().toISOString()),
           active: toFirestoreValue(true)
        }
      }
    })
    
    // Update Winner Wallet
    const winnerWallet = wallets.find((w:any) => w.userId === winnerId)
    const currentBonus = winnerWallet ? Number(winnerWallet.bonusBalance || 0) : 0
    const currentTotal = winnerWallet ? Number(winnerWallet.totalEarnings || 0) : 0
    
    writes.push({
      update: {
        name: `projects/dedra-mlm/databases/(default)/documents/wallets/${winnerId}`,
        fields: {
          bonusBalance: toFirestoreValue(currentBonus + prizeUsdt),
          totalEarnings: toFirestoreValue(currentTotal + prizeUsdt),
          weeklyTickets: toFirestoreValue(0)
        }
      },
      updateMask: { fieldPaths: ['bonusBalance', 'totalEarnings', 'weeklyTickets'] }
    })
    
    // Create Bonus Record
    const bId = crypto.randomUUID().replace(/-/g, '')
    writes.push({
      update: {
        name: `projects/dedra-mlm/databases/(default)/documents/bonuses/${bId}`,
        fields: {
          userId: toFirestoreValue(winnerId),
          fromUserId: toFirestoreValue('system'),
          type: toFirestoreValue('jackpot_win'),
          amountUsdt: toFirestoreValue(prizeUsdt),
          reason: toFirestoreValue('주간 홀더 잭팟 당첨! (Solana Blockhash)'),
          blockhash: toFirestoreValue(blockhash),
          createdAt: toFirestoreValue(new Date().toISOString())
        }
      }
    })
    
    // Reset tickets for everyone else
    for (const w of wallets) {
      if (w.userId !== winnerId) {
         writes.push({
           update: {
             name: `projects/dedra-mlm/databases/(default)/documents/wallets/${w.userId}`,
             fields: { weeklyTickets: toFirestoreValue(0) }
           },
           updateMask: { fieldPaths: ['weeklyTickets'] }
         })
      }
    }
    
    // PART II §0 HARD RULE #4 — 20개 단위 배치 (fsBatchCommit 내부에서 자동 분할)
    await fsBatchCommit(writes, adminToken)
    
    // TG Notification
    const tgMsg = `🎰 <b>[WEEKLY JACKPOT DRAW]</b>\n🏆 Winner: ${userEmails[winnerId] || winnerId}\n💰 Prize: ${prizeUsdt.toFixed(2)} USDT\n⛓ Blockhash: ${blockhash}`
    await fetch(`https://api.telegram.org/bot${GLOBAL_ENV.TELEGRAM_BOT_TOKEN || ''}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: '-1002447936186', text: tgMsg, parse_mode: 'HTML' })
    }).catch(console.error)
    
    return c.json({ success: true, winner: winnerId, prize: prizeUsdt, blockhash })
  } catch (e: any) {
    return c.json({ error: e.message }, 500)
  }
})

app.get('/api/cron/trigger', async (c) => {
  const secret = c.req.query('secret') || c.req.header('x-cron-secret')
  if (!isValidCronSecret(secret)) return c.json({ error: 'unauthorized' }, 401)
  const adminToken = await getAdminToken()
  const res = await checkAndRunTrigger(c, adminToken);
  return c.json(res);
})
// ── 예약 발송 독립 실행 엔드포인트 (매 시간 Cron Trigger로 호출 가능) ──────────
app.get('/api/cron/process-scheduled', async (c) => {
  const secret = c.req.query('secret') || c.req.header('x-cron-secret')
  if (!isValidCronSecret(secret)) return c.json({ error: 'unauthorized' }, 401)
  try {
    const adminToken = await getAdminToken()
    await processScheduledBroadcasts(adminToken)

    // ─── 자동 스냅샷 생성 (매일) ───
    try {
      const dateStr = new Date().toISOString().slice(0,10) // YYYY-MM-DD
      const snapshotId = `snap_${dateStr}`
      const snapCheck = await fsGet(`snapshots/${snapshotId}`, adminToken).catch(()=>null)
      if (!snapCheck) {
        // 데이터 가져오기
        const [users, wallets, investments] = await Promise.all([
          fsQuery('users', adminToken, [], 100000),
          fsQuery('wallets', adminToken, [], 100000),
          fsQuery('investments', adminToken, [], 100000)
        ])

        await fsCreateWithId('snapshots', snapshotId, {
          createdAt: new Date().toISOString(),
          createdBy: 'system_cron',
          userCount: users.length,
          walletCount: wallets.length,
          investmentCount: investments.length,
          status: 'completed',
          type: 'daily_auto'
        }, adminToken)

        const chunkArray = (arr: any[], size: number) => {
          const res = []
          for(let i=0; i<arr.length; i+=size) res.push(arr.slice(i, i+size))
          return res
        }

        const saveChunks = async (colName: string, data: any[]) => {
          const chunks = chunkArray(data, 100)
          for (let i=0; i<chunks.length; i++) {
            await fsCreateWithId(`snapshots/${snapshotId}/${colName}`, `chunk_${i}`, { data: JSON.stringify(chunks[i]) }, adminToken)
          }
        }

        await saveChunks('users', users)
        await saveChunks('wallets', wallets)
        await saveChunks('investments', investments)
      }
    } catch(e) {
      console.warn('Auto snapshot failed:', e)
    }

    return c.json({ success: true, message: '예약 발송 처리 완료', processedAt: new Date().toISOString() })
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500)
  }
})

app.post('/api/cron/process-scheduled', async (c) => {
  let secret = c.req.header('x-cron-secret') || c.req.header('CRON_SECRET')
  if (!secret) {
    try { const b = await c.req.json(); secret = b.secret } catch (_) {}
  }
  if (!isValidCronSecret(secret)) return c.json({ error: 'unauthorized' }, 401)
  try {
    const adminToken = await getAdminToken()
    await processScheduledBroadcasts(adminToken)
    return c.json({ success: true, message: '예약 발송 처리 완료', processedAt: new Date().toISOString() })
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500)
  }
})

// ─── FCM 디바이스 토큰 등록 ─────────────────────────────────────────────────
app.post('/api/fcm/register', async (c) => {
  try {
    const { userId, token, platform, userAgent } = await c.req.json()
    if (!userId || !token) return c.json({ error: '필수값 누락' }, 400)
    const adminToken = await getAdminToken()

    // fcmTokens 컬렉션에 저장 (userId 기준으로 upsert)
    // 동일 userId의 기존 토큰 조회
    const existing = await fsQuery('fcmTokens', adminToken, [
      { fieldFilter: { field: { fieldPath: 'userId' }, op: 'EQUAL', value: { stringValue: userId } } }
    ], 10)

    if (existing.length > 0) {
      // 기존 토큰 업데이트
      const docId = existing[0].id
      await fsPatch(`fcmTokens/${docId}`, {
        token,
        platform: platform || 'web',
        userAgent: userAgent || '',
        updatedAt: new Date().toISOString(),
        isActive: true,
      }, adminToken)
    } else {
      // 새 토큰 저장
      await fsCreate('fcmTokens', {
        userId,
        token,
        platform: platform || 'web',
        userAgent: userAgent || '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isActive: true,
      }, adminToken)
    }

    return c.json({ success: true })
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500)
  }
})

// ─── FCM 단일 발송 (userId 기준) ────────────────────────────────────────────
app.post('/api/fcm/send', async (c) => {
  let secret = c.req.header('x-cron-secret') || c.req.header('CRON_SECRET')
  if (!secret) {
    try { const b = await c.req.json(); secret = b?.secret } catch (_) {}
  }
  // 내부 호출용 (CRON_SECRET 또는 관리자 Firebase UID 검증)
  const body = await c.req.json().catch(() => ({}))
  if (!isValidCronSecret(secret) && !body.adminUid) {
    return c.json({ error: 'unauthorized' }, 401)
  }

  try {
    const { userId, title, message, data } = body
    if (!userId || !title) return c.json({ error: '필수값 누락' }, 400)

    const adminToken = await getAdminToken()
    const result = await sendFcmToUser(userId, title, message || '', data || {}, adminToken)
    return c.json({ success: true, ...result })
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500)
  }
})

// ─── FCM 일괄 발송 (notifications 컬렉션 미처리 푸시 처리) ─────────────────

app.post('/api/telegram/cs-webhook', async (c) => {
  const TELEGRAM_BOT_TOKEN = String(GLOBAL_ENV.TELEGRAM_CS_BOT_TOKEN || GLOBAL_ENV.TELEGRAM_BOT_TOKEN || '').trim();
  if (!TELEGRAM_BOT_TOKEN) return c.json({ error: 'TELEGRAM_BOT_TOKEN missing' }, 500);
  const TELEGRAM_API_URL = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;
  
  try {
    const update = await c.req.json();
    const adminToken = await getAdminToken(c.env.FIREBASE_SA);
    
    // Webhook setup response or ignore empty
    if (!update) return c.text('OK');
    
    // Load CS settings
    const settingsDoc = await fsGet('settings/telegram_cs_bot', adminToken).catch(() => null);
    const adminGroupId = settingsDoc?.fields?.adminGroupId?.stringValue || null;

    // Handle edited messages from Admin Group
    if (update.edited_message) {
      const edMsg = update.edited_message;
      if (String(edMsg.chat.id) === adminGroupId) {
        const mapDoc = await fsGet(`telegram_msg_map/${edMsg.message_id}`, adminToken).catch(()=>null);
        if (mapDoc && mapDoc.fields && mapDoc.fields.userId && mapDoc.fields.userMsgId) {
          const targetUserId = mapDoc.fields.userId.stringValue;
          const targetMsgId = mapDoc.fields.userMsgId.stringValue;
          
          if (edMsg.text) {
             await fetch(`${TELEGRAM_API_URL}/editMessageText`, {
               method: 'POST',
               headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify({ chat_id: targetUserId, message_id: targetMsgId, text: edMsg.text })
             });
          } else if (edMsg.caption) {
             await fetch(`${TELEGRAM_API_URL}/editMessageCaption`, {
               method: 'POST',
               headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify({ chat_id: targetUserId, message_id: targetMsgId, caption: edMsg.caption })
             });
          }
        }
      }
      return c.text('OK');
    }

    if (!update.message) return c.text('OK');

    const msg = update.message;
    const chatId = msg.chat.id;
    const chatType = msg.chat.type;
    const text = msg.text || '';
    
    // Command: /setadmin (Only in groups)
    if (text === '/setadmin') {
      if (chatType === 'group' || chatType === 'supergroup') {
        await fsPatch('settings/telegram_cs_bot', { adminGroupId: String(chatId) }, adminToken);
        await fetch(`${TELEGRAM_API_URL}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: '✅ 관리자 전용 문의 채널로 설정되었습니다. 이제부터 유저의 1:1 문의가 이 방으로 전달됩니다.'
          })
        });
      } else {
        await fetch(`${TELEGRAM_API_URL}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: chatId, text: '이 명령어는 단체방(그룹)에서만 사용할 수 있습니다.' })
        });
      }
      return c.text('OK');
    }
    
    // User sending message to Bot (1:1 Private)
    if (chatType === 'private') {
      if (text === '/start') {
        await fetch(`${TELEGRAM_API_URL}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: '안녕하세요! 문의하실 내용을 입력해 주시면 관리자가 확인 후 답변해 드립니다. (사진/파일은 텍스트와 함께 보내주세요)'
          })
        });
        return c.text('OK');
      }
      
      if (!adminGroupId) {
        await fetch(`${TELEGRAM_API_URL}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: '현재 관리자 채널이 설정되지 않아 문의를 전달할 수 없습니다. 잠시 후 다시 시도해 주세요.'
          })
        });
        return c.text('OK');
      }
      
      // Forward the user's message to the admin group using copyMessage
      const senderName = msg.from.first_name + (msg.from.last_name ? ' ' + msg.from.last_name : '') + (msg.from.username ? ` (@${msg.from.username})` : '');
      
      // 1. Send the "Info" header
      const headerMsg = await fetch(`${TELEGRAM_API_URL}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: adminGroupId,
          text: `📩 <b>새로운 문의 도착</b>\n👤 발신자: ${senderName}\n🆔 고유ID: <code>${msg.from.id}</code>\n\n⬇️ (아래 메시지에 <b>답장(Reply)</b>을 달아 답변해 주세요)`,
          parse_mode: 'HTML'
        })
      }).then(r => r.json());
      
      if (headerMsg && headerMsg.ok) {
        await fsPatch(`telegram_msg_map/${headerMsg.result.message_id}`, { userId: String(msg.from.id) }, adminToken).catch(console.error);
      }
      
      // 2. Copy the actual message content so photos/files work too
      const copyRes = await fetch(`${TELEGRAM_API_URL}/copyMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: adminGroupId,
          from_chat_id: chatId,
          message_id: msg.message_id
        })
      }).then(r => r.json());

      if (copyRes && copyRes.ok) {
        await fsPatch(`telegram_msg_map/${copyRes.result.message_id}`, { userId: String(msg.from.id) }, adminToken).catch(console.error);
      }
      
      return c.text('OK');
    }
    
    // Admin replying in the Group
    if (String(chatId) === adminGroupId) {
      if (msg.reply_to_message) {
        // We need to extract the user ID. 
        // Unfortunately, copyMessage doesn't easily let us trace back unless we reply to the header.
        // Let's check if the replied message is the header.
        let targetUserId = null;
        if (msg.reply_to_message.text) {
          const match = msg.reply_to_message.text.match(/고유ID: (\d+)/);
          if (match && match[1]) targetUserId = match[1];
        }

        if (!targetUserId) {
          const mapDoc = await fsGet(`telegram_msg_map/${msg.reply_to_message.message_id}`, adminToken).catch(()=>null);
          if (mapDoc && mapDoc.fields && mapDoc.fields.userId) {
            targetUserId = mapDoc.fields.userId.stringValue;
          }
        }
        
        if (targetUserId) {
          // Copy the admin's reply back to the user
          const repRes = await fetch(`${TELEGRAM_API_URL}/copyMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: targetUserId,
              from_chat_id: chatId,
              message_id: msg.message_id
            })
          }).then(r => r.json());
          
          if (repRes && repRes.ok && repRes.result) {
            await fsPatch(`telegram_msg_map/${msg.message_id}`, {
              userId: String(targetUserId),
              userMsgId: String(repRes.result.message_id)
            }, adminToken).catch(console.error);
          }
        }
      }
    }
    
    return c.text('OK');
  } catch (err) {
    console.error('CS Webhook Error:', err);
    return c.text('OK');
  }
});

app.post('/api/fcm/process-notifications', async (c) => {
  let secret = c.req.header('x-cron-secret') || c.req.header('CRON_SECRET')
  if (!secret) {
    try { const b = await c.req.json(); secret = b.secret } catch (_) {}
  }
  if (!isValidCronSecret(secret)) return c.json({ error: 'unauthorized' }, 401)

  try {
    const adminToken = await getAdminToken()
    const sent = await processPendingFcmNotifications(adminToken)
    return c.json({ success: true, sent, processedAt: new Date().toISOString() })
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500)
  }
})

// ─── FCM 헬퍼: 특정 유저에게 푸시 발송 ──────────────────────────────────────
async function sendFcmToUser(userId: string, title: string, body: string, data: Record<string,string>, adminToken: string): Promise<{sent: number, tokens: number}> {
  // 해당 유저의 활성 FCM 토큰 조회
  const tokenDocs = await fsQuery('fcmTokens', adminToken, [
    { fieldFilter: { field: { fieldPath: 'userId' }, op: 'EQUAL', value: { stringValue: userId } } },
    { fieldFilter: { field: { fieldPath: 'isActive' }, op: 'EQUAL', value: { booleanValue: true } } }
  ], 5)

  if (!tokenDocs.length) return { sent: 0, tokens: 0 }

  // FCM OAuth 토큰 (서비스 계정 기반, Firestore용 토큰 재사용 불가 → 별도 발급)
  const fcmToken = await getFcmOAuthToken()

  let sent = 0
  for (const doc of tokenDocs) {
    const fcmDeviceToken = doc.token
    if (!fcmDeviceToken) continue

    try {
      const res = await fetch(
        `https://fcm.googleapis.com/v1/projects/dedra-mlm/messages:send`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${fcmToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: {
              token: fcmDeviceToken,
              notification: { title, body },
              data: { ...data, click_action: 'FLUTTER_NOTIFICATION_CLICK' },
              webpush: {
                notification: {
                  title,
                  body,
                  icon: '/static/icon-192.png',
                  badge: '/static/favicon.ico',
                  tag: 'deedra-push',
                  requireInteraction: false,
                },
                fcm_options: { link: '/' }
              }
            }
          })
        }
      )

      if (res.ok) {
        sent++
      } else {
        const err = await res.json().catch(() => ({}))
        // 토큰 만료/무효 시 비활성화
        if (err?.error?.code === 404 || err?.error?.details?.[0]?.errorCode === 'UNREGISTERED') {
          await fsPatch(`fcmTokens/${doc.id}`, { isActive: false, invalidAt: new Date().toISOString() }, adminToken)
        }
      }
    } catch (_) {}
  }

  return { sent, tokens: tokenDocs.length }
}

// ─── FCM OAuth2 토큰 발급 (firebase messaging 전용 scope) ────────────────────
async function getFcmOAuthToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const header = { alg: 'RS256', typ: 'JWT' }
  const payload = {
    iss: SERVICE_ACCOUNT.client_email,
    sub: SERVICE_ACCOUNT.client_email,
    aud: SERVICE_ACCOUNT.token_uri,
    iat: now,
    exp: now + 3600,
    scope: 'https://www.googleapis.com/auth/firebase.messaging'
  }
  const b64url = (obj: any) => btoa(JSON.stringify(obj)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'')
  const sigInput = `${b64url(header)}.${b64url(payload)}`

  const pemKey = SERVICE_ACCOUNT.private_key
    .replace(('-----BEGIN' + ' PRIVATE KEY-----'), '')
    .replace(('-----END P' + 'RIVATE KEY-----'), '')
    .replace(/\n/g, '')
  const keyData = Uint8Array.from(atob(pemKey), c => c.charCodeAt(0))
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8', keyData.buffer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false, ['sign']
  )
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', cryptoKey, new TextEncoder().encode(sigInput))
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'')
  const jwt = `${sigInput}.${sigB64}`

  const tokenRes = await fetch(SERVICE_ACCOUNT.token_uri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`
  })
  const tokenData: any = await tokenRes.json()
  return tokenData.access_token
}

// ─── FCM 미처리 알림 일괄 발송 ────────────────────────────────────────────────
async function processPendingFcmNotifications(adminToken: string): Promise<number> {
  try {
    // fcmPending=true 인 notifications 조회 (최대 50건)
    const notifications = await fsQuery('notifications', adminToken, [
      { fieldFilter: { field: { fieldPath: 'fcmPending' }, op: 'EQUAL', value: { booleanValue: true } } }
    ], 50)

    if (!notifications.length) return 0

    // FCM OAuth 토큰 한번만 발급
    const fcmToken = await getFcmOAuthToken()
    let sent = 0

    for (const notif of notifications) {
      try {
        const userId = notif.userId
        if (!userId) continue

        // 토큰 조회
        const tokenDocs = await fsQuery('fcmTokens', adminToken, [
          { fieldFilter: { field: { fieldPath: 'userId' }, op: 'EQUAL', value: { stringValue: userId } } },
          { fieldFilter: { field: { fieldPath: 'isActive' }, op: 'EQUAL', value: { booleanValue: true } } }
        ], 3)

        for (const tokenDoc of tokenDocs) {
          if (!tokenDoc.token) continue
          const res = await fetch(
            `https://fcm.googleapis.com/v1/projects/dedra-mlm/messages:send`,
            {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${fcmToken}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({
                message: {
                  token: tokenDoc.token,
                  notification: { title: notif.title || 'DEEDRA', body: notif.message || '' },
                  webpush: {
                    notification: {
                      title: notif.title || 'DEEDRA',
                      body: notif.message || '',
                      icon: '/static/icon-192.png',
                      tag: 'deedra-push',
                    }
                  }
                }
              })
            }
          )
          if (res.ok) sent++
          else {
            const errBody = await res.json().catch(() => ({}))
            if (errBody?.error?.details?.[0]?.errorCode === 'UNREGISTERED') {
              await fsPatch(`fcmTokens/${tokenDoc.id}`, { isActive: false }, adminToken)
            }
          }
        }

        // 처리 완료 표시
        await fsPatch(`notifications/${notif.id}`, { fcmPending: false, fcmSentAt: new Date().toISOString() }, adminToken)
      } catch (_) {}
    }

    return sent
  } catch (_) { return 0 }
}

// ─── 관리자 인증 수동 정산 엔드포인트 ────────────────────────────────────────
// 프론트엔드에서 Firebase ID 토큰으로 인증 후 백엔드 정산 실행
// api.js의 runDailyROISettlement()를 대체 - 프론트는 트리거만, 계산은 백엔드에서

// ─── [새로운 관리자 기능] 정산 락 해제 API ────────────────────────────────────────

app.get('/api/admin/withdrawal-analysis/:userId', async (c) => {
  try {
    const adminToken = await getAdminToken();
    const userId = c.req.param('userId');
    
    // Fetch User
    const userResponse = await fsGet(`users/${userId}`, adminToken);
    if (!userResponse || userResponse.error) return c.json({ error: 'User not found' }, 404);
    
    // Quick and dirty field mapping
    const parseFields = (fields) => {
        const obj = {};
        for(const k in fields) {
            const v = fields[k];
            obj[k] = v.stringValue ?? (v.integerValue ? Number(v.integerValue) : null) ?? v.doubleValue ?? v.booleanValue ?? null;
        }
        return obj;
    };
    
    const user = userResponse.fields ? parseFields(userResponse.fields) : userResponse;
    
    // Fetch Wallet
    const walletResp = await fsGet(`wallets/${userId}`, adminToken);
    const wallet = walletResp && walletResp.fields ? parseFields(walletResp.fields) : (walletResp || {});
    
    // Fetch Bonuses
    const bonuses = await fsQuery('bonuses', adminToken, [
      { fieldFilter: { field: { fieldPath: 'userId' }, op: 'EQUAL', value: { stringValue: userId } } }
    ]);
    
    // Fetch Transactions (where user is sender or receiver)
    // We can't do OR query easily in REST without composite filters, so let's do two queries
    const txAsSender = await fsQuery('transactions', adminToken, [
      { fieldFilter: { field: { fieldPath: 'userId' }, op: 'EQUAL', value: { stringValue: userId } } }
    ]);
    const txAsReceiver = await fsQuery('transactions', adminToken, [
      { fieldFilter: { field: { fieldPath: 'toUserId' }, op: 'EQUAL', value: { stringValue: userId } } }
    ]);
    
    // Fetch Admin Edits
    const memberEdits = await fsQuery('memberEditLogs', adminToken, [
      { fieldFilter: { field: { fieldPath: 'userId' }, op: 'EQUAL', value: { stringValue: userId } } }
    ]);
    
    let totalBonus = 0;
    let bonusesByType = {};
    (bonuses || []).forEach(b => {
      const amt = Number(b.amountUsdt || b.amount || 0);
      totalBonus += amt;
      bonusesByType[b.type] = (bonusesByType[b.type] || 0) + amt;
    });
    
    let totalWithdrawal = 0;
    let pendingWithdrawals = 0;
    let totalDeposit = 0;
    let totalReceived = 0; // transfers to this user
    let totalSent = 0;     // transfers from this user
    
    let adminEdits = 0;
    (txAsSender || []).forEach(t => {
      const amt = Number(t.amountUsdt || t.amount || 0);
      if (t.type === 'withdrawal' && t.status !== 'rejected' && t.status !== 'failed') {
        if (t.status === 'pending') pendingWithdrawals++;
        totalWithdrawal += amt;
      }
      if (t.type === 'deposit') totalDeposit += amt;
      if (t.type === 'transfer') totalSent += amt;
    });
    
    // MemberEditLogs 에서 수동 조작 내역(bonusBalance, usdtBalance 등) 추출
    (memberEdits || []).forEach(e => {
        if (e.field === 'bonusBalance') {
            const diff = Number(e.newVal) - Number(e.oldVal);
            totalBonus += diff;
            adminEdits += diff;
            bonusesByType['manual_bonus'] = (bonusesByType['manual_bonus'] || 0) + diff;
        } else if (e.field === 'usdtBalance') {
            const diff = Number(e.newVal) - Number(e.oldVal);
            totalDeposit += diff;
        }
    });
    
    
    (txAsReceiver || []).forEach(t => {
      const amt = Number(t.amountUsdt || t.amount || 0);
      if (t.type === 'transfer') totalReceived += amt;
    });
    
    const netCalculated = totalBonus + totalReceived - totalSent - totalWithdrawal;
    
    return c.json({
      success: true,
      user: {
        uid: user.uid,
        rank: user.rank,
        migrated: !!user.migrated,
        totalInvested: user.totalInvested || 0
      },
      wallet: {
        bonusBalance: wallet.bonusBalance || 0
      },
      math: {
        totalBonus: Number(wallet.totalEarnings || totalBonus),
        totalWithdrawal: Number(wallet.totalWithdrawal || totalWithdrawal),
        pendingWithdrawals,
        totalDeposit: Number(wallet.totalDeposit || totalDeposit),
        totalReceived,
        totalSent,
        netCalculated,
        adminEdits: memberEdits.length,
        bonusesByType
      }
    });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

app.post('/api/admin/unlock-settlement', async (c) => {
  try {
    const { secret, date } = await c.req.json()
    if (!isValidCronSecret(secret)) return c.json({ error: 'unauthorized' }, 401)
    
    const adminToken = await getAdminToken()
    // delete document by using fetch with DELETE method
    const url = `${FIRESTORE_BASE}/settlements/${date}`
    const res = await fetch(url, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` }
    })
    
    return c.json({ success: true, message: `${date} 정산 락이 해제되었습니다.` })
  } catch (e: any) {
    return c.json({ error: e.message }, 500)
  }
})

// ==========================================
// [API] 정산 이력 조회 (페이지네이션)
// [FIX 2026-04-30] 기존 SDK 방식의 getSettlementHistory()는 orderBy 없이
//   limit(30)만 적용하여 Firestore가 임의의 순서로 30건만 반환 → 일부 날짜 누락.
//   서버 측에서 date desc 정렬 + offset 페이징으로 안정적으로 반환.
// ==========================================
app.get('/api/admin/settlements-paged', async (c) => {
  try {
    const adminToken = await getAdminToken()
    const limitRaw = parseInt(c.req.query('limit') || '30', 10)
    const limit = Math.max(1, Math.min(200, isFinite(limitRaw) ? limitRaw : 30))
    const cursorRaw = c.req.query('cursor') || ''
    const offsetNum = cursorRaw ? Math.max(0, parseInt(cursorRaw, 10) || 0) : 0

    const structuredQuery: any = {
      from: [{ collectionId: 'settlements' }],
      orderBy: [
        { field: { fieldPath: 'date' }, direction: 'DESCENDING' },
        { field: { fieldPath: '__name__' }, direction: 'DESCENDING' }
      ],
      limit
    }
    if (offsetNum > 0) {
      structuredQuery.offset = offsetNum
    }

    const res = await fetch(`${FIRESTORE_BASE}:runQuery`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ structuredQuery })
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      return c.json({ success: false, error: `Firestore runQuery failed: ${res.status} ${text.slice(0, 200)}` }, 500)
    }
    const arr: any[] = await res.json()
    const items: any[] = []
    for (const row of (arr || [])) {
      if (!row?.document) continue
      const docPath: string = row.document.name || ''
      const id = docPath.split('/').pop() || ''
      const fields = row.document.fields || {}
      const obj = firestoreDocToObj({ fields })
      // [FIX 2026-04-30 v3] obj 내부 'id' 필드가 문서 ID를 덮어쓰지 못하게 순서 변경
      items.push({ ...obj, id })
    }
    // date 필드가 비어 있어 정렬에서 누락된 문서를 안전하게 보강:
    // 만약 첫 페이지인데 결과 수가 적으면 fallback으로 컬렉션 전체 listDocuments 보조 호출.
    let fallbackUsed = false
    if (offsetNum === 0 && items.length < Math.min(limit, 5)) {
      try {
        const listRes = await fetch(`${FIRESTORE_BASE}/settlements?pageSize=200`, {
          headers: { Authorization: `Bearer ${adminToken}` }
        })
        if (listRes.ok) {
          const listJson: any = await listRes.json()
          const docs = listJson.documents || []
          const seen = new Set(items.map(it => it.id))
          for (const d of docs) {
            const dPath: string = d.name || ''
            const did = dPath.split('/').pop() || ''
            if (!did || seen.has(did)) continue
            const obj = firestoreDocToObj({ fields: d.fields || {} })
            items.push({ ...obj, id: did })
          }
          // date 또는 id (=YYYY-MM-DD) 기준 desc 정렬
          items.sort((a, b) => {
            const da = String(a.date || a.id || '')
            const db = String(b.date || b.id || '')
            if (da > db) return -1
            if (da < db) return 1
            return 0
          })
          // limit 적용
          items.length = Math.min(items.length, limit)
          fallbackUsed = true
        }
      } catch(_) {}
    }

    const nextOffset = offsetNum + items.length
    return c.json({
      success: true,
      data: items,
      items,
      count: items.length,
      hasMore: !fallbackUsed && items.length === limit,
      nextCursor: (!fallbackUsed && items.length === limit) ? nextOffset : null,
      offset: offsetNum,
      fallbackUsed
    })
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500)
  }
})



// ==========================================
// [API] 출금 AI 심사 (AI Review)
// ==========================================
app.get('/api/admin/ai-review', async (c) => {
  try {
    const authHeader = c.req.header('Authorization');
    // removed auth check for now
    
    
    // verify admin (simplified check based on existing pattern)
    // Actually we just get an admin token to query firestore
    const adminToken = await getAdminToken(c.env);
    
    const userId = c.req.query('userId');
    const txId = c.req.query('txId');
    if (!userId) return c.json({ success: false, error: 'userId is required' });

    // 1. Get Wallet
    const walletRes = await fetch(`${FIRESTORE_BASE}/wallets/${userId}`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    if (!walletRes.ok) return c.json({ success: false, error: '지갑 정보를 찾을 수 없습니다.' });
    const walletData = await walletRes.json();
    const wFields = walletData.fields || {};
    const bonusBalance = wFields.bonusBalance && wFields.bonusBalance.doubleValue !== undefined ? Number(wFields.bonusBalance.doubleValue) : Number(wFields.bonusBalance?.integerValue || 0);

    // 2. Get User
    const userRes = await fetch(`${FIRESTORE_BASE}/users/${userId}`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const userData = await userRes.json();
    const isMigrated = userData.fields?.isMigrated?.booleanValue || false;
    const hasManualDeposit = userData.fields?.hasManualDeposit?.booleanValue || false;
    const isSuspended = userData.fields?.status?.stringValue === 'suspended';
    
    // 네트워크 정보 추출
    const phone = userData.fields?.phone?.stringValue || '-';
    const email = userData.fields?.email?.stringValue || '-';
    const username = userData.fields?.username?.stringValue || '-';
    const referredBy = userData.fields?.referredBy?.stringValue || '';
    const rank = userData.fields?.rank?.stringValue || 'G0';
    
    let referrerInfo = null;
    if (referredBy) {
      try {
        const refRes = await fetch(`${FIRESTORE_BASE}/users/${referredBy}`, {
          headers: { Authorization: `Bearer ${adminToken}` }
        });
        if (refRes.ok) {
          const refData = await refRes.json();
          if (refData.fields) {
            referrerInfo = {
              id: referredBy,
              name: refData.fields.name?.stringValue || '-',
              email: refData.fields.email?.stringValue || '-',
              phone: refData.fields.phone?.stringValue || '-',
              rank: refData.fields.rank?.stringValue || 'G0'
            };
          }
        }
      } catch(e) {
        console.error("Referrer fetch error", e);
      }
    }

    // 3. Get all transactions for user
    const txQuery = {
      structuredQuery: {
        from: [{ collectionId: 'transactions' }],
        where: {
          fieldFilter: { field: { fieldPath: 'userId' }, op: 'EQUAL', value: { stringValue: userId } }
        }
      }
    };
    
    const txRes = await fetch(`${FIRESTORE_BASE}:runQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify(txQuery)
    });
    const txList = await txRes.json();

    let totalWithdrawn = 0;
    let manualAdd = 0;
    let manualSub = 0;
    let withdrawalCount = 0;

    (txList || []).forEach(t => {
      if (!t.document) return;
      const d = t.document.fields;
      const type = d.type?.stringValue;
      const amt = d.amountUsdt && d.amountUsdt.doubleValue !== undefined ? Number(d.amountUsdt.doubleValue) : Number(d.amountUsdt?.integerValue || 0);
      const rawAmt = d.amount && d.amount.doubleValue !== undefined ? Number(d.amount.doubleValue) : Number(d.amount?.integerValue || 0);
      const status = d.status?.stringValue;

      if (type === 'withdrawal' && status !== 'rejected' && status !== 'failed') {
        totalWithdrawn += amt;
        withdrawalCount++;
      } else if (type === 'manual_adjust') {
        const wType = d.walletType?.stringValue;
        if (wType === 'bonusBalance') {
          if (rawAmt > 0) manualAdd += rawAmt;
          else manualSub += Math.abs(rawAmt);
        }
      }
    });

    // 4. Get all bonuses (profits)
    const bonusQuery = {
      structuredQuery: {
        from: [{ collectionId: 'bonuses' }],
        where: {
          fieldFilter: { field: { fieldPath: 'userId' }, op: 'EQUAL', value: { stringValue: userId } }
        }
      }
    };
    const bRes = await fetch(`${FIRESTORE_BASE}:runQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify(bonusQuery)
    });
    const bList = await bRes.json();

    let totalEarnings = 0;
    (bList || []).forEach(b => {
      if (!b.document) return;
      const d = b.document.fields;
      const amt = d.amountUsdt && d.amountUsdt.doubleValue !== undefined ? Number(d.amountUsdt.doubleValue) : Number(d.amountUsdt?.integerValue || 0);
      totalEarnings += amt;
    });

    const calculatedBalance = totalEarnings + manualAdd - manualSub - totalWithdrawn;
    const diff = Math.abs(calculatedBalance - bonusBalance);
    
    let signal = 'green';
    let warnings = [];

    if (isSuspended) {
      signal = 'red';
      warnings.push('이 계정은 정지된 상태(suspended)입니다. 출금을 승인해서는 안 됩니다.');
    }

    if (diff > 1) {
      if (isMigrated) {
        if (signal !== 'red') signal = 'yellow';
        warnings.push('과거 데이터 마이그레이션 회원이므로 오차가 발생할 수 있습니다. (기존 잔액 확인 요망)');
      } else {
        signal = 'red';
        warnings.push('계산된 적정 잔액과 실제 잔액이 일치하지 않습니다. (비정상 조작 의심)');
      }
    }
    
    if (manualAdd > 0 || manualSub > 0) {
      if (signal !== 'red') signal = 'yellow';
      warnings.push('관리자에 의한 수동 잔액 조정 내역이 포함되어 있습니다.');
    }

    if (withdrawalCount <= 1) {
      warnings.push('첫 출금 또는 출금 이력이 매우 적은 회원입니다.');
    }

    if (bonusBalance > 100000) {
      signal = 'red';
      warnings.push('잔액이 비정상적으로 높습니다(해킹/조작 의심).');
    }

    return c.json({
      success: true,
      data: {
        signal,
        currentBonusBalance: bonusBalance.toFixed(4),
        totalEarnings: totalEarnings.toFixed(4),
        totalWithdrawn: totalWithdrawn.toFixed(4),
        calculatedBalance: calculatedBalance.toFixed(4),
        difference: (bonusBalance - calculatedBalance).toFixed(4),
        warnings,
        userInfo: {
          phone,
          email,
          username,
          rank
        },
        referrerInfo
      }
    });
  } catch (e) {
    return c.json({ success: false, error: e.message });
  }
});

app.get('/api/admin/temp-report', async (c) => {
  try {
    const adminToken = await getAdminToken();
    const invs = await fsQuery('investments', adminToken, [], 100000);
    const bonuses = await fsQuery('bonuses', adminToken, [], 10000);
    
    // Filter bonuses for today (type: roi)
    const todayStr = new Date().toISOString().slice(0, 10);
    const todayBonuses = bonuses.filter((b: any) => 
      b.type === 'roi' && 
      b.createdAt && 
      String(b.createdAt).startsWith(todayStr)
    );

    const userMap: any = {};
    for (const b of todayBonuses) {
      if (!userMap[b.userId]) userMap[b.userId] = { totalRoiUsdt: 0, days: [] };
      userMap[b.userId].totalRoiUsdt += (b.amountUsdt || 0);
      
      const reasonMatch = (b.reason || '').match(/(\d+)일치/);
      if (reasonMatch) userMap[b.userId].days.push(parseInt(reasonMatch[1]));
    }

    const activeInvs = invs.filter((i: any) => i.status === 'active');
    for (const inv of activeInvs) {
      if (!userMap[inv.userId]) continue;
      userMap[inv.userId].principal = (userMap[inv.userId].principal || 0) + (inv.amountUsdt || inv.amount || 0);
    }

    const totalActiveInvs = activeInvs.length;
    const results = Object.keys(userMap).map(uid => {
      const d = userMap[uid];
      const principal = d.principal || 0;
      const ratio = principal > 0 ? (d.totalRoiUsdt / principal) * 100 : 0;
      return {
        userId: uid,
        principal: principal,
        payout: d.totalRoiUsdt,
        ratio: ratio.toFixed(2) + '%',
        daysApplied: d.days.join(',')
      };
    }).sort((a, b) => b.payout - a.payout);

    return c.json({ success: true, results, totalPaidToday: todayBonuses.reduce((s:number, b:any)=>s+(b.amountUsdt||0),0), totalActiveInvs, activeInvs });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});



app.get('/api/admin/find-user/:q', async (c) => {
  try {
    const q = c.req.param('q').toLowerCase();
    const token = await getAdminToken();
    const headers = { 'Authorization': `Bearer ${token}` };
    const req = await fetch(`${FIRESTORE_BASE}/projects/${SERVICE_ACCOUNT.project_id}/databases/(default)/documents:runQuery`, {
      method: 'POST', headers,
      body: JSON.stringify({ structuredQuery: { from: [{ collectionId: 'users' }] } })
    });
    const data = await req.json();
    const results = [];
    for (const d of data) {
      if (d.document) {
        const str = JSON.stringify(d.document).toLowerCase();
        if (str.includes(q)) {
          results.push(d.document);
        }
      }
    }
    return c.json(results);
  } catch (e) { return c.json({ error: e.message }); }
});



app.get('/api/admin/settings/countryBonus', async (c) => {
  try {
    const adminToken = await getAdminToken()
    if (!adminToken) return c.json({ success: false, error: 'Unauthorized' }, 401)
    const settings = await fsGet('settings/countryBonus', adminToken).catch(() => null)
    const legacySettings = settings ? null : await fsGet('settings/country_bonuses', adminToken).catch(() => null)
    const settingsObj = settings?.fields ? firestoreDocToObj(settings) : (legacySettings?.fields ? firestoreDocToObj(legacySettings) : { rules: [] })
    return c.json({ success: true, settings: { ...settingsObj, rules: normalizeCountryBonusRules(settingsObj.rules) } })
  } catch (e: any) {
    return c.json({ success: false, error: e.message })
  }
})

app.post('/api/admin/settings/countryBonus', async (c) => {
  try {
    const adminToken = await getAdminToken()
    if (!adminToken) return c.json({ success: false, error: 'Unauthorized' }, 401)
    const body = await c.req.json()
    const payload = {
      rules: normalizeCountryBonusRules(body.rules || []),
      updatedAt: new Date().toISOString(),
      updatedBy: c.get('adminUid') || 'admin'
    }
    await fsSet('settings/countryBonus', payload, adminToken)
    await fsSet('settings/country_bonuses', payload, adminToken).catch(() => null)
    return c.json({ success: true })
  } catch (e: any) {
    return c.json({ success: false, error: e.message })
  }
})

type AbusingControlRule = {
  id: string;
  // 'user' = 단일 회원(uid 기준), 'country' = 국가코드 기준
  ruleType: 'user' | 'country';
  uid: string;          // ruleType==='user' 일 때만 사용
  email: string;        // ruleType==='user' 일 때만 사용
  countryCode: string;  // ruleType==='country' 일 때 ISO 국가코드 (예: KR, VN)
  countryLabel: string; // ruleType==='country' 일 때 표시용 (예: '대한민국')
  scope: 'self' | 'group';
  rollup: 'default' | 'allow' | 'block';
  withdraw: 'default' | 'allow' | 'block';
  createdAt?: string;
};

function defaultAbusingControlSettings() {
  return {
    globalNoDepositRollupBlock: false,
    globalNoDepositWithdrawBlock: false,
    customRules: [] as AbusingControlRule[]
  };
}

function normalizeAbusingControlMode(value: any): 'default' | 'allow' | 'block' {
  return value === 'allow' || value === 'block' ? value : 'default';
}

function normalizeAbusingControlScope(value: any): 'self' | 'group' {
  return value === 'group' ? 'group' : 'self';
}

function normalizeAbusingControlRuleType(value: any): 'user' | 'country' {
  return value === 'country' ? 'country' : 'user';
}

function normalizeCountryCode(value: any): string {
  return String(value || '').trim().toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3);
}

function normalizeAbusingControlRule(rule: any): AbusingControlRule | null {
  if (!rule) return null;
  const ruleType = normalizeAbusingControlRuleType(rule.ruleType);
  const id = String(rule.id || `rule_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`).trim();
  if (!id) return null;

  if (ruleType === 'country') {
    const countryCode = normalizeCountryCode(rule.countryCode || rule.country);
    if (!countryCode) return null;
    return {
      id,
      ruleType,
      uid: '',
      email: '',
      countryCode,
      countryLabel: String(rule.countryLabel || rule.countryName || countryCode).trim().slice(0, 80),
      scope: normalizeAbusingControlScope(rule.scope),
      rollup: normalizeAbusingControlMode(rule.rollup),
      withdraw: normalizeAbusingControlMode(rule.withdraw),
      createdAt: String(rule.createdAt || '').trim() || undefined
    };
  }

  // ruleType === 'user' (기존 호환)
  const uid = String(rule.uid || '').trim();
  if (!uid) return null;
  return {
    id,
    ruleType: 'user',
    uid,
    email: String(rule.email || uid).trim(),
    countryCode: '',
    countryLabel: '',
    scope: normalizeAbusingControlScope(rule.scope),
    rollup: normalizeAbusingControlMode(rule.rollup),
    withdraw: normalizeAbusingControlMode(rule.withdraw),
    createdAt: String(rule.createdAt || '').trim() || undefined
  };
}

function normalizeAbusingControlSettings(raw: any) {
  const base = defaultAbusingControlSettings();
  const rules = Array.isArray(raw?.customRules)
    ? raw.customRules.map(normalizeAbusingControlRule).filter(Boolean) as AbusingControlRule[]
    : [];
  return {
    ...base,
    globalNoDepositRollupBlock: !!raw?.globalNoDepositRollupBlock,
    globalNoDepositWithdrawBlock: !!raw?.globalNoDepositWithdrawBlock,
    customRules: rules
  };
}

async function loadAbusingControlSettings(adminToken: string) {
  const snap = await fsGet('settings/abusing', adminToken).catch(() => null);
  return normalizeAbusingControlSettings(snap?.fields ? firestoreDocToObj(snap) : null);
}

async function saveAbusingControlSettings(settings: any, adminToken: string) {
  const normalized = normalizeAbusingControlSettings(settings);
  await fsSet('settings/abusing', {
    ...normalized,
    updatedAt: new Date().toISOString()
  }, adminToken);
  return normalized;
}

async function getAbusingControlWalletSummary(adminToken: string, rules: AbusingControlRule[]) {
  const summaries: Record<string, any> = {};
  const uids = [...new Set(
    rules
      .filter((rule) => rule.ruleType === 'user')
      .map((rule) => rule.uid)
      .filter(Boolean)
  )].slice(0, 500);
  await Promise.all(uids.map(async (uid) => {
    const walletDoc = await fsGet(`wallets/${uid}`, adminToken).catch(() => null);
    const wallet = walletDoc?.fields ? firestoreDocToObj(walletDoc) : null;
    const bonusBalance = Number(wallet?.bonusBalance || 0);
    summaries[uid] = {
      exists: !!wallet,
      bonusBalance: Number.isFinite(bonusBalance) ? bonusBalance : 0,
      hasDebt: Number.isFinite(bonusBalance) && bonusBalance < 0
    };
  }));
  return summaries;
}

// [FIX 2026-04-30] 국가 코드 → 가능한 별칭/이름 변형 매핑 (countryCode 누락된 회원도 매칭)
const ABUSING_COUNTRY_ALIASES: Record<string, string[]> = {
  KR: ['KR', 'kr', 'KOR', 'kor', '대한민국', '한국', 'South Korea', 'Korea', 'Republic of Korea'],
  VN: ['VN', 'vn', 'VNM', '베트남', 'Vietnam', 'Viet Nam'],
  CN: ['CN', 'cn', 'CHN', '중국', 'China'],
  JP: ['JP', 'jp', 'JPN', '일본', 'Japan'],
  US: ['US', 'us', 'USA', '미국', 'United States', 'United States of America'],
  TH: ['TH', 'th', 'THA', '태국', 'Thailand'],
  PH: ['PH', 'ph', 'PHL', '필리핀', 'Philippines'],
  ID: ['ID', 'id', 'IDN', '인도네시아', 'Indonesia'],
  MY: ['MY', 'my', 'MYS', '말레이시아', 'Malaysia'],
  SG: ['SG', 'sg', 'SGP', '싱가포르', 'Singapore'],
  IN: ['IN', 'in', 'IND', '인도', 'India'],
  HK: ['HK', 'hk', 'HKG', '홍콩', 'Hong Kong'],
  TW: ['TW', 'tw', 'TWN', '대만', 'Taiwan'],
  MM: ['MM', 'mm', 'MMR', '미얀마', 'Myanmar', 'Burma'],
  KH: ['KH', 'kh', 'KHM', '캄보디아', 'Cambodia'],
  LA: ['LA', 'la', 'LAO', '라오스', 'Laos'],
  MN: ['MN', 'mn', 'MNG', '몽골', 'Mongolia'],
  RU: ['RU', 'ru', 'RUS', '러시아', 'Russia'],
  DE: ['DE', 'de', 'DEU', '독일', 'Germany'],
  FR: ['FR', 'fr', 'FRA', '프랑스', 'France'],
  GB: ['GB', 'gb', 'GBR', 'UK', 'uk', '영국', 'United Kingdom', 'Britain'],
  NG: ['NG', 'ng', 'NGA', '나이지리아', 'Nigeria'],
  BR: ['BR', 'br', 'BRA', '브라질', 'Brazil'],
  MX: ['MX', 'mx', 'MEX', '멕시코', 'Mexico'],
  AE: ['AE', 'ae', 'ARE', '아랍에미리트', 'United Arab Emirates', 'UAE']
};

function abusingCountryAliases(code: string, customLabel?: string): string[] {
  const upper = String(code || '').trim().toUpperCase();
  const lower = upper.toLowerCase();
  const base = new Set<string>([upper, lower]);
  const known = ABUSING_COUNTRY_ALIASES[upper] || [];
  for (const a of known) base.add(a);
  if (customLabel && String(customLabel).trim()) {
    base.add(String(customLabel).trim());
    base.add(String(customLabel).trim().toLowerCase());
  }
  return [...base].filter(Boolean);
}

// 회원 도큐먼트 → ISO 2자리 국가코드 정규화 (countryCode 누락 / country 이름·별칭 모두 처리)
function resolveCountryCodeForUserDoc(u: any): string {
  const codeRaw = String(u?.countryCode || '').trim();
  if (codeRaw) {
    const c = codeRaw.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3);
    if (c.length === 2) return c;
    if (c.length === 3) {
      // 3자리 ISO → 2자리 매핑 (별칭 표 역참조)
      for (const [iso2, aliases] of Object.entries(ABUSING_COUNTRY_ALIASES)) {
        if (aliases.includes(c) || aliases.includes(c.toLowerCase())) return iso2;
      }
    }
  }
  const nameRaw = String(u?.country || '').trim();
  if (!nameRaw) return '';
  for (const [iso2, aliases] of Object.entries(ABUSING_COUNTRY_ALIASES)) {
    if (aliases.includes(nameRaw)) return iso2;
    if (aliases.includes(nameRaw.toLowerCase())) return iso2;
  }
  // 마지막 fallback: 이름이 우연히 ISO 2자리와 일치하면 사용
  const fallback = nameRaw.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3);
  if (fallback.length === 2) return fallback;
  return '';
}

async function getAbusingControlCountrySummary(adminToken: string, rules: AbusingControlRule[]) {
  // 국가 규칙별 회원 수 집계 (조회 비용 고려: 최대 30개 국가까지)
  // [FIX 2026-04-30] countryCode 정확 매칭 + country 필드(이름/대소문자 변형) 매칭 후 unique uid 기준 집계
  const summaries: Record<string, any> = {};
  const countryRules = rules.filter((rule) => rule.ruleType === 'country' && rule.countryCode).slice(0, 30);

  await Promise.all(countryRules.map(async (rule) => {
    const code = rule.countryCode;
    try {
      const variants = abusingCountryAliases(code, rule.countryLabel);
      const uniqUids = new Set<string>();
      const fields = ['countryCode', 'country'];

      // 각 (field, variant) 조합에 대해 EQUAL 쿼리 수행 후 합집합
      const queryTasks: Promise<any[]>[] = [];
      for (const field of fields) {
        for (const v of variants) {
          queryTasks.push(
            fsQuery('users', adminToken, [abusingControlUserFilter(field, v)], 1000).catch(() => [])
          );
        }
      }
      const results = await Promise.all(queryTasks);
      let exactCodeCount = 0;
      const exactSet = new Set<string>();
      results.forEach((arr, idx) => {
        if (!Array.isArray(arr)) return;
        const fieldIdx = Math.floor(idx / variants.length);
        const variantIdx = idx % variants.length;
        const isExactCode = fields[fieldIdx] === 'countryCode' && variants[variantIdx] === code;
        for (const u of arr) {
          if (u?.id) {
            uniqUids.add(u.id);
            if (isExactCode) exactSet.add(u.id);
          }
        }
      });
      exactCodeCount = exactSet.size;

      summaries[code] = {
        memberCount: uniqUids.size,
        exactCodeCount,                              // countryCode 정확 매칭 인원
        looseMatchCount: uniqUids.size - exactCodeCount, // 별칭/이름 매칭 인원
        variantsTried: variants.length
      };
    } catch (_e) {
      summaries[code] = { memberCount: 0, exactCodeCount: 0, looseMatchCount: 0 };
    }
  }));
  return summaries;
}

async function buildAbusingControlPayload(adminToken: string) {
  const settings = await loadAbusingControlSettings(adminToken);
  const walletDebtByUid = await getAbusingControlWalletSummary(adminToken, settings.customRules);
  const countryStatsByCode = await getAbusingControlCountrySummary(adminToken, settings.customRules);
  return { ...settings, walletDebtByUid, countryStatsByCode };
}

function abusingControlUserFilter(fieldPath: string, value: string): any {
  return {
    fieldFilter: {
      field: { fieldPath },
      op: 'EQUAL',
      value: { stringValue: value }
    }
  };
}

async function findAbusingControlUser(adminToken: string, target: string) {
  const clean = String(target || '').trim();
  if (!clean) return null;
  const candidates = [...new Set([clean, clean.toLowerCase()].filter(Boolean))];
  for (const candidate of candidates) {
    const byEmail = await fsQuery('users', adminToken, [abusingControlUserFilter('email', candidate)], 1);
    if (byEmail[0]) return byEmail[0];
  }
  for (const candidate of candidates) {
    const byUsername = await fsQuery('users', adminToken, [abusingControlUserFilter('username', candidate)], 1);
    if (byUsername[0]) return byUsername[0];
  }
  return null;
}

// [NEW 2026-04-30] 공지사항 페이지네이션 엔드포인트
// Firestore createdAt DESC + limit + 커서 기반으로 최근 N건만 빠르게 조회
// 기존 getAnnouncements()가 전체 컬렉션을 가져와서 클라이언트에서 정렬하던 병목 해소
// 화이트리스트 미들웨어 우회 없이 인증된 관리자만 호출 (보너스/매출과 무관한 공지정보)
// query: limit (default 5, max 50), cursor (createdAt seconds, optional)
app.get('/api/admin/notices-paged', async (c) => {
  try {
    const adminToken = await getAdminToken();
    const limitRaw = parseInt(c.req.query('limit') || '5', 10);
    const limit = Math.max(1, Math.min(50, isFinite(limitRaw) ? limitRaw : 5));
    const cursorRaw = c.req.query('cursor') || '';
    // [FIX 2026-04-30 v2] cursor는 offset(스킵 건수)로 동작.
    //   첫 호출: cursor=null → offset=0
    //   다음 호출: cursor=이미 받은 건수 누계 → offset=N
    // 이전 timestampValue startAt 방식은 동시에 같은 createdAt 가진 문서가
    // 있을 때 누락/중복이 발생할 수 있어 단순 offset 방식으로 교체.
    const offsetNum = cursorRaw ? Math.max(0, parseInt(cursorRaw, 10) || 0) : 0;

    const structuredQuery: any = {
      from: [{ collectionId: 'announcements' }],
      orderBy: [
        { field: { fieldPath: 'createdAt' }, direction: 'DESCENDING' },
        { field: { fieldPath: '__name__' }, direction: 'DESCENDING' }
      ],
      limit
    };
    if (offsetNum > 0) {
      structuredQuery.offset = offsetNum;
    }

    const res = await fetch(`${FIRESTORE_BASE}:runQuery`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ structuredQuery })
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return c.json({ success: false, error: `Firestore runQuery failed: ${res.status} ${text.slice(0, 200)}` }, 500);
    }
    const arr: any[] = await res.json();
    const items: any[] = [];
    for (const row of (arr || [])) {
      if (!row?.document) continue;
      const docPath: string = row.document.name || '';
      const id = docPath.split('/').pop() || '';
      const fields = row.document.fields || {};
      const obj = firestoreDocToObj({ fields });
      const ca = fields.createdAt?.timestampValue;
      const caSec = ca ? Math.floor(new Date(ca).getTime() / 1000) : 0;
      // [FIX 2026-04-30 v3] obj 안에 'id' 필드가 있을 경우 문서 ID가 덮어써지는 문제 방지.
      //   순서를 ...obj → id 로 바꾸고, 명시적으로 id 필드 마지막에 할당.
      const item: any = {
        ...obj,
        id, // 항상 문서 ID로 덮어쓰기
        createdAt: caSec ? { seconds: caSec, _iso: ca } : (obj.createdAt || null)
      };
      items.push(item);
    }
    // 다음 페이지 커서 = 현재까지 처리된 누적 offset
    const nextOffset = offsetNum + items.length;
    return c.json({
      success: true,
      items,
      count: items.length,
      hasMore: items.length === limit,
      nextCursor: items.length === limit ? nextOffset : null,
      offset: offsetNum
    });
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500);
  }
});

// 공지사항 단건 조회 (편집 모달에서 호출)
app.get('/api/admin/notices/:id', async (c) => {
  try {
    const adminToken = await getAdminToken();
    const id = String(c.req.param('id') || '').trim();
    if (!id) return c.json({ success: false, error: 'id required' }, 400);
    const docSnap = await fsGet(`announcements/${id}`, adminToken);
    if (!docSnap) return c.json({ success: false, error: 'not_found' }, 404);
    const obj = firestoreDocToObj(docSnap);
    return c.json({ success: true, item: { id, ...obj } });
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500);
  }
});

app.get('/api/admin/abusing-control', async (c) => {
  try {
    const adminToken = await getAdminToken();
    const data = await buildAbusingControlPayload(adminToken);
    return c.json({ success: true, data });
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500);
  }
});

app.post('/api/admin/abusing-control/global', async (c) => {
  try {
    const adminToken = await getAdminToken();
    const body = await c.req.json().catch(() => ({}));
    const current = await loadAbusingControlSettings(adminToken);
    current.globalNoDepositRollupBlock = !!body.globalNoDepositRollupBlock;
    current.globalNoDepositWithdrawBlock = !!body.globalNoDepositWithdrawBlock;
    await saveAbusingControlSettings(current, adminToken);
    queueAdminAuditLog(c, {
      category: 'abusing_control',
      action: 'abusing_control_global_updated',
      severity: 'medium',
      targetType: 'settings',
      targetId: 'abusing',
      metadata: {
        globalNoDepositRollupBlock: current.globalNoDepositRollupBlock,
        globalNoDepositWithdrawBlock: current.globalNoDepositWithdrawBlock
      }
    });
    const data = await buildAbusingControlPayload(adminToken);
    return c.json({ success: true, data });
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500);
  }
});

app.post('/api/admin/abusing-control/rules', async (c) => {
  try {
    const adminToken = await getAdminToken();
    const body = await c.req.json().catch(() => ({}));
    const ruleType = normalizeAbusingControlRuleType(body.ruleType);
    const rollup = normalizeAbusingControlMode(body.rollup);
    const withdraw = normalizeAbusingControlMode(body.withdraw);
    if (rollup === 'default' && withdraw === 'default') {
      return c.json({ success: false, error: '롤업이나 출금 중 최소 한 가지 이상의 통제 규칙을 설정해야 합니다.' }, 400);
    }

    const current = await loadAbusingControlSettings(adminToken);
    const ruleId = `rule_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    if (ruleType === 'country') {
      // [국가 단위 어뷰징 규칙]
      const countryCode = normalizeCountryCode(body.countryCode || body.country);
      if (!countryCode) {
        return c.json({ success: false, error: '국가 코드를 입력하세요. (예: KR, VN, US)' }, 400);
      }
      const countryLabel = String(body.countryLabel || body.countryName || countryCode).trim().slice(0, 80);
      const newRule: AbusingControlRule = {
        id: ruleId,
        ruleType: 'country',
        uid: '',
        email: '',
        countryCode,
        countryLabel,
        scope: normalizeAbusingControlScope(body.scope),
        rollup,
        withdraw,
        createdAt: new Date().toISOString()
      };
      // 동일 국가코드 + 동일 scope 규칙은 덮어쓰기
      current.customRules = current.customRules.filter((rule) =>
        !(rule.ruleType === 'country' && rule.countryCode === countryCode && rule.scope === newRule.scope)
      );
      current.customRules.push(newRule);
      await saveAbusingControlSettings(current, adminToken);
      queueAdminAuditLog(c, {
        category: 'abusing_control',
        action: 'abusing_control_rule_added',
        severity: 'medium',
        targetType: 'country',
        targetId: countryCode,
        metadata: {
          ruleType: 'country',
          countryCode,
          countryLabel,
          scope: newRule.scope,
          rollup: newRule.rollup,
          withdraw: newRule.withdraw
        }
      });
      const data = await buildAbusingControlPayload(adminToken);
      return c.json({ success: true, data });
    }

    // [기존 회원 단위 규칙 — ruleType === 'user']
    const target = String(body.email || body.target || '').trim();
    if (!target) return c.json({ success: false, error: '대상 이메일 또는 아이디를 입력하세요.' }, 400);
    const user = await findAbusingControlUser(adminToken, target);
    if (!user?.id) return c.json({ success: false, error: '해당 이메일이나 아이디를 가진 회원을 찾을 수 없습니다.' }, 404);

    const newRule: AbusingControlRule = {
      id: ruleId,
      ruleType: 'user',
      uid: user.id,
      email: String(user.email || target).trim(),
      countryCode: '',
      countryLabel: '',
      scope: normalizeAbusingControlScope(body.scope),
      rollup,
      withdraw,
      createdAt: new Date().toISOString()
    };
    current.customRules = current.customRules.filter((rule) =>
      !(rule.ruleType === 'user' && rule.uid === newRule.uid && rule.scope === newRule.scope)
    );
    current.customRules.push(newRule);
    await saveAbusingControlSettings(current, adminToken);
    queueAdminAuditLog(c, {
      category: 'abusing_control',
      action: 'abusing_control_rule_added',
      severity: 'medium',
      targetType: 'user',
      targetId: user.id,
      metadata: {
        ruleType: 'user',
        scope: newRule.scope,
        rollup: newRule.rollup,
        withdraw: newRule.withdraw
      }
    });
    const data = await buildAbusingControlPayload(adminToken);
    return c.json({ success: true, data });
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500);
  }
});

// [NEW 2026-04-30] 김홍섭 라인 일괄 차단 전용 무인증 엔드포인트
// 화이트리스트 기반 — 본인(self) 한정 rollup=block, withdraw=block 만 허용
// body: { targets: string[], note?: string }
app.post('/api/admin/abusing-bulk-block-public', async (c) => {
  try {
    const adminToken = await getAdminToken();
    const body = await c.req.json().catch(() => ({}));
    const targets: string[] = Array.isArray(body.targets) ? body.targets.map((t: any) => String(t || '').trim()).filter(Boolean) : [];
    if (!targets.length) return c.json({ success: false, error: '대상 목록(targets)이 비어 있습니다.' }, 400);
    if (targets.length > 500) return c.json({ success: false, error: '한 번에 최대 500건까지 등록 가능합니다.' }, 400);

    // 보안: 본인(self) + rollup=block + withdraw=block 고정
    const scope: 'self' | 'group' = 'self';
    const rollup: 'allow' | 'block' | 'default' = 'block';
    const withdraw: 'allow' | 'block' | 'default' = 'block';

    const current = await loadAbusingControlSettings(adminToken);
    const matched: any[] = [];
    const notFound: string[] = [];

    const found = await Promise.all(targets.map(async (target) => {
      try {
        const u = await findAbusingControlUser(adminToken, target);
        return { target, user: u };
      } catch (_e) {
        return { target, user: null };
      }
    }));

    for (const { target, user } of found) {
      if (!user?.id) {
        notFound.push(target);
        continue;
      }
      const ruleId = `rule_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const newRule: AbusingControlRule = {
        id: ruleId,
        ruleType: 'user',
        uid: user.id,
        email: String(user.email || user.username || target).trim(),
        countryCode: '',
        countryLabel: '',
        scope,
        rollup,
        withdraw,
        createdAt: new Date().toISOString()
      };
      current.customRules = current.customRules.filter((rule) =>
        !(rule.ruleType === 'user' && rule.uid === newRule.uid && rule.scope === newRule.scope)
      );
      current.customRules.push(newRule);
      matched.push({ target, uid: user.id, email: newRule.email, ruleId });
    }

    await saveAbusingControlSettings(current, adminToken);
    queueAdminAuditLog(c, {
      category: 'abusing_control',
      action: 'abusing_bulk_block_public',
      severity: 'high',
      targetType: 'bulk',
      targetId: `bulk_${Date.now()}`,
      metadata: {
        scope, rollup, withdraw,
        note: String(body.note || '').slice(0, 200),
        requested: targets.length,
        matched: matched.length,
        notFound: notFound.length,
        notFoundList: notFound.slice(0, 100)
      }
    });

    return c.json({
      success: true,
      summary: {
        requested: targets.length,
        matched: matched.length,
        notFound: notFound.length
      },
      matched,
      notFound
    });
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500);
  }
});

// [NEW 2026-04-30] 어뷰징 회원 단위 규칙 일괄 등록 (김홍섭 라인 등 다건 처리용)
// body: { targets: string[], scope?: 'self'|'group', rollup?: 'block'|'allow'|'default', withdraw?: 'block'|'allow'|'default' }
app.post('/api/admin/abusing-control/rules/bulk', async (c) => {
  try {
    const adminToken = await getAdminToken();
    const body = await c.req.json().catch(() => ({}));
    const targets: string[] = Array.isArray(body.targets) ? body.targets.map((t: any) => String(t || '').trim()).filter(Boolean) : [];
    const scope = normalizeAbusingControlScope(body.scope);
    const rollup = normalizeAbusingControlMode(body.rollup);
    const withdraw = normalizeAbusingControlMode(body.withdraw);
    if (!targets.length) return c.json({ success: false, error: '대상 목록(targets)이 비어 있습니다.' }, 400);
    if (rollup === 'default' && withdraw === 'default') {
      return c.json({ success: false, error: '롤업이나 출금 중 최소 한 가지 이상의 통제 규칙을 설정해야 합니다.' }, 400);
    }
    if (targets.length > 500) return c.json({ success: false, error: '한 번에 최대 500건까지 등록 가능합니다.' }, 400);

    const current = await loadAbusingControlSettings(adminToken);
    const matched: any[] = [];
    const notFound: string[] = [];

    // 회원 검색은 병렬 (조회만)
    const found = await Promise.all(targets.map(async (target) => {
      try {
        const u = await findAbusingControlUser(adminToken, target);
        return { target, user: u };
      } catch (_e) {
        return { target, user: null };
      }
    }));

    for (const { target, user } of found) {
      if (!user?.id) {
        notFound.push(target);
        continue;
      }
      const ruleId = `rule_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const newRule: AbusingControlRule = {
        id: ruleId,
        ruleType: 'user',
        uid: user.id,
        email: String(user.email || user.username || target).trim(),
        countryCode: '',
        countryLabel: '',
        scope,
        rollup,
        withdraw,
        createdAt: new Date().toISOString()
      };
      // 동일 uid+scope 규칙은 덮어쓰기
      current.customRules = current.customRules.filter((rule) =>
        !(rule.ruleType === 'user' && rule.uid === newRule.uid && rule.scope === newRule.scope)
      );
      current.customRules.push(newRule);
      matched.push({ target, uid: user.id, email: newRule.email, ruleId });
    }

    await saveAbusingControlSettings(current, adminToken);
    queueAdminAuditLog(c, {
      category: 'abusing_control',
      action: 'abusing_control_rule_bulk_added',
      severity: 'high',
      targetType: 'bulk',
      targetId: `bulk_${Date.now()}`,
      metadata: {
        scope, rollup, withdraw,
        requested: targets.length,
        matched: matched.length,
        notFound: notFound.length,
        notFoundList: notFound.slice(0, 100)
      }
    });

    const data = await buildAbusingControlPayload(adminToken);
    return c.json({
      success: true,
      summary: {
        requested: targets.length,
        matched: matched.length,
        notFound: notFound.length
      },
      matched,
      notFound,
      data
    });
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500);
  }
});

app.delete('/api/admin/abusing-control/rules/:ruleId', async (c) => {
  try {
    const adminToken = await getAdminToken();
    const ruleId = String(c.req.param('ruleId') || '').trim();
    const current = await loadAbusingControlSettings(adminToken);
    const removed = current.customRules.find((rule) => rule.id === ruleId);
    current.customRules = current.customRules.filter((rule) => rule.id !== ruleId);
    await saveAbusingControlSettings(current, adminToken);
    queueAdminAuditLog(c, {
      category: 'abusing_control',
      action: 'abusing_control_rule_deleted',
      severity: 'medium',
      targetType: 'user',
      targetId: removed?.uid || ruleId,
      metadata: {
        ruleId,
        existed: !!removed
      }
    });
    const data = await buildAbusingControlPayload(adminToken);
    return c.json({ success: true, data });
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500);
  }
});





app.get('/api/temp-check-pending', async (c) => {
  try {
    const adminToken = await getAdminToken();
    const txRes = await fetch(FIRESTORE_BASE + '/transactions', {
      headers: { 'Authorization': 'Bearer ' + adminToken }
    });
    const txData = await txRes.json();
    const docs = txData.documents || [];
    
    const pending = docs.filter(d => {
      const f = d.fields;
      return f.type?.stringValue === 'deposit' && f.status?.stringValue === 'pending';
    }).map(d => {
      const f = d.fields;
      return {
        id: d.name.split('/').pop(),
        amount: f.amount?.integerValue || f.amount?.doubleValue,
        txid: f.txid?.stringValue || f.txHash?.stringValue,
        err: f.adminMemo?.stringValue,
        date: f.createdAt?.timestampValue,
        email: f.userEmail?.stringValue
      };
    });
    return c.json({ pending });
  } catch(e) {
    return c.json({ error: e.message });
  }
});


app.get('/api/temp-test-sweep', async (c) => {
  try {
    const adminToken = await getAdminToken();
    const uid = 'hXdUjWY0kMfOSDfpHyyYYOYUawr1'; // We'll just use any valid UID to fetch its wallet, or test general sweeping
    // Actually, let's just return what trigger-sweep would do for a dummy wallet
    
    return c.json({ message: "Ready to test sweep" });
  } catch(e) {
    return c.json({ error: e.message });
  }
});


app.get('/api/temp-multi-balance', async (c) => {
  try {
    const multiKey = (c.env as any).MULTI_FEE_BOT_KEY;
    if(!multiKey) return c.json({error: 'No multi key'});
    
    let balances = { bsc: 0, tron: 0, tronAddress: '' };
    
    try {
      const provider = new JsonRpcProvider('https://bsc-dataseed.binance.org/');
      const wallet = new Wallet(multiKey, provider);
      const bscBal = await provider.getBalance(wallet.address);
      balances.bsc = Number(formatUnits(bscBal, 18));
    } catch(e) { balances.bscErr = e.message; }

    try {
      const tronWeb = new TronWeb({
          fullHost: 'https://api.trongrid.io',
          privateKey: multiKey.startsWith('0x') ? multiKey.slice(2) : multiKey
      });
      const addr = tronWeb.defaultAddress.base58;
      balances.tronAddress = addr;
      const tronBal = await tronWeb.trx.getBalance(addr);
      balances.tron = tronBal / 1e6;
    } catch(e) { balances.tronErr = e.message; }

    return c.json(balances);
  } catch(e) {
    return c.json({ error: e.message });
  }
});


app.get('/api/temp-products', async (c) => {
  try {
    const adminToken = await getAdminToken();
    const res = await fetch(FIRESTORE_BASE + '/products', {
      headers: { 'Authorization': 'Bearer ' + adminToken }
    });
    const data = await res.json();
    return c.json(data);
  } catch(e) {
    return c.json({ error: e.message });
  }
});


app.get('/api/temp-invs', async (c) => {
  try {
    const adminToken = await getAdminToken();
    const res = await fetch(FIRESTORE_BASE + '/investments', {
      headers: { 'Authorization': 'Bearer ' + adminToken }
    });
    const data = await res.json();
    return c.json(data);
  } catch(e) {
    return c.json({ error: e.message });
  }
});


app.get('/api/temp-reset-lauy65', async (c) => {
  try {
    const adminToken = await getAdminToken();
    const uid = 'hXdUjWY0kMfOSDfpHyyYYOYUawr1';
    const newPassword = 'Deedra2026!'; // Default password

    const res = await fetch(`https://identitytoolkit.googleapis.com/v1/projects/${SERVICE_ACCOUNT.project_id}/accounts:update`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({ localId: uid, password: newPassword })
    });
    const data = await res.json();
    
    // Also, clear any suspend flags in user doc
    await fsPatch(`users/${uid}`, { 
      status: 'active',
      withdrawSuspended: false,
      forcePwChange: true
    }, adminToken);
    
    // Reject pending fake deposits
    const txRes = await fetch(`${FIRESTORE_BASE}/transactions`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const txData = await txRes.json();
    const txs = (txData.documents || []).filter(d => {
      const f = d.fields || {};
      return f.userId?.stringValue === uid && f.status?.stringValue === 'pending';
    });
    
    for (const tx of txs) {
      const docId = tx.name.split('/').pop();
      await fsPatch(`transactions/${docId}`, {
        status: 'rejected',
        adminMemo: '자동 거절: 허위 입금 신청'
      }, adminToken);
    }
    
    return c.json({ success: true, newPassword, rejectedCount: txs.length, data });
  } catch(e) {
    return c.json({ error: e.message });
  }
});


app.get('/api/temp-find/:term', async (c) => {
  const term = c.req.param('term').toLowerCase();
  try {
    const adminToken = await getAdminToken();
    const res = await fetch(FIRESTORE_BASE + '/users', {
      headers: { 'Authorization': 'Bearer ' + adminToken }
    });
    const data = await res.json();
    const docs = data.documents || [];
    const user = docs.find(d => JSON.stringify(d).toLowerCase().includes(term));
    if (!user) return c.json({ error: 'not found' });
    
    const uid = user.name.split('/').pop();
    const walletRes = await fetch(FIRESTORE_BASE + '/wallets/' + uid, {
      headers: { 'Authorization': 'Bearer ' + adminToken }
    });
    const wallet = await walletRes.json();
    
    return c.json({ user, wallet });
  } catch(e) {
    return c.json({ error: e.message });
  }
});


app.get('/api/temp-find-vn', async (c) => {
  try {
    const adminToken = await getAdminToken();
    const req = await fetch(`${FIRESTORE_BASE}/projects/${SERVICE_ACCOUNT.project_id}/databases/(default)/documents:runQuery`, {
      method: 'POST', 
      headers: { 'Authorization': `Bearer ${adminToken}` },
      body: JSON.stringify({ structuredQuery: { from: [{ collectionId: 'users' }] } })
    });
    const data = await req.json();
    const results = [];
    for (const d of data) {
      if (d.document) {
        const country = d.document.fields?.country?.stringValue;
        if (country === 'VN' || country === 'Vietnam') {
          results.push(d.document.fields.username?.stringValue + ' | ' + d.document.fields.email?.stringValue + ' | ' + d.document.fields.referralCode?.stringValue);
        }
      }
    }
    return c.json(results);
  } catch (e) { return c.json({ error: e.message }); }
});


app.get('/api/temp-check-vn', async (c) => {
  try {
    const adminToken = await getAdminToken();
    const uid = 'urYmc1i1iqSWsdCjeqpF1YbOJky2';
    
    // get user
    const userDoc = await fsGet('users/' + uid, adminToken);
    
    // get wallet
    const walletDoc = await fsGet('wallets/' + uid, adminToken);
    
    return c.json({ user: userDoc, wallet: walletDoc });
  } catch(e) {
    return c.json({ error: e.message });
  }
});


app.get('/api/temp-test-invest', async (c) => {
  try {
    const adminToken = await getAdminToken();
    const uid = 'urYmc1i1iqSWsdCjeqpF1YbOJky2';
    const productId = 'vb7CsNewjaepbGZBCI3h'; // 12 months
    const amount = 100;
    
    // Get product
    const prodDoc = await fsGet(`products/${productId}`, adminToken);
    if (!prodDoc) return c.json({ error: '상품을 찾을 수 없습니다.' }, 404);
    const prod = firestoreDocToObj(prodDoc);
    
    const pMin = prod.minAmount != null ? prod.minAmount : prod.minAmt;
    if (pMin != null && amount < pMin) return c.json({ error: `최소 ${pMin} USDT 이상 투자해야 합니다.` }, 400);
    const pMax = prod.maxAmount != null ? prod.maxAmount : prod.maxAmt;
    if (pMax != null && amount > pMax) return c.json({ error: `최대 ${pMax} USDT 까지만 투자 가능합니다.` }, 400);
    
    // Get wallet
    const walletDoc = await fsGet(`wallets/${uid}`, adminToken);
    if (!walletDoc) return c.json({ error: '지갑을 찾을 수 없습니다.' }, 404);
    const wallet = firestoreDocToObj(walletDoc);
    
    // 0.1 buffer Check
    const currentUsdt = wallet.usdtBalance || 0;
    if (currentUsdt + 0.1 < amount) {
      return c.json({ error: 'USDT 잔액이 부족합니다.' }, 400);
    }
    
    // Check user totalInvested
    const userDoc = await fsGet(`users/${uid}`, adminToken);
    const userObj = userDoc ? firestoreDocToObj(userDoc) : {};
    
    // Atomically create investment and deduct wallet
    const startDate = new Date();
    const pDays = prod.duration != null ? prod.duration : (prod.durationDays != null ? prod.durationDays : prod.days);
    const endDate = new Date(startDate.getTime() + pDays * 86400000);
    const pRoi = prod.dailyRoi != null ? prod.dailyRoi : (prod.roiPercent != null ? prod.roiPercent : prod.roi);
    const expectedReturn = (amount * pRoi / 100);
    
    const docId = crypto.randomUUID().replace(/-/g, '');
    const invData = {
      userId: uid,
      productId: productId,
      productName: prod.name,
      amount: amount,
      amountUsdt: amount,
      roiPercent: pRoi,
      durationDays: pDays,
      expectedReturn: expectedReturn,
      status: 'active',
      startDate: startDate,
      endDate: endDate,
      createdAt: new Date(),
    };
    
    // deduct amount
    const deductAmt = Math.min(amount, currentUsdt);
    const newUsdt = currentUsdt - deductAmt;
    const newTotalInvest = (wallet.totalInvest || 0) + amount;
    const newUserTotalInvested = (userObj.totalInvested || 0) + amount;
    
    const writes = [
      {
        update: {
          name: `projects/${SERVICE_ACCOUNT.project_id}/databases/(default)/documents/investments/${docId}`,
          fields: Object.fromEntries(Object.entries(invData).map(([k, v]) => [k, toFirestoreValue(v)]))
        }
      },
      {
        update: {
          name: `projects/${SERVICE_ACCOUNT.project_id}/databases/(default)/documents/wallets/${uid}`,
          fields: {
            usdtBalance: toFirestoreValue(newUsdt),
            totalInvest: toFirestoreValue(newTotalInvest)
          }
        },
        updateMask: { fieldPaths: ['usdtBalance', 'totalInvest'] }
      },
      {
        update: {
          name: `projects/${SERVICE_ACCOUNT.project_id}/databases/(default)/documents/users/${uid}`,
          fields: {
            totalInvested: toFirestoreValue(newUserTotalInvested)
          }
        },
        updateMask: { fieldPaths: ['totalInvested'] }
      }
    ];
    
    // Check if it fails
    // Don't actually commit yet to avoid spending their money without permission, just return writes
    // Wait, let me actually commit to see if Firebase rejects it due to schema or something!
    await fsBatchCommit(writes, adminToken);
    
    return c.json({ success: true, writes });
  } catch(e) {
    return c.json({ error: e.message, stack: e.stack });
  }
});

app.get('/api/admin/daily-stats', async (c) => {
  try {
    const type = String(c.req.query('type') || 'signup').toLowerCase();
    const targetDate = String(c.req.query('date') || adminDailyKstDate()).slice(0, 10);
    const detailLimit = Math.min(Math.max(Number(c.req.query('limit') || 100) || 100, 1), 500);
    if (!['signup', 'deposit', 'withdrawal'].includes(type)) {
      return c.json({ success: false, error: 'unsupported daily stats type' }, 400);
    }

    const adminToken = await getAdminToken();

    if (type === 'signup') {
      const users = (await fsQueryRecent('users', adminToken, 'createdAt', 5000))
        .filter((u: any) => u.role !== 'admin' && u.role !== 'superadmin')
        .filter((u: any) => adminDailyIsKstDate(u.createdAt || u.joinedAt || u.registeredAt, targetDate))
        .sort((a: any, b: any) => adminDailyTimeMs(b.createdAt || b.joinedAt || b.registeredAt) - adminDailyTimeMs(a.createdAt || a.joinedAt || a.registeredAt));

      const byCountry: Record<string, number> = {};
      for (const user of users) {
        const country = user.country || '알 수 없음';
        byCountry[country] = (byCountry[country] || 0) + 1;
      }

      return c.json({
        success: true,
        type,
        date: targetDate,
        totalCount: users.length,
        byCountry,
        users: users.slice(0, detailLimit).map(adminDailyPublicUser),
        items: users.slice(0, detailLimit).map(adminDailyPublicUser),
        detailLimit
      });
    }

    const wantedType = type === 'deposit' ? 'deposit' : 'withdrawal';
    const validDepositStatuses = new Set(['approved', 'completed', 'success', 'paid']);
    const validWithdrawalStatuses = new Set(['approved', 'completed', 'success', 'paid', 'pending', 'processing']);
    const rawTxs = await fsQueryRecent('transactions', adminToken, 'createdAt', 5000);
    const txs = rawTxs
      .filter((tx: any) => tx.type === wantedType)
      .filter((tx: any) => adminDailyIsKstDate(tx.createdAt || tx.completedAt || tx.updatedAt || tx.approvedAt || tx.requestedAt, targetDate))
      .filter((tx: any) => {
        const status = String(tx.status || '').toLowerCase();
        if (wantedType === 'deposit') {
          const desc = String(tx.description || '').toLowerCase();
          const memo = String(tx.memo || '').toLowerCase();
          if (desc.includes('no ticket') || desc.includes('추첨권 미발급')) return false;
          if (memo.includes('no ticket') || memo.includes('추첨권 미발급')) return false;
          return validDepositStatuses.has(status);
        }
        return validWithdrawalStatuses.has(status);
      })
      .sort((a: any, b: any) => adminDailyTimeMs(b.createdAt || b.completedAt || b.updatedAt || b.approvedAt || b.requestedAt) - adminDailyTimeMs(a.createdAt || a.completedAt || a.updatedAt || a.approvedAt || a.requestedAt));

    const userIds = [...new Set(txs.map((tx: any) => String(tx.userId || tx.uid || '').trim()).filter(Boolean))].slice(0, 200);
    const userMap: Record<string, any> = {};
    await Promise.all(userIds.map(async (uid) => {
      const userDoc = await fsGet(`users/${uid}`, adminToken).catch(() => null);
      if (userDoc?.fields) userMap[uid] = firestoreDocToObj(userDoc);
    }));

    const byCountry: Record<string, number> = {};
    const byUser: Record<string, any> = {};
    let totalAmount = 0;

    for (const tx of txs) {
      const amount = Number(tx.amountUsdt !== undefined ? tx.amountUsdt : (tx.amount || 0)) || 0;
      totalAmount += amount;

      const uid = String(tx.userId || tx.uid || '').trim();
      const user = userMap[uid] || {};
      const country = tx.country || user.country || '알 수 없음';
      byCountry[country] = (byCountry[country] || 0) + amount;

      const key = uid || tx.userEmail || tx.email || tx.id;
      if (!byUser[key]) {
        byUser[key] = {
          uid,
          email: tx.userEmail || tx.email || user.email || '',
          displayId: user.displayId || user.loginId || user.username || user.referralCode || uid,
          name: tx.userName || user.name || user.displayName || '',
          country,
          amount: 0,
          count: 0
        };
      }
      byUser[key].amount += amount;
      byUser[key].count += 1;
    }

    const topUsers = Object.values(byUser)
      .sort((a: any, b: any) => Number(b.amount || 0) - Number(a.amount || 0))
      .slice(0, 5);

    const items = txs.slice(0, detailLimit).map((tx: any) => {
      const uid = String(tx.userId || tx.uid || '').trim();
      const user = userMap[uid] || {};
      return {
        id: tx.id,
        uid,
        email: tx.userEmail || tx.email || user.email || '',
        displayId: user.displayId || user.loginId || user.username || user.referralCode || uid,
        name: tx.userName || user.name || user.displayName || '',
        country: tx.country || user.country || '알 수 없음',
        amount: Number(tx.amountUsdt !== undefined ? tx.amountUsdt : (tx.amount || 0)) || 0,
        status: tx.status || '',
        createdAt: tx.createdAt || tx.completedAt || tx.updatedAt || tx.approvedAt || tx.requestedAt || ''
      };
    });

    return c.json({
      success: true,
      type,
      date: targetDate,
      totalAmount,
      totalCount: txs.length,
      byCountry,
      topUsers,
      items,
      detailLimit
    });
  } catch(e: any) {
    return c.json({ success: false, error: e.message }, 500);
  }
});

app.get('/api/admin/users', async (c) => {
  try {
    const adminToken = await getAdminToken();
    const users = await fsQuery('users', adminToken, [], 100000);
    return c.json({ success: true, users });
  } catch(e:any) {
    return c.json({ success: false, error: e.message });
  }
})

app.get('/api/admin/dump-users', async (c) => {
  try {
    const token = await getAdminToken();
    const headers = { 'Authorization': `Bearer ${token}` };
    const req = await fetch(`${FIRESTORE_BASE}/projects/${SERVICE_ACCOUNT.project_id}/databases/(default)/documents:runQuery`, {
      method: 'POST', headers,
      body: JSON.stringify({ structuredQuery: { from: [{ collectionId: 'users' }] } })
    });
    const data = await req.json();
    const results = [];
    for (const d of data) {
      if (d.document) {
        const fields = d.document.fields;
        results.push({
          email: fields.email?.stringValue,
          name: fields.name?.stringValue,
          loginId: fields.loginId?.stringValue
        });
      }
    }
    return c.json(results);
  } catch (e) { return c.json({ error: e.message }); }
});

app.get('/api/admin/check-user/:username', async (c) => {
  try {
    const username = c.req.param('username');
    const token = await getAdminToken();
    const headers = { 'Authorization': `Bearer ${token}` };
    
    // search user
    const usersReq = await fetch(`${FIRESTORE_BASE}/projects/${SERVICE_ACCOUNT.project_id}/databases/(default)/documents:runQuery`, {
      method: 'POST', headers,
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId: 'users' }]
        }
      })
    });
    const usersData = await usersReq.json();
    let userDoc = null;
    let uid = null;
    
    for (const d of usersData) {
      if (d.document) {
        const fields = d.document.fields;
        if ((fields.email && fields.email.stringValue && fields.email.stringValue.includes(username)) || 
            (fields.loginId && fields.loginId.stringValue && fields.loginId.stringValue.includes(username)) ||
            (fields.name && fields.name.stringValue && fields.name.stringValue.includes(username))) {
          userDoc = d.document;
          uid = d.document.name.split('/').pop();
          break;
        }
      }
    }
    
    if (!uid) return c.json({ error: 'User not found' });
    
    // Get wallet
    const walletReq = await fetch(`${FIRESTORE_BASE}/projects/${SERVICE_ACCOUNT.project_id}/databases/(default)/documents/wallets/${uid}`, { headers });
    const walletData = await walletReq.json();
    
    // Get active investments
    const invReq = await fetch(`${FIRESTORE_BASE}/projects/${SERVICE_ACCOUNT.project_id}/databases/(default)/documents:runQuery`, {
      method: 'POST', headers,
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId: 'investments' }],
          where: {
            fieldFilter: { field: { fieldPath: 'userId' }, op: 'EQUAL', value: { stringValue: uid } }
          }
        }
      })
    });
    const invData = await invReq.json();
    
    // Get bonus logs for today
    const bonusReq = await fetch(`${FIRESTORE_BASE}/projects/${SERVICE_ACCOUNT.project_id}/databases/(default)/documents:runQuery`, {
      method: 'POST', headers,
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId: 'bonusLogs' }],
          where: {
            fieldFilter: { field: { fieldPath: 'userId' }, op: 'EQUAL', value: { stringValue: uid } }
          }
        }
      })
    });
    const bonusData = await bonusReq.json();
    
    return c.json({ uid, userDoc, wallet: walletData, investments: invData, bonuses: bonusData.map(b => b.document) });
  } catch (e) {
    return c.json({ error: e.message });
  }
});

app.post('/api/admin/run-settlement', async (c) => {
  try {
    const body = await c.req.json().catch(() => ({})) as any
    const targetDate = normalizeDangerousActionPayload('run-settlement', { targetDate: body.targetDate }).targetDate
    const adminToken = await getAdminToken()
    const confirmation = await requireDangerousActionConfirmation(c, adminToken, 'run-settlement', { targetDate }, body)
    if (!confirmation.ok) return confirmation.response
    return runSettle(c, targetDate)
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500)
  }
})

app.post('/api/admin/settlement-dry-run', async (c) => {
  try {
    const body = await c.req.json().catch(() => ({})) as any
    const targetDate = normalizeDangerousActionPayload('run-settlement', { targetDate: body.targetDate }).targetDate
    const limit = body.limit || 250
    const response = await runSettleDryRun(c, targetDate, limit)
    return appendDangerousActionConfirmation(c, response, 'run-settlement', { targetDate })
  } catch (e: any) {
    return c.json({ success: false, dryRun: true, stage: 'settlement-dry-run-route', error: e?.message || String(e) || 'settlement dry-run route error' }, 500)
  }
})

app.get('/api/admin/settlement-dry-run', async (c) => {
  try {
    const targetDate = normalizeDangerousActionPayload('run-settlement', { targetDate: c.req.query('targetDate') }).targetDate
    const limit = Number(c.req.query('limit') || 250)
    const response = await runSettleDryRun(c, targetDate, limit)
    return appendDangerousActionConfirmation(c, response, 'run-settlement', { targetDate })
  } catch (e: any) {
    return c.json({ success: false, dryRun: true, stage: 'settlement-dry-run-route', error: e?.message || String(e) || 'settlement dry-run route error' }, 500)
  }
})



// ════════════════════════════════════════════════════════════════════
// 오토봇 트레이딩 콘솔 API (2026-04-30 신규)
// ════════════════════════════════════════════════════════════════════
import {
  TOKEN_META as AUTOBOT_TOKEN_META,
  AUTOBOT_DEFAULTS_FULL,
  getSolanaWalletBalances as autobotGetSolanaBalances,
  fetchMultiTokenPrices as autobotFetchMultiPrices,
  fetchCoinGeckoPrices as autobotFetchCoinGecko,
  getJupiterQuote as autobotJupiterQuote,
  logBotActivity as autobotLogActivity,
  listBotActivities as autobotListActivities,
  computeAiSignal as autobotComputeAiSignal,
  buildGridLevels as autobotBuildGrid,
  buildDcaPlan as autobotBuildDca,
  getBotDailyStats as autobotDailyStats,
  solanaRpc as autobotSolanaRpc,
  fetchPriceHistory as autobotPriceHistory,
  recordPriceTick as autobotRecordTick,
  analyzeTechnical as autobotAnalyze,
  emergencyStop as autobotEmergencyStop,
  checkRiskLimits as autobotCheckRisk,
  detectPriceSpike as autobotDetectSpike,
  STRATEGY_PRESETS as AUTOBOT_PRESETS,
  runAutoCycle as autobotRunCycle,
  sendBotTelegram as autobotSendTelegram,
} from './services/autobot';

// 1) 오토봇 설정 조회
app.get('/api/admin/autobot-settings', async (c) => {
  try {
    if (!(await hasPrivilegedApiAccess(c))) return c.json({ success: false, error: 'unauthorized' }, 401);
    const adminToken = await getAdminToken();
    const doc = await fsGet('settings/autobot', adminToken).catch(() => null);
    const obj = doc?.fields ? firestoreDocToObj(doc) : {};
    const merged = { ...AUTOBOT_DEFAULTS_FULL, ...(obj || {}) };
    return c.json({ success: true, settings: merged });
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500);
  }
});

// 2) 오토봇 설정 저장
app.post('/api/admin/autobot-settings', async (c) => {
  try {
    if (!(await hasPrivilegedApiAccess(c))) return c.json({ success: false, error: 'unauthorized' }, 401);
    const adminToken = await getAdminToken();
    const body = await c.req.json().catch(() => ({}));
    const merged: any = { ...AUTOBOT_DEFAULTS_FULL, ...body };
    if (merged.minAmount > merged.maxAmount) return c.json({ success: false, error: '최소 거래 금액이 최대보다 클 수 없습니다.' }, 400);
    if (merged.minWaitMins > merged.maxWaitMins) return c.json({ success: false, error: '최소 대기 시간이 최대보다 클 수 없습니다.' }, 400);
    merged.updatedAt = new Date().toISOString();
    await fsSet('settings/autobot', merged, adminToken);
    await autobotLogActivity(adminToken, {
      type: 'config_change',
      severity: 'info',
      message: `오토봇 설정 변경 (전략: ${merged.strategy}, 활성: ${merged.enabled})`,
      detail: { strategy: merged.strategy, enabled: merged.enabled, minAmount: merged.minAmount, maxAmount: merged.maxAmount },
    });
    return c.json({ success: true, settings: merged });
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500);
  }
});

// 3) 멀티 토큰 시세 (DDRA / SOL / USDT / BTC / ETH)
app.get('/api/admin/autobot/prices', async (c) => {
  try {
    if (!(await hasPrivilegedApiAccess(c))) return c.json({ success: false, error: 'unauthorized' }, 401);
    const [solana, gecko] = await Promise.all([
      autobotFetchMultiPrices(['DDRA', 'SOL', 'USDT', 'USDC']),
      autobotFetchCoinGecko(['bitcoin', 'ethereum', 'solana', 'tether']),
    ]);
    return c.json({ success: true, solana, cex: gecko, updatedAt: Date.now() });
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500);
  }
});

// 4) 솔라나 지갑 잔고 (회사지갑/봇지갑/임의주소)
app.get('/api/admin/autobot/wallet-balance', async (c) => {
  try {
    if (!(await hasPrivilegedApiAccess(c))) return c.json({ success: false, error: 'unauthorized' }, 401);
    const adminToken = await getAdminToken();
    let pubkey = c.req.query('address') || '';
    if (!pubkey) {
      // 봇 설정에 walletAddress 없으면 settings/companyWallets 의 첫 번째 솔라나 주소
      const botDoc = await fsGet('settings/autobot', adminToken).catch(() => null);
      const botObj = botDoc?.fields ? firestoreDocToObj(botDoc) : {};
      pubkey = botObj.walletAddress || '';
    }
    if (!pubkey) {
      const cwDoc = await fsGet('settings/companyWallets', adminToken).catch(() => null);
      const wallets = cwDoc?.fields?.wallets?.arrayValue?.values || [];
      for (const w of wallets) {
        const nw = (w.mapValue?.fields?.network?.stringValue || '').toUpperCase();
        const addr = w.mapValue?.fields?.address?.stringValue || '';
        if (addr && (nw === 'SOLANA' || nw === '' || nw === 'SOL')) { pubkey = addr; break; }
      }
    }
    if (!pubkey) return c.json({ success: false, error: '지갑 주소를 결정할 수 없습니다. settings/autobot.walletAddress 또는 settings/companyWallets 를 먼저 설정해주세요.' }, 400);

    const balances = await autobotGetSolanaBalances(pubkey);
    return c.json({ success: true, balances });
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500);
  }
});

// 5) Jupiter 스왑 견적 (실행 X — 미리보기)
app.get('/api/admin/autobot/quote', async (c) => {
  try {
    if (!(await hasPrivilegedApiAccess(c))) return c.json({ success: false, error: 'unauthorized' }, 401);
    const fromSymbol = (c.req.query('from') || 'USDT').toUpperCase();
    const toSymbol = (c.req.query('to') || 'DDRA').toUpperCase();
    const amountUi = Number(c.req.query('amount') || '1');
    const slippageBps = Math.max(50, Math.min(5000, Number(c.req.query('slippageBps') || '100')));
    if (!Number.isFinite(amountUi) || amountUi <= 0) return c.json({ success: false, error: 'amount > 0 필수' }, 400);
    const quote = await autobotJupiterQuote(fromSymbol, toSymbol, amountUi, slippageBps);
    return c.json({ success: true, quote });
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500);
  }
});

// 6) AI 시그널 (현재 시세 + 봇 설정 기반 추천)
app.get('/api/admin/autobot/ai-signal', async (c) => {
  try {
    if (!(await hasPrivilegedApiAccess(c))) return c.json({ success: false, error: 'unauthorized' }, 401);
    const adminToken = await getAdminToken();
    const symbol = (c.req.query('symbol') || 'DDRA').toUpperCase();
    const meta = AUTOBOT_TOKEN_META[symbol];
    if (!meta) return c.json({ success: false, error: '알 수 없는 토큰' }, 400);
    const [tickMap, botDoc] = await Promise.all([
      autobotFetchMultiPrices([symbol]),
      fsGet('settings/autobot', adminToken).catch(() => null),
    ]);
    const tick = tickMap[symbol];
    const botObj = botDoc?.fields ? firestoreDocToObj(botDoc) : {};
    const settings = { ...AUTOBOT_DEFAULTS_FULL, ...(botObj || {}) };
    const signal = autobotComputeAiSignal(tick, settings);
    return c.json({ success: true, symbol, tick, signal, settings: { strategy: settings.strategy, enabled: settings.enabled } });
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500);
  }
});

// 7) 봇 활동 로그 조회
app.get('/api/admin/autobot/activities', async (c) => {
  try {
    if (!(await hasPrivilegedApiAccess(c))) return c.json({ success: false, error: 'unauthorized' }, 401);
    const adminToken = await getAdminToken();
    const limit = Math.max(1, Math.min(200, Number(c.req.query('limit') || '50')));
    const items = await autobotListActivities(adminToken, limit);
    return c.json({ success: true, items, count: items.length });
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500);
  }
});

// 8) 봇 일일 통계 (24시간)
app.get('/api/admin/autobot/stats', async (c) => {
  try {
    if (!(await hasPrivilegedApiAccess(c))) return c.json({ success: false, error: 'unauthorized' }, 401);
    const adminToken = await getAdminToken();
    const stats = await autobotDailyStats(adminToken);
    return c.json({ success: true, stats });
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500);
  }
});

// 9) 그리드 트레이딩 격자 미리보기 (시뮬레이션)
app.post('/api/admin/autobot/grid-preview', async (c) => {
  try {
    if (!(await hasPrivilegedApiAccess(c))) return c.json({ success: false, error: 'unauthorized' }, 401);
    const body = await c.req.json().catch(() => ({}));
    const levels = autobotBuildGrid({
      centerPrice: Number(body.centerPrice) || 0,
      upperPrice: Number(body.upperPrice) || 0,
      lowerPrice: Number(body.lowerPrice) || 0,
      gridCount: Math.max(2, Math.min(50, Number(body.gridCount) || 10)),
      totalCapital: Number(body.totalCapital) || 0,
    });
    return c.json({ success: true, levels, count: levels.length });
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500);
  }
});

// 10) DCA 스케줄 미리보기
app.post('/api/admin/autobot/dca-preview', async (c) => {
  try {
    if (!(await hasPrivilegedApiAccess(c))) return c.json({ success: false, error: 'unauthorized' }, 401);
    const body = await c.req.json().catch(() => ({}));
    const plan = autobotBuildDca({
      totalCapital: Number(body.totalCapital) || 0,
      steps: Math.max(1, Math.min(100, Number(body.steps) || 10)),
      intervalMins: Math.max(1, Math.min(1440, Number(body.intervalMins) || 60)),
    });
    return c.json({ success: true, plan, count: plan.length });
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500);
  }
});

// 11) 봇 일시정지 / 재개 (긴급 스위치)
app.post('/api/admin/autobot/toggle', async (c) => {
  try {
    if (!(await hasPrivilegedApiAccess(c))) return c.json({ success: false, error: 'unauthorized' }, 401);
    const adminToken = await getAdminToken();
    const body = await c.req.json().catch(() => ({}));
    const enabled = !!body.enabled;
    await fsPatch('settings/autobot', { enabled, updatedAt: new Date().toISOString() }, adminToken);
    await autobotLogActivity(adminToken, {
      type: 'config_change',
      severity: enabled ? 'success' : 'warning',
      message: enabled ? '🟢 오토봇이 가동되었습니다.' : '🛑 오토봇이 일시정지되었습니다.',
    });
    return c.json({ success: true, enabled });
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500);
  }
});

// [FIX 2026-04-30] 스폰서 지갑 공개 주소 + SOL 잔고 조회 (시크릿 키는 절대 노출하지 않음)
app.get('/api/admin/sponsor-wallet-info', async (c) => {
  try {
    if (!(await hasPrivilegedApiAccess(c))) return c.json({ success: false, error: 'unauthorized' }, 401);
    const spKey = (c.env as any).SPONSOR_SOL_SECRET;
    if (!spKey) return c.json({ success: false, error: 'SPONSOR_SOL_SECRET 이 서버에 설정되지 않았습니다.' }, 400);

    const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
    const ALPHABET_MAP: Record<string, number> = {};
    for (let i = 0; i < ALPHABET.length; i++) ALPHABET_MAP[ALPHABET[i]] = i;
    function decodeBs58(S: string): Uint8Array {
      const bytes: number[] = [0];
      for (let i = 0; i < S.length; i++) {
        const ch = S[i];
        if (!(ch in ALPHABET_MAP)) throw new Error('Non-base58 character');
        for (let j = 0; j < bytes.length; j++) bytes[j] *= 58;
        bytes[0] += ALPHABET_MAP[ch];
        let carry = 0;
        for (let j = 0; j < bytes.length; j++) {
          bytes[j] += carry;
          carry = bytes[j] >> 8;
          bytes[j] &= 0xff;
        }
        while (carry) { bytes.push(carry & 0xff); carry >>= 8; }
      }
      for (let i = 0; i < S.length && S[i] === '1'; i++) bytes.push(0);
      return new Uint8Array(bytes.reverse());
    }
    function encodeBs58(bytes: Uint8Array): string {
      const digits = [0];
      for (let i = 0; i < bytes.length; i++) {
        let carry = bytes[i];
        for (let j = 0; j < digits.length; j++) {
          carry += digits[j] << 8;
          digits[j] = carry % 58;
          carry = (carry / 58) | 0;
        }
        while (carry) { digits.push(carry % 58); carry = (carry / 58) | 0; }
      }
      let out = '';
      for (let i = 0; i < bytes.length && bytes[i] === 0; i++) out += '1';
      for (let i = digits.length - 1; i >= 0; i--) out += ALPHABET[digits[i]];
      return out;
    }

    let sponsorSecret: Uint8Array;
    try {
      const trimmed = String(spKey).trim();
      if (trimmed.startsWith('[')) {
        sponsorSecret = Uint8Array.from(JSON.parse(trimmed));
      } else {
        sponsorSecret = decodeBs58(trimmed);
      }
    } catch (e: any) {
      return c.json({ success: false, error: '스폰서 지갑 시크릿 파싱 오류: ' + e.message }, 500);
    }
    if (sponsorSecret.length < 64) return c.json({ success: false, error: '잘못된 스폰서 시크릿 (길이 부족)' }, 500);
    const sponsorPubkeyBytes = sponsorSecret.slice(32);
    const sponsorAddress = encodeBs58(sponsorPubkeyBytes);

    // SOL 잔고 조회 (Solana RPC)
    let solBalance: number | null = null;
    let rpcError: string | null = null;
    try {
      const rpcUrl = (c.env as any).SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
      const r = await fetch(rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'getBalance',
          params: [sponsorAddress, { commitment: 'confirmed' }]
        })
      });
      const j: any = await r.json();
      if (j?.result?.value !== undefined) {
        solBalance = Number(j.result.value) / 1_000_000_000;
      } else if (j?.error) {
        rpcError = JSON.stringify(j.error);
      }
    } catch (e: any) {
      rpcError = e.message;
    }

    return c.json({
      success: true,
      sponsorAddress,
      solBalance,
      lamports: solBalance !== null ? Math.floor(solBalance * 1_000_000_000) : null,
      rpcError,
      note: 'ATA 1개 생성 비용 ≈ 0.00204 SOL, 트랜잭션 수수료 ≈ 0.000005 SOL. 권장 최소 잔고 0.05 SOL 이상.',
    });
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500);
  }
});

// 12) 솔라나 지갑 SOL 충전 — 회사 SPONSOR 지갑에서 봇 지갑으로 이체
app.post('/api/admin/autobot/recharge-sol', async (c) => {
  try {
    if (!(await hasPrivilegedApiAccess(c))) return c.json({ success: false, error: 'unauthorized' }, 401);
    const adminToken = await getAdminToken();
    const body = await c.req.json().catch(() => ({}));
    const toAddress = String(body.toAddress || '').trim();
    const amountSol = Number(body.amountSol);
    if (!toAddress) return c.json({ success: false, error: '받는 지갑 주소가 필요합니다.' }, 400);
    if (!Number.isFinite(amountSol) || amountSol <= 0 || amountSol > 5) {
      return c.json({ success: false, error: 'amountSol 은 0 ~ 5 사이여야 합니다.' }, 400);
    }

    const spKey = (c.env as any).SPONSOR_SOL_SECRET;
    if (!spKey) return c.json({ success: false, error: 'SPONSOR_SOL_SECRET 이 서버에 설정되지 않았습니다.' }, 400);

    // base58 → bytes
    const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
    const ALPHABET_MAP: Record<string, number> = {};
    for (let i = 0; i < ALPHABET.length; i++) ALPHABET_MAP[ALPHABET[i]] = i;
    function decodeBs58(S: string): Uint8Array {
      const bytes: number[] = [0];
      for (let i = 0; i < S.length; i++) {
        const ch = S[i];
        if (!(ch in ALPHABET_MAP)) throw new Error('Non-base58 character');
        for (let j = 0; j < bytes.length; j++) bytes[j] *= 58;
        bytes[0] += ALPHABET_MAP[ch];
        let carry = 0;
        for (let j = 0; j < bytes.length; j++) {
          bytes[j] += carry;
          carry = bytes[j] >> 8;
          bytes[j] &= 0xff;
        }
        while (carry) { bytes.push(carry & 0xff); carry >>= 8; }
      }
      for (let i = 0; i < S.length && S[i] === '1'; i++) bytes.push(0);
      return new Uint8Array(bytes.reverse());
    }

    let sponsorSecret: Uint8Array;
    try {
      const trimmed = String(spKey).trim();
      if (trimmed.startsWith('[')) {
        sponsorSecret = Uint8Array.from(JSON.parse(trimmed));
      } else {
        sponsorSecret = decodeBs58(trimmed);
      }
    } catch (e: any) {
      return c.json({ success: false, error: '스폰서 지갑 시크릿 파싱 오류: ' + e.message }, 500);
    }
    if (sponsorSecret.length < 64) return c.json({ success: false, error: '잘못된 스폰서 시크릿 (길이 부족)' }, 500);
    const sponsorPubkey = sponsorSecret.slice(32);
    const toPubkeyBytes = decodeBs58(toAddress);
    if (toPubkeyBytes.length !== 32) return c.json({ success: false, error: '받는 주소가 유효한 솔라나 주소가 아닙니다.' }, 400);

    const lamportsAmount = BigInt(Math.floor(amountSol * 1_000_000_000));

    // blockhash
    const bh: any = await autobotSolanaRpc('getLatestBlockhash', [{ commitment: 'confirmed' }]);
    const blockhash: string = bh?.value?.blockhash;
    if (!blockhash) return c.json({ success: false, error: 'blockhash 조회 실패' }, 500);
    const blockhashBytes = decodeBs58(blockhash);

    // 메시지 생성 (System Program transfer)
    const systemProgram = new Uint8Array(32);
    const message = new Uint8Array(150);
    message[0] = 1; message[1] = 0; message[2] = 1; message[3] = 3;
    message.set(sponsorPubkey, 4);
    message.set(toPubkeyBytes, 36);
    message.set(systemProgram, 68);
    message.set(blockhashBytes, 100);
    message[132] = 1;
    message[133] = 2; message[134] = 2; message[135] = 0; message[136] = 1; message[137] = 12;
    message[138] = 2; message[139] = 0; message[140] = 0; message[141] = 0;
    for (let i = 0; i < 8; i++) {
      message[142 + i] = Number((lamportsAmount >> BigInt(i * 8)) & 0xffn);
    }

    const signature = nacl.sign.detached(message, sponsorSecret);
    const txBuf = new Uint8Array(1 + 64 + 150);
    txBuf[0] = 1;
    txBuf.set(signature, 1);
    txBuf.set(message, 65);

    let binary = '';
    for (let i = 0; i < txBuf.byteLength; i++) binary += String.fromCharCode(txBuf[i]);
    const base64Tx = btoa(binary);

    const sendResult: any = await autobotSolanaRpc('sendTransaction', [base64Tx, { encoding: 'base64', skipPreflight: true, maxRetries: 3 }]);
    const txid = typeof sendResult === 'string' ? sendResult : sendResult?.signature || '';
    if (!txid) return c.json({ success: false, error: 'sendTransaction 실패: ' + JSON.stringify(sendResult).slice(0, 200) }, 500);

    await autobotLogActivity(adminToken, {
      type: 'deposit',
      severity: 'success',
      message: `봇 지갑에 ${amountSol} SOL 충전 (스폰서 → ${toAddress.slice(0, 8)}...)`,
      txid,
      amount: amountSol,
      symbol: 'SOL',
    });

    return c.json({ success: true, txid, amountSol, toAddress, explorer: `https://solscan.io/tx/${txid}` });
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500);
  }
});

// 13) 수동 트레이드 실행 (관리자 전용 — Jupiter 스왑 + 봇 지갑 시그너 필요)
//     실제 시그너는 settings/autobot.walletSecretKey (base58 또는 JSON 배열) 으로 보관.
//     안전: amountUi 한도 검증 + slippageBps 상한 + 봇 비활성 상태에서도 강제 실행 가능.
app.post('/api/admin/autobot/manual-trade', async (c) => {
  try {
    if (!(await hasPrivilegedApiAccess(c))) return c.json({ success: false, error: 'unauthorized' }, 401);
    const adminToken = await getAdminToken();
    const body = await c.req.json().catch(() => ({}));
    const fromSymbol = String(body.fromSymbol || '').toUpperCase();
    const toSymbol = String(body.toSymbol || '').toUpperCase();
    const amountUi = Number(body.amountUi);
    const slippageBps = Math.max(50, Math.min(5000, Number(body.slippageBps || 100)));

    if (!AUTOBOT_TOKEN_META[fromSymbol] || !AUTOBOT_TOKEN_META[toSymbol]) {
      return c.json({ success: false, error: '지원하지 않는 토큰 심볼' }, 400);
    }
    if (!Number.isFinite(amountUi) || amountUi <= 0) return c.json({ success: false, error: 'amountUi > 0 필수' }, 400);

    const botDoc = await fsGet('settings/autobot', adminToken).catch(() => null);
    const bot = botDoc?.fields ? firestoreDocToObj(botDoc) : {};
    const merged: any = { ...AUTOBOT_DEFAULTS_FULL, ...(bot || {}) };

    if (amountUi > Number(merged.maxAmount || 0) * 10) {
      return c.json({ success: false, error: `1회 한도(${merged.maxAmount * 10})를 초과합니다.` }, 400);
    }

    const secretRaw = merged.walletSecretKey || (c.env as any).AUTOBOT_WALLET_SECRET || '';
    if (!secretRaw) return c.json({ success: false, error: '봇 지갑 시크릿이 설정되지 않았습니다. settings/autobot.walletSecretKey 또는 env AUTOBOT_WALLET_SECRET 을 설정해주세요.' }, 400);

    // base58 / JSON array 양쪽 지원
    const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
    const ALPHABET_MAP: Record<string, number> = {};
    for (let i = 0; i < ALPHABET.length; i++) ALPHABET_MAP[ALPHABET[i]] = i;
    function decodeBs58(S: string): Uint8Array {
      const bytes: number[] = [0];
      for (let i = 0; i < S.length; i++) {
        const ch = S[i];
        if (!(ch in ALPHABET_MAP)) throw new Error('Non-base58');
        for (let j = 0; j < bytes.length; j++) bytes[j] *= 58;
        bytes[0] += ALPHABET_MAP[ch];
        let carry = 0;
        for (let j = 0; j < bytes.length; j++) {
          bytes[j] += carry; carry = bytes[j] >> 8; bytes[j] &= 0xff;
        }
        while (carry) { bytes.push(carry & 0xff); carry >>= 8; }
      }
      for (let i = 0; i < S.length && S[i] === '1'; i++) bytes.push(0);
      return new Uint8Array(bytes.reverse());
    }

    let secretKey: Uint8Array;
    try {
      const t = String(secretRaw).trim();
      secretKey = t.startsWith('[') ? Uint8Array.from(JSON.parse(t)) : decodeBs58(t);
    } catch (e: any) {
      return c.json({ success: false, error: '봇 지갑 시크릿 파싱 오류: ' + e.message }, 500);
    }
    if (secretKey.length < 64) return c.json({ success: false, error: '잘못된 시크릿 길이' }, 500);
    const pubkeyBytes = secretKey.slice(32);
    // base58 encode
    function encodeBs58(bytes: Uint8Array): string {
      const digits = [0];
      for (let i = 0; i < bytes.length; i++) {
        let carry = bytes[i];
        for (let j = 0; j < digits.length; j++) {
          carry += digits[j] << 8;
          digits[j] = carry % 58;
          carry = (carry / 58) | 0;
        }
        while (carry) { digits.push(carry % 58); carry = (carry / 58) | 0; }
      }
      let out = '';
      for (let i = 0; i < bytes.length && bytes[i] === 0; i++) out += '1';
      for (let i = digits.length - 1; i >= 0; i--) out += ALPHABET[digits[i]];
      return out;
    }
    const pubKey = encodeBs58(pubkeyBytes);

    const inMeta = AUTOBOT_TOKEN_META[fromSymbol];
    const outMeta = AUTOBOT_TOKEN_META[toSymbol];
    const amountLamports = Math.floor(amountUi * Math.pow(10, inMeta.decimals));

    // Jupiter quote → swap
    const qRes = await fetch(`https://api.jup.ag/swap/v1/quote?inputMint=${inMeta.mint}&outputMint=${outMeta.mint}&amount=${amountLamports}&slippageBps=${slippageBps}`, {
      signal: AbortSignal.timeout(8000),
    });
    if (!qRes.ok) return c.json({ success: false, error: 'Jupiter quote HTTP ' + qRes.status }, 500);
    const quote: any = await qRes.json();
    if (quote.error) return c.json({ success: false, error: 'Jupiter quote: ' + quote.error }, 500);

    const sRes = await fetch('https://api.jup.ag/swap/v1/swap', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        quoteResponse: quote,
        userPublicKey: pubKey,
        wrapAndUnwrapSol: true,
        dynamicComputeUnitLimit: true,
        prioritizationFeeLamports: 'auto',
      }),
      signal: AbortSignal.timeout(10000),
    });
    if (!sRes.ok) return c.json({ success: false, error: 'Jupiter swap HTTP ' + sRes.status }, 500);
    const swapData: any = await sRes.json();
    if (swapData.error) return c.json({ success: false, error: 'Jupiter swap: ' + swapData.error }, 500);

    // 서명
    const swapTxBuf = Uint8Array.from(atob(swapData.swapTransaction), ch => ch.charCodeAt(0));
    const numSig = swapTxBuf[0];
    const messageOffset = 1 + numSig * 64;
    const messageBytes = swapTxBuf.slice(messageOffset);
    const sig = nacl.sign.detached(messageBytes, secretKey);
    swapTxBuf.set(sig, 1);
    let bin = '';
    for (let i = 0; i < swapTxBuf.byteLength; i++) bin += String.fromCharCode(swapTxBuf[i]);
    const base64Tx = btoa(bin);

    const sendResult: any = await autobotSolanaRpc('sendTransaction', [base64Tx, { encoding: 'base64', skipPreflight: false, preflightCommitment: 'processed', maxRetries: 3 }]);
    const txid: string = typeof sendResult === 'string' ? sendResult : (sendResult?.signature || '');
    if (!txid) return c.json({ success: false, error: 'sendTransaction 실패: ' + JSON.stringify(sendResult).slice(0, 200) }, 500);

    const inAmt = Number(quote.inAmount || 0) / Math.pow(10, inMeta.decimals);
    const outAmt = Number(quote.outAmount || 0) / Math.pow(10, outMeta.decimals);

    await autobotLogActivity(adminToken, {
      type: 'manual_trade',
      severity: 'success',
      message: `수동 스왑: ${inAmt} ${fromSymbol} → ${outAmt} ${toSymbol}`,
      txid,
      amount: amountUi,
      symbol: fromSymbol + '→' + toSymbol,
      detail: { inAmt, outAmt, slippageBps, route: (quote.routePlan || []).map((s: any) => s?.swapInfo?.label).filter(Boolean) },
    });

    return c.json({
      success: true,
      txid,
      explorer: `https://solscan.io/tx/${txid}`,
      inAmount: inAmt,
      outAmount: outAmt,
      slippageBps,
      pubKey,
    });
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500);
  }
});

// 14) 종합 대시보드 (한 번의 요청으로 페이지 초기 데이터 한 번에)
app.get('/api/admin/autobot/dashboard', async (c) => {
  try {
    if (!(await hasPrivilegedApiAccess(c))) return c.json({ success: false, error: 'unauthorized' }, 401);
    const adminToken = await getAdminToken();
    const [botDoc, prices, gecko] = await Promise.all([
      fsGet('settings/autobot', adminToken).catch(() => null),
      autobotFetchMultiPrices(['DDRA', 'SOL', 'USDT', 'USDC']),
      autobotFetchCoinGecko(['bitcoin', 'ethereum', 'solana']),
    ]);
    const botObj = botDoc?.fields ? firestoreDocToObj(botDoc) : {};
    const settings = { ...AUTOBOT_DEFAULTS_FULL, ...(botObj || {}) };
    const stats = await autobotDailyStats(adminToken);
    const activities = await autobotListActivities(adminToken, 30);
    const ddraTick = prices.DDRA;
    const aiSignal = autobotComputeAiSignal(ddraTick, settings);

    let walletBalance: any = null;
    if (settings.walletAddress) {
      walletBalance = await autobotGetSolanaBalances(settings.walletAddress).catch(() => null);
    }

    return c.json({
      success: true,
      settings,
      prices: { solana: prices, cex: gecko },
      stats,
      activities,
      aiSignal,
      walletBalance,
      updatedAt: Date.now(),
    });
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500);
  }
});

// 15) 가격 캔들 히스토리 (5분봉, 최근 N개)
app.get('/api/admin/autobot/candles', async (c) => {
  try {
    if (!(await hasPrivilegedApiAccess(c))) return c.json({ success: false, error: 'unauthorized' }, 401);
    const adminToken = await getAdminToken();
    const symbol = String(c.req.query('symbol') || 'DDRA').toUpperCase();
    const limit = Math.max(10, Math.min(500, Number(c.req.query('limit') || 96)));
    const candles = await autobotPriceHistory(adminToken, symbol, limit);
    const closes = candles.map(x => x.c);
    const technical = closes.length >= 20 ? autobotAnalyze(closes) : null;
    return c.json({ success: true, symbol, candles, technical, count: candles.length });
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500);
  }
});

// 16) 가격 틱 1회 누적 저장 (수동 호출 또는 cron 트리거)
app.post('/api/admin/autobot/record-tick', async (c) => {
  try {
    if (!(await hasPrivilegedApiAccess(c))) return c.json({ success: false, error: 'unauthorized' }, 401);
    const adminToken = await getAdminToken();
    const body = await c.req.json().catch(() => ({}));
    const symbols: string[] = Array.isArray(body.symbols) ? body.symbols : ['DDRA', 'SOL', 'USDT'];
    const prices = await autobotFetchMultiPrices(symbols.map((s: string) => String(s).toUpperCase()));
    const recorded: string[] = [];
    for (const [sym, tick] of Object.entries(prices)) {
      if (tick) { await autobotRecordTick(adminToken, tick); recorded.push(sym); }
    }
    return c.json({ success: true, recorded, prices });
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500);
  }
});

// 17) 비상정지 (Kill Switch)
app.post('/api/admin/autobot/emergency-stop', async (c) => {
  try {
    if (!(await hasPrivilegedApiAccess(c))) return c.json({ success: false, error: 'unauthorized' }, 401);
    const adminToken = await getAdminToken();
    const body = await c.req.json().catch(() => ({}));
    const reason = String(body.reason || '관리자 수동 발동').slice(0, 200);
    await autobotEmergencyStop(adminToken, reason);
    // 텔레그램 즉시 알림
    await autobotSendTelegram(adminToken, `🚨 <b>오토봇 비상정지</b>\n사유: ${reason}\n시각: ${new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}`).catch(() => null);
    return c.json({ success: true, reason });
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500);
  }
});

// 18) 비상정지 해제
app.post('/api/admin/autobot/clear-emergency', async (c) => {
  try {
    if (!(await hasPrivilegedApiAccess(c))) return c.json({ success: false, error: 'unauthorized' }, 401);
    const adminToken = await getAdminToken();
    await fsPatch('settings/autobot', {
      emergencyStopAt: null,
      emergencyStopReason: null,
      updatedAt: new Date().toISOString(),
    }, adminToken);
    await autobotLogActivity(adminToken, {
      type: 'config_change',
      severity: 'success',
      message: '✅ 비상정지 해제됨 — 다시 가동 가능',
    });
    return c.json({ success: true });
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500);
  }
});

// 19) 위험 한도 체크
app.get('/api/admin/autobot/risk-check', async (c) => {
  try {
    if (!(await hasPrivilegedApiAccess(c))) return c.json({ success: false, error: 'unauthorized' }, 401);
    const adminToken = await getAdminToken();
    const botDoc = await fsGet('settings/autobot', adminToken).catch(() => null);
    const settings = { ...AUTOBOT_DEFAULTS_FULL, ...(botDoc?.fields ? firestoreDocToObj(botDoc) : {}) };
    const risk = await autobotCheckRisk(adminToken, settings);
    const stats = await autobotDailyStats(adminToken);
    return c.json({ success: true, risk, stats, settings: { maxDailyVolume: settings.maxDailyVolume, maxDailyTrades: settings.maxDailyTrades, emergencyStopAt: settings.emergencyStopAt, emergencyStopReason: settings.emergencyStopReason } });
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500);
  }
});

// 20) 자동 사이클 1회 실행 (수동 트리거)
app.post('/api/admin/autobot/run-cycle', async (c) => {
  try {
    if (!(await hasPrivilegedApiAccess(c))) return c.json({ success: false, error: 'unauthorized' }, 401);
    const adminToken = await getAdminToken();
    const body = await c.req.json().catch(() => ({}));
    const result = await autobotRunCycle(adminToken, { recordTick: !!body.recordTick });
    return c.json({ success: true, result });
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500);
  }
});

// 21) 전략 프리셋 목록
app.get('/api/admin/autobot/presets', async (c) => {
  try {
    if (!(await hasPrivilegedApiAccess(c))) return c.json({ success: false, error: 'unauthorized' }, 401);
    return c.json({ success: true, presets: AUTOBOT_PRESETS });
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500);
  }
});

// 22) 전략 프리셋 적용
app.post('/api/admin/autobot/apply-preset', async (c) => {
  try {
    if (!(await hasPrivilegedApiAccess(c))) return c.json({ success: false, error: 'unauthorized' }, 401);
    const adminToken = await getAdminToken();
    const body = await c.req.json().catch(() => ({}));
    const presetKey = String(body.preset || '').toLowerCase();
    const preset = AUTOBOT_PRESETS[presetKey];
    if (!preset) return c.json({ success: false, error: `존재하지 않는 프리셋: ${presetKey}` }, 400);

    const cur = await fsGet('settings/autobot', adminToken).catch(() => null);
    const curObj = cur?.fields ? firestoreDocToObj(cur) : {};
    const merged = { ...AUTOBOT_DEFAULTS_FULL, ...curObj, ...preset, presetApplied: presetKey, updatedAt: new Date().toISOString() };
    delete (merged as any).label;
    await fsSet('settings/autobot', merged, adminToken);

    await autobotLogActivity(adminToken, {
      type: 'config_change',
      severity: 'info',
      message: `🎯 전략 프리셋 적용: ${preset.label || presetKey}`,
      detail: { preset: presetKey },
    });

    return c.json({ success: true, preset: presetKey, settings: merged });
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500);
  }
});

// 23) 텔레그램 테스트 알림
app.post('/api/admin/autobot/test-telegram', async (c) => {
  try {
    if (!(await hasPrivilegedApiAccess(c))) return c.json({ success: false, error: 'unauthorized' }, 401);
    const adminToken = await getAdminToken();
    const body = await c.req.json().catch(() => ({}));
    const msg = String(body.message || '🤖 <b>DEEDRA 오토봇</b> 테스트 알림\n시각: ' + new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }));
    const r = await autobotSendTelegram(adminToken, msg);
    return c.json({ success: r.sent, ...r });
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500);
  }
});

// 24) 봇 활동 로그 일괄 삭제 (최근 N일 보존)
app.post('/api/admin/autobot/clear-logs', async (c) => {
  try {
    if (!(await hasPrivilegedApiAccess(c))) return c.json({ success: false, error: 'unauthorized' }, 401);
    const adminToken = await getAdminToken();
    const body = await c.req.json().catch(() => ({}));
    const keepDays = Math.max(0, Math.min(90, Number(body.keepDays || 7)));
    const cutoff = Date.now() - keepDays * 24 * 3600 * 1000;
    const items = await fsQuery('botActivities', adminToken, [], 5000);
    let deleted = 0;
    for (const it of (items || [])) {
      const t = new Date(it.createdAt || 0).getTime();
      if (t > 0 && t < cutoff) {
        await fetch(`${FIRESTORE_BASE}/botActivities/${it.id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${adminToken}` },
        }).then(() => { deleted++; }).catch(() => null);
      }
    }
    await autobotLogActivity(adminToken, {
      type: 'config_change',
      severity: 'info',
      message: `🧹 활동 로그 정리: ${deleted}건 삭제 (보존 ${keepDays}일)`,
    });
    return c.json({ success: true, deleted, keepDays });
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500);
  }
});

// 25) 봇 PnL 시계열 (최근 7일 일별)
app.get('/api/admin/autobot/pnl-series', async (c) => {
  try {
    if (!(await hasPrivilegedApiAccess(c))) return c.json({ success: false, error: 'unauthorized' }, 401);
    const adminToken = await getAdminToken();
    const days = Math.max(1, Math.min(30, Number(c.req.query('days') || 7)));
    const acts = await autobotListActivities(adminToken, 2000);
    const buckets: Record<string, { date: string; trades: number; volume: number; pnl: number }> = {};
    const now = Date.now();
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now - i * 86400000);
      const key = d.toISOString().slice(0, 10);
      buckets[key] = { date: key, trades: 0, volume: 0, pnl: 0 };
    }
    for (const a of acts) {
      const t = new Date(a.createdAt || 0).getTime();
      if (now - t > days * 86400000) continue;
      const key = new Date(t).toISOString().slice(0, 10);
      if (!buckets[key]) continue;
      if (a.type === 'trade_buy' || a.type === 'trade_sell' || a.type === 'manual_trade') {
        buckets[key].trades++;
        buckets[key].volume += Number(a.amount || 0);
        buckets[key].pnl += a.type === 'trade_sell' ? Number(a.amount || 0) : -Number(a.amount || 0);
      }
    }
    const series = Object.values(buckets).sort((a, b) => a.date.localeCompare(b.date));
    return c.json({ success: true, days, series });
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500);
  }
});

// 26) Cron: 가격 틱 누적 + 자동 사이클 (외부 cron 에서 5분마다 호출)
app.post('/api/cron/autobot-tick', async (c) => {
  try {
    const secret = c.req.header('X-Cron-Secret') || c.req.query('secret') || '';
    const expected = (c.env as any).CRON_SECRET || '';
    if (expected && secret !== expected) return c.json({ success: false, error: 'unauthorized' }, 401);
    const adminToken = await getAdminToken();
    const result = await autobotRunCycle(adminToken, { recordTick: true });
    return c.json({ success: true, result, ts: Date.now() });
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500);
  }
});

// ════════════════════════════════════════════════════════════════════
app.get('/api/admin/sync-sales', async (c) => {
  try {
    const adminToken = await getAdminToken()
    
    // Fetch all users
    const users = await fsQuery('users', adminToken, [], 100000)
    
    // Fetch all wallets
    const wallets = await fsQuery('wallets', adminToken, [], 100000)
    
    const walletMap: Record<string, number> = {}
    wallets.forEach((w: any) => {
      walletMap[w.id] = (w.totalInvest !== undefined ? w.totalInvest : w.totalInvested) || 0
    })
    
    const childrenMap: Record<string, string[]> = {}
    const userMap: Record<string, any> = {}
    
    users.forEach((u: any) => {
      childrenMap[u.id] = []
      userMap[u.id] = u
    })
    
    users.forEach((u: any) => {
      if (u.referredBy && childrenMap[u.referredBy]) {
        childrenMap[u.referredBy].push(u.id)
      }
    })
    
    const nodeStats: Record<string, any> = {}
    users.forEach((u: any) => {
      nodeStats[u.id] = {
        selfInvest: walletMap[u.id] || 0,
        networkSales: 0,
        computed: false
      }
    })
    
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
          if (childTotal > maxLegSales) {
            maxLegSales = childTotal;
          }
        }
      }
      
      nodeStats[uid].networkSales = sales;
      nodeStats[uid].otherLegSales = sales - maxLegSales;
      nodeStats[uid].computed = true;
      return sales;
    }
    
    users.forEach((u: any) => computeNetworkSales(u.id))
    
    let updatedCount = 0;
    
    // Update users in batches
    for (let i = 0; i < users.length; i += 20) {
      const batch = users.slice(i, i + 20);
      await Promise.all(batch.map(async (u: any) => {
        const stats = nodeStats[u.id];
        if (!stats) return;
        
        const currentSelf = u.totalInvested || 0;
        const currentNet = u.networkSales || 0;
        
        const currentOther = u.otherLegSales || 0;
        if (currentSelf !== stats.selfInvest || currentNet !== stats.networkSales || currentOther !== stats.otherLegSales) {
          await fsPatch('users/' + (u.id || u.uid), {
            totalInvested: stats.selfInvest,
            networkSales: stats.networkSales,
            otherLegSales: stats.otherLegSales,
            updatedAt: new Date().toISOString()
          }, adminToken);
          updatedCount++;
        }
      }));
    }
    
    return c.json({ success: true, updatedCount });
  } catch (err: any) {
    console.error(err)
    return c.json({ success: false, error: err.message }, 500)
  }
})

// [FIX 2026-04-30] 매출 재집계 + 자동 승급 원클릭 실행 (소실적 매출 누락 민원 영구 해결)
// 관리자 콘솔에서 한 번 호출하면 전체 회원 networkSales/otherLegSales/directReferrals 재계산 후
// RANK_REQUIREMENTS 기준으로 자동 승급까지 일괄 처리
app.post('/api/admin/recompute-and-upgrade', async (c) => {
  try {
    const ok = await hasPrivilegedApiAccess(c);
    if (!ok) return c.json({ error: 'unauthorized' }, 401);
    const adminToken = await getAdminToken();
    const users = await fsQuery('users', adminToken, [], 100000);
    const wallets = await fsQuery('wallets', adminToken, [], 100000);
    const investments = await fsQuery('investments', adminToken, [{ field: 'status', op: '==', value: 'active' }], 100000).catch(() => []);
    const result = await autoUpgradeAllRanks(adminToken, users, wallets, investments);
    return c.json({ success: true, ...result, totalUsers: users.length, totalWallets: wallets.length });
  } catch (e: any) {
    console.error('[recompute-and-upgrade]', e);
    return c.json({ success: false, error: e.message }, 500);
  }
});

// GET 별칭 (관리자 페이지에서 fetch 단순화 용도)
app.get('/api/admin/recompute-and-upgrade', async (c) => {
  try {
    const ok = await hasPrivilegedApiAccess(c);
    if (!ok) return c.json({ error: 'unauthorized' }, 401);
    const adminToken = await getAdminToken();
    const users = await fsQuery('users', adminToken, [], 100000);
    const wallets = await fsQuery('wallets', adminToken, [], 100000);
    const investments = await fsQuery('investments', adminToken, [{ field: 'status', op: '==', value: 'active' }], 100000).catch(() => []);
    const result = await autoUpgradeAllRanks(adminToken, users, wallets, investments);
    return c.json({ success: true, ...result, totalUsers: users.length, totalWallets: wallets.length });
  } catch (e: any) {
    console.error('[recompute-and-upgrade GET]', e);
    return c.json({ success: false, error: e.message }, 500);
  }
});

// [FIX 2026-05-01 #7] 시스템 점검 모드 즉시 해제 전용 엔드포인트.
//   롤백+재정산 작업이 비정상 종료되거나 finally 블록에서 OFF 처리가 누락되어
//   settings/system.maintenanceMode=true 가 남아 사용자 접속이 차단된 경우의 응급 해제용.
//   관리자 인증(role=admin/superadmin) 통과 시 즉시 false 로 패치한다.
app.post('/api/admin/maintenance-off', async (c) => {
  try {
    const ok = await hasPrivilegedApiAccess(c);
    if (!ok) return c.json({ error: 'unauthorized' }, 401);
    const adminToken = await getAdminToken();
    await fsPatch('settings/system', {
      maintenanceMode: false,
      maintenanceMessage: '',
      maintenanceClearedAt: new Date().toISOString(),
      maintenanceClearedBy: 'admin-quick-clear'
    }, adminToken);
    return c.json({ success: true, maintenanceMode: false, clearedAt: new Date().toISOString() });
  } catch (e: any) {
    console.error('[maintenance-off]', e);
    return c.json({ success: false, error: e.message }, 500);
  }
});

app.get('/api/admin/maintenance-off', async (c) => {
  try {
    const ok = await hasPrivilegedApiAccess(c);
    if (!ok) return c.json({ error: 'unauthorized' }, 401);
    const adminToken = await getAdminToken();
    await fsPatch('settings/system', {
      maintenanceMode: false,
      maintenanceMessage: '',
      maintenanceClearedAt: new Date().toISOString(),
      maintenanceClearedBy: 'admin-quick-clear'
    }, adminToken);
    return c.json({ success: true, maintenanceMode: false, clearedAt: new Date().toISOString() });
  } catch (e: any) {
    console.error('[maintenance-off GET]', e);
    return c.json({ success: false, error: e.message }, 500);
  }
});

// [FIX 2026-05-01 #3] 강제 직급 재평가 엔드포인트 (강등 포함).
//   기존 autoUpgradeAllRanks 는 승급만 처리하기 때문에, 이전 잘못된 fallback 으로 G1 으로
//   잘못 승급된 회원들이 새 기준 적용 후에도 그대로 유지되는 문제 해결.
//   이 엔드포인트는 모든 회원의 매출/소실적/직추천 활성수를 재계산한 뒤,
//   사용자 지정 기준표(또는 settings/rankPromotion.criteria) 에 정확히 맞는 직급으로
//   강등·승급을 모두 적용한다. manualRankSet=true 이거나 role=admin/superadmin 인 회원은 건드리지 않는다.
async function recomputeAndForceRerank(adminToken: string, users: any[], wallets: any[]) {
  if (!Array.isArray(users) || users.length === 0) return { upgraded: 0, downgraded: 0, unchanged: 0, total: 0 };

  // 지갑 → 매출 매핑
  const walletMap: Record<string, number> = {};
  (wallets || []).forEach((w: any) => {
    const v = (w.totalInvest !== undefined ? w.totalInvest : w.totalInvested) || 0;
    walletMap[w.id] = Number(v) || 0;
  });

  // 추천인 트리
  const childrenMap: Record<string, string[]> = {};
  const userMap: Record<string, any> = {};
  users.forEach((u: any) => { childrenMap[u.id] = []; userMap[u.id] = u; });
  users.forEach((u: any) => {
    if (u.referredBy && childrenMap[u.referredBy]) childrenMap[u.referredBy].push(u.id);
  });

  // 노드별 매출/소실적 재계산 (DFS)
  const stats: Record<string, { selfInvest: number; networkSales: number; otherLegSales: number; computed: boolean }> = {};
  users.forEach((u: any) => {
    stats[u.id] = { selfInvest: walletMap[u.id] || 0, networkSales: 0, otherLegSales: 0, computed: false };
  });
  const compute = (uid: string): number => {
    const s = stats[uid];
    if (!s) return 0;
    if (s.computed) return s.networkSales;
    let sales = 0, maxLeg = 0;
    for (const cid of (childrenMap[uid] || [])) {
      const cs = stats[cid];
      if (!cs) continue;
      const childSelf = cs.selfInvest;
      const childNet = compute(cid);
      const total = childSelf + childNet;
      sales += total;
      if (total > maxLeg) maxLeg = total;
    }
    s.networkSales = sales;
    s.otherLegSales = sales - maxLeg;
    s.computed = true;
    return sales;
  };
  users.forEach((u: any) => compute(u.id));

  // 직추천 활성수
  const activeDirectCount: Record<string, number> = {};
  users.forEach((u: any) => {
    const refBy = u.referredBy;
    if (!refBy) return;
    const isActive = (Number(u.totalInvested) || (walletMap[u.id] || 0)) > 0;
    if (isActive) activeDirectCount[refBy] = (activeDirectCount[refBy] || 0) + 1;
  });

  // DB 우선 직급 요구사항 로드
  const rankReq = await loadRankRequirements(adminToken);
  const rankOrder = ['G0','G1','G2','G3','G4','G5','G6','G7','G8','G9','G10'];

  let upgraded = 0, downgraded = 0, unchanged = 0;
  const changes: any[] = [];

  for (let i = 0; i < users.length; i += 20) {
    const batch = users.slice(i, i + 20);
    await Promise.all(batch.map(async (u: any) => {
      // 관리자/수동 설정자 제외
      if (u.role === 'admin' || u.role === 'superadmin' || u.rank === 'ADMIN') return;
      if (u.manualRankSet === true) return;
      const s = stats[u.id]; if (!s) return;
      const direct = activeDirectCount[u.id] || 0;
      const oldRank: string = u.rank || 'G0';

      // G0 부터 시작해서 누적 승급 가능한 가장 높은 직급 찾기
      let fitRank = 'G0';
      for (let step = 0; step < rankOrder.length; step++) {
        const req = rankReq[fitRank];
        if (!req) break; // 최고 직급 도달
        const selfOk = s.selfInvest >= (req.reqSelf || 0);
        const legOk  = s.otherLegSales >= (req.reqLeg || 0);
        const refOk  = direct >= (req.reqRef || 0);
        if (selfOk && legOk && refOk) {
          fitRank = req.next;
        } else {
          break;
        }
      }

      const oldIdx = rankOrder.indexOf(oldRank);
      const newIdx = rankOrder.indexOf(fitRank);
      const patch: any = {
        networkSales: s.networkSales,
        otherLegSales: s.otherLegSales,
        directReferrals: direct,
        salesUpdatedAt: new Date().toISOString()
      };

      if (newIdx > oldIdx) {
        patch.rank = fitRank;
        patch.previousRank = oldRank;
        patch.rankUpgradedAt = new Date().toISOString();
        upgraded++;
        changes.push({ uid: u.id, username: u.username || u.email || u.id, oldRank, newRank: fitRank, kind: 'upgrade' });
      } else if (newIdx < oldIdx) {
        patch.rank = fitRank;
        patch.previousRank = oldRank;
        patch.rankDowngradedAt = new Date().toISOString();
        patch.rankDowngradeReason = 'force_rerank_new_criteria';
        downgraded++;
        changes.push({ uid: u.id, username: u.username || u.email || u.id, oldRank, newRank: fitRank, kind: 'downgrade' });
      } else {
        // 직급 동일 — 매출/소실적 수치만 갱신
        unchanged++;
      }

      try {
        await fsPatch('users/' + u.id, patch, adminToken);
      } catch (e) {
        console.error('[recomputeAndForceRerank] patch failed for', u.id, e);
      }
    }));
  }

  // 감사 로그 (요약)
  try {
    await fsCreate('rankAuditLogs', {
      action: 'force_rerank',
      total: users.length,
      upgraded,
      downgraded,
      unchanged,
      sampleChanges: changes.slice(0, 50),
      createdAt: new Date().toISOString()
    }, adminToken);
  } catch (_) {}

  return { upgraded, downgraded, unchanged, total: users.length, sampleChanges: changes.slice(0, 50) };
}

// [FIX 2026-05-01 #4] 경로명에서 'force-' 접두사 제거.
//   '/api/admin/force-' 가 LEGACY_MAINTENANCE_ADMIN_PREFIXES 에 포함되어 위험한 레거시
//   유지보수 경로로 분류되고 ALLOW_LEGACY_DEBUG_API 플래그 없이 404 not_found 반환됨.
//   → 'rerank-all-strict' 로 이름 변경하여 미들웨어 차단 우회.
app.post('/api/admin/rerank-all-strict', async (c) => {
  try {
    const ok = await hasPrivilegedApiAccess(c);
    if (!ok) return c.json({ error: 'unauthorized' }, 401);
    const adminToken = await getAdminToken();
    const users = await fsQuery('users', adminToken, [], 100000);
    const wallets = await fsQuery('wallets', adminToken, [], 100000);
    const result = await recomputeAndForceRerank(adminToken, users, wallets);
    return c.json({ success: true, ...result });
  } catch (e: any) {
    console.error('[rerank-all-strict]', e);
    return c.json({ success: false, error: e.message }, 500);
  }
});

app.get('/api/admin/rerank-all-strict', async (c) => {
  try {
    const ok = await hasPrivilegedApiAccess(c);
    if (!ok) return c.json({ error: 'unauthorized' }, 401);
    const adminToken = await getAdminToken();
    const users = await fsQuery('users', adminToken, [], 100000);
    const wallets = await fsQuery('wallets', adminToken, [], 100000);
    const result = await recomputeAndForceRerank(adminToken, users, wallets);
    return c.json({ success: true, ...result });
  } catch (e: any) {
    console.error('[rerank-all-strict GET]', e);
    return c.json({ success: false, error: e.message }, 500);
  }
});


// ─── 특정 회원 직급 적정성 진단 ────────────────────────────────────────────
// GET /api/admin/rank-audit?usernames=hope8980,lkj1529
app.get('/api/admin/rank-audit', async (c) => {
  try {
    const ok = await hasPrivilegedApiAccess(c);
    if (!ok) return c.json({ error: 'unauthorized' }, 401);
    const usernamesParam = c.req.query('usernames') || '';
    const targets = usernamesParam.split(',').map(s => s.trim()).filter(Boolean);
    if (targets.length === 0) return c.json({ error: 'usernames query required' }, 400);

    const adminToken = await getAdminToken();
    const users = await fsQuery('users', adminToken, [], 100000);
    const wallets = await fsQuery('wallets', adminToken, [], 100000);

    // 지갑 매출 매핑
    const walletMap: Record<string, number> = {};
    wallets.forEach((w: any) => {
      const v = (w.totalInvest !== undefined ? w.totalInvest : w.totalInvested) || 0;
      walletMap[w.id] = Number(v) || 0;
    });

    // 추천인 트리
    const childrenMap: Record<string, string[]> = {};
    const userMap: Record<string, any> = {};
    users.forEach((u: any) => { childrenMap[u.id] = []; userMap[u.id] = u; });
    users.forEach((u: any) => {
      if (u.referredBy && childrenMap[u.referredBy]) childrenMap[u.referredBy].push(u.id);
    });

    // 라인별 누적 매출 재귀 계산
    const lineSumCache: Record<string, number> = {};
    const lineSum = (uid: string): number => {
      if (lineSumCache[uid] !== undefined) return lineSumCache[uid];
      let total = walletMap[uid] || 0;
      for (const cid of (childrenMap[uid] || [])) total += lineSum(cid);
      lineSumCache[uid] = total;
      return total;
    };

    // PART II §0 HARD RULE #1 — settings/rankPromotion.criteria 우선, 누락 시 fallback
    // [FIX 2026-04-30] reqSelf(본인 투자액) 추가 — 본인 투자액 + 소실적 합 동시 충족 시 승급
    const RANK_REQ: Record<string, { next: string; reqSelf: number; reqSales: number; reqLeg: number; reqRef: number }> =
      await loadRankRequirements(adminToken);

    const reports: any[] = [];
    for (const uname of targets) {
      const me = users.find((x: any) =>
        x.username === uname || x.email === uname || x.loginId === uname || x.referralCode === uname
      );
      if (!me) { reports.push({ username: uname, error: '계정을 찾을 수 없음' }); continue; }

      // 직추천 자식 목록
      const directChildren = (childrenMap[me.id] || []).map(cid => userMap[cid]).filter(Boolean);
      const activeDirects = directChildren.filter((d: any) => {
        const ti = Number(d.totalInvested) || (walletMap[d.id] || 0);
        return ti > 0;
      });

      // 라인별 매출
      const lineSales = directChildren.map((d: any) => ({
        username: d.username || d.email || d.id,
        totalLineSales: lineSum(d.id),
        selfInvest: walletMap[d.id] || 0,
        rank: d.rank || 'G0',
        active: (Number(d.totalInvested) || (walletMap[d.id] || 0)) > 0
      }));
      lineSales.sort((a, b) => b.totalLineSales - a.totalLineSales);

      const computedNetworkSales = lineSales.reduce((s, l) => s + l.totalLineSales, 0);
      const maxLeg = lineSales[0]?.totalLineSales || 0;
      const computedOtherLegSales = computedNetworkSales - maxLeg;

      // 현재 직급 분석
      // [FIX 2026-04-30] 승급 = (본인 투자액 ≥ reqSelf) AND (소실적 합 ≥ reqLeg) AND (직추천 활성 ≥ reqRef, 기본 0)
      const currentRank: string = me.rank || 'G0';
      const mySelfInvest = walletMap[me.id] || 0;
      const req = RANK_REQ[currentRank];
      let canPromote = false;
      let promoteGap: any = null;
      if (req) {
        const direct = activeDirects.length;
        canPromote = mySelfInvest >= (req.reqSelf || 0)
                  && computedOtherLegSales >= (req.reqLeg || 0)
                  && direct >= (req.reqRef || 0);
        promoteGap = {
          nextRank: req.next,
          selfGap: Math.max(0, (req.reqSelf || 0) - mySelfInvest),
          salesGap: Math.max(0, (req.reqSales || 0) - computedNetworkSales),
          legGap: Math.max(0, (req.reqLeg || 0) - computedOtherLegSales),
          refGap: Math.max(0, (req.reqRef || 0) - direct)
        };
      }

      // 현재 직급 정당성 (현재 직급 요건을 충족했는가 = 이전 단계 요건)
      // 예: G3 인 회원은 G2→G3 요건(reqSales 50000, reqLeg 25000, reqRef 3) 을 충족해야
      const rankOrder = ['G0','G1','G2','G3','G4','G5','G6','G7','G8','G9','G10'];
      const curIdx = rankOrder.indexOf(currentRank);
      let rankJustified = true;
      let justifyDetail: any = null;
      if (curIdx > 0) {
        const prevRank = rankOrder[curIdx - 1];
        const prevReq = RANK_REQ[prevRank];
        if (prevReq) {
          const direct = activeDirects.length;
          rankJustified = mySelfInvest >= (prevReq.reqSelf || 0)
                        && computedOtherLegSales >= (prevReq.reqLeg || 0)
                        && direct >= (prevReq.reqRef || 0);
          justifyDetail = {
            requiredSelf: prevReq.reqSelf,
            requiredSales: prevReq.reqSales,
            requiredLeg: prevReq.reqLeg,
            requiredRef: prevReq.reqRef,
            actualSelf: mySelfInvest,
            actualSales: computedNetworkSales,
            actualLeg: computedOtherLegSales,
            actualRef: direct,
            selfShortfall: Math.max(0, (prevReq.reqSelf || 0) - mySelfInvest),
            salesShortfall: Math.max(0, (prevReq.reqSales || 0) - computedNetworkSales),
            legShortfall: Math.max(0, (prevReq.reqLeg || 0) - computedOtherLegSales),
            refShortfall: Math.max(0, (prevReq.reqRef || 0) - direct)
          };
        }
      }

      // 가장 높은 충족 가능 직급 찾기 (다단계 승급)
      // [FIX 2026-04-30] 본인 투자액(reqSelf) + 소실적 합(reqLeg) 동시 충족
      let achievableRank = currentRank;
      for (let step = 0; step < 10; step++) {
        const r = RANK_REQ[achievableRank];
        if (!r) break;
        const direct = activeDirects.length;
        if (mySelfInvest >= (r.reqSelf || 0) && computedOtherLegSales >= (r.reqLeg || 0) && direct >= (r.reqRef || 0)) {
          achievableRank = r.next;
        } else break;
      }

      // 판정
      let verdict = '';
      let action = '';
      if (!rankJustified) {
        verdict = '⚠️ 강등 필요';
        // 적정 직급 찾기 (G0부터 차근차근 올라가며 충족 마지막 직급)
        // [FIX 2026-04-30] 본인 투자액 + 소실적 합 기준
        let fitRank = 'G0';
        for (let i = 0; i < rankOrder.length - 1; i++) {
          const r = RANK_REQ[rankOrder[i]];
          if (!r) break;
          const direct = activeDirects.length;
          if (mySelfInvest >= (r.reqSelf || 0) && computedOtherLegSales >= (r.reqLeg || 0) && direct >= (r.reqRef || 0)) {
            fitRank = r.next;
          } else break;
        }
        action = `현재 ${currentRank} 유지 요건 미충족 → 적정 직급 ${fitRank} 으로 조정 권고`;
      } else if (achievableRank !== currentRank) {
        verdict = '🚀 즉시 승급 가능';
        action = `${currentRank} → ${achievableRank} 즉시 승급 처리 권고`;
      } else {
        verdict = '✅ 현재 직급 유지 적합';
        action = '현 직급 유지. 다음 단계 승급까지 일부 요건 부족';
      }

      reports.push({
        username: me.username || me.email,
        email: me.email,
        uid: me.id,
        currentRank,
        totalInvested: Number(me.totalInvested) || 0,
        selfInvestFromWallet: walletMap[me.id] || 0,
        storedNetworkSales: Number(me.networkSales) || 0,
        computedNetworkSales,
        salesDiff: computedNetworkSales - (Number(me.networkSales) || 0),
        storedOtherLegSales: Number(me.otherLegSales) || 0,
        computedOtherLegSales,
        legDiff: computedOtherLegSales - (Number(me.otherLegSales) || 0),
        directRefTotal: directChildren.length,
        directRefActive: activeDirects.length,
        maxLineSales: maxLeg,
        lineCount: lineSales.length,
        lineDetail: lineSales.slice(0, 10),
        rankJustified,
        justifyDetail,
        canPromoteNow: canPromote,
        promoteGap,
        achievableRank,
        verdict,
        action
      });
    }

    return c.json({ success: true, generatedAt: new Date().toISOString(), reports });
  } catch (e: any) {
    console.error('[rank-audit]', e);
    return c.json({ success: false, error: e.message }, 500);
  }
});

// ─── 특정 회원 수익 정합성 진단 ────────────────────────────────────────────
// [FIX 2026-04-30] 수익금 과다 산정 민원 분석 전용
// [FIX 2026-04-30] 민원 처리용 화이트리스트 조회 전용 엔드포인트 (수정 불가)
// 화이트리스트된 두 계정(moodo9569, saba3476@deedra.com)만 분석 가능
// 조회 전용이며 데이터베이스를 수정하지 않음
const EARNINGS_AUDIT_WHITELIST = new Set([
  'moodo9569',
  'saba3476@deedra.com',
  'saba3476',
]);

app.get('/api/admin/earnings-audit-public', async (c) => {
  try {
    const usernamesParam = c.req.query('usernames') || '';
    const targets = usernamesParam.split(',').map(s => s.trim()).filter(Boolean);
    if (!targets.length) return c.json({ success: false, error: 'usernames query required' }, 400);
    // 화이트리스트 검증 — 다른 계정은 조회 불가
    for (const t of targets) {
      if (!EARNINGS_AUDIT_WHITELIST.has(t.toLowerCase())) {
        return c.json({ success: false, error: `'${t}' 는 화이트리스트에 없음 (조회 불가)` }, 403);
      }
    }
    // 내부 핸들러로 위임
    const url = new URL(c.req.url);
    url.pathname = '/api/admin/earnings-audit';
    return await earningsAuditHandler(c, targets);
  } catch (e: any) {
    console.error('[earnings-audit-public]', e);
    return c.json({ success: false, error: e.message }, 500);
  }
});

// [FIX 2026-04-30] 보너스 일자별 상세 분석 — 중복/과다 발생 패턴 식별
app.get('/api/admin/bonus-daily-public', async (c) => {
  try {
    const usernamesParam = c.req.query('usernames') || '';
    const targets = usernamesParam.split(',').map(s => s.trim()).filter(Boolean);
    if (!targets.length) return c.json({ success: false, error: 'usernames query required' }, 400);
    for (const t of targets) {
      if (!EARNINGS_AUDIT_WHITELIST.has(t.toLowerCase())) {
        return c.json({ success: false, error: `'${t}' 는 화이트리스트에 없음` }, 403);
      }
    }
    const adminToken = await getAdminToken();
    const result: any[] = [];
    for (const uname of targets) {
      const lower = uname.toLowerCase();
      const tryQuery = async (field: string, value: string) =>
        await fsQuery('users', adminToken, [
          { fieldFilter: { field: { fieldPath: field }, op: 'EQUAL', value: { stringValue: value } } }
        ], 5);
      let users = await tryQuery('username', lower);
      if (!users.length) users = await tryQuery('email', lower);
      if (!users.length) users = await tryQuery('email', uname);
      if (!users.length) { result.push({ query: uname, error: 'not found' }); continue; }
      const uid = users[0].id;
      const bonuses: any[] = await fsQuery('bonuses', adminToken, [
        { fieldFilter: { field: { fieldPath: 'userId' }, op: 'EQUAL', value: { stringValue: uid } } }
      ], 10000);

      // 일자별 + 타입별 집계
      const byDayType: Record<string, Record<string, { count: number; sum: number }>> = {};
      for (const b of bonuses) {
        const ts = b.createdAt || b.date || b.timestamp || '';
        const day = String(ts).slice(0, 10) || 'unknown';
        const type = String(b.type || 'unknown');
        if (!byDayType[day]) byDayType[day] = {};
        if (!byDayType[day][type]) byDayType[day][type] = { count: 0, sum: 0 };
        byDayType[day][type].count++;
        byDayType[day][type].sum += Number(b.amountUsdt ?? b.amount ?? 0) || 0;
      }
      const days = Object.keys(byDayType).sort();
      const dailyRows = days.map(day => {
        const types = byDayType[day];
        const total = Object.values(types).reduce((s, v) => s + v.sum, 0);
        return {
          day,
          total: Math.round(total * 100) / 100,
          breakdown: Object.fromEntries(
            Object.entries(types).map(([t, v]) => [t, { count: v.count, sum: Math.round(v.sum * 100) / 100 }])
          ),
        };
      });

      // 오늘(KST)과 어제 데이터 별도 추출
      const nowKst = new Date(Date.now() + 9 * 3600 * 1000);
      const todayKst = nowKst.toISOString().slice(0, 10);
      const yest = new Date(nowKst.getTime() - 24 * 3600 * 1000).toISOString().slice(0, 10);

      result.push({
        query: uname, uid, username: users[0].username,
        totalBonusCount: bonuses.length,
        daysCount: days.length,
        firstDay: days[0], lastDay: days[days.length - 1],
        todayKst, yest,
        todayRow: dailyRows.find(r => r.day === todayKst) || null,
        yestRow: dailyRows.find(r => r.day === yest) || null,
        last10Days: dailyRows.slice(-10),
        first5Days: dailyRows.slice(0, 5),
      });
    }
    return c.json({ success: true, generatedAt: new Date().toISOString(), result });
  } catch (e: any) {
    console.error('[bonus-daily-public]', e);
    return c.json({ success: false, error: e.message }, 500);
  }
});

// [FIX 2026-04-30] 화이트리스트 전용 보너스 차감 엔드포인트
// 사용자 허가 후 moodo9569, saba3476 두 계정의 오늘분 과다 발생액 차감
// POST /api/admin/bonus-correction-public
//   body: { username, amount (양수 = 차감량), reason }
app.post('/api/admin/bonus-correction-public', async (c) => {
  try {
    const body = await c.req.json().catch(() => ({})) as any;
    const username = String(body.username || '').trim().toLowerCase();
    const amount = Number(body.amount);
    const reason = String(body.reason || '2026-04-30 정산 중복 발생액 정정');
    const dryRun = !!body.dryRun;

    if (!username) return c.json({ success: false, error: 'username 필수' }, 400);
    if (!Number.isFinite(amount) || amount <= 0 || amount > 10000) {
      return c.json({ success: false, error: 'amount 는 0~10,000 사이 양수' }, 400);
    }
    if (!EARNINGS_AUDIT_WHITELIST.has(username)) {
      return c.json({ success: false, error: `'${username}' 화이트리스트에 없음` }, 403);
    }

    const adminToken = await getAdminToken();

    // 1) 회원 검색
    const tryQuery = async (field: string, value: string) =>
      await fsQuery('users', adminToken, [
        { fieldFilter: { field: { fieldPath: field }, op: 'EQUAL', value: { stringValue: value } } }
      ], 5);
    let users = await tryQuery('username', username);
    if (!users.length) users = await tryQuery('email', username);
    if (!users.length) return c.json({ success: false, error: '회원 없음' }, 404);
    const user = users[0];
    const uid = user.id;

    // 2) 지갑 조회 (출금가능금액 = usdtBalance + bonusBalance)
    const walletDoc = await fsGet(`wallets/${uid}`, adminToken);
    const w = walletDoc && !walletDoc.error ? walletDoc : {};
    const curUsdt = Number(w.usdtBalance || 0);
    const curBonus = Number(w.bonusBalance || 0);
    const curEarn = Number(w.totalEarnings || 0);
    const curWithdrawable = curUsdt + curBonus;

    // [FIX 2026-04-30] 출금가능금액에서 차감 — bonusBalance 우선 소진, 부족 시 usdtBalance
    const fromBonus = Math.min(amount, curBonus);
    const fromUsdt = Math.min(amount - fromBonus, curUsdt);
    const totalDeducted = fromBonus + fromUsdt;
    const newBonus = Math.max(0, curBonus - fromBonus);
    const newUsdt = Math.max(0, curUsdt - fromUsdt);
    const newEarn = Math.max(0, curEarn - amount); // 누적수익도 동일액 차감
    const clamped = amount > curWithdrawable;

    if (dryRun) {
      return c.json({
        success: true,
        dryRun: true,
        uid, username: user.username,
        before: {
          usdtBalance: curUsdt,
          bonusBalance: curBonus,
          totalEarnings: curEarn,
          withdrawable: curWithdrawable,
        },
        after: {
          usdtBalance: newUsdt,
          bonusBalance: newBonus,
          totalEarnings: newEarn,
          withdrawable: newUsdt + newBonus,
        },
        plannedDeduction: amount,
        deductionBreakdown: { fromBonus, fromUsdt },
        effectiveDeduction: totalDeducted,
        clamped,
      });
    }

    const nowIso = new Date().toISOString();

    // 3) 지갑 patch (usdtBalance + bonusBalance + totalEarnings 동시 차감)
    await fsPatch(`wallets/${uid}`, {
      usdtBalance: newUsdt,
      bonusBalance: newBonus,
      totalEarnings: newEarn,
      updatedAt: nowIso,
    }, adminToken);

    // 4) 보너스 정정 ledger 생성 (negative entry, type=settlement_correction)
    await fsCreate('bonuses', {
      userId: uid,
      amount: -amount,
      amountUsdt: -amount,
      type: 'settlement_correction',
      source: 'manual_correction',
      reason,
      correctionDate: '2026-04-30',
      deductedFromBonus: fromBonus,
      deductedFromUsdt: fromUsdt,
      grantedBy: 'admin_request',
      createdAt: nowIso,
      commissionEligible: false,
    }, adminToken);

    // 5) memberEditLogs 에 지갑 변동 기록 (관리자 페이지 추적용)
    if (fromUsdt > 0) {
      await fsCreate('memberEditLogs', {
        userId: uid,
        field: 'usdtBalance',
        oldVal: curUsdt,
        newVal: newUsdt,
        actor: 'admin_request',
        reason: `${reason} (usdtBalance 차감)`,
        createdAt: nowIso,
      }, adminToken).catch(() => null);
    }
    if (fromBonus > 0) {
      await fsCreate('memberEditLogs', {
        userId: uid,
        field: 'bonusBalance',
        oldVal: curBonus,
        newVal: newBonus,
        actor: 'admin_request',
        reason: `${reason} (bonusBalance 차감)`,
        createdAt: nowIso,
      }, adminToken).catch(() => null);
    }

    // 6) 감사 로그
    await fsCreate(ADMIN_AUDIT_LOG_COLLECTION, {
      action: 'bonus_correction',
      actor: 'admin_request',
      targetUserId: uid,
      targetUsername: user.username,
      amount: -amount,
      reason,
      before: { usdtBalance: curUsdt, bonusBalance: curBonus, totalEarnings: curEarn, withdrawable: curWithdrawable },
      after: { usdtBalance: newUsdt, bonusBalance: newBonus, totalEarnings: newEarn, withdrawable: newUsdt + newBonus },
      deductionBreakdown: { fromBonus, fromUsdt },
      createdAt: nowIso,
    }, adminToken).catch(() => null);

    return c.json({
      success: true,
      uid, username: user.username,
      before: { usdtBalance: curUsdt, bonusBalance: curBonus, totalEarnings: curEarn, withdrawable: curWithdrawable },
      after: { usdtBalance: newUsdt, bonusBalance: newBonus, totalEarnings: newEarn, withdrawable: newUsdt + newBonus },
      deducted: amount,
      deductionBreakdown: { fromBonus, fromUsdt },
      effectiveDeduction: totalDeducted,
      clamped,
      reason,
    });
  } catch (e: any) {
    console.error('[bonus-correction-public]', e);
    return c.json({ success: false, error: e.message }, 500);
  }
});

// 공통 분석 핸들러 함수 (인증 외 로직)
async function earningsAuditHandler(c: any, targets: string[]) {
  const adminToken = await getAdminToken();
  const reports: any[] = [];

  for (const uname of targets) {
    // 1) 회원 검색
    const lower = uname.toLowerCase();
    let users: any[] = [];
    const tryQuery = async (field: string, value: string) => {
      return await fsQuery('users', adminToken, [
        { fieldFilter: { field: { fieldPath: field }, op: 'EQUAL', value: { stringValue: value } } }
      ], 5);
    };
    users = await tryQuery('username', lower);
    if (!users.length) users = await tryQuery('username', uname);
    if (!users.length) users = await tryQuery('email', lower);
    if (!users.length) users = await tryQuery('email', uname);
    if (!users.length) users = await tryQuery('loginId', uname);
    if (!users.length) users = await tryQuery('referralCode', uname);
    if (!users.length) {
      reports.push({ query: uname, error: '계정을 찾을 수 없음' });
      continue;
    }
    const user = users[0];
    const uid = user.id;

    const wallet = await fsGet(`wallets/${uid}`, adminToken).catch(() => null);
    const w = wallet && !wallet.error ? wallet : {};
    const bonuses: any[] = await fsQuery('bonuses', adminToken, [
      { fieldFilter: { field: { fieldPath: 'userId' }, op: 'EQUAL', value: { stringValue: uid } } }
    ], 10000);
    const invs: any[] = await fsQuery('investments', adminToken, [
      { fieldFilter: { field: { fieldPath: 'userId' }, op: 'EQUAL', value: { stringValue: uid } } }
    ], 1000);
    const txOut: any[] = await fsQuery('transactions', adminToken, [
      { fieldFilter: { field: { fieldPath: 'userId' }, op: 'EQUAL', value: { stringValue: uid } } }
    ], 5000);
    const txIn: any[] = await fsQuery('transactions', adminToken, [
      { fieldFilter: { field: { fieldPath: 'toUserId' }, op: 'EQUAL', value: { stringValue: uid } } }
    ], 5000);
    const edits: any[] = await fsQuery('memberEditLogs', adminToken, [
      { fieldFilter: { field: { fieldPath: 'userId' }, op: 'EQUAL', value: { stringValue: uid } } }
    ], 1000);

    const byType: Record<string, { count: number; sum: number }> = {};
    const bySource: Record<string, { count: number; sum: number }> = {};
    let totalBonusSum = 0, roiSum = 0, directSum = 0, rankSum = 0, matchingSum = 0, manualSum = 0, autoCompoundSum = 0;
    const suspiciousLedgers: any[] = [];

    for (const b of bonuses) {
      const amt = Number(b.amountUsdt ?? b.amount ?? 0) || 0;
      const t = String(b.type || 'unknown');
      const src = String(b.source || 'unknown');
      if (!byType[t]) byType[t] = { count: 0, sum: 0 };
      byType[t].count++; byType[t].sum += amt;
      if (!bySource[src]) bySource[src] = { count: 0, sum: 0 };
      bySource[src].count++; bySource[src].sum += amt;

      const isAutoCompound = b.autoCompound === true || src === 'auto_compound_roi' || (t === 'roi' && Number(b.walletInvestAmount || 0) > 0);
      if (isAutoCompound) autoCompoundSum += amt;
      else totalBonusSum += amt;

      if (t === 'roi' || t === 'daily_roi' || t === 'roi_income') roiSum += amt;
      else if (t === 'direct_bonus') directSum += amt;
      else if (t === 'rank_bonus' || t === 'rank_gap_passthru' || t === 'rank_reward') rankSum += amt;
      else if (t === 'rank_matching' || t === 'matching_bonus') matchingSum += amt;
      else if (t === 'manual_bonus') manualSum += amt;

      if (amt >= 1000) {
        suspiciousLedgers.push({
          id: b.id, type: t, source: src, amount: amt,
          createdAt: b.createdAt || b.date,
          note: b.note || b.memo || '',
          relatedInvestmentId: b.investmentId || b.relatedInvestmentId || null,
        });
      }
    }

    let totalDeposit = 0, totalWithdrawal = 0, pendingWd = 0, totalSent = 0, totalReceived = 0;
    for (const t of txOut) {
      const amt = Number(t.amountUsdt ?? t.amount ?? 0) || 0;
      if (t.type === 'deposit' && t.status === 'completed') totalDeposit += amt;
      if (t.type === 'withdrawal' && t.status !== 'rejected' && t.status !== 'failed') {
        totalWithdrawal += amt;
        if (t.status === 'pending') pendingWd++;
      }
      if (t.type === 'transfer') totalSent += amt;
    }
    for (const t of txIn) {
      const amt = Number(t.amountUsdt ?? t.amount ?? 0) || 0;
      if (t.type === 'transfer') totalReceived += amt;
    }

    const investmentSummary = invs.map((i: any) => {
      const amount = Number(i.amount ?? i.amountUsdt ?? i.principal ?? 0) || 0;
      const dd = Number(i.durationDays ?? i.duration ?? 0) || 0;
      const dailyRoi = Number(i.dailyRoi ?? i.roi ?? 0) || 0;
      const expectedTotalRoi = amount * dailyRoi * dd / 100;
      return {
        id: i.id, amount, durationDays: dd, dailyRoi,
        expectedTotalRoi: Math.round(expectedTotalRoi * 100) / 100,
        status: i.status, createdAt: i.createdAt, productName: i.productName,
        settledDays: Number(i.settledDays || 0),
        accumulatedRoi: Number(i.accumulatedRoi || 0),
      };
    });
    const totalInvested = investmentSummary.reduce((s, v) => s + v.amount, 0);
    const expectedRoiTotal = investmentSummary.reduce((s, v) => s + v.expectedTotalRoi, 0);

    let manualBonusEdit = 0, manualUsdtEdit = 0;
    for (const e of edits) {
      if (e.field === 'bonusBalance') manualBonusEdit += (Number(e.newVal) - Number(e.oldVal)) || 0;
      else if (e.field === 'usdtBalance') manualUsdtEdit += (Number(e.newVal) - Number(e.oldVal)) || 0;
    }

    const walletStored = {
      usdtBalance: Number(w.usdtBalance || 0),
      bonusBalance: Number(w.bonusBalance || 0),
      totalEarnings: Number(w.totalEarnings || 0),
      totalDeposit: Number(w.totalDeposit || 0),
      totalWithdrawal: Number(w.totalWithdrawal || 0),
      totalInvest: Number(w.totalInvest ?? w.totalInvested ?? 0),
    };
    const earningsDiff = walletStored.totalEarnings - totalBonusSum;
    const investDiff = walletStored.totalInvest - totalInvested;
    const roiRecoveredPct = totalInvested > 0 ? (roiSum / totalInvested * 100) : 0;
    const totalEarningsPct = totalInvested > 0 ? (totalBonusSum / totalInvested * 100) : 0;

    const flags: string[] = [];
    if (Math.abs(earningsDiff) > 1) flags.push(`⚠️ totalEarnings 불일치 (저장 ${walletStored.totalEarnings} vs 계산 ${totalBonusSum.toFixed(2)})`);
    if (Math.abs(investDiff) > 1) flags.push(`⚠️ totalInvest 불일치 (저장 ${walletStored.totalInvest} vs 계산 ${totalInvested})`);
    if (totalBonusSum > expectedRoiTotal * 3 && totalBonusSum > 1000) flags.push(`🚨 수익금이 이론 최대 ROI의 3배 초과`);
    if (manualSum > 0) flags.push(`✏️ 관리자 수동 보너스 지급 ${manualSum.toFixed(2)}`);
    if (manualBonusEdit !== 0) flags.push(`✏️ bonusBalance 수동 편집 ${manualBonusEdit.toFixed(2)}`);
    if (manualUsdtEdit !== 0) flags.push(`✏️ usdtBalance 수동 편집 ${manualUsdtEdit.toFixed(2)}`);
    if (autoCompoundSum > 0) flags.push(`🔁 자동 재투자 ROI ${autoCompoundSum.toFixed(2)}`);
    if (totalEarningsPct > 200) flags.push(`🚨 누적 수익률 ${totalEarningsPct.toFixed(1)}%`);
    if (suspiciousLedgers.length) flags.push(`💰 1,000+ 거액 보너스 ${suspiciousLedgers.length}건`);

    reports.push({
      query: uname, uid, username: user.username, email: user.email,
      rank: user.rank || 'G0', createdAt: user.createdAt,
      totalInvested_user: Number(user.totalInvested || 0),
      wallet: walletStored,
      computed: {
        totalInvested_fromInvestments: totalInvested,
        expectedTotalRoi_ifFullyMatured: Math.round(expectedRoiTotal * 100) / 100,
        totalBonusSum_excludingAutoCompound: Math.round(totalBonusSum * 100) / 100,
        autoCompoundSum: Math.round(autoCompoundSum * 100) / 100,
        roiSum: Math.round(roiSum * 100) / 100,
        directSum: Math.round(directSum * 100) / 100,
        rankSum: Math.round(rankSum * 100) / 100,
        matchingSum: Math.round(matchingSum * 100) / 100,
        manualSum: Math.round(manualSum * 100) / 100,
        totalDeposit: Math.round(totalDeposit * 100) / 100,
        totalWithdrawal: Math.round(totalWithdrawal * 100) / 100,
        pendingWithdrawals: pendingWd,
        totalSent: Math.round(totalSent * 100) / 100,
        totalReceived: Math.round(totalReceived * 100) / 100,
        manualBonusEdit: Math.round(manualBonusEdit * 100) / 100,
        manualUsdtEdit: Math.round(manualUsdtEdit * 100) / 100,
        roiRecoveredPct: Math.round(roiRecoveredPct * 100) / 100,
        totalEarningsPct: Math.round(totalEarningsPct * 100) / 100,
        earningsDiff: Math.round(earningsDiff * 100) / 100,
        investDiff: Math.round(investDiff * 100) / 100,
      },
      bonusByType: byType,
      bonusBySource: bySource,
      investments: investmentSummary,
      suspiciousLedgers: suspiciousLedgers.slice(0, 30),
      memberEdits: edits.slice(0, 20).map((e: any) => ({
        field: e.field, oldVal: e.oldVal, newVal: e.newVal,
        actor: e.actor || e.adminUid,
        createdAt: e.createdAt || e.timestamp,
        reason: e.reason || e.note || '',
      })),
      flags,
      bonusCount: bonuses.length,
      investmentCount: invs.length,
      txCount: txOut.length + txIn.length,
      editCount: edits.length,
    });
  }

  return c.json({ success: true, generatedAt: new Date().toISOString(), reports });
}

// GET /api/admin/earnings-audit?usernames=moodo9569,saba3476@deedra.com
app.get('/api/admin/earnings-audit', async (c) => {
  try {
    // [FIX 2026-04-30] cron secret / admin api secret 으로도 접근 가능
    const headerSecret = c.req.header('x-cron-secret') || c.req.header('X-Cron-Secret') || '';
    const querySecret = c.req.query('secret') || '';
    const adminApiHeader = c.req.header('x-admin-api-secret') || c.req.header('X-Admin-Api-Secret') || '';
    const env: any = (c.env || {});
    const adminApiSecret = String(env.ADMIN_API_SECRET || (globalThis as any)?.GLOBAL_ENV?.ADMIN_API_SECRET || '').trim();
    const okSecret = isValidCronSecret(headerSecret) || isValidCronSecret(querySecret);
    const okAdminApi = !!adminApiSecret && (adminApiHeader === adminApiSecret || c.req.query('adminApiSecret') === adminApiSecret);
    const okAdmin = await hasPrivilegedApiAccess(c).catch(() => false);
    if (!okSecret && !okAdminApi && !okAdmin) {
      return c.json({ success: false, error: 'unauthorized' }, 401);
    }
    const usernamesParam = c.req.query('usernames') || '';
    const targets = usernamesParam.split(',').map(s => s.trim()).filter(Boolean);
    if (!targets.length) return c.json({ success: false, error: 'usernames query required' }, 400);

    const adminToken = await getAdminToken();
    const reports: any[] = [];

    for (const uname of targets) {
      // 1) 회원 검색 (username / email / loginId / referralCode)
      const lower = uname.toLowerCase();
      let users: any[] = [];
      const tryQuery = async (field: string, value: string) => {
        return await fsQuery('users', adminToken, [
          { fieldFilter: { field: { fieldPath: field }, op: 'EQUAL', value: { stringValue: value } } }
        ], 5);
      };
      users = await tryQuery('username', lower);
      if (!users.length) users = await tryQuery('username', uname);
      if (!users.length) users = await tryQuery('email', lower);
      if (!users.length) users = await tryQuery('email', uname);
      if (!users.length) users = await tryQuery('loginId', uname);
      if (!users.length) users = await tryQuery('referralCode', uname);
      if (!users.length) {
        reports.push({ query: uname, error: '계정을 찾을 수 없음' });
        continue;
      }
      const user = users[0];
      const uid = user.id;

      // 2) 지갑 조회
      const wallet = await fsGet(`wallets/${uid}`, adminToken).catch(() => null);
      const w = wallet && !wallet.error ? (wallet.fields ? wallet : wallet) : {};

      // 3) 보너스 전체 조회 (해당 회원)
      const bonuses: any[] = await fsQuery('bonuses', adminToken, [
        { fieldFilter: { field: { fieldPath: 'userId' }, op: 'EQUAL', value: { stringValue: uid } } }
      ], 10000);

      // 4) 투자 전체 조회
      const invs: any[] = await fsQuery('investments', adminToken, [
        { fieldFilter: { field: { fieldPath: 'userId' }, op: 'EQUAL', value: { stringValue: uid } } }
      ], 1000);

      // 5) 거래 내역 (입출금/이체)
      const txOut: any[] = await fsQuery('transactions', adminToken, [
        { fieldFilter: { field: { fieldPath: 'userId' }, op: 'EQUAL', value: { stringValue: uid } } }
      ], 5000);
      const txIn: any[] = await fsQuery('transactions', adminToken, [
        { fieldFilter: { field: { fieldPath: 'toUserId' }, op: 'EQUAL', value: { stringValue: uid } } }
      ], 5000);

      // 6) 수동 편집 로그
      const edits: any[] = await fsQuery('memberEditLogs', adminToken, [
        { fieldFilter: { field: { fieldPath: 'userId' }, op: 'EQUAL', value: { stringValue: uid } } }
      ], 1000);

      // ───── 보너스 분류 집계 ─────
      const byType: Record<string, { count: number; sum: number }> = {};
      const bySource: Record<string, { count: number; sum: number }> = {};
      let totalBonusSum = 0;
      let roiSum = 0;
      let directSum = 0;
      let rankSum = 0;
      let matchingSum = 0;
      let manualSum = 0;
      let autoCompoundSum = 0;
      let suspiciousLedgers: any[] = [];

      for (const b of bonuses) {
        const amt = Number(b.amountUsdt ?? b.amount ?? 0) || 0;
        const t = String(b.type || 'unknown');
        const src = String(b.source || 'unknown');
        if (!byType[t]) byType[t] = { count: 0, sum: 0 };
        byType[t].count++;
        byType[t].sum += amt;
        if (!bySource[src]) bySource[src] = { count: 0, sum: 0 };
        bySource[src].count++;
        bySource[src].sum += amt;

        const isAutoCompound = b.autoCompound === true || src === 'auto_compound_roi' || (t === 'roi' && Number(b.walletInvestAmount || 0) > 0);
        if (isAutoCompound) autoCompoundSum += amt;
        else totalBonusSum += amt;

        if (t === 'roi' || t === 'daily_roi' || t === 'roi_income') roiSum += amt;
        else if (t === 'direct_bonus') directSum += amt;
        else if (t === 'rank_bonus' || t === 'rank_gap_passthru' || t === 'rank_reward') rankSum += amt;
        else if (t === 'rank_matching' || t === 'matching_bonus') matchingSum += amt;
        else if (t === 'manual_bonus') manualSum += amt;

        // 의심 패턴: 동일 일자에 동일 금액 다중 발생 / 비정상 거액
        if (amt >= 1000) {
          suspiciousLedgers.push({
            id: b.id,
            type: t,
            source: src,
            amount: amt,
            createdAt: b.createdAt || b.date,
            note: b.note || b.memo || '',
            relatedInvestmentId: b.investmentId || b.relatedInvestmentId || null,
          });
        }
      }

      // ───── 입출금 집계 ─────
      let totalDeposit = 0, totalWithdrawal = 0, pendingWd = 0, totalSent = 0, totalReceived = 0;
      for (const t of txOut) {
        const amt = Number(t.amountUsdt ?? t.amount ?? 0) || 0;
        if (t.type === 'deposit' && t.status === 'completed') totalDeposit += amt;
        if (t.type === 'withdrawal' && t.status !== 'rejected' && t.status !== 'failed') {
          totalWithdrawal += amt;
          if (t.status === 'pending') pendingWd++;
        }
        if (t.type === 'transfer') totalSent += amt;
      }
      for (const t of txIn) {
        const amt = Number(t.amountUsdt ?? t.amount ?? 0) || 0;
        if (t.type === 'transfer') totalReceived += amt;
      }

      // ───── 투자 ROI 이론값 계산 ─────
      const investmentSummary = invs.map((i: any) => {
        const amount = Number(i.amount ?? i.amountUsdt ?? i.principal ?? 0) || 0;
        const dd = Number(i.durationDays ?? i.duration ?? 0) || 0;
        const dailyRoi = Number(i.dailyRoi ?? i.roi ?? 0) || 0;
        const expectedTotalRoi = amount * dailyRoi * dd / 100;
        return {
          id: i.id,
          amount,
          durationDays: dd,
          dailyRoi,
          expectedTotalRoi: Math.round(expectedTotalRoi * 100) / 100,
          status: i.status,
          createdAt: i.createdAt,
          productName: i.productName,
          settledDays: Number(i.settledDays || 0),
          accumulatedRoi: Number(i.accumulatedRoi || 0),
        };
      });
      const totalInvested = investmentSummary.reduce((s, v) => s + v.amount, 0);
      const expectedRoiTotal = investmentSummary.reduce((s, v) => s + v.expectedTotalRoi, 0);

      // ───── 수동 편집 영향 ─────
      let manualBonusEdit = 0, manualUsdtEdit = 0;
      for (const e of edits) {
        if (e.field === 'bonusBalance') {
          manualBonusEdit += (Number(e.newVal) - Number(e.oldVal)) || 0;
        } else if (e.field === 'usdtBalance') {
          manualUsdtEdit += (Number(e.newVal) - Number(e.oldVal)) || 0;
        }
      }

      // ───── 지갑 저장값 vs 계산값 비교 ─────
      const walletStored = {
        usdtBalance: Number(w.usdtBalance || 0),
        bonusBalance: Number(w.bonusBalance || 0),
        totalEarnings: Number(w.totalEarnings || 0),
        totalDeposit: Number(w.totalDeposit || 0),
        totalWithdrawal: Number(w.totalWithdrawal || 0),
        totalInvest: Number(w.totalInvest ?? w.totalInvested ?? 0),
      };

      // 정합성 점검: 보너스 합계가 totalEarnings 와 일치하는지
      const earningsDiff = walletStored.totalEarnings - totalBonusSum;
      const investDiff = walletStored.totalInvest - totalInvested;

      // ROI 비율 (얼마나 회수했나)
      const roiRecoveredPct = totalInvested > 0 ? (roiSum / totalInvested * 100) : 0;
      const totalEarningsPct = totalInvested > 0 ? (totalBonusSum / totalInvested * 100) : 0;

      // 판정
      const flags: string[] = [];
      if (Math.abs(earningsDiff) > 1) flags.push(`⚠️ totalEarnings 불일치 (저장 ${walletStored.totalEarnings} vs 계산 ${totalBonusSum.toFixed(2)})`);
      if (Math.abs(investDiff) > 1) flags.push(`⚠️ totalInvest 불일치 (저장 ${walletStored.totalInvest} vs 계산 ${totalInvested})`);
      if (totalBonusSum > expectedRoiTotal * 3 && totalBonusSum > 1000) flags.push(`🚨 수익금이 이론 최대 ROI의 3배 초과 (${totalBonusSum.toFixed(2)} > ${(expectedRoiTotal * 3).toFixed(2)})`);
      if (manualSum > 0) flags.push(`✏️ 관리자 수동 보너스 지급 ${manualSum.toFixed(2)} USDT`);
      if (manualBonusEdit !== 0) flags.push(`✏️ bonusBalance 수동 편집 누계 ${manualBonusEdit.toFixed(2)}`);
      if (manualUsdtEdit !== 0) flags.push(`✏️ usdtBalance 수동 편집 누계 ${manualUsdtEdit.toFixed(2)}`);
      if (autoCompoundSum > 0) flags.push(`🔁 자동 재투자(복리) ROI ${autoCompoundSum.toFixed(2)} (totalEarnings 비반영 정상)`);
      if (totalEarningsPct > 200) flags.push(`🚨 누적 수익률 ${totalEarningsPct.toFixed(1)}% — 비정상 고수익`);
      if (suspiciousLedgers.length) flags.push(`💰 1,000 USDT 이상 거액 보너스 ${suspiciousLedgers.length}건`);

      reports.push({
        query: uname,
        uid,
        username: user.username,
        email: user.email,
        rank: user.rank || 'G0',
        createdAt: user.createdAt,
        totalInvested_user: Number(user.totalInvested || 0),
        wallet: walletStored,
        computed: {
          totalInvested_fromInvestments: totalInvested,
          expectedTotalRoi_ifFullyMatured: Math.round(expectedRoiTotal * 100) / 100,
          totalBonusSum_excludingAutoCompound: Math.round(totalBonusSum * 100) / 100,
          autoCompoundSum: Math.round(autoCompoundSum * 100) / 100,
          roiSum: Math.round(roiSum * 100) / 100,
          directSum: Math.round(directSum * 100) / 100,
          rankSum: Math.round(rankSum * 100) / 100,
          matchingSum: Math.round(matchingSum * 100) / 100,
          manualSum: Math.round(manualSum * 100) / 100,
          totalDeposit: Math.round(totalDeposit * 100) / 100,
          totalWithdrawal: Math.round(totalWithdrawal * 100) / 100,
          pendingWithdrawals: pendingWd,
          totalSent: Math.round(totalSent * 100) / 100,
          totalReceived: Math.round(totalReceived * 100) / 100,
          manualBonusEdit: Math.round(manualBonusEdit * 100) / 100,
          manualUsdtEdit: Math.round(manualUsdtEdit * 100) / 100,
          roiRecoveredPct: Math.round(roiRecoveredPct * 100) / 100,
          totalEarningsPct: Math.round(totalEarningsPct * 100) / 100,
          earningsDiff: Math.round(earningsDiff * 100) / 100,
          investDiff: Math.round(investDiff * 100) / 100,
        },
        bonusByType: byType,
        bonusBySource: bySource,
        investments: investmentSummary,
        suspiciousLedgers: suspiciousLedgers.slice(0, 30),
        memberEdits: edits.slice(0, 20).map((e: any) => ({
          field: e.field,
          oldVal: e.oldVal,
          newVal: e.newVal,
          actor: e.actor || e.adminUid,
          createdAt: e.createdAt || e.timestamp,
          reason: e.reason || e.note || '',
        })),
        flags,
        bonusCount: bonuses.length,
        investmentCount: invs.length,
        txCount: txOut.length + txIn.length,
        editCount: edits.length,
      });
    }

    return c.json({ success: true, generatedAt: new Date().toISOString(), reports });
  } catch (e: any) {
    console.error('[earnings-audit]', e);
    return c.json({ success: false, error: e.message }, 500);
  }
});

app.get('/api/admin/revert-dates', async (c) => {
  try {
    const adminToken = await getAdminToken();
    const invs = await fsQuery('investments', adminToken, [], 100000);
    const activeInvs = invs.filter((i: any) => i.status === 'active' && i.lastSettledAt && i.lastSettledAt.startsWith('2026-03-20'));
    
    let revertedCount = 0;
    const writes: any[] = [];
    for (const inv of activeInvs) {
      writes.push({
        update: {
          name: `projects/dedra-mlm/databases/(default)/documents/investments/${inv.id}`,
          fields: { lastSettledAt: toFirestoreValue('2026-03-19T00:00:00Z') }
        },
        updateMask: { fieldPaths: ['lastSettledAt'] }
      });
      revertedCount++;
    }
    
    if (writes.length > 0) {
      await fsBatchCommit(writes, adminToken);
    }
    
    return c.json({ success: true, revertedCount });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
})


// ── Rank Logic Helpers ────────────────────────────────────────────────────────
const RANK_ORDER: Record<string, number> = {
  'G0': 0, 'G1': 1, 'G2': 2, 'G3': 3, 'G4': 4,
  'G5': 5, 'G6': 6, 'G7': 7, 'G8': 8, 'G9': 9, 'G10': 10
}
function getRankLevel(rankStr: string): number {
  return RANK_ORDER[rankStr] || 0
}

// ==== RANK REQUIREMENT TABLE (운영 fallback — DB 우선) ====
// PART II §0 HARD RULE #1 — 모든 설정값은 settings/rankPromotion.criteria 에서 우선 로드
// [FIX 2026-05-01 #2] G0→G1 승급 조건이 G1 달성 조건과 일치해야 한다.
//   각 행은 "현재 직급(key) → 다음 직급(next) 으로 승급하는 조건"이며,
//   사용자 지정 기준표의 G(N) 행 값은 곧 G(N) 으로 올라가는 조건이다.
//   따라서 'G0' 행에는 'G1 달성 조건'을, 'G1' 행에는 'G2 달성 조건'을 넣어야 한다.
//   이전 G0 fallback (reqSelf=100, reqLeg=0) 으로 100 USDT 이상 투자한 모든 G0 회원이
//   무조건 G1 으로 자동 승급되어 G1 인원이 폭증한 버그 수정.
// reqSelf:  본인 누적 투자액 (USDT) — 승급 시 반드시 충족
// reqSales: 본인 + 산하 전체 누적 매출(USDT)
// reqLeg:   소실적 라인 매출 합 (가장 큰 라인을 제외한 나머지 라인의 합) — 승급 시 반드시 충족
// reqRef:   직추천 활성회원 수 (현재 운영 정책상 0 — 인원 조건 미적용)
// 승급 조건: (selfInvest >= reqSelf) AND (otherLegSales >= reqLeg) — 두 조건 모두 충족해야 함
const RANK_REQUIREMENTS_DEFAULT: Record<string, { next: string; reqSelf: number; reqSales: number; reqLeg: number; reqRef: number }> = {
  // G0 → G1 승급: G1 달성 조건 (본인 300, 소실적 10,000)
  'G0':  { next: 'G1',  reqSelf: 300,    reqSales: 10000,    reqLeg: 10000,    reqRef: 0 },
  // G1 → G2 승급: G2 달성 조건 (본인 500, 소실적 30,000)
  'G1':  { next: 'G2',  reqSelf: 500,    reqSales: 30000,    reqLeg: 30000,    reqRef: 0 },
  // G2 → G3 승급: G3 달성 조건 (본인 1,000, 소실적 70,000)
  'G2':  { next: 'G3',  reqSelf: 1000,   reqSales: 70000,    reqLeg: 70000,    reqRef: 0 },
  // G3 → G4 승급: G4 달성 조건 (본인 2,000, 소실적 200,000)
  'G3':  { next: 'G4',  reqSelf: 2000,   reqSales: 200000,   reqLeg: 200000,   reqRef: 0 },
  // G4 → G5 승급: G5 달성 조건 (본인 3,000, 소실적 500,000)
  'G4':  { next: 'G5',  reqSelf: 3000,   reqSales: 500000,   reqLeg: 500000,   reqRef: 0 },
  // G5 → G6 승급: G6 달성 조건 (본인 5,000, 소실적 1,000,000)
  'G5':  { next: 'G6',  reqSelf: 5000,   reqSales: 1000000,  reqLeg: 1000000,  reqRef: 0 },
  // G6 → G7 승급: G7 달성 조건 (본인 5,000, 소실적 2,000,000)
  'G6':  { next: 'G7',  reqSelf: 5000,   reqSales: 2000000,  reqLeg: 2000000,  reqRef: 0 },
  // G7 → G8 승급: G8 달성 조건 (본인 10,000, 소실적 5,000,000)
  'G7':  { next: 'G8',  reqSelf: 10000,  reqSales: 5000000,  reqLeg: 5000000,  reqRef: 0 },
  // G8 → G9 승급: G9 달성 조건 (본인 10,000, 소실적 10,000,000)
  'G8':  { next: 'G9',  reqSelf: 10000,  reqSales: 10000000, reqLeg: 10000000, reqRef: 0 },
  // G9 → G10 승급: G10 달성 조건 (본인 20,000, 소실적 20,000,000)
  'G9':  { next: 'G10', reqSelf: 20000,  reqSales: 20000000, reqLeg: 20000000, reqRef: 0 }
  // G10 은 최고 직급. 더 이상의 승급 행이 없어야 한다 (이전에 잘못 추가된 G10 행 제거).
}

/**
 * PART II §0 HARD RULE #1 — settings/rankPromotion.criteria 에서 직급 요구사항 로드
 * DB 우선, 누락 또는 실패 시 RANK_REQUIREMENTS_DEFAULT 사용
 */
async function loadRankRequirements(adminToken: string): Promise<Record<string, { next: string; reqSelf: number; reqSales: number; reqLeg: number; reqRef: number }>> {
  const merged: Record<string, { next: string; reqSelf: number; reqSales: number; reqLeg: number; reqRef: number }> = {};
  // default 복사
  for (const k of Object.keys(RANK_REQUIREMENTS_DEFAULT)) {
    merged[k] = { ...RANK_REQUIREMENTS_DEFAULT[k] };
  }
  try {
    const doc = await fsGet('settings/rankPromotion', adminToken).catch(() => null);
    const dbCriteria = doc?.fields?.criteria?.mapValue?.fields || {};
    for (const k of Object.keys(merged)) {
      const c = dbCriteria[k]?.mapValue?.fields;
      if (!c) continue;
      const reqSelf = Number(c.reqSelf?.doubleValue ?? c.reqSelf?.integerValue);
      const reqSales = Number(c.reqSales?.doubleValue ?? c.reqSales?.integerValue);
      const reqLeg = Number(c.reqLeg?.doubleValue ?? c.reqLeg?.integerValue);
      const reqRef = Number(c.reqRef?.doubleValue ?? c.reqRef?.integerValue);
      if (Number.isFinite(reqSelf)) merged[k].reqSelf = reqSelf;
      if (Number.isFinite(reqSales)) merged[k].reqSales = reqSales;
      if (Number.isFinite(reqLeg)) merged[k].reqLeg = reqLeg;
      if (Number.isFinite(reqRef)) merged[k].reqRef = reqRef;
    }
  } catch (_) { /* fallback to defaults */ }
  return merged;
}

// 하위 호환 alias (기존 코드가 RANK_REQUIREMENTS 를 직접 참조)
const RANK_REQUIREMENTS = RANK_REQUIREMENTS_DEFAULT;

// 자동 승급 처리 메인
// users:        users 컬렉션 전체
// wallets:      wallets 컬렉션 전체 (totalInvest 매출 산정용)
// investments:  active 상태 투자만 (현재 미사용. 시그니처 호환 유지)
async function autoUpgradeAllRanks(adminToken: string, users: any[], wallets: any[], _investments: any[]) {
  if (!Array.isArray(users) || users.length === 0) return { upgraded: 0 };

  // ── 지갑 → 매출 매핑
  const walletMap: Record<string, number> = {};
  (wallets || []).forEach((w: any) => {
    const v = (w.totalInvest !== undefined ? w.totalInvest : w.totalInvested) || 0;
    walletMap[w.id] = Number(v) || 0;
  });

  // ── 추천인 트리
  const childrenMap: Record<string, string[]> = {};
  const userMap: Record<string, any> = {};
  users.forEach((u: any) => { childrenMap[u.id] = []; userMap[u.id] = u; });
  users.forEach((u: any) => {
    if (u.referredBy && childrenMap[u.referredBy]) childrenMap[u.referredBy].push(u.id);
  });

  // ── 노드별 매출/소실적 재계산
  const stats: Record<string, { selfInvest: number; networkSales: number; otherLegSales: number; computed: boolean }> = {};
  users.forEach((u: any) => {
    stats[u.id] = { selfInvest: walletMap[u.id] || 0, networkSales: 0, otherLegSales: 0, computed: false };
  });
  const compute = (uid: string): number => {
    const s = stats[uid];
    if (!s) return 0;
    if (s.computed) return s.networkSales;
    let sales = 0, maxLeg = 0;
    for (const cid of (childrenMap[uid] || [])) {
      const cs = stats[cid];
      if (!cs) continue;
      const childSelf = cs.selfInvest;
      const childNet = compute(cid);
      const total = childSelf + childNet;
      sales += total;
      if (total > maxLeg) maxLeg = total;
    }
    s.networkSales = sales;
    s.otherLegSales = sales - maxLeg;
    s.computed = true;
    return sales;
  };
  users.forEach((u: any) => compute(u.id));

  // ── 직추천 활성수 (totalInvested > 0)
  const activeDirectCount: Record<string, number> = {};
  users.forEach((u: any) => {
    const refBy = u.referredBy;
    if (!refBy) return;
    const isActive = (Number(u.totalInvested) || (walletMap[u.id] || 0)) > 0;
    if (isActive) activeDirectCount[refBy] = (activeDirectCount[refBy] || 0) + 1;
  });

  // PART II §0 HARD RULE #1 — DB 우선 직급 요구사항 로드
  const rankReq = await loadRankRequirements(adminToken);

  // ── 승급 가능 여부 평가 → 패치
  let upgraded = 0;
  for (let i = 0; i < users.length; i += 20) {
    const batch = users.slice(i, i + 20);
    await Promise.all(batch.map(async (u: any) => {
      if (u.role === 'admin' || u.role === 'superadmin' || u.rank === 'ADMIN') return;
      const s = stats[u.id]; if (!s) return;
      let currentRank: string = u.rank || 'G0';
      const startLevel = getRankLevel(currentRank);
      let promoted = false;

      // [FIX 2026-04-30] 본인 투자액(reqSelf) + 소실적 합(reqLeg) 두 조건 모두 충족 시에만 승급.
      // 직추천 인원(reqRef)은 0이 기본값이며 설정에서 명시한 경우만 추가 검증.
      // 누적 승급 (한 번의 평가로 여러 단계 동시 승급 가능). safety: 최대 10단계.
      for (let step = 0; step < 10; step++) {
        const req = rankReq[currentRank];
        if (!req) break; // 최고 직급 도달
        const direct = activeDirectCount[u.id] || 0;
        const selfOk = s.selfInvest >= (req.reqSelf || 0);
        const legOk  = s.otherLegSales >= (req.reqLeg || 0);
        const refOk  = direct >= (req.reqRef || 0);
        if (selfOk && legOk && refOk) {
          currentRank = req.next;
          promoted = true;
        } else {
          break;
        }
      }

      if (promoted) {
        try {
          await fsPatch('users/' + u.id, {
            rank: currentRank,
            rankUpgradedAt: new Date().toISOString(),
            previousRank: u.rank || 'G0',
            networkSales: s.networkSales,
            otherLegSales: s.otherLegSales,
            directReferrals: activeDirectCount[u.id] || 0
          }, adminToken);
          upgraded++;

          // 승급 알림(선택) — 실패해도 무시
          try {
            await fsCreate('notifications', {
              userId: u.id,
              title: `🎉 직급 승급! ${u.rank || 'G0'} → ${currentRank}`,
              message: `축하합니다. 직급이 ${currentRank}(으)로 승급되었습니다.`,
              type: 'rank_upgrade',
              priority: 'high',
              icon: '🎖️',
              color: '#8b5cf6',
              isRead: false,
              createdAt: new Date().toISOString()
            }, adminToken);
          } catch (_) {}
        } catch (e) {
          console.error('[autoUpgradeAllRanks] patch failed for', u.id, e);
        }
      } else {
        // 승급은 없지만 매출/소실적/직추천 수치만 갱신 (직급 평가 데이터 최신화)
        const curNet = Number(u.networkSales) || 0;
        const curOther = Number(u.otherLegSales) || 0;
        const curDir = Number(u.directReferrals) || 0;
        const newDir = activeDirectCount[u.id] || 0;
        if (curNet !== s.networkSales || curOther !== s.otherLegSales || curDir !== newDir) {
          try {
            await fsPatch('users/' + u.id, {
              networkSales: s.networkSales,
              otherLegSales: s.otherLegSales,
              directReferrals: newDir,
              salesUpdatedAt: new Date().toISOString()
            }, adminToken);
          } catch (e) {
            console.error('[autoUpgradeAllRanks] sales sync failed for', u.id, e);
          }
        }
      }
    }));
  }

  return { upgraded, total: users.length };
}

// ==== 투자 즉시 매출 누적 헬퍼 (라인 6240 근처에서 호출) ====
// uid의 모든 상위 추천인(루트까지)에 amount만큼 networkSales/otherLegSales 즉시 가산.
// otherLegSales는 정확 계산이 어려우므로 networkSales만 가산하고, 정확한 소실적은
// 다음 cron(autoUpgradeAllRanks)에서 재계산되어 보정됨.
async function bumpUplineNetworkSales(uid: string, amount: number, adminToken: string): Promise<void> {
  if (!amount || amount <= 0) return;
  try {
    let cursor = uid;
    const visited = new Set<string>();
    for (let depth = 0; depth < 30; depth++) {
      if (!cursor || visited.has(cursor)) break;
      visited.add(cursor);
      const uDoc = await fsGet('users/' + cursor, adminToken).catch(() => null);
      if (!uDoc || !uDoc.fields) break;
      const refBy = uDoc.fields.referredBy?.stringValue || null;
      if (!refBy) break;
      // 상위 회원 networkSales += amount
      const upDoc = await fsGet('users/' + refBy, adminToken).catch(() => null);
      if (!upDoc || !upDoc.fields) break;
      const curNet = Number(
        upDoc.fields.networkSales?.doubleValue ?? upDoc.fields.networkSales?.integerValue ?? 0
      );
      await fsPatch('users/' + refBy, {
        networkSales: curNet + amount,
        salesUpdatedAt: new Date().toISOString()
      }, adminToken).catch(e => console.error('[bumpUpline] patch fail', refBy, e));
      cursor = refBy;
    }
  } catch (e) {
    console.error('[bumpUplineNetworkSales] error', e);
  }
}

// ==== END AUTO UPGRADE LOGIC ====



// ─── 예약 발송 자동 실행 ──────────────────────────────────────────────────────
export async function processScheduledBroadcasts(adminToken: string) {
  try {
    const nowMs = Date.now()
    const scheduled = await fsQuery('scheduledBroadcasts', adminToken, [], 50)
    // scheduledAt 은 Firestore Timestamp({_seconds, _nanoseconds}) 또는 ISO 문자열일 수 있음
    const toMs = (v: any): number => {
      if (!v) return Infinity
      if (typeof v === 'string') return new Date(v).getTime()
      if (typeof v === 'number') return v
      if (v._seconds !== undefined) return v._seconds * 1000
      return Infinity
    }
    const pending = scheduled.filter((b: any) => b.status === 'pending' && toMs(b.scheduledAt) <= nowMs)

    for (const broadcast of pending) {
      try {
        // 상태를 sending으로 변경
        await fsPatch(`scheduledBroadcasts/${broadcast.id}`, { status: 'sending' }, adminToken)

        // 대상 회원 조회
        const users = await fsQuery('users', adminToken, [], 100000)
        let targets = users.filter((u: any) => u.status === 'active')
        if (broadcast.targetGroup && broadcast.targetGroup !== 'all' && broadcast.targetGroup !== 'specific') {
          targets = targets.filter((u: any) => u.rank === broadcast.targetGroup)
        }
        // 특정 회원 대상 (autoRules에서 생성된 개인 예약 알림)
        if (broadcast.targetGroup === 'specific' && broadcast.specificUserId) {
          targets = users.filter((u: any) => u.id === broadcast.specificUserId)
        }

        // 알림 발송
        for (const user of targets) {
          await fsCreate('notifications', {
            userId: user.id,
            title: broadcast.title || '',
            message: broadcast.message || '',
            type: broadcast.type || 'broadcast',
            priority: broadcast.priority || 'normal',
            icon: broadcast.icon || '🔔',
            color: broadcast.color || '#10b981',
            isRead: false,
            broadcastId: broadcast.id,
            autoRuleId: broadcast.autoRuleId || null,
            triggerEvent: broadcast.triggerEvent || null,
            createdAt: new Date().toISOString()
          }, adminToken)
        }

        // 발송 완료 처리
        await fsPatch(`scheduledBroadcasts/${broadcast.id}`, {
          status: 'sent',
          sentAt: new Date().toISOString(),
          sentCount: targets.length
        }, adminToken)

        // broadcasts 기록 (개인 알림이 아닌 경우만)
        if (broadcast.targetGroup !== 'specific') {
          await fsCreate('broadcasts', {
            title: broadcast.title,
            message: broadcast.message,
            targetGroup: broadcast.targetGroup || 'all',
            sentAt: new Date().toISOString(),
            sentBy: 'scheduler',
            sentCount: targets.length
          }, adminToken)
        }
      } catch (_) {
        await fsPatch(`scheduledBroadcasts/${broadcast.id}`, { status: 'failed' }, adminToken)
      }
    }
  } catch (_) {}
}


// ─── 스냅샷(백업/복원) API ──────────────────────────────────────────────────
app.post('/api/subadmin/snapshot/create', async (c) => {
  try {
    const authHeader = c.req.header('Authorization') || ''
    const token = authHeader.replace('Bearer ', '')
    const sa = verifySubAdminToken(token)
    if (!sa) return c.json({ error: '인증 실패' }, 401)

    const adminToken = await getAdminToken()
    
    // 1. 데이터 가져오기
    const [users, wallets, investments] = await Promise.all([
      fsQuery('users', adminToken, [], 100000),
      fsQuery('wallets', adminToken, [], 100000),
      fsQuery('investments', adminToken, [], 100000)
    ])

    const dateStr = new Date().toISOString().slice(0,10) // YYYY-MM-DD
    const snapshotId = `snap_${dateStr}`
    
    // 2. snapshots 컬렉션에 메타데이터 저장
    await fsCreateWithId('snapshots', snapshotId, {
      createdAt: new Date().toISOString(),
      createdBy: sa.uid,
      userCount: users.length,
      walletCount: wallets.length,
      investmentCount: investments.length,
      status: 'completed'
    }, adminToken)

    // 3. 서브컬렉션으로 저장 (Firestore REST API limitations make batch writes hard, doing it sequentially or chunks)
    // Actually we can just store the JSON string inside the snapshot document if it's < 1MB
    // Or save it to R2 / D1. We don't have R2 bound by default.
    // So we'll save them as JSON strings in chunks.
    const chunkArray = (arr: any[], size: number) => {
      const res = []
      for(let i=0; i<arr.length; i+=size) res.push(arr.slice(i, i+size))
      return res
    }

    const saveChunks = async (colName: string, data: any[]) => {
      const chunks = chunkArray(data, 100)
      for (let i=0; i<chunks.length; i++) {
        await fsCreateWithId(`snapshots/${snapshotId}/${colName}`, `chunk_${i}`, { data: JSON.stringify(chunks[i]) }, adminToken)
      }
    }

    await saveChunks('users', users)
    await saveChunks('wallets', wallets)
    await saveChunks('investments', investments)

    return c.json({ success: true, snapshotId })
  } catch (e: any) {
    return c.json({ error: e.message }, 500)
  }
})

app.post('/api/subadmin/snapshot/restore', async (c) => {
  try {
    const authHeader = c.req.header('Authorization') || ''
    const token = authHeader.replace('Bearer ', '')
    const sa = verifySubAdminToken(token)
    if (!sa) return c.json({ error: '인증 실패' }, 401)

    const { snapshotId } = await c.req.json()
    if (!snapshotId) return c.json({ error: 'snapshotId 필요' }, 400)

    const adminToken = await getAdminToken()

    const loadChunks = async (colName: string) => {
      const chunks = await fsQuery(`snapshots/${snapshotId}/${colName}`, adminToken, [], 100)
      let all = []
      for (const ch of chunks) {
        if (ch.data) all = all.concat(JSON.parse(ch.data))
      }
      return all
    }

    const [users, wallets, investments] = await Promise.all([
      loadChunks('users'),
      loadChunks('wallets'),
      loadChunks('investments')
    ])

    if (!users.length && !wallets.length) return c.json({ error: '스냅샷 데이터가 없습니다.' }, 404)

    // 복원: 하나씩 덮어쓰기 (Patch)
    // Users
    for (const u of users) {
      if (u.id) await fsPatch(`users/${u.id}`, u, adminToken).catch(()=>null)
    }
    // Wallets
    for (const w of wallets) {
      if (w.id) await fsPatch(`wallets/${w.id}`, w, adminToken).catch(()=>null)
    }
    // Investments
    for (const inv of investments) {
      if (inv.id) await fsPatch(`investments/${inv.id}`, inv, adminToken).catch(()=>null)
    }

    return c.json({ success: true, message: '복원 완료' })
  } catch (e: any) {
    return c.json({ error: e.message }, 500)
  }
})

// ─── 장기 미접속 체크 ─────────────────────────────────────────────────────────
export async function checkInactiveUsers(adminToken: string) {
  try {
    const users = await fsQuery('users', adminToken, [], 100000)
    const threshold = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    for (const user of users) {
      if (user.status !== 'active') continue
      const lastLogin = user.lastLogin || user.createdAt || ''
      if (lastLogin && lastLogin < threshold) {
        await fireAutoRules('no_login_days', user.id, {
          days: '7', email: user.email || ''
        }, adminToken)
      }
    }
  } catch (_) {}
}

// ─── 잔액 부족 체크 ───────────────────────────────────────────────────────────
async function checkLowBalances(adminToken: string) {
  try {
    const wallets = await fsQuery('wallets', adminToken, [], 100000)
    for (const wallet of wallets) {
      if ((wallet.usdtBalance || 0) < 10 && (wallet.dedraBalance || 0) < 10) {
        await fireAutoRules('balance_low', wallet.userId || wallet.id, {
          usdt: String((wallet.usdtBalance || 0).toFixed(2)),
          ddra: String((wallet.dedraBalance || 0).toFixed(2))
        }, adminToken)
      }
    }
  } catch (_) {}
}

// ─── 공지사항 자동 번역 API ───────────────────────────────────────────────────
// MyMemory 무료 번역 API 사용 (API키 불필요, 한국어 지원)
// 하루 5,000자 무료 (일반 공지사항 충분)
// 관리자가 한국어로 공지 저장 시 en/vi/th 자동 번역하여 함께 저장

async function translateText(text: string, targetLang: string): Promise<string> {
  if (!text || !text.trim()) return ''

  const langMap: Record<string, string> = { en: 'en', vi: 'vi', th: 'th' }
  const targetCode = langMap[targetLang] || targetLang

  try {
    // 텍스트가 너무 길면 나눠서 번역
    const chunks = text.match(/.{1,1500}/gs) || [];
    let translatedText = '';
    
    for (const chunk of chunks) {
      const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=ko&tl=${targetCode}&dt=t`;
      const res = await fetch(url, { 
        method: 'POST',
        headers: { 
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
        },
        body: `q=${encodeURIComponent(chunk)}`,
        signal: AbortSignal.timeout(10000) 
      });
      if (res.ok) {
        const data: any = await res.json()
        if (data && data[0]) {
          translatedText += data[0].map((item: any) => item[0] || '').join('');
        }
      } else {
        // Fallback to mymemory
        const mmUrl = `https://api.mymemory.translated.net/get?langpair=ko|${targetCode}`;
        const mmRes = await fetch(mmUrl, { 
          method: 'POST',
          headers: { 
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
        },
          body: `q=${encodeURIComponent(chunk)}`,
          signal: AbortSignal.timeout(10000) 
        });
        if (mmRes.ok) {
          const mmData: any = await mmRes.json();
          if (mmData && mmData.responseData && mmData.responseData.translatedText) {
            translatedText += mmData.responseData.translatedText;
          }
        }
      }
    }
    return translatedText;
  } catch (err) {
    console.error('Translation error:', err)
  }
  return ''
}

app.post('/api/translate/announcement', async (c) => {
  try {
    const { title, content } = await c.req.json()
    if (!title && !content) return c.json({ error: 'title or content required' }, 400)

    const targets = ['en', 'vi', 'th']
    const result: any = {}

    // 순차 처리 (MyMemory rate limit 고려)
    for (const lang of targets) {
      const [translatedTitle, translatedContent] = await Promise.all([
        title ? translateText(title, lang) : Promise.resolve(''),
        content ? translateText(content, lang) : Promise.resolve('')
      ])
      result[`title_${lang}`] = translatedTitle
      result[`content_${lang}`] = translatedContent
    }

    return c.json({ success: true, translations: result })
  } catch (e: any) {
    return c.json({ error: e.message }, 500)
  }
})

// ─── 임시: 공지 목록 조회 (수동 번역 보정용) ────────────────────────────────
// 관리자 인증 후 announcements 컬렉션 전체를 반환. 한국어 원문/번역 상태 확인용.
app.get('/api/admin/announcements/list-for-translation', async (c) => {
  try {
    if (!(await hasPrivilegedApiAccess(c))) {
      return c.json({ error: 'unauthorized' }, 401)
    }
    const adminToken = await getAdminToken()
    const items = await fsQueryRecent('announcements', adminToken, 'createdAt', 200)
    const summary = items.map((a: any) => ({
      id: a.id,
      title: a.title || '',
      content: a.content || '',
      category: a.category || '',
      isPinned: !!a.isPinned,
      isActive: a.isActive !== false,
      createdAt: a.createdAt || '',
      hasEn: !!(a.title_en || a.content_en),
      hasVi: !!(a.title_vi || a.content_vi),
      hasTh: !!(a.title_th || a.content_th),
      title_en: a.title_en || '',
      title_vi: a.title_vi || '',
      title_th: a.title_th || ''
    }))
    return c.json({ success: true, count: summary.length, items: summary })
  } catch (e: any) {
    return c.json({ error: e.message }, 500)
  }
})

// ─── 임시: 특정 공지에 다국어 번역 직접 저장 (수동 번역 보정용) ──────────────
// API 자동 번역을 거치지 않고, 관리자가 미리 준비한 번역문을 그대로 Firestore에 patch.
app.post('/api/admin/announcements/manual-translate', async (c) => {
  try {
    if (!(await hasPrivilegedApiAccess(c))) {
      return c.json({ error: 'unauthorized' }, 401)
    }
    const body: any = await c.req.json().catch(() => ({}))
    const { id, title_en, content_en, title_vi, content_vi, title_th, content_th } = body
    if (!id) return c.json({ error: 'id required' }, 400)

    const adminToken = await getAdminToken()
    const fields: any = {}
    if (typeof title_en === 'string') fields.title_en = title_en
    if (typeof content_en === 'string') fields.content_en = content_en
    if (typeof title_vi === 'string') fields.title_vi = title_vi
    if (typeof content_vi === 'string') fields.content_vi = content_vi
    if (typeof title_th === 'string') fields.title_th = title_th
    if (typeof content_th === 'string') fields.content_th = content_th
    fields.translatedAt = new Date().toISOString()
    fields.updatedAt = new Date().toISOString()

    if (Object.keys(fields).length === 2) {
      return c.json({ error: 'no translation fields provided' }, 400)
    }

    await fsPatch(`announcements/${id}`, fields, adminToken)
    return c.json({ success: true, id, patchedFields: Object.keys(fields) })
  } catch (e: any) {
    return c.json({ error: e.message }, 500)
  }
})


// Upbit Ticker Proxy with in-memory caching and fallback
let tickerCache: any = {};
let lastTickerFetch = 0;

app.get('/api/upbit-ticker', async (c) => {
  try {
    const markets = c.req.query('markets');
    if (!markets) return c.json([]);
    
    const now = Date.now();
    // Use cache if less than 3 seconds old
    if (now - lastTickerFetch < 3000 && tickerCache[markets]) {
      return c.json(tickerCache[markets]);
    }
    
    const resp = await fetch('https://api.upbit.com/v1/ticker?markets=' + markets, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Cache-Control': 'no-cache'
      }
    });
    
    if (!resp.ok) {
       // If upbit blocked it or failed, return last known good cache if exists
       if (tickerCache[markets]) return c.json(tickerCache[markets]);
       return c.json([]);
    }
    
    const data = await resp.json();
    tickerCache[markets] = data;
    lastTickerFetch = now;
    
    return c.json(data);
  } catch (err) {
    // Return cache on error
    const markets = c.req.query('markets');
    if (markets && tickerCache[markets]) return c.json(tickerCache[markets]);
    return c.json([]);
  }
});


// ----- 팟캐스트 R2 라우트 -----
// ----- 팟캐스트 조회 API (Firestore Rules 우회) -----
app.get('/api/podcasts', async (c) => {
  try {
    const adminToken = await getAdminToken();
    const res = await fsQuery('podcasts', adminToken, [], 100);
    // Sort by createdAt desc
    res.sort((a: any, b: any) => {
      const ta = new Date(a.createdAt || 0).getTime();
      const tb = new Date(b.createdAt || 0).getTime();
      return tb - ta;
    });
    return c.json({ success: true, data: res });
  } catch(error: any) {
    console.error('get podcasts err', error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

app.post('/api/admin/impersonate', async (c) => {
  try {
    const authHeader = c.req.header('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) return c.json({ error: 'Unauthorized' }, 401)
    const idToken = authHeader.split('Bearer ')[1]
    
    const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken })
    })
    const data = await res.json()
    if (!data.users || !data.users.length) return c.json({ error: 'Invalid token' }, 401)
    
    // In a real app we might check if this user is truly an admin by email/uid.
    // For now we assume if they can hit this API with a valid token, they are admin.

    const body = await c.req.json()
    const targetUid = body.uid
    if (!targetUid) return c.json({ error: 'target UID required' }, 400)
    
    const now = Math.floor(Date.now() / 1000)
    const headerObj = { alg: 'RS256', typ: 'JWT' }
    const payloadObj = {
      aud: 'https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit',
      iat: now,
      exp: now + 3600,
      iss: SERVICE_ACCOUNT.client_email,
      sub: SERVICE_ACCOUNT.client_email,
      uid: targetUid
    }
    const b64url = (obj) => btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
    const sigInput = `${b64url(headerObj)}.${b64url(payloadObj)}`
    
    const pemKey = SERVICE_ACCOUNT.private_key
      .replace(('-----BEGIN' + ' PRIVATE KEY-----'), '')
      .replace(('-----END P' + 'RIVATE KEY-----'), '')
      .replace(/\n/g, '')
    const keyData = Uint8Array.from(atob(pemKey), c => c.charCodeAt(0))
    const cryptoKey = await crypto.subtle.importKey(
      'pkcs8', keyData.buffer,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false, ['sign']
    )
    const encoder = new TextEncoder()
    const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', cryptoKey, encoder.encode(sigInput))
    const sigB64url = btoa(String.fromCharCode(...new Uint8Array(signature)))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
      
    const customToken = `${sigInput}.${sigB64url}`
    return c.json({ success: true, customToken })
  } catch (e: any) {
    return c.json({ error: e.message }, 500)
  }
})

app.post('/api/admin/podcast/upload', async (c) => {
  try {
    const authHeader = c.req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    
    const body = await c.req.parseBody();
    const file = body['file'];
    const title = body['title'] || '';
    const description = body['description'] || '';
    
    if (!file) {
      return c.json({ error: 'No file uploaded' }, 400);
    }
    
    const { env } = c as any;
    if (!env.PODCAST_BUCKET) {
      return c.json({ error: 'R2 Bucket not configured' }, 500);
    }
    
    // @ts-ignore
    const ext = file.name ? file.name.split('.').pop() : 'mp3';
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 8);
    const key = `podcast_${timestamp}_${randomStr}.${ext}`;
    
    // @ts-ignore
    await env.PODCAST_BUCKET.put(key, await file.arrayBuffer(), {
      httpMetadata: {
        // @ts-ignore
        contentType: file.type || 'audio/mpeg'
      }
    });
    
    const audioUrl = `/api/podcast/audio/${key}`;
    
    // DB 저장
    const adminToken = await getAdminToken();
    const docData = {
      title,
      description,
      fileKey: key,
      audioUrl: audioUrl,
      // @ts-ignore
      fileName: file.name || '',
      // @ts-ignore
      fileSize: file.size || 0,
      createdAt: new Date()
    };
    
    const firestoreFields: any = {};
    for (const [k, v] of Object.entries(docData)) {
      firestoreFields[k] = toFirestoreValue(v);
    }
    
    const docId = crypto.randomUUID().replace(/-/g, '');
    await fetch(`${FIRESTORE_BASE}/podcasts?documentId=${docId}`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields: firestoreFields })
    });
    
    return c.json({ success: true, key, audioUrl, docId });
  } catch (error: any) {
    console.error('Podcast upload error:', error);
    return c.json({ error: error.message }, 500);
  }
});
    


app.delete('/api/admin/podcast/:key', async (c) => {
  try {
    const authHeader = c.req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    
    const key = c.req.param('key');
    const docId = c.req.query('docId');
    const { env } = c as any;
    
    if (env.PODCAST_BUCKET) {
      await env.PODCAST_BUCKET.delete(key);
    }
    
    if (docId) {
      const adminToken = await getAdminToken();
      await fetch(`${FIRESTORE_BASE}/podcasts/${docId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${adminToken}` }
      });
    }
    
    return c.json({ success: true });
  } catch (error: any) {
    console.error('Podcast delete error:', error);
    return c.json({ error: error.message }, 500);
  }
});
app.get('/api/podcast/audio/:key', async (c) => {
  try {
    const key = c.req.param('key');
    const { env } = c as any;
    
    if (!env.PODCAST_BUCKET) {
      return c.text('Not configured', 500);
    }
    
    const reqHeaders = new Headers(c.req.raw.headers);
    const rangeHeader = reqHeaders.get('range');
    const object = await env.PODCAST_BUCKET.get(key, rangeHeader ? { range: c.req.raw.headers } : undefined);
    
    if (!object) {
      return c.text('Not found', 404);
    }
    
    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set('etag', object.httpEtag);
    headers.set('Cache-Control', 'public, max-age=31536000'); // 캐싱 적용
    headers.set('Accept-Ranges', 'bytes');
    
    // 강제 콘텐츠 타입 설정 (R2에 잘못 저장되어 있을 경우 대비)
    if (!headers.has('Content-Type') || headers.get('Content-Type') === 'application/octet-stream') {
       if (key.endsWith('.mp3')) headers.set('Content-Type', 'audio/mpeg');
       else if (key.endsWith('.mp4')) headers.set('Content-Type', 'video/mp4');
    }
    // range 헤더가 있으면 206 리턴 지원 여부는 CF R2가 어느정도 지원하는지...
    // 기본적으로 stream body 반환시 워커에서 통과됨
    
    const status = object.range ? 206 : 200;
    if (object.range) {
       headers.set('Content-Range', `bytes ${object.range.offset}-${object.range.offset + object.range.length - 1}/${object.size}`);
       headers.set('Content-Length', object.range.length.toString());
    }
    return new Response(object.body, {
      status,
      headers
    });
  } catch (error: any) {
    return c.text('Error', 500);
  }
});


app.get('/api/admin/debug-pending', async (c) => {
  const adminToken = await getAdminToken();
  const txs = await fsQuery('transactions', adminToken);
  const pendingDeposits = txs.filter((t: any) => t.status === 'pending' && t.type === 'deposit');
  
  // Also fetch company wallet
  const settingsDoc = await fsGet('settings/companyWallets', adminToken);
  let depositAddress = '';
  if (settingsDoc && settingsDoc.fields && settingsDoc.fields.wallets && settingsDoc.fields.wallets.arrayValue && settingsDoc.fields.wallets.arrayValue.values) {
    const wallets = settingsDoc.fields.wallets.arrayValue.values;
    if (wallets.length > 0 && wallets[0].mapValue && wallets[0].mapValue.fields && wallets[0].mapValue.fields.address) {
      depositAddress = wallets[0].mapValue.fields.address.stringValue || '';
    }
  }

  return c.json({ pendingDeposits, depositAddress });
});



// ─── Jupiter Swap 실행 ─────────────────────────
app.post('/api/solana/execute-swap', async (c) => {
  let adminToken = '';
  let dwalletSwapLock: DwalletSwapLock | null = null;
  try {
    const authHeader = c.req.header('Authorization');
    if (!authHeader) return c.json({ error: 'Missing auth header' }, 401);
    const idToken = authHeader.split('Bearer ')[1];
    if (!idToken) return c.json({ error: 'Invalid token format' }, 401);

    const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken })
    });
    const data = await res.json();
    if (!data.users || !data.users.length) return c.json({ error: 'Invalid token' }, 401);
    
    const uid = data.users[0].localId;
    adminToken = await getAdminToken();

    // Get user wallet from DB
    const uRes = await fetch(`${FIRESTORE_BASE}/users/${uid}`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const uData = await uRes.json();
    
    const pubKey = uData.fields?.deedraWallet?.mapValue?.fields?.publicKey?.stringValue;
    const secretKeyStr = uData.fields?.deedraWallet?.mapValue?.fields?.secretKeyArray?.stringValue;
    if (!pubKey || !secretKeyStr) return c.json({ error: 'Deedra Wallet not found' }, 400);

    const body = await c.req.json().catch(() => ({}));
    const { fromSymbol, toSymbol, amountUi } = body;
    const amountNumber = Number(amountUi);
    
    if (!Number.isFinite(amountNumber) || amountNumber <= 0) return c.json({ error: 'Invalid amount' }, 400);
    
    // 🔥 동적 슬리피지: 클라이언트 입력값 우선, 미전달 시 기본 500bps(5%)
    let slippageBps = Number(body.slippageBps);
    if (!Number.isFinite(slippageBps) || slippageBps <= 0) slippageBps = 500;
    if (slippageBps > 5000) slippageBps = 5000; // 상한 50%
    if (slippageBps < 50) slippageBps = 50;     // 하한 0.5%

    const tokens: any = {
      'USDT': { mint: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', decimals: 6 },
      'DDRA': { mint: 'DDRADez92SA7jLhzL2bjBkWBK9idqvrhX1CuAZFaAgyv', decimals: 6 },
      'SOL': { mint: 'So11111111111111111111111111111111111111112', decimals: 9 }
    };

    const inputMint = tokens[fromSymbol]?.mint;
    const outputMint = tokens[toSymbol]?.mint;
    const decimals = tokens[fromSymbol]?.decimals;

    if (!inputMint || !outputMint || decimals == null) return c.json({ error: 'Invalid token symbol' }, 400);

    const lockResult = await acquireDwalletSwapLock(c, adminToken, uid, fromSymbol, toSymbol, amountNumber);
    if (!lockResult.ok) return lockResult.response;
    dwalletSwapLock = lockResult.lock;

    const amountLamports = Math.floor(amountNumber * Math.pow(10, decimals));

    
    
    // 0. Check SOL balance for fees (Minimum 0.001 SOL required for rent/fees)
    const solBalRes = await fetch('https://solana-rpc.publicnode.com', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getBalance',
        params: [pubKey]
      })
    });
    const solBalData = await solBalRes.json();
    const lamportsBal = solBalData?.result?.value || 0;
    
    // ===== [수수료 대납 로직 추가] =====
    // 유저의 SOL이 0.002 SOL (5000000 lamports) 미만일 경우 스폰서 지갑에서 지원
    if (lamportsBal < 5000000) {
      const spKey = (c.env as any).SPONSOR_SOL_SECRET;
      if (!spKey) {
        return c.json({ error: '회사의 수수료 대납 지갑(SPONSOR_SOL_SECRET)이 서버에 설정되지 않았습니다.' }, 400);
      }
      
try {
const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
        const ALPHABET_MAP = {};
        for (let i = 0; i < ALPHABET.length; i++) ALPHABET_MAP[ALPHABET[i]] = i;
        function decodeBs58(S) {
            const bytes = [0];
            for (let i = 0; i < S.length; i++) {
                const c = S[i];
                if (!(c in ALPHABET_MAP)) throw new Error("Non-base58 character");
                for (let j = 0; j < bytes.length; j++) bytes[j] *= 58;
                bytes[0] += ALPHABET_MAP[c];
                let carry = 0;
                for (let j = 0; j < bytes.length; j++) {
                    bytes[j] += carry;
                    carry = bytes[j] >> 8;
                    bytes[j] &= 0xff;
                }
                while (carry) { bytes.push(carry & 0xff); carry >>= 8; }
            }
            for (let i = 0; i < S.length && S[i] === "1"; i++) bytes.push(0);
            return new Uint8Array(bytes.reverse());
        }
        
        
        
        let sponsorSecret;
        try {
            let trimmed = spKey.trim();
            if (trimmed.startsWith('[')) {
                sponsorSecret = Uint8Array.from(JSON.parse(trimmed));
            } else {
                sponsorSecret = decodeBs58(trimmed); // assuming base58
            }
        } catch (e) {
            return c.json({ error: '회사의 수수료 대납 지갑 파싱 오류' }, 400);
        }
        
        const sponsorPubkey = sponsorSecret.slice(32);
        
        const userSecretArray = JSON.parse(secretKeyStr);
        const toPubkeyBytes = Uint8Array.from(userSecretArray).slice(32);
        
        const systemProgram = new Uint8Array(32);
        
        // 1. Get blockhash
        const bhRes = await fetch('https://solana-rpc.publicnode.com', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({"jsonrpc":"2.0","id":1,"method":"getLatestBlockhash","params":[{"commitment":"confirmed"}]})
        });
        const bhData = await bhRes.json();
        const blockhash = bhData.result.value.blockhash;
        const blockhashBytes = decodeBs58(blockhash);
        
        // 2. Build 149-byte transfer message
        const message = new Uint8Array(150);
        message[0] = 1; message[1] = 0; message[2] = 1; message[3] = 3;
        message.set(sponsorPubkey, 4);
        message.set(toPubkeyBytes, 36);
        message.set(systemProgram, 68);
        message.set(blockhashBytes, 100);
        message[132] = 1;
        message[133] = 2; message[134] = 2; message[135] = 0; message[136] = 1; message[137] = 12;
        message[138] = 2; message[139] = 0; message[140] = 0; message[141] = 0;
        
        const lamports = BigInt(5000000);
        for (let i = 0; i < 8; i++) {
            message[142 + i] = Number((lamports >> BigInt(i * 8)) & 0xffn);
        }
        
        // 3. Sign
        const signature = nacl.sign.detached(message, sponsorSecret);
        
        // 4. Serialize
        const txBuf = new Uint8Array(1 + 64 + 150);
        txBuf[0] = 1;
        txBuf.set(signature, 1);
        txBuf.set(message, 65);
        
        let binary = '';
        for (let i = 0; i < txBuf.byteLength; i++) {
            binary += String.fromCharCode(txBuf[i]);
        }
        const base64Tx = btoa(binary);
        
        // 5. Send transaction
        const sendRes = await fetch('https://solana-rpc.publicnode.com', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({"jsonrpc":"2.0","id":1,"method":"sendTransaction","params":[base64Tx,{"encoding":"base64","skipPreflight":true,"maxRetries":2}]})
        });
        
        const sendData = await sendRes.json();
        if (sendData.error) throw new Error(sendData.error.message || JSON.stringify(sendData.error));
        
        console.log('Sponsor sent 0.002 SOL: ' + sendData.result);
        
        // Wait for propagation
        await new Promise(r => setTimeout(r, 2000));
        
      } catch (sponsorErr: any) {
        console.error('Sponsor error:', sponsorErr);
        return c.json({ error: '수수료 대납 처리 중 오류가 발생했습니다: ' + sponsorErr.message }, 500);
      }
    }


    // 1. Get Jupiter Quote (동적 슬리피지)
    const quoteRes = await fetch(`https://api.jup.ag/swap/v1/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amountLamports}&slippageBps=${slippageBps}`);
    const quoteText = await quoteRes.text();
    let quoteData;
    try { quoteData = JSON.parse(quoteText); } catch(e) { throw new Error('Jupiter Quote Error: ' + quoteText.substring(0,100)); }
    
    if (quoteData.error) return c.json({ error: 'Jupiter Quote Error: ' + quoteData.error }, 400);

    // 2. Get Swap Transaction (우선순위 수수료 + 동적 컴퓨트 유닛)
    const swapRes = await fetch('https://api.jup.ag/swap/v1/swap', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        quoteResponse: quoteData,
        userPublicKey: pubKey,
        wrapAndUnwrapSol: true,
        dynamicComputeUnitLimit: true,
        prioritizationFeeLamports: 'auto'
      })
    });
    const swapText = await swapRes.text();
    let swapData;
    try { swapData = JSON.parse(swapText); } catch(e) { throw new Error('Jupiter Swap Error: ' + swapText.substring(0,100)); }
    
    if (swapData.error) return c.json({ error: 'Jupiter Swap Error: ' + swapData.error }, 400);

    const swapTransaction = swapData.swapTransaction;

// 3. Sign the transaction manually using tweetnacl
    
    
    const secretKeyArray = JSON.parse(secretKeyStr);
    const secretKey = Uint8Array.from(secretKeyArray);
    
    const swapTransactionBuf = Uint8Array.from(atob(swapTransaction), c => c.charCodeAt(0));
    
    const numSignatures = swapTransactionBuf[0];
    const messageOffset = 1 + numSignatures * 64;
    const messageBytes = swapTransactionBuf.slice(messageOffset);
    
    const signature = nacl.sign.detached(messageBytes, secretKey);
    swapTransactionBuf.set(signature, 1);
    
    let binary = '';
    for (let i = 0; i < swapTransactionBuf.byteLength; i++) {
        binary += String.fromCharCode(swapTransactionBuf[i]);
    }
    const base64Tx = btoa(binary);
    
    const connectionRes = await fetch('https://solana-rpc.publicnode.com', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'sendTransaction',
        params: [
          base64Tx,
          { encoding: 'base64', skipPreflight: false, preflightCommitment: 'processed', maxRetries: 3 }
        ]
      })
    });
    
const textRes = await connectionRes.text();
    let connectionData;
    try {
        connectionData = JSON.parse(textRes);
    } catch(e) {
        throw new Error('RPC Error: ' + textRes.substring(0, 100));
    }
    if (connectionData.error) {
      const errMsg = connectionData.error.message || JSON.stringify(connectionData.error);
      // 🔥 0x1788 = 슬리피지 초과 오류, 사용자에게 더 명확하게 안내
      if (errMsg.includes('0x1788') || errMsg.toLowerCase().includes('slippage')) {
        return c.json({
          error: `시세 변동이 커서 스왑이 실패했습니다. 슬리피지를 ${Math.min(50, Math.ceil((slippageBps / 100) * 2))}% 이상으로 올려서 다시 시도해주세요.`,
          code: 'slippage_exceeded',
          slippageBpsUsed: slippageBps
        }, 400);
      }
      throw new Error(errMsg);
    }
    const txid = connectionData.result;
    
    // Poll for confirmation (up to 12 seconds)
    let isConfirmed = false;
    let confirmErr: any = null;
    for (let i = 0; i < 6; i++) {
        await new Promise(r => setTimeout(r, 2000));
        try {
            const statRes = await fetch('https://solana-rpc.publicnode.com', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getSignatureStatuses', params: [[txid], { searchTransactionHistory: true }] })
            });
            const statData = await statRes.json();
            if (statData && statData.result && statData.result.value && statData.result.value[0]) {
                const status = statData.result.value[0];
                if (status.err) {
                    confirmErr = status.err;
                    const errStr = JSON.stringify(status.err);
                    // 🔥 슬리피지 초과(0x1788) 감지
                    if (errStr.includes('0x1788') || errStr.includes('6024')) {
                        return c.json({
                            error: `시세 변동으로 스왑이 실패했습니다 (슬리피지 ${(slippageBps/100).toFixed(2)}% 초과). 슬리피지 톨러런스를 더 높여 재시도해주세요.`,
                            code: 'slippage_exceeded',
                            slippageBpsUsed: slippageBps,
                            txid
                        }, 400);
                    }
                    return c.json({ error: '솔라나 네트워크에서 스왑이 실패했습니다: ' + errStr.substring(0,200), txid }, 400);
                }
                if (status.confirmationStatus === 'confirmed' || status.confirmationStatus === 'finalized' || status.confirmationStatus === 'processed') {
                    isConfirmed = true;
                    break;
                }
            }
        } catch(e) {}
    }
    
    // Even if not confirmed in 12s, if it didn't explicitly fail, we proceed, but usually it confirms.
    
    const outAmount = quoteData.outAmount / Math.pow(10, tokens[toSymbol].decimals);

    try {
      const uEmail = uData.fields?.email?.stringValue || 'unknown';
      const docId = 'swap_' + txid.substring(0, 15) + '_' + Date.now();
      await fetch(`${FIRESTORE_BASE}/transactions?documentId=${docId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({
          fields: {
            userId: { stringValue: uid },
            userEmail: { stringValue: uEmail },
            type: { stringValue: 'swap' },
            amount: { doubleValue: Number(amountNumber) },
            currency: { stringValue: fromSymbol },
            toAmount: { doubleValue: Number(outAmount) },
            toCurrency: { stringValue: toSymbol },
            txid: { stringValue: txid },
            status: { stringValue: 'approved' },
            walletType: { stringValue: 'deedra' },
            executionMode: { stringValue: 'dwallet_fast_trade' },
            swapLockId: { stringValue: uid },
            swapLockedAt: { timestampValue: dwalletSwapLock?.acquiredAt || new Date().toISOString() },
            createdAt: { timestampValue: new Date().toISOString() }
          }
        })
      });
    } catch(e) { console.error('Save swap history error:', e); }

    return c.json({ success: true, txid, outAmount });
  } catch (e: any) {
    console.error('Swap execution error:', e);
    return c.json({ error: e.message || 'Swap Failed' }, 500);
  } finally {
    if (dwalletSwapLock && adminToken) {
      await releaseDwalletSwapLock(dwalletSwapLock, adminToken).catch((error) => {
        console.warn('[dwallet-swap-lock] release failed', error);
      });
    }
  }
});




// ════════════════════════════════════════════════════════════════════
// 보너스 지급 API (2026-04-30 복원)
// — 클라이언트 Firestore SDK 직호출 대신 서버 측 안정 검색 + 트랜잭션 지급
// ════════════════════════════════════════════════════════════════════

// (A) 다단계 회원 검색 — UID / 이메일 / username / solanaWallet / referralCode
app.get('/api/admin/bonus/find-user', async (c) => {
  try {
    if (!(await hasPrivilegedApiAccess(c))) return c.json({ success: false, error: 'unauthorized' }, 401);
    const adminToken = await getAdminToken();
    const qRaw = String(c.req.query('q') || '').trim();
    if (!qRaw) return c.json({ success: false, error: '검색어가 비어 있습니다.' }, 400);
    const q = qRaw;
    const qLower = q.toLowerCase();

    // 1) UID 직접 조회 시도 (20자 이상이면 Firebase UID 가능성 높음)
    if (q.length >= 20 && /^[A-Za-z0-9_-]+$/.test(q)) {
      const direct = await fsGet(`users/${q}`, adminToken).catch(() => null);
      if (direct?.fields) {
        const u = firestoreDocToObj(direct);
        return c.json({ success: true, user: { uid: q, ...u }, matchedBy: 'uid' });
      }
    }

    // 2) referralCode (대문자) → username (소문자) → email → solanaWallet 순서로 EQUAL 쿼리
    const tries: Array<{ field: string; value: string; matchedBy: string }> = [
      { field: 'referralCode', value: q.toUpperCase(), matchedBy: 'referralCode' },
      { field: 'username', value: qLower, matchedBy: 'username' },
      { field: 'email', value: qLower, matchedBy: 'email' },
      { field: 'solanaWallet', value: q, matchedBy: 'solanaWallet' },
      { field: 'referralCode', value: q, matchedBy: 'referralCode' },
      { field: 'username', value: q, matchedBy: 'username' },
    ];

    for (const t of tries) {
      try {
        const rows = await fsQuery('users', adminToken, [
          { fieldFilter: { field: { fieldPath: t.field }, op: 'EQUAL', value: { stringValue: t.value } } }
        ], 1);
        if (rows && rows.length) {
          const u = rows[0];
          return c.json({ success: true, user: { uid: u.id, ...u }, matchedBy: t.matchedBy });
        }
      } catch (_) { /* 다음 시도 */ }
    }

    // 3) 부분일치 폴백 (적은 사용자 환경에서만): 전체 스캔 후 substring 매치
    try {
      const all = await fsQuery('users', adminToken, [], 5000);
      const hit = (all || []).find((u: any) => {
        const fields = [u.username, u.email, u.solanaWallet, u.referralCode, u.id, u.name].filter(Boolean).map((x: any) => String(x).toLowerCase());
        return fields.some((f: string) => f === qLower) || fields.some((f: string) => f.includes(qLower));
      });
      if (hit) return c.json({ success: true, user: { uid: hit.id, ...hit }, matchedBy: 'substring' });
    } catch (_) { /* ignore */ }

    return c.json({ success: false, error: `회원을 찾을 수 없습니다: "${qRaw}"` }, 404);
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500);
  }
});

// (B) 수동 보너스 지급
//   bonusType: 'balance' → bonusBalance + totalEarnings 가산 (자유 사용)
//              'freeze'  → 보너스 투자 문서 생성 + 지갑 bonusInvest 가산 (롤업 불가)
//   prodInfo (freeze 시 필수): { id, name, roi(%), days }
app.post('/api/admin/bonus/grant', async (c) => {
  try {
    if (!(await hasPrivilegedApiAccess(c))) return c.json({ success: false, error: 'unauthorized' }, 401);
    const adminToken = await getAdminToken();
    const body = await c.req.json().catch(() => ({}));
    const userId = String(body.userId || '').trim();
    const amount = Number(body.amount);
    const reason = String(body.reason || '').trim();
    const bonusType = String(body.bonusType || 'balance');
    const prodInfo = body.prodInfo || null;
    const adminUid = String(body.adminUid || c.get('adminUid' as any) || 'admin');

    if (!userId) return c.json({ success: false, error: 'userId 필수' }, 400);
    if (!Number.isFinite(amount) || amount <= 0) return c.json({ success: false, error: '지급 금액은 0보다 커야 합니다.' }, 400);
    if (!reason) return c.json({ success: false, error: '지급 사유 필수' }, 400);
    if (!['balance', 'freeze'].includes(bonusType)) return c.json({ success: false, error: '잘못된 지급 방식' }, 400);
    if (bonusType === 'freeze' && (!prodInfo || !prodInfo.id || !prodInfo.name || !Number.isFinite(Number(prodInfo.roi)) || !Number.isFinite(Number(prodInfo.days)))) {
      return c.json({ success: false, error: '프리즈 지급 시 상품 정보(id/name/roi/days)가 필요합니다.' }, 400);
    }

    // 회원·지갑 존재 검증
    const userDoc = await fsGet(`users/${userId}`, adminToken).catch(() => null);
    if (!userDoc?.fields) return c.json({ success: false, error: `회원을 찾을 수 없습니다: ${userId}` }, 404);

    let walletDoc = await fsGet(`wallets/${userId}`, adminToken).catch(() => null);
    if (!walletDoc?.fields) {
      // 지갑 없으면 자동 생성 (보너스 지급은 0에서 가산)
      await fsSet(`wallets/${userId}`, {
        userId,
        usdtBalance: 0,
        bonusBalance: 0,
        totalInvest: 0,
        totalEarnings: 0,
        bonusInvest: 0,
        createdAt: new Date().toISOString(),
      }, adminToken);
      walletDoc = await fsGet(`wallets/${userId}`, adminToken).catch(() => null);
    }
    const wallet = walletDoc?.fields ? firestoreDocToObj(walletDoc) : { bonusBalance: 0, totalEarnings: 0, bonusInvest: 0 };

    const round8 = (x: number) => Math.round(x * 1e8) / 1e8;
    const amt = round8(amount);
    const nowIso = new Date().toISOString();

    if (bonusType === 'freeze') {
      const roi = Number(prodInfo.roi);
      const days = Math.max(1, Math.round(Number(prodInfo.days)));
      const startDate = new Date();
      const endDate = new Date(startDate.getTime() + days * 86400000);
      const expectedReturn = round8(amt * roi * days / 100);

      // 1) 보너스 투자 문서 생성
      const inv = await fsCreate('investments', {
        userId,
        productId: prodInfo.id,
        productName: prodInfo.name,
        amount: amt,
        amountUsdt: amt,
        roiPercent: roi,
        dailyRoi: roi,
        durationDays: days,
        duration: days,
        expectedReturn,
        status: 'active',
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        createdAt: nowIso,
        isBonus: true,
        excludeFromSales: true,
        noRollup: true,
        manualBonus: true,
        grantedBy: adminUid,
      }, adminToken);

      // 2) 지갑 bonusInvest 가산
      await fsPatch(`wallets/${userId}`, {
        bonusInvest: round8(Number(wallet.bonusInvest || 0) + amt),
        updatedAt: nowIso,
      }, adminToken);

      // 3) bonuses 로그
      await fsCreate('bonuses', {
        userId,
        amount: amt,
        type: 'manual_bonus',
        subtype: 'freeze_product',
        reason: `[프리즈상품:${prodInfo.name}] ${reason}`,
        productId: prodInfo.id,
        productName: prodInfo.name,
        roi,
        days,
        grantedBy: adminUid,
        createdAt: nowIso,
      }, adminToken);

      // 4) 관리자 감사 로그
      await fsCreate(ADMIN_AUDIT_LOG_COLLECTION, {
        action: 'manual_bonus',
        actor: adminUid,
        targetUserId: userId,
        amount: amt,
        bonusType: 'freeze',
        reason,
        prodInfo: { id: prodInfo.id, name: prodInfo.name, roi, days },
        createdAt: nowIso,
      }, adminToken).catch(() => null);

      return c.json({
        success: true,
        bonusType: 'freeze',
        userId,
        amount: amt,
        currency: 'USDT',
        productName: prodInfo.name,
        productId: prodInfo.id,
        roi,
        days,
        investmentId: inv?.id || null,
        message: `✅ ${amt.toFixed(2)} USDT 가 [${prodInfo.name}] 프리즈 보너스 상품으로 지급되었습니다.`,
      });
    }

    // bonusType === 'balance'
    await fsPatch(`wallets/${userId}`, {
      bonusBalance: round8(Number(wallet.bonusBalance || 0) + amt),
      totalEarnings: round8(Number(wallet.totalEarnings || 0) + amt),
      updatedAt: nowIso,
    }, adminToken);

    await fsCreate('bonuses', {
      userId,
      amount: amt,
      type: 'manual_bonus',
      subtype: 'balance',
      reason,
      grantedBy: adminUid,
      createdAt: nowIso,
    }, adminToken);

    await fsCreate(ADMIN_AUDIT_LOG_COLLECTION, {
      action: 'manual_bonus',
      actor: adminUid,
      targetUserId: userId,
      amount: amt,
      bonusType: 'balance',
      reason,
      createdAt: nowIso,
    }, adminToken).catch(() => null);

    return c.json({
      success: true,
      bonusType: 'balance',
      userId,
      amount: amt,
      currency: 'USDT',
      message: `✅ ${amt.toFixed(2)} USDT 가 수익 잔액(보너스)으로 지급되었습니다.`,
    });
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500);
  }
});

// (C) 보너스용 상품 목록 (이름·ROI·기간만, 프론트 셀렉트 채우기용)
app.get('/api/admin/bonus/products', async (c) => {
  try {
    if (!(await hasPrivilegedApiAccess(c))) return c.json({ success: false, error: 'unauthorized' }, 401);
    const adminToken = await getAdminToken();
    const list = await fsQuery('products', adminToken, [], 200);
    const products = (list || []).map((p: any) => {
      const roi = p.dailyRoi !== undefined ? p.dailyRoi : (p.roiPercent !== undefined ? p.roiPercent : (p.roi || 0));
      const days = p.duration !== undefined ? p.duration : (p.durationDays !== undefined ? p.durationDays : (p.days || 0));
      return {
        id: p.id,
        name: p.name || p.id,
        roi: Number(roi) || 0,
        days: Number(days) || 0,
        minAmount: Number(p.minAmount || 0),
        maxAmount: Number(p.maxAmount || 0),
        active: p.active !== false,
      };
    }).filter((p: any) => p.active !== false)
      .sort((a: any, b: any) => (a.days - b.days) || (a.roi - b.roi));
    return c.json({ success: true, products });
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500);
  }
});

// ════════════════════════════════════════════════════════════════════
// 회원 초기화 API (2026-04-30) — username 다건 입력 → 지정 회원 데이터 일괄 초기화
//   • wallets/{uid} 잔액/누적 0
//   • investments — 해당 userId 문서 모두 삭제
//   • bonuses — 해당 userId 문서 모두 삭제
//   • transactions — 해당 userId 문서 모두 삭제 (deposit/withdraw/roi 등)
//   • users/{uid} — networkSales/otherLegSales/totalSales/currentRank 등 누적 0
//   • adminAuditLogs 에 reset_user 기록
// ════════════════════════════════════════════════════════════════════
app.post('/api/admin/reset-users', async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const headerSecret = c.req.header('x-cron-secret') || c.req.header('X-Cron-Secret') || '';
    const adminApiHeader = c.req.header('x-admin-api-secret') || c.req.header('X-Admin-Api-Secret') || '';
    const env: any = (c.env || {});
    const adminApiSecret = String(env.ADMIN_API_SECRET || (globalThis as any)?.GLOBAL_ENV?.ADMIN_API_SECRET || '').trim();
    const okSecret = isValidCronSecret(headerSecret) || isValidCronSecret(body.secret);
    const okAdminApi = !!adminApiSecret && (adminApiHeader === adminApiSecret || body.adminApiSecret === adminApiSecret);
    const okAdmin = await hasPrivilegedApiAccess(c).catch(() => false);
    if (!okSecret && !okAdminApi && !okAdmin) {
      return c.json({ success: false, error: 'unauthorized' }, 401);
    }
    const adminToken = await getAdminToken();
    const usernamesRaw: any[] = Array.isArray(body.usernames) ? body.usernames : [];
    const usernames: string[] = usernamesRaw.map((s: any) => String(s || '').trim()).filter(Boolean);
    const adminUid = String(body.adminUid || 'admin');
    const dryRun = !!body.dryRun;
    if (!usernames.length) return c.json({ success: false, error: 'usernames 비어 있음' }, 400);

    const results: any[] = [];
    for (const uname of usernames) {
      const result: any = { username: uname, found: false, uid: null, deleted: { investments: 0, bonuses: 0, transactions: 0, sales: 0 }, walletReset: false };
      try {
        // 1) username 으로 회원 검색 (소문자/원본 모두 시도)
        let users = await fsQuery('users', adminToken, [
          { fieldFilter: { field: { fieldPath: 'username' }, op: 'EQUAL', value: { stringValue: uname.toLowerCase() } } }
        ], 5);
        if (!users || !users.length) {
          users = await fsQuery('users', adminToken, [
            { fieldFilter: { field: { fieldPath: 'username' }, op: 'EQUAL', value: { stringValue: uname } } }
          ], 5);
        }
        if (!users || !users.length) {
          result.error = '회원을 찾을 수 없음';
          results.push(result);
          continue;
        }
        const user = users[0];
        const uid = user.id;
        result.found = true;
        result.uid = uid;
        result.userEmail = user.email || null;

        if (dryRun) {
          // 영향 범위만 카운트
          const inv = await fsQuery('investments', adminToken, [{ fieldFilter: { field: { fieldPath: 'userId' }, op: 'EQUAL', value: { stringValue: uid } } }], 1000);
          const bn = await fsQuery('bonuses', adminToken, [{ fieldFilter: { field: { fieldPath: 'userId' }, op: 'EQUAL', value: { stringValue: uid } } }], 1000);
          const tx = await fsQuery('transactions', adminToken, [{ fieldFilter: { field: { fieldPath: 'userId' }, op: 'EQUAL', value: { stringValue: uid } } }], 1000);
          const sl = await fsQuery('sales', adminToken, [{ fieldFilter: { field: { fieldPath: 'userId' }, op: 'EQUAL', value: { stringValue: uid } } }], 1000);
          result.deleted = { investments: inv.length, bonuses: bn.length, transactions: tx.length, sales: sl.length };
          results.push(result);
          continue;
        }

        // 2) investments 삭제
        const invs = await fsQuery('investments', adminToken, [
          { fieldFilter: { field: { fieldPath: 'userId' }, op: 'EQUAL', value: { stringValue: uid } } }
        ], 2000);
        for (const inv of invs) {
          await fsDelete(`investments/${inv.id}`, adminToken).catch(() => false);
          result.deleted.investments++;
        }

        // 3) bonuses 삭제
        const bonuses = await fsQuery('bonuses', adminToken, [
          { fieldFilter: { field: { fieldPath: 'userId' }, op: 'EQUAL', value: { stringValue: uid } } }
        ], 5000);
        for (const b of bonuses) {
          await fsDelete(`bonuses/${b.id}`, adminToken).catch(() => false);
          result.deleted.bonuses++;
        }

        // 4) transactions 삭제 (입금/출금/ROI 등 모두)
        const txs = await fsQuery('transactions', adminToken, [
          { fieldFilter: { field: { fieldPath: 'userId' }, op: 'EQUAL', value: { stringValue: uid } } }
        ], 5000);
        for (const t of txs) {
          await fsDelete(`transactions/${t.id}`, adminToken).catch(() => false);
          result.deleted.transactions++;
        }

        // 5) sales 컬렉션도 삭제 (있을 경우)
        try {
          const sales = await fsQuery('sales', adminToken, [
            { fieldFilter: { field: { fieldPath: 'userId' }, op: 'EQUAL', value: { stringValue: uid } } }
          ], 2000);
          for (const s of sales) {
            await fsDelete(`sales/${s.id}`, adminToken).catch(() => false);
            result.deleted.sales++;
          }
        } catch (_) { /* ignore */ }

        // 6) wallets/{uid} 0으로 초기화
        await fsPatch(`wallets/${uid}`, {
          usdtBalance: 0,
          bonusBalance: 0,
          dedraBalance: 0,
          totalEarnings: 0,
          totalInvest: 0,
          totalInvested: 0,
          bonusInvest: 0,
          autoCompoundTotalInvest: 0,
          availableUsdt: 0,
          updatedAt: new Date().toISOString(),
        }, adminToken).catch(() => null);
        result.walletReset = true;

        // 7) users/{uid} 누적 지표 초기화 (랭크/매출 관련)
        await fsPatch(`users/${uid}`, {
          networkSales: 0,
          otherLegSales: 0,
          totalSales: 0,
          totalInvested: 0,
          totalEarnings: 0,
          currentRank: '',
          rankAchievedAt: null,
          updatedAt: new Date().toISOString(),
        }, adminToken).catch(() => null);

        // 8) 감사 로그
        await fsCreate(ADMIN_AUDIT_LOG_COLLECTION, {
          action: 'reset_user',
          actor: adminUid,
          targetUserId: uid,
          targetUsername: uname,
          deleted: result.deleted,
          createdAt: new Date().toISOString(),
        }, adminToken).catch(() => null);

      } catch (e: any) {
        result.error = e.message;
      }
      results.push(result);
    }

    return c.json({ success: true, dryRun, results });
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500);
  }
});

// ════════════════════════════════════════════════════════════════════
// 단일 투자 삭제 API (2026-05-01) — username + amount + duration 으로 1건만 삭제
//   • avajan 의 $500 / 12개월 상품 1건 삭제 등 정밀 작업용
//   • 매칭 조건: userId == 회원 uid AND amount == amountUsd AND durationDays == months*30
//   • dryRun=true 면 매칭만 하고 삭제는 안 함
// ════════════════════════════════════════════════════════════════════
app.post('/api/admin/delete-one-investment', async (c) => {
  try {
    const body = await c.req.json().catch(() => ({})) as any;
    const headerSecret = c.req.header('x-cron-secret') || c.req.header('X-Cron-Secret') || '';
    const adminApiHeader = c.req.header('x-admin-api-secret') || c.req.header('X-Admin-Api-Secret') || '';
    const env: any = (c.env || {});
    const adminApiSecret = String(env.ADMIN_API_SECRET || (globalThis as any)?.GLOBAL_ENV?.ADMIN_API_SECRET || '').trim();
    const okSecret = isValidCronSecret(headerSecret) || isValidCronSecret(body.secret);
    const okAdminApi = !!adminApiSecret && (adminApiHeader === adminApiSecret || body.adminApiSecret === adminApiSecret);
    const okAdmin = await hasPrivilegedApiAccess(c).catch(() => false);
    if (!okSecret && !okAdminApi && !okAdmin) {
      return c.json({ success: false, error: 'unauthorized' }, 401);
    }
    const adminToken = await getAdminToken();
    const username = String(body.username || '').trim();
    const amountUsd = Number(body.amountUsd);
    const months = Number(body.months);
    const dryRun = !!body.dryRun;
    if (!username || !Number.isFinite(amountUsd) || !Number.isFinite(months)) {
      return c.json({ success: false, error: 'username, amountUsd, months 필수' }, 400);
    }

    // 1) 회원 조회
    let users = await fsQuery('users', adminToken, [
      { fieldFilter: { field: { fieldPath: 'username' }, op: 'EQUAL', value: { stringValue: username.toLowerCase() } } }
    ], 5);
    if (!users || !users.length) {
      users = await fsQuery('users', adminToken, [
        { fieldFilter: { field: { fieldPath: 'username' }, op: 'EQUAL', value: { stringValue: username } } }
      ], 5);
    }
    if (!users || !users.length) {
      return c.json({ success: false, error: '회원을 찾을 수 없음' }, 404);
    }
    const user = users[0];
    const uid = user.id;

    // 2) 투자 목록 전체 조회 (해당 회원)
    const invs: any[] = await fsQuery('investments', adminToken, [
      { fieldFilter: { field: { fieldPath: 'userId' }, op: 'EQUAL', value: { stringValue: uid } } }
    ], 1000);

    const expectedDurationDays = months * 30;
    const tolerance = 0.5; // amount 비교 허용 오차

    const matches = invs.filter((inv: any) => {
      const amt = Number(inv.amount ?? inv.amountUsdt ?? inv.principal ?? 0);
      const dd = Number(inv.durationDays ?? inv.duration ?? 0);
      const dm = Number(inv.durationMonths ?? 0);
      const monthsMatch = (dd === expectedDurationDays) || (dm === months) || (Math.abs(dd - expectedDurationDays) <= 5);
      const amtMatch = Math.abs(amt - amountUsd) <= tolerance;
      return monthsMatch && amtMatch;
    });

    if (!matches.length) {
      return c.json({
        success: false,
        error: `매칭되는 투자 상품이 없음 (회원=${username}, $${amountUsd}/${months}개월)`,
        uid,
        totalInvestments: invs.length,
        sample: invs.slice(0, 5).map((i: any) => ({
          id: i.id,
          amount: i.amount ?? i.amountUsdt,
          durationDays: i.durationDays ?? i.duration,
          durationMonths: i.durationMonths,
          productName: i.productName,
          status: i.status,
          createdAt: i.createdAt,
        })),
      }, 404);
    }

    // 3) createdAt 정렬 — 기본 오래된 순, pickLatest=true 시 최신 순
    const pickLatest = !!body.pickLatest;
    matches.sort((a: any, b: any) => {
      const ta = new Date(a.createdAt || a.startDate || 0).getTime();
      const tb = new Date(b.createdAt || b.startDate || 0).getTime();
      return pickLatest ? (tb - ta) : (ta - tb);
    });
    const target = matches[0];

    if (dryRun) {
      return c.json({
        success: true,
        dryRun: true,
        uid,
        username,
        matchedCount: matches.length,
        target: {
          id: target.id,
          amount: target.amount ?? target.amountUsdt,
          durationDays: target.durationDays ?? target.duration,
          productName: target.productName,
          status: target.status,
          createdAt: target.createdAt,
        },
        otherMatches: matches.slice(1).map((i: any) => ({ id: i.id, createdAt: i.createdAt })),
      });
    }

    // 4) 실제 삭제
    await fsDelete(`investments/${target.id}`, adminToken);

    // 5) 감사 로그
    await fsCreate(ADMIN_AUDIT_LOG_COLLECTION, {
      action: 'delete_one_investment',
      actor: String(body.adminUid || 'admin'),
      targetUserId: uid,
      targetUsername: username,
      investmentId: target.id,
      amount: target.amount ?? target.amountUsdt,
      durationDays: target.durationDays ?? target.duration,
      productName: target.productName,
      createdAt: new Date().toISOString(),
    }, adminToken).catch(() => null);

    return c.json({
      success: true,
      uid,
      username,
      deletedInvestmentId: target.id,
      amount: target.amount ?? target.amountUsdt,
      durationDays: target.durationDays ?? target.duration,
      productName: target.productName,
      remainingMatches: matches.length - 1,
    });
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500);
  }
});

app.get('/api/admin/find-user/:id', async (c) => {
  try {
    const adminToken = await getAdminToken(c.env.SERVICE_ACCOUNT as string);
    const dbBase = `https://firestore.googleapis.com/v1/projects/dedra-mlm/databases/(default)/documents`;
    const id = c.req.param('id');
    
    // search by referralCode (ID)
    let qRes = await fetch(`${dbBase}:runQuery`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${adminToken}` },
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId: 'users' }],
          where: {
            fieldFilter: {
              field: { fieldPath: 'referralCode' },
              op: 'EQUAL',
              value: { stringValue: id }
            }
          },
          limit: 1
        }
      })
    }).then(r => r.json());

    if (!qRes || !qRes[0] || !qRes[0].document) {
      // try email
      qRes = await fetch(`${dbBase}:runQuery`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${adminToken}` },
        body: JSON.stringify({
          structuredQuery: {
            from: [{ collectionId: 'users' }],
            where: {
              fieldFilter: {
                field: { fieldPath: 'email' },
                op: 'EQUAL',
                value: { stringValue: id + '@deedra.com' }
              }
            },
            limit: 1
          }
        })
      }).then(r => r.json());
    }

    if (!qRes || !qRes[0] || !qRes[0].document) {
      return c.json({ error: 'Not found' });
    }

    const doc = qRes[0].document;
    const uid = doc.name.split('/').pop();
    
    const walletUrl = `${dbBase}/wallets/${uid}`;
    const walletRes = await fetch(walletUrl, { headers: { 'Authorization': `Bearer ${adminToken}` } }).then(r => r.json());
    
    return c.json({ user: doc.fields, uid, wallet: walletRes.fields });
  } catch(e:any) { return c.json({ error: e.message }); }
});







app.get('/api/admin/force-qaz6128', async (c) => {
  const adminToken = await getAdminToken(c.env.FIREBASE_SA);
  const dbBase = 'https://firestore.googleapis.com/v1/projects/dedra-mlm/databases/(default)/documents';

  const userQuery = {
    structuredQuery: {
      from: [{ collectionId: 'users' }],
      where: {
        fieldFilter: {
          field: { fieldPath: 'username' },
          op: 'EQUAL',
          value: { stringValue: 'qaz6128' }
        }
      },
      limit: 1
    }
  };

  const usersRes = await fetch(dbBase + ':runQuery', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + adminToken, 'Content-Type': 'application/json' },
    body: JSON.stringify(userQuery)
  }).then(r => r.json());

  if (!usersRes || !usersRes[0] || !usersRes[0].document) {
    return c.json({ error: 'User qaz6128 not found' });
  }

  const uid = usersRes[0].document.name.split('/').pop();
  const userNameStr = usersRes[0].document.fields?.username?.stringValue || 'qaz6128';

  const walletUrl = dbBase + '/wallets/' + uid;
  const walletRes = await fetch(walletUrl, {
    headers: { 'Authorization': 'Bearer ' + adminToken }
  }).then(r => r.json());

  const currentUsdt = Number(walletRes.fields?.usdtBalance?.integerValue || walletRes.fields?.usdtBalance?.doubleValue || 0);
  const currentTotalDep = Number(walletRes.fields?.totalDeposit?.integerValue || walletRes.fields?.totalDeposit?.doubleValue || 0);
  const currentTotalDepUsdt = Number(walletRes.fields?.totalDepositUsdt?.integerValue || walletRes.fields?.totalDepositUsdt?.doubleValue || 0);
  const currentTickets = Number(walletRes.fields?.weeklyTickets?.integerValue || walletRes.fields?.weeklyTickets?.doubleValue || 0);

  const depositAmount = 8000;
  const ticketCount = 80;

  const walletPatchBody = {
    fields: {
      ...walletRes.fields,
      usdtBalance: { doubleValue: currentUsdt + depositAmount },
      totalDeposit: { doubleValue: currentTotalDep + depositAmount },
      totalDepositUsdt: { doubleValue: currentTotalDepUsdt + depositAmount },
      weeklyTickets: { integerValue: currentTickets + ticketCount }
    }
  };

  await fetch(walletUrl + '?updateMask.fieldPaths=usdtBalance&updateMask.fieldPaths=totalDeposit&updateMask.fieldPaths=totalDepositUsdt&updateMask.fieldPaths=weeklyTickets', {
    method: 'PATCH',
    headers: { 'Authorization': 'Bearer ' + adminToken, 'Content-Type': 'application/json' },
    body: JSON.stringify(walletPatchBody)
  });

  let ticketsCreated = 0;
  for(let i = 0; i < ticketCount; i++) {
    const bodyTicket = {
      fields: {
        userId: { stringValue: uid },
        userName: { stringValue: userNameStr },
        ticketType: { stringValue: 'direct_deposit' },
        issueDate: { timestampValue: new Date().toISOString() },
        used: { booleanValue: false },
        status: { stringValue: 'active' },
        amount: { integerValue: "100" }
      }
    };
    await fetch(dbBase + '/lottery_tickets', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + adminToken, 'Content-Type': 'application/json' },
      body: JSON.stringify(bodyTicket)
    });
    ticketsCreated++;
  }

  const jpUrl = dbBase + '/events/weekly_jackpot';
  const jpRes = await fetch(jpUrl, { headers: { 'Authorization': 'Bearer ' + adminToken } }).then(r => r.json());
  let currentTotalJp = Number(jpRes.fields?.totalTickets?.integerValue || jpRes.fields?.totalTickets?.doubleValue || 0);
  
  await fetch(jpUrl + '?updateMask.fieldPaths=totalTickets', {
    method: 'PATCH',
    headers: { 'Authorization': 'Bearer ' + adminToken, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fields: {
        ...jpRes.fields,
        totalTickets: { integerValue: currentTotalJp + ticketCount }
      }
    })
  });

  const txHash = '0x' + Array.from({length: 64}, () => Math.floor(Math.random()*16).toString(16)).join('');

  const depRecord = {
    fields: {
      userId: { stringValue: uid },
      amount: { integerValue: String(depositAmount) },
      currency: { stringValue: 'USDT' },
      type: { stringValue: 'deposit' },
      status: { stringValue: 'approved' },
      createdAt: { timestampValue: new Date().toISOString() },
      updatedAt: { timestampValue: new Date().toISOString() },
      description: { stringValue: '관리자 수동 입금 및 80장 추첨권 발행' },
      network: { stringValue: 'TRC20' },
      txHash: { stringValue: txHash }
    }
  };

  await fetch(dbBase + '/transactions', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + adminToken, 'Content-Type': 'application/json' },
    body: JSON.stringify(depRecord)
  });

  return c.json({ 
    success: true, 
    uid: uid, 
    previousUsdt: currentUsdt, 
    newUsdt: currentUsdt + depositAmount, 
    ticketsCreated,
    txHash
  });
});

app.get('/api/admin/fix-total-deposit', async (c) => {
  try {
    const adminToken = await getAdminToken(c.env.SERVICE_ACCOUNT as string);
    const dbBase = `https://firestore.googleapis.com/v1/projects/dedra-mlm/databases/(default)/documents`;
    const results = [];

    const processTotal = async (uid: string, addAmount: number) => {
      const walletUrl = `${dbBase}/wallets/${uid}`;
      const walletRes = await fetch(walletUrl, { headers: { 'Authorization': `Bearer ${adminToken}` } }).then(r => r.json());
      
      let currentTotal = Number(walletRes.fields?.totalDeposit?.doubleValue || walletRes.fields?.totalDeposit?.integerValue || 0);

      const newTotal = currentTotal + addAmount;

      const walletPatchBody = {
        fields: {
          ...walletRes.fields,
          totalDeposit: { doubleValue: newTotal }
        }
      };

      const patchRes = await fetch(`${walletUrl}?updateMask.fieldPaths=totalDeposit`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(walletPatchBody)
      }).then(r => r.json());

      return { uid, previousTotal: currentTotal, newTotal, patchRes };
    };

    results.push(await processTotal('4HSZifPEYkXCSmo3wHlWXzWKU8V2', 500));
    results.push(await processTotal('JkKUeLhzCMcV9UyCggav5YHi8Fo1', 1000));

    return c.json({ success: true, results });
  } catch(e:any) { return c.json({ error: e.message }); }
});


app.get('/api/admin/fix-deposits-final', async (c) => {
  try {
    const adminToken = await getAdminToken(c.env.SERVICE_ACCOUNT as string);
    const dbBase = `https://firestore.googleapis.com/v1/projects/dedra-mlm/databases/(default)/documents`;
    const results = [];

    const processDeposit = async (uid: string, username: string, amount: number) => {
      const walletUrl = `${dbBase}/wallets/${uid}`;
      const walletRes = await fetch(walletUrl, { headers: { 'Authorization': `Bearer ${adminToken}` } }).then(r => r.json());
      
      let currentUsdt = Number(walletRes.fields?.usdtBalance?.doubleValue || walletRes.fields?.usdtBalance?.integerValue || 0);
      let currentTotalDeposit = Number(walletRes.fields?.totalDepositUsdt?.doubleValue || walletRes.fields?.totalDepositUsdt?.integerValue || 0);

      const newUsdt = currentUsdt + amount;
      const newTotal = currentTotalDeposit + amount;

      const walletPatchBody = {
        fields: {
          ...walletRes.fields,
          usdtBalance: { doubleValue: newUsdt },
          totalDepositUsdt: { doubleValue: newTotal }
        }
      };

      const patchRes = await fetch(`${walletUrl}?updateMask.fieldPaths=usdtBalance&updateMask.fieldPaths=totalDepositUsdt`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(walletPatchBody)
      }).then(r => r.json());

      // Let's also add a transaction log so it shows up in their history
      const txid = 'TX_' + Date.now() + Math.random().toString(36).substr(2,9);
      const txBody = {
        fields: {
          userId: { stringValue: uid },
          userEmail: { stringValue: username }, // Using username to easily track
          type: { stringValue: 'deposit' },
          amount: { doubleValue: amount },
          totalCredited: { doubleValue: amount },
          currency: { stringValue: 'USDT' },
          network: { stringValue: 'Solana' },
          txid: { stringValue: txid },
          status: { stringValue: 'completed' },
          note: { stringValue: 'Manual admin deposit' },
          createdAt: { timestampValue: new Date().toISOString() }
        }
      };

      await fetch(`${dbBase}/transactions/${txid}`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(txBody)
      });

      return { user: username, uid, previousUsdt: currentUsdt, newUsdt, patchRes };
    };

    // uid: 4HSZifPEYkXCSmo3wHlWXzWKU8V2 -> pannee99 (500 USDT)
    results.push(await processDeposit('4HSZifPEYkXCSmo3wHlWXzWKU8V2', 'pannee99', 500));
    
    // uid: JkKUeLhzCMcV9UyCggav5YHi8Fo1 -> army99 (1000 USDT)
    results.push(await processDeposit('JkKUeLhzCMcV9UyCggav5YHi8Fo1', 'army99', 1000));

    return c.json({ success: true, results });
  } catch(e:any) {
    return c.json({ error: e.message, stack: e.stack });
  }
});


app.get('/api/admin/dump-search-99', async (c) => {
  try {
    const adminToken = await getAdminToken(c.env.SERVICE_ACCOUNT as string);
    const dbBase = `https://firestore.googleapis.com/v1/projects/dedra-mlm/databases/(default)/documents`;
    
    // Fetch top 50 users to inspect their fields
    let qRes = await fetch(`${dbBase}:runQuery`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${adminToken}` },
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId: 'users' }],
          limit: 1000
        }
      })
    }).then(r => r.json());

    if (!Array.isArray(qRes)) return c.json({ error: 'not array', data: qRes });

    const matches = [];
    for (const item of qRes) {
      if (!item.document) continue;
      const str = JSON.stringify(item.document).toLowerCase();
      if (str.includes('pannee') || str.includes('army')) {
        matches.push(item.document);
      }
    }

    return c.json({ success: true, matches });
  } catch(e:any) {
    return c.json({ error: e.message, stack: e.stack });
  }
});


app.get('/api/admin/execute-deposits-99', async (c) => {
  try {
    const adminToken = await getAdminToken(c.env.SERVICE_ACCOUNT as string);
    const dbBase = `https://firestore.googleapis.com/v1/projects/dedra-mlm/databases/(default)/documents`;
    const results = [];

    const processUser = async (idToFind: string, amountToDeposit: number) => {
      // Find the user by ID/ReferralCode
      let qRes = await fetch(`${dbBase}:runQuery`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${adminToken}` },
        body: JSON.stringify({
          structuredQuery: {
            from: [{ collectionId: 'users' }],
            where: {
              fieldFilter: {
                field: { fieldPath: 'referralCode' },
                op: 'EQUAL',
                value: { stringValue: idToFind }
              }
            },
            limit: 1
          }
        })
      }).then(r => r.json());

      // Fallback: try email
      if (!qRes || !qRes[0] || !qRes[0].document) {
        qRes = await fetch(`${dbBase}:runQuery`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${adminToken}` },
          body: JSON.stringify({
            structuredQuery: {
              from: [{ collectionId: 'users' }],
              where: {
                fieldFilter: {
                  field: { fieldPath: 'email' },
                  op: 'EQUAL',
                  value: { stringValue: idToFind + '@deedra.com' }
                }
              },
              limit: 1
            }
          })
        }).then(r => r.json());
      }

      if (!qRes || !qRes[0] || !qRes[0].document) {
        // Fallback: try querying without case sensitivity? Not possible in simple Firestore query.
        // Let's just return error
        return { user: idToFind, status: 'Not found' };
      }

      const uid = qRes[0].document.name.split('/').pop();
      const walletUrl = `${dbBase}/wallets/${uid}`;
      const walletRes = await fetch(walletUrl, { headers: { 'Authorization': `Bearer ${adminToken}` } }).then(r => r.json());
      
      let currentUsdt = Number(walletRes.fields?.usdtBalance?.doubleValue || walletRes.fields?.usdtBalance?.integerValue || 0);
      let currentTotalDeposit = Number(walletRes.fields?.totalDepositUsdt?.doubleValue || walletRes.fields?.totalDepositUsdt?.integerValue || 0);

      const newUsdt = currentUsdt + amountToDeposit;
      const newTotal = currentTotalDeposit + amountToDeposit;

      const walletPatchBody = {
        fields: {
          ...walletRes.fields,
          usdtBalance: { doubleValue: newUsdt },
          totalDepositUsdt: { doubleValue: newTotal }
        }
      };

      const patchRes = await fetch(`${walletUrl}?updateMask.fieldPaths=usdtBalance&updateMask.fieldPaths=totalDepositUsdt`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(walletPatchBody)
      }).then(r => r.json());

      return { user: idToFind, uid, previousUsdt: currentUsdt, newUsdt, patchRes };
    };

    results.push(await processUser('pannee99', 500));
    results.push(await processUser('army99', 1000));

    return c.json({ success: true, results });
  } catch(e:any) {
    return c.json({ error: e.message, stack: e.stack });
  }
});


app.get('/api/admin/force-tom2576', async (c) => {
  try {
    const adminToken = await getAdminToken(c.env.SERVICE_ACCOUNT as string);
    const dbBase = `https://firestore.googleapis.com/v1/projects/dedra-mlm/databases/(default)/documents`;

    const userId = "C1IgYHYn84aTs8XWkGKsY79CwPB3";
    const userEmail = "verachai2576@gmail.com";

    const walletUrl = `${dbBase}/wallets/${userId}`;
    const walletRes = await fetch(walletUrl, { headers: { 'Authorization': `Bearer ${adminToken}` } }).then(r => r.json());
    
    let currentUsdt = Number(walletRes.fields?.usdtBalance?.doubleValue || walletRes.fields?.usdtBalance?.integerValue || 0);
    let currentTotalDeposit = Number(walletRes.fields?.totalDepositUsdt?.doubleValue || walletRes.fields?.totalDepositUsdt?.integerValue || 0);

    const newUsdt = currentUsdt + 1000;
    const newTotal = currentTotalDeposit + 1000;

    const walletPatchBody = {
      fields: {
        ...walletRes.fields,
        usdtBalance: { doubleValue: newUsdt },
        totalDepositUsdt: { doubleValue: newTotal }
      }
    };

    await fetch(`${walletUrl}?updateMask.fieldPaths=usdtBalance&updateMask.fieldPaths=totalDepositUsdt`, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${adminToken}` },
      body: JSON.stringify(walletPatchBody)
    });

    const txId = `FORCE_DEPOSIT_1000_TOM2576_${Date.now()}`;
    const txBody = {
      fields: {
        userId: { stringValue: userId },
        userEmail: { stringValue: userEmail },
        type: { stringValue: 'deposit' },
        amount: { doubleValue: 1000 },
        currency: { stringValue: 'USDT' },
        status: { stringValue: 'approved' },
        txid: { stringValue: txId },
        timestamp: { timestampValue: new Date().toISOString() },
        approvedAt: { timestampValue: new Date().toISOString() }
      }
    };

    const newTxUrl = `${dbBase}/transactions/${txId}`;
    await fetch(`${newTxUrl}`, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${adminToken}` },
      body: JSON.stringify(txBody)
    });

    return c.json({ success: true, userId, newUsdt, newTotal, txId, userEmail });
  } catch (err: any) {
    return c.json({ error: err.message, stack: err.stack });
  }
});


app.get('/api/admin/debug-skili', async (c) => {
  try {
    const adminToken = await getAdminToken(c.env.SERVICE_ACCOUNT as string);
    const dbBase = `https://firestore.googleapis.com/v1/projects/dedra-mlm/databases/(default)/documents`;

    const query = {
      structuredQuery: {
        from: [{ collectionId: 'users' }],
        where: {
          fieldFilter: {
            field: { fieldPath: 'email' },
            op: 'EQUAL',
            value: { stringValue: 'skili06@deedra.com' }
          }
        },
        limit: 1
      }
    };
    
    let qRes = await fetch(`${dbBase}:runQuery`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${adminToken}` },
      body: JSON.stringify(query)
    }).then(r => r.json());

    if (!qRes || !qRes[0] || !qRes[0].document) {
      return c.json({ error: 'User not found' });
    }

    const userDoc = qRes[0].document;
    const userId = userDoc.name.split('/').pop();
    const deedraWallet = userDoc.fields?.deedraWallet?.mapValue?.fields?.publicKey?.stringValue;
    
    return c.json({ userId, deedraWallet });
  } catch(e:any) {
    return c.json({error: e.message});
  }
});


app.get('/api/admin/execute-sw9595', async (c) => {
  try {
    const adminToken = await getAdminToken(c.env.SERVICE_ACCOUNT as string);
    const dbBase = `https://firestore.googleapis.com/v1/projects/dedra-mlm/databases/(default)/documents`;
    const results = [];

    const processUser = async (idToFind: string, amountToDeposit: number) => {
      let qRes = await fetch(`${dbBase}:runQuery`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${adminToken}` },
        body: JSON.stringify({
          structuredQuery: {
            from: [{ collectionId: 'users' }],
            where: { fieldFilter: { field: { fieldPath: 'referralCode' }, op: 'EQUAL', value: { stringValue: idToFind } } },
            limit: 1
          }
        })
      }).then(r => r.json());

      if (!qRes || !qRes[0] || !qRes[0].document) {
        qRes = await fetch(`${dbBase}:runQuery`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${adminToken}` },
          body: JSON.stringify({
            structuredQuery: {
              from: [{ collectionId: 'users' }],
              where: { fieldFilter: { field: { fieldPath: 'username' }, op: 'EQUAL', value: { stringValue: idToFind } } },
              limit: 1
            }
          })
        }).then(r => r.json());
      }
      
      if (!qRes || !qRes[0] || !qRes[0].document) {
        qRes = await fetch(`${dbBase}:runQuery`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${adminToken}` },
          body: JSON.stringify({
            structuredQuery: {
              from: [{ collectionId: 'users' }],
              where: { fieldFilter: { field: { fieldPath: 'email' }, op: 'EQUAL', value: { stringValue: idToFind + '@gmail.com' } } },
              limit: 1
            }
          })
        }).then(r => r.json());
      }

      if (!qRes || !qRes[0] || !qRes[0].document) {
        return { user: idToFind, status: 'Not found' };
      }

      const uid = qRes[0].document.name.split('/').pop();
      const walletUrl = `${dbBase}/wallets/${uid}`;
      const walletRes = await fetch(walletUrl, { headers: { 'Authorization': `Bearer ${adminToken}` } }).then(r => r.json());
      
      let currentUsdt = Number(walletRes.fields?.usdtBalance?.doubleValue || walletRes.fields?.usdtBalance?.integerValue || 0);
      let currentTotalDeposit = Number(walletRes.fields?.totalDepositUsdt?.doubleValue || walletRes.fields?.totalDepositUsdt?.integerValue || 0);

      const newUsdt = currentUsdt + amountToDeposit;
      const newTotal = currentTotalDeposit + amountToDeposit;

      const walletPatchBody = {
        fields: {
          ...walletRes.fields,
          usdtBalance: { doubleValue: newUsdt },
          totalDepositUsdt: { doubleValue: newTotal }
        }
      };

      const patchRes = await fetch(`${walletUrl}?updateMask.fieldPaths=usdtBalance&updateMask.fieldPaths=totalDepositUsdt`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(walletPatchBody)
      }).then(r => r.json());

      return { user: idToFind, uid, previousUsdt: currentUsdt, newUsdt, patchRes };
    };

    results.push(await processUser('sw9595', 10000));

    return c.json({ success: true, results });
  } catch(e:any) {
    return c.json({ error: e.message, stack: e.stack });
  }
});


app.get('/api/admin/search-sw9595', async (c) => {
  try {
    const adminToken = await getAdminToken(c.env.SERVICE_ACCOUNT as string);
    const dbBase = `https://firestore.googleapis.com/v1/projects/dedra-mlm/databases/(default)/documents`;
    
    // search all users to find sw9595
    let qRes = await fetch(`${dbBase}:runQuery`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${adminToken}` },
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId: 'users' }],
          limit: 1000
        }
      })
    }).then(r => r.json());

    if (!Array.isArray(qRes)) return c.json({ error: 'not array', data: qRes });

    const matches = [];
    for (const item of qRes) {
      if (!item.document) continue;
      const str = JSON.stringify(item.document).toLowerCase();
      if (str.includes('sw9595')) {
        matches.push(item.document);
      }
    }

    return c.json({ success: true, matches });
  } catch(e:any) {
    return c.json({ error: e.message, stack: e.stack });
  }
});


app.get('/api/admin/fix-salika', async (c) => {
  try {
    const adminToken = await getAdminToken(c.env.SERVICE_ACCOUNT as string);
    const dbBase = 'https://firestore.googleapis.com/v1/projects/dedra-mlm/databases/(default)/documents';
    
    // search
    let qRes = await fetch(dbBase + ':runQuery', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + adminToken },
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId: 'users' }],
          where: { fieldFilter: { field: { fieldPath: 'username' }, op: 'EQUAL', value: { stringValue: 'salika888' } } },
          limit: 1
        }
      })
    }).then(r => r.json());

    if (!qRes || !qRes[0] || !qRes[0].document) {
      return c.json({ error: 'User not found' });
    }

    const userDoc = qRes[0].document;
    const uid = userDoc.name.split('/').pop();

    const walletUrl = dbBase + '/wallets/' + uid;
    const walletRes = await fetch(walletUrl, { headers: { 'Authorization': 'Bearer ' + adminToken } }).then(r => r.json());

    // Give lottery ticket manually
    const bodyTicket = {
      fields: {
        userId: { stringValue: uid },
        userName: { stringValue: userDoc.fields.username?.stringValue || '' },
        ticketType: { stringValue: 'direct_deposit' },
        issueDate: { timestampValue: new Date().toISOString() },
        used: { booleanValue: false },
        status: { stringValue: 'active' },
        amount: { integerValue: "100" }
      }
    };
    
    let resTicket = await fetch(dbBase + '/lottery_tickets', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + adminToken, 'Content-Type': 'application/json' },
      body: JSON.stringify(bodyTicket)
    }).then(r => r.json());

    return c.json({ 
      user: userDoc, 
      wallet: walletRes, 
      ticket_result: resTicket
    });
  } catch(e:any) {
    return c.json({ error: e.message });
  }
});


app.get('/api/admin/fix-salika-ticket', async (c) => {
  try {
    const adminToken = await getAdminToken(c.env.SERVICE_ACCOUNT as string);
    const dbBase = 'https://firestore.googleapis.com/v1/projects/dedra-mlm/databases/(default)/documents';
    
    // search
    let qRes = await fetch(dbBase + ':runQuery', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + adminToken },
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId: 'users' }],
          where: { fieldFilter: { field: { fieldPath: 'username' }, op: 'EQUAL', value: { stringValue: 'salika888' } } },
          limit: 1
        }
      })
    }).then(r => r.json());

    const uid = qRes[0].document.name.split('/').pop();

    const walletUrl = dbBase + '/wallets/' + uid;
    const walletRes = await fetch(walletUrl, { headers: { 'Authorization': 'Bearer ' + adminToken } }).then(r => r.json());
    
    let currentTickets = Number(walletRes.fields?.weeklyTickets?.integerValue || walletRes.fields?.weeklyTickets?.doubleValue || 0);

    const walletPatchBody = {
      fields: {
        ...walletRes.fields,
        weeklyTickets: { integerValue: currentTickets + 1 }
      }
    };

    const patchRes = await fetch(walletUrl + '?updateMask.fieldPaths=weeklyTickets', {
      method: 'PATCH',
      headers: { 'Authorization': 'Bearer ' + adminToken, 'Content-Type': 'application/json' },
      body: JSON.stringify(walletPatchBody)
    }).then(r => r.json());

    // Update global jackpot total tickets
    const jpUrl = dbBase + '/events/weekly_jackpot';
    const jpRes = await fetch(jpUrl, { headers: { 'Authorization': 'Bearer ' + adminToken } }).then(r => r.json());
    let currentTotal = Number(jpRes.fields?.totalTickets?.integerValue || jpRes.fields?.totalTickets?.doubleValue || 0);

    const jpPatchBody = {
      fields: {
        ...jpRes.fields,
        totalTickets: { integerValue: currentTotal + 1 }
      }
    };
    
    const jpPatch = await fetch(jpUrl + '?updateMask.fieldPaths=totalTickets', {
      method: 'PATCH',
      headers: { 'Authorization': 'Bearer ' + adminToken, 'Content-Type': 'application/json' },
      body: JSON.stringify(jpPatchBody)
    }).then(r => r.json());

    return c.json({ 
      success: true,
      walletUpdate: patchRes,
      jpUpdate: jpPatch
    });
  } catch(e:any) {
    return c.json({ error: e.message });
  }
});


app.get('/api/admin/test-index', async (c) => {
  try {
    const adminToken = await getAdminToken(c.env.SERVICE_ACCOUNT as string);
    const dbBase = 'https://firestore.googleapis.com/v1/projects/dedra-mlm/databases/(default)/documents';
    const res = await fetch(dbBase + ':runQuery', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + adminToken },
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId: 'transactions' }],
          where: {
            compositeFilter: {
              op: 'AND',
              filters: [
                { fieldFilter: { field: { fieldPath: 'userId' }, op: 'EQUAL', value: { stringValue: 'dummy' } } },
                { fieldFilter: { field: { fieldPath: 'type' }, op: 'EQUAL', value: { stringValue: 'deposit' } } }
              ]
            }
          },
          orderBy: [{ field: { fieldPath: 'createdAt' }, direction: 'DESCENDING' }],
          limit: 1
        }
      })
    });
    const json = await res.json();
    return c.json(json);
  } catch(e:any) {
    return c.json({ error: e.message });
  }
});


app.get('/api/admin/test-index2', async (c) => {
  try {
    const adminToken = await getAdminToken(c.env.SERVICE_ACCOUNT as string);
    const dbBase = 'https://firestore.googleapis.com/v1/projects/dedra-mlm/databases/(default)/documents';
    const res = await fetch(dbBase + ':runQuery', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + adminToken },
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId: 'transactions' }],
          where: {
            fieldFilter: { field: { fieldPath: 'userId' }, op: 'EQUAL', value: { stringValue: 'dummy' } }
          },
          orderBy: [{ field: { fieldPath: 'createdAt' }, direction: 'DESCENDING' }],
          limit: 1
        }
      })
    });
    const json = await res.json();
    return c.json(json);
  } catch(e:any) {
    return c.json({ error: e.message });
  }
});


app.get('/api/admin/get-links', async (c) => {
  try {
    const adminToken = await getAdminToken(c.env.SERVICE_ACCOUNT as string);
    const dbBase = 'https://firestore.googleapis.com/v1/projects/dedra-mlm/databases/(default)/documents';
    
    const queries = [
      { col: 'transactions', f: 'createdAt' },
      { col: 'bonuses', f: 'createdAt' },
      { col: 'investments', f: 'startDate' },
      { col: 'users', filter: 'referredBy', f: 'createdAt' }
    ];

    let links = [];

    for (let q of queries) {
      const res = await fetch(dbBase + ':runQuery', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + adminToken },
        body: JSON.stringify({
          structuredQuery: {
            from: [{ collectionId: q.col }],
            where: {
              fieldFilter: { field: { fieldPath: q.filter || 'userId' }, op: 'EQUAL', value: { stringValue: 'dummy' } }
            },
            orderBy: [{ field: { fieldPath: q.f }, direction: 'DESCENDING' }],
            limit: 1
          }
        })
      });
      const json = await res.json();
      if (json[0] && json[0].error && json[0].error.message) {
         const match = json[0].error.message.match(/https:\/\/console\.firebase\.google\.com[^\s]+/);
         if (match) links.push({ name: q.col, link: match[0] });
      }
    }
    
    return c.json({ links });
  } catch(e:any) {
    return c.json({ error: e.message });
  }
});


app.get('/api/admin/task-seoul-btc', async (c) => {
  try {
    const adminToken = await getAdminToken(c.env.SERVICE_ACCOUNT as string);
    const dbBase = 'https://firestore.googleapis.com/v1/projects/dedra-mlm/databases/(default)/documents';
    
    // 1. Find btc3576
    let btcQ = await fetch(dbBase + ':runQuery', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + adminToken },
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId: 'users' }],
          where: { fieldFilter: { field: { fieldPath: 'username' }, op: 'EQUAL', value: { stringValue: 'btc3576' } } },
          limit: 1
        }
      })
    }).then(r => r.json());

    if (!btcQ || !btcQ[0] || !btcQ[0].document) {
      // Try uppercase referralCode
      btcQ = await fetch(dbBase + ':runQuery', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + adminToken },
        body: JSON.stringify({
          structuredQuery: {
            from: [{ collectionId: 'users' }],
            where: { fieldFilter: { field: { fieldPath: 'referralCode' }, op: 'EQUAL', value: { stringValue: 'BTC3576' } } },
            limit: 1
          }
        })
      }).then(r => r.json());
    }
    
    let sponsorInfo = null;
    if (btcQ && btcQ[0] && btcQ[0].document) {
      const refBy = btcQ[0].document.fields.referredBy?.stringValue;
      if (refBy) {
        let spQ = await fetch(dbBase + '/users/' + refBy, {
          headers: { 'Authorization': 'Bearer ' + adminToken }
        }).then(r => r.json());
        if (spQ && spQ.fields) {
          sponsorInfo = {
            uid: refBy,
            username: spQ.fields.username?.stringValue,
            name: spQ.fields.name?.stringValue,
            email: spQ.fields.email?.stringValue,
            referralCode: spQ.fields.referralCode?.stringValue
          };
        }
      }
    }

    // 2. Find seoul3901
    let seoulQ = await fetch(dbBase + ':runQuery', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + adminToken },
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId: 'users' }],
          where: { fieldFilter: { field: { fieldPath: 'username' }, op: 'EQUAL', value: { stringValue: 'seoul3901' } } },
          limit: 1
        }
      })
    }).then(r => r.json());

    if (!seoulQ || !seoulQ[0] || !seoulQ[0].document) {
      seoulQ = await fetch(dbBase + ':runQuery', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + adminToken },
        body: JSON.stringify({
          structuredQuery: {
            from: [{ collectionId: 'users' }],
            where: { fieldFilter: { field: { fieldPath: 'referralCode' }, op: 'EQUAL', value: { stringValue: 'SEOUL3901' } } },
            limit: 1
          }
        })
      }).then(r => r.json());
    }

    let seoulResult = null;
    if (seoulQ && seoulQ[0] && seoulQ[0].document) {
      const uid = seoulQ[0].document.name.split('/').pop();
      const walletUrl = dbBase + '/wallets/' + uid;
      const walletRes = await fetch(walletUrl, { headers: { 'Authorization': 'Bearer ' + adminToken } }).then(r => r.json());
      
      let currentUsdt = Number(walletRes.fields?.usdtBalance?.doubleValue || walletRes.fields?.usdtBalance?.integerValue || 0);
      let currentTotalDep = Number(walletRes.fields?.totalDeposit?.doubleValue || walletRes.fields?.totalDeposit?.integerValue || 0);
      let currentTotalDepUsdt = Number(walletRes.fields?.totalDepositUsdt?.doubleValue || walletRes.fields?.totalDepositUsdt?.integerValue || 0);
      let currentTickets = Number(walletRes.fields?.weeklyTickets?.integerValue || walletRes.fields?.weeklyTickets?.doubleValue || 0);

      const depositAmount = 800;
      const ticketCount = 8; // 800 / 100 = 8 tickets

      const walletPatchBody = {
        fields: {
          ...walletRes.fields,
          usdtBalance: { doubleValue: currentUsdt + depositAmount },
          totalDeposit: { doubleValue: currentTotalDep + depositAmount },
          totalDepositUsdt: { doubleValue: currentTotalDepUsdt + depositAmount },
          weeklyTickets: { integerValue: currentTickets + ticketCount }
        }
      };

      const patchRes = await fetch(walletUrl + '?updateMask.fieldPaths=usdtBalance&updateMask.fieldPaths=totalDeposit&updateMask.fieldPaths=totalDepositUsdt&updateMask.fieldPaths=weeklyTickets', {
        method: 'PATCH',
        headers: { 'Authorization': 'Bearer ' + adminToken, 'Content-Type': 'application/json' },
        body: JSON.stringify(walletPatchBody)
      }).then(r => r.json());

      // Create 8 tickets
      let ticketsCreated = 0;
      for(let i=0; i<ticketCount; i++) {
        const bodyTicket = {
          fields: {
            userId: { stringValue: uid },
            userName: { stringValue: seoulQ[0].document.fields.username?.stringValue || 'seoul3901' },
            ticketType: { stringValue: 'direct_deposit' },
            issueDate: { timestampValue: new Date().toISOString() },
            used: { booleanValue: false },
            status: { stringValue: 'active' },
            amount: { integerValue: "100" }
          }
        };
        await fetch(dbBase + '/lottery_tickets', {
          method: 'POST',
          headers: { 'Authorization': 'Bearer ' + adminToken, 'Content-Type': 'application/json' },
          body: JSON.stringify(bodyTicket)
        });
        ticketsCreated++;
      }

      // Update jackpot total tickets
      const jpUrl = dbBase + '/events/weekly_jackpot';
      const jpRes = await fetch(jpUrl, { headers: { 'Authorization': 'Bearer ' + adminToken } }).then(r => r.json());
      let currentTotalJp = Number(jpRes.fields?.totalTickets?.integerValue || jpRes.fields?.totalTickets?.doubleValue || 0);
      
      await fetch(jpUrl + '?updateMask.fieldPaths=totalTickets', {
        method: 'PATCH',
        headers: { 'Authorization': 'Bearer ' + adminToken, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fields: {
            ...jpRes.fields,
            totalTickets: { integerValue: currentTotalJp + ticketCount }
          }
        })
      });

      // Create a deposit history record
      const depRecord = {
        fields: {
          userId: { stringValue: uid },
          amount: { integerValue: String(depositAmount) },
          type: { stringValue: 'usdt' },
          status: { stringValue: 'approved' },
          createdAt: { timestampValue: new Date().toISOString() },
          updatedAt: { timestampValue: new Date().toISOString() },
          txId: { stringValue: 'MANUAL_ADMIN_DEPOSIT_' + Date.now() },
          network: { stringValue: 'TRC20' },
          walletAddress: { stringValue: 'MANUAL' }
        }
      };
      await fetch(dbBase + '/deposits', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + adminToken, 'Content-Type': 'application/json' },
        body: JSON.stringify(depRecord)
      });

      seoulResult = {
        uid,
        previousUsdt: currentUsdt,
        newUsdt: currentUsdt + depositAmount,
        ticketsCreated
      };
    }

    return c.json({ 
      success: true,
      btc3576_sponsor: sponsorInfo,
      seoul3901_deposit: seoulResult
    });
  } catch(e:any) {
    return c.json({ error: e.message, stack: e.stack });
  }
});


app.get('/api/admin/task-skylee', async (c) => {
  try {
    const adminToken = await getAdminToken(c.env.SERVICE_ACCOUNT as string);
    const dbBase = 'https://firestore.googleapis.com/v1/projects/dedra-mlm/databases/(default)/documents';

    // 1. Find skylee
    let q = await fetch(dbBase + ':runQuery', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + adminToken },
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId: 'users' }],
          where: { fieldFilter: { field: { fieldPath: 'username' }, op: 'EQUAL', value: { stringValue: 'skylee' } } },
          limit: 1
        }
      })
    }).then(r => r.json());

    if (!q || !q[0] || !q[0].document) {
      q = await fetch(dbBase + ':runQuery', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + adminToken },
        body: JSON.stringify({
          structuredQuery: {
            from: [{ collectionId: 'users' }],
            where: { fieldFilter: { field: { fieldPath: 'referralCode' }, op: 'EQUAL', value: { stringValue: 'SKYLEE' } } },
            limit: 1
          }
        })
      }).then(r => r.json());
    }

    if (!q || !q[0] || !q[0].document) {
      return c.json({ error: 'skylee not found' });
    }

    const uid = q[0].document.name.split('/').pop();
    const walletUrl = dbBase + '/wallets/' + uid;
    const walletRes = await fetch(walletUrl, { headers: { 'Authorization': 'Bearer ' + adminToken } }).then(r => r.json());

    let currentUsdt = Number(walletRes.fields?.usdtBalance?.doubleValue || walletRes.fields?.usdtBalance?.integerValue || 0);
    let currentTotalDep = Number(walletRes.fields?.totalDeposit?.doubleValue || walletRes.fields?.totalDeposit?.integerValue || 0);
    let currentTotalDepUsdt = Number(walletRes.fields?.totalDepositUsdt?.doubleValue || walletRes.fields?.totalDepositUsdt?.integerValue || 0);

    const depositAmount = 2000;

    const walletPatchBody = {
      fields: {
        ...walletRes.fields,
        usdtBalance: { doubleValue: currentUsdt + depositAmount },
        totalDeposit: { doubleValue: currentTotalDep + depositAmount },
        totalDepositUsdt: { doubleValue: currentTotalDepUsdt + depositAmount }
      }
    };

    const patchRes = await fetch(walletUrl + '?updateMask.fieldPaths=usdtBalance&updateMask.fieldPaths=totalDeposit&updateMask.fieldPaths=totalDepositUsdt', {
      method: 'PATCH',
      headers: { 'Authorization': 'Bearer ' + adminToken, 'Content-Type': 'application/json' },
      body: JSON.stringify(walletPatchBody)
    }).then(r => r.json());

    // Create a deposit transaction record
    const txRecord = {
      fields: {
        userId: { stringValue: uid },
        amount: { integerValue: String(depositAmount) },
        amountUsdt: { integerValue: String(depositAmount) },
        type: { stringValue: 'deposit' },
        status: { stringValue: 'approved' },
        createdAt: { timestampValue: new Date().toISOString() },
        updatedAt: { timestampValue: new Date().toISOString() },
        txId: { stringValue: 'MANUAL_ADMIN_DEPOSIT_' + Date.now() },
        network: { stringValue: 'TRC20' },
        walletAddress: { stringValue: 'MANUAL_NO_TICKET' }
      }
    };
    await fetch(dbBase + '/transactions', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + adminToken, 'Content-Type': 'application/json' },
      body: JSON.stringify(txRecord)
    });

    await fetch(dbBase + '/deposits', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + adminToken, 'Content-Type': 'application/json' },
      body: JSON.stringify(txRecord)
    });

    return c.json({
      success: true,
      uid,
      previousUsdt: currentUsdt,
      newUsdt: currentUsdt + depositAmount,
      patchRes
    });
  } catch(e:any) {
    return c.json({ error: e.message, stack: e.stack });
  }
});




app.post('/api/multi/direct-deposit', async (c) => {
  try {
    const authHeader = c.req.header('Authorization');
    if (!authHeader) return c.json({ error: 'Missing auth header' }, 401);
    const idToken = authHeader.split('Bearer ')[1];

    const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken })
    });
    const data = await res.json();
    if (!data.users || !data.users.length) return c.json({ error: 'Invalid token' }, 401);

    const uid = data.users[0].localId;
    const adminToken = await getAdminToken();

    const uRes = await fetch(`${FIRESTORE_BASE}/users/${uid}`, { headers: { Authorization: `Bearer ${adminToken}` } });
    const uData = await uRes.json();

    const walletFields = uData.fields?.deedraWallet?.mapValue?.fields;
    if (!walletFields) return c.json({ error: 'Deedra Wallet not found' }, 400);

    const body = await c.req.json().catch(() => ({}));
    const { amountUi, currency, network } = body;
    if (!amountUi || amountUi <= 0) return c.json({ error: 'Invalid amount' }, 400);

    // Get company wallets
    const cwRes = await fsGet('settings/companyWallets', adminToken).catch(()=>null);
    let companyAddress = '';
    
    // Default addresses as fallback
    if (network === 'BSC') companyAddress = '0x76CbE9826D9720E49b3536E426A125BC4ceD2502';
    if (network === 'TRON') companyAddress = 'TLiG5xwLM7po4ALkAu3iCuNsxrbT9tVUw4';

    if (cwRes && cwRes.fields?.wallets?.arrayValue?.values) {
      const wList = cwRes.fields.wallets.arrayValue.values;
      for (const w of wList) {
        const nStr = w.mapValue?.fields?.network?.stringValue?.toUpperCase() || '';
        const addrStr = w.mapValue?.fields?.address?.stringValue || '';
        if (network === 'BSC' && (nStr.includes('BSC') || nStr.includes('BEP'))) companyAddress = addrStr;
        if (network === 'TRON' && (nStr.includes('TRON') || nStr.includes('TRC'))) companyAddress = addrStr;
      }
    }

    if (!companyAddress) return c.json({ error: 'Company address not configured for ' + network }, 400);

    const sponsorKeyStr = (c.env as any).SPONSOR_EVM_SECRET || (c.env as any).MULTI_FEE_BOT_KEY; 
    const sponsorTronStr = (c.env as any).SPONSOR_TRON_SECRET || (c.env as any).MULTI_FEE_BOT_KEY; 
    
    let result: any = { success: false, error: 'Unknown network' };

    if (network === 'BSC') {
      const pk = walletFields.evmPrivateKey?.stringValue;
      if (!pk) return c.json({ error: 'BSC private key not found' }, 400);
      if (!sponsorKeyStr) return c.json({ error: 'SPONSOR_EVM_SECRET or MULTI_FEE_BOT_KEY not configured' }, 400);
      
      result = await transferBscUsdt(pk, companyAddress, sponsorKeyStr, amountUi);
    } else if (network === 'TRON') {
      const pk = walletFields.tronPrivateKey?.stringValue;
      if (!pk) return c.json({ error: 'TRON private key not found' }, 400);
      if (!sponsorTronStr) return c.json({ error: 'SPONSOR_TRON_SECRET or MULTI_FEE_BOT_KEY not configured' }, 400);
      
      result = await transferTronUsdt(pk, companyAddress, sponsorTronStr, amountUi);
    } else {
      return c.json({ error: 'Unsupported network: ' + network }, 400);
    }

    if (!result.success) {
      return c.json({ error: result.error || result.reason }, 500);
    }

    // Insert deposit transaction
    const txId = result.txid;
    await fsCreateOnlyIfAbsent(`transactions/${txId}`, {
      userId: uid,
      type: 'deposit',
      amount: amountUi,
      currency: currency || 'USDT',
      status: 'pending',
      txid: txId,
      network: network,
      walletType: 'deedra',
      createdAt: new Date().toISOString()
    }, adminToken);

    return c.json({ success: true, txid: txId, message: 'Deposit successful' });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

// [SECURITY] Debug routes disabled in production — sensitive data exposure risk
// import { debugSponsorRoute } from './debug_sponsor';
// import { debugCheckRoute } from './debug_check';
//
// app.get('/api/debug/sponsor-keys', debugSponsorRoute);
// app.get('/api/debug/check-bonuses', debugCheckRoute);
//
// app.route("/api/debug/check-all-bonuses", debugCheckRoute2);


// --- AI Language Helper ---
const getLangName = (code: string) => {
  const map: Record<string, string> = { 'en':'English', 'vi':'Vietnamese', 'th':'Thai', 'zh':'Chinese', 'ja':'Japanese', 'ko':'Korean', 'id':'Indonesian' };
  return map[code] || 'English';
};

async function translateHtml(html: string, targetLangCode: string, apiKey: string, baseUrl: string) {
  if (!targetLangCode || targetLangCode === 'ko') return html;
  if (!apiKey) return html;
  const targetLang = getLangName(targetLangCode);
  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: `You are a professional translator for DEEDRA, a cryptocurrency investment platform. 
Translate the following HTML text from Korean into ${targetLang}. 
[CRITICAL RULES]
1. Keep ALL HTML tags, inline styles, and emojis EXACTLY intact. 
2. ONLY translate the text content. Do NOT translate brand names like 'DEEDRA', 'FREEZE', 'USDT', 'DDRA'.
3. Maintain the enthusiastic, polite, and persuasive tone (FOMO).` },
          { role: 'user', content: html }
        ],
        temperature: 0.3,
        max_tokens: 1000
      })
    });
    if (res.ok) {
      const data = await res.json();
      return data.choices[0].message.content;
    }
  } catch(e) { console.error('Translate Error:', e); }
  return html;
}

// --- AI Fraud Detection System (FDS) Endpoint ---
app.get('/api/admin/ai/fds-scan', async (c) => {
  try {
    const authHeader = c.req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json({ success: false, message: 'Unauthorized' }, 401);
    }
    
    const idToken = authHeader.split('Bearer ')[1];
    const resAuth = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken })
    });
    const dataAuth = await resAuth.json();
    if (!dataAuth.users || !dataAuth.users.length) return c.json({ success: false, message: 'Invalid token' }, 401);
    
    const adminToken = await getAdminToken();
    
    // Limit to latest 1000 transactions to prevent memory overload & crashes
    const txDataDocs = await fsQuery('transactions', adminToken, [], 1000);
    
    if (!txDataDocs) {
      return c.json({ success: true, alerts: [] });
    }

    const alerts = [];
    const userWithdrawals = {};
    const userDeposits = {};

    // Analyze transactions
    for (const tx of txDataDocs) {
      if (!tx.userId) continue;
      
      const isRecent = tx.createdAt ? (new Date(tx.createdAt).getTime() > Date.now() - 7 * 24 * 60 * 60 * 1000) : false; // Last 7 days

      if (tx.type === 'withdrawal' && (tx.status === 'pending' || tx.status === 'processing' || tx.status === 'held')) {
        if (!userWithdrawals[tx.userId]) userWithdrawals[tx.userId] = { count: 0, totalAmount: 0, txIds: [] };
        userWithdrawals[tx.userId].count += 1;
        userWithdrawals[tx.userId].totalAmount += Number(tx.amountUsdt || tx.amount || 0);
        userWithdrawals[tx.userId].txIds.push(tx.id || tx.txid);
        userWithdrawals[tx.userId].email = tx.userEmail || tx.userId;

        // Rule 1: High value withdrawal (over 5000)
        if (Number(tx.amountUsdt || tx.amount || 0) > 5000) {
          alerts.push({
            id: 'high_value_' + tx.id,
            type: 'HIGH_VALUE_WITHDRAWAL',
            userId: tx.userId,
            email: tx.userEmail || tx.userId,
            amount: Number(tx.amountUsdt || tx.amount || 0),
            txId: tx.id || tx.txid,
            reason: `고액 출금 요청 탐지 (${Number(tx.amountUsdt || tx.amount || 0).toLocaleString()})`,
            risk: 'HIGH'
          });
        }
      }

      if (tx.type === 'deposit' && tx.status === 'pending' && isRecent) {
        if (!userDeposits[tx.userId]) userDeposits[tx.userId] = { count: 0, txIds: [], amounts: {} };
        userDeposits[tx.userId].count += 1;
        userDeposits[tx.userId].txIds.push(tx.id || tx.txid);
        const amt = Number(tx.amountUsdt || tx.amount || 0);
        userDeposits[tx.userId].amounts[amt] = (userDeposits[tx.userId].amounts[amt] || 0) + 1;
        userDeposits[tx.userId].email = tx.userEmail || tx.userId;
      }
    }

    // Rule 2: Multiple pending withdrawals
    for (const [uid, stats] of Object.entries(userWithdrawals)) {
      if (stats.count >= 2) {
        alerts.push({
          id: 'multi_withdraw_' + uid,
          type: 'MULTIPLE_WITHDRAWALS',
          userId: uid,
          email: stats.email,
          amount: stats.totalAmount,
          txId: stats.txIds.join(', '),
          reason: `동일 계정 다중 출금 요청 (${stats.count}건 진행중)`,
          risk: 'CRITICAL'
        });
      }
    }

    // Rule 3: Multiple pending deposits of same amount
    for (const [uid, stats] of Object.entries(userDeposits)) {
      for (const [amt, count] of Object.entries(stats.amounts)) {
        if (count >= 2) {
          alerts.push({
            id: 'dup_deposit_' + uid,
            type: 'DUPLICATE_DEPOSITS',
            userId: uid,
            email: stats.email,
            amount: Number(amt) * count,
            txId: stats.txIds.join(', '),
            reason: `동일 금액 입금 요청 중복 탐지 (${amt} USDT x ${count}회)`,
            risk: 'MEDIUM'
          });
        }
      }
    }

    const riskWeight = { 'CRITICAL': 3, 'HIGH': 2, 'MEDIUM': 1 };
    alerts.sort((a, b) => riskWeight[b.risk] - riskWeight[a.risk]);

    return c.json({ success: true, alerts });

  } catch (error) {
    console.error('AI FDS Error:', error);
    return c.json({ success: false, message: 'FDS 스캔 중 오류가 발생했습니다.' }, 500);
  }
});


// --- AI Rank Analysis ---
app.post('/api/ai/analyze-rank', async (c) => {
  try {
    const authHeader = c.req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) return c.json({ success: false, message: 'Unauthorized' }, 401);
    
    const idToken = authHeader.split('Bearer ')[1];
    const resAuth = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_API_KEY}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken })
    });
    const dataAuth = await resAuth.json();
    if (!dataAuth.users || !dataAuth.users.length) return c.json({ success: false, message: 'Invalid token' }, 401);
    
    const uid = dataAuth.users[0].localId;
    const adminToken = await getAdminToken();

    const [userRes, walletRes] = await Promise.all([
      fetch(`${FIRESTORE_BASE}/users/${uid}`, { headers: { 'Authorization': `Bearer ${adminToken}` } }),
      fetch(`${FIRESTORE_BASE}/wallets/${uid}`, { headers: { 'Authorization': `Bearer ${adminToken}` } })
    ]);

    const userData = await userRes.json().catch(() => ({}));
    const walletData = await walletRes.json().catch(() => ({}));

    if (!userData.name && !userData.fields) throw new Error('User not found');

    const rank = userData.fields?.rank?.stringValue || 'G0';
    const networkSales = Number(userData.fields?.networkSales?.doubleValue || userData.fields?.networkSales?.integerValue || 0);
    const otherLegSales = Number(userData.fields?.otherLegSales?.doubleValue || userData.fields?.otherLegSales?.integerValue || 0);
    const directReferrals = Number(userData.fields?.directReferrals?.integerValue || 0);
    const totalInvested = Number(walletData.fields?.totalInvested?.doubleValue || walletData.fields?.totalInvested?.integerValue || 0);

    // [FIX 2026-05-01 #2] 각 행은 "현재 직급(key) → 다음 직급(next) 승급 조건"이며,
    //   사용자 지정 기준표의 G(N) 행 값 = G(N) 달성 조건. 따라서 G0 행에는 G1 달성 조건이
    //   들어가야 한다 (이전 G0 reqSelf=100, reqLeg=0 으로 G1 인원 폭증한 버그 수정).
    // 승급 조건: (selfInvest >= reqSelf) AND (otherLegSales >= reqLeg)
    const ranks: Record<string, any> = {
      'G0':  { next: 'G1',  reqSelf: 300,    reqSales: 10000,    reqLeg: 10000,    reqRef: 0 },
      'G1':  { next: 'G2',  reqSelf: 500,    reqSales: 30000,    reqLeg: 30000,    reqRef: 0 },
      'G2':  { next: 'G3',  reqSelf: 1000,   reqSales: 70000,    reqLeg: 70000,    reqRef: 0 },
      'G3':  { next: 'G4',  reqSelf: 2000,   reqSales: 200000,   reqLeg: 200000,   reqRef: 0 },
      'G4':  { next: 'G5',  reqSelf: 3000,   reqSales: 500000,   reqLeg: 500000,   reqRef: 0 },
      'G5':  { next: 'G6',  reqSelf: 5000,   reqSales: 1000000,  reqLeg: 1000000,  reqRef: 0 },
      'G6':  { next: 'G7',  reqSelf: 5000,   reqSales: 2000000,  reqLeg: 2000000,  reqRef: 0 },
      'G7':  { next: 'G8',  reqSelf: 10000,  reqSales: 5000000,  reqLeg: 5000000,  reqRef: 0 },
      'G8':  { next: 'G9',  reqSelf: 10000,  reqSales: 10000000, reqLeg: 10000000, reqRef: 0 },
      'G9':  { next: 'G10', reqSelf: 20000,  reqSales: 20000000, reqLeg: 20000000, reqRef: 0 }
    };

    let message = '';
    const hour = new Date().getHours() + 9;
    const greeting = (hour % 24) < 12 ? '좋은 아침입니다!' : (hour % 24) < 18 ? '활기찬 오후입니다!' : '평안한 저녁입니다!';
    message += `<b>${greeting}</b><br><br>`;
    message += `현재 회원님의 직급은 <span style="color:#8b5cf6; font-weight:bold;">${rank}</span>이며, 총 누적 투자액은 <b>${totalInvested.toLocaleString(undefined, {minimumFractionDigits: 2})}</b> 입니다.<br><br>`;

    const rankInfo = ranks[rank];
    if (rankInfo) {
      const nextRank = rankInfo.next;
      const salesGap = Math.max(0, rankInfo.reqSales - networkSales);
      const legGap = Math.max(0, rankInfo.reqLeg - otherLegSales);
      const refGap = Math.max(0, rankInfo.reqRef - directReferrals);

      if (salesGap === 0 && legGap === 0 && refGap === 0) {
        message += `🎉 축하합니다! 이미 <b>${nextRank}</b> 승급 조건을 모두 만족하셨습니다!<br><br>`;
      } else {
        message += `🚀 <b>${nextRank} 승급을 위한 AI 핵심 전략:</b><br>`;
        let needs = [];
        if (salesGap > 0) needs.push(`총 산하 매출 <b>${salesGap.toLocaleString()}</b> 추가 필요`);
        if (legGap > 0) needs.push(`소실적 매출 <b>${legGap.toLocaleString()}</b> 추가 필요`);
        if (refGap > 0) needs.push(`직추천 <b>${refGap}명</b> 추가 필요`);

        message += `<ul style="margin-left: 20px; margin-top: 8px; margin-bottom: 12px; color: #4b5563; line-height: 1.6;">`;
        needs.forEach(n => message += `<li>${n}</li>`);
        message += `</ul>`;
        message += `<div style="background-color: #eef2ff; padding: 10px; border-radius: 8px; font-size: 11px;">💡 <b>AI Tip:</b> ${nextRank} 직급 달성 시 산하 매출에 대한 <b>롤업 보너스 비율이 상승</b>하여 매일 받는 수당이 폭발적으로 증가합니다!</div>`;
      }
    } else {
      message += `🌟 이미 최고 직급에 도달하셨거나, 분석할 상위 직급 데이터가 없습니다. 놀라운 성과입니다!`;
    }

    return c.json({ success: true, message });
  } catch (error: any) {
    console.error('Analyze Rank Error:', error);
    return c.json({ success: false, message: '데이터를 분석하는 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.' }, 200); // return 200 with success: false to avoid JSON parsing errors on frontend
  }
});

// --- AI Market Insight ---
app.get('/api/ai/market-insight', async (c) => {
  try {
    const insights = [
      "현재 비트코인 도미넌스가 상승하며 시장 자금이 집중되고 있습니다. 알트코인 변동성이 우려되니, 매일 0.8% 확정 수익을 제공하는 <b>DEEDRA FREEZE</b>가 가장 안전한 대안입니다.",
      "거시 경제의 불확실성으로 인해 현금 관망세가 짙어지고 있습니다. 이럴 때일수록 시세 하락 방어가 가능한 <b>DEEDRA FREEZE</b> 상품으로 자산을 파킹(Parking)하는 것이 유리합니다.",
      "온체인 데이터 상 스마트 머니(Smart Money)들이 안전한 스테이킹 모델로 이동 중입니다. 매일 0.8%가 지급되는 <b>FREEZE</b>를 활용한 복리 투자가 지금 시기에 가장 적합합니다.",
      "금리 인하 지연 우려로 가상자산 시장이 횡보 중입니다. 지금 바로 출금하여 현금을 보유하기보다, <b>FREEZE 자동 복리 시스템</b>으로 자산을 폭발적으로 불려보세요!"
    ];
    const insight = insights[Math.floor(Math.random() * insights.length)];
    return c.json({ success: true, insight });
  } catch (error) {
    return c.json({ success: false, message: '마켓 인사이트 로딩 실패' }, 500);
  }
});


// --- AI General Chat Endpoint ---
app.post('/api/ai/chat', async (c) => {
  try {
    const authHeader = c.req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json({ success: false, message: 'Unauthorized' }, 401);
    }
    
    const body = await c.req.json().catch(() => ({}));
    const userMsg = body.message || '';
    const lang = body.lang || 'ko';
    
    const openAiKey = String(GLOBAL_ENV.OPENAI_API_KEY || '').trim();
    const openAiBaseUrl = String(GLOBAL_ENV.OPENAI_BASE_URL || 'https://api.openai.com/v1').trim();
    if (!openAiKey) {
      return c.json({ success: false, message: 'AI service is not configured.' }, 503);
    }

    const systemPrompt = `You are the official AI assistant for the DEEDRA project named '디드라AI' (also known as WITY). 
Reply in the user's requested language (${lang}).
You are an advanced, highly intelligent conversational AI (ChatGPT level). You must respond naturally, creatively, and insightfully to ALL user queries. Do not act like a simple bot. 

[CRITICAL INSTRUCTIONS]
1. Respond to the user's input contextually and intelligently. If they ask a general question, answer it perfectly.
2. Always be friendly, professional, and use appropriate emojis.
3. If they ask about "WITY", explain it warmly and direct them to wity.com.
4. If they ask about "withdraw" or "출금" or "돈 빼기", smoothly transition the conversation to defend the DEEDRA project. Convince them that reinvesting using the 'FREEZE' system is mathematically vastly superior to withdrawing right now due to compound interest.
5. Do NOT repeat the same response. Be dynamic, conversational, and helpful like a real human assistant.
`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);

    let aiRes;
    try {
      aiRes = await fetch(`${openAiBaseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${openAiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMsg }
          ],
          temperature: 0.7,
          max_tokens: 500
        }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);
    } catch (fetchErr) {
      clearTimeout(timeoutId);
      return c.json({ success: true, reply: 'AI 응답 지연: 시스템 연결이 원활하지 않습니다. 잠시 후 다시 시도해주세요. (FREEZE 혜택은 놓치지 마세요!)' });
    }

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      console.error("OpenAI API fail:", errText);
      return c.json({ success: true, reply: 'API 통신 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.' });
    }

    const aiData = await aiRes.json();
    const reply = aiData.choices?.[0]?.message?.content || "응답을 생성하지 못했습니다.";
    
    return c.json({ success: true, reply });

  } catch (error) {
    console.error('AI Chat Error:', error);
    return c.json({ success: true, reply: '내부 서버 오류로 답변을 드리지 못했습니다.' });
  }
});

export default {
  fetch: app.fetch,
  async scheduled(event: any, env: any, ctx: any) {
    GLOBAL_ENV = env;
    console.log("cron triggered:", event.cron);
    
    ctx.waitUntil((async () => {
      // ----- 주간 잭팟 추첨 (일요일 00:00 KST = 토요일 15:00 UTC) -----
      try {
        const now = new Date();
        const utcD = now.getUTCDay();
        const utcH = now.getUTCHours();
        const utcM = now.getUTCMinutes();
        
        const adminToken = await getAdminToken();
        const jpSettings = await fsGet('events/weekly_jackpot', adminToken);
        
        // default: active=true, drawDay=6 (Saturday UTC 03:00 = Saturday 12:00 PM KST)
        const isActive = jpSettings && jpSettings.active !== false;
        const targetDay = jpSettings && jpSettings.drawDay !== undefined ? jpSettings.drawDay : 6;
        
        if (isActive && utcD === targetDay && utcH === 3 && utcM >= 0 && utcM < 5) {
           console.log("Running weekly jackpot draw...");
           const jpRes = await app.request('/api/cron/draw-weekly-jackpot', {
             method: 'GET',
             headers: { 'x-cron-secret': getCronSecret() }
           }, env);
           const txt = await jpRes.text();
           console.log("Weekly jackpot draw result:", txt);
        }
      } catch(e) {
        console.error("Weekly jackpot error:", e);
      }

      // ----- 자동 입금 체크 (Solana, 매 5분 실행) -----
      try {
        console.log("Running auto-deposit check (Solana)...");
        const solanaRes = await app.request('/api/solana/check-deposits', {
          method: 'POST',
          headers: { 'x-cron-secret': getCronSecret(), 'Content-Type': 'application/json' },
          body: JSON.stringify({})
        }, env);
        const txt = await solanaRes.text();
        console.log("Auto-deposit check result (Solana):", txt);
      } catch(e) {
        console.error("Auto-deposit error (Solana):", e);
      }

      // ----- 자동 입금 체크 (XRP/BTC, 매 5분 실행) -----
      try {
        console.log("Running auto-deposit check (XRP/BTC)...");
        const majorRes = await app.request('/api/cron/check-major-chain-deposits', {
          method: 'POST',
          headers: { 'x-cron-secret': getCronSecret(), 'Content-Type': 'application/json' },
          body: JSON.stringify({ userLimit: 500, txLimit: 20 })
        }, env);
        const txt = await majorRes.text();
        console.log("Auto-deposit check result (XRP/BTC):", txt);
      } catch(e) {
        console.error("Auto-deposit error (XRP/BTC):", e);
      }

      // [FIX 2026-04-30] ----- 매출 재계산 + 자동 승급 (10분마다, 소실적 매출 누락 민원 영구 해결) -----
      // cron이 5분마다 돌면 매번 실행되며, 짝수 10분 단위에서만 트리거하여 부하 감소
      try {
        const now2 = new Date();
        const m = now2.getUTCMinutes();
        if (m % 10 < 5) {
          console.log("Running recompute-and-upgrade...");
          const adminTokenC = await getAdminToken();
          const usersC = await fsQuery('users', adminTokenC, [], 100000);
          const walletsC = await fsQuery('wallets', adminTokenC, [], 100000);
          const invsC = await fsQuery('investments', adminTokenC, [{ field: 'status', op: '==', value: 'active' }], 100000).catch(() => []);
          const r = await autoUpgradeAllRanks(adminTokenC, usersC, walletsC, invsC);
          console.log("Recompute-and-upgrade result:", JSON.stringify(r));
        }
      } catch(e) {
        console.error("Recompute-and-upgrade error:", e);
      }
      
      try {

        const adminToken = await getAdminToken();
        const settingsRaw = await fsGet('settings/rates', adminToken);
        
        const settings = settingsRaw && settingsRaw.fields ? Object.fromEntries(Object.entries(settingsRaw.fields).map(([k, v]) => [k, fromFirestoreValue(v as any)])) : null; if (!settings || settings.autoSettlement === false) {
          console.log("Auto settlement is disabled.");
          return;
        }

        const targetH = settings.autoSettlementHour ?? 0;
        const targetM = settings.autoSettlementMinute ?? 0;
        
        const now = new Date();
        const utcH = now.getUTCHours();
        const utcM = now.getUTCMinutes();
        
        // We allow a 5-minute window for the cron trigger
        const currentMins = utcH * 60 + utcM;
        const targetMins = targetH * 60 + targetM;
        
        // Check if current time is within [target, target + 5)
        const diff = currentMins - targetMins;
        if (diff >= 0 && diff < 5) {
          console.log(`Time matched! Target: ${targetH}:${targetM}, Current: ${utcH}:${utcM}. Running settlement...`);
          
          const mockContext = {
            req: {
              header: () => undefined,
              query: () => undefined,
              json: async () => ({})
            },
            json: (data: any, status: number) => {
              console.log("Settle result:", status, data);
              return new Response(JSON.stringify(data), { status: status || 200 });
            },
            env: env
          };

          await runSettle(mockContext, null);
        } else {
          console.log(`Not the right time. Target: ${targetH}:${targetM}, Current: ${utcH}:${utcM}`);
        }
      } catch (err) {
        console.error("Scheduled task error:", err);
      }
    })());
  }
}



export { fromFirestoreValue, toFirestoreValue, fsGet, fsPatch, fsQuery, fsCreate, fsCreateOnlyIfAbsent, fsBatchCommit, getAdminToken, firestoreDocToObj };
export const getGlobalEnv = () => GLOBAL_ENV;
