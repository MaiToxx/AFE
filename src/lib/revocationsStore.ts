// Liste des licences révoquées côté stockage : mise en cache de la liste téléchargée, date de la
// dernière vérification, et déclenchement des vérifications (au lancement, périodiquement, à la demande).
import { getSetting, setSetting } from '../db/db';
import {
  EMBEDDED, REVOCATION_REFRESH_MS, SETTING_REVOCATIONS, SETTING_REVOCATIONS_CHECKED, fetchRevocations, isRevocationList, newerList,
  verifyRevocationList, type RevocationList, type RevocationView,
} from './revocations';

// Une première tentative de vérification a-t-elle abouti (ou échoué) depuis le lancement ? Tant que
// ce n'est pas le cas, une licence « à vérifier » est simplement en cours de vérification.
let settled = false;
const listeners = new Set<() => void>();

export function subscribeCheckSettled(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function isCheckSettled(): boolean {
  return settled;
}

function settle() {
  if (settled) return;
  settled = true;
  listeners.forEach((l) => l());
}

// La signature de la liste en cache est revérifiée à chaque lancement : une liste modifiée à la main
// dans le stockage est ignorée.
const verified = new Map<string, RevocationList | null>();

async function cachedList(json: string): Promise<RevocationList | null> {
  if (!json) return null;
  const known = verified.get(json);
  if (known !== undefined) return known;
  let list: RevocationList | null = null;
  try {
    const data: unknown = JSON.parse(json);
    if (isRevocationList(data) && (await verifyRevocationList(data))) list = data;
  } catch {
    /* cache illisible : ignoré */
  }
  if (verified.size > 8) verified.clear();
  verified.set(json, list);
  return list;
}

/** Révocations à appliquer : la plus récente de la liste embarquée et de la liste en cache. */
export async function revocationView(cachedJson: string, checkedAt: string): Promise<RevocationView & { checkedAt: string | null; listIssued: string }> {
  const list = newerList(EMBEDDED, await cachedList(cachedJson));
  const t = Date.parse(checkedAt);
  // Une date de vérification située dans le futur (horloge déréglée, valeur modifiée) n'est pas retenue.
  const valid = Number.isFinite(t) && t <= Date.now() + 86_400_000;
  return { ids: list.ids, checkedAt: valid ? checkedAt : null, listIssued: list.issued };
}

export type RefreshResult =
  /** Vérification récente : rien à faire. */
  | { status: 'recent' }
  /** Service joint ; `changed` : une liste plus récente a été reçue. */
  | { status: 'ok'; changed: boolean }
  /** Service injoignable (hors connexion). */
  | { status: 'offline' };

let inFlight: Promise<RefreshResult> | null = null;
let inFlightForced = false;

/** Télécharge la liste si la dernière vérification est ancienne (ou si `force`). Les appels simultanés sont regroupés. */
export function refreshRevocations({ force = false }: { force?: boolean } = {}): Promise<RefreshResult> {
  if (inFlight) {
    // Une demande expresse ne se contente pas d'une vérification de routine déjà en cours, qui peut s'abstenir.
    return force && !inFlightForced ? inFlight.then(() => refreshRevocations({ force: true })) : inFlight;
  }
  inFlightForced = force;
  inFlight = (async (): Promise<RefreshResult> => {
    try {
      const last = Date.parse((await getSetting(SETTING_REVOCATIONS_CHECKED)) ?? '');
      const age = Date.now() - last;
      if (!force && Number.isFinite(last) && age >= 0 && age < REVOCATION_REFRESH_MS) return { status: 'recent' };
      const { contact, list } = await fetchRevocations();
      if (!contact) return { status: 'offline' };
      let changed = false;
      if (list) {
        const current = newerList(EMBEDDED, await cachedList((await getSetting(SETTING_REVOCATIONS)) ?? ''));
        if (list.issued > current.issued) {
          await setSetting(SETTING_REVOCATIONS, JSON.stringify(list));
          changed = true;
        }
      }
      await setSetting(SETTING_REVOCATIONS_CHECKED, new Date().toISOString());
      return { status: 'ok', changed };
    } catch {
      return { status: 'offline' };
    } finally {
      inFlight = null;
      settle();
    }
  })();
  return inFlight;
}

/** Vérification de fond : seulement si une licence est enregistrée (rien à vérifier pendant l'essai). */
export async function refreshRevocationsIfLicensed(force = false): Promise<void> {
  try {
    if (await getSetting('licenseKey')) await refreshRevocations({ force });
  } catch {
    /* stockage indisponible */
  }
}
