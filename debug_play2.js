import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({args: ['--no-sandbox']});
  const page = await browser.newPage();
  
  await page.goto('http://localhost:3000', {waitUntil: 'networkidle0'});
  await page.evaluate(() => window.switchPage('play'));
  await new Promise(r => setTimeout(r, 1000));
  
  const debug = await page.evaluate(() => {
    const play = document.getElementById('playPage');
    let parent = play.parentElement;
    let trace = [];
    
    while(parent) {
      trace.push({
        id: parent.id,
        class: parent.className,
        display: window.getComputedStyle(parent).display,
        height: parent.getBoundingClientRect().height,
        hidden: parent.classList.contains('hidden')
      });
      parent = parent.parentElement;
    }
    return trace;
  });
  
  console.log(debug);
  await browser.close();
})();
