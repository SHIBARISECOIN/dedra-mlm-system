import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({args: ['--no-sandbox']});
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('BROWSER LOG:', msg.text()));
  
  await page.goto('http://localhost:3000', {waitUntil: 'networkidle0'});
  
  await page.evaluate(() => {
    if (window.switchPage) {
      console.log('Switching to play page...');
      window.switchPage('play');
    } else {
      console.log('switchPage function not found!');
    }
  });
  
  await new Promise(r => setTimeout(r, 2000));
  
  const state = await page.evaluate(() => {
    const play = document.getElementById('playPage');
    if (!play) return {error: 'No playPage found'};
    
    return {
      classList: Array.from(play.classList),
      display: window.getComputedStyle(play).display,
      visibility: window.getComputedStyle(play).visibility,
      opacity: window.getComputedStyle(play).opacity,
      height: play.getBoundingClientRect().height,
      width: play.getBoundingClientRect().width,
      zIndex: window.getComputedStyle(play).zIndex,
      top: window.getComputedStyle(play).top,
      position: window.getComputedStyle(play).position,
      firstChildDisplay: play.firstElementChild ? window.getComputedStyle(play.firstElementChild).display : null,
      htmlLength: play.innerHTML.length
    };
  });
  
  console.log('Play Page State:', state);
  
  // 캡처도 해봅시다
  await page.screenshot({path: '/home/user/webapp/play_screenshot.png'});
  
  await browser.close();
})();
