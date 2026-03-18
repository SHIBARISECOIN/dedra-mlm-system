const fs = require('fs');
let appJs = fs.readFileSync('/home/user/webapp/public/static/app.js', 'utf8');

appJs = appJs.replace(
  /} catch\(e\) \{\}/g,
  `} catch(e) { console.error("Error fetching wallet/investment:", e); }`
);

appJs = appJs.replace(
  /} catch \(_\) \{\}/g,
  `} catch(e) { console.error("Error fetching (catch _):", e); }`
);

appJs = appJs.replace(
  /} catch \(err\) \{\}/g,
  `} catch(e) { console.error("Error fetching (catch err):", e); }`
);

fs.writeFileSync('/home/user/webapp/public/static/app.js', appJs);
console.log("Patched app.js to log errors.");
