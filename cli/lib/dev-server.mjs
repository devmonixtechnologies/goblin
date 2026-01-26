import http from 'http';
import https from 'https';
import { createReadStream, statSync } from 'fs';
import { existsSync, readFileSync } from 'fs';
import { join, resolve, extname } from 'path';
import { EventEmitter } from 'events';
import kleur from 'kleur';
import chokidar from 'chokidar';
import { createBuildContexts, disposeContexts, getOutDir, getPublicDir, HMR_ENDPOINT } from './compiler.mjs';

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

export async function startDevServer(config, options = {}) {
  const serverConfig = {
    ...config.server,
    ...(options.host ? { host: options.host } : {}),
    ...(options.port ? { port: options.port } : {})
  };

  const profiling = Boolean(options.profiling);
  const hmrEnabled = options.hmr !== false;
  const devExperiments = normalizeExperiments(config.experiments, options);
  const emitter = new EventEmitter();
  const contexts = await createBuildContexts(config, {
    mode: 'development',
    hmr: hmrEnabled,
    onRebuild: ({ error, target }) => {
      if (error) {
        console.error(kleur.red(`[goblin] rebuild failed for ${target}:`), error);
        emitter.emit('message', { type: 'error', target, message: error.message });
        return;
      }
      if (profiling && target) {
        console.log(kleur.gray(`[goblin] rebuilt ${target} @ ${new Date().toLocaleTimeString()}`));
      } else {
        console.log(kleur.green(`[goblin] rebuilt ${target}`));
      }
      emitter.emit('message', { type: 'reload', target });
    }
  });

  const publicDir = getPublicDir(config);
  const clientOutDir = getOutDir(config, 'client');

  const watcher = chokidar.watch(clientOutDir, {
    ignoreInitial: true,
    persistent: true
  });

  watcher.on('change', file => emitter.emit('message', { type: 'reload', file }));

  const proxyTable = normalizeProxyTable(serverConfig.proxy);

  const server = http.createServer((req, res) => {
    if (req.url === HMR_ENDPOINT) {
      handleEventStream(emitter, res);
      return;
    }

    const proxyTarget = matchProxy(req, proxyTable);
    if (proxyTarget) {
      proxyRequest(req, res, proxyTarget);
      return;
    }

    const filePath = resolveAsset(req.url, publicDir, clientOutDir);
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
      console.error(kleur.red('[goblin] failed to serve asset'), error);
    }
  });

  server.listen(serverConfig.port, serverConfig.host, () => {
    console.log(
      kleur.cyan(
        `[goblin] dev server running at http://${serverConfig.host}:${serverConfig.port}`
      )
    );
    emitter.emit('message', {
      type: 'ready',
      url: `http://${serverConfig.host}:${serverConfig.port}`,
      experiments: devExperiments,
      hmr: hmrEnabled
    });
    if (options.inspect) {
      const inspectorLocation = typeof options.inspect === 'string' ? options.inspect : '127.0.0.1:9229';
      console.log(kleur.gray(`[goblin] inspector hint: node --inspect=${inspectorLocation} dist/server/index.js`));
    }
  });

  const close = async () => {
    await Promise.all([
      disposeContexts(contexts),
      new Promise(resolveClose => server.close(resolveClose)),
      watcher.close()
    ]);
  };

  process.on('SIGINT', async () => {
    await close();
    process.exit(0);
  });

  return {
    close,
    emitter,
    url: `http://${serverConfig.host}:${serverConfig.port}`
  };
}

function handleEventStream(emitter, res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    Connection: 'keep-alive',
    'Cache-Control': 'no-cache'
  });
  const send = payload => {
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  };
  const handler = payload => send(payload);
  emitter.on('message', handler);
  res.on('close', () => emitter.off('message', handler));
}

export function resolveAsset(requestUrl, publicDir, clientOutDir) {
  if (!requestUrl) {
    return join(clientOutDir, 'index.html');
  }
  if (requestUrl.startsWith('/@')) {
    const relative = requestUrl.slice(2);
    return join(clientOutDir, relative);
  }
  const cleanUrl = sanitizeRequestPath(requestUrl);
  if (publicDir) {
    const publicCandidate = join(publicDir, cleanUrl);
    if (existsSync(publicCandidate)) {
      return publicCandidate;
    }
  }
  return join(clientOutDir, cleanUrl);
}

function sanitizeRequestPath(requestUrl) {
  const [pathOnly] = requestUrl.split(/[?#]/);
  if (!pathOnly || pathOnly === '/') {
    return 'index.html';
  }
  return pathOnly.startsWith('/') ? pathOnly.slice(1) : pathOnly;
}

function streamFile(filePath, res) {
  const ext = extname(filePath);
  const mime = MIME_TYPES[ext] || 'application/octet-stream';
  res.setHeader('Content-Type', mime);
  const stream = createReadStream(filePath);
  stream.pipe(res);
}

function normalizeProxyTable(proxy) {
  if (!proxy || typeof proxy !== 'object') {
    return [];
  }
  return Object.entries(proxy).map(([prefix, target]) => ({
    prefix,
    target: new URL(target)
  }));
}

function matchProxy(req, proxyTable) {
  if (!req.url) {
    return null;
  }
  return proxyTable.find(entry => req.url.startsWith(entry.prefix)) || null;
}

function proxyRequest(req, res, entry) {
  const target = entry.target;
  const isHttps = target.protocol === 'https:';
  const client = isHttps ? https : http;
  const forwardPath = req.url.replace(entry.prefix, target.pathname.replace(/\/$/, ''));
  const requestOptions = {
    hostname: target.hostname,
    port: target.port || (isHttps ? 443 : 80),
    path: forwardPath.startsWith('/') ? forwardPath : `/${forwardPath}`,
    method: req.method,
    headers: {
      ...req.headers,
      host: target.host
    }
  };

  const proxyReq = client.request(requestOptions, proxyRes => {
    res.writeHead(proxyRes.statusCode || 500, proxyRes.headers);
    proxyRes.pipe(res, { end: true });
  });

  proxyReq.on('error', error => {
    res.statusCode = 502;
    res.end('Bad Gateway');
    console.warn(kleur.yellow(`[goblin] proxy error for ${entry.prefix}`), error.message);
  });

  req.pipe(proxyReq, { end: true });
}

function normalizeExperiments(current = {}, options = {}) {
  const next = { ...current };
  if (options.streaming === true) {
    next.streaming = true;
  }
  if (options.streaming === false || options['noStreaming'] === true) {
    next.streaming = false;
  }
  return next;
}
