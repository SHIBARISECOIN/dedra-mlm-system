const fs = require('fs');

async function checkCronRoute() {
  try {
    const res = await fetch('https://d8b1643b.deedra.pages.dev/cdn-cgi/mf/scheduled', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cron: "* * * * *" })
    });
    console.log("Response:", res.status);
  } catch(e) {
    console.log("Probably local only route for scheduled");
  }
}
checkCronRoute();
