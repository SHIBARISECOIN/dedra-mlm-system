const fs = require('fs');
const crypto = require('crypto');

const indexCode = fs.readFileSync('./src/index.tsx', 'utf8');
const saMatch = indexCode.match(/const SERVICE_ACCOUNT\s*=\s*({[\s\S]*?\n})/);
const sa = eval('(' + saMatch[1] + ')');

async function getAdminToken() {
  const header = { alg: 'RS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const payload = { iss: sa.client_email, sub: sa.client_email, aud: sa.token_uri, iat: now, exp: now + 3600, scope: 'https://www.googleapis.com/auth/datastore' };
  const unsigned = Buffer.from(JSON.stringify(header)).toString('base64url') + '.' + Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sign = crypto.createSign('RSA-SHA256'); sign.update(unsigned);
  const signature = sign.sign(sa.private_key).toString('base64url');
  
  const res = await fetch(sa.token_uri, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${unsigned}.${signature}` });
  const data = await res.json();
  return data.access_token;
}

async function run() {
  try {
    const token = await getAdminToken();
    const projectId = sa.project_id;
    const baseUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;
    
    // 1. Get weekly_jackpot settings
    const jRes = await fetch(`${baseUrl}/events/weekly_jackpot`, { headers: { Authorization: `Bearer ${token}` } });
    const jackpot = await jRes.json();
    console.log("Weekly Jackpot Event Settings:");
    console.log(JSON.stringify(jackpot.fields, null, 2));

    // 2. Count total weeklyTickets in all wallets
    // The collection is 'wallets'
    // We cannot do a sum query easily, we can just fetch all wallets and sum them up
    // Just fetch first 500 wallets for a quick check.
    const wQuery = {
      structuredQuery: {
        from: [{ collectionId: 'wallets' }],
        limit: 1000
      }
    };
    const wRes = await fetch(`${baseUrl}:runQuery`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(wQuery) });
    const wallets = await wRes.json();
    
    let totalComputedTickets = 0;
    let walletsWithTickets = 0;
    let myTicketsExample = 0;
    
    for (const w of wallets) {
       if(!w.document) continue;
       const fields = w.document.fields;
       const tix = fields.weeklyTickets?.doubleValue || fields.weeklyTickets?.integerValue || 0;
       if (tix > 0) {
          totalComputedTickets += Number(tix);
          walletsWithTickets++;
          if (myTicketsExample === 0) myTicketsExample = Number(tix); // grab one example
       }
    }
    
    console.log(`\nComputed Total Tickets across ${wallets.length} wallets: ${totalComputedTickets}`);
    console.log(`Wallets with tickets > 0: ${walletsWithTickets}`);
    console.log(`Mismatch? Saved in DB = ${jackpot.fields?.totalTickets?.doubleValue || jackpot.fields?.totalTickets?.integerValue || 0} vs Computed = ${totalComputedTickets}`);

  } catch(e) {
    console.error(e);
  }
}
run();
