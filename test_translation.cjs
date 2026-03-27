const admin = require('firebase-admin');
const fs = require('fs');

async function testTranslation() {
  const key = JSON.parse(fs.readFileSync('/home/user/webapp/service-account.json', 'utf8'));
  if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(key) });
  const db = admin.firestore();
  
  const snap = await db.collection('announcements').doc('FTigVe3NgMtkVaFodgWI').get();
  const notice = snap.data();
  console.log('Original length:', notice.content.length);

  const targets = ['en', 'vi', 'th'];
  let updates = {};

  for (const lang of targets) {
    const langMap = { en: 'en', vi: 'vi', th: 'th' };
    const targetCode = langMap[lang];
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=ko&tl=${targetCode}&dt=t&q=${encodeURIComponent(notice.content)}`;
    
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      if (data && data[0]) {
        const translatedContent = data[0].map(item => item[0]).join('');
        console.log(`Translated [${lang}] length:`, translatedContent.length);
        updates[`content_${lang}`] = translatedContent;
      }
    }
    
    // Also do title just in case it's missing or to be safe
    const urlTitle = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=ko&tl=${targetCode}&dt=t&q=${encodeURIComponent(notice.title)}`;
    const resTitle = await fetch(urlTitle);
    if (resTitle.ok) {
      const dataTitle = await resTitle.json();
      if (dataTitle && dataTitle[0]) {
         updates[`title_${lang}`] = dataTitle[0].map(item => item[0]).join('');
      }
    }
  }

  await snap.ref.update(updates);
  console.log('Updated translation in DB.');
}

testTranslation().catch(console.error);
