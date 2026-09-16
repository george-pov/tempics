import test from 'node:test';
import assert from 'node:assert/strict';
import { copyFile, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createBlobMap, packageSite, siteHashes, validateBlobMap } from './package-site.mjs';
import { createArtifact, verifyArtifact } from '../../../deployment/ui-artifact.mjs';

const dist = resolve(dirname(fileURLToPath(import.meta.url)), '../dist');
const repo = resolve(dist, '../../..');
const env = { TP_ENV: 'dev', TP_API_URL: 'https://dev.example.test/api', PRIVATE_TOKEN: 'fixture-secret' };
async function fixture(t) {
  await mkdir(dist, { recursive: true });
  const root = await mkdtemp(join(dist, 'site-test-'));
  t.after(async () => { assert.ok(root.startsWith(dist + sep)); await rm(root, { recursive: true, force: true }); });
  const input = join(root, 'input');
  await mkdir(join(input, 'assets'), { recursive: true });
  await writeFile(join(input, 'index.html'), '<!doctype html><base href="/"><app-root></app-root>');
  await writeFile(join(input, 'main.js'), 'compiled');
  await writeFile(join(input, 'assets/font.woff2'), 'font');
  await writeFile(join(input, 'assets/LICENSE.txt'), 'license');
  await writeFile(join(input, 'assets/SOURCE.md'), 'attribution');
  return { root, input, out: join(root, 'site/package'), env };
}
test('package includes routes/error/config without changing any compiled bytes', async t => {
  const f = await fixture(t); const before = await siteHashes(f.input);
  const result = await packageSite(f);
  assert.deepEqual(await siteHashes(f.input), before);
  const map = JSON.parse(await readFile(result.blobMapPath));
  await validateBlobMap(f.out, map);
  for (const name of ['index.html', 'component-lab', 'component-lab/index.html']) {
    const item = map.find(entry => entry.name === name);
    assert.equal(item.source, 'index.html'); assert.equal(item.contentType, 'text/html');
  }
  const config = await readFile(join(f.out, 'config.json'), 'utf8');
  assert.deepEqual(JSON.parse(config), { environment: 'dev', apiBaseUrl: env.TP_API_URL });
  assert.ok(!config.includes(env.PRIVATE_TOKEN));
  const page = await readFile(join(f.out, '404.html'), 'utf8');
  assert.doesNotMatch(page, /<script|<app-root|onload=/i);
  for (const [name, hash] of Object.entries(before)) assert.equal(map.find(item => item.source === name).sha256, hash);
});
test('rejects config, settings, source maps, unknown MIME, missing index and invalid env', async t => {
  for (const name of ['config.json', 'config.json.tmp', '.env', 'local.settings.json', 'main.js.map', 'private.bin']) {
    const f = await fixture(t); await writeFile(join(f.input, name), 'private');
    await assert.rejects(packageSite(f));
  }
  const f = await fixture(t);
  await assert.rejects(packageSite({ ...f, env: { ...env, TP_ENV: 'prod' } }));
  await assert.rejects(packageSite({ ...f, env: { ...env, TP_API_URL: '/api' } }));
  await rm(join(f.input, 'index.html'));
  await assert.rejects(packageSite(f), /Missing index/);
});
test('rejects overlaps, existing output and linked trees without altering source', async t => {
  const f = await fixture(t);
  for (const out of [f.input, join(f.input, 'nested'), f.root, repo]) await assert.rejects(packageSite({ ...f, out }));
  await mkdir(f.out, { recursive: true }); await writeFile(join(f.out, 'sentinel'), 'keep');
  await assert.rejects(packageSite(f)); assert.equal(await readFile(join(f.out, 'sentinel'), 'utf8'), 'keep');
  const other = await fixture(t);
  await symlink(f.input, join(other.input, 'escape'), process.platform === 'win32' ? 'junction' : 'dir');
  await assert.rejects(packageSite(other));
  const linked = join(other.root, 'linked');
  await symlink(f.input, linked, process.platform === 'win32' ? 'junction' : 'dir');
  await assert.rejects(packageSite({ ...other, input: linked }));
});
test('map rejects escaping sources, duplicate destinations and altered config fields', async t => {
  const f = await fixture(t); const result = await packageSite(f);
  const map = JSON.parse(await readFile(result.blobMapPath));
  await assert.rejects(createBlobMap(f.out, ['../outside.js']));
  await assert.rejects(createBlobMap(f.out, ['index.html', 'index.html']));
  await assert.rejects(validateBlobMap(f.out, [...map, map[0]]));
  const config = JSON.parse(await readFile(join(f.out, 'config.json'))); config.extra = env.PRIVATE_TOKEN;
  await writeFile(join(f.out, 'config.json'), JSON.stringify(config));
  await assert.rejects(validateBlobMap(f.out, await createBlobMap(f.out)));
});
test('artifact verifies revision, lockfile and exact compiled file set', async t => {
  const f = await fixture(t);
  const options = { input: f.input, artifact: join(f.root, 'artifact'), sourceSha: '1'.repeat(40), runId: '1', runAttempt: '1' };
  await createArtifact(options); await verifyArtifact(options);
  await assert.rejects(verifyArtifact({ ...options, sourceSha: '2'.repeat(40) }));
  await writeFile(join(options.artifact, 'browser/main.js'), 'changed');
  await assert.rejects(verifyArtifact(options));
});
test('PowerShell inspect validates complete map and orders root entry last without Azure', async t => {
  const f = await fixture(t); const result = await packageSite(f);
  function inspect() {
    return spawnSync('pwsh', ['-NoProfile', '-File', join(repo, 'deployment/Publish-Ui.ps1'),
      '-PackagePath', f.out, '-BlobMapPath', result.blobMapPath, '-InspectOnly'], { encoding: 'utf8' });
  }
  const good = inspect(); assert.equal(good.status, 0, good.stderr);
  assert.match(good.stdout, /component-lab\/index.html/);
  const rows = good.stdout.trim().split(/\r?\n/);
  assert.match(rows.at(-1), /^index.html\s+index.html/);
  const map = JSON.parse(await readFile(result.blobMapPath));
  for (const edit of [entries => entries[0].source = '../outside.js', entries => entries[0].contentType = 'application/octet-stream',
    entries => entries[0].sha256 = '0'.repeat(64), entries => entries.push(entries[0]), entries => entries.pop()]) {
    const bad = structuredClone(map); edit(bad);
    await writeFile(result.blobMapPath, JSON.stringify(bad));
    assert.notEqual(inspect().status, 0);
  }
});
test('uploader uses login only, uploads root last and stops on the first failed write', async t => {
  const f = await fixture(t); const result = await packageSite(f);
  const sandbox = join(f.root, 'mock');
  await mkdir(join(sandbox, 'deployment'), { recursive: true });
  await mkdir(join(sandbox, 'src/ui/scripts'), { recursive: true });
  const script = join(sandbox, 'deployment/Publish-Ui.ps1');
  await copyFile(join(repo, 'deployment/Publish-Ui.ps1'), script);
  await copyFile(join(repo, 'src/ui/scripts/404.html'), join(sandbox, 'src/ui/scripts/404.html'));
  await writeFile(join(sandbox, 'deployment/DevSetup.psm1'), `
function Invoke-DevCli {
  param($Tool, $Arguments, $InputText, $Operation)
  $script:Count++
  ConvertTo-Json -InputObject $Arguments -Compress | Add-Content -LiteralPath $env:UI_CALLS_PATH
  if ($script:Count -eq [int]$env:UI_FAIL_AT) { throw 'Fixture write failure' }
}
$script:Count = 0
Export-ModuleMember -Function Invoke-DevCli
`);
  // Only a public dev URL is required by the real upload preflight.
  await writeFile(join(f.out, 'config.json'), JSON.stringify({ environment: 'dev', apiBaseUrl: 'https://func-tempics-api-dev.azurewebsites.net/api' }));
  const map = await createBlobMap(f.out); await writeFile(result.blobMapPath, JSON.stringify(map));
  const capture = join(f.root, 'calls.jsonl');
  function publish(fail) {
    return spawnSync('pwsh', ['-NoProfile', '-File', script, '-PackagePath', f.out, '-BlobMapPath', result.blobMapPath],
      { encoding: 'utf8', env: { ...process.env, AZURE_SUBSCRIPTION_ID: '1'.repeat(8) + '-1111-1111-1111-111111111111',
        AZURE_UI_STORAGE: 'sttempicsuidev', UI_CALLS_PATH: capture, UI_FAIL_AT: String(fail) } });
  }
  const passed = publish(0); assert.equal(passed.status, 0, passed.stderr);
  const calls = (await readFile(capture, 'utf8')).trim().split(/\r?\n/).map(JSON.parse);
  assert.equal(calls.length, map.length);
  assert.equal(calls.at(-1)[calls.at(-1).indexOf('--name') + 1], 'index.html');
  for (const args of calls) {
    assert.deepEqual(args.slice(0, 3), ['storage', 'blob', 'upload']);
    assert.equal(args[args.indexOf('--auth-mode') + 1], 'login');
    assert.equal(args[args.indexOf('--container-name') + 1], '$web');
    assert.equal(args[args.indexOf('--content-cache-control') + 1], 'no-store');
    assert.ok(!args.includes('--account-key') && !args.includes('delete'));
  }
  await writeFile(capture, '');
  const failed = publish(2); assert.notEqual(failed.status, 0);
  assert.match(failed.stderr, /after 1\//);
  assert.equal((await readFile(capture, 'utf8')).trim().split(/\r?\n/).length, 2);
});
