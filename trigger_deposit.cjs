// Script to forcefully run deposit check
const fs = require('fs');

async function triggerCheck() {
  try {
    const res = await fetch('https://d8b1643b.deedra.pages.dev/api/solana/check-deposits', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-cron-secret': 'deedra-cron-2026'
      },
      body: JSON.stringify({})
    });
    const text = await res.text();
    console.log("Response:", res.status, text);
  } catch(e) {
    console.error("Error:", e);
  }
}

triggerCheck();
