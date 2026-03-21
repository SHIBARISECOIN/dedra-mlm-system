const fs = require('fs');
let code = fs.readFileSync('/home/user/webapp/public/static/app.js', 'utf8');

// The original code restricts by rank and max 3 depth at once
// Let's modify it to fetch all the way up to user's max depth without the 3-level arbitrary limit per click,
// or at least increase it to 10 for better UX

code = code.replace(
  /const fetchDepth = Math\.min\(3, availableDepth\); \/\/ 3 depths max at once/,
  "const fetchDepth = Math.min(10, availableDepth); // 10 depths max at once"
);

// To make this fetch dynamic for 10 levels recursively is complex inline.
// Instead, let's inject a recursive fetch logic

const recursiveFetch = `
    const fetchDepth = Math.min(10, availableDepth); // up to 10 depths at once
    
    let children = [];
    const { collection, query, where, getDocs, limit, db } = window.FB;
    
    // Recursive fetch function
    const fetchChildrenRecursively = async (parentId, currentDepth, maxD) => {
        if (currentDepth > maxD) return [];
        const q = query(collection(db, 'users'), where('referredBy', '==', parentId));
        const snap = await getDocs(q);
        const nodes = snap.docs.map(d => ({ id: d.id, ...d.data(), children: [], hasMore: false }));
        
        if (currentDepth < maxD && nodes.length > 0) {
            await Promise.all(nodes.map(async n => {
                n.children = await fetchChildrenRecursively(n.id, currentDepth + 1, maxD);
                if (n.children.length === 0 && currentDepth === maxD) {
                    // Check if has more beyond maxD
                    const qMore = query(collection(db, 'users'), limit(1), where('referredBy', '==', n.id));
                    const sMore = await getDocs(qMore);
                    n.hasMore = !sMore.empty;
                }
            }));
        } else if (nodes.length > 0) {
            await Promise.all(nodes.map(async n => {
                const qMore = query(collection(db, 'users'), limit(1), where('referredBy', '==', n.id));
                const sMore = await getDocs(qMore);
                n.hasMore = !sMore.empty;
            }));
        }
        return nodes;
    };
    
    children = await fetchChildrenRecursively(lastNode.id, 1, fetchDepth);
`;

code = code.replace(
    /const fetchDepth = Math\.min\(3, availableDepth\)[\s\S]*?(?=const childrenWrap = document.getElementById\('caveChildrenWrap'\);)/,
    recursiveFetch + '\n\n    '
);

fs.writeFileSync('/home/user/webapp/public/static/app.js', code);
console.log('Patched user app org tree depth logic');
