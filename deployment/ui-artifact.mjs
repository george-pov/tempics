import { cp, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { noLinks, sha256, siteHashes } from '../src/ui/scripts/site-files.mjs';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const lockPath = join(repoRoot, 'src/ui/package-lock.json');
function revision({ sourceSha, runId, runAttempt }) {
  if (!/^[a-f0-9]{40}$/.test(sourceSha ?? '') || !/^\d+$/.test(runId ?? '') || !/^\d+$/.test(runAttempt ?? '')) {
    throw new Error('Invalid artifact revision.');
  }
}
export async function createArtifact({ input, artifact, sourceSha, runId, runAttempt }) {
  revision({ sourceSha, runId, runAttempt });
  const assets = await siteHashes(input, { compiled: true });
  await noLinks(dirname(resolve(artifact)));
  await mkdir(artifact); // A pre-existing artifact is never overwritten.
  await cp(input, join(artifact, 'browser'), { recursive: true, errorOnExist: true, force: false });
  const lock = await readFile(lockPath);
  await writeFile(join(artifact, 'package-lock.json'), lock, { flag: 'wx' });
  await writeFile(join(artifact, 'manifest.json'), JSON.stringify({ sourceSha, runId, runAttempt,
    lockSha256: sha256(lock), assets }, null, 2) + '\n', { flag: 'wx' });
  return verifyArtifact({ artifact, sourceSha, runId, runAttempt });
}
export async function verifyArtifact({ artifact, sourceSha, runId, runAttempt }) {
  revision({ sourceSha, runId, runAttempt });
  await noLinks(artifact);
  if ((await readdir(artifact)).sort().join() !== 'browser,manifest.json,package-lock.json') throw new Error('Unexpected artifact contents.');
  for (const name of ['manifest.json', 'package-lock.json']) await noLinks(join(artifact, name));
  const manifest = JSON.parse(await readFile(join(artifact, 'manifest.json'), 'utf8'));
  const lockHash = sha256(await readFile(lockPath));
  if (manifest.sourceSha !== sourceSha || manifest.runId !== runId || manifest.runAttempt !== runAttempt ||
      manifest.lockSha256 !== lockHash || sha256(await readFile(join(artifact, 'package-lock.json'))) !== lockHash) {
    throw new Error('Artifact revision or lockfile mismatch.');
  }
  const assets = await siteHashes(join(artifact, 'browser'), { compiled: true });
  if (!manifest.assets || Object.keys(manifest.assets).sort().join() !== Object.keys(assets).sort().join() ||
      Object.entries(assets).some(([name, hash]) => manifest.assets[name] !== hash)) throw new Error('Artifact bytes mismatch.');
  return manifest;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const [mode, flag, artifact, inputFlag, input] = process.argv.slice(2);
    if (!['create', 'verify'].includes(mode) || flag !== '--artifact' || !artifact ||
        (mode === 'create' ? inputFlag !== '--input' || !input || process.argv.length !== 7 : process.argv.length !== 5)) throw new Error();
    const options = { artifact, input, sourceSha: process.env.GITHUB_SHA,
      runId: process.env.GITHUB_RUN_ID, runAttempt: process.env.GITHUB_RUN_ATTEMPT };
    await (mode === 'create' ? createArtifact(options) : verifyArtifact(options));
    console.log('UI source, lockfile and asset provenance verified.');
  } catch {
    console.error('UI artifact validation failed.'); process.exitCode = 1;
  }
}
