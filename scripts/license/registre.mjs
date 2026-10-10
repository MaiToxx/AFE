// Registre des licences émises (CSV « ; », UTF-8), émission des clés et liste signée des licences
// révoquées. Partagé par la ligne de commande (issue.mjs) et l'interface de gestion (admin.mjs).
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodeKey, encodeKey, newId, signText, verifyText } from './lib.mjs';

const ICI = dirname(fileURLToPath(import.meta.url));
const RACINE = resolve(ICI, '../..');
/** Dossier des secrets (clé privée, registre) : celui des scripts, ou AFE_LICENCES_DIR (disque chiffré, clé USB…). */
const SECRETS = process.env.AFE_LICENCES_DIR ? resolve(process.env.AFE_LICENCES_DIR) : ICI;

export const CHEMINS = {
  racine: RACINE,
  registre: join(SECRETS, 'registre.csv'),
  clePrivee: join(SECRETS, 'private.jwk'),
  clePublique: join(RACINE, 'src/lib/license-public-key.ts'),
  /** Liste signée publiée en ligne (lue par l'application à l'adresse du dépôt). Chemin à ne jamais changer. */
  revocationsJson: join(RACINE, 'licences/revocations.json'),
  /** Même liste, embarquée dans l'application comme point de départ. */
  revocationsTs: join(RACINE, 'src/lib/revocation-list.ts'),
  paquet: join(RACINE, 'package.json'),
  tauriConf: join(RACINE, 'src-tauri/tauri.conf.json'),
};

/** Colonnes du registre. Les neuf premières sont celles d'origine ; les suivantes sont facultatives. */
export const COLONNES = ['id', 'date', 'nom', 'email', 'plan', 'expire', 'maxMajor', 'note', 'cle', 'periode', 'remplace', 'revoquee', 'langue', 'format'];
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
 * Lit le registre. Tolère les anciens formats (colonnes manquantes) et conserve les colonnes
 * inconnues (ajoutées à la main dans un tableur) dans `extras`.
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

/** Format de la clé d'une ligne : 2 = refusée par les versions de l'application sans révocation en ligne. */
export const formatDe = (l) => (Number(l.format) === 2 ? 2 : 1);

/** Charge utile signée d'une ligne du registre. La note reste privée : elle n'est pas dans la clé. */
export function chargeUtile(l) {
  return {
    v: formatDe(l),
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

/** Construit et signe une nouvelle ligne à partir d'une saisie validée. `format` : 1 ou 2 (voir formatDe). */
export function nouvelleLigne(valeur, lignes, privateJwk, today = aujourdhui(), format = 1) {
  let id = newId();
  while (lignes.some((l) => l.id === id)) id = newId();
  const ligne = { ...Object.fromEntries(COLONNES.map((c) => [c, ''])), id, date: today, ...valeur, cle: '', revoquee: '', format: String(format === 2 ? 2 : 1) };
  ligne.cle = signer(ligne, privateJwk);
  return ligne;
}

// ---------------------------------------------------------------------------- révocations
// La liste des licences révoquées est un petit fichier signé avec la clé privée. Publiée dans le
// dépôt, elle est téléchargée par l'application, qui en vérifie la signature : personne d'autre
// que le vendeur ne peut révoquer (ni « dé-révoquer ») une licence. La même liste est embarquée
// dans l'application comme point de départ.

const DATE_LISTE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const ID_LICENCE = /^[0-9A-F]{8}$/;

/** Texte signé : distinct par construction de la charge utile d'une licence (qui est du JSON). */
export const messageRevocations = (issued, ids) => `AFE-REVOCATIONS-1|${issued}|${ids.join(',')}`;

export function listeBienFormee(liste) {
  return (
    !!liste && liste.v === 1 && typeof liste.issued === 'string' && DATE_LISTE.test(liste.issued) &&
    Array.isArray(liste.ids) && liste.ids.every((x) => typeof x === 'string' && ID_LICENCE.test(x)) && typeof liste.sig === 'string'
  );
}

export function listeValide(liste, publicJwk) {
  return listeBienFormee(liste) && verifyText(messageRevocations(liste.issued, liste.ids), liste.sig, publicJwk);
}

export function signerListe(ids, issued, privateJwk) {
  const tries = [...new Set(ids)].sort();
  return { v: 1, issued, ids: tries, sig: signText(messageRevocations(issued, tries), privateJwk) };
}

export function lireListe(chemin = CHEMINS.revocationsJson) {
  try {
    return JSON.parse(readFileSync(chemin, 'utf8'));
  } catch {
    return null;
  }
}

export function texteListeTs(liste) {
  return (
    "// Liste signée des licences révoquées, embarquée comme point de départ. Fichier généré par l'outil de\n" +
    '// gestion des licences (scripts/license) : ne pas le modifier à la main. La liste à jour est publiée\n' +
    "// dans licences/revocations.json et téléchargée par l'application.\n" +
    `export const EMBEDDED_REVOCATIONS: { v: number; issued: string; ids: string[]; sig: string } = ${JSON.stringify(liste, null, 2)};\n`
  );
}

const memesIds = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);

/**
 * Met la liste signée (JSON publié + copie embarquée) en accord avec le registre. La liste n'est
 * re-signée que si l'ensemble des licences révoquées a changé ; sa date est toujours postérieure à
 * celle de la liste précédente, car l'application ne retient que la plus récente.
 * Renvoie { liste, modifie }.
 */
export function synchroniserRevocations(lignes, privateJwk, { json = CHEMINS.revocationsJson, ts = CHEMINS.revocationsTs, maintenant = new Date() } = {}) {
  const ids = [...new Set(lignes.filter((l) => l.revoquee && ID_LICENCE.test(l.id)).map((l) => l.id))].sort();
  const actuelle = lireListe(json);
  let liste = actuelle;
  let modifie = false;
  if (!listeValide(actuelle, publiqueDepuisPrivee(privateJwk)) || !memesIds(actuelle.ids, ids)) {
    let issued = maintenant.toISOString();
    const precedente = actuelle && typeof actuelle.issued === 'string' ? Date.parse(actuelle.issued) : NaN;
    if (Number.isFinite(precedente) && Date.parse(issued) <= precedente) issued = new Date(precedente + 1000).toISOString();
    liste = signerListe(ids, issued, privateJwk);
    mkdirSync(dirname(json), { recursive: true });
    writeFileSync(json, JSON.stringify(liste, null, 2) + '\n', 'utf8');
    modifie = true;
  }
  const texte = texteListeTs(liste);
  if (!existsSync(ts) || readFileSync(ts, 'utf8') !== texte) {
    mkdirSync(dirname(ts), { recursive: true });
    writeFileSync(ts, texte, 'utf8');
    modifie = true;
  }
  return { liste, modifie };
}
