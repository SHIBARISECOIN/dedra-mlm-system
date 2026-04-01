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
    
    // Aggregation query to count users
    const query = {
      structuredAggregationQuery: {
        aggregations: [{ count: { upTo: 5000 } }],
        structuredQuery: {
          from: [{ collectionId: 'users' }]
        }
      }
    };
    
    const countRes = await fetch(`${baseUrl}:runAggregationQuery`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(query)
    });
    
    const countData = await countRes.json();
    console.log("총 회원수:", countData[0]?.result?.aggregateFields?.count_1?.integerValue || countData[0]?.result?.aggregateFields?.['count']?.integerValue || countData);
    
    const queryWallets = {
      structuredAggregationQuery: {
        aggregations: [{ count: { upTo: 5000 } }],
        structuredQuery: {
          from: [{ collectionId: 'wallets' }]
        }
      }
    };
    
    const countResW = await fetch(`${baseUrl}:runAggregationQuery`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(queryWallets)
    });
    
    const countDataW = await countResW.json();
    console.log("지갑 보유자 수:", countDataW);

  } catch(e) {
    console.error(e);
  }
}
run();
