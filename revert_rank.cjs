const fs = require('fs');
const path = '/home/user/webapp/src/index.tsx';
let code = fs.readFileSync(path, 'utf8');

const targetBlockStart = "      while (sponsor) {";
const targetBlockEnd = "        sponsor = memberMap.get(sponsor.parent_member_id);\n      }\n    }";

const startIndex = code.indexOf(targetBlockStart);
const endIndex = code.indexOf(targetBlockEnd) + targetBlockEnd.length;

if (startIndex !== -1 && endIndex !== -1) {
  const originalBlock = `      while (sponsor) {
        if (sponsor.rank_level === 0) {
          sponsor = memberMap.get(sponsor.parent_member_id);
          continue;
        }

        if (sponsor.id === member.parent_member_id && sponsor.rank_level <= member.rank_level) {
          let matchingAmt = member.total_allowance * (config.override / 100);
          if (matchingAmt > 0) {
            sponsor.rank_bonus += matchingAmt;
            sponsor.total_allowance = sponsor.recommend_bonus + sponsor.rank_bonus;
            let ws = walletUpdates.get(sponsor.id);
            if (!ws) { ws = { bonusBalanceToAdd:0, totalInvestToAdd:0, totalEarningsToAdd:0, currentBonusBalance:0, currentTotalInvest:0, currentTotalEarnings:0 }; walletUpdates.set(sponsor.id, ws); }
            ws.bonusBalanceToAdd += matchingAmt;
            ws.totalEarningsToAdd += matchingAmt;
            details.rankMatching += matchingAmt;
            totalPaid += matchingAmt;
            bonusLogs.push({ userId: sponsor.id, fromUserId: member.id, type: 'rank_matching', amount: Math.round(matchingAmt / dedraRate * 1e8) / 1e8, amountUsdt: matchingAmt, reason: \`1대 직급 매칭 수당 \${config.override}% (기준: \${member.name} 총수당)\`, level: 0 });
          }
        }

        if (config.rankGapMode === 'gap') {
          // 1. 차액 롤업 방식 (추천)
          if (sponsor.rank_level > pathMaxRank) {
            let rankDiff = sponsor.rank_level - pathMaxRank;
            let rollupAmt = member.daily_dividend * (rankDiff * (config.rankGap / 100));
            if (rollupAmt > 0) {
              sponsor.rank_bonus += rollupAmt;
              sponsor.total_allowance = sponsor.recommend_bonus + sponsor.rank_bonus;
              let ws = walletUpdates.get(sponsor.id);
              if (!ws) { ws = { bonusBalanceToAdd:0, totalInvestToAdd:0, totalEarningsToAdd:0, currentBonusBalance:0, currentTotalInvest:0, currentTotalEarnings:0 }; walletUpdates.set(sponsor.id, ws); }
              ws.bonusBalanceToAdd += rollupAmt;
              ws.totalEarningsToAdd += rollupAmt;
              details.rankRollup += rollupAmt;
              totalPaid += rollupAmt;
              bonusLogs.push({ userId: sponsor.id, fromUserId: member.id, type: 'rank_bonus', amount: Math.round(rollupAmt / dedraRate * 1e8) / 1e8, amountUsdt: rollupAmt, reason: \`직급 수당 롤업 \${rankDiff * config.rankGap}% (기준: \${member.name})\`, level: 0 });
            }
            pathMaxRank = sponsor.rank_level;
          }
        } else {
          // 2. 중복 지급(Overlap) 방식 - 대표님 요청 룰
          if (sponsor.rank_level >= pathMaxRank) {
            if (sponsor.rank_level > pathMaxRank) {
              pathMaxRank = sponsor.rank_level; // 나보다 높은 직급을 만나면 블로커 갱신 (그 위로는 더 이상 안올라감)
            }
            
            if (sponsor.rank_level > member.rank_level) {
              let rankDiff = sponsor.rank_level - member.rank_level;
              let rollupAmt = member.daily_dividend * (rankDiff * (config.rankGap / 100));
              if (rollupAmt > 0) {
                sponsor.rank_bonus += rollupAmt;
                sponsor.total_allowance = sponsor.recommend_bonus + sponsor.rank_bonus;
                let ws = walletUpdates.get(sponsor.id);
                if (!ws) { ws = { bonusBalanceToAdd:0, totalInvestToAdd:0, totalEarningsToAdd:0, currentBonusBalance:0, currentTotalInvest:0, currentTotalEarnings:0 }; walletUpdates.set(sponsor.id, ws); }
                ws.bonusBalanceToAdd += rollupAmt;
                ws.totalEarningsToAdd += rollupAmt;
                details.rankRollup += rollupAmt;
                totalPaid += rollupAmt;
                bonusLogs.push({ userId: sponsor.id, fromUserId: member.id, type: 'rank_bonus', amount: Math.round(rollupAmt / dedraRate * 1e8) / 1e8, amountUsdt: rollupAmt, reason: \`직급 수당 중복지급 \${rankDiff * config.rankGap}% (기준: \${member.name})\`, level: 0 });
              }
            }
          }
        }
        
        sponsor = memberMap.get(sponsor.parent_member_id);
      }
    }`;

  const newCode = code.substring(0, startIndex) + originalBlock + code.substring(endIndex);
  fs.writeFileSync(path, newCode);
  console.log("Successfully reverted back to the original logic.");
} else {
  console.log("Could not find the target block.");
}
