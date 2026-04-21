// serve.mjs — server local simplu pentru proiecte Integrasys
// Rulează din folderul proiectului: node ../../"Flux de lucru"/serve.mjs
// Sau copiază în folderul proiectului și rulează: node serve.mjs
// Servește fișierele din directorul curent la http://localhost:3000

import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const PORT = 3000;
const ROOT = process.cwd();

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.mjs':  'application/javascript; charset=utf-8',
  '.json': 'application/json',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.woff': 'font/woff',
  '.woff2':'font/woff2',
};

const server = http.createServer((req, res) => {
  let urlPath = req.url.split('?')[0]; // strip query string
  if (urlPath === '/') urlPath = '/index.html';

  const filePath = path.join(ROOT, urlPath);
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end(`404 — Nu am găsit: ${urlPath}`);
      } else {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('500 — Eroare server');
      }
      return;
    }
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`✓ Server pornit: http://localhost:${PORT}`);
  console.log(`  Servește din: ${ROOT}`);
  console.log(`  Oprește cu: Ctrl+C`);
});