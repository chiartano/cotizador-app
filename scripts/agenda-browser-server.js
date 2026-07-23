const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const port = Number(process.env.WILAN_AGENDA_BROWSER_PORT || 8766);
const types = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png' };

http.createServer((request, response) => {
  const url = new URL(request.url, `http://127.0.0.1:${port}`);
  const relative = url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname).replace(/^\//, '');
  const file = path.normalize(path.join(root, relative));
  if (!file.startsWith(root)) { response.writeHead(403); response.end(); return; }
  fs.readFile(file, (error, data) => {
    if (error) { response.writeHead(404); response.end('not found'); return; }
    if (relative === 'index.html' && process.env.WILAN_USE_TEST_ADAPTER !== '0') {
      data = Buffer.from(data.toString('utf8').replace('<script src="agenda/config.js"></script>', '<script src="tests/browser-fixtures/agenda-test-adapter.js"></script><script src="agenda/config.js"></script>'));
    }
    response.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    response.end(data);
  });
}).listen(port, '127.0.0.1', () => console.log(`agenda browser fixture http://127.0.0.1:${port}/`));
