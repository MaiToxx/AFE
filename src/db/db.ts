import Dexie, { type Table } from 'dexie';
import type { Bareme, Client, Doc, Paiement, Profile, Setting } from './types';
import { DEFAULT_BAREMES } from '../lib/bareme';
import { todayISO } from '../lib/dates';

export class AfeDB extends Dexie {
  profile!: Table<Profile, number>;
  clients!: Table<Client, number>;
  documents!: Table<Doc, number>;
  paiements!: Table<Paiement, number>;
  baremes!: Table<Bareme, number>;
  settings!: Table<Setting, string>;

  constructor() {
    super('afe');
    this.version(1).stores({
      profile: 'id',
      clients: '++id, nom',
      documents: '++id, type, statut, clientId, dateEmission, numero',
      paiements: '++id, factureId, date',
      baremes: 'annee',
    });
    // v2 : réglages (licence, début de la période d'essai).
    this.version(2).stores({ settings: 'key' });
  }
}

export const db = new AfeDB();

export const DEFAULT_PROFILE: Profile = {
  id: 1,
  nom: '',
  prenom: '',
  denomination: '',
  adresse: '',
  codePostal: '',
  ville: '',
  email: '',
  telephone: '',
  siret: '',
  siteWeb: '',
  activiteLibelle: '',
  activite: 'bnc',
  nature: 'liberal',
  doubleImmatriculation: false,
  frequence: 'mensuelle',
  dateDebutActivite: '',
  acre: false,
  versementLiberatoire: false,
  assujettiTVA: false,
  tauxTVA: 20,
  numeroTVA: '',
  logo: '',
  couleur: '#2a78d6',
  prefixeFacture: 'F',
  prefixeDevis: 'D',
  delaiPaiementJours: 30,
  validiteDevisJours: 30,
  conditionsPaiement: 'Paiement à 30 jours par virement bancaire.',
  mentionsPied: '',
  iban: '',
  bic: '',
};

/** Ajoute les barèmes par défaut manquants (sans écraser ceux modifiés par l'utilisateur). */
export async function ensureBaremes(): Promise<void> {
  // Transaction : deux appels simultanés (StrictMode, double onglet) ne se marchent pas dessus.
  await db.transaction('rw', db.baremes, async () => {
    const existing = await db.baremes.toArray();
    const years = new Set(existing.map((b) => b.annee));
    const missing = DEFAULT_BAREMES.filter((b) => !years.has(b.annee));
    if (missing.length) await db.baremes.bulkAdd(missing);
  });
}

export async function getSetting(key: string): Promise<string | undefined> {
  return (await db.settings.get(key))?.value;
}

export async function setSetting(key: string, value: string): Promise<void> {
  await db.settings.put({ key, value });
}

export async function deleteSetting(key: string): Promise<void> {
  await db.settings.delete(key);
}

/** Démarre la période d'essai au premier lancement (ne la réinitialise jamais). */
export async function ensureTrialStart(): Promise<void> {
  await db.transaction('rw', db.settings, async () => {
    if (!(await db.settings.get('trialStart'))) await db.settings.put({ key: 'trialStart', value: todayISO() });
  });
}

export async function saveProfile(patch: Partial<Profile>): Promise<void> {
  const current = (await db.profile.get(1)) ?? DEFAULT_PROFILE;
  await db.profile.put({ ...DEFAULT_PROFILE, ...current, ...patch, id: 1 });
}

export interface Backup {
  app: 'afe';
  version: 1;
  exportedAt: string;
  profile: Profile | null;
  clients: Client[];
  documents: Doc[];
  paiements: Paiement[];
  baremes: Bareme[];
  /** Licence et début d'essai : permet de retrouver sa licence sur une nouvelle machine. */
  settings?: Setting[];
}

export async function exportBackup(): Promise<Backup> {
  const [profile, clients, documents, paiements, baremes, settings] = await Promise.all([
    db.profile.get(1),
    db.clients.toArray(),
    db.documents.toArray(),
    db.paiements.toArray(),
    db.baremes.toArray(),
    db.settings.toArray(),
  ]);
  return {
    app: 'afe',
    version: 1,
    exportedAt: new Date().toISOString(),
    profile: profile ?? null,
    clients,
    documents,
    paiements,
    baremes,
    settings,
  };
}

export async function importBackup(text: string): Promise<void> {
  const data = JSON.parse(text) as Partial<Backup>;
  const clients = data.clients;
  const documents = data.documents;
  if (data.app !== 'afe' || !Array.isArray(documents) || !Array.isArray(clients)) {
    throw new Error("Ce fichier n'est pas une sauvegarde AFE valide.");
  }
  await db.transaction('rw', [db.profile, db.clients, db.documents, db.paiements, db.baremes, db.settings], async () => {
    await Promise.all([
      db.profile.clear(),
      db.clients.clear(),
      db.documents.clear(),
      db.paiements.clear(),
      db.baremes.clear(),
    ]);
    if (data.profile) await db.profile.put({ ...DEFAULT_PROFILE, ...data.profile, id: 1 });
    await db.clients.bulkAdd(clients);
    await db.documents.bulkAdd(documents);
    await db.paiements.bulkAdd(data.paiements ?? []);
    await db.baremes.bulkAdd(data.baremes?.length ? data.baremes : DEFAULT_BAREMES);
    // Les réglages locaux sont conservés ; ceux de la sauvegarde (licence) viennent par-dessus.
    if (data.settings?.length) await db.settings.bulkPut(data.settings);
  });
}

export async function clearAll(): Promise<void> {
  await db.transaction('rw', [db.profile, db.clients, db.documents, db.paiements, db.baremes], async () => {
    await Promise.all([
      db.profile.clear(),
      db.clients.clear(),
      db.documents.clear(),
      db.paiements.clear(),
      db.baremes.clear(),
    ]);
    await db.baremes.bulkAdd(DEFAULT_BAREMES);
  });
}
