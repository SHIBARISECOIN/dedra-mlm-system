const fs = require('fs');
let html = fs.readFileSync('public/static/admin.html', 'utf8');

const loggerScript = `
<script>
window.addEventListener('error', function(e) {
  fetch('/api/admin/log-error', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: e.message,
      filename: e.filename,
      lineno: e.lineno,
      colno: e.colno,
      error: e.error ? e.error.stack : null
    })
  });
});
</script>
`;

if (!html.includes('/api/admin/log-error')) {
  html = html.replace('<head>', '<head>' + loggerScript);
  fs.writeFileSync('public/static/admin.html', html);
  console.log("Injected error logger.");
}
