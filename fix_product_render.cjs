const fs = require('fs');
let code = fs.readFileSync('/home/user/webapp/public/static/app.js', 'utf-8');

const target = `    productsCache = allDocs
      .filter(p => !p.type || p.type === 'investment')
      .sort((a, b) => (a.sortOrder || a.minAmount || 0) - (b.sortOrder || b.minAmount || 0));`;

const replacement = `    productsCache = allDocs
      .filter(p => (!p.type || p.type === 'investment') && p.isActive !== false)
      .sort((a, b) => (a.sortOrder || a.minAmount || 0) - (b.sortOrder || b.minAmount || 0));`;

code = code.replace(target, replacement);

const badGraph = `        <div class="product-graph" style="height:40px; margin: 8px 0 12px; position:relative; opacity:0.8;">
          <svg viewBox="0 0 100 30" preserveAspectRatio="none" style="width:100%; height:100%; overflow:visible;">
            <defs>
              <linearGradient id="gradLine-\${p.id}" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stop-color="var(--primary)"/>
                <stop offset="100%" stop-color="\${tier==='vip'?'#f59e0b':tier==='premium'?'#8b5cf6':tier==='standard'?'#3b82f6':'#10b981'}"/>
              </linearGradient>
              <linearGradient id="gradFill-\${p.id}" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="\${tier==='vip'?'#f59e0b':tier==='premium'?'#8b5cf6':tier==='standard'?'#3b82f6':'#10b981'}" stop-opacity="0.3"/>
                <stop offset="100%" stop-color="\${tier==='vip'?'#f59e0b':tier==='premium'?'#8b5cf6':tier==='standard'?'#3b82f6':'#10b981'}" stop-opacity="0"/>
              </linearGradient>
            </defs>
            <path d="M0,28 Q25,25 50,15 T100,2" fill="none" stroke="url(#gradLine-\${p.id})" stroke-width="2" vector-effect="non-scaling-stroke"/>
            <path d="M0,28 Q25,25 50,15 T100,2 L100,30 L0,30 Z" fill="url(#gradFill-\${p.id})"/>
            <!-- Add a pulse dot at the end -->
            <circle cx="100" cy="2" r="2.5" fill="\${tier==='vip'?'#f59e0b':tier==='premium'?'#8b5cf6':tier==='standard'?'#3b82f6':'#10b981'}">
               <animate attributeName="r" values="2.5; 5; 2.5" dur="2s" repeatCount="indefinite" />
               <animate attributeName="opacity" values="1; 0.3; 1" dur="2s" repeatCount="indefinite" />
            </circle>
          </svg>
        </div>`;

// Check if duplicated
const graphCount = code.split('<div class="product-graph"').length - 1;
if (graphCount > 1) { // It appears twice per product or something
   code = code.replace(badGraph + "\n        \n" + badGraph, badGraph);
}

fs.writeFileSync('/home/user/webapp/public/static/app.js', code);
console.log('Fixed product list rendering');
