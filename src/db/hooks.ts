import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { isLang } from '../i18n';
import { normalizeDoc } from '../lib/documents';
import type { LicenseStatus } from '../lib/license';
import { licenseStatusNow } from '../lib/licenseGate';
import { SETTING_REVOCATIONS, SETTING_REVOCATIONS_CHECKED } from '../lib/revocations';
import { isCheckSettled, refreshRevocations, subscribeCheckSettled } from '../lib/revocationsStore';
import { SETTING_TRIAL_SEEN } from '../lib/trial';
import { getRegime } from '../regimes';
import type { Regime, RegimeParams } from '../regimes/types';
import { DEFAULT_PROFILE, db, sanitizeProfile } from './db';
import type { Client, Depense, Doc, Paiement, Prestation, Profile, Recurrence, Relance, Setting } from './types';

/** Complète un profil enregistré avec les valeurs par défaut et les champs migrés. */
export function normalizeProfile(row: Partial<Profile> | undefined): Profile {
  const p: Profile = sanitizeProfile({ ...DEFAULT_PROFILE, ...(row ?? {}), id: 1 });
  const identifiants = { ...(p.identifiants ?? {}) };
  if (p.siret && !identifiants.siret) identifiants.siret = p.siret;
  if (p.numeroTVA && !identifiants.tva) identifiants.tva = p.numeroTVA;
  if (!p.pays) p.pays = 'FR';
  // Statut inconnu ou absent (profils antérieurs à 0.4) : statut par défaut du pays.
  p.statut = getRegime(p.pays, p.statut).statutId;
  if (!isLang(p.langueDocuments)) p.langueDocuments = 'fr';
  if (!p.devise) p.devise = getRegime(p.pays, p.statut).devise;
  return { ...p, identifiants, optionsRegime: p.optionsRegime ?? {}, remunerationMensuelle: Number(p.remunerationMensuelle) || 0 };
}

/** Profil fusionné avec les valeurs par défaut. `loaded` passe à true une fois IndexedDB lu. */
export function useProfile(): { profile: Profile; loaded: boolean; exists: boolean } {
  const row = useLiveQuery(() => db.profile.get(1), [], null as Profile | null | undefined);
  return useMemo(() => {
    if (row === null) return { profile: DEFAULT_PROFILE, loaded: false, exists: false };
    return { profile: normalizeProfile(row ?? undefined), loaded: true, exists: !!row };
  }, [row]);
}

/** Régime (pays + statut) du profil. */
export function useRegime(): Regime {
  const { profile } = useProfile();
  return useMemo(() => getRegime(profile.pays, profile.statut), [profile.pays, profile.statut]);
}

/** Surcharges de paramètres de l'utilisateur pour un régime (code), par année (0 = unique). */
export function useRegimeOverrides(code: string): Record<number, RegimeParams> {
  const rows = useLiveQuery(() => db.regimeParams.where('pays').equals(code).toArray(), [code], []) ?? [];
  return useMemo(() => Object.fromEntries(rows.map((r) => [r.annee, r.params])), [rows]);
}

export function useDepenses(): Depense[] {
  return useLiveQuery(() => db.depenses.toArray(), [], []) ?? [];
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
  const checkSettled = useSyncExternalStore(subscribeCheckSettled, isCheckSettled);
  const valeur = (key: string) => settings?.find((s) => s.key === key)?.value ?? '';
  const licenseKey = valeur('licenseKey');
  const trialStart = valeur('trialStart');
  const trialSeen = valeur(SETTING_TRIAL_SEEN);
  const revocations = valeur(SETTING_REVOCATIONS);
  const checkedAt = valeur(SETTING_REVOCATIONS_CHECKED);
  const pending = settings === null;
  useEffect(() => {
    if (pending) return;
    let cancelled = false;
    (async () => {
      // Le statut est relu dans le stockage (même calcul que le contrôle fait à la finalisation) : les
      // réglages ci-dessus ne servent qu'à relancer cet effet quand l'un d'eux change.
      const status = await licenseStatusNow({ wait: false });
      if (cancelled) return;
      if (status.status === 'unverified' && !checkSettled) {
        // La vérification en ligne du lancement n'a pas encore abouti : on attend son résultat
        // (et on la déclenche au besoin) avant de suspendre quoi que ce soit.
        void refreshRevocations();
        setState({ status: 'loading' });
      } else setState(status);
    })();
    return () => {
      cancelled = true;
    };
  }, [pending, licenseKey, trialStart, trialSeen, revocations, checkedAt, checkSettled]);
  return state;
}
