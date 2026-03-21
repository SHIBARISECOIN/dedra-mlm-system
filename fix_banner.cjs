const fs = require('fs');

let css = fs.readFileSync('/home/user/webapp/public/static/style.css', 'utf-8');

const oldCss = `.header-logo-img {
  height: 44px; width: auto;
  object-fit: contain; display: block;
}`;
const newCss = `.header-logo-img {
  height: auto; width: 120px; max-width: 100%;
  object-fit: contain; display: block;
}`;

if (css.includes(oldCss)) {
    css = css.replace(oldCss, newCss);
    fs.writeFileSync('/home/user/webapp/public/static/style.css', css);
    console.log('Fixed CSS banner size!');
} else {
    console.log('Old CSS not found. Trying regex.');
    // Let's just append an override at the end
    css += `\n/* Mobile Banner Fix */\n.header-logo-img { height: auto !important; width: 120px !important; max-width: 100%; object-fit: contain; }\n`;
    fs.writeFileSync('/home/user/webapp/public/static/style.css', css);
    console.log('Appended CSS override for banner.');
}
