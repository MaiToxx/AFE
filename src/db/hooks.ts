import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useState } from 'react';
import { DEFAULT_PROFILE, db } from './db';
import type { Bareme, Client, Doc, Paiement, Profile, Setting } from './types';
import { DEFAULT_BAREMES } from '../lib/bareme';
import { todayISO } from '../lib/dates';
import { evaluate, trialStatus, verifyKey, type LicenseStatus } from '../lib/license';

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
      if (!cancelled) setState(r.ok ? evaluate(r.payload, today) : { status: 'invalid', reason: r.reason });
    });
    return () => {
      cancelled = true;
    };
  }, [pending, licenseKey, trialStart]);
  return state;
}

/**
 * Profil fusionné avec les valeurs par défaut. `loaded` passe à true une fois IndexedDB lu.
 * L'objet est mémoïsé : il ne change de référence que lorsque la ligne en base change,
 * ce qui permet de l'utiliser sans risque dans les dépendances d'effets.
 */
export function useProfile(): { profile: Profile; loaded: boolean; exists: boolean } {
  const row = useLiveQuery(() => db.profile.get(1), [], null as Profile | null | undefined);
  return useMemo(() => {
    if (row === null) return { profile: DEFAULT_PROFILE, loaded: false, exists: false };
    return { profile: { ...DEFAULT_PROFILE, ...(row ?? {}) }, loaded: true, exists: !!row };
  }, [row]);
}

export function useBaremes(): Bareme[] {
  return useLiveQuery(() => db.baremes.toArray(), [], DEFAULT_BAREMES) ?? DEFAULT_BAREMES;
}

export function useClients(): Client[] {
  return useLiveQuery(() => db.clients.orderBy('nom').toArray(), [], []) ?? [];
}

export function useDocuments(): Doc[] {
  return useLiveQuery(() => db.documents.toArray(), [], []) ?? [];
}

export function usePaiements(): Paiement[] {
  return useLiveQuery(() => db.paiements.toArray(), [], []) ?? [];
}
