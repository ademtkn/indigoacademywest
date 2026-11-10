// Builds the site into ./docs (GitHub Pages serves main /docs).
// Usage: node src/build.mjs [--preview]   (--preview also writes docs/preview.html for the Claude artifact preview)
// The pages come from src/site.mjs; the admin panel runs the same generator in the browser when it publishes.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { generate } from './site.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'docs');
const readJSON = (f) => JSON.parse(fs.readFileSync(path.join(ROOT, 'content', f), 'utf8'));
const content = { en: readJSON('en.json'), ky: readJSON('ky.json'), ru: readJSON('ru.json'), site: readJSON('site.json') };
if (fs.existsSync(path.join(ROOT, 'content', 'editors.json'))) content.editors = readJSON('editors.json');

// A photo's version is the start of its git blob id: the admin panel computes the same value from the repository tree.
const imageVersion = (rel) => {
  const f = path.join(ROOT, 'assets', 'img', rel);
  if (!fs.existsSync(f)) return null;
  const data = fs.readFileSync(f);
  return crypto.createHash('sha1').update(`blob ${data.length}\0`).update(data).digest('hex').slice(0, 8);
};
const { files, count } = generate({ content, imageVersion, preview: process.argv.includes('--preview') });

fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(DIST, { recursive: true });
fs.cpSync(path.join(ROOT, 'assets'), path.join(DIST, 'assets'), { recursive: true });
// Admin panel, plus a copy of the generator it runs when publishing
fs.cpSync(path.join(ROOT, 'admin'), path.join(DIST, 'admin'), { recursive: true });
fs.mkdirSync(path.join(DIST, 'admin', 'lib'), { recursive: true });
for (const f of ['site.mjs', 'icons.mjs']) fs.copyFileSync(path.join(ROOT, 'src', f), path.join(DIST, 'admin', 'lib', f));
for (const [rel, text] of Object.entries(files)) {
  fs.mkdirSync(path.dirname(path.join(ROOT, rel)), { recursive: true });
  fs.writeFileSync(path.join(ROOT, rel), text);
}
console.log(`Built ${count} pages in 3 languages → docs/`);
