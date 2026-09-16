import { contentType, inside, listSiteFiles, noLinks, safeName, sha256 } from './site-files.mjs';
export { listSiteFiles, siteHashes } from './site-files.mjs';
import { copyFile, lstat, mkdir, readFile, readdir, realpath, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { configFromEnv, writeConfig } from './write-config.mjs';
import { validateConfig } from '../src/app/shared/config/validate-config.ts';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const dist = resolve(scriptDir, '../dist');
export async function createBlobMap(packagePath, names = undefined) {
  const files = names ?? await listSiteFiles(packagePath);
  const map = [];
  const destinations = new Set();
  for (const source of files) {
    if (!safeName(source)) throw new Error('Invalid source name.');
    const file = resolve(packagePath, source);
    if (!inside(resolve(packagePath), file)) throw new Error('Source escapes package.');
    await noLinks(file);
    if (!(await lstat(file)).isFile()) throw new Error('Source is not a regular file.');
    const hash = sha256(await readFile(file));
    for (const name of source === 'index.html' ? ['index.html', 'component-lab', 'component-lab/index.html'] : [source]) {
      if (destinations.has(name)) throw new Error('Duplicate destination name.');
      destinations.add(name);
      map.push({ source, name, contentType: contentType(source), cacheControl: 'no-store', sha256: hash });
    }
  }
  return map;
}

export async function validateBlobMap(packagePath, map) {
  if (!Array.isArray(map)) throw new Error('Blob map must be an array.');
  const expected = await createBlobMap(packagePath);
  const sort = entries => [...entries].sort((a, b) => a.name.localeCompare(b.name));
  if (map.length !== expected.length) throw new Error('Incomplete blob map.');
  const actual = sort(map);
  for (const [index, entry] of sort(expected).entries()) {
    const item = actual[index];
    if (!item || Object.keys(item).sort().join() !== Object.keys(entry).sort().join() ||
        Object.keys(entry).some(key => item[key] !== entry[key])) throw new Error('Blob map does not match package.');
  }
  const config = JSON.parse(await readFile(join(packagePath, 'config.json'), 'utf8'));
  const normalized = validateConfig(config);
  if (normalized.environment !== 'dev' || normalized.apiBaseUrl !== config.apiBaseUrl) throw new Error('Invalid dev configuration.');
  const errorPage = await readFile(join(packagePath, '404.html'), 'utf8');
  if (errorPage.replaceAll('\r\n', '\n') !== (await readFile(join(scriptDir, '404.html'), 'utf8')).replaceAll('\r\n', '\n')) throw new Error('Unexpected error document.');
  return map;
}

export async function packageSite({ input, out, env = process.env }) {
  const config = configFromEnv(env);
  if (config.environment !== 'dev') throw new Error('Only dev site packaging is supported.');
  const source = resolve(input);
  const target = resolve(out);
  if (!inside(dist, target) || source === target || inside(source, target) || inside(target, source)) {
    throw new Error('Invalid or overlapping package directories.');
  }
  await noLinks(dist);
  if (await realpath(dist) !== dist) throw new Error('Redirected output root.');
  const files = await listSiteFiles(source, { compiled: true });
  // Reject existing links at every target ancestor, including dangling links.
  let ancestor = target;
  while (true) {
    try { await noLinks(ancestor); break; }
    catch (error) { if (error.code !== 'ENOENT') throw error; ancestor = dirname(ancestor); }
  }
  try {
    if ((await readdir(target)).length) throw new Error('Package target is not empty.');
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const mapPath = join(dirname(target), 'blobs.json');
  try { await lstat(mapPath); throw new Error('Blob map already exists.'); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  await mkdir(target, { recursive: true });
  for (const name of files) {
    const destination = join(target, name);
    await mkdir(dirname(destination), { recursive: true });
    await copyFile(join(source, name), destination);
  }
  await copyFile(join(scriptDir, '404.html'), join(target, '404.html'));
  await writeConfig(target, { TP_ENV: config.environment, TP_API_URL: config.apiBaseUrl });
  const map = await createBlobMap(target);
  await validateBlobMap(target, map);
  await writeFile(mapPath, JSON.stringify(map, null, 2) + '\n', { flag: 'wx' });
  return { packagePath: target, blobMapPath: mapPath, blobs: map.length };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    if (args.length !== 4 || args[0] !== '--input' || args[2] !== '--out') throw new Error();
    const result = await packageSite({ input: args[1], out: args[3] });
    console.log(`Site package verified: ${result.blobs} blob mappings.`);
  } catch {
    console.error('Site packaging failed. Check inputs, clean output, and the package contract.');
    process.exitCode = 1;
  }
}
