const fs = require('fs');

const file = 'src/index.tsx';
let code = fs.readFileSync(file, 'utf8');

const newsEndpoint = `
app.post('/api/translate/news', async (c) => {
  try {
    const { title, summary, content } = await c.req.json()
    if (!title && !summary && !content) return c.json({ error: 'data required' }, 400)

    const env = c.env; // Get Cloudflare env variables

    const targets = ['en', 'vi', 'th']
    const result: any = {}

    for (const lang of targets) {
      const [translatedTitle, translatedSummary, translatedContent] = await Promise.all([
        title ? translateTextAI(title, lang, env) : Promise.resolve(''),
        summary ? translateTextAI(summary, lang, env) : Promise.resolve(''),
        content ? translateTextAI(content, lang, env) : Promise.resolve('')
      ])
      result[\`title_\${lang}\`] = translatedTitle
      result[\`summary_\${lang}\`] = translatedSummary
      result[\`content_\${lang}\`] = translatedContent
    }

    return c.json({ success: true, translations: result })
  } catch (e: any) {
    return c.json({ error: e.message }, 500)
  }
})
`;

// Insert before the proxy section
code = code.replace(/\/\/ Upbit Ticker Proxy/, match => newsEndpoint + '\n\n' + match);

fs.writeFileSync(file, code, 'utf8');
