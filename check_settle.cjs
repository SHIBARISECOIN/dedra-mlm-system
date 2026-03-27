const { readFileSync } = require('fs');

async function check() {
  try {
    const code = readFileSync('/home/user/webapp/src/index.tsx', 'utf8');
    // Just fetch it via curl locally
  } catch(e) {}
}
