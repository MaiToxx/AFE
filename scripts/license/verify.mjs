// Vérifie une clé de licence avec la clé publique embarquée.
//   node scripts/license/verify.mjs "AFE1-..."
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodeKey, readPublicJwk } from './lib.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const key = process.argv[2];
if (!key) {
  console.error('Usage : node scripts/license/verify.mjs "AFE1-..."');
  process.exit(1);
}
const publicJwk = readPublicJwk(readFileSync(resolve(here, '../../src/lib/license-public-key.ts'), 'utf8'));
const r = decodeKey(key, publicJwk);
if (!r.ok) {
  console.error('INVALIDE : ' + r.reason);
  process.exit(2);
}
console.log('VALIDE');
console.log(JSON.stringify(r.payload, null, 2));
