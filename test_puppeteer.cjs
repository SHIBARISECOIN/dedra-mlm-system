const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  
  await page.goto('https://ddra.io');
  
  // Login
  await page.waitForSelector('#loginEmail');
  await page.type('#loginEmail', 'qwer@qwer.com');
  await page.type('#loginPassword', 'qwerqwer');
  await page.click('button[onclick="handleLogin()"]');
  
  // Wait for login
  await new Promise(r => setTimeout(r, 5000));
  
  console.log("Checking if EARN skeleton is still there...");
  try {
    const isSkeleton = await page.$eval('#homeEarnList .earn-skeleton', el => el !== null);
    if (isSkeleton) console.log("SKELETON STILL VISIBLE AFTER 5 SECONDS!");
  } catch (e) {
    console.log("Skeleton gone, data loaded.");
  }

  await browser.close();
})();
