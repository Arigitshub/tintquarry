import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';

const files = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/index.html', ['index.html', 'text/html; charset=utf-8']],
  ['/studio.css', ['studio.css', 'text/css; charset=utf-8']],
  ['/editor.js', ['editor.js', 'text/javascript; charset=utf-8']],
  ['/model.js', ['model.js', 'text/javascript; charset=utf-8']],
  ['/icons.js', ['icons.js', 'text/javascript; charset=utf-8']],
  ['/assets/salt-and-sky.jpg', ['assets/salt-and-sky.jpg', 'image/jpeg']],
]);
const port = Number(process.env.TINTQUARRY_PORT || 4173);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('TINTQUARRY_PORT must be an integer between 1 and 65535.');
}

createServer(async (request, response) => {
  const path = request.url.split('?')[0];
  const file = files.get(path);
  if (!['GET', 'HEAD'].includes(request.method)) {
    response.writeHead(405, { Allow: 'GET, HEAD' }).end();
    return;
  }
  if (!file) {
    response.writeHead(404).end('Not found');
    return;
  }
  try {
    const [name, type] = file;
    const bytes = await readFile(new URL(name, import.meta.url));
    response.writeHead(200, { 'Content-Type': type, 'Content-Length': bytes.length, 'X-Content-Type-Options': 'nosniff' });
    response.end(request.method === 'HEAD' ? undefined : bytes);
  } catch {
    response.writeHead(500).end('Could not load the editor file');
  }
}).listen(port, '127.0.0.1', () => {
  console.log(`Tintquarry is running at http://127.0.0.1:${port}`);
});
