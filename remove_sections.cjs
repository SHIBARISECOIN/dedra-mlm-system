const fs = require('fs');
let html = fs.readFileSync('/home/user/webapp/public/index.html', 'utf8');

// Remove heatmap container
const heatmapStart = html.indexOf('<!-- 최근 7일 수익 히트맵 -->');
const heatmapEnd = html.indexOf('<!-- 공지사항 + 뉴스 피드');
if (heatmapStart !== -1 && heatmapEnd !== -1) {
    html = html.substring(0, heatmapStart) + html.substring(heatmapEnd);
}

// Remove network earnings preview from home
const netStart = html.indexOf('<!-- 네트워크 수익 미리보기 -->');
const netEnd = html.indexOf('</section>', netStart); // find the end of homePage or next section?
// Let's find exactly the network section end
const netHtml = html.substring(netStart, netStart + 3000);
const upbitEnd = html.indexOf('<!-- 네트워크 수익 미리보기 -->');
const afterNet = html.indexOf('<div style="height:80px;"></div>', upbitEnd); // bottom padding of homePage

if (upbitEnd !== -1 && afterNet !== -1) {
    html = html.substring(0, upbitEnd) + html.substring(afterNet);
}

fs.writeFileSync('/home/user/webapp/public/index.html', html);
console.log("Sections removed.");
