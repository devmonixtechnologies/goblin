import http from 'http';
import { createReadStream, statSync } from 'fs';
import { existsSync } from 'fs';
import { join, resolve, extname } from 'path';
import { getOutDir } from './compiler.mjs';

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.mjs': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

export async function createPreviewServer(config, options = {}) {
  const host = options.host || config.server?.host || '127.0.0.1';
  const port = options.port || 4173;
  const clientOutDir = getOutDir(config, 'client');

  if (!existsSync(clientOutDir)) {
    throw new Error(`Preview output directory does not exist: ${clientOutDir}`);
  }

  const server = http.createServer((req, res) => {
    const filePath = resolveAsset(req?.url || '/', clientOutDir);
    if (!filePath || !existsSync(filePath)) {
      res.statusCode = 404;
      res.end('Not Found');
      return;
    }
    try {
      const stats = statSync(filePath);
      if (stats.isDirectory()) {
        const indexHtml = join(filePath, 'index.html');
        if (existsSync(indexHtml)) {
          streamFile(indexHtml, res);
          return;
        }
        res.statusCode = 403;
        res.end('Forbidden');
        return;
      }
      streamFile(filePath, res);
    } catch (error) {
      res.statusCode = 500;
      res.end('Internal Server Error');
      console.error('[goblin] preview server failed to serve asset', error);
    }
  });

  return {
    url: `http://${host}:${port}`,
    listen(cb) {
      server.listen(port, host, cb);
    },
    close(cb) {
      server.close(cb);
    }
  };
}

function resolveAsset(requestUrl, clientOutDir) {
  const cleanUrl = requestUrl === '/' ? '/index.html' : requestUrl;
  return resolve(clientOutDir, cleanUrl.replace(/^\//, ''));
}

function streamFile(filePath, res) {
  const ext = extname(filePath);
  const mime = MIME_TYPES[ext] || 'application/octet-stream';
  res.setHeader('Content-Type', mime);
  const stream = createReadStream(filePath);
  stream.pipe(res);
}
