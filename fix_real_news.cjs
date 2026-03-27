const https = require('https');
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

function base64urlurlEncode(str) {
  return Buffer.from(str).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function createJwt(serviceAccount) {
  const header = { alg: 'RS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const claim = {
    iss: serviceAccount.client_email,
    scope: 'https://www.googleapis.com/auth/datastore',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now
  };

  const signatureInput = base64urlurlEncode(JSON.stringify(header)) + '.' + base64urlurlEncode(JSON.stringify(claim));
  const crypto = require('crypto');
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(signatureInput);
  const signature = signer.sign(serviceAccount.private_key, 'base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  
  return signatureInput + '.' + signature;
}

function getAccessToken(jwt) {
  return new Promise((resolve, reject) => {
    const data = 'grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=' + jwt;
    const req = https.request({
      hostname: 'oauth2.googleapis.com',
      path: '/token',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': data.length
      }
    }, res => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => resolve(JSON.parse(body).access_token));
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function updateFirestoreDoc(token, projectId, docId, updates) {
  return new Promise((resolve, reject) => {
    const fields = {};
    for (const [k, v] of Object.entries(updates)) {
      if (typeof v === 'string') fields[k] = { stringValue: v };
      else if (typeof v === 'boolean') fields[k] = { booleanValue: v };
    }
    
    const updateMask = Object.keys(updates).map(k => `updateMask.fieldPaths=${k}`).join('&');
    const path = `/v1/projects/${projectId}/databases/(default)/documents/news/${docId}?${updateMask}`;
    
    const req = https.request({
      hostname: 'firestore.googleapis.com',
      path: path,
      method: 'PATCH',
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json'
      }
    }, res => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => resolve(JSON.parse(body)));
    });
    req.on('error', reject);
    req.write(JSON.stringify({ fields }));
    req.end();
  });
}

const updates = {
  'Hej1EodEjfhhPFDY6RkN': {
    title_en: "[Member Notice] The crypto market is making big moves again",
    summary_en: "Recent trends in the cryptocurrency market indicate another major shift is underway. Investors should stay informed on the latest developments.",
    title_vi: "[Thông báo] Thị trường tiền điện tử đang có những động thái lớn",
    title_th: "[ประกาศ] ตลาด tiền điện tử กำลังเคลื่อนไหวครั้งใหญ่อีกครั้ง"
  },
  'BwPYfjDzEQLg1aeGINW7': {
    title_en: "Bitcoin hits new lows amid war headlines... Safe-haven debate reignites",
    summary_en: "With geopolitical tensions rising, Bitcoin's status as a 'safe-haven' asset is being tested again amidst market volatility.",
    title_vi: "Bitcoin chạm đáy mới giữa các tin tức chiến tranh... Cuộc tranh luận về tài sản trú ẩn an toàn lại bùng lên",
    title_th: "Bitcoin ทำสถิติต่ำสุดใหม่ท่ามกลางข่าวสงคราม... การถกเถียงเรื่องสินทรัพย์ปลอดภัยกลับมาอีกครั้ง"
  },
  'CadTgsEERRAEEeaLCb2S': {
    title_en: "[Afternoon Market Briefing] Crypto market mixed... Bitcoin at $71,460, Ethereum at $2,102",
    summary_en: "A mixed trading session as Bitcoin hovers around $71,460 while Ethereum trades near $2,102.",
    title_vi: "[Tóm tắt thị trường chiều] Thị trường tiền điện tử trái chiều... Bitcoin ở mức 71.460 USD, Ethereum ở mức 2.102 USD",
    title_th: "[สรุปตลาดช่วงบ่าย] ตลาดคริปโตผสมผสาน... Bitcoin อยู่ที่ 71,460 ดอลลาร์, Ethereum ที่ 2,102 ดอลลาร์"
  },
  'Q6sMHGid8leD2aV7sr7c': {
    title_en: "[Afternoon News Briefing] Iranian government announces opening of Strait of Hormuz, and more",
    summary_en: "Key geopolitical updates including the Iranian government's announcement regarding the Strait of Hormuz.",
    title_vi: "[Tóm tắt tin tức chiều] Chính phủ Iran thông báo mở cửa eo biển Hormuz và các tin tức khác",
    title_th: "[สรุปข่าวบ่าย] รัฐบาลอิหร่านประกาศเปิดช่องแคบฮอร์มุซ และอื่นๆ"
  },
  'c9PMbzzkmwdyLj92Kns1': {
    title_en: "[Coin in Focus] Official Trump (TRUMP) Fear & Greed at 91 'Extreme Greed'... Trading volume reaches 253B KRW",
    summary_en: "TRUMP coin surges to 5,900 KRW range with massive trading volume, marking an 'Extreme Greed' sentiment index of 91.",
    title_vi: "[Coin tiêu điểm] Official Trump (TRUMP) Sợ hãi & Tham lam ở mức 91 'Cực kỳ tham lam'... Khối lượng giao dịch đạt 253 tỷ KRW",
    title_th: "[เหรียญที่น่าจับตามอง] Official Trump (TRUMP) ความกลัวและความโลภที่ 91 'โลภมาก'... ปริมาณการซื้อขายแตะ 25.3 หมื่นล้านวอน"
  },
  'kox0LTT0OslG9zR9CTVy': {
    title_en: "[Crypto Trend Analysis] Wealthy funds flowing into BTC/ETH, Altcoins show 'bottom signals' with RSI near 10%",
    summary_en: "Institutional money is pouring into Bitcoin and Ethereum, while heavily oversold altcoins present potential bottom signals.",
    title_vi: "[Phân tích xu hướng] Dòng tiền chảy vào BTC/ETH, Altcoin cho thấy 'tín hiệu đáy' với RSI gần 10%",
    title_th: "[วิเคราะห์แนวโน้มคริปโต] เงินทุนไหลเข้า BTC/ETH, Altcoins แสดง 'สัญญาณจุดต่ำสุด' ด้วย RSI ใกล้ 10%"
  },
  'Ou5CLrw9fybSGdjQ4Qos': {
    title_en: "Boris Johnson calls Bitcoin a 'Ponzi scheme'... Saylor counters 'It's fundamentally different'",
    summary_en: "Former UK PM Boris Johnson criticizes Bitcoin, prompting strong pushback from Michael Saylor regarding its structural differences.",
    title_vi: "Boris Johnson gọi Bitcoin là 'mô hình Ponzi'... Saylor phản bác 'Nó hoàn toàn khác biệt'",
    title_th: "Boris Johnson เรียก Bitcoin ว่า 'แชร์ลูกโซ่'... Saylor โต้แย้ง 'มันแตกต่างอย่างสิ้นเชิง'"
  },
  'qk1i5zx4hwC8EkLNp2k5': {
    title_en: "Solana (SOL) drops 5.17%, breaking key resistance is crucial",
    summary_en: "Solana experiences a sudden 5.17% drop as traders watch closely for it to break through major resistance levels.",
    title_vi: "Solana (SOL) giảm 5,17%, việc phá vỡ ngưỡng kháng cự chính là rất quan trọng",
    title_th: "Solana (SOL) ร่วง 5.17% การทะลุแนวต้านสำคัญเป็นสิ่งสำคัญ"
  },
  'u4z1SapCtv7VfPPMxY7I': {
    title_en: "[Market Analysis] The rapidly changing global ETF market, investor response strategies",
    summary_en: "An in-depth look at how the global ETF landscape is shifting and how investors should strategize accordingly.",
    title_vi: "[Phân tích thị trường] Thị trường ETF toàn cầu thay đổi nhanh chóng, chiến lược phản ứng của nhà đầu tư",
    title_th: "[วิเคราะห์ตลาด] ตลาด ETF ทั่วโลกที่เปลี่ยนแปลงอย่างรวดเร็ว, กลยุทธ์การตอบสนองของนักลงทุน"
  },
  'j0HmG91vdSUFnLuCtaHe': {
    title_en: "[KOL Index] 'AAVE just needs to hold $109' Community focus... 'Extreme Fear' spreading amid altcoin signals",
    summary_en: "Market influencers highlight AAVE's critical support at $109 as altcoin trading signals reflect an atmosphere of extreme fear.",
    title_vi: "[Chỉ số KOL] 'AAVE chỉ cần giữ mức 109 USD' Cộng đồng chú ý... Nỗi sợ hãi tột độ lan rộng",
    title_th: "[ดัชนี KOL] 'AAVE แค่ต้องรักษาระดับ $109' ชุมชนให้ความสนใจ... ความกลัวสุดขีดแพร่กระจาย"
  }
};

(async () => {
  try {
    const jwt = createJwt(SERVICE_ACCOUNT);
    const token = await getAccessToken(jwt);
    const projectId = SERVICE_ACCOUNT.project_id;
    
    for (const [docId, data] of Object.entries(updates)) {
      await updateFirestoreDoc(token, projectId, docId, data);
      console.log('Updated news', docId);
    }
    console.log("Done updating news.");
  } catch(e) {
    console.error(e);
  }
})();
