// Interface de gestion des licences AFE (outil vendeur, local).
//   node scripts/license/admin.mjs [--port 4780] [--no-open] [--demo]
// Démarre un petit serveur lié à 127.0.0.1 et ouvre l'interface dans le navigateur. La clé privée
// et le registre ne quittent jamais cette machine. `--demo` : données fictives, rien n'est écrit.
import { spawn } from 'node:child_process';
import { generateKeyPairSync, randomBytes, timingSafeEqual } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import http from 'node:http';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodeKey, readPublicJwk } from './lib.mjs';
import {
  CHEMINS, LANGUES, PERIODES, ajouterMois, aujourdhui, ecrireRegistre, ecrireRevocations, isoValide, lireRegistre, memesCles,
  nouvelleLigne, publiqueDepuisPrivee, signer, validerSaisie,
} from './registre.mjs';

const ICI = dirname(fileURLToPath(import.meta.url));
const STATIQUE = join(ICI, 'admin');
const args = process.argv.slice(2);
const drapeau = (n) => args.includes('--' + n);
const option = (n) => {
  const i = args.indexOf('--' + n);
  return i >= 0 ? args[i + 1] : undefined;
};
const DEMO = drapeau('demo');
const SANS_NAVIGATEUR = drapeau('no-open');
const PORT_VOULU = Number(option('port')) || 4780;

// ------------------------------------------------------------------------------- données

function lireJson(chemin) {
  return JSON.parse(readFileSync(chemin, 'utf8'));
}

function versionApp() {
  try {
    return lireJson(CHEMINS.paquet).version ?? '';
  } catch {
    return '';
  }
}

function emailSupport() {
  try {
    return readFileSync(join(ICI, '../../src/lib/license.ts'), 'utf8').match(/SUPPORT_EMAIL\s*=\s*'([^']+)'/)?.[1] ?? '';
  } catch {
    return '';
  }
}

/** Dépôt réel : le registre est relu avant chaque opération (la ligne de commande peut l'avoir complété). */
function depotFichier() {
  let privee = null;
  let erreurCle = '';
  if (!existsSync(CHEMINS.clePrivee)) erreurCle = `Clé privée absente (${CHEMINS.clePrivee}). Lancez d'abord « node scripts/license/keygen.mjs ».`;
  else {
    try {
      privee = lireJson(CHEMINS.clePrivee);
    } catch {
      erreurCle = `Clé privée illisible (${CHEMINS.clePrivee}).`;
    }
  }
  let publiqueApp = null;
  try {
    publiqueApp = readPublicJwk(readFileSync(CHEMINS.clePublique, 'utf8'));
  } catch {
    /* signalé par conforme = false */
  }
  return {
    privee,
    erreurCle,
    publiqueApp,
    conforme: !!privee && memesCles(publiqueDepuisPrivee(privee), publiqueApp),
    emplacement: CHEMINS.registre,
    lire: () => lireRegistre(CHEMINS.registre),
    ecrire: (lignes, extras) => ecrireRegistre(lignes, extras, CHEMINS.registre),
    revocations: (lignes) => ecrireRevocations(lignes),
  };
}

/** Dépôt de démonstration : paire de clés jetable et registre fictif en mémoire. */
function depotDemo() {
  const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const privee = privateKey.export({ format: 'jwk' });
  const today = aujourdhui();
  const jour = (n) => {
    const d = new Date();
    d.setDate(d.getDate() + n);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  let lignes = [];
  const ajouter = (saisie, date, extra = {}) => {
    const v = validerSaisie(saisie, lignes, today, { passeAutorise: true });
    if (!v.ok) throw new Error('Jeu de démonstration invalide : ' + JSON.stringify(v.erreurs));
    const l = { ...nouvelleLigne(v.valeur, lignes, privee, date), ...extra };
    lignes = [...lignes, l];
    return l;
  };
  ajouter({ nom: 'Camille Martin', email: 'camille@exemple.fr', plan: 'perpetuelle', note: 'Commande nº 1042, virement' }, jour(-210));
  ajouter({ nom: 'Atelier Dupain SARL', email: 'contact@dupain.exemple', plan: 'abonnement', periode: 'annuel', expire: jour(190) }, jour(-175));
  const ancien = ajouter({ nom: 'Jonas Weber', email: 'jonas.weber@beispiel.de', plan: 'abonnement', periode: 'mensuel', expire: jour(-2), langue: 'de' }, jour(-33));
  ajouter({ nom: 'Jonas Weber', email: 'jonas.weber@beispiel.de', plan: 'abonnement', periode: 'mensuel', expire: jour(28), langue: 'de', remplace: ancien.id }, jour(-3));
  ajouter({ nom: 'Lucía Fernández', email: 'lucia@ejemplo.es', plan: 'abonnement', periode: 'mensuel', expire: jour(5), langue: 'es', note: 'Paie par carte le 15' }, jour(-26));
  ajouter({ nom: 'Studio Lumière', email: 'hello@studiolumiere.exemple', plan: 'abonnement', periode: 'annuel', expire: jour(-40) }, jour(-405));
  ajouter({ nom: 'Marco Bianchi', email: 'marco@esempio.it', plan: 'perpetuelle', maxMajor: '1', langue: 'it' }, jour(-90));
  ajouter({ nom: 'Compte remboursé', email: 'rembourse@exemple.fr', plan: 'perpetuelle', note: 'Remboursé le lendemain' }, jour(-60), { revoquee: jour(-59) });
  return {
    privee,
    erreurCle: '',
    publiqueApp: null,
    conforme: false,
    emplacement: 'mémoire (démonstration)',
    lire: () => ({ lignes, extras: [] }),
    ecrire: (nouvelles) => {
      lignes = nouvelles;
    },
    revocations: () => false,
  };
}

const depot = DEMO ? depotDemo() : depotFichier();

// ------------------------------------------------------------------------------- sécurité

const JETON = randomBytes(24).toString('base64url');
let port = PORT_VOULU;
const nomCookie = () => `afe_lic_${port}`;
const origines = () => [`http://127.0.0.1:${port}`, `http://localhost:${port}`];

function memeChaine(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && timingSafeEqual(x, y);
}

function cookieValide(req) {
  const brut = req.headers.cookie ?? '';
  const valeur = brut.split(';').map((c) => c.trim()).find((c) => c.startsWith(nomCookie() + '='))?.slice(nomCookie().length + 1);
  return !!valeur && memeChaine(valeur, JETON);
}

const EN_TETES = {
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'X-Frame-Options': 'DENY',
  'Content-Security-Policy': "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
};

function repondre(res, statut, type, corps, extra = {}) {
  res.writeHead(statut, { ...EN_TETES, 'Content-Type': type, ...extra });
  res.end(corps);
}
const json = (res, statut, objet) => repondre(res, statut, 'application/json; charset=utf-8', JSON.stringify(objet));
const page = (res, statut, titre, texte) =>
  repondre(res, statut, 'text/html; charset=utf-8', `<!doctype html><html lang="fr"><meta charset="utf-8"><title>${titre}</title><body><h1>${titre}</h1><p>${texte}</p></body></html>`);

class Refus extends Error {
  constructor(statut, message, champs) {
    super(message);
    this.statut = statut;
    this.champs = champs;
  }
}

function lireCorps(req) {
  return new Promise((ok, ko) => {
    let taille = 0;
    const morceaux = [];
    req.on('data', (m) => {
      taille += m.length;
      if (taille > 65_536) {
        ko(new Refus(413, 'Requête trop volumineuse.'));
        req.destroy();
      } else morceaux.push(m);
    });
    req.on('end', () => {
      try {
        ok(morceaux.length ? JSON.parse(Buffer.concat(morceaux).toString('utf8')) : {});
      } catch {
        ko(new Refus(400, 'Requête illisible.'));
      }
    });
    req.on('error', ko);
  });
}

// ----------------------------------------------------------------------------------- API

function exigerCle() {
  if (!depot.privee) throw new Refus(409, depot.erreurCle || 'Clé privée indisponible.');
}

/** Émettre exige en plus que la clé privée soit bien celle que l'application sait vérifier. */
function exigerEmission() {
  exigerCle();
  if (!DEMO && !depot.conforme) throw new Refus(409, 'La clé privée ne correspond pas à la clé publique embarquée dans l’application : les licences émises seraient refusées.');
}

function trouver(lignes, id) {
  const l = lignes.find((x) => x.id === id);
  if (!l) throw new Refus(404, 'Licence introuvable dans le registre.');
  return l;
}

const remplacees = (lignes) => new Set(lignes.map((l) => l.remplace).filter(Boolean));

const API = {
  etat() {
    const { lignes } = depot.lire();
    return {
      licences: lignes,
      aujourdhui: aujourdhui(),
      demo: DEMO,
      clePresente: !!depot.privee,
      erreurCle: depot.erreurCle,
      conforme: depot.conforme,
      version: versionApp(),
      support: emailSupport(),
      registre: depot.emplacement,
      langues: LANGUES,
    };
  },

  emettre(corps) {
    exigerEmission();
    const { lignes, extras } = depot.lire();
    const v = validerSaisie(corps, lignes);
    if (!v.ok) throw new Refus(422, 'Vérifiez les champs signalés.', v.erreurs);
    if (v.valeur.remplace) throw new Refus(422, 'Utilisez « Renouveler » pour remplacer une licence existante.');
    const licence = nouvelleLigne(v.valeur, lignes, depot.privee);
    depot.ecrire([...lignes, licence], extras);
    return { licence };
  },

  renouveler(corps) {
    exigerEmission();
    const { lignes, extras } = depot.lire();
    const ancienne = trouver(lignes, String(corps.id ?? ''));
    if (ancienne.plan !== 'abonnement') throw new Refus(422, 'Seul un abonnement se renouvelle : une licence à vie n’expire pas.');
    if (ancienne.revoquee) throw new Refus(422, 'Cette licence est révoquée : rétablissez-la avant de la renouveler.');
    if (remplacees(lignes).has(ancienne.id)) throw new Refus(422, 'Cette clé a déjà été renouvelée : renouvelez la plus récente.');
    const today = aujourdhui();
    const periode = PERIODES.includes(corps.periode) ? corps.periode : '';
    // Un renouvellement anticipé prolonge l'échéance en cours : le client ne perd aucun jour.
    const base = ancienne.expire && ancienne.expire >= today ? ancienne.expire : today;
    const expire = periode === 'mensuel' ? ajouterMois(base, 1) : periode === 'annuel' ? ajouterMois(base, 12) : String(corps.expire ?? '');
    if (!periode && isoValide(expire) && ancienne.expire && expire <= ancienne.expire) throw new Refus(422, 'Vérifiez les champs signalés.', { expire: 'La nouvelle échéance doit être postérieure à l’actuelle.' });
    const v = validerSaisie(
      { nom: ancienne.nom, email: ancienne.email, plan: 'abonnement', periode, expire, maxMajor: ancienne.maxMajor, note: corps.note ?? ancienne.note, langue: ancienne.langue, remplace: ancienne.id },
      lignes,
      today,
    );
    if (!v.ok) throw new Refus(422, 'Vérifiez les champs signalés.', v.erreurs);
    const licence = nouvelleLigne(v.valeur, lignes, depot.privee, today);
    depot.ecrire([...lignes, licence], extras);
    return { licence };
  },

  modifier(corps) {
    const { lignes, extras } = depot.lire();
    const l = trouver(lignes, String(corps.id ?? ''));
    const suivante = { ...l };
    if (corps.note !== undefined) {
      const note = String(corps.note).replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim();
      if (note.length > 500) throw new Refus(422, 'Vérifiez les champs signalés.', { note: 'La note est trop longue (500 caractères au plus).' });
      suivante.note = note;
    }
    if (corps.langue !== undefined) {
      if (!LANGUES.includes(corps.langue)) throw new Refus(422, 'Langue inconnue.');
      suivante.langue = corps.langue;
    }
    depot.ecrire(lignes.map((x) => (x.id === l.id ? suivante : x)), extras);
    return { licence: suivante };
  },

  revoquer(corps) {
    const { lignes, extras } = depot.lire();
    const l = trouver(lignes, String(corps.id ?? ''));
    const suivante = { ...l, revoquee: corps.revoquer ? l.revoquee || aujourdhui() : '' };
    const nouvelles = lignes.map((x) => (x.id === l.id ? suivante : x));
    depot.ecrire(nouvelles, extras);
    const listeModifiee = depot.revocations(nouvelles);
    return { licence: suivante, listeModifiee };
  },

  cle(corps) {
    const { lignes, extras } = depot.lire();
    const l = trouver(lignes, String(corps.id ?? ''));
    if (l.cle) return { cle: l.cle };
    // Clé absente du registre (ligne saisie à la main) : on en signe une équivalente.
    exigerEmission();
    const cle = signer(l, depot.privee);
    depot.ecrire(lignes.map((x) => (x.id === l.id ? { ...x, cle } : x)), extras);
    return { cle };
  },

  verifier(corps) {
    exigerCle();
    const r = decodeKey(String(corps.cle ?? ''), publiqueDepuisPrivee(depot.privee));
    if (!r.ok) return { ok: false, raison: r.reason };
    const { lignes } = depot.lire();
    const connue = lignes.find((l) => l.id === r.payload.id) ?? null;
    return { ok: true, charge: r.payload, connue: connue ? { id: connue.id, revoquee: connue.revoquee } : null };
  },
};

// -------------------------------------------------------------------------------- serveur

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml' };
const FICHIERS = { '/': 'index.html', '/app.js': 'app.js', '/messages.js': 'messages.js', '/style.css': 'style.css', '/icone.svg': 'icone.svg' };

async function traiter(req, res) {
  const hote = req.headers.host ?? '';
  // Seuls les noms locaux sont acceptés (protection contre le DNS rebinding).
  if (!origines().some((o) => o.endsWith('//' + hote))) return page(res, 403, 'Accès refusé', 'Cette interface n’est accessible que depuis cette machine.');
  const url = new URL(req.url ?? '/', `http://${hote}`);

  if (req.method === 'GET' && url.pathname === '/' && url.searchParams.has('t')) {
    if (!memeChaine(url.searchParams.get('t'), JETON)) return page(res, 403, 'Session expirée', 'Relancez l’outil (licences.cmd ou « npm run licences ») : il ouvrira l’interface avec un accès valide.');
    res.writeHead(302, { ...EN_TETES, Location: '/', 'Set-Cookie': `${nomCookie()}=${JETON}; HttpOnly; SameSite=Strict; Path=/` });
    return res.end();
  }
  if (!cookieValide(req)) return page(res, 403, 'Session non reconnue', 'Lancez l’outil avec licences.cmd (ou « npm run licences ») : il ouvre l’interface avec un accès valide.');

  if (req.method === 'GET' && FICHIERS[url.pathname]) {
    const fichier = join(STATIQUE, FICHIERS[url.pathname]);
    return repondre(res, 200, TYPES[extname(fichier)] ?? 'application/octet-stream', readFileSync(fichier));
  }
  if (req.method === 'GET' && url.pathname === '/api/etat') return json(res, 200, API.etat());

  if (req.method === 'POST' && url.pathname.startsWith('/api/')) {
    const origine = req.headers.origin;
    if (origine && !origines().includes(origine)) throw new Refus(403, 'Origine refusée.');
    if (!String(req.headers['content-type'] ?? '').startsWith('application/json')) throw new Refus(415, 'Type de contenu inattendu.');
    const action = url.pathname.slice('/api/'.length);
    const corps = await lireCorps(req);
    if (action === 'quitter') {
      // On laisse la réponse partir avant de fermer le serveur.
      res.on('finish', arreter);
      return json(res, 200, { ok: true });
    }
    if (action === 'etat' || !Object.hasOwn(API, action)) throw new Refus(404, 'Action inconnue.');
    return json(res, 200, API[action](corps));
  }
  return page(res, 404, 'Introuvable', 'Cette page n’existe pas.');
}

const serveur = http.createServer((req, res) => {
  traiter(req, res).catch((e) => {
    if (res.headersSent) return res.end();
    if (e instanceof Refus) return json(res, e.statut, { erreur: e.message, champs: e.champs });
    console.error(e);
    json(res, 500, { erreur: e?.message || 'Erreur interne.' });
  });
});

function arreter() {
  console.log('\nArrêt de l’interface de gestion des licences.');
  serveur.close(() => process.exit(0));
  serveur.closeAllConnections?.();
  setTimeout(() => process.exit(0), 500).unref();
}

function ouvrirNavigateur(url) {
  try {
    const enfant =
      process.platform === 'win32'
        ? spawn('cmd', ['/c', 'start', '""', url], { windowsVerbatimArguments: true, windowsHide: true, stdio: 'ignore' })
        : spawn(process.platform === 'darwin' ? 'open' : 'xdg-open', [url], { detached: true, stdio: 'ignore' });
    enfant.on('error', () => undefined);
    enfant.unref();
  } catch {
    /* l'adresse est affichée dans la console */
  }
}

function pret() {
  port = serveur.address().port;
  const url = `http://127.0.0.1:${port}/?t=${JETON}`;
  let nombre = 0;
  let erreurRegistre = '';
  try {
    nombre = depot.lire().lignes.length;
  } catch (e) {
    erreurRegistre = e.message;
  }
  console.log('AFE — Gestion des licences' + (DEMO ? ' (démonstration : rien n’est enregistré)' : ''));
  console.log('Interface : ' + url);
  console.log(`Registre  : ${depot.emplacement} (${nombre} licence${nombre > 1 ? 's' : ''})`);
  if (erreurRegistre) console.log('ATTENTION : ' + erreurRegistre);
  if (depot.erreurCle) console.log('ATTENTION : ' + depot.erreurCle);
  else if (!DEMO && !depot.conforme) console.log('ATTENTION : la clé privée ne correspond pas à la clé publique de l’application.');
  console.log('\nLaissez cette fenêtre ouverte pendant l’utilisation. Fermez-la, ou cliquez sur « Quitter », pour arrêter.');
  if (!SANS_NAVIGATEUR) ouvrirNavigateur(url);
}

serveur.on('error', (e) => {
  if (e.code === 'EADDRINUSE' && port !== 0) {
    // Port déjà pris (une autre fenêtre de l'outil est peut-être ouverte) : on en prend un libre.
    port = 0;
    serveur.listen(0, '127.0.0.1');
  } else {
    console.error('Impossible de démarrer : ' + e.message);
    process.exit(1);
  }
});
serveur.on('listening', pret);
serveur.listen(port, '127.0.0.1');
process.on('SIGINT', arreter);
