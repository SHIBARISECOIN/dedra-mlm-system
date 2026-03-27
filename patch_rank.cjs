const fs = require('fs');
const path = '/home/user/webapp/src/index.tsx';
let code = fs.readFileSync(path, 'utf8');

const oldStr = `          }
          // break 제거: 상위에 더 높은 직급이 있을 수 있으므로 계속 탐색
        } else {`;

const newStr = `          } else {
            // 동직급이거나 상위직급 파트너(0직급 포함)를 만나면 단절
            break;
          }
        } else {`;

if (code.includes(oldStr)) {
    code = code.replace(oldStr, newStr);
    fs.writeFileSync(path, code);
    console.log("Patch applied successfully.");
} else {
    console.log("Could not find the string to replace.");
}
