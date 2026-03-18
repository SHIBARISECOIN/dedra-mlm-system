const fs = require('fs');
let code = fs.readFileSync('/home/user/webapp/public/static/app.js', 'utf-8');

const draggableCode = `
// ==============================================
// 🖱️ Draggable Map Utility
// ==============================================
window.makeDraggableMap = function(ele) {
    if (!ele || ele._dragInit) return;
    ele._dragInit = true;
    ele.style.cursor = 'grab';
    
    let isDown = false;
    let startX, startY, scrollLeft, scrollTop;
    let isDragging = false;

    // Prevent native dragging
    ele.addEventListener('dragstart', (e) => e.preventDefault());

    // Mouse Events
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

    // Touch Events
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

    // Click suppression if dragged
    ele.addEventListener('click', (e) => {
        if (isDragging) {
            e.preventDefault();
            e.stopPropagation();
            isDragging = false;
        }
    }, true);
};
`;

if (!code.includes('window.makeDraggableMap = function')) {
    code = code + '\n' + draggableCode;
    fs.writeFileSync('/home/user/webapp/public/static/app.js', code);
    console.log('Added makeDraggableMap to app.js');
} else {
    console.log('Already exists');
}
