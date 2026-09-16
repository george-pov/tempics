import { pathToFileURL } from 'node:url';
import { setTimeout as sleep } from 'node:timers/promises';

const maxBytes = 5 * 1024 * 1024;
const signature = Buffer.from('89504e470d0a1a0a', 'hex');
class CheckError extends Error {
  constructor(message, retry = false, delay = 5000) {
    super(message);
    this.retry = retry;
    this.delay = delay;
  }
}

export function readPng(bytes) {
  const png = Buffer.from(bytes);
  if (png.length < 33 || !png.subarray(0, 8).equals(signature) ||
      png.readUInt32BE(8) !== 13 || png.toString('ascii', 12, 16) !== 'IHDR') {
    throw new CheckError('Invalid PNG header.');
  }
  let crc = 0xffffffff;
  for (const byte of png.subarray(12, 29)) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  const depths = { 0: [1, 2, 4, 8, 16], 2: [8, 16], 3: [1, 2, 4, 8], 4: [8, 16], 6: [8, 16] };
  if (((crc ^ 0xffffffff) >>> 0) !== png.readUInt32BE(29) ||
      !depths[png[25]]?.includes(png[24]) || png[26] !== 0 || png[27] !== 0 || png[28] > 1) {
    throw new CheckError('Invalid PNG IHDR.');
  }
  const width = png.readUInt32BE(16);
  const height = png.readUInt32BE(20);
  if (width !== 1200 || height !== 630) throw new CheckError('Unexpected PNG dimensions.');
  return { width, height, bytes: png.length };
}

async function readBody(response) {
  const length = response.headers.get('content-length');
  if (length !== null && (!/^\d+$/.test(length) || Number(length) > maxBytes)) {
    await response.body?.cancel();
    throw new CheckError('PNG response exceeds size limit.');
  }
  if (!response.body) throw new CheckError('Missing PNG body.');
  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) throw new CheckError('PNG response exceeds size limit.');
      chunks.push(value);
    }
    return Buffer.concat(chunks, total);
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

export async function checkApi({ apiUrl, key, fetch: fetchImpl = globalThis.fetch,
  wait = sleep, now = Date.now, timeoutMs = 60000, deadlineMs = 390000 } = {}) {
  // All validation happens before the first network request; no raw errors escape.
  if (typeof key !== 'string' || !key.trim() || /[\r\n]/.test(key)) throw new CheckError('Missing or invalid Function key.');
  let base;
  try { base = new URL(apiUrl); } catch { throw new CheckError('Invalid API URL.'); }
  if (base.protocol !== 'https:' || base.username || base.password || base.search || base.hash ||
      base.port || base.pathname !== '/api' ||
      !/^func-tempics-api-dev(?:-[a-z0-9]+)?(?:\.[a-z0-9-]+)?\.azurewebsites\.net$/.test(base.hostname)) {
    throw new CheckError('Invalid dev API target.');
  }
  const endpoint = new URL(`${base.pathname}/renders/sample`, base.origin);
  const deadline = now() + deadlineMs;
  async function request(authorized) {
    for (let attempt = 0; attempt < 3; attempt++) {
      const controller = new AbortController();
      let timer;
      try {
        const remaining = Math.min(timeoutMs, deadline - now());
        if (remaining <= 0) throw new CheckError('API check deadline exceeded.');
        return await Promise.race([
          (async () => {
            const response = await fetchImpl(endpoint, {
              method: 'POST', redirect: 'error', signal: controller.signal,
              headers: authorized ? { 'x-functions-key': key } : {},
            });
            if (response.redirected || (response.status >= 300 && response.status < 400)) {
              await response.body?.cancel();
              throw new CheckError('API redirect rejected.');
            }
            if (response.status === 429 || response.status >= 500) {
              const retryAfter = response.headers.get('retry-after');
              let delay = 5000;
              if (retryAfter) {
                const parsed = /^\d+$/.test(retryAfter) ? Number(retryAfter) * 1000 : Date.parse(retryAfter) - now();
                if (Number.isFinite(parsed)) delay = Math.max(delay, parsed);
              }
              await response.body?.cancel();
              throw new CheckError('Transient API response.', true, delay);
            }
            if (!authorized) {
              await response.body?.cancel();
              if (![401, 403].includes(response.status)) throw new CheckError('Anonymous access was not rejected.');
              return;
            }
            if (response.status !== 200) {
              await response.body?.cancel();
              throw new CheckError('Authorized API request failed.');
            }
            if (response.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'image/png') {
              await response.body?.cancel();
              throw new CheckError('Unexpected API content type.');
            }
            return readPng(await readBody(response));
          })(),
          new Promise((_, reject) => {
            timer = setTimeout(() => {
              controller.abort();
              reject(new CheckError('API request timed out.', true));
            }, remaining);
          }),
        ]);
      } catch (error) {
        const redirect = /redirect/i.test(String(error?.cause?.message ?? ''));
        const safe = error instanceof CheckError ? error :
          new CheckError(redirect ? 'API redirect rejected.' : 'API transport failed.', !redirect);
        if (!safe.retry || attempt === 2 || now() + safe.delay >= deadline) throw new CheckError(safe.message);
        clearTimeout(timer);
        await wait(safe.delay);
      } finally {
        clearTimeout(timer);
        controller.abort();
      }
    }
  }
  await request(false);
  return request(true);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const result = await checkApi({ apiUrl: process.env.TP_API_URL, key: process.env.AZURE_FUNCTION_KEY });
    console.log(`API check passed: ${result.width} x ${result.height} PNG, ${result.bytes} bytes.`);
  } catch {
    console.error('API check failed. Inspect target, authorization and service health without logging credentials.');
    process.exitCode = 1;
  }
}
