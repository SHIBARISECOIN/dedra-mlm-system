const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on('pageerror', err => {
    console.log('Page error:');
    console.log(err.message);
    if (err.stack) console.log(err.stack);
  });
  page.on('console', msg => {
    if (msg.type() === 'error') console.log('Console error:', msg.text());
  });
  await page.goto('https://deedra.pages.dev/admin', { waitUntil: 'networkidle' });
  await browser.close();
})();
