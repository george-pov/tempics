import { randomUUID } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { validateBlobMap } from '../src/ui/scripts/package-site.mjs';
import { sha256 } from '../src/ui/scripts/site-files.mjs';

function httpsUrl(value) {
  if (typeof value !== 'string' || /[\s\\?#]/.test(value)) throw new Error('Invalid HTTPS target.');
  let url;
  try { url = new URL(value); } catch { throw new Error('Invalid HTTPS target.'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.port) throw new Error('Invalid HTTPS target.');
  return url;
}
async function bytes(response, limit) {
  const length = response.headers.get('content-length');
  if (length !== null && (!/^\d+$/.test(length) || Number(length) > limit)) throw new Error('Hosted response exceeds expected size.');
  if (!response.body) throw new Error('Missing hosted response body.');
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) return Buffer.concat(chunks, size);
      size += value.byteLength;
      if (size > limit) throw new Error('Hosted response exceeds expected size.');
      chunks.push(value);
    }
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
}
export async function checkUi({ uiUrl, apiUrl, packagePath, blobMapPath,
  fetch: fetchImpl = globalThis.fetch, timeoutMs = 30000, deadlineMs = 300000 } = {}) {
  const base = httpsUrl(uiUrl);
  const api = httpsUrl(apiUrl);
  if (base.pathname !== '/') throw new Error('UI target must be a website root.');
  const map = await validateBlobMap(packagePath, JSON.parse(await readFile(blobMapPath, 'utf8')));
  const config = JSON.parse(await readFile(join(packagePath, 'config.json'), 'utf8'));
  if (config.environment !== 'dev' || config.apiBaseUrl !== api.href.replace(/\/$/, '')) throw new Error('Package API target mismatch.');
  const names = new Set(map.map(entry => entry.name));
  // Every HTML/CSS resource reference must resolve to a declared same-origin blob.
  for (const entry of map.filter(item => item.source === item.name && ['text/html', 'text/css'].includes(item.contentType))) {
    const source = await readFile(join(packagePath, entry.source), 'utf8');
    const references = entry.contentType === 'text/html' ?
      [...source.matchAll(/\b(?:src|href)\s*=\s*["']([^"']+)["']/gi)].map(match => match[1]) :
      [...source.matchAll(/url\(\s*["']?([^"')\s]+)["']?\s*\)/gi)].map(match => match[1]);
    for (const reference of references) {
      if (reference.startsWith('#') || reference.startsWith('data:')) continue;
      const resource = new URL(reference, new URL(entry.name, base));
      if (resource.origin !== base.origin || resource.search || resource.username || resource.password ||
          (resource.pathname !== '/' && !names.has(decodeURIComponent(resource.pathname.slice(1))))) {
        throw new Error('Foreign or undeclared resource reference.');
      }
    }
  }
  const deadline = Date.now() + deadlineMs;
  async function check(path, entry, status = 200) {
    const url = new URL(path, base);
    if (url.origin !== base.origin) throw new Error('Foreign resource target.');
    const size = (await stat(join(packagePath, entry.source))).size;
    const controller = new AbortController();
    let timer;
    const remaining = Math.min(timeoutMs, deadline - Date.now());
    if (remaining <= 0) throw new Error('UI check deadline exceeded.');
    try {
      await Promise.race([
        (async () => {
          const response = await fetchImpl(url, { redirect: 'error', cache: 'no-store', signal: controller.signal });
          if (response.redirected || (response.url && new URL(response.url).origin !== base.origin) || response.status !== status) {
            await response.body?.cancel(); throw new Error('Unexpected hosted status or redirect.');
          }
          if (response.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== entry.contentType ||
              !response.headers.get('cache-control')?.split(',').some(value => value.trim().toLowerCase() === 'no-store')) {
            await response.body?.cancel(); throw new Error('Hosted MIME or cache mismatch.');
          }
          const data = await bytes(response, size);
          if (data.length !== size || sha256(data) !== entry.sha256) throw new Error('Hosted bytes mismatch.');
        })(),
        new Promise((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(new Error('UI request timed out.')); }, remaining); }),
      ]);
    } catch { throw new Error('Hosted UI check failed.'); }
    finally { clearTimeout(timer); controller.abort(); }
  }
  for (const entry of map) await check(`/${entry.name}`, entry);
  const index = map.find(entry => entry.name === 'index.html');
  await check('/', index);
  await check('/component-lab/', index);
  const error = map.find(entry => entry.name === '404.html');
  const missing = `missing-${randomUUID()}`;
  await check(`/${missing}.json`, error, 404);
  await check(`/${missing}.js`, error, 404);
  return { blobs: map.length, checks: map.length + 4 };
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const args = process.argv.slice(2);
    if (args.length !== 4 || args[0] !== '--package' || args[2] !== '--map') throw new Error();
    const result = await checkUi({ uiUrl: process.env.TP_UI_URL, apiUrl: process.env.TP_API_URL,
      packagePath: args[1], blobMapPath: args[3] });
    console.log(`UI check passed: ${result.checks} HTTP checks, including assets, routes and real 404 responses.`);
  } catch { console.error('UI verification failed. Check target, package, MIME/cache headers and HTTP results.'); process.exitCode = 1; }
}
