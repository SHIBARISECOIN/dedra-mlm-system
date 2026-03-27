const fs = require('fs');
let code = fs.readFileSync('public/static/admin.html', 'utf8');

const targetHtml = `    </div>

    <!-- ══════════════════════════════
         시스템 설정`;

const replacementHtml = `      <div style="background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:20px;margin-bottom:16px;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;border-bottom:1px solid #e2e8f0;padding-bottom:12px;">
          <span style="font-size:16px;font-weight:700;color:#1e293b;">📉 하락장 보상 이벤트 (Bear Market Cushion)</span>
          <label style="display:flex;align-items:center;gap:8px;cursor:pointer;">
            <span style="font-size:14px;font-weight:bold;color:#ef4444;" id="bearStatusText">OFF</span>
            <div style="position:relative;width:48px;height:26px;">
              <input type="checkbox" id="bearActive" style="opacity:0;width:0;height:0;position:absolute;" onchange="document.getElementById('bearStatusText').textContent=this.checked?'ON':'OFF'; document.getElementById('bearStatusText').style.color=this.checked?'#10b981':'#ef4444'; document.getElementById('bearTrack').style.background=this.checked?'#6366f1':'#cbd5e1'; document.getElementById('bearThumb').style.left=this.checked?'23px':'3px';">
              <div id="bearTrack" style="position:absolute;inset:0;background:#cbd5e1;border-radius:13px;transition:.3s;cursor:pointer;pointer-events:none;"></div>
              <div id="bearThumb" style="position:absolute;top:3px;left:3px;width:20px;height:20px;background:#fff;border-radius:50%;transition:.3s;pointer-events:none;"></div>
            </div>
          </label>
        </div>

        <div style="font-size:13px;color:#64748b;margin-bottom:16px;line-height:1.5;">
          코인 시세가 하락 중일 때(24시간 기준 변동률 마이너스), <strong>해당 하락률(%)만큼의 USDT</strong>를 입금 시 보너스로 추가 지급합니다.<br>
          <span style="color:#ef4444;font-weight:bold;">※ 단, 한 번이라도 출금 이력이 있는 회원은 혜택에서 제외됩니다.</span>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px;">
          <div>
            <label style="font-size:12px;color:#64748b;display:block;margin-bottom:4px;">시작 일시 (선택)</label>
            <input type="datetime-local" id="bearStartDate" style="width:100%;padding:10px;border:1px solid #e2e8f0;border-radius:8px;font-size:14px;">
          </div>
          <div>
            <label style="font-size:12px;color:#64748b;display:block;margin-bottom:4px;">종료 일시 (선택)</label>
            <input type="datetime-local" id="bearEndDate" style="width:100%;padding:10px;border:1px solid #e2e8f0;border-radius:8px;font-size:14px;">
          </div>
        </div>

        <div style="display:flex;justify-content:flex-end;">
          <button onclick="saveBearMarketSettings()" style="background:#6366f1;color:#fff;border:none;border-radius:8px;padding:10px 24px;font-size:13px;font-weight:600;cursor:pointer;">💾 하락장 보상 설정 저장</button>
        </div>
      </div>
    </div>

    <!-- ══════════════════════════════
         시스템 설정`;

code = code.replace(targetHtml, replacementHtml);
fs.writeFileSync('public/static/admin.html', code);

console.log("HTML patched.");
