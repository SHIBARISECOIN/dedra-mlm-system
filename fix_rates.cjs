const fs = require('fs');
let code = fs.readFileSync('/home/user/webapp/src/index.tsx', 'utf-8');

// We have 2 specific places where `const ratesDoc = await fsGet('settings/rates', adminToken)` appears.
// First one is in the center fee block.
// Second one is in `runSettle`.

// In `check-solana-deposits` (around line 1605)
code = code.replace(
  "const ratesDoc = await fsGet('settings/rates', adminToken)\n            const ratesData = ratesDoc?.fields ? firestoreDocToObj(ratesDoc) : {}\n            const centerFeePct = Number(ratesData.rate_centerFee ?? 5)",
  `const ratesDoc = await fsGet('settings/rates', adminToken)
            const ratesData = ratesDoc?.fields ? firestoreDocToObj(ratesDoc) : {}
            const centerFeePct = Number(ratesData.rate_centerFee ?? 5)
            const priceDoc = await fsGet('settings/deedraPrice', adminToken)
            const dedraRate = priceDoc?.fields?.price ? Number(priceDoc.fields.price.doubleValue || priceDoc.fields.price.integerValue || 0.5) : 0.5;`
);

code = code.replace(
  "amount: Math.round(feeUsdt / 0.5 * 1e8) / 1e8, // DEDRA rate",
  "amount: Math.round(feeUsdt / dedraRate * 1e8) / 1e8,"
);

// In `runSettle`
code = code.replace(
  "const ratesDoc = await fsGet('settings/rates', adminToken)\n    const ratesData = ratesDoc?.fields ? firestoreDocToObj(ratesDoc) : {}\n    const config = {",
  `const priceDoc = await fsGet('settings/deedraPrice', adminToken)
    const dedraRate = priceDoc?.fields?.price ? Number(priceDoc.fields.price.doubleValue || priceDoc.fields.price.integerValue || 0.5) : 0.5;

    const ratesDoc = await fsGet('settings/rates', adminToken)
    const ratesData = ratesDoc?.fields ? firestoreDocToObj(ratesDoc) : {}
    const config = {`
);

// Remove the `const dedraRate = 0.5` inside runSettle loop
code = code.replace(
  "// 데일리 수익 보너스 기록\n        const dedraRate = 0.5\n        await fsCreate('bonuses', {",
  "// 데일리 수익 보너스 기록\n        await fsCreate('bonuses', {"
);

// Fix matching bonus rates
code = code.replace(
  "await payMatchingBonus(upline1.id, 'direct_bonus', dailyEarning * 0.10, `1대 추천 매칭 (기준: ${sourceUser.name})`, 1)",
  "await payMatchingBonus(upline1.id, 'direct_bonus', dailyEarning * (config.direct1 / 100), `1대 추천 매칭 (기준: ${sourceUser.name})`, 1)"
);

code = code.replace(
  "await payMatchingBonus(upline2.id, 'direct_bonus', dailyEarning * 0.05, `2대 추천 매칭 (기준: ${sourceUser.name})`, 2)",
  "await payMatchingBonus(upline2.id, 'direct_bonus', dailyEarning * (config.direct2 / 100), `2대 추천 매칭 (기준: ${sourceUser.name})`, 2)"
);

code = code.replace(
  "await payMatchingBonus(parent.id, 'rank_equal_or_higher_override_1pct', dailyEarning * 0.01, `동급/상위 직속 예외 1% (기준: ${sourceUser.name})`, rollUpDepth)",
  "await payMatchingBonus(parent.id, 'rank_equal_or_higher_override_1pct', dailyEarning * (config.override / 100), `동급/상위 직속 예외 ${config.override}% (기준: ${sourceUser.name})`, rollUpDepth)"
);

code = code.replace(
  "const gapBonus = dailyEarning * (rankGap / 100)\n            await payMatchingBonus(parent.id, 'rank_bonus', gapBonus, `판권 매칭 ${rankGap}% (기준: ${sourceUser.name})`, rollUpDepth)",
  "const gapBonus = dailyEarning * (rankGap * config.rankGap / 100)\n            await payMatchingBonus(parent.id, 'rank_bonus', gapBonus, `판권 매칭 ${rankGap * config.rankGap}% (기준: ${sourceUser.name})`, rollUpDepth)"
);

fs.writeFileSync('/home/user/webapp/src/index.tsx', code);
console.log('Fixes applied successfully');
