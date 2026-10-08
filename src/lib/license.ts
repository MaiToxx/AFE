// Vérification hors ligne des clés de licence (ECDSA P-256 via WebCrypto).
// Les clés sont émises par scripts/license/issue.mjs avec la clé privée du vendeur ;
// seule la clé publique est embarquée ici.
import { addDays, parseISO, todayISO } from './dates';
import { PUBLIC_KEY_JWK } from './license-public-key';

export const TRIAL_DAYS = 14;
/** Page de vente affichée dans l'application : à remplacer par la vôtre. */
export const PURCHASE_URL = 'https://exemple.fr/afe';
export const SUPPORT_EMAIL = 'contact@exemple.fr';
const PREFIX = 'AFE1-';

export interface LicensePayload {
  v: number;
  id: string;
  name: string;
  email: string;
  plan: 'perpetuelle' | 'abonnement';
  issued: string;
  expires?: string;
  /** Version majeure maximale couverte (licence perpétuelle « mises à jour 1.x »). */
  maxMajor?: number;
  note?: string;
}

export type LicenseStatus =
  | { status: 'loading' }
  | { status: 'trial'; daysLeft: number; endsOn: string }
  | { status: 'trial_over' }
  | { status: 'licensed'; license: LicensePayload }
  | { status: 'expired'; license: LicensePayload }
  | { status: 'unsupported'; license: LicensePayload }
  | { status: 'invalid'; reason: string };

/** La finalisation de documents est réservée à l'essai en cours et aux licences valides. */
export function canFinalize(s: LicenseStatus): boolean {
  return s.status === 'trial' || s.status === 'licensed';
}

export function majorOf(version: string): number {
  return Number(version.split('.')[0]) || 0;
}

function b64uToBytes(s: string): Uint8Array<ArrayBuffer> {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function parseKey(raw: string): { data: Uint8Array<ArrayBuffer>; sig: Uint8Array<ArrayBuffer>; payload: LicensePayload } | { error: string } {
  const clean = raw.replace(/\s+/g, '');
  if (!clean.startsWith(PREFIX)) return { error: 'Cette clé ne commence pas par « AFE1- » : vérifiez la copie.' };
  const [p, s] = clean.slice(PREFIX.length).split('.');
  if (!p || !s) return { error: 'Clé incomplète : vérifiez que vous avez copié la clé entière.' };
  try {
    const data = b64uToBytes(p);
    const sig = b64uToBytes(s);
    const payload = JSON.parse(new TextDecoder().decode(data)) as LicensePayload;
    if (payload.v !== 1 || !payload.name || !payload.email) return { error: 'Contenu de licence inattendu.' };
    return { data, sig, payload };
  } catch {
    return { error: 'Clé illisible : vérifiez la copie.' };
  }
}

let publicKeyPromise: Promise<CryptoKey> | null = null;
function publicKey(): Promise<CryptoKey> {
  publicKeyPromise ??= crypto.subtle.importKey('jwk', PUBLIC_KEY_JWK, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
  return publicKeyPromise;
}

export async function verifyKey(raw: string): Promise<{ ok: true; payload: LicensePayload } | { ok: false; reason: string }> {
  const parsed = parseKey(raw);
  if ('error' in parsed) return { ok: false, reason: parsed.error };
  if (!globalThis.crypto?.subtle) return { ok: false, reason: 'Vérification impossible : la page doit être servie en HTTPS (ou localhost).' };
  const ok = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, await publicKey(), parsed.sig, parsed.data);
  return ok
    ? { ok: true, payload: parsed.payload }
    : { ok: false, reason: 'Signature invalide : cette clé n’a pas été émise pour AFE ou a été altérée.' };
}

/** Statut d'une licence dont la signature est déjà vérifiée. */
export function evaluate(license: LicensePayload, today = todayISO(), appVersion = __APP_VERSION__): LicenseStatus {
  if (license.expires && license.expires < today) return { status: 'expired', license };
  if (license.maxMajor !== undefined && majorOf(appVersion) > license.maxMajor) return { status: 'unsupported', license };
  return { status: 'licensed', license };
}

export function trialStatus(trialStart: string, today = todayISO()): LicenseStatus {
  const endsOn = addDays(trialStart, TRIAL_DAYS);
  if (today > endsOn) return { status: 'trial_over' };
  const daysLeft = Math.max(0, Math.round((parseISO(endsOn).getTime() - parseISO(today).getTime()) / 86_400_000));
  return { status: 'trial', daysLeft, endsOn };
}
