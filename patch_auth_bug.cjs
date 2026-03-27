const fs = require('fs');
let code = fs.readFileSync('public/static/firebase.js', 'utf8');

const target = `        if (typeof window.onAuthReady === 'function') {
          window.onAuthReady(session);
          return;
        }
      }
    } catch(e) { localStorage.removeItem('deedra_session'); }
  }`;

const replacement = `        if (typeof window.onAuthReady === 'function') {
          window.onAuthReady(session);
        } else {
          window._pendingAuthUser = session;
        }
        return;
      }
    } catch(e) { localStorage.removeItem('deedra_session'); }
  }`;

if (code.includes(target)) {
    code = code.replace(target, replacement);
    fs.writeFileSync('public/static/firebase.js', code);
    console.log("Patched firebase.js auth race condition!");
} else {
    console.log("Target not found in firebase.js");
}
