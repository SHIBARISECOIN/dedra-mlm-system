const fs = require('fs');

let appJs = fs.readFileSync('/home/user/webapp/public/static/app.js', 'utf8');

const jsCode = `
window.updateAutoCompoundUI = function(isAcChecked) {
  const icon = document.getElementById('autoCompoundIcon');
  const title = document.getElementById('autoCompoundTitleText');
  const sw = document.getElementById('autoCompoundSwitch');
  if(sw) sw.checked = isAcChecked;
  
  if (isAcChecked) {
    if(icon) {
      icon.style.color = '#10b981';
      icon.classList.add('fa-spin');
    }
    if(title) {
      title.style.color = '#10b981';
    }
  } else {
    if(icon) {
      icon.style.color = '#64748b';
      icon.classList.remove('fa-spin');
    }
    if(title) {
      title.style.color = 'var(--text-color, #fff)';
    }
  }
};

window.toggleAutoCompound = function(el) {
  if (!window.userData) {
    el.checked = !el.checked;
    return;
  }
  
  const isChecked = el.checked;
  if (isChecked) {
    el.checked = false;
    const agreeCheck = document.getElementById('autoCompoundAgreeCheck');
    const btnConfirm = document.getElementById('btnConfirmAutoCompound');
    if (agreeCheck) {
      agreeCheck.checked = false;
      agreeCheck.onchange = function() {
        btnConfirm.disabled = !this.checked;
        btnConfirm.style.opacity = this.checked ? '1' : '0.5';
      };
    }
    if (btnConfirm) {
      btnConfirm.disabled = true;
      btnConfirm.style.opacity = '0.5';
    }
    showModal('autoCompoundModal');
  } else {
    if (confirm('자동 복리 기능을 정말 해제하시겠습니까? (이후 데일리 수익은 출금 가능한 상태로 적립됩니다)')) {
      updateUserAutoCompound(false);
    } else {
      el.checked = true;
    }
  }
};

window.confirmAutoCompound = function() {
  closeModal('autoCompoundModal');
  updateUserAutoCompound(true);
};

window.updateUserAutoCompound = async function(isAcChecked) {
  try {
    const { doc, updateDoc } = window.firestore;
    const userRef = doc(window.db, 'users', window.userData.uid);
    await updateDoc(userRef, { autoCompound: isAcChecked });
    window.userData.autoCompound = isAcChecked;
    updateAutoCompoundUI(isAcChecked);
    showToast(isAcChecked ? '자동 복리가 활성화되었습니다.' : '자동 복리가 해제되었습니다.', 'success');
  } catch (err) {
    console.error('Auto compound update error:', err);
    showToast('설정 변경 중 오류가 발생했습니다.', 'error');
    updateAutoCompoundUI(!isAcChecked); // revert UI
  }
};
`;

// Append to app.js
appJs += '\n' + jsCode + '\n';
fs.writeFileSync('/home/user/webapp/public/static/app.js', appJs, 'utf8');
console.log('App.js patched for AutoCompound!');

let indexHtml = fs.readFileSync('/home/user/webapp/public/index.html', 'utf8');
// Fix the text color default on title so it doesn't stay green
indexHtml = indexHtml.replace('id="autoCompoundTitleText">', 'id="autoCompoundTitleText" style="transition: color 0.3s;">');
fs.writeFileSync('/home/user/webapp/public/index.html', indexHtml, 'utf8');
