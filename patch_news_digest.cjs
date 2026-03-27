const fs = require('fs');

let code = fs.readFileSync('src/index.tsx', 'utf8');

// We need to inject a translation step into /api/news-digest

const replacement = `
// ─── News Digest Cache ──────────────────────────────────────────────────────────
let _newsCache: { ts: number, items: any[] } | null = null

app.get('/api/news-digest', async (c) => {
  try {
    const now = Date.now()
    if (_newsCache && now - _newsCache.ts < 3600_000) {
      return c.json({ items: _newsCache.items, cached: true })
    }

    const rssUrl = 'https://kr.cointelegraph.com/rss';
    const resp = await fetch(rssUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    if (!resp.ok) return c.json({ items: [] });
    
    const xml = await resp.text();
    const items = [];
    const itemRegex = /<item>([\\s\\S]*?)<\\/item>/g;
    let match;
    while ((match = itemRegex.exec(xml)) !== null) {
      if (items.length >= 10) break; 
      const itemStr = match[1];
      
      const titleMatch = itemStr.match(/<title><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/title>/) || itemStr.match(/<title>([\\s\\S]*?)<\\/title>/);
      const linkMatch = itemStr.match(/<link><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/link>/) || itemStr.match(/<link>([\\s\\S]*?)<\\/link>/);
      const descMatch = itemStr.match(/<description><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/description>/) || itemStr.match(/<description>([\\s\\S]*?)<\\/description>/);
      const dateMatch = itemStr.match(/<pubDate>([\\s\\S]*?)<\\/pubDate>/);
      
      if (titleMatch && linkMatch) {
        let desc = descMatch ? descMatch[1].replace(/<[^>]*>?/gm, '').trim() : '';
        if (desc.length > 150) desc = desc.substring(0, 150) + '...';
        
        items.push({
          title: titleMatch[1].trim(),
          link: linkMatch[1].trim(),
          description: desc,
          pubDate: dateMatch ? dateMatch[1].trim() : ''
        });
      }
    }

    // Translate items in background or sequentially (limit to 10 so it's not too heavy)
    const env = c.env as any;
    const apiKey = env.OPENAI_API_KEY || '';
    
    for (const item of items) {
       // translate title
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
    }

    _newsCache = { ts: now, items }
    return c.json({ items });
  } catch (err) {
    console.error('RSS Fetch error:', err);
    return c.json({ items: [] }, 500);
  }
})
`;

code = code.replace(/app\.get\('\/api\/news-digest', async \(c\) => \{[\s\S]*?return c\.json\(\{ items: \[\] \}, 500\);\n  \}\n\}\)/, replacement.trim());

fs.writeFileSync('src/index.tsx', code);
console.log("Patched news-digest");
