const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const publicDirectory = __dirname;
const port = Number(process.env.PORT || 10000);
const host = '0.0.0.0';

const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
};

/** 모든 응답에 적용할 기본 보안 헤더입니다. */
function setSecurityHeaders(response) {
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('X-Frame-Options', 'DENY');
  response.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  response.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; connect-src 'self' https://*.supabase.co https://api.open-meteo.com; img-src 'self' data:; style-src 'self'; script-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'",
  );
}

/** 브라우저 공개용 Supabase 설정만 런타임에 전달합니다. */
function sendRuntimeConfig(response) {
  const runtimeConfig = {
    SUPABASE_URL: process.env.SUPABASE_URL || '',
    SUPABASE_PUBLISHABLE_KEY: process.env.SUPABASE_PUBLISHABLE_KEY || '',
  };
  const body = `window.GREENON_CONFIG = ${JSON.stringify(runtimeConfig)};`;

  response.writeHead(200, {
    'Content-Type': 'text/javascript; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  response.end(body);
}

/** 요청 경로가 프로젝트 폴더 밖으로 벗어나지 않도록 안전하게 해석합니다. */
function resolvePublicFile(requestPath) {
  const decodedPath = decodeURIComponent(requestPath.split('?')[0]);
  const relativePath = decodedPath === '/' ? 'index.html' : decodedPath.replace(/^\/+/, '');
  const resolvedPath = path.resolve(publicDirectory, relativePath);

  if (!resolvedPath.startsWith(`${publicDirectory}${path.sep}`)) return null;
  return resolvedPath;
}

const server = http.createServer((request, response) => {
  setSecurityHeaders(response);

  if (request.url === '/health') {
    response.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    });
    response.end(JSON.stringify({ status: 'ok', service: 'carrier-greenon' }));
    return;
  }

  if (request.url?.split('?')[0] === '/config.js') {
    sendRuntimeConfig(response);
    return;
  }

  let filePath;
  try {
    filePath = resolvePublicFile(request.url || '/');
  } catch {
    response.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('잘못된 요청입니다.');
    return;
  }

  if (!filePath) {
    response.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('접근할 수 없는 경로입니다.');
    return;
  }

  fs.stat(filePath, (statError, stats) => {
    // 해시 기반 SPA이므로 존재하지 않는 화면 경로는 홈 HTML로 돌려보냅니다.
    const finalPath = statError || !stats.isFile() ? path.join(publicDirectory, 'index.html') : filePath;

    fs.readFile(finalPath, (readError, content) => {
      if (readError) {
        response.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        response.end('서비스 파일을 읽지 못했습니다.');
        return;
      }

      const extension = path.extname(finalPath).toLowerCase();
      response.writeHead(200, {
        'Content-Type': contentTypes[extension] || 'application/octet-stream',
        'Cache-Control': extension === '.html' ? 'no-cache' : 'public, max-age=3600',
      });
      response.end(content);
    });
  });
});

server.listen(port, host, () => {
  console.log(`Carrier GreenON is running on http://${host}:${port}`);
});

function shutdown() {
  server.close(() => process.exit(0));
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
