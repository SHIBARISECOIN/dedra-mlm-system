const fs = require('fs');

const file = 'src/index.tsx';
let code = fs.readFileSync(file, 'utf8');

const oldTranslate = `async function translateText(text: string, targetLang: string): Promise<string> {
  if (!text || !text.trim()) return ''

  // Google Translate API (무료 엔드포인트, 약 5000자 제한, 개행유지)
  const langMap: Record<string, string> = { en: 'en', vi: 'vi', th: 'th' }
  const targetCode = langMap[targetLang] || targetLang

  try {
    const url = \`https://translate.googleapis.com/translate_a/single?client=gtx&sl=ko&tl=\${targetCode}&dt=t&q=\${encodeURIComponent(text)}\`
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) })
    if (!res.ok) return ''
    const data: any = await res.json()
    if (data && data[0]) {
      return data[0].map((item: any) => item[0]).join('')
    }
  } catch (err) {
    console.error('Translation error:', err)
  }
  return ''
}`;

const newTranslate = `async function translateTextAI(text: string, targetLang: string, env: any): Promise<string> {
  if (!text || !text.trim()) return ''

  // 만약 OpenAI API 키가 설정되어 있으면 고품질 AI 번역 사용
  if (env && env.OPENAI_API_KEY) {
    try {
      const languageNames: Record<string, string> = { en: 'English', vi: 'Vietnamese', th: 'Thai' }
      const targetName = languageNames[targetLang] || targetLang

      const prompt = \`Translate the following announcement from Korean to \${targetName}.
CRITICAL INSTRUCTIONS:
1. Preserve ALL HTML tags, line breaks, and whitespace exactly as they are.
2. Use a professional, natural, business tone suitable for an official cryptocurrency/game platform announcement.
3. NEVER add markdown code blocks (like \`\`\`html) to your response.
4. Output ONLY the translated text, without any explanations.\n\nText to translate:\n\${text}\`;

      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': \`Bearer \${env.OPENAI_API_KEY}\`
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini', // 빠르고 가성비 좋은 모델 (gpt-4o 사용 가능)
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.3
        })
      });

      if (res.ok) {
        const data: any = await res.json();
        if (data.choices && data.choices[0] && data.choices[0].message) {
          return data.choices[0].message.content.trim();
        }
      } else {
        console.error('OpenAI API Error:', await res.text());
      }
    } catch (err) {
      console.error('OpenAI Translation error:', err);
    }
  }

  // AI 번역 실패 또는 키가 없으면 기존 구글 번역 (Fallback) 사용
  return translateText(text, targetLang);
}

async function translateText(text: string, targetLang: string): Promise<string> {
  if (!text || !text.trim()) return ''

  // Google Translate API (무료 엔드포인트, 약 5000자 제한, 개행유지)
  const langMap: Record<string, string> = { en: 'en', vi: 'vi', th: 'th' }
  const targetCode = langMap[targetLang] || targetLang

  try {
    const url = \`https://translate.googleapis.com/translate_a/single?client=gtx&sl=ko&tl=\${targetCode}&dt=t&q=\${encodeURIComponent(text)}\`
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) })
    if (!res.ok) return ''
    const data: any = await res.json()
    if (data && data[0]) {
      return data[0].map((item: any) => item[0]).join('')
    }
  } catch (err) {
    console.error('Translation error:', err)
  }
  return ''
}`;

code = code.replace(oldTranslate, newTranslate);

const oldEndpoint = `app.post('/api/translate/announcement', async (c) => {
  try {
    const { title, content } = await c.req.json()
    if (!title && !content) return c.json({ error: 'title or content required' }, 400)

    const targets = ['en', 'vi', 'th']
    const result: any = {}

    // 순차 처리 (MyMemory rate limit 고려)
    for (const lang of targets) {
      const [translatedTitle, translatedContent] = await Promise.all([
        title ? translateText(title, lang) : Promise.resolve(''),
        content ? translateText(content, lang) : Promise.resolve('')
      ])
      result[\`title_\${lang}\`] = translatedTitle
      result[\`content_\${lang}\`] = translatedContent
    }

    return c.json({ success: true, translations: result })
  } catch (e: any) {
    return c.json({ error: e.message }, 500)
  }
})`;

const newEndpoint = `app.post('/api/translate/announcement', async (c) => {
  try {
    const { title, content } = await c.req.json()
    if (!title && !content) return c.json({ error: 'title or content required' }, 400)

    const env = c.env; // Get Cloudflare env variables

    const targets = ['en', 'vi', 'th']
    const result: any = {}

    for (const lang of targets) {
      const [translatedTitle, translatedContent] = await Promise.all([
        title ? translateTextAI(title, lang, env) : Promise.resolve(''),
        content ? translateTextAI(content, lang, env) : Promise.resolve('')
      ])
      result[\`title_\${lang}\`] = translatedTitle
      result[\`content_\${lang}\`] = translatedContent
    }

    return c.json({ success: true, translations: result })
  } catch (e: any) {
    return c.json({ error: e.message }, 500)
  }
})`;

code = code.replace(oldEndpoint, newEndpoint);

fs.writeFileSync(file, code, 'utf8');
console.log('Patched index.tsx with OpenAI translation support');
