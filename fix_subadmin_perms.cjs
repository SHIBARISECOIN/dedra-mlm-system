const fs = require('fs');
let html = fs.readFileSync('/home/user/webapp/public/static/admin.html', 'utf-8');

const target = 'const _origApplyPerms = window._applySubAdminMenuPerms;';
if (html.includes(target) && !html.includes('window._applySubAdminMenuPerms = function(perms)')) {
    html = html.replace(target, target + `
window._applySubAdminMenuPerms = function(perms) {
  if (_origApplyPerms) _origApplyPerms(perms);
  const saMenu = document.querySelector('.menu-item[data-page="subadmins"]');
  if (saMenu) saMenu.style.display = 'none';
};
`);
    fs.writeFileSync('/home/user/webapp/public/static/admin.html', html);
    console.log('Fixed _applySubAdminMenuPerms override.');
} else {
    console.log('Already fixed or target not found.');
}
