import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createBlobMap, packageSite } from '../src/ui/scripts/package-site.mjs';
import { checkUi } from './check-ui.mjs';

const dist = resolve(dirname(fileURLToPath(import.meta.url)), '../src/ui/dist');
const uiUrl = 'https://ui.example.test/';
const apiUrl = 'https://dev.example.test/api';
async function fixture(t, alter = () => {}) {
  await mkdir(dist, { recursive: true });
  const root = await mkdtemp(join(dist, 'check-test-'));
  t.after(async () => { assert.ok(root.startsWith(dist + sep)); await rm(root, { recursive: true, force: true }); });
  const input = join(root, 'input'); await mkdir(input);
  await writeFile(join(input, 'index.html'), '<!doctype html><base href="/"><link rel="stylesheet" href="styles.css"><script src="main.js"></script><app-root></app-root>');
  await writeFile(join(input, 'styles.css'), '@font-face{font-family:test;src:url("font.woff2")}');
  await writeFile(join(input, 'font.woff2'), 'fixture-font');
  await writeFile(join(input, 'main.js'), 'fixture-script');
  const result = await packageSite({ input, out: join(root, 'site/package'), env: { TP_ENV: 'dev', TP_API_URL: apiUrl } });
  const map = JSON.parse(await readFile(result.blobMapPath));
  const calls = [];
  const fetch = async (url, options) => {
    assert.equal(url.origin, new URL(uiUrl).origin); assert.equal(options.redirect, 'error');
    calls.push(url.pathname);
    const name = ['/', '/component-lab/'].includes(url.pathname) ? 'index.html' : url.pathname.slice(1);
    const found = map.find(item => item.name === name);
    const entry = found ?? map.find(item => item.name === '404.html');
    const response = { body: await readFile(join(result.packagePath, entry.source)),
      status: found ? 200 : 404, headers: { 'content-type': entry.contentType, 'cache-control': 'no-store' } };
    alter(response, name);
    return new Response(response.body, { status: response.status, headers: response.headers });
  };
  return { ...result, calls, run: extra => checkUi({ uiUrl, apiUrl, ...result, fetch, ...extra }) };
}
test('checks package bytes, both routes, root, font and true missing-file 404s', async t => {
  const f = await fixture(t); const result = await f.run();
  assert.equal(result.checks, result.blobs + 4);
  for (const path of ['/', '/config.json', '/component-lab', '/component-lab/', '/font.woff2', '/404.html']) assert.ok(f.calls.includes(path));
  assert.equal(f.calls.filter(path => /missing-.*\.(json|js)$/.test(path)).length, 2);
});
test('rejects wrong config, stale assets, missing font, wrong route MIME and cache', async t => {
  for (const alter of [
    (r, n) => { if (n === 'config.json') r.body = Buffer.from('{}'); },
    (r, n) => { if (n === 'main.js') r.body = Buffer.from('old'); },
    (r, n) => { if (n === 'font.woff2') r.status = 404; },
    (r, n) => { if (n === 'component-lab') r.headers['content-type'] = 'application/octet-stream'; },
    r => { r.headers['cache-control'] = 'max-age=600'; },
    (r, n) => { if (n.startsWith('missing-')) r.status = 200; },
    r => { r.status = 302; r.headers.location = 'https://foreign.example.test/'; },
    r => { r.headers['content-length'] = '999999999'; },
  ]) {
    const f = await fixture(t, alter); await assert.rejects(f.run());
  }
});
test('rejects foreign targets in the package and mismatched API configuration', async t => {
  const f = await fixture(t);
  await assert.rejects(f.run({ apiUrl: 'https://wrong.example.test/api' }));
  await assert.rejects(f.run({ uiUrl: 'http://ui.example.test/' }));
  assert.equal(f.calls.length, 0);
  await writeFile(join(f.packagePath, 'index.html'), '<script src="https://foreign.example.test/main.js"></script>');
  await writeFile(f.blobMapPath, JSON.stringify(await createBlobMap(f.packagePath)));
  await assert.rejects(f.run(), /Foreign or undeclared/);
  assert.equal(f.calls.length, 0);
});
test('timeouts cover stalled network and response bodies', async t => {
  const f = await fixture(t);
  await assert.rejects(f.run({ timeoutMs: 5, fetch: () => new Promise(() => {}) }));
  await assert.rejects(f.run({ timeoutMs: 5, fetch: async () => new Response(new ReadableStream({ start() {} }),
    { headers: { 'content-type': 'text/html', 'cache-control': 'no-store' } }) }));
});
