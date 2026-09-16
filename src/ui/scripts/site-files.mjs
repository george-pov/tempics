import { createHash } from 'node:crypto';
import { lstat, readFile, readdir } from 'node:fs/promises';
import { dirname, extname, isAbsolute, join, relative, resolve, sep } from 'node:path';

const types = Object.freeze({
  '.html': 'text/html', '.json': 'application/json', '.js': 'text/javascript',
  '.css': 'text/css', '.svg': 'image/svg+xml', '.woff2': 'font/woff2',
  '.woff': 'font/woff', '.ttf': 'font/ttf', '.otf': 'font/otf',
  '.png': 'image/png', '.ico': 'image/x-icon', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif',
  '.txt': 'text/plain', '.md': 'text/markdown',
});
export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
export function contentType(name) {
  const type = types[extname(name).toLowerCase()];
  if (!type) throw new Error('Unreviewed asset MIME type.');
  return type;
}
export function safeName(name) {
  return typeof name === 'string' && name.length <= 512 &&
    name.split('/').every(part => /^[A-Za-z0-9_-][A-Za-z0-9_.-]*$/.test(part) && !part.endsWith('.')) &&
    !/(^|\/)(local\.settings\.json|config\.json\..*|blobs\.json|manifest\.json|package(?:-lock)?\.json)$/i.test(name) &&
    !/\.map$/i.test(name);
}
export function inside(parent, child) {
  const path = relative(parent, child);
  return path && path !== '..' && !path.startsWith(`..${sep}`) && !isAbsolute(path);
}
export async function noLinks(path) {
  let part = resolve(path);
  while (true) {
    const info = await lstat(part);
    if (info.isSymbolicLink()) throw new Error('Symbolic links are forbidden.');
    const parent = dirname(part);
    if (parent === part) break;
    part = parent;
  }
}
export async function listSiteFiles(root, { compiled = false } = {}) {
  await noLinks(root);
  if (!(await lstat(root)).isDirectory()) throw new Error('Invalid site directory.');
  const files = [];
  async function walk(directory, prefix = '') {
    for (const item of await readdir(directory, { withFileTypes: true })) {
      const name = prefix + item.name;
      if (!safeName(name) || item.isSymbolicLink()) throw new Error('Forbidden site entry.');
      if (name !== 'config.json' && /(^|\/)config\.json$/i.test(name)) throw new Error('Unexpected configuration file.');
      if (item.isDirectory()) await walk(join(directory, item.name), `${name}/`);
      else if (item.isFile()) {
        if (compiled && ['config.json', '404.html', 'component-lab', 'component-lab/index.html'].includes(name)) {
          throw new Error('Compiled artifact contains deployment configuration or route entries.');
        }
        contentType(name);
        files.push(name);
      } else throw new Error('Only regular files are allowed.');
    }
  }
  await walk(root);
  if (!files.includes('index.html')) throw new Error('Missing index.html.');
  return files.sort();
}
export async function siteHashes(root, options) {
  const files = await listSiteFiles(root, options);
  return Object.fromEntries(await Promise.all(files.map(async name => [name, sha256(await readFile(join(root, name)))])));
}
