import fs from 'fs';

let text = fs.readFileSync('service-account.json', 'utf8');
// It looks like a JS object literal instead of JSON. Let's write it as JSON.
let obj = eval('(' + text + ')');
fs.writeFileSync('service-account.json', JSON.stringify(obj, null, 2));
