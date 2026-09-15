import { randomUUID } from 'node:crypto';
import { lstat, open, realpath, rename, unlink } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateConfig } from '../src/app/shared/config/validate-config.ts';

const uiRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export function configFromEnv(env) {
  for (const name of ['TP_ENV', 'TP_API_URL']) {
    if (typeof env[name] !== 'string' || !env[name].trim()) {
      throw new Error(`Missing ${name}`);
    }
  }
  const config = validateConfig({ environment: env.TP_ENV, apiBaseUrl: env.TP_API_URL });
  if (config.environment === 'local') throw new Error('Invalid TP_ENV for packaging');
  return config;
}

function isInside(parent, child) {
  const path = relative(parent, child);
  return path !== '' && path !== '..' && !path.startsWith(`..${sep}`) && !isAbsolute(path);
}

async function outputDir(out) {
  try {
    if (typeof out !== 'string' || !out.trim()) throw new Error();
    const distPath = join(uiRoot, 'dist');
    const targetPath = resolve(out);
    if (!isInside(distPath, targetPath)) throw new Error();
    const [root, dist, target] = await Promise.all([
      realpath(uiRoot),
      realpath(distPath),
      realpath(targetPath),
    ]);
    // Reject a redirected dist itself as well as symlinks/junctions escaping it.
    if (dist !== join(root, 'dist') || !isInside(dist, target)) throw new Error();
    if (!(await lstat(target)).isDirectory()) throw new Error();
    const index = await lstat(join(target, 'index.html'));
    if (!index.isFile() || index.isSymbolicLink()) throw new Error();
    return target;
  } catch {
    throw new Error('Invalid output directory');
  }
}

export async function writeConfig(out, env) {
  const config = configFromEnv(env);
  const content = `${JSON.stringify(config, null, 2)}\n`;
  const directory = await outputDir(out);
  const temporary = join(directory, `config.json.${randomUUID()}.tmp`);
  let owned = false;
  try {
    // Exclusive creation prevents cleanup from touching a pre-existing file.
    const file = await open(temporary, 'wx');
    owned = true;
    try {
      await file.writeFile(content, 'utf8');
    } finally {
      await file.close();
    }
    await rename(temporary, join(directory, 'config.json'));
  } catch {
    throw new Error('Configuration write failed');
  } finally {
    if (owned) await unlink(temporary).catch(() => {});
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    if (args.length !== 2 || args[0] !== '--out' || args[1].startsWith('--')) {
      throw new Error('Usage: config:write --out <existing-ui-output>');
    }
    await writeConfig(args[1], process.env);
    console.log('Runtime configuration written.');
  } catch (error) {
    // All errors from the public boundaries above have safe, fixed messages.
    console.error(error.message);
    process.exitCode = 1;
  }
}
