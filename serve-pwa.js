#!/usr/bin/env node

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const PWA_DIR = path.join(__dirname, 'apps/web/dist');

const server = http.createServer((req, res) => {
  let filePath = path.join(PWA_DIR, req.url === '/' ? 'index.html' : req.url);
  
  // Security check
  if (!filePath.startsWith(PWA_DIR)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }
  
  // Get file extension for content type
  const ext = path.extname(filePath);
  const contentType = {
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
  }[ext] || 'text/plain';
  
  fs.readFile(filePath, (err, data) => {
    if (err) {
      if (err.code === 'ENOENT') {
        // Serve index.html for SPA routing
        fs.readFile(path.join(PWA_DIR, 'index.html'), (err, data) => {
          if (err) {
            res.writeHead(404);
            res.end('Not Found');
          } else {
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(data);
          }
        });
      } else {
        res.writeHead(500);
        res.end('Server Error');
      }
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(data);
    }
  });
});

server.listen(PORT, () => {
  console.log(`🚀 PWA Server running at http://localhost:${PORT}/`);
  console.log(`📁 Serving files from: ${PWA_DIR}`);
});