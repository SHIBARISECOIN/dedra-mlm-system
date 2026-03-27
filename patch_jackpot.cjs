const fs = require('fs');
let appJs = fs.readFileSync('public/static/app.js', 'utf8');

const newChangeCountHtml = `
        <div style="margin-top:8px; font-size: 11px; color: #facc15; font-weight: 600; display: \${data.changeCount ? 'inline-block' : 'none'}; background: rgba(250, 204, 21, 0.15); padding: 4px 10px; border-radius: 12px; border: 1px solid rgba(250, 204, 21, 0.3);">
          \${(typeof currentLang !== 'undefined' && currentLang === 'en') ? 'Target changed ' + (data.changeCount||0) + ' times!' : 
            (typeof currentLang !== 'undefined' && currentLang === 'vi') ? 'Mục tiêu đã thay đổi ' + (data.changeCount||0) + ' lần!' : 
            (typeof currentLang !== 'undefined' && currentLang === 'th') ? 'เป้าหมายเปลี่ยนไป ' + (data.changeCount||0) + ' ครั้ง!' : 
            '예비 당첨자 ' + (data.changeCount||0) + '번 변경됨!'}
        </div>`;

const searchStr = `              '당신이 될 수 있습니다!!'
            )}
          </span>
        </div>
      </div>`;

if (appJs.includes(searchStr)) {
  appJs = appJs.replace(searchStr, `              '당신이 될 수 있습니다!!'
            )}
          </span>
        </div>
        ${newChangeCountHtml}
      </div>`);
  console.log("Banner patched successfully");
} else {
  console.log("Could not find the jackpot string to replace");
}

fs.writeFileSync('public/static/app.js', appJs);
