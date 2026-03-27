const fs = require('fs');
let code = fs.readFileSync('src/index.tsx', 'utf8');

const oldCode = `    for (const chunk of chunks) {
      const url = \`https://translate.googleapis.com/translate_a/single?client=gtx&sl=ko&tl=\${targetCode}&dt=t&q=\${encodeURIComponent(chunk)}\`
      const res = await fetch(url, { signal: AbortSignal.timeout(10000) })
      if (res.ok) {
        const data: any = await res.json()
        if (data && data[0]) {
          translatedText += data[0].map((item: any) => item[0] || '').join('');
        }
      } else {
        // Fallback to mymemory
        const mmUrl = \`https://api.mymemory.translated.net/get?q=\${encodeURIComponent(chunk)}&langpair=ko|\${targetCode}\`;
        const mmRes = await fetch(mmUrl, { signal: AbortSignal.timeout(10000) });
        if (mmRes.ok) {
          const mmData: any = await mmRes.json();
          if (mmData && mmData.responseData && mmData.responseData.translatedText) {
            translatedText += mmData.responseData.translatedText;
          }
        }
      }
    }`;

const newCode = `    for (const chunk of chunks) {
      const url = \`https://translate.googleapis.com/translate_a/single?client=gtx&sl=ko&tl=\${targetCode}&dt=t\`;
      const res = await fetch(url, { 
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: \`q=\${encodeURIComponent(chunk)}\`,
        signal: AbortSignal.timeout(10000) 
      });
      if (res.ok) {
        const data: any = await res.json()
        if (data && data[0]) {
          translatedText += data[0].map((item: any) => item[0] || '').join('');
        }
      } else {
        // Fallback to mymemory
        const mmUrl = \`https://api.mymemory.translated.net/get?langpair=ko|\${targetCode}\`;
        const mmRes = await fetch(mmUrl, { 
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: \`q=\${encodeURIComponent(chunk)}\`,
          signal: AbortSignal.timeout(10000) 
        });
        if (mmRes.ok) {
          const mmData: any = await mmRes.json();
          if (mmData && mmData.responseData && mmData.responseData.translatedText) {
            translatedText += mmData.responseData.translatedText;
          }
        }
      }
    }`;

code = code.replace(oldCode, newCode);
fs.writeFileSync('src/index.tsx', code);
console.log('patched to POST');
