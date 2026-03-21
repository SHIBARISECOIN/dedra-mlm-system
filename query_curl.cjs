const SERVICE_ACCOUNT = {
  project_id: "dedra-mlm",
  private_key: process.env.FIREBASE_PRIVATE_KEY || `-----BEGIN PRIVATE KEY-----\nMIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQDE2u5iT6K6e5F8\ny0QeS8gG4p+Y2+bUqj+8xTjU/m8T2/n3x3V/O6J6Y2B+8M7v2b2j4s7V/7VzQ4n+\nuP+N2t/B1F6k/8X6w/2T1m6Z9F9l6/0+z5/w8J3d/j4I6V+U3Y6n/M6R/2b7I+S+\nu+U/2W1Y9g0b+P2v2M5D1k/C+I9N0v8b+w/M4w3z/S+I2f0W7Z/I/2I7w9m4I/P\nuP2e2N/Y/M2b/Y2c/P4v/E8I/K2x/w+X+O/P/Q/T/Q4O/P9D/P/W9I3J4z/2M9I/\nP8c4M3P/P4e/P/M4e/Q8O2K/M/P4e+P/L+T/L/M4Z/R+K+C/M+M4P/D4P4O/Q/Q/\nP4E/L4D7AgMBAAECggEAf+L8w/z+c4K+c3M2I7m4D/J7O6H/O3K2b9n8M+e8P/B\nuM6M7O6P/Q/C7P8G+J8R4D+M7O3J6e5M8I+L9K9O2M5J3P/K9L8P/I+O4R+M+C/\nL3P4H/M7C+M+T+E4D/N6P9N4P+J5M6M/D3K4P4P+L+O4J4I/M4D/C4P9O4P+K/\nL4O/J4P+M/D+C/H+J8O+P/C+P+P/C+I+L/C/O4O4R4P/N+O4M+J4O+L+M4J+C/\nL4O4M4P+O4P/K+O4P+K4O/O4P4J+N4D+P4P+K/N4D4P4P+N/P4O+J+O4M+C/O4\nP4P+D+K/J4D4P/O+J+J/J/O4D4P+D+O/P/K+J+J+N4D/C/P+D+O4P+P/O4D+K/\nM4D+J+M4P+K4M4D4P+K4D4J4P4D4P/J4D4D+P4M4D4P/J/O4D/C4O4P4P+K/N\n-----END PRIVATE KEY-----\n`.replace(/\\n/g, '\n'),
  client_email: "firebase-adminsdk-fbsvc@dedra-mlm.iam.gserviceaccount.com",
  token_uri: "https://oauth2.googleapis.com/token"
};

async function getAdminToken() {
  const jwt = require('jsonwebtoken');
  const payload = {
    iss: SERVICE_ACCOUNT.client_email,
    sub: SERVICE_ACCOUNT.client_email,
    aud: SERVICE_ACCOUNT.token_uri,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
    scope: 'https://www.googleapis.com/auth/datastore https://www.googleapis.com/auth/identitytoolkit'
  };
  const token = jwt.sign(payload, SERVICE_ACCOUNT.private_key, { algorithm: 'RS256' });
  const res = await fetch(SERVICE_ACCOUNT.token_uri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${token}`
  });
  const data = await res.json();
  return data.access_token;
}

async function run() {
  const token = await getAdminToken();
  console.log(token);
}
run();
