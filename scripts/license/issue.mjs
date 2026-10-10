// Émet une clé de licence signée (ligne de commande ; l'interface équivalente : admin.mjs).
//   node scripts/license/issue.mjs --name "Jean Dupont" --email jean@exemple.fr
//        [--plan perpetuelle|abonnement] [--expires 2027-12-31] [--periode mensuel|annuel]
//        [--max-major 1] [--note "commande #123"] [--langue fr]
// La clé est affichée et consignée dans le registre (non commité). La note reste dans le registre :
// elle n'est pas inscrite dans la clé.
import { existsSync, readFileSync } from 'node:fs';
import { readPublicJwk } from './lib.mjs';
import { CHEMINS, ecrireRegistre, lireRegistre, memesCles, nouvelleLigne, publiqueDepuisPrivee, validerSaisie } from './registre.mjs';

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf('--' + name);
  return i >= 0 ? args[i + 1] : def;
};
const name = opt('name');
const email = opt('email');
const plan = opt('plan', 'perpetuelle');

if (!name || !email) {
  console.error('Usage : node scripts/license/issue.mjs --name "Nom" --email adresse [--plan perpetuelle|abonnement] [--expires AAAA-MM-JJ] [--periode mensuel|annuel] [--max-major N] [--note "..."] [--langue fr]');
  process.exit(1);
}
if (!['perpetuelle', 'abonnement'].includes(plan)) throw new Error('--plan doit valoir perpetuelle ou abonnement');

if (!existsSync(CHEMINS.clePrivee)) throw new Error('Clé privée absente (' + CHEMINS.clePrivee + "). Lancez d'abord keygen.mjs.");
const privateJwk = JSON.parse(readFileSync(CHEMINS.clePrivee, 'utf8'));
const publicJwk = readPublicJwk(readFileSync(CHEMINS.clePublique, 'utf8'));
if (!memesCles(publiqueDepuisPrivee(privateJwk), publicJwk)) {
  throw new Error("La clé privée ne correspond pas à la clé publique embarquée dans l'application : la licence serait refusée.");
}

const { lignes, extras } = lireRegistre();
const v = validerSaisie(
  { nom: name, email, plan, expire: opt('expires', ''), periode: opt('periode', ''), maxMajor: opt('max-major', ''), note: opt('note', ''), langue: opt('langue', 'fr') },
  lignes,
  undefined,
  { passeAutorise: true },
);
if (!v.ok) throw new Error(Object.values(v.erreurs).join(' '));

const ligne = nouvelleLigne(v.valeur, lignes, privateJwk);
ecrireRegistre([...lignes, ligne], extras);

console.log(
  'Licence ' + ligne.id + ' — ' + ligne.nom + ' <' + ligne.email + '> — ' + ligne.plan +
    (ligne.expire ? " jusqu'au " + ligne.expire : '') + (ligne.maxMajor !== '' ? ' (versions <= ' + ligne.maxMajor + '.x)' : '') + '\n',
);
console.log(ligne.cle);
console.log('\nConsignée dans ' + CHEMINS.registre);
