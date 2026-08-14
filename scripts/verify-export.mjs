import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const dist = join(process.cwd(), 'dist');
const required = ['index.html', '_expo'];
const missing = required.filter((entry) => !existsSync(join(dist, entry)));

if (missing.length > 0) {
  throw new Error(`Static export is missing: ${missing.join(', ')}`);
}

if (!statSync(join(dist, '_expo')).isDirectory() || readdirSync(join(dist, '_expo')).length === 0) {
  throw new Error('Static export has no bundled assets.');
}

console.log('Static web export contains index.html and bundled Expo assets.');
