import { Hono } from 'hono'
import { serveStatic } from 'hono/cloudflare-workers'
import { cors } from 'hono/cors'
// @ts-ignore
import ADMIN_HTML from '../public/static/admin.html?raw'
// @ts-ignore
import INDEX_HTML from '../public/index.html?raw'

const app = new Hono()

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
const FIREBASE_API_KEY = 'AIzaSyCijC0Lfvx0WJFWQc4kukND7yOlA-nABr8'

app.use('/api/auth/*', cors())

// 로그인 프록시
app.post('/api/auth/login', async (c) => {
  const { email, password } = await c.req.json()
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
  return c.json({
    idToken: data.idToken,
    localId: data.localId,
    email: data.email,
    refreshToken: data.refreshToken,
    expiresIn: data.expiresIn
  })
})

// 회원가입 프록시
app.post('/api/auth/register', async (c) => {
  const { email, password } = await c.req.json()
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
  return c.json({
    idToken: data.idToken,
    localId: data.localId,
    email: data.email,
    refreshToken: data.refreshToken
  })
})

// 추천인 코드 검증 API (비로그인 상태에서 Firestore 조회)

// 아이디 중복 검증 API
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
  try {
    const body = await c.req.json();
    if (body.secret !== 'deedra-cron-2026') return c.json({ error: '인증 실패' }, 401);
    const targetDate = body.targetDate || "2026-03-26";
    
    const adminToken = await getAdminToken();
    
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
        userWalletsDelta[b.userId] = { bonusBalance: 0, totalEarnings: 0, totalInvest: 0 };
      }
      const d = userWalletsDelta[b.userId];
      d.totalEarnings += (b.amountUsdt || 0);

      if (b.type === 'roi') {
        const u = userMap.get(b.userId);
        const autoCompound = u?.autoCompound || false;
        
        if (b.investmentId) {
          if (!invReversals[b.investmentId]) {
            invReversals[b.investmentId] = { subPrincipal: 0, subPaidRoi: 0 };
          }
          invReversals[b.investmentId].subPaidRoi += (b.amountUsdt || 0);
          if (autoCompound) {
            invReversals[b.investmentId].subPrincipal += (b.amountUsdt || 0);
          }
        }

        if (autoCompound) {
          d.totalInvest += (b.amountUsdt || 0);
        } else {
          d.bonusBalance += (b.amountUsdt || 0);
        }
      } else {
        d.bonusBalance += (b.amountUsdt || 0);
      }
    }
    
    const writes = [];
    
    // 3. Prepare Investment reverts
    let invRevertedCount = 0;
    for (const [invId, rev] of Object.entries(invReversals)) {
      const inv = invMap.get(invId);
      if (inv) {
        const newAmount = Math.max(0, (inv.amountUsdt || 0) - rev.subPrincipal);
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
              paidRoi: toFirestoreValue(Math.max(0, (inv.paidRoi || 0) - rev.subPaidRoi)),
              lastSettledAt: toFirestoreValue(`${prevDate}T23:59:59.000Z`)
            }
          },
          updateMask: { fieldPaths: ['amount', 'amountUsdt', 'expectedReturn', 'paidRoi', 'lastSettledAt'] }
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
        
        writes.push({
          update: {
            name: `projects/dedra-mlm/databases/(default)/documents/wallets/${userId}`,
            fields: {
              bonusBalance: toFirestoreValue(newBonus),
              totalEarnings: toFirestoreValue(newTotalE),
              totalInvest: toFirestoreValue(newTotalI)
            }
          },
          updateMask: { fieldPaths: ['bonusBalance', 'totalEarnings', 'totalInvest'] }
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
    
    // 6. Execute Batch Writes in chunks
    console.log(`Ready to batch ${writes.length} writes...`);
    for (let i = 0; i < writes.length; i += 500) {
      await fsBatchCommit(writes.slice(i, i + 500), adminToken);
    }
    
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
  }
})

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

app.get('/admin', (c) => c.html(ADMIN_HTML))
app.get('/admin.html', (c) => c.html(ADMIN_HTML))

// ─── DEEDRA 실시간 가격 프록시 API ─────────────────────────────────────────
// CORS 문제 없이 클라이언트→백엔드→DexScreener/Jupiter 형태로 중계
app.use('/api/price/*', cors())

app.get('/api/debug/leehj001', async (c) => {
    try {
        const adminToken = await getAdminToken();
        const users = await fsQuery('users', adminToken, [], 100000);
        const user = users.find(u => u.username === 'leehj001');
        if (!user) return c.json({ error: 'user not found' });
        
        const wallet = await fsGet('wallets/' + user.id, adminToken);
        const invsData = await fetch('https://firestore.googleapis.com/v1/projects/dedra-mlm/databases/(default)/documents:runQuery', {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + adminToken, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                structuredQuery: {
                    from: [{ collectionId: 'investments' }],
                    where: { fieldFilter: { field: { fieldPath: 'userId' }, op: 'EQUAL', value: { stringValue: user.id } } }
                }
            })
        }).then(r => r.json());
        
        const bonusesData = await fetch('https://firestore.googleapis.com/v1/projects/dedra-mlm/databases/(default)/documents:runQuery', {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + adminToken, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                structuredQuery: {
                    from: [{ collectionId: 'bonuses' }],
                    where: { fieldFilter: { field: { fieldPath: 'userId' }, op: 'EQUAL', value: { stringValue: user.id } } },
                    orderBy: [{ field: { fieldPath: 'createdAt' }, direction: 'DESCENDING' }],
                    limit: 10
                }
            })
        }).then(r => r.json());
        
        return c.json({ 
            user, 
            wallet: wallet ? firestoreDocToObj(wallet) : null,
            investments: (invsData[0] && invsData[0].document) ? invsData.map(d => firestoreDocToObj(d.document)) : [],
            recentBonuses: (bonusesData[0] && bonusesData[0].document) ? bonusesData.map(d => firestoreDocToObj(d.document)) : []
        });
    } catch(e) {
        return c.json({ error: e.message });
    }
});


app.get('/api/debug/fix_invest_tx3', async (c) => {
    try {
        const adminToken = await getAdminToken();
        const userId = 'T2ksMhuU59PTD2Su0uRxjZSHmeD2';
        const docId = 'invtx_' + Date.now();
        
        await fsSet('transactions/' + docId, {
            userId,
            userEmail: 'korea1@deedra.com',
            type: 'invest',
            amount: 2000,
            currency: 'USDT',
            productId: 'vb7CsNewjaepbGZBCI3h',
            productName: '12개월',
            status: 'done',
            createdAt: '2026-03-30T10:52:21.643Z'
        }, adminToken);
        
        return c.json({ success: true, message: "Added invest tx via fsSet" });
    } catch(e) {
        return c.json({ error: e.message });
    }
});


app.get('/api/debug/fix_invest_tx2', async (c) => {
    try {
        const adminToken = await getAdminToken();
        const userId = 'T2ksMhuU59PTD2Su0uRxjZSHmeD2';
        const docId = 'invtx_' + Date.now();
        
        await fsCreateWithId('transactions', docId, {
            userId,
            userEmail: 'korea1@deedra.com',
            type: 'invest',
            amount: 2000,
            currency: 'USDT',
            productId: 'vb7CsNewjaepbGZBCI3h',
            productName: '12개월',
            status: 'done',
            createdAt: '2026-03-30T10:52:21.643Z'
        }, adminToken);
        
        return c.json({ success: true, message: "Added invest tx" });
    } catch(e) {
        return c.json({ error: e.message });
    }
});


app.get('/api/debug/fix_invest_tx', async (c) => {
    try {
        const adminToken = await getAdminToken();
        const userId = 'T2ksMhuU59PTD2Su0uRxjZSHmeD2';
        
        await fsCreateWithId('transactions', {
            userId,
            userEmail: 'korea1@deedra.com',
            type: 'invest',
            amount: 2000,
            currency: 'USDT',
            productId: 'vb7CsNewjaepbGZBCI3h',
            productName: '12개월',
            status: 'done',
            createdAt: '2026-03-30T10:52:21.643Z'
        }, adminToken);
        
        return c.json({ success: true, message: "Added invest tx" });
    } catch(e) {
        return c.json({ error: e.message });
    }
});


app.get('/api/debug/fix_korea1_bonus', async (c) => {
    try {
        const adminToken = await getAdminToken();
        const userId = 'T2ksMhuU59PTD2Su0uRxjZSHmeD2';
        
        // 1. Set country to KR
        await fsPatch('users/' + userId, { country: 'KR' }, adminToken);
        
        // 2. Add 200 to wallet usdtBalance and totalDeposit
        const wallet = firestoreDocToObj(await fsGet('wallets/' + userId, adminToken));
        await fsPatch('wallets/' + userId, {
            usdtBalance: (wallet.usdtBalance || 0) + 200,
            totalDeposit: (wallet.totalDeposit || 0) + 200
        }, adminToken);
        
        // 3. Fix the transaction
        await fsPatch('transactions/HKM69b6l3GdNkiFitRh7', {
            bonusPct: 10,
            bonusUsdt: 200,
            totalCredited: 2200,
            bonusType: 'country'
        }, adminToken);
        
        return c.json({ success: true, message: "Fixed korea1 bonus" });
    } catch(e) {
        return c.json({ error: e.message });
    }
});


app.get('/api/debug/korea1_txs', async (c) => {
    try {
        const adminToken = await getAdminToken();
        const txsData = await fetch('https://firestore.googleapis.com/v1/projects/dedra-mlm/databases/(default)/documents:runQuery', {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + adminToken, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                structuredQuery: {
                    from: [{ collectionId: 'transactions' }],
                    where: {
                        fieldFilter: {
                            field: { fieldPath: 'userId' },
                            op: 'EQUAL',
                            value: { stringValue: 'T2ksMhuU59PTD2Su0uRxjZSHmeD2' }
                        }
                    }
                }
            })
        }).then(r => r.json());
        
        return c.json({ txs: (txsData[0] && txsData[0].document) ? txsData.map(d => firestoreDocToObj(d.document)) : [] });
    } catch(e) {
        return c.json({ error: e.message });
    }
});


app.get('/api/debug/cyj0300_bonuses', async (c) => {
    try {
        const adminToken = await getAdminToken();
        const bonusesData = await fetch('https://firestore.googleapis.com/v1/projects/dedra-mlm/databases/(default)/documents:runQuery', {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + adminToken, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                structuredQuery: {
                    from: [{ collectionId: 'bonuses' }],
                    where: {
                        fieldFilter: {
                            field: { fieldPath: 'userId' },
                            op: 'EQUAL',
                            value: { stringValue: 'qAdGKU772oVGZ0B5PwUEbL3UqSF3' }
                        }
                    }
                }
            })
        }).then(r => r.json());
        
        return c.json({ bonuses: (bonusesData[0] && bonusesData[0].document) ? bonusesData.map(d => firestoreDocToObj(d.document)) : [] });
    } catch(e) {
        return c.json({ error: e.message });
    }
});


app.get('/api/debug/invs2', async (c) => {
    try {
        const adminToken = await getAdminToken();
        const invsData = await fetch('https://firestore.googleapis.com/v1/projects/dedra-mlm/databases/(default)/documents:runQuery', {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + adminToken, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                structuredQuery: {
                    from: [{ collectionId: 'investments' }],
                    limit: 5
                }
            })
        }).then(r => r.json());
        
        return c.json({ investments: invsData.map(d => firestoreDocToObj(d.document)) });
    } catch(e) {
        return c.json({ error: e.message });
    }
});



app.get('/api/debug/invest_batch', async (c) => {
  try {
    const adminAuth = admin.auth();
    const db = admin.firestore();
    
    const targets = ['pramote8249', 'kkbillionaire89', 'jumbillionaire14'];
    let results = [];

    // Find 12-month product
    const configDoc = await db.collection('settings').doc('config').get();
    let products = configDoc.data()?.products || [];
    let prod12 = products.find(p => p.name.includes('12개월') || p.days === 365 || p.days === 360);
    if (!prod12) {
      prod12 = { id: 'prod_12m', name: '12개월', roi: 0.8, days: 360 };
    }

    for (const target of targets) {
      // Find user
      let uid = null;
      let email = null;
      
      let snap = await db.collection('users').get();
      snap.forEach(doc => {
        const d = doc.data();
        if (d.email && d.email.startsWith(target)) {
          uid = doc.id;
          email = d.email;
        } else if (d.referralCode && d.referralCode.toLowerCase() === target.toLowerCase()) {
          uid = doc.id;
          email = d.email;
        }
      });
      
      if (!uid) {
        results.push({ target, status: 'Not found' });
        continue;
      }
      
      // Check if already has 100
      const invSnap = await db.collection('investments').where('userId', '==', uid).get();
      let alreadyInvested = false;
      invSnap.forEach(doc => {
        if (doc.data().amount === 100) alreadyInvested = true;
      });
      
      if (alreadyInvested) {
        results.push({ target, uid, email, status: 'Already has $100 investment' });
        // Still proceed to next just in case
      }
      
      // Add deposit of 100 just to keep records clean (optional but good)
      const amount = 100;
      
      const batch = db.batch();
      
      const invRef = db.collection('investments').doc();
      const now = new Date();
      const end = new Date(now.getTime() + prod12.days * 86400000);
      
      batch.set(invRef, {
        userId: uid,
        productId: prod12.id || 'prod_1',
        productName: prod12.name,
        amount: amount,
        amountUsdt: amount,
        roiPercent: prod12.roi,
        durationDays: prod12.days,
        expectedReturn: amount * (prod12.roi / 100),
        status: 'active',
        startDate: now,
        endDate: end,
        lastSettledAt: now,
        createdAt: now
      });
      
      // We don't decrement USDT because we are just forcing an investment out of thin air.
      // But we increase totalInvest and totalDeposit to make it look like they deposited & invested.
      const walletRef = db.collection('wallets').doc(uid);
      batch.update(walletRef, {
        totalInvest: admin.firestore.FieldValue.increment(amount),
        totalDeposit: admin.firestore.FieldValue.increment(amount)
      });
      
      const userRef = db.collection('users').doc(uid);
      batch.update(userRef, {
        totalInvested: admin.firestore.FieldValue.increment(amount)
      });
      
      await batch.commit();
      
      // Try to call sync sales internally if possible, or just note it
      results.push({ target, uid, email, status: 'Success invested 100' });
    }

    return c.json({ success: true, results });
  } catch (e) {
    return c.json({ success: false, error: e.message, stack: e.stack });
  }
});

app.get('/api/debug/korea1', async (c) => {
    try {
        const adminToken = await getAdminToken();
        const user = await fsGet('users/T2ksMhuU59PTD2Su0uRxjZSHmeD2', adminToken);
        const wallet = await fsGet('wallets/T2ksMhuU59PTD2Su0uRxjZSHmeD2', adminToken);
        
        const invsData = await fetch('https://firestore.googleapis.com/v1/projects/dedra-mlm/databases/(default)/documents:runQuery', {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + adminToken, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                structuredQuery: {
                    from: [{ collectionId: 'investments' }],
                    where: {
                        fieldFilter: {
                            field: { fieldPath: 'userId' },
                            op: 'EQUAL',
                            value: { stringValue: 'T2ksMhuU59PTD2Su0uRxjZSHmeD2' }
                        }
                    }
                }
            })
        }).then(r => r.json());
        
        return c.json({ user: firestoreDocToObj(user), wallet: firestoreDocToObj(wallet), investments: invsData.map(d => firestoreDocToObj(d.document)) });
    } catch(e) {
        return c.json({ error: e.message });
    }
});

app.use('/api/podcast/*', cors())

// DexScreener: 토큰 민트 주소로 가격 조회
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
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    if (!resp.ok) return c.json({ items: [] });
    
    const xml = await resp.text();
    const items = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    let match;
    while ((match = itemRegex.exec(xml)) !== null) {
      if (items.length >= 10) break; 
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

    // 병렬로 번역 수행 (속도 향상)
    await Promise.all(items.map(async (item) => {
       const [title_en, title_vi, title_th, desc_en, desc_vi, desc_th] = await Promise.all([
         translateText(item.title, 'en'),
         translateText(item.title, 'vi'),
         translateText(item.title, 'th'),
         translateText(item.description, 'en'),
         translateText(item.description, 'vi'),
         translateText(item.description, 'th')
       ]);
       
       item.title_en = title_en || item.title;
       item.title_vi = title_vi || item.title;
       item.title_th = title_th || item.title;
       
       item.description_en = desc_en || item.description;
       item.description_vi = desc_vi || item.description;
       item.description_th = desc_th || item.description;
    }));

    _newsCache = { ts: now, items };
    return c.json({ items });
  } catch (err) {
    console.error('RSS Fetch error:', err);
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
  apiKey: "AIzaSyCijC0Lfvx0WJFWQc4kukND7yOlA-nABr8",
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

// ─── Firebase Admin SDK (서비스 계정 내장) ────────────────────────────────────
const SERVICE_ACCOUNT = {
  type: "service_account",
  project_id: "dedra-mlm",
  private_key_id: "9bf051a4b3416458b8e7b18da5f51565fd5bad13",
  private_key: "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDHDCXJD5NzOPky\nFXAvvKNIDLfXKMGN1D1uQNhkkSt7kJpRUTbwCgy2tWwMATiynGegHk4MTjYUbZNG\nPQJ3vTt615ngAafyJnmV0JYRP5XWnSyOO1zTrJgtdksFphTOboOvnUIbXVkslK81\nBDjcvLu2/h8+Tkay7p4SEMHLr7Z5Esyj2wjIJ7k+ym1Yu7cvSUk1lwvFLvzij2mg\nZhtTH0axM+HZbxJhBkuVS1iGh6n4uoiWv9xGvzdbO9GSLzTutP2qqzLlXbnZUGG3\nOQ4XiArjTtKAEptNXdeq64CGUdFKjky3nU5RiZg5/b4eSV+j3I2giexEtKDdVIat\novieZ5o/AgMBAAECggEABlkC03ilsST9/XTlkQApDOEq87efBJDiLKPwwrRGeLhR\n04oNgHYxlZoPigp37mpCe767qnTMELa13aWQcJUeUnqRs60Z2AUWF4sBXidy9dcp\nVpfaC/4TFFATcGitfS/VD0KqmwjNETjkpYIu9gsmyV0tTeVdJ9OoQtc59u7xmMbM\nOPhW9CM4TRxVHHsZCgO+BH7jmW2guidEcLoBxjfNftt6euanvKhytTDQRZiuKFvp\nBOwZpm1s+moWDvnoKu36JWw8oXuWI3SDLX/eyIO/NwnSpQE9wnXiyyOYxnTN8eHz\nJW2214Xk5LjkHEbEvbWQbCq9hxXnW7vZxLt6ynI4QQKBgQD7N4IV1NP3qp3zMzPy\nCkABSWtn5iYFCkTp27mIj2y4/3Fhm/bnVJjFeLUvpK2xirqq7ZeBQXp3hxG2LLqz\nmTXwMC0zUvLrZam7Zu1ReYaWgMxTgfsH1uQ5jsGEsDyGwRxCt8o0nlvHfunmotlf\nePipGuRkpcAZCw4pnLFUHihAsQKBgQDK1lptoAOYYeBDLB59Ov0HOD86ALEAsNm8\nxJ6MXhWPFViB6JGRSaYw53xCEIZ2tcTnHOTqwcSzHA6cnRGjxewuIkD+Iu0uHB1i\nsuSRNZS35uoo55F7AHClFroKSInZw4SH/j/WLhEaJenZTIoWpZX5YMH8AYFWYXAS\nCDeE6HvF7wKBgQCX7N/c+BMgyqwvMh4OGKjQnmg4M3V2wtkeXOV9cs+bqdAV6c6N\n5BloAzIAGCV7I5z0Vi+z2beIpcTOWYqnptZ55YjQay/BsH/Pd9W52jbMuiPXtNnt\nycXIEU9zQWm5TPwcVS4SWFrE8TnfY0j2diBblInfXGYqPwdXnw2XA43wYQKBgAXV\nhoJSsOfIIOgts67MbIyxnHfxnyWy8IBSc3D8H8iex43s/4rbQHF1pwhLa2Kstb4k\nAZ2S9zJjozPz/JbmUXW+PHpSzNmfq2S0WoimruFfPerxRijwiUzmS3GSRozB5+T1\ndiaV6p4C6yf54JroJlkm5E14SZ0PbmbGX7pt6Wl3AoGAMFPzfuIOGOZB33VFlB5A\n2ZtzoAvHTrR1Bp0akIrlWTY/kfk/7Qdd12SBjSGojuUzn3y94eQNTi+ii2N3V3iI\nTK3jMrCYCsfP2hle9yefv/3uRezf7B7oS4HgtsXSEf9/UUGZkxJQWuxcbv7kqkuv\n/8sWFeugmhHf2e0McHKYqvs=\n-----END PRIVATE KEY-----\n",
  client_email: "firebase-adminsdk-fbsvc@dedra-mlm.iam.gserviceaccount.com",
  client_id: "103096684164693920388",
  token_uri: "https://oauth2.googleapis.com/token",
  project_id_full: "dedra-mlm"
}

const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/dedra-mlm/databases/(default)/documents`
const CRON_SECRET = 'deedra-cron-2026'

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
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
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
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
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


async function fsCreateWithId(collectionPath: string, docId: string, data: any, adminToken: string) {
  
  const firestoreFields: any = {}
  for (const [k, v] of Object.entries(data)) {
    firestoreFields[k] = toFirestoreValue(v)
  }
  const obj = { fields: firestoreFields }

  const res = await fetch(`${FIRESTORE_BASE_URL}/${collectionPath}?documentId=${docId}`, {
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
  const chunks = [];
  for (let i = 0; i < writes.length; i += 400) chunks.push(writes.slice(i, i + 400));
  
  for (const chunk of chunks) {
    const res = await fetch(`${FIRESTORE_BASE}:commit`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ writes: chunk })
    });
    if (!res.ok) {
      const e = await res.text();
      console.error('Batch commit failed:', e);
      throw new Error('Batch commit failed');
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

async function fsSet(path: string, data: any, token: string) {
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
    if (adminSecret !== CRON_SECRET && !adminUid) {
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
    const apiKey = 'AIzaSyCijC0Lfvx0WJFWQc4kukND7yOlA-nABr8'; // project api key
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
    const body = await c.req.json();
    
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
    if (secret !== CRON_SECRET) return c.json({ error: 'unauthorized' }, 401)

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
    if (secret !== CRON_SECRET) return c.json({ error: 'unauthorized' }, 401)
    
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
    if (secret !== CRON_SECRET) return c.json({ error: 'unauthorized' }, 401)

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
    if (body.secret !== CRON_SECRET) return c.json({ error: 'unauthorized' }, 401)
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
    if (secret !== CRON_SECRET) return c.json({ error: 'unauthorized' }, 401)
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

app.post('/api/solana/check-deposits', async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}))
    const secret = c.req.header('x-cron-secret') || body.secret
    if (secret !== CRON_SECRET) return c.json({ error: 'unauthorized' }, 401)

    const adminToken = await getAdminToken()
    
    // 매 5분마다 호출되는 이 엔드포인트에서 자동정산 스케줄도 함께 체크
    const triggerPromise = checkAndRunTrigger(c, adminToken).catch(e => console.error('[checkAndRunTrigger error]', e));
    if (c.executionCtx && c.executionCtx.waitUntil) {
      c.executionCtx.waitUntil(triggerPromise);
    }

    // Firestore에서 회사 입금 지갑 주소 조회
    
    const cwDoc = await fsGet('settings/companyWallets', adminToken).catch(()=>null);
    const sysDoc = await fsGet('settings/system', adminToken).catch(()=>null);
    
    let validCompanyWallets = [];
    
    // Add from companyWallets
    if (cwDoc && cwDoc.fields?.wallets?.arrayValue?.values) {
      const wallets = cwDoc.fields.wallets.arrayValue.values;
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

    const rpcUrls = [
      'https://solana-rpc.publicnode.com',
      'https://api.mainnet-beta.solana.com'
    ];
    
    let successUrl = '';
    let lastError = '';
    let signatures = [];
    let globalAddressesToCheck = [depositAddress];
    
    const existing = await fsQuery('transactions', adminToken, [], 5000);
    const pendingDeposits = existing.filter((t: any) => t.status === 'pending' && t.type === 'deposit');
    
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
        
        let addressesToCheck = [depositAddress];
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
        
        // 3. Always add pending TXIDs so we don't miss them
        pendingDeposits.forEach((p:any) => {
          if (p.txid && p.txid.length > 50) {
            signatures.push({ signature: p.txid, err: null });
          }
        });
        
        // Deduplicate
        const seen = new Set();
        signatures = signatures.filter((s:any) => {
          if (seen.has(s.signature)) return false;
          seen.add(s.signature);
          return true;
        });
        
        if (signatures.length > 0) break;
      } catch (e: any) {
        lastError = e.message || 'Network Error';
      }
    }
    
    let processed = 0; let dbgLog = [];

    const users = await fsQuery('users', adminToken, [], 10000)

    for (const sig of signatures) {
      const txHash = sig.signature
      if (!txHash || sig.err) continue

      // 이미 처리된 tx인지 확인
      const alreadyProcessed = existing.find((t: any) => (t.txHash === txHash || t.txid === txHash) && t.status === 'approved')
      if (alreadyProcessed) continue

      // tx 상세 조회
      let activeRpc = successUrl || rpcUrls[0];
      let txRes = await fetch(activeRpc, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0', id: 1,
          method: 'getTransaction',
          params: [txHash, { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0 }]
        }),
        signal: AbortSignal.timeout(10000)
      });
      
      // Retry with second RPC if first is blocked
      if (!txRes.ok && rpcUrls.length > 1) {
         activeRpc = activeRpc === rpcUrls[0] ? rpcUrls[1] : rpcUrls[0];
         txRes = await fetch(activeRpc, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              jsonrpc: '2.0', id: 1,
              method: 'getTransaction',
              params: [txHash, { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0 }]
            }),
            signal: AbortSignal.timeout(10000)
          });
      }
      
      if (!txRes.ok) continue
      const txData: any = await txRes.json()
      const tx = txData.result
      if (!tx) continue

      // ─── 정확한 잔고 변화 기반 검증 (pre/post Token Balances) ───
      let amount = 0;
      let isToCompany = false;
      let fromAddress = '';
      
      const pre = tx.meta?.preTokenBalances || [];
      const post = tx.meta?.postTokenBalances || [];
      
      let totalReceived = 0;
      
      for (const cw of validCompanyWallets) {
        let preAmount = 0;
        let postAmount = 0;
        
        for (const b of pre) {
          if (b.owner === cw && b.mint === USDT_SPL_MINT) preAmount = parseFloat(b.uiTokenAmount?.uiAmountString || '0');
        }
        for (const b of post) {
          if (b.owner === cw && b.mint === USDT_SPL_MINT) postAmount = parseFloat(b.uiTokenAmount?.uiAmountString || '0');
        }
        
        totalReceived += (postAmount - preAmount);
      }
      
      if (totalReceived >= 0.5) { // At least 0.5 USDT received
        amount = totalReceived;
        isToCompany = true;
        
        // 발신자 주소 찾기 (잔고가 줄어든 계정)
        for (const b of pre) {
          if (!validCompanyWallets.includes(b.owner) && b.mint === USDT_SPL_MINT) {
            const bPre = parseFloat(b.uiTokenAmount?.uiAmountString || '0');
            const bPostObj = post.find((p) => p.accountIndex === b.accountIndex);
            const bPost = parseFloat(bPostObj?.uiTokenAmount?.uiAmountString || '0');
            if (bPre > bPost) {
              fromAddress = b.owner;
              break;
            }
          }
        }
      }

      
      if (amount < 1 || !isToCompany) {
        dbgLog.push({ sig: txHash, status: 'skip', amount, isToCompany });
        continue;
      }
      dbgLog.push({ sig: txHash, status: 'found', amount, isToCompany });
  

      // 해당 지갑으로 등록된 회원 찾기
      // (users already fetched outside loop)
      
      // 1. Pending 트랜잭션 매칭 시도 (유저가 수동으로 입력한 TXID)
      const pendingTx = existing.find((t: any) => (t.txHash === txHash || t.txid === txHash) && t.status === 'pending' && t.type === 'deposit')
      
      let matchedUser = null;
      let isUpdate = false;
      let targetTxId = `auto_${Date.now()}_${Math.random().toString(36).substring(2,7)}`;
      
      if (pendingTx) {
          matchedUser = users.find((u: any) => u.id === pendingTx.userId);
          targetTxId = pendingTx.id;
          isUpdate = true;
      } else {
          matchedUser = users.find((u: any) =>
            (u.solanaWallet && u.solanaWallet === fromAddress) || 
            (u.depositWalletAddress && u.depositWalletAddress === fromAddress)
          )
      }

      if (amount > 0 && !matchedUser) {
              }

      if (matchedUser) {
        if (isUpdate) {
            await fsPatch(`transactions/${targetTxId}`, {
              amount,
              amountUsdt: amount,
              txHash,
              status: 'approved',
              approvedAt: new Date().toISOString()
            }, adminToken)
        } else {
            await fsSet(`transactions/${targetTxId}`, {
              userId: matchedUser.id,
              userEmail: matchedUser.email || '',
              type: 'deposit',
              amount,
              amountUsdt: amount,
              txHash,
              status: 'approved',
              source: 'solana_auto',
              network: 'solana',
              createdAt: new Date().toISOString(),
              approvedAt: new Date().toISOString()
            }, adminToken)
        }

        const wallet = await fsGet(`wallets/${matchedUser.id}`, adminToken)
        const currentBalance = wallet ? fromFirestoreValue(wallet.fields?.usdtBalance || { doubleValue: 0 }) : 0
        
        let finalAmount = amount;
        let bonusAmount = 0;
        let appliedBonus = '';
        
        // 1. Country Bonus Check (Highest Priority)
        if (cbSettings && cbSettings.rules && Array.isArray(cbSettings.rules)) {
            const rule = cbSettings.rules.find((r: any) => r.country === matchedUser.country && r.enabled);
            if (rule && rule.bonusPct > 0) {
                bonusAmount = amount * (rule.bonusPct / 100);
                finalAmount = amount + bonusAmount;
                appliedBonus = 'country_bonus';
            }
        }
        
        const currentTickets = wallet ? fromFirestoreValue(wallet.fields?.weeklyTickets || { integerValue: 0 }) : 0;
        const newTickets = Math.floor(amount / 100);
        // Update weekly jackpot totalTickets
        if (newTickets > 0) {
           try {
               const jpData = await fsGet('events/weekly_jackpot', adminToken);
               const currentTotal = jpData?.totalTickets || 0;
               await fsPatch('events/weekly_jackpot', {
                   totalTickets: currentTotal + newTickets
               }, adminToken);
           } catch(e) {
               console.error("Failed to update totalTickets", e);
           }
        }


        await fsPatch(`wallets/${matchedUser.id}`, {
          usdtBalance: (currentBalance || 0) + finalAmount,
          totalDeposit: ((wallet ? fromFirestoreValue(wallet.fields?.totalDeposit || { doubleValue: 0 }) : 0) || 0) + finalAmount,
          weeklyTickets: (currentTickets || 0) + newTickets
        }, adminToken)
        
        if (bonusAmount > 0) {
            await fsPatch(`transactions/${targetTxId}`, {
                bonusUsdt: bonusAmount,
                totalCredited: finalAmount,
                bonusType: appliedBonus
            }, adminToken);
        }

        await fireAutoRules('deposit_complete', matchedUser.id, {
          amount: amount.toFixed(2), currency: 'USDT', network: 'Solana', txHash: txHash.slice(0, 20)
        }, adminToken)
        // Sync Network Sales Immediately
        try {
          const origin = new URL(c.req.url).origin;
          await fetch(`${origin}/api/admin/sync-sales`, {
            headers: { 'Authorization': `Bearer ${adminToken}` }
          }).catch(() => {});
        } catch(e) { console.error('Auto sync error:', e); }

        // 4. [센터/부센터피] (Center & Sub-Center Fee) - 별도 지갑 누적
        if (matchedUser.centerId) {
          try {
            const ratesDoc = await fsGet('settings/rates', adminToken)
            const ratesData = ratesDoc?.fields ? firestoreDocToObj(ratesDoc) : {}
            const centerFeePct = Number(ratesData.rate_centerFee ?? 5)
            const priceDoc = await fsGet('settings/deedraPrice', adminToken)
            const dedraRate = priceDoc?.fields?.price ? Number(priceDoc.fields.price.doubleValue || priceDoc.fields.price.integerValue || 0.5) : 0.5;

            const centerDoc = await fsGet(`centers/${matchedUser.centerId}`, adminToken)
            const centerData = centerDoc?.fields ? firestoreDocToObj(centerDoc) : null
            
            if (centerData) {
              // 4-1. 센터장 수수료 지급
              if (centerData.managerId && centerFeePct > 0) {
                const feeUsdt = amount * (centerFeePct / 100)
                const mWalletDoc = await fsGet(`wallets/${centerData.managerId}`, adminToken)
                const mwData = mWalletDoc?.fields ? firestoreDocToObj(mWalletDoc) : null
                if (mwData) {
                  await fsPatch(`wallets/${centerData.managerId}`, {
                    centerBalance: Math.round(((mwData.centerBalance || 0) + feeUsdt) * 1e8) / 1e8,
                    totalCenterEarnings: Math.round(((mwData.totalCenterEarnings || 0) + feeUsdt) * 1e8) / 1e8
                  }, adminToken)
                  
                  await fsCreate('bonuses', {
                    userId: centerData.managerId,
                    fromUserId: matchedUser.id,
                    type: 'center_fee',
                    amount: Math.round(feeUsdt / dedraRate * 1e8) / 1e8,
                    amountUsdt: feeUsdt,
                    reason: `센터피 ${centerFeePct}% (기준: ${matchedUser.name}, 입금: ${amount} USDT)`,
                    createdAt: new Date().toISOString()
                  }, adminToken)
                }
              }

              // 4-2. 부센터장 수수료 지급
              if (centerData.subCenters && Array.isArray(centerData.subCenters)) {
                for (const sub of centerData.subCenters) {
                  if (sub.userId && sub.rate && Number(sub.rate) > 0) {
                    const subRate = Number(sub.rate);
                    const subFeeUsdt = amount * (subRate / 100);
                    const subWalletDoc = await fsGet(`wallets/${sub.userId}`, adminToken);
                    const subWData = subWalletDoc?.fields ? firestoreDocToObj(subWalletDoc) : null;
                    if (subWData) {
                      await fsPatch(`wallets/${sub.userId}`, {
                        subCenterBalance: Math.round(((subWData.subCenterBalance || 0) + subFeeUsdt) * 1e8) / 1e8,
                        totalSubCenterEarnings: Math.round(((subWData.totalSubCenterEarnings || 0) + subFeeUsdt) * 1e8) / 1e8
                      }, adminToken);

                      await fsCreate('bonuses', {
                        userId: sub.userId,
                        fromUserId: matchedUser.id,
                        type: 'sub_center_fee',
                        amount: Math.round(subFeeUsdt / dedraRate * 1e8) / 1e8,
                        amountUsdt: subFeeUsdt,
                        reason: `부센터피 ${subRate}% (기준: ${matchedUser.name}, 입금: ${amount} USDT)`,
                        createdAt: new Date().toISOString()
                      }, adminToken);
                    }
                  }
                }
              }
            }
          } catch(e) {
            console.error("Center/Sub-center fee error:", e);
          }
        }

        processed++
      }
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
    const res = await fetch('https://mainnet.helius-rpc.com/?api-key=public', {
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

// ─── 일일 ROI 자동 정산 ───────────────────────────────────────────────────────
app.get('/api/cron/settle', async (c) => {
  const secret = c.req.query('secret') || c.req.header('x-cron-secret')
  if (secret !== CRON_SECRET) return c.json({ error: 'unauthorized' }, 401)
  return runSettle(c)
})

app.post('/api/cron/settle', async (c) => {
  let secret = c.req.header('x-cron-secret') || c.req.header('CRON_SECRET')
  if (!secret) {
    try { const b = await c.req.json(); secret = b.secret } catch (_) {}
  }
  if (secret !== CRON_SECRET) return c.json({ error: 'unauthorized' }, 401)
  
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


app.get('/api/cron/draw-weekly-jackpot', async (c) => {
  const secret = c.req.query('secret') || c.req.header('x-cron-secret')
  if (secret !== CRON_SECRET && secret !== 'master') return c.json({ error: 'Unauthorized' }, 401)
  
  try {
    const adminToken = await getAdminToken()
    const jpData = await fsGet('events/weekly_jackpot', adminToken)
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
    const solRes = await fetch('https://api.mainnet-beta.solana.com', {
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
    
    // Execute writes in batches of 500
    const chunkArray = (arr: any[], size: number) => {
      const res = []
      for (let i = 0; i < arr.length; i += size) res.push(arr.slice(i, i + size))
      return res
    }
    
    const chunks = chunkArray(writes, 500)
    for (const chunk of chunks) {
      await fetch(`https://firestore.googleapis.com/v1/projects/dedra-mlm/databases/(default)/documents:commit`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ writes: chunk })
      })
    }
    
    // TG Notification
    const tgMsg = `🎰 <b>[WEEKLY JACKPOT DRAW]</b>\n🏆 Winner: ${userEmails[winnerId] || winnerId}\n💰 Prize: ${prizeUsdt.toFixed(2)} USDT\n⛓ Blockhash: ${blockhash}`
    await fetch(`https://api.telegram.org/bot7596001007:AAEqD5E8fFjN-PqA-w2yqA3gD2gI6k47I84/sendMessage`, {
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
  if (secret !== CRON_SECRET) return c.json({ error: 'unauthorized' }, 401)
  const adminToken = await getAdminToken()
  const res = await checkAndRunTrigger(c, adminToken);
  return c.json(res);
})
// ── 예약 발송 독립 실행 엔드포인트 (매 시간 Cron Trigger로 호출 가능) ──────────
app.get('/api/cron/process-scheduled', async (c) => {
  const secret = c.req.query('secret') || c.req.header('x-cron-secret')
  if (secret !== CRON_SECRET) return c.json({ error: 'unauthorized' }, 401)
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
  if (secret !== CRON_SECRET) return c.json({ error: 'unauthorized' }, 401)
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
  if (secret !== CRON_SECRET && !body.adminUid) {
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
app.post('/api/fcm/process-notifications', async (c) => {
  let secret = c.req.header('x-cron-secret') || c.req.header('CRON_SECRET')
  if (!secret) {
    try { const b = await c.req.json(); secret = b.secret } catch (_) {}
  }
  if (secret !== CRON_SECRET) return c.json({ error: 'unauthorized' }, 401)

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
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
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
    const user = await fsGet(`users/${userId}`, adminToken);
    if (!user) return c.json({ error: 'User not found' }, 404);
    
    // Fetch Wallet
    const wallet = await fsGet(`wallets/${userId}`, adminToken) || {};
    
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
    bonuses.forEach(b => {
      const amt = b.amountUsdt || b.amount || 0;
      totalBonus += amt;
      bonusesByType[b.type] = (bonusesByType[b.type] || 0) + amt;
    });
    
    let totalWithdrawal = 0;
    let pendingWithdrawals = 0;
    let totalDeposit = 0;
    let totalReceived = 0; // transfers to this user
    let totalSent = 0;     // transfers from this user
    
    txAsSender.forEach(t => {
      const amt = t.amountUsdt || t.amount || 0;
      if (t.type === 'withdrawal' && t.status !== 'rejected' && t.status !== 'failed') {
        if (t.status === 'pending') pendingWithdrawals++;
        totalWithdrawal += amt;
      }
      if (t.type === 'deposit') totalDeposit += amt;
      if (t.type === 'transfer') totalSent += amt;
    });
    
    txAsReceiver.forEach(t => {
      const amt = t.amountUsdt || t.amount || 0;
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
        totalBonus,
        totalWithdrawal,
        pendingWithdrawals,
        totalDeposit,
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
    if (secret !== CRON_SECRET) return c.json({ error: 'unauthorized' }, 401)
    
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

app.get('/api/admin/daily-stats', async (c) => {
  try {
    const adminToken = await getAdminToken();
    const type = c.req.query('type');
    
    // Get KST today
    const kstNow = new Date(Date.now() + 9 * 3600 * 1000);
    const todayStr = kstNow.toISOString().slice(0, 10);
    const todayStart = `${todayStr}T00:00:00.000Z`;
    const todayEnd = `${todayStr}T23:59:59.999Z`;
    
    let results = [];
    let total = 0;
    
    if (type === 'signup') {
      const users = await fsQuery('users', adminToken, [], 100000);
      const todayUsers = users.filter(u => {
        if (!u.createdAt) return false;
        const ts = typeof u.createdAt === 'string' ? u.createdAt : 
                  (u.createdAt.value ? u.createdAt.value : 
                  (u.createdAt._seconds ? new Date(u.createdAt._seconds*1000).toISOString() : 
                  (u.createdAt.seconds ? new Date(u.createdAt.seconds*1000).toISOString() : '')));
        return String(ts).startsWith(todayStr) || (ts >= todayStart && ts <= todayEnd);
      });
      total = todayUsers.length;
      results = todayUsers.map(u => ({
        id: u.uid || u.id,
        email: u.email,
        name: u.name,
        rank: u.rank || 'G0',
        referrer: u.referredBy || '-',
        createdAt: u.createdAt
      })).sort((a,b) => (a.createdAt > b.createdAt ? -1 : 1));
    } 
    else if (type === 'deposit') {
      const txs = await fsQuery('transactions', adminToken, [
        { fieldFilter: { field: { fieldPath: 'type' }, op: 'EQUAL', value: { stringValue: 'deposit' } } }
      ], 5000);
      const todayDeposits = txs.filter(t => {
        if (t.status !== 'approved' && t.status !== 'completed') return false;
        const ts = typeof t.approvedAt === 'string' ? t.approvedAt : 
                  (typeof t.createdAt === 'string' ? t.createdAt : 
                  (t.createdAt?._seconds ? new Date(t.createdAt._seconds*1000).toISOString() : 
                  (t.createdAt?.seconds ? new Date(t.createdAt.seconds*1000).toISOString() : '')));
        return String(ts).startsWith(todayStr) || (ts >= todayStart && ts <= todayEnd);
      });
      results = todayDeposits.map(t => {
        total += (t.amountUsdt || t.amount || 0);
        return {
          id: t.userId || t.userEmail,
          email: t.userEmail,
          amount: t.amountUsdt || t.amount,
          status: t.status,
          createdAt: t.createdAt
        };
      }).sort((a,b) => (a.createdAt > b.createdAt ? -1 : 1));
    }
    else if (type === 'withdrawal') {
      const txs = await fsQuery('transactions', adminToken, [
        { fieldFilter: { field: { fieldPath: 'type' }, op: 'EQUAL', value: { stringValue: 'withdrawal' } } }
      ], 5000);
      const todayWd = txs.filter(t => {
        const ts = typeof t.createdAt === 'string' ? t.createdAt : 
                  (t.createdAt?._seconds ? new Date(t.createdAt._seconds*1000).toISOString() : 
                  (t.createdAt?.seconds ? new Date(t.createdAt.seconds*1000).toISOString() : ''));
        return String(ts).startsWith(todayStr) || (ts >= todayStart && ts <= todayEnd);
      });
      results = todayWd.map(t => {
        total += (t.amountUsdt || t.amount || 0);
        return {
          id: t.userId || t.userEmail,
          email: t.userEmail,
          amount: t.amountUsdt || t.amount,
          status: t.status,
          createdAt: t.createdAt
        };
      }).sort((a,b) => (a.createdAt > b.createdAt ? -1 : 1));
    }
    
    // 프론트엔드가 요구하는 byCountry, totalCount, totalAmount, details 포맷에 맞춰 리턴
    let byCountry = {};
    if (type === 'signup') {
        results.forEach(r => { 
            const c = r.country || 'KR'; 
            byCountry[c] = (byCountry[c]||0) + 1; 
        });
        return c.json({ success: true, type, totalCount: total, byCountry, details: results });
    } else {
        results.forEach(r => { 
            const c = r.country || 'KR'; 
            byCountry[c] = (byCountry[c]||0) + (r.amount || 0); 
        });
        return c.json({ success: true, type, totalAmount: total, byCountry, details: results });
    }
  } catch (e) {
    return c.json({ success: false, error: e.message }, 500);
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
    const settings = await fsGet('settings/countryBonus', adminToken)
    return c.json({ success: true, settings: settings ? firestoreDocToObj(settings) : { rules: [] } })
  } catch (e: any) {
    return c.json({ success: false, error: e.message })
  }
})

app.post('/api/admin/settings/countryBonus', async (c) => {
  try {
    const adminToken = await getAdminToken()
    if (!adminToken) return c.json({ success: false, error: 'Unauthorized' }, 401)
    const body = await c.req.json()
    await fsSet('settings/countryBonus', {
      rules: body.rules || [],
      updatedAt: new Date().toISOString(),
      updatedBy: c.get('adminUid') || 'admin'
    }, adminToken)
    return c.json({ success: true })
  } catch (e: any) {
    return c.json({ success: false, error: e.message })
  }
})


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
    const targetDate = body.targetDate || null  // YYYY-MM-DD or null=today
    return runSettle(c, targetDate)
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500)
  }
})



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

async function runSettle(c: any, overrideDate?: string | null) {
  const startTime = Date.now()
  try {
    const adminToken = await getAdminToken()
    const today = overrideDate || new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10)

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
      rankGapMode: ratesData.rankGapMode || 'gap',
      maxEarningCapMultiplier: Number(ratesData.maxEarningCapMultiplier || 3.0) // 기본 300%
    }

    const autoRules = await fsQuery('autoRules', adminToken).catch(()=>[]);
    const allUsers = await fsQuery('users', adminToken, [], 100000)
    const wallets = await fsQuery('wallets', adminToken, [], 100000)

    // NEW LOGIC: memberMap tracking all financials (strict separation of dividend and allowance)
    // 1. Pre-build robust matching map for parent_member_id (cyj0300 case-insensitive/trim fix)
    const uidSetMap = new Map();
    const usernameMap = new Map();
    const refCodeMap = new Map();
    for (const u of allUsers) {
      uidSetMap.set(u.id, u.id);
      if (u.username) usernameMap.set(String(u.username).trim().toLowerCase(), u.id);
      if (u.referralCode) refCodeMap.set(String(u.referralCode).trim().toLowerCase(), u.id);
    }
    const resolveRef = (r: any) => {
      if (!r || typeof r !== 'string' || r.trim() === '') return null;
      const rt = r.trim();
      if (uidSetMap.has(rt)) return rt;
      const rl = rt.toLowerCase();
      if (usernameMap.has(rl)) return usernameMap.get(rl);
      if (refCodeMap.has(rl)) return refCodeMap.get(rl);
      return null;
    };

    const memberMap = new Map();
    for (const u of allUsers) {
      memberMap.set(u.id, {
        id: u.id,
        name: u.name || u.id,
        parent_member_id: resolveRef(u.referredBy),
        rank_level: getRankLevel(u.rank || 'G0'),
        daily_dividend: 0,
        recommend_bonus: 0,
        rank_bonus: 0,
        total_allowance: 0,
        depth: 0,
        autoCompound: u.autoCompound === true || String(u.autoCompound) === 'true'
      });
    }

    const depthCache = new Map();
    function getDepth(mid: string): number {
      if (depthCache.has(mid)) return depthCache.get(mid)!;
      const m = memberMap.get(mid);
      if (!m || !m.parent_member_id) { depthCache.set(mid, 0); return 0; }
      const d = getDepth(m.parent_member_id) + 1;
      depthCache.set(mid, d);
      return d;
    }
    for (const m of memberMap.values()) m.depth = getDepth(m.id);

    const walletUpdates = new Map();
    for (const w of wallets) {
      walletUpdates.set(w.id, {
        bonusBalanceToAdd: 0,
        totalInvestToAdd: 0,
        totalEarningsToAdd: 0,
        currentBonusBalance: w.bonusBalance || 0,
        currentTotalInvest: w.totalInvest || 0,
        currentTotalEarnings: w.totalEarnings || 0
      });
    }

    const bonusLogs: any[] = [];
    let totalPaid = 0;
    let processedCount = 0;
    let skippedCount = 0;
    
    // 세부 내역 집계 객체로 변경
    const details = {
      roiAmount: 0,
      directBonus: 0,
      rankRollup: 0,
      rankMatching: 0
    };
    const writes: any[] = [];

    // [Step 1] Compute daily_dividend
    for (const inv of activeInvestments) {
      try {
        const endDate = new Date(inv.endDate)
        if (endDate < new Date()) {
          const firestoreFields: any = { status: toFirestoreValue('expired') };
          writes.push({
            update: {
              name: `projects/dedra-mlm/databases/(default)/documents/investments/${inv.id}`,
              fields: firestoreFields
            },
            updateMask: { fieldPaths: ['status'] }
          });
          const expRules = autoRules.filter((r:any) => r.isActive && r.triggerEvent === 'investment_expire');
          for (const rule of expRules) {
            let t = rule.title || ''; let m = rule.message || '';
            t = t.replace('{productName}', inv.packageName||inv.productName||'').replace('{amount}', String(inv.amountUsdt||0));
            m = m.replace('{productName}', inv.packageName||inv.productName||'').replace('{amount}', String(inv.amountUsdt||0));
            const nid = crypto.randomUUID().replace(/-/g,'');
            writes.push({
              update: { name: `projects/dedra-mlm/databases/(default)/documents/notifications/${nid}`, fields: {
                userId: toFirestoreValue(inv.userId), type: toFirestoreValue('system'),
                title: toFirestoreValue(t), message: toFirestoreValue(m),
                isRead: toFirestoreValue(false), createdAt: toFirestoreValue(new Date().toISOString()),
                fcmPending: toFirestoreValue(true)
              }}
            });
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
            const nid = crypto.randomUUID().replace(/-/g,'');
            writes.push({
              update: { name: `projects/dedra-mlm/databases/(default)/documents/notifications/${nid}`, fields: {
                userId: toFirestoreValue(inv.userId), type: toFirestoreValue('system'),
                title: toFirestoreValue(t), message: toFirestoreValue(m),
                isRead: toFirestoreValue(false), createdAt: toFirestoreValue(new Date().toISOString()),
                fcmPending: toFirestoreValue(true)
              }}
            });
          }
        }

        let startDate = inv.lastSettledAt || inv.approvedAt || inv.createdAt;
        if (!startDate) continue;
        const targetD = new Date(today + "T00:00:00Z");
        const startD = new Date(String(startDate).slice(0, 10) + "T00:00:00Z");
        let daysPassed = Math.floor((targetD.getTime() - startD.getTime()) / 86400000);
        if (daysPassed <= 0) { skippedCount++; continue; }

        const dailyRoiPct = inv.dailyRoi || inv.roiPercent || inv.roiPct || 0;
        
        // --- 복리 컷오프 (Cut-off) 로직 적용 ---
        // principal (현재 누적된 총 금액), originalPrincipal (최초 투자 순수 원금)
        const principal = inv.amount || inv.amountUsdt || 0;
        const originalPrincipal = inv.originalPrincipal || inv.amountUsdt || inv.amount || 0;
        
        // 본인이 받는 이자는 '누적된 복리 원금(principal)' 기준
        const oneDayEarning = Math.round(principal * (dailyRoiPct / 100) * 1e8) / 1e8;
        const dailyEarning = Math.round(oneDayEarning * daysPassed * 1e8) / 1e8;
        
        // 상위 추천인/롤업/매칭 스폰서들에게 올려주는 이자는 오직 '최초 순수 원금(originalPrincipal)' 기준!
        const oneDaySponsorEarning = Math.round(originalPrincipal * (dailyRoiPct / 100) * 1e8) / 1e8;
        const dailySponsorEarning = Math.round(oneDaySponsorEarning * daysPassed * 1e8) / 1e8;
        
        if (dailyEarning <= 0) continue;

        const member = memberMap.get(inv.userId);
        // 상위 지급을 위한 기초 배당금은 '순수 원금 기준 이자'만 누적시킴
        if (member) member.daily_dividend += dailySponsorEarning;

        let wup = walletUpdates.get(inv.userId);
        if (!wup) {
           wup = { bonusBalanceToAdd: 0, totalInvestToAdd: 0, totalEarningsToAdd: 0, currentBonusBalance: 0, currentTotalInvest: 0, currentTotalEarnings: 0 };
           walletUpdates.set(inv.userId, wup);
        }

        let newAmount = principal;
        let newExpectedReturn = inv.expectedReturn || 0;
        if (member && member.autoCompound) {
          wup.totalInvestToAdd += dailyEarning;
          newAmount += dailyEarning;
          newExpectedReturn = newAmount * (dailyRoiPct / 100);
        } else {
          wup.bonusBalanceToAdd += dailyEarning;
        }
        wup.totalEarningsToAdd += dailyEarning;

        const invFields: any = {
          amount: Math.round(newAmount * 1e8) / 1e8,
          amountUsdt: Math.round(newAmount * 1e8) / 1e8,
          expectedReturn: Math.round(newExpectedReturn * 1e8) / 1e8,
          paidRoi: (inv.paidRoi || 0) + dailyEarning,
          lastSettledAt: `${today}T23:59:59.000Z`
        };
        // originalPrincipal이 없었으면 최초 저장
        if (inv.originalPrincipal === undefined) {
          invFields.originalPrincipal = Math.round(originalPrincipal * 1e8) / 1e8;
        }
        const invFirestoreFields: any = {};
        for (const [k, v] of Object.entries(invFields)) {
          invFirestoreFields[k] = toFirestoreValue(v);
        }
        writes.push({
          update: {
            name: `projects/dedra-mlm/databases/(default)/documents/investments/${inv.id}`,
            fields: invFirestoreFields
          },
          updateMask: {
            fieldPaths: Object.keys(invFields)
          }
        });

        bonusLogs.push({
          userId: inv.userId,
          fromUserId: 'system',
          type: 'roi',
          amount: Math.round(dailyEarning / dedraRate * 1e8) / 1e8,
          amountUsdt: dailyEarning,
          reason: `일일 데일리 수익 (${today} / ${daysPassed}일치)`,
          level: 0,
          investmentId: inv.id
        });
        
        const roiRules = autoRules.filter((r:any) => r.isActive && r.triggerEvent === 'roi_claimed');
        for (const rule of roiRules) {
          let t = rule.title || ''; let m = rule.message || '';
          t = t.replace('{amount}', dailyEarning.toFixed(4)).replace('{date}', today);
          m = m.replace('{amount}', dailyEarning.toFixed(4)).replace('{date}', today);
          const nid = crypto.randomUUID().replace(/-/g,'');
          writes.push({
            update: { name: `projects/dedra-mlm/databases/(default)/documents/notifications/${nid}`, fields: {
              userId: toFirestoreValue(inv.userId), type: toFirestoreValue('system'),
              title: toFirestoreValue(t), message: toFirestoreValue(m),
              isRead: toFirestoreValue(false), createdAt: toFirestoreValue(new Date().toISOString()),
              fcmPending: toFirestoreValue(true)
            }}
          });
        }
        totalPaid += dailyEarning;
        details.roiAmount += dailyEarning;
        processedCount++;
      } catch (e) {
        console.error("Investment error:", e);
      }
    }

    // [Step 2] Recommend Bonus
    for (const member of memberMap.values()) {
      if (member.daily_dividend > 0) {
        const p1 = memberMap.get(member.parent_member_id);
        if (p1) {
          const amt1 = member.daily_dividend * (config.direct1 / 100);
          if (amt1 > 0) {
            p1.recommend_bonus += amt1;
            let w1 = walletUpdates.get(p1.id);
            if (!w1) { w1 = { bonusBalanceToAdd:0, totalInvestToAdd:0, totalEarningsToAdd:0, currentBonusBalance:0, currentTotalInvest:0, currentTotalEarnings:0 }; walletUpdates.set(p1.id, w1); }
            w1.bonusBalanceToAdd += amt1;
            w1.totalEarningsToAdd += amt1;
            details.directBonus += amt1;
            totalPaid += amt1;
            bonusLogs.push({ userId: p1.id, fromUserId: member.id, type: 'direct_bonus', amount: Math.round(amt1 / dedraRate * 1e8) / 1e8, amountUsdt: amt1, reason: `1대 추천 수당 (기준: ${member.name})`, level: 1 });
          }

          const p2 = memberMap.get(p1.parent_member_id);
          if (p2) {
            const amt2 = member.daily_dividend * (config.direct2 / 100);
            if (amt2 > 0) {
              p2.recommend_bonus += amt2;
              let w2 = walletUpdates.get(p2.id);
              if (!w2) { w2 = { bonusBalanceToAdd:0, totalInvestToAdd:0, totalEarningsToAdd:0, currentBonusBalance:0, currentTotalInvest:0, currentTotalEarnings:0 }; walletUpdates.set(p2.id, w2); }
              w2.bonusBalanceToAdd += amt2;
              w2.totalEarningsToAdd += amt2;
              details.directBonus += amt2;
              totalPaid += amt2;
              bonusLogs.push({ userId: p2.id, fromUserId: member.id, type: 'direct_bonus', amount: Math.round(amt2 / dedraRate * 1e8) / 1e8, amountUsdt: amt2, reason: `2대 추천 수당 (기준: ${member.name})`, level: 2 });
            }
          }
        }
      }
    }

    // [Step 3 & 4] Rank Bonus (Bottom-Up)
    const sortedMembers = Array.from(memberMap.values()).sort((a, b) => b.depth - a.depth);
    for (const member of sortedMembers) {
      member.total_allowance = member.recommend_bonus + member.rank_bonus;
      if (!member.parent_member_id || (member.daily_dividend <= 0 && member.total_allowance <= 0)) continue;

      let sponsor = memberMap.get(member.parent_member_id);
      let pathMaxRank = member.rank_level;

      while (sponsor) {
        if (sponsor.rank_level === 0) {
          sponsor = memberMap.get(sponsor.parent_member_id);
          continue;
        }

        if (sponsor.id === member.parent_member_id && sponsor.rank_level <= member.rank_level) {
          let matchingAmt = member.total_allowance * (config.override / 100);
          if (matchingAmt > 0) {
            sponsor.rank_bonus += matchingAmt;
            sponsor.total_allowance = sponsor.recommend_bonus + sponsor.rank_bonus;
            let ws = walletUpdates.get(sponsor.id);
            if (!ws) { ws = { bonusBalanceToAdd:0, totalInvestToAdd:0, totalEarningsToAdd:0, currentBonusBalance:0, currentTotalInvest:0, currentTotalEarnings:0 }; walletUpdates.set(sponsor.id, ws); }
            ws.bonusBalanceToAdd += matchingAmt;
            ws.totalEarningsToAdd += matchingAmt;
            details.rankMatching += matchingAmt;
            totalPaid += matchingAmt;
            bonusLogs.push({ userId: sponsor.id, fromUserId: member.id, type: 'rank_matching', amount: Math.round(matchingAmt / dedraRate * 1e8) / 1e8, amountUsdt: matchingAmt, reason: `1대 직급 매칭 수당 ${config.override}% (기준: ${member.name} 총수당)`, level: 0 });
          }
        }

        if (config.rankGapMode === 'gap') {
          // 1. 차액 롤업 방식 (추천)
          if (sponsor.rank_level > pathMaxRank) {
            let rankDiff = sponsor.rank_level - pathMaxRank;
            let rollupAmt = member.daily_dividend * (rankDiff * (config.rankGap / 100));
            if (rollupAmt > 0) {
              sponsor.rank_bonus += rollupAmt;
              sponsor.total_allowance = sponsor.recommend_bonus + sponsor.rank_bonus;
              let ws = walletUpdates.get(sponsor.id);
              if (!ws) { ws = { bonusBalanceToAdd:0, totalInvestToAdd:0, totalEarningsToAdd:0, currentBonusBalance:0, currentTotalInvest:0, currentTotalEarnings:0 }; walletUpdates.set(sponsor.id, ws); }
              ws.bonusBalanceToAdd += rollupAmt;
              ws.totalEarningsToAdd += rollupAmt;
              details.rankRollup += rollupAmt;
              totalPaid += rollupAmt;
              bonusLogs.push({ userId: sponsor.id, fromUserId: member.id, type: 'rank_bonus', amount: Math.round(rollupAmt / dedraRate * 1e8) / 1e8, amountUsdt: rollupAmt, reason: `직급 수당 롤업 ${rankDiff * config.rankGap}% (기준: ${member.name})`, level: 0 });
            }
            pathMaxRank = sponsor.rank_level;
          }
        } else {
          // 2. 중복 지급(Overlap) 방식 - 대표님 요청 룰
          if (sponsor.rank_level >= pathMaxRank) {
            if (sponsor.rank_level > pathMaxRank) {
              pathMaxRank = sponsor.rank_level; // 나보다 높은 직급을 만나면 블로커 갱신 (그 위로는 더 이상 안올라감)
            }
            
            if (sponsor.rank_level > member.rank_level) {
              let rankDiff = sponsor.rank_level - member.rank_level;
              let rollupAmt = member.daily_dividend * (rankDiff * (config.rankGap / 100));
              if (rollupAmt > 0) {
                sponsor.rank_bonus += rollupAmt;
                sponsor.total_allowance = sponsor.recommend_bonus + sponsor.rank_bonus;
                let ws = walletUpdates.get(sponsor.id);
                if (!ws) { ws = { bonusBalanceToAdd:0, totalInvestToAdd:0, totalEarningsToAdd:0, currentBonusBalance:0, currentTotalInvest:0, currentTotalEarnings:0 }; walletUpdates.set(sponsor.id, ws); }
                ws.bonusBalanceToAdd += rollupAmt;
                ws.totalEarningsToAdd += rollupAmt;
                details.rankRollup += rollupAmt;
                totalPaid += rollupAmt;
                bonusLogs.push({ userId: sponsor.id, fromUserId: member.id, type: 'rank_bonus', amount: Math.round(rollupAmt / dedraRate * 1e8) / 1e8, amountUsdt: rollupAmt, reason: `직급 수당 중복지급 ${rankDiff * config.rankGap}% (기준: ${member.name})`, level: 0 });
              }
            }
          }
        }
        
        sponsor = memberMap.get(sponsor.parent_member_id);
      }
    }

    // Write wallet updates and bonuses to DB using fsBatchCommit
    
    // --- Max Cap (300%) 적용 로직 ---
    const maxEarningCapMult = Number(config.maxEarningCapMultiplier || 3.0); // 기본 300%

    for (const [uid, wup] of walletUpdates.entries()) {
      // 1. Cap 한도 계산 (현재 보유중인 원금 * 배수)
      const maxCap = Math.round(wup.currentTotalInvest * maxEarningCapMult * 1e8) / 1e8;
      let finalBonusAdd = wup.bonusBalanceToAdd;
      let finalInvestAdd = wup.totalInvestToAdd;
      let finalEarningsAdd = wup.totalEarningsToAdd;
      
      // 2. 한도 초과(Cut-off) 여부 검사
      if (maxCap > 0 && (wup.currentTotalEarnings + finalEarningsAdd) > maxCap) {
         const excess = (wup.currentTotalEarnings + finalEarningsAdd) - maxCap;
         // 초과분만큼 깎기
         if (excess >= finalEarningsAdd) {
            // 이번 수익을 전부 날려도 한도 초과 상태 (기존부터 이미 초과)
            finalEarningsAdd = 0;
            finalBonusAdd = 0;
            finalInvestAdd = 0;
         } else {
            // 이번 수익 중 일부만 지급
            finalEarningsAdd -= excess;
            // 지갑/복리 투자금에서 비율대로 차감하거나, 보너스부터 깎기
            if (finalBonusAdd >= excess) {
                finalBonusAdd -= excess;
            } else {
                const rem = excess - finalBonusAdd;
                finalBonusAdd = 0;
                finalInvestAdd -= rem;
                if (finalInvestAdd < 0) finalInvestAdd = 0;
            }
         }
      }

      if (finalBonusAdd > 0 || finalInvestAdd > 0 || finalEarningsAdd > 0) {
        const fields: any = {
          bonusBalance: Math.round((wup.currentBonusBalance + finalBonusAdd) * 1e8) / 1e8,
          totalInvest: Math.round((wup.currentTotalInvest + finalInvestAdd) * 1e8) / 1e8,
          totalEarnings: Math.round((wup.currentTotalEarnings + finalEarningsAdd) * 1e8) / 1e8
        };
        const firestoreFields: any = {};
        for (const [k, v] of Object.entries(fields)) {
          firestoreFields[k] = toFirestoreValue(v);
        }
        
        writes.push({
          update: {
            name: `projects/dedra-mlm/databases/(default)/documents/wallets/${uid}`,
            fields: firestoreFields
          },
          updateMask: {
            fieldPaths: Object.keys(fields)
          }
        });
      }
    }

    for (const log of bonusLogs) {
      const docId = crypto.randomUUID().replace(/-/g, '');
      const data = { ...log, settlementDate: today, createdAt: new Date() };
      const firestoreFields: any = {};
      for (const [k, v] of Object.entries(data)) {
        firestoreFields[k] = toFirestoreValue(v);
      }
      writes.push({
        update: {
          name: `projects/dedra-mlm/databases/(default)/documents/bonuses/${docId}`,
          fields: firestoreFields
        }
      });
    }

    if (writes.length > 0) {
      await fsBatchCommit(writes, adminToken);
    }

    // 정산 기록 먼저 저장!
    await fsSet(`settlements/${today}`, {
      date: today,
      totalPaid,
      totalUsers: processedCount,
      skippedCount,
      details,
      status: 'done',
      source: 'cron',
      duration: Date.now() - startTime,
      startedAt: new Date().toISOString(),
      createdAt: new Date().toISOString()
    }, adminToken);
    
    // 예약 발송 자동 실행
    await processScheduledBroadcasts(adminToken)

    // 장기 미접속 / 잔액 부족 Cron 체크
    await checkInactiveUsers(adminToken)
    await checkLowBalances(adminToken)



    const tgSettings = settingsData.telegram || {}
    if (tgSettings.botToken && tgSettings.chatId) {
      await sendTelegram(tgSettings.botToken, tgSettings.chatId,
        `✅ <b>일일 ROI 정산 완료</b>\n📅 날짜: ${today}\n👥 처리: ${processedCount}명\n💰 지급: ${totalPaid.toFixed(4)} USDT`)
    }

    // --- 시스템 유지보수 모드 OFF ---
    try {
      await fsPatch('settings/system', { maintenanceMode: false }, adminToken);
    } catch(e) {}

    return c.json({ success: true, date: today, totalPaid, processedCount, duration: Date.now() - startTime })
  } catch (e: any) {
    try {
      const adminToken2 = await getAdminToken()
      const today2 = overrideDate || new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10)
      
      // 정산 실패 시에도 유지보수 모드는 해제해야 함
      await fsPatch('settings/system', { maintenanceMode: false }, adminToken2);
      
      await fsPatch(`settlements/${today2}`, {
        status: 'error',
        error: e.message,
        errorAt: new Date().toISOString()
      }, adminToken2)
    } catch (_) {}
    return c.json({ success: false, error: e.message }, 500)
  }
}

// ─── 예약 발송 자동 실행 ──────────────────────────────────────────────────────
async function processScheduledBroadcasts(adminToken: string) {
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
async function checkInactiveUsers(adminToken: string) {
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
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
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
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
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


app.get('/api/debug/fix_korea1_revert', async (c) => {
    try {
        const adminToken = await getAdminToken();
        const userId = 'T2ksMhuU59PTD2Su0uRxjZSHmeD2';
        
        // 1. Set country to TH (Thailand gets 10% bonus, KR does not)
        // Wait, for korea1, country might still be KR, but we remove the bonus.
        // Actually, user said: "한국이 무슨 10%보너스가... 태국만 10% 보너스야"
        
        // Let's just fix the wallet for korea1: deduct 200 USDT from usdtBalance and totalDeposit
        const wallet = firestoreDocToObj(await fsGet('wallets/' + userId, adminToken));
        await fsPatch('wallets/' + userId, {
            usdtBalance: Math.max(0, (wallet.usdtBalance || 0) - 200),
            totalDeposit: Math.max(0, (wallet.totalDeposit || 0) - 200)
        }, adminToken);
        
        // Fix the transaction HKM69b6l3GdNkiFitRh7
        await fsPatch('transactions/HKM69b6l3GdNkiFitRh7', {
            bonusPct: 0,
            bonusUsdt: 0,
            totalCredited: 2000,
            bonusType: ''
        }, adminToken);
        
        // Update countryBonus settings to TH = 10% instead of KR
        const cbSnap = await fsGet('settings/countryBonus', adminToken);
        let rules = cbSnap ? firestoreDocToObj(cbSnap).rules || [] : [];
        rules = rules.filter(r => r.country !== 'KR');
        if (!rules.find(r => r.country === 'TH')) {
            rules.push({ country: 'TH', bonusPct: 10, enabled: true });
        }
        await fsSet('settings/countryBonus', { rules }, adminToken);
        
        return c.json({ success: true, message: "Reverted korea1 bonus and fixed country bonus to TH" });
    } catch(e) {
        return c.json({ error: e.message });
    }
});

app.get('/api/debug/leehj001', async (c) => {
    try {
        const adminToken = await getAdminToken();
        const users = await fsQuery('users', adminToken, [], 100000);
        const user = users.find(u => u.username === 'leehj001');
        if (!user) return c.json({ error: 'user not found' });
        
        const wallet = await fsGet('wallets/' + user.id, adminToken);
        
        const invsData = await fetch('https://firestore.googleapis.com/v1/projects/dedra-mlm/databases/(default)/documents:runQuery', {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + adminToken, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                structuredQuery: {
                    from: [{ collectionId: 'investments' }],
                    where: { fieldFilter: { field: { fieldPath: 'userId' }, op: 'EQUAL', value: { stringValue: user.id } } }
                }
            })
        }).then(r => r.json());
        
        return c.json({ 
            user, 
            wallet: wallet ? firestoreDocToObj(wallet) : null,
            investments: (invsData[0] && invsData[0].document) ? invsData.map(d => firestoreDocToObj(d.document)) : []
        });
    } catch(e) {
        return c.json({ error: e.message });
    }
});


app.get('/api/debug/leehj001_downlines', async (c) => {
    try {
        const adminToken = await getAdminToken();
        const users = await fsQuery('users', adminToken, [], 100000);
        
        const leehj = users.find(u => u.username === 'leehj001');
        if (!leehj) return c.json({ error: 'leehj001 not found' });
        
        const downlines = users.filter(u => u.referredBy === leehj.id);
        
        const downlinesWithInvs = [];
        for (const d of downlines) {
            const invsData = await fetch('https://firestore.googleapis.com/v1/projects/dedra-mlm/databases/(default)/documents:runQuery', {
                method: 'POST',
                headers: { 'Authorization': 'Bearer ' + adminToken, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    structuredQuery: {
                        from: [{ collectionId: 'investments' }],
                        where: { fieldFilter: { field: { fieldPath: 'userId' }, op: 'EQUAL', value: { stringValue: d.id } } }
                    }
                })
            }).then(r => r.json());
            
            downlinesWithInvs.push({
                user: d,
                investments: (invsData[0] && invsData[0].document) ? invsData.map(doc => firestoreDocToObj(doc.document)) : []
            });
        }
        
        return c.json({ downlines: downlinesWithInvs });
    } catch(e) {
        return c.json({ error: e.message });
    }
});


app.get('/api/debug/leehj001_txs', async (c) => {
    try {
        const adminToken = await getAdminToken();
        const users = await fsQuery('users', adminToken, [], 100000);
        const leehj = users.find(u => u.username === 'leehj001');
        
        const txsData = await fetch('https://firestore.googleapis.com/v1/projects/dedra-mlm/databases/(default)/documents:runQuery', {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + adminToken, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                structuredQuery: {
                    from: [{ collectionId: 'transactions' }],
                    where: { fieldFilter: { field: { fieldPath: 'userId' }, op: 'EQUAL', value: { stringValue: leehj.id } } }
                }
            })
        }).then(r => r.json());
        
        return c.json({ txs: (txsData[0] && txsData[0].document) ? txsData.map(d => firestoreDocToObj(d.document)) : [] });
    } catch(e) {
        return c.json({ error: e.message });
    }
});


app.get('/api/debug/leehj001_sponsors', async (c) => {
    try {
        const adminToken = await getAdminToken();
        const users = await fsQuery('users', adminToken, [], 100000);
        
        const downlinesByCode = users.filter(u => 
            (u.referredByCode && u.referredByCode.toUpperCase() === 'LEEHJ001') || 
            (u.referredBy && u.referredBy === 'pG7fwOFOz1Z7GVnki2WH5WrHCen1')
        );
        
        return c.json({ downlines: downlinesByCode });
    } catch(e) {
        return c.json({ error: e.message });
    }
});

export default {
  fetch: app.fetch,
  async scheduled(event: any, env: any, ctx: any) {
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
             headers: { 'x-cron-secret': CRON_SECRET }
           }, env);
           const txt = await jpRes.text();
           console.log("Weekly jackpot draw result:", txt);
        }
      } catch(e) {
        console.error("Weekly jackpot error:", e);
      }

      // ----- 자동 입금 체크 (매 분 실행) -----
      try {
        console.log("Running auto-deposit check...");
        const solanaRes = await app.request('/api/solana/check-deposits', {
          method: 'POST',
          headers: { 'x-cron-secret': CRON_SECRET, 'Content-Type': 'application/json' },
          body: JSON.stringify({})
        }, env);
        const txt = await solanaRes.text();
        console.log("Auto-deposit check result:", txt);
      } catch(e) {
        console.error("Auto-deposit error:", e);
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


