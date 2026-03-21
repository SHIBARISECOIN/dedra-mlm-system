const fs = require('fs');
const acorn = require('acorn');
const html = fs.readFileSync('public/static/admin.html', 'utf8');
const scriptRegex = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
let match;
let i = 0;
while ((match = scriptRegex.exec(html)) !== null) {
  const code = match[1];
  const typeMatch = match[0].match(/type=['"]([^'"]+)['"]/);
  const isModule = typeMatch && typeMatch[1] === 'module';
  try {
    acorn.parse(code, { ecmaVersion: 'latest', sourceType: isModule ? 'module' : 'script' });
    console.log(`Script ${i}: OK`);
  } catch (e) {
    console.log(`Script ${i} Error at line ${e.loc ? e.loc.line : '?'}, col ${e.loc ? e.loc.column : '?'}: ${e.message}`);
    if (e.loc) {
      const lines = code.split('\n');
      const lineNum = e.loc.line - 1;
      console.log(`Context:`);
      console.log(lines.slice(Math.max(0, lineNum - 2), lineNum + 3).join('\n'));
    }
  }
  i++;
}
