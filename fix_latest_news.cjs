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
  'TP78IcLryfky1EgA4fUF': {
    title_en: "Boris Johnson Suspects Bitcoin as 'Ponzi Scheme'... Industry Pushes Back",
    summary_en: "While President Trump sends messages of crypto deregulation, former UK PM Boris Johnson likened Bitcoin to a 'Ponzi scheme', sparking immediate rebuttal from the crypto industry.",
    title_vi: "Boris Johnson nghi ngờ Bitcoin là 'mô hình Ponzi'... Ngành công nghiệp phản bác",
    title_th: "Boris Johnson สงสัยว่า Bitcoin เป็น 'แชร์ลูกโซ่'... วงการคริปโตโต้กลับ"
  },
  '7kFyyENNJKe88spBJhtg': {
    title_en: "Bitmain Purchases an Additional 5,000 ETH via OTC Deal with the Ethereum Foundation",
    summary_en: "Bitmain Immersion Technologies has gained market attention by purchasing an additional 5,000 ETH through an Over-The-Counter (OTC) transaction directly from the Ethereum Foundation.",
    title_vi: "Bitmain mua thêm 5.000 ETH thông qua giao dịch OTC với Ethereum Foundation",
    title_th: "Bitmain ซื้อ 5,000 ETH เพิ่มเติมผ่านการทำธุรกรรม OTC กับ Ethereum Foundation"
  },
  'g5pOVWQYkNi9TLcKWYI9': {
    title_en: "IREN Stock Sees Slight Gain Despite Aggressive AI Infrastructure Expansion Strategy",
    summary_en: "IREN's stock experienced a slight increase despite its aggressive AI infrastructure expansion strategy, continuing to draw attention in the mining and Bitcoin-related equity market.",
    title_vi: "Cổ phiếu IREN tăng nhẹ bất chấp chiến lược mở rộng cơ sở hạ tầng AI",
    title_th: "หุ้น IREN ปรับตัวขึ้นเล็กน้อยแม้จะมีกลยุทธ์ขยายโครงสร้างพื้นฐาน AI"
  },
  'qR44gO2nDntGCcezHhS6': {
    title_en: "Circle Expands Stablecoin Market Share Amid Surging Stock Volatility",
    summary_en: "Circle Internet Group closed higher amidst significant stock market volatility, steadily increasing its stablecoin market share and proving its robust financial standing.",
    title_vi: "Circle mở rộng thị phần stablecoin giữa bối cảnh biến động cổ phiếu",
    title_th: "Circle ขยายส่วนแบ่งตลาด Stablecoin ท่ามกลางความผันผวนของตลาดหุ้น"
  },
  'FGurLFKwWiSVux1WE13o': {
    title_en: "Boris Johnson's 'Bitcoin Ponzi' Remark... Crypto Industry Argues \"The Structure Is Different\"",
    summary_en: "Following Boris Johnson's controversial comparison of Bitcoin to a 'massive Ponzi scheme', crypto experts are strongly arguing that the fundamental structure of BTC is completely different.",
    title_vi: "Phát ngôn 'Bitcoin Ponzi' của Boris Johnson... Ngành công nghiệp tranh luận \"Cấu trúc khác biệt\"",
    title_th: "คำกล่าว 'Bitcoin Ponzi' ของ Boris Johnson... วงการคริปโตแย้ง \"โครงสร้างแตกต่างกัน\""
  },
  'Icr6tVvciurU3qEW0RAW': {
    title_en: "Potential for Major Price Movement if XRP Breaks Through the $1.48 Resistance Level",
    summary_en: "XRP is currently searching for direction within a technical consolidation phase. Traders are watching closely as breaking the critical $1.48 resistance could trigger significant volatility.",
    title_vi: "Khả năng biến động giá mạnh nếu XRP vượt qua ngưỡng kháng cự 1,48 USD",
    title_th: "แนวโน้มการเคลื่อนไหวของราคาหาก XRP ทะลุแนวต้านที่ 1.48 ดอลลาร์"
  },
  'rSaYEXkxYcBkd0EXJyyL': {
    title_en: "[KOL Index] \"AAVE Just Needs to Hold $109\" Focuses Community... Altcoin Long/Short Signals Surge",
    summary_en: "According to the latest KOL index, the crypto community is heavily focused on AAVE maintaining its $109 support level, amidst a surge of 'Extreme Fear' briefings and conflicting altcoin signals.",
    title_vi: "[Chỉ số KOL] \"AAVE chỉ cần giữ mốc 109 USD\" Cộng đồng chú ý... Tín hiệu Long/Short Altcoin tăng vọt",
    title_th: "[ดัชนี KOL] \"AAVE แค่ต้องรักษาระดับ 109 ดอลลาร์\" ชุมชนให้ความสนใจ... สัญญาณ Long/Short เพิ่มสูงขึ้น"
  },
  'Mo8pF7qkiLxaueYRG6Bc': {
    title_en: "[Market Analysis] Navigating the Rapidly Shifting Global ETF Market: Strategies for Investors",
    summary_en: "As geopolitical tensions such as the US-Iran conflict trigger a risk-off mood in New York, investors are looking for new strategies to navigate the rapidly changing global ETF landscape.",
    title_vi: "[Phân tích thị trường] Khám phá thị trường ETF toàn cầu đang thay đổi nhanh chóng: Chiến lược cho nhà đầu tư",
    title_th: "[วิเคราะห์ตลาด] การปรับตัวในตลาด ETF ระดับโลกที่เปลี่ยนแปลงอย่างรวดเร็ว: กลยุทธ์สำหรับนักลงทุน"
  },
  'CEtODKnuxHezj1D9LgDz': {
    title_en: "Solana (SOL) Plunges 5.17%, Breaking Key Resistance Becomes Crucial Factor",
    summary_en: "Solana experienced a sharp 5.17% decline, pushing the price down to the $87 range. Market analysts emphasize that breaking key resistance levels will be crucial for recovery.",
    title_vi: "Solana (SOL) lao dốc 5,17%, Vượt qua ngưỡng kháng cự chính là yếu tố then chốt",
    title_th: "Solana (SOL) ร่วงลง 5.17% การทะลุแนวต้านสำคัญเป็นปัจจัยสำคัญ"
  },
  'umdijce2C4IJd8D4aZ0C': {
    title_en: "Boris Johnson Takes Aim at Bitcoin as a 'Ponzi Scheme'... Michael Saylor Counters",
    summary_en: "Former British PM Boris Johnson bluntly stated that Bitcoin seemed like a giant Ponzi scheme from the start, prompting MicroStrategy's Michael Saylor to strongly defend its unique structure.",
    title_vi: "Boris Johnson nhắm mục tiêu vào Bitcoin là 'Mô hình Ponzi'... Michael Saylor phản bác",
    title_th: "Boris Johnson โจมตี Bitcoin ว่าเป็น 'แชร์ลูกโซ่'... Michael Saylor โต้แย้ง"
  }
};

(async () => {
  try {
    const jwt = createJwt(SERVICE_ACCOUNT);
    const token = await getAccessToken(jwt);
    const projectId = SERVICE_ACCOUNT.project_id;
    
    for (const [docId, data] of Object.entries(updates)) {
      await updateFirestoreDoc(token, projectId, docId, data);
      console.log('Updated real latest news', docId);
    }
    console.log("Done updating latest news.");
  } catch(e) {
    console.error(e);
  }
})();
