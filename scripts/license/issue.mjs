// Émet une clé de licence signée.
//   node scripts/license/issue.mjs --name "Jean Dupont" --email jean@exemple.fr
//        [--plan perpetuelle|abonnement] [--expires 2027-12-31] [--max-major 1] [--note "commande #123"]
// La clé est affichée et consignée dans scripts/license/registre.csv (non commité).
import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodeKey, encodeKey, newId, readPublicJwk } from './lib.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf('--' + name);
  return i >= 0 ? args[i + 1] : def;
};
const name = opt('name');
const email = opt('email');
const plan = opt('plan', 'perpetuelle');
const expires = opt('expires');
const maxMajor = opt('max-major');
const note = opt('note', '');

if (!name || !email) {
  console.error('Usage : node scripts/license/issue.mjs --name "Nom" --email adresse [--plan perpetuelle|abonnement] [--expires AAAA-MM-JJ] [--max-major N] [--note "..."]');
  process.exit(1);
}
if (!['perpetuelle', 'abonnement'].includes(plan)) throw new Error('--plan doit valoir perpetuelle ou abonnement');
if (plan === 'abonnement' && !expires) throw new Error('--expires est obligatoire pour un abonnement');
if (expires && !/^\d{4}-\d{2}-\d{2}$/.test(expires)) throw new Error('--expires attend le format AAAA-MM-JJ');

const privPath = resolve(here, 'private.jwk');
if (!existsSync(privPath)) throw new Error('Clé privée absente (' + privPath + '). Lancez d\'abord keygen.mjs.');
const privateJwk = JSON.parse(readFileSync(privPath, 'utf8'));
const publicJwk = readPublicJwk(readFileSync(resolve(here, '../../src/lib/license-public-key.ts'), 'utf8'));

const payload = {
  v: 1,
  id: newId(),
  name: name.trim(),
  email: email.trim().toLowerCase(),
  plan,
  issued: new Date().toISOString().slice(0, 10),
  ...(expires ? { expires } : {}),
  ...(maxMajor !== undefined ? { maxMajor: Number(maxMajor) } : {}),
  ...(note ? { note } : {}),
};
const key = encodeKey(payload, privateJwk);
const check = decodeKey(key, publicJwk);
if (!check.ok) throw new Error('Auto-vérification échouée : ' + check.reason + '. La clé publique embarquée ne correspond pas à la clé privée.');

const registre = resolve(here, 'registre.csv');
if (!existsSync(registre)) writeFileSync(registre, 'id;date;nom;email;plan;expire;maxMajor;note;cle\n');
const csv = (s) => '"' + String(s ?? '').replace(/"/g, '""') + '"';
appendFileSync(registre, [payload.id, payload.issued, payload.name, payload.email, plan, expires ?? '', maxMajor ?? '', note, key].map(csv).join(';') + '\n');

console.log('Licence ' + payload.id + ' — ' + payload.name + ' <' + payload.email + '> — ' + plan + (expires ? ' jusqu\'au ' + expires : '') + (maxMajor !== undefined ? ' (versions <= ' + maxMajor + '.x)' : '') + '\n');
console.log(key);
console.log('\nConsignée dans ' + registre);
