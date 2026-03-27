const fs = require('fs');
const path = './public/static/app.js';
let code = fs.readFileSync(path, 'utf8');

const regex = /window\.makeDraggableMap = function\(ele\) \{[\s\S]*?\n\};/m;

const newCode = `window.makeDraggableMap = function(ele, innerEl) {
    if (!ele || ele._dragInit) return;
    ele._dragInit = true;
    ele.style.cursor = 'grab';
    
    let isDown = false;
    let startX, startY, scrollLeft, scrollTop;
    let isDragging = false;

    ele.addEventListener('dragstart', (e) => e.preventDefault());

    ele.addEventListener('mousedown', (e) => {
        isDown = true;
        ele.style.cursor = 'grabbing';
        isDragging = false;
        startX = e.pageX - ele.offsetLeft;
        startY = e.pageY - ele.offsetTop;
        scrollLeft = ele.scrollLeft;
        scrollTop = ele.scrollTop;
    });

    ele.addEventListener('mouseleave', () => {
        isDown = false;
        ele.style.cursor = 'grab';
    });

    ele.addEventListener('mouseup', () => {
        isDown = false;
        ele.style.cursor = 'grab';
    });

    ele.addEventListener('mousemove', (e) => {
        if (!isDown) return;
        e.preventDefault(); 
        const x = e.pageX - ele.offsetLeft;
        const y = e.pageY - ele.offsetTop;
        const walkX = (x - startX);
        const walkY = (y - startY);
        
        if (Math.abs(walkX) > 3 || Math.abs(walkY) > 3) {
            isDragging = true;
        }
        ele.scrollLeft = scrollLeft - walkX;
        ele.scrollTop = scrollTop - walkY;
    });

    ele.addEventListener('touchstart', (e) => {
        isDown = true;
        startX = e.touches[0].pageX - ele.offsetLeft;
        startY = e.touches[0].pageY - ele.offsetTop;
        scrollLeft = ele.scrollLeft;
        scrollTop = ele.scrollTop;
    }, {passive: true});

    ele.addEventListener('touchend', () => {
        isDown = false;
    });

    ele.addEventListener('touchmove', (e) => {
        if (!isDown) return;
        const x = e.touches[0].pageX - ele.offsetLeft;
        const y = e.touches[0].pageY - ele.offsetTop;
        const walkX = (x - startX);
        const walkY = (y - startY);
        ele.scrollLeft = scrollLeft - walkX;
        ele.scrollTop = scrollTop - walkY;
    }, {passive: true});
    
    // Wheel Zoom for inner tree
    let currentScale = window.appOrgScale || 1;
    ele.addEventListener('wheel', (e) => {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        currentScale = Math.min(Math.max(0.3, currentScale + delta), 2.5);
        window.appOrgScale = currentScale;
        
        const inner = innerEl || ele.firstElementChild;
        if (inner) {
            // Apply scale via transform
            inner.style.transformOrigin = 'top center';
            inner.style.transition = 'transform 0.1s ease-out';
            inner.style.transform = \`scale(\${currentScale})\`;
        }
    }, {passive: false});

    ele.addEventListener('click', (e) => {
        if (isDragging) {
            e.preventDefault();
            e.stopPropagation();
            isDragging = false;
        }
    }, true);
};`;

if (code.match(regex)) {
    code = code.replace(regex, newCode);
    fs.writeFileSync(path, code, 'utf8');
    console.log('Successfully patched zoom into makeDraggableMap.');
} else {
    console.log('Could not find makeDraggableMap function in app.js.');
}
