const fs = require('fs');

const file = 'public/static/js/api.js';
let code = fs.readFileSync(file, 'utf8');

// Replace createNews to call our new translation endpoint
const oldCreateNews = `  async createNews(adminId, newsData) {
    try {
      const ref = await addDoc(collection(this.db, 'news'), {
        ...newsData, createdBy: adminId, createdAt: serverTimestamp(), updatedAt: serverTimestamp()
      });
      return ok({ id: ref.id });
    } catch(e) { return err(e); }
  }`;

const newCreateNews = `  async createNews(adminId, newsData) {
    try {
      // 자동 번역 요청
      let translations = {};
      try {
        const res = await fetch('/api/translate/news', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            title: newsData.title || '', 
            summary: newsData.summary || '', 
            content: newsData.content || '' 
          })
        });
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.translations) {
            translations = data.translations;
          }
        }
      } catch (err) {
        console.error('News translation API error:', err);
      }

      const ref = await addDoc(collection(this.db, 'news'), {
        ...newsData, 
        // 번역 데이터 병합
        title_en: translations.title_en || '',
        title_vi: translations.title_vi || '',
        title_th: translations.title_th || '',
        summary_en: translations.summary_en || '',
        summary_vi: translations.summary_vi || '',
        summary_th: translations.summary_th || '',
        content_en: translations.content_en || '',
        content_vi: translations.content_vi || '',
        content_th: translations.content_th || '',
        translatedAt: (translations.title_en) ? serverTimestamp() : null,
        
        createdBy: adminId, 
        createdAt: serverTimestamp(), 
        updatedAt: serverTimestamp()
      });
      return ok({ id: ref.id });
    } catch(e) { return err(e); }
  }`;

code = code.replace(oldCreateNews, newCreateNews);

fs.writeFileSync(file, code, 'utf8');
