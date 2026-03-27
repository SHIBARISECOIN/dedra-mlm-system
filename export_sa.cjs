const fs = require('fs');
const code = fs.readFileSync('src/index.tsx', 'utf8');
const match = code.match(/const SERVICE_ACCOUNT = ({[\s\S]+?});/);
if (match) {
  let saText = match[1];
  saText = saText.replace(/process\.env\.([A-Z_]+)/g, (m, g) => {
    return '""'; // placeholder if we don't have env vars, but usually they are hardcoded or we can get it from wrangler.toml
  });
  console.log("Found SA");
}
