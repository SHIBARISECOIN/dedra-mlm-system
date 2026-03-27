const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));
  await page.goto('https://deedra.pages.dev/');
  
  await new Promise(r => setTimeout(r, 3000));
  
  await page.evaluate(async () => {
    try {
      console.log('typeof loadNewsFeed:', typeof loadNewsFeed);
      if (typeof window.loadNewsFeed === 'function') {
        await window.loadNewsFeed();
        console.log('loadNewsFeed executed. Content of newsFeedList:', document.getElementById('newsFeedList').innerHTML);
      } else {
        console.log('loadNewsFeed is not a function on window.');
      }
    } catch(e) {
      console.log('Error evaluating:', e.message);
    }
  });

  await browser.close();
})();
