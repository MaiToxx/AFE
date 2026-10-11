// Révocation des licences. Le vendeur publie une liste signée des licences révoquées ; l'application
// la télécharge d'elle-même et en vérifie la signature avec la clé publique embarquée : personne
// d'autre ne peut révoquer (ni rétablir) une licence, et aucune mise à jour n'est nécessaire.
// Ce module ne touche pas au stockage (voir revocationsStore.ts), ce qui le rend testable seul.
import { b64uToBytes } from './base64url';
import { daysBetween } from './dates';
import { PUBLIC_KEY_JWK } from './license-public-key';
import { EMBEDDED_REVOCATIONS } from './revocation-list';

export interface RevocationList {
  v: number;
  /** Date de signature (ISO, UTC) : entre deux listes, la plus récente fait foi. */
  issued: string;
  ids: string[];
  sig: string;
}

/**
 * Adresses de la liste publiée : le dépôt GitHub, puis son miroir jsDelivr. C'est un simple
 * téléchargement de fichier public : ni la licence ni aucune donnée de l'utilisateur ne sont envoyées.
 */
export const REVOCATION_URLS: readonly string[] = [
  'https://raw.githubusercontent.com/MaiToxx/AFE/main/licences/revocations.json',
  'https://cdn.jsdelivr.net/gh/MaiToxx/AFE@main/licences/revocations.json',
];

/**
 * Nombre de jours pendant lesquels une licence reste utilisable sans que l'application ait pu joindre
 * le service. Au-delà, la finalisation est suspendue jusqu'à la prochaine vérification réussie :
 * sans cela, il suffirait de couper l'accès à Internet pour échapper à une révocation.
 * 0 désactive cette exigence (la licence ne dépend alors jamais d'une connexion).
 */
export const REVOCATION_GRACE_DAYS: number = 30;

/** Intervalle minimal entre deux vérifications automatiques réussies. */
export const REVOCATION_REFRESH_MS = 6 * 3_600_000;

/** Réglages propres à cette installation : jamais repris d'une sauvegarde restaurée. */
export const SETTING_REVOCATIONS = 'revocations';
export const SETTING_REVOCATIONS_CHECKED = 'revocationsCheckedAt';
export const LOCAL_SETTINGS: readonly string[] = [SETTING_REVOCATIONS, SETTING_REVOCATIONS_CHECKED];

/** Liste embarquée à la compilation : point de départ avant le premier téléchargement. */
export const EMBEDDED: RevocationList = EMBEDDED_REVOCATIONS;

const DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const ID = /^[0-9A-F]{8}$/;

export function isRevocationList(x: unknown): x is RevocationList {
  if (typeof x !== 'object' || x === null) return false;
  const l = x as Record<string, unknown>;
  return (
    l.v === 1 && typeof l.issued === 'string' && DATE.test(l.issued) && Array.isArray(l.ids) &&
    l.ids.every((id) => typeof id === 'string' && ID.test(id)) && typeof l.sig === 'string'
  );
}

/** Texte signé par le vendeur ; son préfixe le distingue d'une charge utile de licence (du JSON). */
export function revocationMessage(issued: string, ids: readonly string[]): string {
  return `AFE-REVOCATIONS-1|${issued}|${ids.join(',')}`;
}

const keys = new WeakMap<object, Promise<CryptoKey>>();
function importKey(jwk: JsonWebKey): Promise<CryptoKey> {
  let p = keys.get(jwk);
  if (!p) {
    p = crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
    keys.set(jwk, p);
  }
  return p;
}

export async function verifyRevocationList(list: RevocationList, jwk: JsonWebKey = PUBLIC_KEY_JWK): Promise<boolean> {
  if (!globalThis.crypto?.subtle) return false;
  try {
    const data = new TextEncoder().encode(revocationMessage(list.issued, list.ids));
    return await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, await importKey(jwk), b64uToBytes(list.sig), data);
  } catch {
    return false;
  }
}

/** La plus récente des deux listes. Une liste plus ancienne ne remplace jamais une plus récente. */
export function newerList(a: RevocationList, b: RevocationList | null | undefined): RevocationList {
  return b && b.issued > a.issued ? b : a;
}

export interface FetchOutcome {
  /** Une source au moins a répondu : l'appareil n'est pas coupé du service. */
  contact: boolean;
  /** Liste correctement signée, si une source en a fourni une. */
  list: RevocationList | null;
}

/**
 * Interroge les sources dans l'ordre jusqu'à obtenir une liste authentique. Une réponse d'erreur
 * (fichier absent, panne du service) compte comme un contact : le vendeur, pas le client, est alors
 * en cause, et la licence n'en est pas pénalisée.
 */
export async function fetchRevocations(
  urls: readonly string[] = REVOCATION_URLS,
  fetchImpl: typeof fetch = fetch,
  verify: (list: RevocationList) => Promise<boolean> = verifyRevocationList,
): Promise<FetchOutcome> {
  let contact = false;
  for (const url of urls) {
    try {
      const signal = typeof AbortSignal.timeout === 'function' ? AbortSignal.timeout(10_000) : undefined;
      const rep = await fetchImpl(url, { cache: 'no-store', credentials: 'omit', signal });
      contact = true;
      if (!rep.ok) continue;
      const data: unknown = await rep.json().catch(() => null);
      if (isRevocationList(data) && (await verify(data))) return { contact: true, list: data };
    } catch {
      /* source injoignable : on essaie la suivante */
    }
  }
  return { contact, list: null };
}

/** Le délai sans vérification est-il dépassé ? `reference` : dernière vérification, sinon date d'émission de la licence. */
export function graceExceeded(reference: string, today: string, days: number = REVOCATION_GRACE_DAYS): boolean {
  if (days <= 0) return false;
  return daysBetween(reference.slice(0, 10), today) > days;
}

/** Ce que l'évaluation d'une licence doit savoir des révocations. */
export interface RevocationView {
  ids: readonly string[];
  /** Dernier contact réussi avec le service (ISO) ; null : jamais ; absent : délai non appliqué. */
  checkedAt?: string | null;
  /** Date de signature de la liste appliquée (ISO) : repère de date fiable, car signé par le vendeur. */
  listIssued?: string;
}
