import { readdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
const root = path.resolve('dist/client');
async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  return (await Promise.all(entries.map(async (entry) => entry.isDirectory() ? walk(path.join(dir, entry.name)) : path.join(dir, entry.name)))).flat();
}
// Hosting metadata / dotfiles are not app resources and may be excluded by Pages.
const files = (await walk(root)).filter((file) => {
  const relative = path.relative(root, file);
  return !relative.split(path.sep).some((part) => part.startsWith('.')) &&
    relative !== 'sw.js' && relative !== '_headers' && !file.endsWith('.map');
}).sort();
const hash = createHash('sha256');
for (const file of files) { hash.update(path.relative(root, file)); hash.update(await readFile(file)); }
const template = await readFile('public/sw.js', 'utf8');
hash.update(template);
const version = hash.digest('hex').slice(0, 16);
const paths = files.map((file) => path.relative(root, file)).map((file) => file === 'index.html' ? './' : file);
const sw = template.replace("'xiaozhou-care-v02-dev'", `'xiaozhou-care-v02-${version}'`).replace(/const PRECACHE_PATHS = .*?; \/\/ Build adds all JS\/CSS chunks\./, `const PRECACHE_PATHS = ${JSON.stringify(paths)};`);
await writeFile(path.join(root, 'sw.js'), sw);
await writeFile(path.join(root, '.nojekyll'), '');
console.log(`V0.2 offline cache ${version}: ${paths.length} assets`);
