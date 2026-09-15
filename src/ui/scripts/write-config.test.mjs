import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { configFromEnv, writeConfig } from './write-config.mjs';

const uiRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(uiRoot, 'dist');
const dev = { TP_ENV: 'dev', TP_API_URL: 'https://dev.example.test/prefix/api/' };
const prod = { TP_ENV: 'prod', TP_API_URL: 'https://prod.example.test/api' };

async function fixture(t) {
  await mkdir(dist, { recursive: true });
  const dir = await mkdtemp(join(dist, 'config-test-'));
  t.after(async () => {
    assert.ok(resolve(dir).startsWith(`${resolve(dist)}${sep}config-test-`));
    await rm(dir, { recursive: true, force: true });
  });
  await writeFile(join(dir, 'index.html'), '<app-root></app-root>');
  await writeFile(join(dir, 'main.js'), 'compiled script');
  await writeFile(join(dir, 'styles.css'), 'compiled styles');
  return dir;
}

function cli(args, env = dev) {
  return spawnSync(process.execPath, [join(uiRoot, 'scripts/write-config.mjs'), ...args], {
    cwd: uiRoot,
    env: { ...process.env, TP_ENV: '', TP_API_URL: '', ...env },
    encoding: 'utf8',
  });
}

test('allowlists settings, normalizes the prefix and requires explicit hosted inputs', () => {
  assert.deepEqual(configFromEnv({ ...dev, SECRET: 'private' }), {
    environment: 'dev',
    apiBaseUrl: 'https://dev.example.test/prefix/api',
  });
  for (const env of [
    {},
    { TP_ENV: 'dev' },
    { TP_API_URL: prod.TP_API_URL },
    { ...dev, TP_ENV: 'local' },
    { ...dev, TP_ENV: 'stage' },
    { ...dev, TP_API_URL: '/api' },
    { ...dev, TP_API_URL: 'https://127.1/api' },
    { ...dev, TP_API_URL: 'https://user:private@example.test' },
  ])
    assert.throws(() => configFromEnv(env));
});

test('replaces config on Windows while preserving all compiled bytes', async (t) => {
  const dir = await fixture(t);
  const files = await readdir(dir);
  const before = await Promise.all(files.map((file) => readFile(join(dir, file))));
  await writeConfig(dir, dev);
  assert.equal(JSON.parse(await readFile(join(dir, 'config.json'), 'utf8')).environment, 'dev');
  await writeConfig(dir, prod);
  assert.deepEqual(JSON.parse(await readFile(join(dir, 'config.json'), 'utf8')), {
    environment: 'prod',
    apiBaseUrl: prod.TP_API_URL,
  });
  assert.deepEqual(await readdir(dir), ['config.json', ...files].sort());
  assert.deepEqual(await Promise.all(files.map((file) => readFile(join(dir, file)))), before);
});

test('invalid inputs preserve previous configuration and leave no temporary files', async (t) => {
  const dir = await fixture(t);
  await writeConfig(dir, dev);
  const before = await readFile(join(dir, 'config.json'));
  await assert.rejects(writeConfig(dir, { ...prod, TP_API_URL: 'private invalid value' }));
  assert.deepEqual(await readFile(join(dir, 'config.json')), before);
  assert.equal((await readdir(dir)).filter((name) => name.startsWith('config.json.')).length, 0);
});

test('rename failure preserves the destination and cleans its owned temporary file', async (t) => {
  const dir = await fixture(t);
  await mkdir(join(dir, 'config.json'));
  await writeFile(join(dir, 'config.json', 'sentinel'), 'original');
  await assert.rejects(writeConfig(dir, dev), /Configuration write failed/);
  assert.equal(await readFile(join(dir, 'config.json', 'sentinel'), 'utf8'), 'original');
  assert.equal((await readdir(dir)).filter((name) => name.startsWith('config.json.')).length, 0);
});

test('rejects missing outputs, source/public paths, index-free outputs and symlink escapes', async (t) => {
  const dir = await fixture(t);
  const empty = join(dir, 'empty');
  await mkdir(empty);
  const escape = join(dir, 'escape');
  await symlink(join(uiRoot, 'public'), escape, process.platform === 'win32' ? 'junction' : 'dir');
  for (const out of [
    undefined,
    '',
    join(dir, 'missing'),
    uiRoot,
    join(uiRoot, 'public'),
    dist,
    empty,
    escape,
  ]) {
    await assert.rejects(writeConfig(out, dev), /Invalid output directory/);
  }
});

test('JSON serialization safely handles quotes and encoded path characters', async (t) => {
  const dir = await fixture(t);
  await writeConfig(dir, { ...dev, TP_API_URL: 'https://dev.example.test/a"b/%24value/api' });
  const json = await readFile(join(dir, 'config.json'), 'utf8');
  assert.ok(json.endsWith('\n'));
  assert.equal(JSON.parse(json).apiBaseUrl, 'https://dev.example.test/a%22b/%24value/api');
});

test('CLI succeeds for dev/prod and prints no settings', async (t) => {
  const dir = await fixture(t);
  for (const env of [dev, prod]) {
    const result = cli(['--out', dir], env);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(
      JSON.parse(await readFile(join(dir, 'config.json'), 'utf8')).environment,
      env.TP_ENV,
    );
    assert.equal(result.stdout.trim(), 'Runtime configuration written.');
    assert.equal(result.stderr, '');
  }
});

test('CLI rejects bad flags and inputs with safe nonzero output', async (t) => {
  const dir = await fixture(t);
  await writeConfig(dir, dev);
  const original = await readFile(join(dir, 'config.json'));
  const secret = 'private-canary';
  for (const [args, env] of [
    [[], dev],
    [['--unknown', secret], dev],
    [['--out'], dev],
    [['--out', dir, '--extra', secret], dev],
    [['--out', dir], {}],
    [['--out', dir], { TP_ENV: 'prod' }],
    [['--out', dir], { ...dev, TP_ENV: 'local' }],
    [['--out', dir], { ...dev, TP_API_URL: secret }],
    [['--out', join(dir, secret)], dev],
  ]) {
    const result = cli(args, env);
    assert.equal(result.status, 1);
    assert.doesNotMatch(result.stdout + result.stderr, /private-canary|https:|SECRET|at outputDir/);
    assert.deepEqual(await readFile(join(dir, 'config.json')), original);
  }
});
