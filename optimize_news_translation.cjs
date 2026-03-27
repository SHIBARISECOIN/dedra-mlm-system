const fs = require('fs');

let code = fs.readFileSync('src/index.tsx', 'utf8');

const replacement = `
    const env = c.env as any;
    
    // Batch translation to save time
    const translateAll = async (text: string) => {
      if (!text) return { en: '', vi: '', th: '' };
      const [en, vi, th] = await Promise.all([
        translateText(text, 'en'),
        translateText(text, 'vi'),
        translateText(text, 'th')
      ]);
      return { en, vi, th };
    };

    await Promise.all(items.map(async (item) => {
       const [t_trans, d_trans] = await Promise.all([
         translateAll(item.title),
         translateAll(item.description)
       ]);
       
       item.title_en = t_trans.en || item.title;
       item.title_vi = t_trans.vi || item.title;
       item.title_th = t_trans.th || item.title;
       
       item.description_en = d_trans.en || item.description;
       item.description_vi = d_trans.vi || item.description;
       item.description_th = d_trans.th || item.description;
    }));

    _newsCache = { ts: now, items }
    return c.json({ items });
`;

// replace from `const env = c.env as any;` up to `return c.json({ items });`
code = code.replace(/const env = c\.env as any;[\s\S]*?return c\.json\(\{ items \}\);/, replacement.trim());

fs.writeFileSync('src/index.tsx', code);
console.log("Optimized translation");
