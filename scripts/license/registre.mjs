// Registre des licences émises (CSV « ; », UTF-8) et émission des clés. Partagé par la ligne de
// commande (issue.mjs) et l'interface de gestion (admin.mjs).
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodeKey, encodeKey, newId } from './lib.mjs';

const ICI = dirname(fileURLToPath(import.meta.url));
/** Dossier des secrets (clé privée, registre) : celui des scripts, ou AFE_LICENCES_DIR (disque chiffré, clé USB…). */
const SECRETS = process.env.AFE_LICENCES_DIR ? resolve(process.env.AFE_LICENCES_DIR) : ICI;

export const CHEMINS = {
  registre: join(SECRETS, 'registre.csv'),
  clePrivee: join(SECRETS, 'private.jwk'),
  clePublique: resolve(ICI, '../../src/lib/license-public-key.ts'),
  revocations: resolve(ICI, '../../src/lib/revoked.ts'),
  paquet: resolve(ICI, '../../package.json'),
};

/** Colonnes du registre. Les neuf premières sont celles d'origine ; les suivantes sont facultatives. */
export const COLONNES = ['id', 'date', 'nom', 'email', 'plan', 'expire', 'maxMajor', 'note', 'cle', 'periode', 'remplace', 'revoquee', 'langue'];
export const LANGUES = ['fr', 'en', 'es', 'de', 'it', 'pt', 'nl'];
export const PERIODES = ['', 'mensuel', 'annuel'];

// ---------------------------------------------------------------------------------- dates

const pad = (n) => String(n).padStart(2, '0');
const fmt = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** Date du jour en heure locale (AAAA-MM-JJ). */
export function aujourdhui() {
  return fmt(new Date());
}

export function isoValide(iso) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(iso))) return false;
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
}

/** Ajoute n mois en restant dans le mois visé (31 janvier + 1 mois = 28 ou 29 février). */
export function ajouterMois(iso, n) {
  const [y, m, d] = iso.split('-').map(Number);
  const cible = new Date(y, m - 1 + n, 1);
  const dernier = new Date(cible.getFullYear(), cible.getMonth() + 1, 0).getDate();
  return fmt(new Date(cible.getFullYear(), cible.getMonth(), Math.min(d, dernier)));
}

// ------------------------------------------------------------------------------------ CSV

/** Analyse un CSV (séparateur « ; », champs éventuellement entre guillemets, "" pour un guillemet). */
export function parseCSV(texte, sep = ';') {
  const s = String(texte).replace(/^﻿/, '');
  const lignes = [];
  let ligne = [];
  let champ = '';
  let entreGuillemets = false;
  let guillemetsVus = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (entreGuillemets) {
      if (c === '"') {
        if (s[i + 1] === '"') {
          champ += '"';
          i++;
        } else entreGuillemets = false;
      } else champ += c;
      continue;
    }
    if (c === '"' && champ === '' && !guillemetsVus) {
      entreGuillemets = true;
      guillemetsVus = true;
    } else if (c === sep) {
      ligne.push(champ);
      champ = '';
      guillemetsVus = false;
    } else if (c === '\n') {
      ligne.push(champ);
      lignes.push(ligne);
      ligne = [];
      champ = '';
      guillemetsVus = false;
    } else if (c !== '\r') champ += c;
  }
  if (champ !== '' || guillemetsVus || ligne.length) {
    ligne.push(champ);
    lignes.push(ligne);
  }
  return lignes.filter((l) => l.some((x) => x !== ''));
}

const csv = (v) => '"' + String(v ?? '').replace(/"/g, '""') + '"';

/**
 * Lit le registre. Tolère l'ancien format à neuf colonnes et conserve les colonnes inconnues
 * (ajoutées à la main dans un tableur) dans `extras`.
 */
export function lireRegistre(chemin = CHEMINS.registre) {
  if (!existsSync(chemin)) return { lignes: [], extras: [] };
  const brut = parseCSV(readFileSync(chemin, 'utf8'));
  if (!brut.length) return { lignes: [], extras: [] };
  const entete = brut[0].map((x) => x.trim());
  if (!entete.includes('id') || !entete.includes('email')) throw new Error(`Registre illisible (${chemin}) : en-tête inattendu « ${entete.join(';')} ».`);
  const extras = entete.filter((c) => c && !COLONNES.includes(c));
  const lignes = brut.slice(1).map((cells) => {
    const o = Object.fromEntries([...COLONNES, ...extras].map((c) => [c, '']));
    entete.forEach((c, i) => {
      if (c) o[c] = cells[i] ?? '';
    });
    return o;
  });
  return { lignes, extras };
}

function sauvegardeDuJour(chemin) {
  if (!existsSync(chemin)) return;
  const dossier = join(dirname(chemin), 'sauvegardes');
  mkdirSync(dossier, { recursive: true });
  const cible = join(dossier, `registre-${aujourdhui()}.csv`);
  if (!existsSync(cible)) copyFileSync(chemin, cible);
  // On garde les trente dernières journées.
  const anciens = readdirSync(dossier).filter((f) => /^registre-\d{4}-\d{2}-\d{2}\.csv$/.test(f)).sort();
  for (const f of anciens.slice(0, Math.max(0, anciens.length - 30))) unlinkSync(join(dossier, f));
}

/**
 * Écrit le registre en entier : copie de sauvegarde quotidienne de l'état précédent, puis écriture
 * dans un fichier temporaire renommé (jamais de registre à moitié écrit).
 */
export function ecrireRegistre(lignes, extras = [], chemin = CHEMINS.registre) {
  const colonnes = [...COLONNES, ...extras];
  const texte = [colonnes.join(';'), ...lignes.map((l) => colonnes.map((c) => csv(l[c])).join(';'))].join('\n') + '\n';
  mkdirSync(dirname(chemin), { recursive: true });
  sauvegardeDuJour(chemin);
  const tmp = `${chemin}.tmp`;
  writeFileSync(tmp, texte, 'utf8');
  try {
    renameSync(tmp, chemin);
  } catch (e) {
    try {
      unlinkSync(tmp);
    } catch {
      /* rien à nettoyer */
    }
    if (e && (e.code === 'EBUSY' || e.code === 'EPERM' || e.code === 'EACCES')) {
      throw new Error('Le registre est ouvert dans un autre programme (un tableur ?). Fermez-le puis réessayez.');
    }
    throw e;
  }
}

// ----------------------------------------------------------------------------------- clés

export function publiqueDepuisPrivee(jwk) {
  return { kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y };
}

export function memesCles(a, b) {
  return !!a && !!b && a.crv === b.crv && a.x === b.x && a.y === b.y;
}

/** Charge utile signée d'une ligne du registre. La note reste privée : elle n'est pas dans la clé. */
export function chargeUtile(l) {
  return {
    v: 1,
    id: l.id,
    name: l.nom,
    email: l.email,
    plan: l.plan,
    issued: l.date,
    ...(l.expire ? { expires: l.expire } : {}),
    ...(l.maxMajor !== '' && l.maxMajor !== undefined ? { maxMajor: Number(l.maxMajor) } : {}),
  };
}

/** Signe la ligne et vérifie aussitôt la clé produite. */
export function signer(l, privateJwk) {
  const cle = encodeKey(chargeUtile(l), privateJwk);
  const verif = decodeKey(cle, publiqueDepuisPrivee(privateJwk));
  if (!verif.ok) throw new Error('Auto-vérification de la clé échouée : ' + verif.reason);
  return cle;
}

const propre = (v) => String(v ?? '').replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim();

/**
 * Valide une demande d'émission. Renvoie { ok: true, valeur } ou { ok: false, erreurs: { champ: message } }.
 * `passeAutorise` : accepte une date d'expiration passée (ligne de commande, pour des essais).
 */
export function validerSaisie(s, lignes, today = aujourdhui(), { passeAutorise = false } = {}) {
  const erreurs = {};
  const nom = propre(s.nom);
  if (!nom) erreurs.nom = 'Le nom est obligatoire.';
  else if (nom.length > 120) erreurs.nom = 'Le nom est trop long (120 caractères au plus).';
  else if (/^[=+\-@]/.test(nom)) erreurs.nom = 'Le nom ne peut pas commencer par =, +, - ou @.';

  const email = propre(s.email).toLowerCase();
  if (!/^[^\s@<>"';,=+\-][^\s@<>"';,]*@[^\s@<>"';,]+\.[^\s@<>"';,.]{2,}$/.test(email) || email.length > 200) erreurs.email = 'Adresse e-mail invalide.';

  const plan = s.plan === 'abonnement' ? 'abonnement' : s.plan === 'perpetuelle' || !s.plan ? 'perpetuelle' : null;
  if (!plan) erreurs.plan = 'Formule inconnue.';

  let expire = propre(s.expire);
  let periode = PERIODES.includes(s.periode) ? s.periode : '';
  if (plan === 'perpetuelle') {
    expire = '';
    periode = '';
  } else if (plan === 'abonnement') {
    if (!expire) erreurs.expire = "La date d'expiration est obligatoire pour un abonnement.";
    else if (!isoValide(expire)) erreurs.expire = "Date d'expiration invalide (AAAA-MM-JJ).";
    else if (!passeAutorise && expire < today) erreurs.expire = "La date d'expiration est déjà passée.";
  }

  let maxMajor = propre(s.maxMajor);
  if (maxMajor !== '') {
    if (!/^\d{1,3}$/.test(maxMajor)) erreurs.maxMajor = 'Version majeure invalide (nombre entier).';
    else maxMajor = String(Number(maxMajor));
  }

  const note = propre(s.note);
  if (note.length > 500) erreurs.note = 'La note est trop longue (500 caractères au plus).';

  const langue = LANGUES.includes(s.langue) ? s.langue : 'fr';
  const remplace = propre(s.remplace);
  if (remplace && !lignes.some((l) => l.id === remplace)) erreurs.remplace = 'Licence à remplacer introuvable.';

  if (Object.keys(erreurs).length) return { ok: false, erreurs };
  return { ok: true, valeur: { nom, email, plan, expire, periode, maxMajor, note, langue, remplace } };
}

/** Construit et signe une nouvelle ligne à partir d'une saisie validée. */
export function nouvelleLigne(valeur, lignes, privateJwk, today = aujourdhui()) {
  let id = newId();
  while (lignes.some((l) => l.id === id)) id = newId();
  const ligne = { ...Object.fromEntries(COLONNES.map((c) => [c, ''])), id, date: today, ...valeur, cle: '', revoquee: '' };
  ligne.cle = signer(ligne, privateJwk);
  return ligne;
}

// ---------------------------------------------------------------------------- révocations

const ENTETE_REVOCATIONS =
  "// Licences révoquées (identifiants). Fichier généré par l'interface de gestion des licences\n" +
  '// (scripts/license/admin.mjs) : ne pas le modifier à la main. Une révocation prend effet chez\n' +
  "// le client à partir de la version de l'application publiée après elle.\n";

export function texteRevocations(ids) {
  const uniques = [...new Set(ids)].sort();
  const corps = uniques.length ? `[\n${uniques.map((id) => `  ${JSON.stringify(id)},`).join('\n')}\n]` : '[]';
  return `${ENTETE_REVOCATIONS}export const REVOKED: readonly string[] = ${corps};\n`;
}

/** Réécrit la liste embarquée dans l'application si elle a changé. Renvoie true en cas de modification. */
export function ecrireRevocations(lignes, chemin = CHEMINS.revocations) {
  const texte = texteRevocations(lignes.filter((l) => l.revoquee).map((l) => l.id));
  if (existsSync(chemin) && readFileSync(chemin, 'utf8') === texte) return false;
  writeFileSync(chemin, texte, 'utf8');
  return true;
}
