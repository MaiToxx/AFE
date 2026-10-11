// Exports CSV des documents (journal des ventes pour la comptabilité) et des clients, et import de
// clients depuis le fichier d'un tableur ou d'un autre logiciel.
import type { Client, Doc } from '../db/types';
import { LANGS, isLang, t, tIn } from '../i18n';
import { csvFile, csvNumber, csvText } from './csv';
import { statutInfo } from './documents';
import { resteDu } from './echeances';
import { fmtDate } from './format';

/**
 * Journal des documents affichés : une ligne par document, montants négatifs pour les avoirs (ils
 * viennent en déduction), encaissements et reste dû pour les factures.
 */
export function documentsCSV(docs: Doc[], o: { encaisse: Map<number, number>; dernierPaiement: Map<number, string>; nomClient: (d: Doc) => string; taxe: string; today: string }): string {
  const entete = [
    t('docs.col.type'), t('docs.number'), t('common.date'), t('docs.dueDate'), t('common.client'), t('editor.subject'),
    t('editor.totalExcl'), o.taxe, t('editor.totalIncl'), t('docs.col.withholding'), t('editor.netDue'), t('editor.received'), t('editor.remaining'),
    t('common.status'), t('docs.col.lastPayment'),
  ].map(csvText);
  const lignes = docs.map((d) => {
    const signe = d.type === 'avoir' ? -1 : 1;
    const paye = d.type === 'facture' ? o.encaisse.get(d.id ?? 0) ?? 0 : 0;
    const emise = d.type === 'facture' && d.statut !== 'brouillon' && d.statut !== 'annulee';
    return [
      csvText(t(d.type === 'facture' && d.acompte ? 'doc.depositInvoice' : d.type === 'facture' ? 'doc.invoice' : d.type === 'avoir' ? 'doc.creditNote' : 'doc.quote')),
      csvText(d.numero),
      csvText(fmtDate(d.dateEmission)),
      csvText(d.type === 'avoir' ? '' : fmtDate(d.dateEcheance)),
      csvText(o.nomClient(d)),
      csvText(d.objet),
      csvNumber(signe * d.totalHT),
      csvNumber(signe * d.totalTVA),
      csvNumber(signe * d.totalTTC),
      csvNumber(signe * (d.montantRetenue || 0)),
      csvNumber(signe * (d.netAPayer ?? d.totalTTC)),
      csvNumber(paye),
      csvNumber(emise ? resteDu(d, o.encaisse) : 0),
      csvText(t(statutInfo(d, paye, o.today).key)),
      csvText(o.dernierPaiement.has(d.id ?? 0) ? fmtDate(o.dernierPaiement.get(d.id ?? 0)!) : ''),
    ];
  });
  return csvFile([entete, ...lignes]);
}

/** Colonnes de l'export des clients, dans l'ordre ; l'import reconnaît les mêmes (et leurs équivalents). */
const COLONNES_CLIENT: { champ: keyof Client; cle: string }[] = [
  { champ: 'nom', cle: 'clients.form.name' },
  { champ: 'type', cle: 'clients.form.type' },
  { champ: 'adresse', cle: 'clients.form.address' },
  { champ: 'codePostal', cle: 'clients.form.zip' },
  { champ: 'ville', cle: 'clients.form.city' },
  { champ: 'pays', cle: 'clients.form.country' },
  { champ: 'email', cle: 'clients.form.email' },
  { champ: 'telephone', cle: 'clients.form.phone' },
  { champ: 'siret', cle: 'clients.col.identifier' },
  { champ: 'langue', cle: 'clients.form.language' },
  { champ: 'delaiPaiementJours', cle: 'clients.form.paymentDelay' },
  { champ: 'notes', cle: 'clients.form.notes' },
];

export function clientsCSV(clients: Client[]): string {
  const entete = COLONNES_CLIENT.map((c) => csvText(t(c.cle)));
  const lignes = clients.map((c) => COLONNES_CLIENT.map(({ champ }) => csvText(champ === 'type' ? (c.type === 'pro' ? t('clients.pro') : t('clients.individual')) : (c[champ] ?? ''))));
  return csvFile([entete, ...lignes]);
}

// ------------------------------------------------------------------------------ import de clients

/** Intitulés de colonne reconnus (sans accents ni ponctuation), dans les langues de l'application et les formats courants. */
const SYNONYMES: Record<string, string[]> = {
  nom: ['nom', 'name', 'raisonsociale', 'societe', 'company', 'companyname', 'client', 'clientname', 'customer', 'nombre', 'razonsocial', 'empresa', 'cliente', 'firma', 'kunde', 'naam', 'bedrijf', 'klant', 'ragionesociale', 'denominazione', 'nome', 'denomination'],
  type: ['type', 'tipo', 'typ', 'categorie', 'category'],
  adresse: ['adresse', 'address', 'rue', 'street', 'adresse1', 'address1', 'direccion', 'anschrift', 'strasse', 'indirizzo', 'morada', 'endereco', 'adres', 'straat'],
  codePostal: ['codepostal', 'cp', 'zip', 'zipcode', 'postalcode', 'postcode', 'plz', 'cap', 'codigopostal'],
  ville: ['ville', 'city', 'town', 'ciudad', 'localidad', 'stadt', 'ort', 'citta', 'cidade', 'localidade', 'plaats', 'stad', 'localite', 'commune'],
  pays: ['pays', 'country', 'pais', 'land', 'paese'],
  email: ['email', 'mail', 'courriel', 'emailaddress', 'correo', 'correoelectronico'],
  telephone: ['telephone', 'tel', 'phone', 'phonenumber', 'telefon', 'telefono', 'telefone', 'telefoon', 'mobile', 'portable'],
  siret: ['siret', 'siren', 'identifiant', 'identifiantofficiel', 'id', 'vat', 'vatnumber', 'tva', 'numerotva', 'nif', 'cif', 'ustidnr', 'piva', 'partitaiva', 'kvk', 'btw', 'uid', 'ide', 'identifier', 'taxid'],
  langue: ['langue', 'languedesdocuments', 'language', 'idioma', 'sprache', 'lingua', 'taal'],
  delaiPaiementJours: ['delaidepaiement', 'delaidepaiementjours', 'delai', 'paymentterms', 'paymentdelay', 'plazodepago', 'zahlungsziel', 'terminedipagamento', 'prazodepagamento', 'betalingstermijn'],
  notes: ['notes', 'note', 'remarques', 'commentaire', 'commentaires', 'comments', 'notas', 'notizen', 'opmerkingen'],
};

/** Intitulé ramené à des lettres et chiffres sans accents, pour être comparé aux synonymes. */
const cleColonne = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\(.*?\)/g, '').replace(/[^a-z0-9]/g, '');

export interface ImportClients {
  /** Clients à créer. */
  nouveaux: Omit<Client, 'id'>[];
  /** Lignes ignorées parce qu'un client du même nom (et de la même adresse e-mail) existe déjà. */
  doublons: number;
}

/**
 * Convertit les lignes d'un fichier CSV en clients. La première ligne porte les intitulés de colonnes ;
 * seule la colonne du nom est indispensable. Renvoie null si elle est introuvable.
 */
export function clientsDepuisCSV(lignes: string[][], existants: Client[], maintenant = new Date().toISOString()): ImportClients | null {
  if (lignes.length < 1) return null;
  // Intitulés de l'export dans chacune des langues de l'application, puis équivalents courants.
  const connues = new Map<string, string>();
  for (const { champ, cle } of COLONNES_CLIENT) for (const l of LANGS) connues.set(cleColonne(tIn(l.code, cle)), champ);
  for (const [champ, noms] of Object.entries(SYNONYMES)) for (const n of noms) if (!connues.has(n)) connues.set(n, champ);
  const colonnes = lignes[0].map((h) => connues.get(cleColonne(h)) ?? null);
  if (!colonnes.includes('nom')) return null;
  // « Particulier » tel que l'écrit l'export dans chaque langue, puis tournures courantes.
  const particuliers = new Set(LANGS.map((l) => tIn(l.code, 'clients.individual').toLowerCase()));
  const estParticulier = (v: string) => particuliers.has(v.toLowerCase()) || /^(part|priv|indiv|b2c|consum|person)/i.test(v);
  const empreinte = (nom: string, email: string) => `${nom.trim().toLowerCase()}|${email.trim().toLowerCase()}`;
  const connus = new Set(existants.map((c) => empreinte(c.nom, c.email)));
  const nouveaux: Omit<Client, 'id'>[] = [];
  let doublons = 0;
  for (const ligne of lignes.slice(1)) {
    const lu: Record<string, string> = {};
    colonnes.forEach((champ, i) => {
      // L'apostrophe posée par un export pour neutraliser une formule n'appartient pas à la valeur.
      if (champ) lu[champ] = (ligne[i] ?? '').trim().replace(/^'(?=[=+\-@])/, '');
    });
    const nom = (lu.nom ?? '').slice(0, 200);
    if (!nom) continue;
    const email = lu.email ?? '';
    if (connus.has(empreinte(nom, email))) {
      doublons++;
      continue;
    }
    connus.add(empreinte(nom, email));
    const langue = (lu.langue ?? '').toLowerCase().slice(0, 2);
    const delai = Number((lu.delaiPaiementJours ?? '').replace(',', '.'));
    nouveaux.push({
      nom,
      type: estParticulier(lu.type ?? '') ? 'particulier' : 'pro',
      adresse: lu.adresse ?? '',
      codePostal: lu.codePostal ?? '',
      ville: lu.ville ?? '',
      pays: lu.pays ?? '',
      email,
      telephone: lu.telephone ?? '',
      siret: lu.siret ?? '',
      notes: lu.notes ?? '',
      langue: isLang(langue) ? langue : '',
      delaiPaiementJours: (lu.delaiPaiementJours ?? '') !== '' && Number.isFinite(delai) && delai >= 0 ? Math.round(delai) : null,
      createdAt: maintenant,
    });
  }
  return { nouveaux, doublons };
}
