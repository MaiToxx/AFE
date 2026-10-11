// Début de la période d'essai. Dans la version bureau, il est aussi consigné hors du dossier de
// l'application (registre et %PROGRAMDATA%, voir src-tauri/src/essai.rs) : désinstaller puis
// réinstaller, ou effacer les données de l'application, ne redonne pas une période d'essai complète.
// Entre toutes les dates connues, la plus ancienne l'emporte.
import { isTauri } from './desktop';

const JOUR = 86_400_000;
const ORIGINE = Date.UTC(2000, 0, 1);
const MASQUE = 0x2b5d;
const MARQUE = /^e1-([0-9a-z]{1,6})-([0-9a-z]{3})$/;
/** Emplacements externes tenus à jour par la version bureau (registre, fichier commun à la machine). */
const EMPLACEMENTS = 2;

/**
 * Réglage local : plus haute date observée par cette installation. L'essai se décompte depuis elle
 * si l'horloge de l'ordinateur est ensuite reculée.
 */
export const SETTING_TRIAL_SEEN = 'trialSeen';

/** Numéro du jour depuis le 1er janvier 2000, ou null si la date n'existe pas. */
function dayNumber(iso: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const [y, m, d] = iso.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d));
  if (t.getUTCFullYear() !== y || t.getUTCMonth() !== m - 1 || t.getUTCDate() !== d) return null;
  return Math.round((t.getTime() - ORIGINE) / JOUR);
}

const PREMIER = dayNumber('2020-01-01')!;
const DERNIER = dayNumber('2100-01-01')!;
const control = (n: number): string => ((Math.imul(n, 0x9e3779b1) >>> 0) % 46_656).toString(36).padStart(3, '0');

/** Date ISO plausible pour un début d'essai. */
export function isTrialDate(v: unknown): v is string {
  if (typeof v !== 'string') return false;
  const n = dayNumber(v);
  return n !== null && n >= PREMIER && n <= DERNIER;
}

/**
 * Forme sous laquelle la date est consignée hors de l'application : une courte chaîne opaque munie
 * d'un contrôle, pour qu'une valeur retouchée à la main soit ignorée plutôt que prise pour une date.
 */
export function encodeTrialMark(start: string): string | null {
  if (!isTrialDate(start)) return null;
  const n = dayNumber(start)!;
  return `e1-${(n ^ MASQUE).toString(36)}-${control(n)}`;
}

export function decodeTrialMark(mark: string): string | null {
  const m = MARQUE.exec(mark.trim());
  if (!m) return null;
  const n = Number.parseInt(m[1], 36) ^ MASQUE;
  if (!Number.isInteger(n) || n < PREMIER || n > DERNIER || control(n) !== m[2]) return null;
  return new Date(ORIGINE + n * JOUR).toISOString().slice(0, 10);
}

/**
 * Début d'essai à retenir : la plus ancienne des dates connues, jamais postérieure à aujourd'hui
 * (une date future viendrait d'une horloge déréglée ou d'une valeur retouchée). Sans date : aujourd'hui.
 */
export function trialStartFrom(candidates: readonly unknown[], today: string): string {
  const first = candidates.filter(isTrialDate).sort()[0];
  return first !== undefined && first <= today ? first : today;
}

/** Marques consignées hors de l'application (version bureau uniquement). */
export async function readTrialMarks(): Promise<string[]> {
  if (!isTauri) return [];
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    const marks = await invoke<unknown>('marques_essai_lire');
    return Array.isArray(marks) ? marks.filter((m): m is string => typeof m === 'string') : [];
  } catch (e) {
    console.warn('Lecture du début d’essai impossible :', e);
    return [];
  }
}

/** Aligne les emplacements externes sur le début retenu : un emplacement effacé est recréé depuis l'autre. */
export async function syncTrialMarks(start: string, found: readonly string[]): Promise<void> {
  if (!isTauri) return;
  const mark = encodeTrialMark(start);
  if (!mark || (found.length >= EMPLACEMENTS && found.every((m) => m === mark))) return;
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('marques_essai_ecrire', { marque: mark });
  } catch (e) {
    console.warn('Enregistrement du début d’essai impossible :', e);
  }
}
