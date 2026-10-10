// Vérification hors ligne des clés de licence (ECDSA P-256 via WebCrypto).
// Les clés sont émises par scripts/license/issue.mjs avec la clé privée du vendeur ;
// seule la clé publique est embarquée ici. Les messages sont des clés de traduction.
import { addDays, parseISO, todayISO } from './dates';
import { PUBLIC_KEY_JWK } from './license-public-key';
import { REVOKED } from './revoked';

export const TRIAL_DAYS = 14;
/** Page de vente (checkout Lemon Squeezy, Gumroad, Stripe…). Vide : le bouton d'achat ouvre un e-mail vers SUPPORT_EMAIL. */
export const PURCHASE_URL = '';
export const SUPPORT_EMAIL = 'contact.maitox@gmail.com';
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
  | { status: 'invalid'; reasonKey: string };

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

export function parseKey(raw: string): { data: Uint8Array<ArrayBuffer>; sig: Uint8Array<ArrayBuffer>; payload: LicensePayload } | { errorKey: string } {
  const clean = raw.replace(/\s+/g, '');
  if (!clean.startsWith(PREFIX)) return { errorKey: 'licence.err.prefix' };
  const [p, s] = clean.slice(PREFIX.length).split('.');
  if (!p || !s) return { errorKey: 'licence.err.incomplete' };
  try {
    const data = b64uToBytes(p);
    const sig = b64uToBytes(s);
    const payload = JSON.parse(new TextDecoder().decode(data)) as LicensePayload;
    if (payload.v !== 1 || !payload.name || !payload.email) return { errorKey: 'licence.err.content' };
    return { data, sig, payload };
  } catch {
    return { errorKey: 'licence.err.unreadable' };
  }
}

let publicKeyPromise: Promise<CryptoKey> | null = null;
function publicKey(): Promise<CryptoKey> {
  publicKeyPromise ??= crypto.subtle.importKey('jwk', PUBLIC_KEY_JWK, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
  return publicKeyPromise;
}

export async function verifyKey(raw: string): Promise<{ ok: true; payload: LicensePayload } | { ok: false; reasonKey: string }> {
  const parsed = parseKey(raw);
  if ('errorKey' in parsed) return { ok: false, reasonKey: parsed.errorKey };
  if (!globalThis.crypto?.subtle) return { ok: false, reasonKey: 'licence.err.insecure' };
  const ok = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, await publicKey(), parsed.sig, parsed.data);
  return ok ? { ok: true, payload: parsed.payload } : { ok: false, reasonKey: 'licence.err.signature' };
}

/** Statut d'une licence dont la signature est déjà vérifiée. */
export function evaluate(license: LicensePayload, today = todayISO(), appVersion = __APP_VERSION__): LicenseStatus {
  // Révocation décidée par le vendeur (remboursement, clé diffusée) : liste embarquée à chaque version.
  if (REVOKED.includes(license.id)) return { status: 'invalid', reasonKey: 'licence.err.revoked' };
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

/** Cible du bouton d'achat : page de vente si configurée, sinon e-mail pré-rempli au vendeur. */
export function purchaseTarget(info: { name?: string; email?: string; subject: string; body: string }): { labelKey: string; url: string } {
  if (PURCHASE_URL) return { labelKey: 'licence.buy', url: PURCHASE_URL };
  return { labelKey: 'licence.request', url: `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(info.subject)}&body=${encodeURIComponent(info.body)}` };
}
