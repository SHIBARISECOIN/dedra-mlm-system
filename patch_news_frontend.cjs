const fs = require('fs');

let code = fs.readFileSync('public/static/app.js', 'utf8');

// In renderNewsFeed:
// let title = n.title;
// let source = '소식통';
// Replace with:
// let title = (window.currentLang !== 'ko' && n['title_'+window.currentLang]) ? n['title_'+window.currentLang] : n.title;
code = code.replace(/let title = n\.title;\s*let source = '소식통';/g, 
  "let title = (window.currentLang !== 'ko' && n['title_'+window.currentLang]) ? n['title_'+window.currentLang] : n.title;\n    let source = window.currentLang === 'en' ? 'News' : window.currentLang === 'vi' ? 'Tin tức' : window.currentLang === 'th' ? 'ข่าว' : '소식통';");

// In showNewsModal:
// <div style="font-size:14px; font-weight:800; color:var(--text); margin-bottom:8px; line-height:1.4;">${n.title}</div>
// <div style="font-size:12px; color:var(--text2); line-height:1.5; margin-bottom:10px;">${n.description}</div>
code = code.replace(/\$\{n\.title\}/g, "${(window.currentLang !== 'ko' && n['title_'+window.currentLang]) ? n['title_'+window.currentLang] : n.title}");
code = code.replace(/\$\{n\.description\}/g, "${(window.currentLang !== 'ko' && n['description_'+window.currentLang]) ? n['description_'+window.currentLang] : n.description}");

fs.writeFileSync('public/static/app.js', code);
console.log("Patched app.js");
