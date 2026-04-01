const fs = require('fs');
const i18nPath = './public/static/i18n.v3.js';
let i18nCode = fs.readFileSync(i18nPath, 'utf8');
const koAdd = `
    jackpot_transparency: '🔗 100% 투명한 블록체인 해시 추첨 방식',
    jackpot_prize_desc: '이번 주 누적 잭팟 상금 (출금 수수료 100% 적립)',
    jackpot_draw_time: '이번 주 토요일 낮 12시, 단 1명 독식 추첨!',
    jackpot_my_tickets: '나의 추첨권:',
    jackpot_tickets_unit: '장',
    jackpot_win_prob: '당첨 확률:',
`;
const enAdd = `
    jackpot_transparency: '🔗 100% Transparent Blockchain Hash Draw',
    jackpot_prize_desc: 'This week accumulated jackpot prize (100% withdrawal fee accumulated)',
    jackpot_draw_time: 'Draw for 1 sole winner this Saturday at 12 PM!',
    jackpot_my_tickets: 'My Tickets:',
    jackpot_tickets_unit: 'tickets',
    jackpot_win_prob: 'Win Prob:',
`;
const viAdd = `
    jackpot_transparency: '🔗 100% Xổ số Băm Chuỗi khối Minh bạch',
    jackpot_prize_desc: 'Giải độc đắc tích lũy tuần này (Tích lũy 100% phí rút tiền)',
    jackpot_draw_time: 'Rút thăm cho 1 người chiến thắng duy nhất vào 12h trưa thứ Bảy tuần này!',
    jackpot_my_tickets: 'Vé của tôi:',
    jackpot_tickets_unit: 'vé',
    jackpot_win_prob: 'Tỷ lệ thắng:',
`;
const thAdd = `
    jackpot_transparency: '🔗 การจับรางวัลแฮชบล็อกเชนที่โปร่งใส 100%',
    jackpot_prize_desc: 'รางวัลแจ็คพอตสะสมสัปดาห์นี้ (สะสมค่าธรรมเนียมการถอน 100%)',
    jackpot_draw_time: 'จับรางวัลผู้ชนะเพียง 1 คนในวันเสาร์นี้ เวลา 12:00 น.!',
    jackpot_my_tickets: 'ตั๋วของฉัน:',
    jackpot_tickets_unit: 'ใบ',
    jackpot_win_prob: 'โอกาสชนะ:',
`;
function inject(code, targetLang, additions) {
    const search = `'${targetLang}': {`;
    const search2 = `${targetLang}: {`;
    let pos = code.indexOf(search);
    if (pos === -1) pos = code.indexOf(search2);
    if (pos === -1) return code;
    const insertPos = code.indexOf('{', pos) + 1;
    return code.slice(0, insertPos) + '\n' + additions + code.slice(insertPos);
}
i18nCode = inject(i18nCode, 'ko', koAdd);
i18nCode = inject(i18nCode, 'en', enAdd);
i18nCode = inject(i18nCode, 'vi', viAdd);
i18nCode = inject(i18nCode, 'th', thAdd);
fs.writeFileSync(i18nPath, i18nCode);

const appPath = './public/static/app.v3.js';
let appCode = fs.readFileSync(appPath, 'utf8');
const targetOld = `
      <div style="margin-bottom: 12px; position: relative; z-index: 1;">
          <span style="display: inline-block; background: rgba(52, 211, 153, 0.2); color: #6ee7b7; border: 1px solid #34d399; padding: 4px 10px; border-radius: 12px; font-size: 11px; font-weight: 800; letter-spacing: 0.5px;">
            🔗 100% 투명한 블록체인 해시 추첨 방식
          </span>
      </div>
      
      <div style="text-align: center; position: relative; z-index: 1;">
        <div style="color: #fbcfe8; font-size: 12px; margin-bottom: 4px;">이번 주 누적 잭팟 상금 (출금 수수료 100% 적립)</div>
        <div style="color: #fff; font-size: 28px; font-weight: 900; text-shadow: 0 2px 10px rgba(244,114,182,0.5);">
          <span style="color: #fbcfe8;">\${amountStr}</span> USDT
        </div>
        <div style="margin-top:8px; font-size: 13px; color: #f9a8d4; font-weight: bold;">
          이번 주 토요일 낮 12시, 단 1명 독식 추첨!
        </div>
        <div style="margin-top:12px; display:inline-block; background:rgba(0,0,0,0.3); border-radius:20px; padding:8px 16px; font-size:14px; font-weight:bold; color:#fff; border:1px solid rgba(255,255,255,0.2);">
          🎟 나의 추첨권: <span id="myWeeklyTickets" style="color:#fbbf24; font-size:16px;">\${myTickets}</span> 장 
          <span style="opacity:0.5; margin:0 6px;">|</span>
          당첨 확률: <span id="myWeeklyProb" style="color:#34d399; font-size:16px;">\${winProb}%</span>
        </div>
      </div>
`;
const targetNew = `
      <div style="margin-bottom: 12px; position: relative; z-index: 1;">
          <span style="display: inline-block; background: rgba(52, 211, 153, 0.2); color: #6ee7b7; border: 1px solid #34d399; padding: 4px 10px; border-radius: 12px; font-size: 11px; font-weight: 800; letter-spacing: 0.5px;">
            \${t('jackpot_transparency')}
          </span>
      </div>
      
      <div style="text-align: center; position: relative; z-index: 1;">
        <div style="color: #fbcfe8; font-size: 12px; margin-bottom: 4px;">\${t('jackpot_prize_desc')}</div>
        <div style="color: #fff; font-size: 28px; font-weight: 900; text-shadow: 0 2px 10px rgba(244,114,182,0.5);">
          <span style="color: #fbcfe8;">\${amountStr}</span> USDT
        </div>
        <div style="margin-top:8px; font-size: 13px; color: #f9a8d4; font-weight: bold;">
          \${t('jackpot_draw_time')}
        </div>
        <div style="margin-top:12px; display:inline-block; background:rgba(0,0,0,0.3); border-radius:20px; padding:8px 16px; font-size:14px; font-weight:bold; color:#fff; border:1px solid rgba(255,255,255,0.2);">
          🎟 \${t('jackpot_my_tickets')} <span id="myWeeklyTickets" style="color:#fbbf24; font-size:16px;">\${myTickets}</span> \${t('jackpot_tickets_unit')} 
          <span style="opacity:0.5; margin:0 6px;">|</span>
          \${t('jackpot_win_prob')} <span id="myWeeklyProb" style="color:#34d399; font-size:16px;">\${winProb}%</span>
        </div>
      </div>
`;
appCode = appCode.replace(targetOld, targetNew);
appCode = appCode.replace('🔗 100% 투명한 블록체인 해시 추첨 방식', "${t('jackpot_transparency')}");
appCode = appCode.replace('이번 주 누적 잭팟 상금 (출금 수수료 100% 적립)', "${t('jackpot_prize_desc')}");
appCode = appCode.replace('이번 주 토요일 낮 12시, 단 1명 독식 추첨!', "${t('jackpot_draw_time')}");
appCode = appCode.replace('🎟 나의 추첨권:', "🎟 ${t('jackpot_my_tickets')}");
appCode = appCode.replace('</span> 장', "</span> ${t('jackpot_tickets_unit')}");
appCode = appCode.replace('당첨 확률:', "${t('jackpot_win_prob')}");

function injectTrans(code, lang, add) {
    const startStr = `  ${lang}: {\n`;
    const altStr = `  '${lang}': {\n`;
    let idx = code.indexOf(startStr);
    if (idx === -1) {
        idx = code.indexOf(altStr);
        if (idx !== -1) idx += altStr.length;
    } else idx += startStr.length;
    if (idx !== -1 && idx > 0) return code.slice(0, idx) + add + code.slice(idx);
    return code;
}
if (!appCode.includes('jackpot_transparency:')) {
    appCode = injectTrans(appCode, 'ko', koAdd);
    appCode = injectTrans(appCode, 'en', enAdd);
    appCode = injectTrans(appCode, 'vi', viAdd);
    appCode = injectTrans(appCode, 'th', thAdd);
}
fs.writeFileSync(appPath, appCode);

let html = fs.readFileSync('public/index.html', 'utf8');
const oldVersionMatch = html.match(/app\.v3\.js\?v=(\d+)/);
if (oldVersionMatch) {
    const newVersion = Date.now();
    html = html.replace(new RegExp(`app\\.v3\\.js\\?v=${oldVersionMatch[1]}`, 'g'), `app.v3.js?v=${newVersion}`);
    fs.writeFileSync('public/index.html', html);
}
