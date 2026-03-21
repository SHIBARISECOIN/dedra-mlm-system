const fs = require('fs');
const crypto = require('crypto');

// Reuse the SERVICE_ACCOUNT and Firebase initialization method we used for the rollback
const SERVICE_ACCOUNT = {
  type: "service_account",
  project_id: "dedra-mlm",
  private_key_id: "9bf051a4b3416458b8e7b18da5f51565fd5bad13",
  private_key: "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDHDCXJD5NzOPky\nFXAvvKNIDLfXKMGN1D1uQNhkkSt7kJpRUTbwCgy2tWwMATiynGegHk4MTjYUbZNG\nPQJ3vTt615ngAafyJnmV0JYRP5XWnSyOO1zTrJgtdksFphTOboOvnUIbXVkslK81\nBDjcvLu2/h8+Tkay7p4SEMHLr7Z5Esyj2wjIJ7k+ym1Yu7cvSUk1lwvFLvzij2mg\nZhtTH0axM+HZbxJhBkuVS1iGh6n4uoiWv9xGvzdbO9GSLzTutP2qqzLlXbnZUGG3\nOQ4XiArjTtKAEptNXdeq64CGUdFKjky3nU5RiZg5/b4eSV+j3I2giexEtKDdVIat\novieZ5o/AgMBAAECggEABlkC03ilsST9/XTlkQApDOEq87efBJDiLKPwwrRGeLhR\n04oNgHYxlZoPigp37mpCe767qnTMELa13aWQcJUeUnqRs60Z2AUWF4sBXidy9dcp\nVpfaC/4TFFATcGitfS/VD0KqmwjNETjkpYIu9gsmyV0tTeVdJ9OoQtc59u7xmMbM\nOPhW9CM4TRxVHHsZCgO+BH7jmW2guidEcLoBxjfNftt6euanvKhytTDQRZiuKFvp\nBOwZpm1s+moWDvnoKu36JWw8oXuWI3SDLX/eyIO/NwnSpQE9wnXiyyOYxnTN8eHz\nJW2214Xk5LjkHEbEvbWQbCq9hxXnW7vZxLt6ynI4QQKBgQD7N4IV1NP3qp3zMzPy\nCkABSWtn5iYFCkTp27mIj2y4/3Fhm/bnVJjFeLUvpK2xirqq7ZeBQXp3hxG2LLqz\nmTXwMC0zUvLrZam7Zu1ReYaWgMxTgfsH1uQ5jsGEsDyGwRxCt8o0nlvHfunmotlf\nePipGuRkpcAZCw4pnLFUHihAsQKBgQDK1lptoAOYYeBDLB59Ov0HOD86ALEAsNm8\nxJ6MXhWPFViB6JGRSaYw53xCEIZ2tcTnHOTqwcSzHA6cnRGjxewuIkD+Iu0uHB1i\nsuSRNZS35uoo55F7AHClFroKSInZw4SH/j/WLhEaJenZTIoWpZX5YMH8AYFWYXAS\nCDeE6HvF7wKBgQCX7N/c+BMgyqwvMh4OGKjQnmg4M3V2wtkeXOV9cs+bqdAV6c6N\n5BloAzIAGCV7I5z0Vi+z2beIpcTOWYqnptZ55YjQay/BsH/Pd9W52jbMuiPXtNnt\nycXIEU9zQWm5TPwcVS4SWFrE8TnfY0j2diBblInfXGYqPwdXnw2XA43wYQKBgAXV\nhoJSsOfIIOgts67MbIyxnHfxnyWy8IBSc3D8H8iex43s/4rbQHF1pwhLa2Kstb4k\nAZ2S9zJjozPz/JbmUXW+PHpSzNmfq2S0WoimruFfPerxRijwiUzmS3GSRozB5+T1\ndiaV6p4C6yf54JroJlkm5E14SZ0PbmbGX7pt6Wl3AoGAMFPzfuIOGOZB33VFlB5A\n2ZtzoAvHTrR1Bp0akIrlWTY/kfk/7Qdd12SBjSGojuUzn3y94eQNTi+ii2N3V3iI\nTK3jMrCYCsfP2hle9yefv/3uRezf7B7oS4HgtsXSEf9/UUGZkxJQWuxcbv7kqkuv\n/8sWFeugmhHf2e0McHKYqvs=\n-----END PRIVATE KEY-----\n",
  client_email: "firebase-adminsdk-fbsvc@dedra-mlm.iam.gserviceaccount.com",
  client_id: "103096684164693920388",
  token_uri: "https://oauth2.googleapis.com/token",
  project_id_full: "dedra-mlm"
};

async function getAdminToken() {
  const account = SERVICE_ACCOUNT;
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: account.client_email, sub: account.client_email, aud: account.token_uri,
    iat: now, exp: now + 3600, scope: 'https://www.googleapis.com/auth/datastore'
  };
  const b64url = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  const sigInput = `${b64url(header)}.${b64url(payload)}`;
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(sigInput);
  const signature = signer.sign(account.private_key, 'base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  const res = await fetch(account.token_uri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${sigInput}.${signature}`
  });
  return (await res.json()).access_token;
}

const PROJECT_ID = 'dedra-mlm';

async function fsCreateDoc(collection, fields, token) {
  const firestoreFields = {};
  for (const [k, v] of Object.entries(fields)) {
    if (typeof v === 'number') {
      firestoreFields[k] = { doubleValue: v };
    } else if (typeof v === 'string') {
      firestoreFields[k] = { stringValue: v };
    } else if (typeof v === 'boolean') {
      firestoreFields[k] = { booleanValue: v };
    }
  }
  
  await fetch(`https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/${collection}`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: firestoreFields })
  });
}

// These are the exact 22 users who got deductions in the previous rollback step
const targetUserIds = [
  "rlSK0MotrUT1AbEXlSAmolfKpZ42", "2VF2A5O7hmM1H8IMJ9owvmcFWPF2", "GnfPCaAcRrMGRyfJrN7JlfRFUaw1",
  "pgUN1pS3cSUwzPYc5DjHKMZWIbE2", "KM7pKoYx4lM2gUt1wKPgT2rl57M2", "pQn9ml9ZTQVwe9DB0fiZ4broX9S2",
  "qAdGKU772oVGZ0B5PwUEbL3UqSF3", "uJI1ZziaxURPoSVylynzGEUIl5c2", "mASiMXombJcKhFYZkWKbw9HpwKf2",
  "Dtofn4aFQlevbVPfGOS4atv0lWv2", "RWCh7evtfORARAL6UbNfdVMeI973", "9DNQp8dkZkU4gYTLA6TNGFgwBJa2",
  "KCW3x31OLnOVwz7nKuWShRAIy0m2", "LpH4omYIZROyPnGYTHtzB1d3hBx1", "g6d09RbIXGdi74mElN5roqnXX9u2",
  "6itIfzuBRmRASn2PrRaknINJ3cu1", "zeX6ExUTaPRsSGiixqpf9mHkjRq1", "ZJuISIi7UySgxNtQgA0uEXIzavp1",
  "4oljjUZeNXaIw6Qzi7oQgKwL5Tt1", "ut2U6vFHJsha4D2soUjxlhOITGc2", "E9aXICeKxIOpLYyMcTnDkel5WMy1",
  "zRdWqMkTO3MjBM560mqSYYZJtz93"
];

async function run() {
  try {
    const token = await getAdminToken();
    console.log("Token acquired, sending messages to 22 affected users...");
    
    const messageTitle = "[안내] 판권 매칭 보너스 정산 오류 및 지갑 잔액 정정 안내";
    const messageBody = `안녕하세요. 디드라 시스템 관리자입니다.

최근 판권 매칭 보너스(네트워크 보수) 지급 시스템의 로직 업데이트 과정에서, 매칭 요율이 상위로 올라갈수록 중복/과다 계산되어 지갑 잔액(Bonus Balance)이 실제 수당보다 더 높게 표기되는 시스템 표기 오류가 발생했습니다.

해당 오류는 금일 긴급 점검을 통해 본래의 정상적인 '직급 간 차액 보상 플랜' 로직으로 완전히 복구되었습니다. 이에 따라 회원님의 지갑에 비정상적으로 과다 지급되었던 판권 매칭 보너스 내역들을 일괄 취소(삭제) 처리하였으며, 지갑 잔액 또한 실제 정당한 수치로 차감(정정) 조치하였음을 안내해 드립니다.

(순수 투자 원금에 대한 데일리 이자 및 다른 정상적인 직추천 보너스는 아무 문제 없이 정상 지급되고 있으니 안심하셔도 됩니다.)

시스템 이용에 혼선을 드려 대단히 죄송하며, 앞으로 더욱 안정적인 서비스 제공을 위해 최선을 다하겠습니다. 감사합니다.`;

    let sentCount = 0;
    
    for (const uid of targetUserIds) {
      // Assuming 'messages' or 'notifications' collection exists. We will use 'messages'.
      await fsCreateDoc('messages', {
        userId: uid,
        title: messageTitle,
        content: messageBody,
        isRead: false,
        createdAt: new Date().toISOString(),
        type: 'system'
      }, token);
      
      sentCount++;
      console.log(`Sent message to user ${uid} (${sentCount}/22)`);
    }
    
    console.log(`\nSuccessfully sent individual messages to all ${sentCount} users.`);
    
  } catch(e) {
    console.error("Error:", e);
  }
}

run();
