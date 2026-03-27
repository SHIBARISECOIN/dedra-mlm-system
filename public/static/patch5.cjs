const fs = require('fs');
let code = fs.readFileSync('/home/user/webapp/public/static/app.js', 'utf8');

code = code.replace(
"    const daysUnit = t('simPeriod')?.split('(')[0]?.trim() || 'days';\n    sel.innerHTML += `<option value=\"${p.id}\" data-roi=\"${roi}\" data-days=\"${days}\" data-min=\"${p.minAmount||0}\" data-max=\"${p.maxAmount||9999}\">${prodName} (${roi}% / ${days} ${daysUnit})</option>`;",
"    const daysUnitLabel = t('unit_days') || '일';\n    sel.innerHTML += `<option value=\"${p.id}\" data-roi=\"${roi}\" data-days=\"${days}\" data-min=\"${p.minAmount||0}\" data-max=\"${p.maxAmount||9999}\">${prodName} (${roi}% / ${days}${daysUnitLabel})</option>`;"
);

fs.writeFileSync('/home/user/webapp/public/static/app.js', code);
