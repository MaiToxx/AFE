import Dexie, { type Table } from 'dexie';
import { DEFAULT_BAREMES, baremeEqualsDefault } from '../lib/bareme';
import { todayISO } from '../lib/dates';
import { convertBaremeFR } from '../regimes/migrate';
import type { Client, Doc, LegacyBareme, Paiement, Prestation, Profile, Recurrence, RegimeParamsRow, Relance, Setting } from './types';

export class AfeDB extends Dexie {
  profile!: Table<Profile, number>;
  clients!: Table<Client, number>;
  documents!: Table<Doc, number>;
  paiements!: Table<Paiement, number>;
  settings!: Table<Setting, string>;
  catalogue!: Table<Prestation, number>;
  relances!: Table<Relance, number>;
  recurrences!: Table<Recurrence, number>;
  regimeParams!: Table<RegimeParamsRow, string>;

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
    // v3 : avoirs et récurrences (nouveaux champs sur documents), catalogue, relances.
    this.version(3).stores({
      documents: '++id, type, statut, clientId, dateEmission, numero, recurrenceId',
      catalogue: '++id, libelle',
      relances: '++id, factureId, date',
      recurrences: '++id, prochaine',
    });
    // v4 : régimes multi-pays. Les barèmes français modifiés deviennent des surcharges de paramètres,
    // SIRET et n° de TVA rejoignent les identifiants génériques.
    this.version(4)
      .stores({ regimeParams: 'cle, pays, annee' })
      .upgrade(async (tx) => {
        const baremes = (await tx.table('baremes').toArray()) as LegacyBareme[];
        for (const b of baremes) {
          if (baremeEqualsDefault(b)) continue;
          await tx.table('regimeParams').put({ cle: `FR:${b.annee}`, pays: 'FR', annee: b.annee, params: convertBaremeFR(b) });
        }
        const p = (await tx.table('profile').get(1)) as (Partial<Profile> & { id: number }) | undefined;
        if (p) {
          await tx.table('profile').put({
            ...p,
            pays: p.pays || 'FR',
            identifiants: { siret: p.siret ?? '', tva: p.numeroTVA ?? '', ...(p.identifiants ?? {}) },
          });
        }
      });
    // v5 : l'ancienne table des barèmes n'est plus utilisée.
    this.version(5).stores({ baremes: null });
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
  siteWeb: '',
  activiteLibelle: '',
  pays: 'FR',
  langueDocuments: 'fr',
  devise: 'EUR',
  identifiants: {},
  activite: 'bnc',
  nature: 'liberal',
  doubleImmatriculation: false,
  frequence: 'mensuelle',
  dateDebutActivite: '',
  acre: false,
  versementLiberatoire: false,
  optionsRegime: {},
  assujettiTVA: false,
  tauxTVA: 20,
  retenueSource: 0,
  logo: '',
  couleur: '#2a78d6',
  themeDocument: 'clair',
  prefixeFacture: 'F',
  prefixeDevis: 'D',
  prefixeAvoir: 'AV',
  delaiPaiementJours: 30,
  validiteDevisJours: 30,
  conditionsPaiement: '',
  mentionsPied: '',
  iban: '',
  bic: '',
  objectifCA: 0,
  sauvegardeAuto: true,
  siret: '',
  numeroTVA: '',
};

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
  version: 1 | 2;
  exportedAt: string;
  profile: Profile | null;
  clients: Client[];
  documents: Doc[];
  paiements: Paiement[];
  /** Anciennes sauvegardes (≤ 0.2.x). */
  baremes?: LegacyBareme[];
  regimeParams?: RegimeParamsRow[];
  /** Licence et début d'essai : permet de retrouver sa licence sur une nouvelle machine. */
  settings?: Setting[];
  catalogue?: Prestation[];
  relances?: Relance[];
  recurrences?: Recurrence[];
}

export async function exportBackup(): Promise<Backup> {
  const [profile, clients, documents, paiements, regimeParams, settings, catalogue, relances, recurrences] = await Promise.all([
    db.profile.get(1),
    db.clients.toArray(),
    db.documents.toArray(),
    db.paiements.toArray(),
    db.regimeParams.toArray(),
    db.settings.toArray(),
    db.catalogue.toArray(),
    db.relances.toArray(),
    db.recurrences.toArray(),
  ]);
  return {
    app: 'afe',
    version: 2,
    exportedAt: new Date().toISOString(),
    profile: profile ?? null,
    clients,
    documents,
    paiements,
    regimeParams,
    settings,
    catalogue,
    relances,
    recurrences,
  };
}

const DATA_TABLES = () => [db.profile, db.clients, db.documents, db.paiements, db.regimeParams, db.catalogue, db.relances, db.recurrences];

export async function importBackup(text: string): Promise<void> {
  const data = JSON.parse(text) as Partial<Backup>;
  const clients = data.clients;
  const documents = data.documents;
  if (data.app !== 'afe' || !Array.isArray(documents) || !Array.isArray(clients)) {
    throw new Error('backup.invalid');
  }
  await db.transaction('rw', [...DATA_TABLES(), db.settings], async () => {
    await Promise.all(DATA_TABLES().map((t) => t.clear()));
    if (data.profile) {
      const p = data.profile;
      await db.profile.put({
        ...DEFAULT_PROFILE,
        ...p,
        id: 1,
        pays: p.pays || 'FR',
        identifiants: { ...(p.siret ? { siret: p.siret } : {}), ...(p.numeroTVA ? { tva: p.numeroTVA } : {}), ...(p.identifiants ?? {}) },
      });
    }
    await db.clients.bulkAdd(clients);
    await db.documents.bulkAdd(documents);
    await db.paiements.bulkAdd(data.paiements ?? []);
    if (data.regimeParams?.length) await db.regimeParams.bulkPut(data.regimeParams);
    else if (data.baremes?.length) {
      for (const b of data.baremes) {
        if (!baremeEqualsDefault(b)) await db.regimeParams.put({ cle: `FR:${b.annee}`, pays: 'FR', annee: b.annee, params: convertBaremeFR(b) });
      }
    }
    await db.catalogue.bulkAdd(data.catalogue ?? []);
    await db.relances.bulkAdd(data.relances ?? []);
    await db.recurrences.bulkAdd(data.recurrences ?? []);
    // Les réglages locaux sont conservés ; ceux de la sauvegarde (licence) viennent par-dessus.
    if (data.settings?.length) await db.settings.bulkPut(data.settings.filter((s) => s.key !== 'langue'));
  });
}

export async function clearAll(): Promise<void> {
  await db.transaction('rw', DATA_TABLES(), async () => {
    await Promise.all(DATA_TABLES().map((t) => t.clear()));
  });
}

export { DEFAULT_BAREMES };
