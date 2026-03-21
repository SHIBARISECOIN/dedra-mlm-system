const fs = require('fs');
const path = '/home/user/webapp/src/index.tsx';
let code = fs.readFileSync(path, 'utf-8');

const oldLogic = `        // 중복 정산 방지
        if (inv.lastSettledAt) {
          const lastDate = String(inv.lastSettledAt).slice(0, 10)
          if (lastDate === today) {
            skippedCount++
            continue
          }
        }

        // 1. [데일리 수익] 계산 및 지급
        const dailyRoiPct = inv.dailyRoi || inv.roiPercent || inv.roiPct || 0
        const principal = inv.amount || inv.amountUsdt || 0
        const dailyEarning = Math.round(principal * (dailyRoiPct / 100) * 1e8) / 1e8

        if (dailyEarning <= 0) continue`;

const newLogic = `        // ────────────────────────────────────────────────────────
        // [수정된 로직] 개인별 경과 날수(Days Passed) 기반 정산
        // ────────────────────────────────────────────────────────
        let startDate = inv.lastSettledAt || inv.approvedAt || inv.createdAt;
        if (!startDate) continue;

        // 날짜 차이 계산 (UTC 자정 기준)
        const targetD = new Date(today + "T00:00:00Z");
        const startD = new Date(String(startDate).slice(0, 10) + "T00:00:00Z");

        const diffTime = targetD.getTime() - startD.getTime();
        let daysPassed = Math.floor(diffTime / (1000 * 60 * 60 * 24));

        if (daysPassed <= 0) {
          skippedCount++;
          continue; // 이미 오늘 또는 미래까지 정산됨
        }

        // 1. [데일리 수익] 1일치 수익 계산 후 누락된 날수만큼 곱하기
        const dailyRoiPct = inv.dailyRoi || inv.roiPercent || inv.roiPct || 0
        const principal = inv.amount || inv.amountUsdt || 0
        const oneDayEarning = Math.round(principal * (dailyRoiPct / 100) * 1e8) / 1e8;
        const dailyEarning = Math.round(oneDayEarning * daysPassed * 1e8) / 1e8;

        if (dailyEarning <= 0) continue
        
        // (보너스 지급 사유에 날수 표기용 변수 임시 저장 - reason에 쓰기 위함)
        inv._daysPassed = daysPassed;`;

// Also update the reason text to show how many days were applied
const oldReason = `reason: \`일일 데일리 수익 (\${today})\`,`;
const newReason = `reason: \`일일 데일리 수익 (\${today} / \${inv._daysPassed}일치)\`,`;

if (code.includes(oldLogic)) {
  code = code.replace(oldLogic, newLogic);
  code = code.replace(oldReason, newReason);
  fs.writeFileSync(path, code);
  console.log("Settlement logic patched successfully.");
} else {
  console.log("Error: old logic not found.");
}
