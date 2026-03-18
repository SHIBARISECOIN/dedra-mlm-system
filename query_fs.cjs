const { readFileSync } = require('fs');

async function run() {
    const crypto = require('crypto');
    const btoa = (str) => Buffer.from(str).toString('base64');
    
    const code = readFileSync('src/index.tsx', 'utf8');
    const saMatch = code.match(/const SERVICE_ACCOUNT = ({[\s\S]+?})/);
    if (!saMatch) { console.log('no SA'); return; }
    
    const SERVICE_ACCOUNT = eval('(' + saMatch[1] + ')');
    
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
    const encHeader = btoa(JSON.stringify(header)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
    const encPayload = btoa(JSON.stringify(payload)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
    const unsignedToken = encHeader + "." + encPayload;
    
    const privateKey = SERVICE_ACCOUNT.private_key;
    const sign = crypto.createSign('RSA-SHA256');
    sign.update(unsignedToken);
    const signature = sign.sign(privateKey, 'base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    
    const jwt = unsignedToken + "." + signature;
    
    const res = await fetch(SERVICE_ACCOUNT.token_uri, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: "grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=" + jwt
    });
    const data = await res.json();
    const token = data.access_token;
    
    const FIRESTORE_BASE = "https://firestore.googleapis.com/v1/projects/" + SERVICE_ACCOUNT.project_id_full + "/databases/(default)/documents";
    
    const qRes = await fetch(FIRESTORE_BASE + ":runQuery", {
        method: 'POST',
        headers: { Authorization: "Bearer " + token, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            structuredQuery: { from: [{ collectionId: 'products' }], limit: 100 }
        })
    });
    
    const prods = await qRes.json();
    prods.filter(r => r.document).forEach(p => {
        console.log(p.document.name, JSON.stringify(p.document.fields));
    });
}
run();
