// Publication de la liste des licences révoquées (git) et détection de la version publiée de
// l'application, dont dépend le format des clés émises.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { relative } from 'node:path';
import { CHEMINS } from './registre.mjs';

/** Branche lue par l'application (adresses raw.githubusercontent.com/…/main/… et jsDelivr @main). */
export const BRANCHE = 'main';
/**
 * Première version de l'application qui consulte la liste en ligne et accepte les clés au format 2.
 * Tant qu'elle n'est pas publiée, les clés sont émises au format 1 pour rester activables.
 */
export const VERSION_CLES_V2 = '0.4.2';

const fichiers = () => [CHEMINS.revocationsJson, CHEMINS.revocationsTs].map((f) => relative(CHEMINS.racine, f).replace(/\\/g, '/'));

function git(args) {
  return execFileSync('git', args, {
    cwd: CHEMINS.racine,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 90_000,
    windowsHide: true,
    // Messages de git en anglais, pour reconnaître un envoi refusé quelle que soit la langue du poste.
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0', LC_ALL: 'C' },
  }).trim();
}

/** Cause d'un échec de git, en clair quand elle est reconnue, sinon ses dernières lignes utiles. */
function messageGit(e) {
  const lignes = String(e?.stderr || e?.message || e).split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lignes.some((l) => /\[rejected\]|non-fast-forward|fetch first/i.test(l))) {
    return 'le dépôt en ligne contient des modifications absentes de ce poste : récupérez-les avec « git pull », puis publiez à nouveau';
  }
  const utiles = lignes.filter((l) => !/^hint:/i.test(l));
  return (utiles.length ? utiles : lignes).slice(-2).join(' ');
}

/** La liste locale diffère-t-elle de ce qui est en ligne (modification non validée ou non poussée) ? */
export function etatPublication() {
  let branche;
  try {
    if (git(['rev-parse', '--is-inside-work-tree']) !== 'true') throw new Error('hors dépôt');
    branche = git(['rev-parse', '--abbrev-ref', 'HEAD']);
  } catch {
    return { possible: false, enAttente: false, raison: 'Publication automatique indisponible : ce dossier n’est pas un dépôt git, ou git n’est pas installé.' };
  }
  const f = fichiers();
  let modifies = false;
  let nonPousses = false;
  try {
    modifies = git(['status', '--porcelain', '--', ...f]) !== '';
  } catch {
    /* considéré comme à jour */
  }
  try {
    nonPousses = git(['log', '--oneline', `origin/${BRANCHE}..HEAD`, '--', ...f]) !== '';
  } catch {
    /* branche distante inconnue localement : seul l'état de travail compte */
  }
  const possible = branche === BRANCHE;
  return {
    possible,
    enAttente: modifies || nonPousses,
    raison: possible ? '' : `La liste se publie depuis la branche « ${BRANCHE} » ; le dépôt est actuellement sur « ${branche} ».`,
  };
}

function depotGithub() {
  try {
    const m = git(['remote', 'get-url', 'origin']).match(/github\.com[:/]([^/]+)\/([^/]+?)(?:\.git)?$/);
    return m ? `${m[1]}/${m[2]}` : null;
  } catch {
    return null;
  }
}

/** Valide et pousse uniquement les deux fichiers de la liste. Renvoie { etat: 'publiee' | 'echec', message }. */
export function publier() {
  const e = etatPublication();
  if (!e.possible) return { etat: 'echec', message: e.raison };
  const f = fichiers();
  try {
    if (git(['status', '--porcelain', '--', ...f]) !== '') {
      git(['add', '--', ...f]);
      git(['commit', '-m', 'Liste des licences révoquées', '--', ...f]);
    }
    git(['push', 'origin', BRANCHE]);
  } catch (err) {
    return { etat: 'echec', message: 'La publication en ligne a échoué (' + messageGit(err) + '). La révocation est enregistrée ; elle sera publiée au prochain essai.' };
  }
  // Le miroir jsDelivr garde les fichiers jusqu'à douze heures : on lui demande de se rafraîchir.
  const depot = depotGithub();
  if (depot) fetch(`https://purge.jsdelivr.net/gh/${depot}@${BRANCHE}/${f[0]}`, { signal: AbortSignal.timeout(8000) }).catch(() => undefined);
  return { etat: 'publiee', message: '' };
}

// -------------------------------------------------------------------- version publiée

export function auMoins(version, minimum) {
  const a = String(version).split('.').map((n) => Number.parseInt(n, 10) || 0);
  const b = String(minimum).split('.').map((n) => Number.parseInt(n, 10) || 0);
  for (let i = 0; i < 3; i++) {
    if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) > (b[i] ?? 0);
  }
  return true;
}

let memoire = { quand: 0, version: null };

/** Version proposée aux clients par la mise à jour automatique (null si elle ne peut pas être lue). */
export async function versionPubliee() {
  if (process.env.AFE_VERSION_PUBLIEE !== undefined) return process.env.AFE_VERSION_PUBLIEE || null;
  const validite = memoire.version ? 10 * 60_000 : 60_000;
  if (Date.now() - memoire.quand < validite) return memoire.version;
  let version = null;
  try {
    const url = JSON.parse(readFileSync(CHEMINS.tauriConf, 'utf8')).plugins?.updater?.endpoints?.[0];
    if (url) {
      const rep = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (rep.ok) version = String((await rep.json()).version ?? '') || null;
    }
  } catch {
    /* hors ligne : format 1 par prudence */
  }
  memoire = { quand: Date.now(), version };
  return version;
}

const formatPour = (publiee) => ({ format: publiee && auMoins(publiee, VERSION_CLES_V2) ? 2 : 1, versionPubliee: publiee, versionRequise: VERSION_CLES_V2 });

/** Format des clés à émettre : 2 dès que la version qui le comprend est celle distribuée aux clients. */
export async function formatCles() {
  return formatPour(await versionPubliee());
}

/** Même réponse sans attendre le réseau : dernière valeur connue, rafraîchie en arrière-plan. */
export function formatClesConnu() {
  if (process.env.AFE_VERSION_PUBLIEE !== undefined) return formatPour(process.env.AFE_VERSION_PUBLIEE || null);
  versionPubliee().catch(() => undefined);
  return formatPour(memoire.version);
}

/** Page de téléchargement de la dernière version (déduite de l'adresse de mise à jour automatique). */
export function pageTelechargement() {
  try {
    const url = JSON.parse(readFileSync(CHEMINS.tauriConf, 'utf8')).plugins?.updater?.endpoints?.[0] ?? '';
    return url.includes('/releases/latest/') ? url.slice(0, url.indexOf('/releases/latest/') + '/releases/latest'.length) : '';
  } catch {
    return '';
  }
}
