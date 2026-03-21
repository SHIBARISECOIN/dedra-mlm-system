const fs = require('fs');
let code = fs.readFileSync('/home/user/webapp/public/static/js/api.js', 'utf-8');

const oldPass = `          const pass = mode === 'any'
            ? (cInvest || cSales || (bvRequired && cBV) || cMembers)
            : (cInvest && cSales && (!bvRequired || cBV) && cMembers);`;

const newPass = `          // [요청사항 적용] 배치 승격도 "본인 투자금"과 "균형 매출" 2가지만 봅니다.
          const pass = cInvest && cBV;`;

if (code.includes(oldPass)) {
    code = code.replace(oldPass, newPass);
    fs.writeFileSync('/home/user/webapp/public/static/js/api.js', code);
    console.log("Patched runBatchRankPromotion");
} else {
    console.log("oldPass not found");
}
