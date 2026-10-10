import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useState } from 'react';
import { isLang } from '../i18n';
import { todayISO } from '../lib/dates';
import { normalizeDoc } from '../lib/documents';
import { evaluate, trialStatus, verifyKey, type LicenseStatus } from '../lib/license';
import { getRegime } from '../regimes';
import type { Regime, RegimeParams } from '../regimes/types';
import { DEFAULT_PROFILE, db } from './db';
import type { Client, Doc, Paiement, Prestation, Profile, Recurrence, Relance, Setting } from './types';

/** Complète un profil enregistré avec les valeurs par défaut et les champs migrés. */
export function normalizeProfile(row: Partial<Profile> | undefined): Profile {
  const p: Profile = { ...DEFAULT_PROFILE, ...(row ?? {}), id: 1 };
  const identifiants = { ...(p.identifiants ?? {}) };
  if (p.siret && !identifiants.siret) identifiants.siret = p.siret;
  if (p.numeroTVA && !identifiants.tva) identifiants.tva = p.numeroTVA;
  if (!p.pays) p.pays = 'FR';
  if (!isLang(p.langueDocuments)) p.langueDocuments = 'fr';
  if (!p.devise) p.devise = getRegime(p.pays).devise;
  return { ...p, identifiants, optionsRegime: p.optionsRegime ?? {} };
}

/** Profil fusionné avec les valeurs par défaut. `loaded` passe à true une fois IndexedDB lu. */
export function useProfile(): { profile: Profile; loaded: boolean; exists: boolean } {
  const row = useLiveQuery(() => db.profile.get(1), [], null as Profile | null | undefined);
  return useMemo(() => {
    if (row === null) return { profile: DEFAULT_PROFILE, loaded: false, exists: false };
    return { profile: normalizeProfile(row ?? undefined), loaded: true, exists: !!row };
  }, [row]);
}

/** Régime du pays d'imposition du profil. */
export function useRegime(): Regime {
  const { profile } = useProfile();
  return useMemo(() => getRegime(profile.pays), [profile.pays]);
}

/** Surcharges de paramètres de l'utilisateur pour un pays, par année (0 = unique). */
export function useRegimeOverrides(pays: string): Record<number, RegimeParams> {
  const rows = useLiveQuery(() => db.regimeParams.where('pays').equals(pays).toArray(), [pays], []) ?? [];
  return useMemo(() => Object.fromEntries(rows.map((r) => [r.annee, r.params])), [rows]);
}

export function useSetting(key: string): string | undefined {
  const row = useLiveQuery(() => db.settings.get(key), [key]);
  return row?.value;
}

export function useClients(): Client[] {
  return useLiveQuery(() => db.clients.orderBy('nom').toArray(), [], []) ?? [];
}

export function useDocuments(): Doc[] {
  // Les documents créés par d'anciennes versions sont complétés à la lecture.
  return useLiveQuery(() => db.documents.toArray().then((docs) => docs.map(normalizeDoc)), [], []) ?? [];
}

export function usePaiements(): Paiement[] {
  return useLiveQuery(() => db.paiements.toArray(), [], []) ?? [];
}

export function useCatalogue(): Prestation[] {
  return useLiveQuery(() => db.catalogue.orderBy('libelle').toArray(), [], []) ?? [];
}

export function useRelances(): Relance[] {
  return useLiveQuery(() => db.relances.toArray(), [], []) ?? [];
}

export function useRecurrences(): Recurrence[] {
  return useLiveQuery(() => db.recurrences.toArray(), [], []) ?? [];
}

/** Statut de licence courant (essai, licence valide, expirée…), recalculé à chaque changement en base. */
export function useLicense(): LicenseStatus {
  const settings = useLiveQuery(() => db.settings.toArray(), [], null as Setting[] | null);
  const [state, setState] = useState<LicenseStatus>({ status: 'loading' });
  const licenseKey = settings?.find((s) => s.key === 'licenseKey')?.value ?? '';
  const trialStart = settings?.find((s) => s.key === 'trialStart')?.value ?? '';
  const pending = settings === null;
  useEffect(() => {
    if (pending) return;
    let cancelled = false;
    const today = todayISO();
    if (!licenseKey) {
      setState(trialStart ? trialStatus(trialStart, today) : { status: 'loading' });
      return;
    }
    verifyKey(licenseKey).then((r) => {
      if (!cancelled) setState(r.ok ? evaluate(r.payload, today) : { status: 'invalid', reasonKey: r.reasonKey });
    });
    return () => {
      cancelled = true;
    };
  }, [pending, licenseKey, trialStart]);
  return state;
}
