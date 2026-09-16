import test from 'node:test';
import assert from 'node:assert/strict';
import { checkApi } from './check-api.mjs';

const key = 'fixture-secret-do-not-print';
const apiUrl = 'https://func-tempics-api-dev.azurewebsites.net/api';
function png(width = 1200, height = 630) {
  const data = Buffer.alloc(33);
  Buffer.from('89504e470d0a1a0a', 'hex').copy(data);
  data.writeUInt32BE(13, 8); data.write('IHDR', 12);
  data.writeUInt32BE(width, 16); data.writeUInt32BE(height, 20);
  data[24] = 8; data[25] = 6;
  let crc = 0xffffffff;
  for (const byte of data.subarray(12, 29)) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  data.writeUInt32BE((crc ^ 0xffffffff) >>> 0, 29);
  return data;
}
const ok = (bytes = png(), headers = {}) => new Response(bytes, { headers: { 'content-type': 'image/png', ...headers } });
function fixture(responses, options = {}) {
  const calls = [];
  const waits = [];
  const run = () => checkApi({ apiUrl, key, wait: async delay => waits.push(delay), ...options,
    fetch: async (url, init) => {
      calls.push({ url: url.href, ...init });
      const next = responses.shift();
      if (next instanceof Error) throw next;
      if (typeof next === 'function') return next(init);
      assert.ok(next, 'Unexpected network call');
      return next;
    } });
  return { run, calls, waits };
}
async function rejectsSafe(run) {
  await assert.rejects(run, error => !String(error.stack).includes(key));
}
test('success requires anonymous rejection followed by header-only key', async () => {
  const f = fixture([new Response(null, { status: 401 }), ok()]);
  assert.deepEqual(await f.run(), { width: 1200, height: 630, bytes: 33 });
  assert.deepEqual(f.calls[0].headers, {});
  assert.equal(f.calls[1].headers['x-functions-key'], key);
  assert.ok(f.calls.every(c => c.redirect === 'error' && !c.url.includes(key)));
});
test('missing key and foreign or malformed targets fail before networking', async () => {
  for (const options of [{ key: '' }, { apiUrl: 'http://example.com/api' },
    { apiUrl: 'https://example.com/api' }, { apiUrl: apiUrl + '?code=x' },
    { apiUrl: apiUrl + '#x' }, { apiUrl: apiUrl.replace('https://', 'https://user@') }]) {
    const f = fixture([], options); await rejectsSafe(f.run); assert.equal(f.calls.length, 0);
  }
});
test('wrong auth results are never retried', async () => {
  for (const responses of [[new Response(null, { status: 200 })],
    [new Response(null, { status: 403 }), new Response(null, { status: 401 })]]) {
    const f = fixture(responses); await rejectsSafe(f.run); assert.equal(f.waits.length, 0);
  }
});
test('redirect response and native fetch redirect error are never retried', async () => {
  for (const response of [new Response(null, { status: 302 }),
    new TypeError(key, { cause: new Error('unexpected redirect') })]) {
    const f = fixture([response]); await rejectsSafe(f.run); assert.equal(f.calls.length, 1);
  }
});
test('timeouts have three attempts and safe errors', async () => {
  const hang = () => new Promise(() => {});
  const f = fixture([hang, hang, hang], { timeoutMs: 5 });
  await rejectsSafe(f.run); assert.equal(f.calls.length, 3); assert.deepEqual(f.waits, [5000, 5000]);
});
test('transient responses and transport failures retry then succeed', async () => {
  const f = fixture([new Error(key), new Response(null, { status: 429, headers: { 'retry-after': '6' } }),
    new Response(null, { status: 401 }), new Response(null, { status: 503 }), ok()]);
  await f.run(); assert.deepEqual(f.waits, [5000, 6000, 5000]);
});
test('retry limit and overall deadline bound retry-after', async () => {
  for (const responses of [Array.from({ length: 3 }, () => new Response(null, { status: 503 })),
    [new Response(null, { status: 429, headers: { 'retry-after': '999999' } })]]) {
    const f = fixture(responses); await rejectsSafe(f.run); assert.ok(f.calls.length <= 3);
    assert.ok(f.waits.every(delay => delay <= 5000));
  }
});
test('MIME, signature, IHDR, CRC and dimensions failures are not retried', async () => {
  const badCrc = png(); badCrc[29] ^= 1;
  const badLength = png(); badLength[11] = 12;
  for (const response of [new Response(key), ok(Buffer.from(key)), ok(png(1, 1)), ok(badCrc), ok(badLength)]) {
    const f = fixture([new Response(null, { status: 401 }), response]);
    await rejectsSafe(f.run); assert.equal(f.calls.length, 2); assert.equal(f.waits.length, 0);
  }
});
test('both declared size and streamed overflow are bounded', async () => {
  for (const response of [ok(png(), { 'content-length': String(5 * 1024 * 1024 + 1) }),
    ok(Buffer.alloc(5 * 1024 * 1024 + 1))]) {
    const f = fixture([new Response(null, { status: 401 }), response]);
    await rejectsSafe(f.run); assert.equal(f.waits.length, 0);
  }
});
test('body reads are covered by the request timeout', async () => {
  const hanging = () => new Response(new ReadableStream({ start() {} }), { headers: { 'content-type': 'image/png' } });
  const f = fixture([new Response(null, { status: 401 }), hanging, hanging, hanging], { timeoutMs: 5 });
  await rejectsSafe(f.run); assert.equal(f.calls.length, 4);
});
test('a deadline shorter than a retry wait stops immediately', async () => {
  const f = fixture([new Response(null, { status: 503 })], { deadlineMs: 1000 });
  await rejectsSafe(f.run); assert.equal(f.waits.length, 0);
});
