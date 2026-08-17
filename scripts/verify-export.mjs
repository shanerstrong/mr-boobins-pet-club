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
  { name: 'cozy music', stem: 'pet-room-cozy.v1.', extension: '.wav' },
  { name: 'play music', stem: 'pet-room-play.v1.', extension: '.wav' },
  { name: 'sleep music', stem: 'pet-room-sleep.v1.', extension: '.wav' },
  { name: 'alert bark SFX', stem: 'jack-alert-bark.v1.', extension: '.wav' },
  { name: 'happy bark SFX', stem: 'jack-happy-bark.v1.', extension: '.wav' },
  { name: 'sleepy grumble SFX', stem: 'jack-sleepy-grumble.v1.', extension: '.wav' },
  { name: 'yawn SFX', stem: 'jack-yawn.v1.', extension: '.wav' },
  { name: 'sneeze SFX', stem: 'jack-sneeze.v1.', extension: '.wav' },
  { name: 'huff SFX', stem: 'jack-huff.v1.', extension: '.wav' },
  { name: 'wet-shake SFX', stem: 'jack-wet-shake.v1.', extension: '.wav' },
  { name: 'toy-squeak SFX', stem: 'jack-toy-squeak.v1.', extension: '.wav' },
  { name: 'treat-crunch SFX', stem: 'jack-treat-crunch.v1.', extension: '.wav' },
  { name: 'success chime', stem: 'training-success-chime.v1.', extension: '.wav' },
  { name: 'treat toss', stem: 'training-treat-toss.v1.', extension: '.wav' },
  { name: 'treat catch', stem: 'training-treat-catch.v1.', extension: '.wav' },
  { name: 'celebration accent', stem: 'training-celebration-accent.v1.', extension: '.wav' },
  { name: 'command selected UI', stem: 'ui-command-selected.master.v1.', extension: '.wav' },
  { name: 'tap UI', stem: 'ui-tap.master.v1.', extension: '.wav' },
  { name: 'open UI', stem: 'ui-open.master.v1.', extension: '.wav' },
  { name: 'close UI', stem: 'ui-close.master.v1.', extension: '.wav' },
  { name: 'confirm UI', stem: 'ui-confirm.master.v1.', extension: '.wav' },
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
