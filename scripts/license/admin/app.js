// Interface de gestion des licences AFE (côté navigateur, sans dépendance).
// Tout le texte venant du registre est inséré par textContent : aucun HTML n'est interprété.
import { LANGUES, composer, lienCourriel, lienGmail } from './messages.js';

const SEUIL_BIENTOT = 14; // jours avant l'échéance à partir desquels un abonnement est « à renouveler »
const SEUIL_RELANCE = 30; // jours après l'échéance pendant lesquels il reste proposé au renouvellement

/** Version du dialogue avec le serveur attendue par cette interface. */
const VERSION_OUTIL = 2;

const etat = {
  licences: [],
  aujourdhui: '',
  demo: false,
  clePresente: false,
  erreurCle: '',
  conforme: true,
  version: '',
  support: '',
  registre: '',
  filtre: 'toutes',
  recherche: '',
  historique: false,
  tri: { cle: 'date', sens: -1 },
  publication: { possible: false, enAttente: false, raison: '' },
  cles: { format: 1, versionPubliee: null, versionRequise: '' },
  telechargement: '',
  publicationEnCours: false,
  erreurPublication: '',
  erreurChargement: '',
};

// ------------------------------------------------------------------------------ utilitaires

function h(balise, props, ...enfants) {
  const el = document.createElement(balise);
  let valeur;
  for (const [k, v] of Object.entries(props ?? {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'value') valeur = v;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, String(v));
  }
  for (const e of enfants.flat(Infinity)) {
    if (e === undefined || e === null || e === false) continue;
    el.append(e instanceof Node ? e : document.createTextNode(String(e)));
  }
  if (valeur !== undefined) el.value = valeur;
  return el;
}

const $ = (id) => document.getElementById(id);
const dlg = $('dialogue');
const zoneMessages = $('messages');

class ErreurApi extends Error {
  constructor(message, champs) {
    super(message);
    this.champs = champs;
  }
}

async function api(chemin, corps) {
  let rep;
  try {
    rep = await fetch(chemin, corps === undefined ? { headers: { Accept: 'application/json' } } : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corps) });
  } catch {
    throw new ErreurApi('Connexion perdue avec l’outil. Relancez licences.cmd, puis utilisez la page qu’il ouvre.');
  }
  let donnees = null;
  try {
    donnees = await rep.json();
  } catch {
    /* réponse non JSON (page d'erreur) */
  }
  if (!rep.ok) throw new ErreurApi(donnees?.erreur || (rep.status === 403 ? 'Session expirée : relancez l’outil (licences.cmd).' : `Erreur ${rep.status}.`), donnees?.champs);
  return donnees;
}

const midi = (iso) => new Date(iso + 'T12:00:00');
const fmtDate = (iso) => (iso ? midi(iso).toLocaleDateString('fr-FR') : '—');
const joursAvant = (iso) => Math.round((midi(iso) - midi(etat.aujourdhui)) / 86_400_000);
const pad = (n) => String(n).padStart(2, '0');

function ajouterMois(iso, n) {
  const [y, m, d] = iso.split('-').map(Number);
  const cible = new Date(y, m - 1 + n, 1);
  const dernier = new Date(cible.getFullYear(), cible.getMonth() + 1, 0).getDate();
  return `${cible.getFullYear()}-${pad(cible.getMonth() + 1)}-${pad(Math.min(d, dernier))}`;
}

function delai(iso) {
  const j = joursAvant(iso);
  if (j === 0) return 'aujourd’hui';
  return j > 0 ? `dans ${j} j` : `depuis ${-j} j`;
}

const sansAccent = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const pluriel = (n, un, plusieurs) => `${n} ${n > 1 ? plusieurs : un}`;

function message(texte, ton = '') {
  // Une fenêtre modale occupe le premier plan : le message doit y être placé pour rester visible.
  (dlg.open ? dlg : document.body).append(zoneMessages);
  const el = h('div', { class: `message ${ton}`, role: ton === 'critique' ? 'alert' : 'status' }, texte);
  zoneMessages.append(el);
  setTimeout(() => el.remove(), ton === 'critique' ? 7000 : 3200);
}

async function copier(texte, confirmation) {
  try {
    await navigator.clipboard.writeText(texte);
  } catch {
    const zone = h('textarea', { value: texte });
    (dlg.open ? dlg : document.body).append(zone);
    zone.select();
    document.execCommand('copy');
    zone.remove();
  }
  message(confirmation);
}

function lireSignature() {
  try {
    const s = localStorage.getItem('afe-licences-signature');
    if (s !== null) return s;
  } catch {
    /* stockage indisponible */
  }
  return etat.support ? `AFE — ${etat.support}` : 'AFE';
}

function ecrireSignature(s) {
  try {
    localStorage.setItem('afe-licences-signature', s);
  } catch {
    /* stockage indisponible */
  }
}

// --------------------------------------------------------------------------------- métier

const STATUTS = {
  active: { libelle: 'Active', ton: 'bon' },
  bientot: { libelle: 'À renouveler', ton: 'alerte' },
  expiree: { libelle: 'Expirée', ton: 'critique' },
  revoquee: { libelle: 'Révoquée', ton: 'critique' },
  remplacee: { libelle: 'Remplacée', ton: '' },
};

const remplacees = () => new Set(etat.licences.map((l) => l.remplace).filter(Boolean));

function statutDe(l, rempl = remplacees()) {
  if (l.revoquee) return 'revoquee';
  if (rempl.has(l.id)) return 'remplacee';
  if (l.expire && l.expire < etat.aujourdhui) return 'expiree';
  if (l.expire && joursAvant(l.expire) <= SEUIL_BIENTOT) return 'bientot';
  return 'active';
}

const aRenouveler = (l, s) => s === 'bientot' || (s === 'expiree' && joursAvant(l.expire) >= -SEUIL_RELANCE);
const renouvelable = (l, s) => l.plan === 'abonnement' && (s === 'active' || s === 'bientot' || s === 'expiree');
const formule = (l) => (l.plan === 'perpetuelle' ? 'À vie' : l.periode === 'mensuel' ? 'Mensuel' : l.periode === 'annuel' ? 'Annuel' : 'Abonnement');
const trouver = (id) => etat.licences.find((l) => l.id === id);

const FILTRES = [
  { id: 'toutes', libelle: 'Toutes', test: () => true },
  { id: 'actives', libelle: 'Actives', test: (l, s) => s === 'active' || s === 'bientot' },
  { id: 'renouveler', libelle: 'À renouveler', test: (l, s) => aRenouveler(l, s) },
  { id: 'expirees', libelle: 'Expirées', test: (l, s) => s === 'expiree' },
  { id: 'revoquees', libelle: 'Révoquées', test: (l, s) => s === 'revoquee' },
];

/** Licences avec leur statut ; les clés remplacées par un renouvellement sont masquées par défaut. */
function base() {
  const rempl = remplacees();
  return etat.licences.map((l) => ({ l, s: statutDe(l, rempl) })).filter((x) => etat.historique || x.s !== 'remplacee');
}

/** Clés successives d'un même abonnement, de la plus ancienne à la plus récente. */
function chaine(l) {
  const parId = new Map(etat.licences.map((x) => [x.id, x]));
  let racine = l;
  const vus = new Set([l.id]);
  while (racine.remplace && parId.has(racine.remplace) && !vus.has(racine.remplace)) {
    racine = parId.get(racine.remplace);
    vus.add(racine.id);
  }
  const liste = [racine];
  const dedans = new Set([racine.id]);
  for (;;) {
    const dernier = liste[liste.length - 1];
    const suivant = etat.licences.find((x) => x.remplace === dernier.id && !dedans.has(x.id));
    if (!suivant) break;
    liste.push(suivant);
    dedans.add(suivant.id);
  }
  return liste;
}

// ---------------------------------------------------------------------------------- rendu

function rendreBandeau() {
  const avis = [];
  if (etat.erreurChargement) avis.push(h('div', { class: 'avis critique', role: 'alert' }, etat.erreurChargement));
  if (etat.demo) avis.push(h('div', { class: 'avis' }, 'Mode démonstration : les données sont fictives, les clés ne fonctionnent pas dans l’application et rien n’est enregistré.'));
  if (etat.erreurCle) avis.push(h('div', { class: 'avis critique', role: 'alert' }, etat.erreurCle));
  else if (!etat.demo && etat.clePresente && !etat.conforme) {
    avis.push(h('div', { class: 'avis critique', role: 'alert' }, 'La clé privée ne correspond pas à la clé publique embarquée dans l’application (src/lib/license-public-key.ts). L’émission de licences est bloquée : elles seraient refusées par l’application.'));
  }
  if (etat.publication.enAttente) {
    const texte =
      etat.erreurPublication ||
      (etat.publication.possible
        ? 'Des révocations ne sont pas encore publiées en ligne : vos clients ne les reçoivent pas tant qu’elles ne le sont pas.'
        : `Des révocations ne sont pas publiées en ligne. ${etat.publication.raison}`);
    avis.push(
      h(
        'div',
        { class: 'avis alerte avec-action', role: 'alert' },
        h('span', {}, texte),
        etat.publication.possible
          ? h('button', { type: 'button', class: 'btn petit', disabled: etat.publicationEnCours, onclick: publierMaintenant }, etat.publicationEnCours ? 'Publication…' : 'Publier maintenant')
          : null,
      ),
    );
  }
  if (!etat.demo && etat.clePresente && etat.conforme && etat.cles.format !== 2) {
    avis.push(
      h(
        'div',
        { class: 'avis' },
        etat.cles.versionPubliee
          ? `Version distribuée à vos clients : ${etat.cles.versionPubliee}. Tant que la version ${etat.cles.versionRequise} n’est pas publiée, les clés sont émises à l’ancien format : elles s’activent sur toutes les versions, y compris celles qui ne consultent pas les révocations en ligne.`
          : 'La version distribuée à vos clients n’a pas pu être lue (pas de connexion ?). Par prudence, les clés sont émises à l’ancien format, activable sur toutes les versions.',
      ),
    );
  }
  $('bandeau').replaceChildren(...avis);

  const pastille = $('etat-cle');
  const [texte, ton] = etat.demo
    ? ['Démonstration', 'info']
    : !etat.clePresente
      ? ['Clé privée absente', 'critique']
      : !etat.conforme
        ? ['Clé non conforme', 'critique']
        : ['Clé de signature chargée', 'bon'];
  pastille.textContent = texte;
  pastille.className = `pastille ${ton}`;
  $('nouvelle').disabled = !etat.clePresente || (!etat.demo && !etat.conforme);
  $('verifier').disabled = !etat.clePresente;
}

function rendreTuiles(lignes) {
  const compter = (id) => lignes.filter(({ l, s }) => FILTRES.find((f) => f.id === id).test(l, s)).length;
  const actives = lignes.filter(({ s }) => s === 'active' || s === 'bientot');
  const aVie = actives.filter(({ l }) => l.plan === 'perpetuelle').length;
  const tuiles = [
    { id: 'actives', libelle: 'Licences actives', sous: `${aVie} à vie · ${pluriel(actives.length - aVie, 'abonnement', 'abonnements')}` },
    { id: 'renouveler', libelle: 'À renouveler', sous: `échéance sous ${SEUIL_BIENTOT} jours ou dépassée depuis peu` },
    { id: 'expirees', libelle: 'Expirées', sous: 'abonnements arrivés à échéance' },
    { id: 'revoquees', libelle: 'Révoquées', sous: 'désactivées par vos soins' },
  ];
  $('tuiles').replaceChildren(
    ...tuiles.map((t) =>
      h(
        'button',
        { type: 'button', class: `tuile${etat.filtre === t.id ? ' active' : ''}`, 'aria-pressed': String(etat.filtre === t.id), onclick: () => choisirFiltre(etat.filtre === t.id ? 'toutes' : t.id) },
        h('span', { class: 'libelle' }, t.libelle),
        h('span', { class: 'valeur' }, compter(t.id)),
        h('span', { class: 'sous' }, t.sous),
      ),
    ),
  );
}

function rendreFiltres(lignes) {
  $('filtres').replaceChildren(
    ...FILTRES.map((f) =>
      h(
        'button',
        { type: 'button', class: etat.filtre === f.id ? 'actif' : '', 'aria-pressed': String(etat.filtre === f.id), onclick: () => choisirFiltre(f.id) },
        f.libelle,
        h('span', { class: 'compte' }, lignes.filter(({ l, s }) => f.test(l, s)).length),
      ),
    ),
  );
}

function boutonLigne(texte, titre, action) {
  return h('button', { type: 'button', class: 'btn petit', title: titre, onclick: (e) => { e.stopPropagation(); action(); } }, texte);
}

function rendreTable(lignes) {
  const filtre = FILTRES.find((f) => f.id === etat.filtre) ?? FILTRES[0];
  const aiguille = sansAccent(etat.recherche.trim());
  const { cle, sens } = etat.tri;
  const valeurTri = (l) => (cle === 'nom' ? sansAccent(l.nom) : cle === 'expire' ? l.expire || '9999-12-31' : l.date);
  const visibles = lignes
    .filter(({ l, s }) => filtre.test(l, s) && (!aiguille || sansAccent(`${l.nom} ${l.email} ${l.id} ${l.note}`).includes(aiguille)))
    .sort((a, b) => {
      const x = valeurTri(a.l);
      const y = valeurTri(b.l);
      return (x < y ? -1 : x > y ? 1 : 0) * sens || b.l.date.localeCompare(a.l.date);
    });

  document.querySelectorAll('.tri').forEach((b) => {
    const th = b.closest('th');
    if (b.dataset.tri === cle) th.setAttribute('aria-sort', sens > 0 ? 'ascending' : 'descending');
    else th.removeAttribute('aria-sort');
  });

  $('lignes').replaceChildren(
    ...visibles.map(({ l, s }) => {
      const st = STATUTS[s];
      return h(
        'tr',
        {
          tabindex: '0',
          class: s === 'remplacee' || s === 'revoquee' ? 'attenuee' : '',
          onclick: () => dialogueDetails(l.id),
          onkeydown: (e) => {
            if (e.key === 'Enter' && e.target === e.currentTarget) dialogueDetails(l.id);
          },
        },
        h('td', { class: 'titulaire' }, h('b', {}, l.nom), h('span', {}, l.email)),
        h('td', {}, formule(l), l.maxMajor !== '' ? h('div', { class: 'sous-texte' }, `versions ≤ ${l.maxMajor}.x`) : null),
        h('td', { class: 'nombre' }, fmtDate(l.date)),
        h('td', { class: 'nombre' }, l.expire ? [fmtDate(l.expire), h('div', { class: 'sous-texte' }, delai(l.expire))] : h('span', { class: 'sous-texte' }, 'sans limite')),
        h('td', {}, h('span', { class: `badge ${st.ton}` }, st.libelle)),
        h('td', { class: 'mono' }, l.id),
        h(
          'td',
          {},
          h(
            'div',
            { class: 'actions' },
            renouvelable(l, s) ? boutonLigne('Renouveler', 'Émettre une nouvelle clé qui prolonge cet abonnement', () => dialogueRenouveler(l.id)) : null,
            boutonLigne('Envoyer', 'Préparer le message au client avec sa clé', () => dialogueMessage(l.id)),
            boutonLigne('Copier', 'Copier la clé de licence', () => copierCle(l.id)),
          ),
        ),
      );
    }),
  );

  const vide = $('vide');
  vide.hidden = visibles.length > 0;
  vide.textContent = !etat.licences.length
    ? 'Aucune licence émise pour l’instant. Cliquez sur « Nouvelle licence » après votre première vente.'
    : 'Aucune licence ne correspond à cette recherche ou à ce filtre.';
}

function rendre() {
  const lignes = base();
  rendreBandeau();
  rendreTuiles(lignes);
  rendreFiltres(lignes);
  rendreTable(lignes);
  const total = etat.licences.length;
  $('pied').textContent = `Registre : ${etat.registre} · ${pluriel(total, 'clé émise', 'clés émises')}${etat.version ? ` · AFE ${etat.version}` : ''}`;
}

function choisirFiltre(id) {
  etat.filtre = id;
  rendre();
}

async function charger() {
  const d = await api('/api/etat');
  Object.assign(etat, {
    licences: d.licences,
    aujourdhui: d.aujourdhui,
    demo: d.demo,
    clePresente: d.clePresente,
    erreurCle: d.erreurCle,
    conforme: d.conforme,
    version: d.version,
    support: d.support,
    registre: d.registre,
    publication: d.publication ?? { possible: false, enAttente: false, raison: '' },
    cles: d.cles ?? { format: 1, versionPubliee: null, versionRequise: '' },
    telechargement: d.telechargement ?? '',
    // Une interface rechargée face à un serveur resté ouvert depuis une version précédente de l'outil.
    erreurChargement: (d.outil ?? 1) < VERSION_OUTIL ? 'L’outil a été mis à jour. Fermez-le (bouton « Quitter » ou fenêtre de console), puis relancez licences.cmd.' : '',
  });
  if (!etat.publication.enAttente) etat.erreurPublication = '';
  rendre();
}

async function publierMaintenant() {
  etat.publicationEnCours = true;
  rendre();
  try {
    const { publication } = await api('/api/publier', {});
    etat.erreurPublication = publication.etat === 'echec' ? publication.message : '';
    if (publication.etat === 'publiee') message('Révocations publiées en ligne.');
  } catch (e) {
    etat.erreurPublication = e.message;
  }
  etat.publicationEnCours = false;
  await charger().catch(() => rendre());
}

// ------------------------------------------------------------------------------- fenêtres

function ouvrir({ titre, sousTitre, corps, pied }) {
  dlg.replaceChildren(
    h(
      'div',
      { class: 'dlg-tete' },
      h('div', {}, h('h2', { id: 'dialogue-titre' }, titre), sousTitre ? h('p', {}, sousTitre) : null),
      h('button', { type: 'button', class: 'fermer', 'aria-label': 'Fermer', onclick: fermer }, '×'),
    ),
    h('div', { class: 'dlg-corps' }, corps),
    pied ? h('div', { class: 'dlg-pied' }, pied) : null,
  );
  if (!dlg.open) dlg.showModal();
}

/** Vide la fenêtre fermée ; sans effet si une autre a été ouverte entre-temps. */
function nettoyer() {
  if (dlg.open) return;
  document.body.append(zoneMessages);
  dlg.replaceChildren();
}

function fermer() {
  if (dlg.open) dlg.close();
  nettoyer();
}

// Fermeture par la touche Échap.
dlg.addEventListener('close', nettoyer);

function champ(libelle, controle, { aide, nom, groupe = false } = {}) {
  return h(
    groupe ? 'div' : 'label',
    { class: 'champ' },
    h('span', { class: 'libelle' }, libelle),
    controle,
    aide ? h('span', { class: 'aide' }, aide) : null,
    h('span', { class: 'erreur', 'data-erreur': nom ?? '' }),
  );
}

function montrerErreurs(racine, champs = {}) {
  racine.querySelectorAll('[data-erreur]').forEach((el) => {
    el.textContent = champs[el.dataset.erreur] ?? '';
  });
}

/** Dès qu'un champ est corrigé, son message d'erreur disparaît. */
function suivreCorrections(form, avis) {
  const effacer = (e) => {
    const zone = e.target.closest('.champ')?.querySelector('.erreur');
    if (zone) zone.textContent = '';
    if (![...form.querySelectorAll('.erreur')].some((x) => x.textContent)) avis.hidden = true;
  };
  form.addEventListener('input', effacer);
  form.addEventListener('change', effacer);
}

function selectLangue(valeur) {
  return h('select', { value: LANGUES[valeur] ? valeur : 'fr' }, Object.entries(LANGUES).map(([code, nom]) => h('option', { value: code }, nom)));
}

function segRadios(nom, choix, defaut, etiquette) {
  return h(
    'div',
    { class: 'seg', role: 'radiogroup', 'aria-label': etiquette },
    choix.map(([valeur, texte]) => h('label', {}, h('input', { type: 'radio', name: nom, value: valeur, checked: valeur === defaut }), texte)),
  );
}

const boutonFermer = (texte = 'Fermer') => h('button', { type: 'button', class: 'btn', onclick: fermer }, texte);

// --- Nouvelle licence

function dialogueNouvelle() {
  const nom = h('input', { type: 'text', name: 'nom', autocomplete: 'off', maxlength: '120' });
  const email = h('input', { type: 'email', name: 'email', autocomplete: 'off', maxlength: '200' });
  const seg = segRadios('formule', [['vie', 'À vie'], ['annuel', 'Annuel'], ['mensuel', 'Mensuel'], ['date', 'Autre date']], 'vie', 'Formule');
  const expire = h('input', { type: 'date', name: 'expire', min: etat.aujourdhui });
  const champExpire = champ('Valable jusqu’au', expire, { nom: 'expire', aide: 'L’application bloque la finalisation des documents après cette date.' });
  const maxMajor = h('input', { type: 'number', name: 'maxMajor', min: '0', max: '999', step: '1', placeholder: 'Toutes les versions' });
  const langue = selectLangue('fr');
  const note = h('textarea', { name: 'note', rows: '2', maxlength: '500', placeholder: 'Commande, moyen de paiement… (visible de vous seul)' });
  const erreur = h('div', { class: 'avis critique', role: 'alert', hidden: true });
  const envoyer = h('button', { type: 'submit', class: 'btn principal', form: 'form-nouvelle' }, 'Émettre la licence');
  const choisie = () => seg.querySelector('input:checked').value;

  const maj = () => {
    const f = choisie();
    champExpire.hidden = f === 'vie';
    expire.readOnly = f !== 'date';
    if (f === 'annuel') expire.value = ajouterMois(etat.aujourdhui, 12);
    else if (f === 'mensuel') expire.value = ajouterMois(etat.aujourdhui, 1);
    else if (f === 'vie') expire.value = '';
  };
  seg.addEventListener('change', maj);

  const form = h(
    'form',
    {
      id: 'form-nouvelle',
      class: 'formulaire',
      novalidate: true,
      onsubmit: async (e) => {
        e.preventDefault();
        envoyer.disabled = true;
        erreur.hidden = true;
        montrerErreurs(form);
        const f = choisie();
        try {
          const { licence } = await api('/api/emettre', {
            nom: nom.value,
            email: email.value,
            plan: f === 'vie' ? 'perpetuelle' : 'abonnement',
            periode: f === 'annuel' || f === 'mensuel' ? f : '',
            expire: expire.value,
            maxMajor: maxMajor.value,
            langue: langue.value,
            note: note.value,
          });
          await charger();
          await dialogueMessage(licence.id, 'Licence émise');
        } catch (err) {
          montrerErreurs(form, err.champs);
          erreur.textContent = err.message;
          erreur.hidden = false;
          envoyer.disabled = false;
        }
      },
    },
    erreur,
    h('div', { class: 'grille-2' }, champ('Nom du titulaire', nom, { nom: 'nom', aide: 'Affiché dans l’application du client.' }), champ('E-mail', email, { nom: 'email' })),
    champ('Formule', seg, { groupe: true, nom: 'plan' }),
    champExpire,
    h(
      'div',
      { class: 'grille-2' },
      champ('Mises à jour jusqu’à la version majeure', maxMajor, { nom: 'maxMajor', aide: 'Vide : toutes les versions futures. « 1 » : jusqu’aux versions 1.x.' }),
      champ('Langue du message au client', langue),
    ),
    champ('Note', note, { nom: 'note' }),
  );

  suivreCorrections(form, erreur);
  ouvrir({ titre: 'Nouvelle licence', sousTitre: 'La clé est signée sur cette machine et consignée dans le registre.', corps: form, pied: [boutonFermer('Annuler'), envoyer] });
  maj();
  nom.focus();
}

// --- Message au client

async function cleDe(id) {
  const l = trouver(id);
  if (l?.cle) return l.cle;
  const { cle } = await api('/api/cle', { id });
  await charger();
  return cle;
}

async function copierCle(id) {
  try {
    await copier(await cleDe(id), 'Clé copiée dans le presse-papiers.');
  } catch (e) {
    message(e.message, 'critique');
  }
}

async function dialogueMessage(id, titre = 'Envoyer la clé au client') {
  let cle;
  try {
    cle = await cleDe(id);
  } catch (e) {
    message(e.message, 'critique');
    return;
  }
  const l = trouver(id);
  if (!l) return;
  const renouvellement = !!l.remplace;
  const langue = selectLangue(l.langue || 'fr');
  const signature = h('input', { type: 'text', value: lireSignature(), maxlength: '120' });
  const objet = h('input', { type: 'text' });
  const corps = h('textarea', { rows: '12' });
  const zoneCle = h('textarea', { class: 'cle', rows: '4', readonly: true, 'aria-label': 'Clé de licence', value: cle });

  const composerTout = () => {
    const m = composer({ langue: langue.value, renouvellement, nom: l.nom, cle, expire: l.expire, signature: signature.value.trim(), lien: Number(l.format) === 2 ? etat.telechargement : '' });
    objet.value = m.objet;
    corps.value = m.corps;
  };
  langue.addEventListener('change', () => {
    composerTout();
    // La langue choisie est mémorisée pour ce client.
    api('/api/modifier', { id, langue: langue.value }).then(charger).catch(() => undefined);
  });
  signature.addEventListener('input', () => {
    ecrireSignature(signature.value);
    composerTout();
  });
  composerTout();

  const courriel = () => lienCourriel(l.email, objet.value, corps.value);
  const gmail = () => lienGmail(l.email, objet.value, corps.value);

  ouvrir({
    titre,
    sousTitre: `${l.nom} · ${l.email} · ${formule(l)}${l.expire ? ` jusqu’au ${fmtDate(l.expire)}` : ''} · nº ${l.id}`,
    corps: [
      champ('Clé de licence', zoneCle),
      h('div', { class: 'grille-2' }, champ('Langue du message', langue), champ('Signature', signature, { aide: 'Mémorisée pour les prochains messages.' })),
      champ('Objet', objet),
      champ('Message', corps, { aide: 'Modifiable avant l’envoi. Changer la langue ou la signature le recompose.' }),
    ],
    pied: [
      h('button', { type: 'button', class: 'btn', onclick: () => copier(cle, 'Clé copiée dans le presse-papiers.') }, 'Copier la clé'),
      h('button', { type: 'button', class: 'btn', onclick: () => copier(corps.value, 'Message copié dans le presse-papiers.') }, 'Copier le message'),
      h('span', { class: 'pousser' }),
      h('button', { type: 'button', class: 'btn', onclick: () => window.open(gmail(), '_blank', 'noopener,noreferrer') }, 'Ouvrir dans Gmail'),
      h('button', { type: 'button', class: 'btn principal', onclick: () => { window.location.href = courriel(); } }, 'Ouvrir dans la messagerie'),
    ],
  });
}

// --- Renouvellement

function dialogueRenouveler(id) {
  const l = trouver(id);
  if (!l) return;
  const enCours = !!l.expire && l.expire >= etat.aujourdhui;
  const depart = enCours ? l.expire : etat.aujourdhui;
  const defaut = l.periode === 'annuel' ? 'annuel' : l.periode === 'mensuel' ? 'mensuel' : 'date';
  const seg = segRadios('duree', [['mensuel', '1 mois'], ['annuel', '1 an'], ['date', 'Autre date']], defaut, 'Durée du renouvellement');
  const expire = h('input', { type: 'date', name: 'expire', min: ajouterJour(depart) });
  const note = h('textarea', { rows: '2', maxlength: '500', value: l.note });
  const erreur = h('div', { class: 'avis critique', role: 'alert', hidden: true });
  const envoyer = h('button', { type: 'submit', class: 'btn principal', form: 'form-renouveler' }, 'Renouveler');
  const choisie = () => seg.querySelector('input:checked').value;

  const maj = () => {
    const f = choisie();
    expire.readOnly = f !== 'date';
    if (f === 'annuel') expire.value = ajouterMois(depart, 12);
    else if (f === 'mensuel') expire.value = ajouterMois(depart, 1);
  };
  seg.addEventListener('change', maj);

  const form = h(
    'form',
    {
      id: 'form-renouveler',
      class: 'formulaire',
      novalidate: true,
      onsubmit: async (e) => {
        e.preventDefault();
        envoyer.disabled = true;
        erreur.hidden = true;
        montrerErreurs(form);
        const f = choisie();
        try {
          const { licence } = await api('/api/renouveler', { id, periode: f === 'date' ? '' : f, expire: expire.value, note: note.value });
          await charger();
          await dialogueMessage(licence.id, 'Abonnement renouvelé');
        } catch (err) {
          montrerErreurs(form, err.champs);
          erreur.textContent = err.message;
          erreur.hidden = false;
          envoyer.disabled = false;
        }
      },
    },
    erreur,
    h(
      'p',
      {},
      enCours
        ? `Échéance actuelle : ${fmtDate(l.expire)} (${delai(l.expire)}). La nouvelle période s’ajoute à la suite : le client ne perd aucun jour.`
        : `L’abonnement est échu depuis le ${fmtDate(l.expire)} : la nouvelle période part d’aujourd’hui.`,
    ),
    champ('Durée', seg, { groupe: true }),
    champ('Nouvelle échéance', expire, { nom: 'expire' }),
    champ('Note', note, { nom: 'note' }),
  );

  suivreCorrections(form, erreur);
  ouvrir({
    titre: 'Renouveler l’abonnement',
    sousTitre: `${l.nom} · ${l.email} · nº ${l.id}`,
    corps: form,
    pied: [boutonFermer('Annuler'), envoyer],
  });
  maj();
}

function ajouterJour(iso) {
  const d = midi(iso);
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// --- Fiche d'une licence

function dialogueDetails(id) {
  const l = trouver(id);
  if (!l) return;
  const s = statutDe(l);
  const st = STATUTS[s];
  const note = h('textarea', { rows: '2', maxlength: '500', value: l.note, placeholder: 'Visible de vous seul' });
  const langue = selectLangue(l.langue || 'fr');
  const suite = chaine(l);

  const enregistrer = async () => {
    try {
      await api('/api/modifier', { id, note: note.value, langue: langue.value });
      await charger();
      message('Modifications enregistrées.');
    } catch (e) {
      message(e.message, 'critique');
    }
  };

  const basculerRevocation = async () => {
    const revoquer = !l.revoquee;
    const question = revoquer
      ? `Révoquer la licence nº ${l.id} de ${l.nom} ?\n\nLa révocation est publiée en ligne aussitôt. L’application du client la reçoit d’elle-même à son prochain lancement connecté, sans mise à jour.`
      : `Rétablir la licence nº ${l.id} de ${l.nom} ?\n\nLe rétablissement est publié en ligne aussitôt et s’applique au prochain lancement connecté de l’application du client.`;
    if (!confirm(question)) return;
    try {
      const r = await api('/api/revoquer', { id, revoquer });
      const echec = r.publication?.etat === 'echec';
      const erreur = echec ? r.publication.message : '';
      await charger();
      etat.erreurPublication = erreur;
      rendre();
      dialogueDetails(id);
      const suite = r.publication?.etat === 'publiee' ? ' et publiée en ligne' : echec ? ', mais la publication en ligne a échoué' : '';
      message(`${revoquer ? 'Licence révoquée' : 'Licence rétablie'}${suite}.`, echec ? 'critique' : '');
    } catch (e) {
      message(e.message, 'critique');
    }
  };

  const ligneFiche = (terme, valeur) => [h('dt', {}, terme), h('dd', {}, valeur)];
  ouvrir({
    titre: l.nom,
    sousTitre: l.email,
    corps: [
      h(
        'dl',
        { class: 'fiche' },
        ligneFiche('État', [h('span', { class: `badge ${st.ton}` }, st.libelle), l.revoquee ? ` le ${fmtDate(l.revoquee)}` : '']),
        ligneFiche('Numéro', h('span', { class: 'mono' }, l.id)),
        ligneFiche('Formule', formule(l)),
        ligneFiche('Émise le', fmtDate(l.date)),
        ligneFiche('Expire le', l.expire ? `${fmtDate(l.expire)} (${delai(l.expire)})` : 'Jamais (licence à vie)'),
        ligneFiche('Mises à jour', l.maxMajor !== '' ? `Jusqu’aux versions ${l.maxMajor}.x` : 'Toutes les versions'),
        ligneFiche('Format de clé', Number(l.format) === 2 ? 'Protégé : exige une version qui consulte les révocations en ligne' : 'Ancien : activable sur toutes les versions'),
      ),
      l.revoquee && Number(l.format) !== 2
        ? h('div', { class: 'avis alerte' }, `Cette clé est à l’ancien format : elle reste utilisable sur les versions de l’application antérieures à la ${etat.cles.versionRequise || '0.4.2'}, qui ne consultent pas les révocations en ligne.`)
        : null,
      suite.length > 1
        ? champ(
            'Historique de l’abonnement',
            h(
              'ul',
              { class: 'historique' },
              suite.map((x) => {
                const sx = STATUTS[statutDe(x)];
                return h(
                  'li',
                  {},
                  h('span', { class: 'mono' }, x.id),
                  `émise le ${fmtDate(x.date)}${x.expire ? `, jusqu’au ${fmtDate(x.expire)}` : ''}`,
                  h('span', { class: `badge ${sx.ton}` }, sx.libelle),
                  x.id !== l.id ? h('button', { type: 'button', class: 'btn petit', onclick: () => dialogueDetails(x.id) }, 'Ouvrir') : h('span', { class: 'sous-texte' }, '(cette clé)'),
                );
              }),
            ),
            { groupe: true },
          )
        : null,
      h('div', { class: 'grille-2' }, champ('Note', note, { nom: 'note' }), champ('Langue du message au client', langue)),
      h('div', { class: 'ligne-boutons' }, h('button', { type: 'button', class: 'btn petit', onclick: enregistrer }, 'Enregistrer la note et la langue')),
    ],
    pied: [
      h('button', { type: 'button', class: 'btn danger', onclick: basculerRevocation }, l.revoquee ? 'Rétablir' : 'Révoquer'),
      h('span', { class: 'pousser' }),
      renouvelable(l, s) ? h('button', { type: 'button', class: 'btn', onclick: () => dialogueRenouveler(id) }, 'Renouveler') : null,
      h('button', { type: 'button', class: 'btn', onclick: () => copierCle(id) }, 'Copier la clé'),
      h('button', { type: 'button', class: 'btn principal', onclick: () => dialogueMessage(id) }, 'Envoyer la clé'),
    ],
  });
}

// --- Vérification d'une clé

function dialogueVerifier() {
  const zone = h('textarea', { class: 'cle', rows: '5', placeholder: 'AFE1-…', spellcheck: 'false', 'aria-label': 'Clé à vérifier' });
  const resultat = h('div', { 'aria-live': 'polite' });

  const verifier = async () => {
    if (!zone.value.trim()) {
      resultat.replaceChildren(h('div', { class: 'resultat' }, 'Collez d’abord une clé.'));
      return;
    }
    try {
      const r = await api('/api/verifier', { cle: zone.value });
      if (!r.ok) {
        resultat.replaceChildren(h('div', { class: 'resultat critique' }, h('b', {}, `Clé invalide : ${r.raison}.`), 'Elle est incomplète, modifiée, ou n’a pas été signée avec votre clé privée.'));
        return;
      }
      const c = r.charge;
      const expiree = !!c.expires && c.expires < etat.aujourdhui;
      const revoquee = !!r.connue?.revoquee;
      const verdict = revoquee
        ? ['critique', `Signature valide, mais vous avez révoqué cette licence le ${fmtDate(r.connue.revoquee)}.`]
        : expiree
          ? ['critique', `Signature valide, mais la licence a expiré le ${fmtDate(c.expires)}.`]
          : ['bon', 'Clé authentique et en cours de validité.'];
      resultat.replaceChildren(
        h(
          'div',
          { class: `resultat ${verdict[0]}` },
          h('b', {}, verdict[1]),
          h(
            'dl',
            { class: 'fiche' },
            h('dt', {}, 'Titulaire'),
            h('dd', {}, `${c.name} · ${c.email}`),
            h('dt', {}, 'Numéro'),
            h('dd', { class: 'mono' }, c.id),
            h('dt', {}, 'Formule'),
            h('dd', {}, c.plan === 'perpetuelle' ? 'À vie' : `Abonnement jusqu’au ${fmtDate(c.expires)}`),
            h('dt', {}, 'Émise le'),
            h('dd', {}, fmtDate(c.issued)),
          ),
          r.connue
            ? h('div', { class: 'ligne-boutons' }, h('button', { type: 'button', class: 'btn petit', onclick: () => dialogueDetails(r.connue.id) }, 'Ouvrir la fiche'))
            : h('span', {}, 'Attention : cette clé est authentique mais absente du registre.'),
        ),
      );
    } catch (e) {
      resultat.replaceChildren(h('div', { class: 'resultat critique' }, e.message));
    }
  };

  ouvrir({
    titre: 'Vérifier une clé',
    sousTitre: 'Collez la clé reçue d’un client pour savoir à qui elle appartient et si elle est valide.',
    corps: [zone, resultat],
    pied: [boutonFermer(), h('button', { type: 'button', class: 'btn principal', onclick: verifier }, 'Vérifier')],
  });
  zone.focus();
}

// ------------------------------------------------------------------------------ démarrage

$('recherche').addEventListener('input', (e) => {
  etat.recherche = e.target.value;
  rendre();
});
$('historique').addEventListener('change', (e) => {
  etat.historique = e.target.checked;
  rendre();
});
$('nouvelle').addEventListener('click', dialogueNouvelle);
$('verifier').addEventListener('click', dialogueVerifier);
document.querySelectorAll('.tri').forEach((b) =>
  b.addEventListener('click', () => {
    const cle = b.dataset.tri;
    etat.tri = { cle, sens: etat.tri.cle === cle ? -etat.tri.sens : cle === 'nom' ? 1 : -1 };
    rendre();
  }),
);
$('quitter').addEventListener('click', async () => {
  if (!confirm('Arrêter l’outil de gestion des licences ?')) return;
  try {
    await api('/api/quitter', {});
  } catch {
    /* le serveur est déjà arrêté */
  }
  document.body.replaceChildren(h('main', {}, h('section', { class: 'carte' }, h('h2', {}, 'Outil arrêté'), h('p', { class: 'vide' }, 'Vous pouvez fermer cet onglet. Pour revenir, lancez licences.cmd.'))));
});

charger().catch((e) => {
  etat.erreurChargement = e.message;
  rendre();
});
