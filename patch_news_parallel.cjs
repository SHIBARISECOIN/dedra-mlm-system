const fs = require('fs');
let code = fs.readFileSync('src/index.tsx', 'utf8');

const oldCode = `    // 빠른 응답을 위해 번역 수행 (Google Translate API)
    for (const item of items) {
       // translate title and description
       const title_en = await translateText(item.title, 'en');
       const title_vi = await translateText(item.title, 'vi');
       const title_th = await translateText(item.title, 'th');
       
       const desc_en = await translateText(item.description, 'en');
       const desc_vi = await translateText(item.description, 'vi');
       const desc_th = await translateText(item.description, 'th');
       
       item.title_en = title_en || item.title;
       item.title_vi = title_vi || item.title;
       item.title_th = title_th || item.title;
       
       item.description_en = desc_en || item.description;
       item.description_vi = desc_vi || item.description;
       item.description_th = desc_th || item.description;
    }`;

const newCode = `    // 병렬로 번역 수행 (속도 향상)
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
    }));`;

code = code.replace(oldCode, newCode);
fs.writeFileSync('src/index.tsx', code);
console.log('patched parallel');
