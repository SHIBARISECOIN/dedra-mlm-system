const fs = require('fs');
let code = fs.readFileSync('/home/user/webapp/public/static/app.js', 'utf-8');

code = code.replace(
`  } catch (err) {
    console.error(err);
    const childrenWrap = document.getElementById('caveChildrenWrap');`,
`  } catch (err) {
    console.error(err);
    const childrenWrap = document.getElementById('caveChildrenWrap');
    if (childrenWrap) childrenWrap.innerHTML = '<div style="color:red;padding:20px;">' + err.message + '</div>';`
);

fs.writeFileSync('/home/user/webapp/public/static/app.js', code);
