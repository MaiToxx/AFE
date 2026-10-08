// Génère la paire de clés de signature des licences.
//   node scripts/license/keygen.mjs [--force]
// - scripts/license/private.jwk     : SECRET, jamais commité (voir .gitignore). À sauvegarder hors ligne.
// - src/lib/license-public-key.ts   : clé publique embarquée dans l'application.
import { generateKeyPairSync } from 'node:crypto';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const privPath = resolve(here, 'private.jwk');
const pubPath = resolve(here, '../../src/lib/license-public-key.ts');

if (existsSync(privPath) && !process.argv.includes('--force')) {
  console.error(`Refus : ${privPath} existe déjà.\nRégénérer la paire rendrait TOUTES les licences déjà émises invalides. Relancez avec --force si c'est vraiment voulu.`);
  process.exit(1);
}

const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
mkdirSync(dirname(privPath), { recursive: true });
writeFileSync(privPath, JSON.stringify(privateKey.export({ format: 'jwk' }), null, 2) + '\n', { mode: 0o600 });
const pub = publicKey.export({ format: 'jwk' });
const header =
  '// Clé publique de vérification des licences (ECDSA P-256). Générée par scripts/license/keygen.mjs.\n' +
  '// La clé privée correspondante ne doit JAMAIS être distribuée ni commitée.\n';
writeFileSync(pubPath, header + 'export const PUBLIC_KEY_JWK = ' + JSON.stringify({ kty: pub.kty, crv: pub.crv, x: pub.x, y: pub.y }, null, 2) + ' as const;\n');
console.log('Clé privée  : ' + privPath + '\n  -> SECRET. Sauvegardez-la (coffre de mots de passe, clé USB). Sans elle, impossible d\'émettre de nouvelles licences.');
console.log('Clé publique : ' + pubPath + '\n  -> embarquée dans l\'application, à commiter.');
