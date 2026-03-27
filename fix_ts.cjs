const fs = require('fs');
const file = 'src/index.tsx';
let code = fs.readFileSync(file, 'utf8');

// I will just replace the prompt string to avoid nested backticks parsing issues
code = code.replace(/3\. NEVER add markdown code blocks \(like [\s\S]*?\) to your response\./, "3. NEVER add markdown code blocks to your response.");

fs.writeFileSync(file, code, 'utf8');
