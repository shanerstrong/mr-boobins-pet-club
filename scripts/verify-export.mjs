import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { basename, join } from 'node:path';

const dist = join(process.cwd(), 'dist');
const index = join(dist, 'index.html');
const expoAssets = join(dist, '_expo');
const missing = [index, expoAssets].filter((entry) => !existsSync(entry));

if (missing.length > 0) {
  throw new Error(`Static export is missing: ${missing.map((entry) => basename(entry)).join(', ')}`);
}

if (!statSync(index).isFile() || statSync(index).size === 0) {
  throw new Error('Static export index.html is not a non-empty file.');
}

if (!statSync(expoAssets).isDirectory() || readdirSync(expoAssets).length === 0) {
  throw new Error('Static export has no bundled assets.');
}

function walk(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });
}

const files = walk(dist);
const normalizedFiles = files.map((file) => file.replaceAll('\\', '/'));
const entryBundles = files.filter(
  (file) => /[/\\]_expo[/\\]static[/\\]js[/\\]web[/\\]entry-.*\.js$/.test(file),
);
if (
  entryBundles.length !== 1 ||
  !statSync(entryBundles[0]).isFile() ||
  statSync(entryBundles[0]).size === 0
) {
  throw new Error('Static export does not contain exactly one non-empty web entry bundle.');
}

const entrySource = readFileSync(entryBundles[0], 'utf8');
const requiredAssets = [
  { name: 'Jack Baby GLB', stem: 'jack-baby-v2-all-clips.', extension: '.glb' },
  { name: 'idle music', stem: 'music-idle.', extension: '.wav' },
  { name: 'play music', stem: 'music-play.', extension: '.wav' },
  { name: 'sleep music', stem: 'music-sleep.', extension: '.wav' },
  { name: 'bark SFX', stem: 'bark.', extension: '.wav' },
  { name: 'happy SFX', stem: 'happy.', extension: '.wav' },
  { name: 'sleepy SFX', stem: 'sleepy.', extension: '.wav' },
  { name: 'shower SFX', stem: 'shower.', extension: '.wav' },
  { name: 'sneeze SFX', stem: 'sneeze.', extension: '.wav' },
  { name: 'huff SFX', stem: 'huff.', extension: '.wav' },
];
const invalidAssets = requiredAssets.filter(({ stem, extension }) => {
  const index = normalizedFiles.findIndex(
    (file) => file.includes(stem) && file.endsWith(extension),
  );
  if (index < 0) return true;
  const asset = files[index];
  return (
    !statSync(asset).isFile() ||
    statSync(asset).size === 0 ||
    !entrySource.includes(basename(asset))
  );
});

if (invalidAssets.length > 0) {
  throw new Error(
    `Static export has missing, empty, mistyped, or unreferenced runtime assets: ${invalidAssets
      .map(({ name }) => name)
      .join(', ')}`,
  );
}

console.log(
  `Static web export contains a non-empty index, one web entry bundle, and ${requiredAssets.length} non-empty referenced runtime assets.`,
);
