import { parseISO } from './dates';

// Formats dépendants de la locale et de la devise courantes (fixées par l'application selon
// la langue et le pays du profil) ; `fmtMoneyIn` permet de formater dans une autre locale/devise
// (documents imprimés dans la langue du client).

let state = { locale: 'fr-FR', currency: 'EUR' };
const cache = new Map<string, Intl.NumberFormat>();
const dateCache = new Map<string, Intl.DateTimeFormat>();

export function setFormatting(locale: string, currency: string): void {
  state = { locale, currency };
}

export function getFormatting(): { locale: string; currency: string } {
  return state;
}

function nf(locale: string, opts: Intl.NumberFormatOptions): Intl.NumberFormat {
  const key = locale + JSON.stringify(opts);
  let f = cache.get(key);
  if (!f) {
    try {
      f = new Intl.NumberFormat(locale, opts);
    } catch {
      f = new Intl.NumberFormat('fr-FR', { ...opts, currency: 'EUR' });
    }
    cache.set(key, f);
  }
  return f;
}

function df(locale: string, opts: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = locale + JSON.stringify(opts);
  let f = dateCache.get(key);
  if (!f) {
    try {
      f = new Intl.DateTimeFormat(locale, opts);
    } catch {
      f = new Intl.DateTimeFormat('fr-FR', opts);
    }
    dateCache.set(key, f);
  }
  return f;
}

export function fmtMoneyIn(locale: string, currency: string, n: number, digits: 0 | 2 = 2): string {
  return nf(locale, { style: 'currency', currency, minimumFractionDigits: digits, maximumFractionDigits: digits }).format(digits === 2 ? round2(n) : n);
}

export function fmtMoney(n: number): string {
  return fmtMoneyIn(state.locale, state.currency, n, 2);
}

export function fmtMoney0(n: number): string {
  return fmtMoneyIn(state.locale, state.currency, n, 0);
}

/** Format compact pour les tuiles : 1 284 € · 12,9 k€ · 1,2 M€ (selon la locale). */
export function fmtCompact(n: number): string {
  if (Math.abs(n) < 10_000) return fmtMoney0(n);
  return nf(state.locale, { style: 'currency', currency: state.currency, notation: 'compact', maximumFractionDigits: 1 }).format(n);
}

export function fmtNum(n: number, digits = 2): string {
  return nf(state.locale, { maximumFractionDigits: digits }).format(n);
}

export function fmtPct(n: number, digits = 2): string {
  return `${nf(state.locale, { maximumFractionDigits: digits }).format(n)} %`;
}

/** Date courte à chiffres complets (20/04/2026, 20.04.2026, 04/20/2026 selon la locale). */
export function fmtDate(iso: string, locale = state.locale): string {
  if (!iso) return '';
  return df(locale, { day: '2-digit', month: '2-digit', year: 'numeric' }).format(parseISO(iso));
}

export function fmtDateLong(iso: string, locale = state.locale): string {
  if (!iso) return '';
  return df(locale, { day: 'numeric', month: 'long', year: 'numeric' }).format(parseISO(iso));
}

/** Nom du mois (1–12) dans la locale courante. */
export function moisLong(mois: number, locale = state.locale): string {
  return df(locale, { month: 'long' }).format(new Date(2026, mois - 1, 15));
}

export function moisCourt(mois: number, locale = state.locale): string {
  return df(locale, { month: 'short' }).format(new Date(2026, mois - 1, 15));
}

export function moisCourts(locale = state.locale): string[] {
  return Array.from({ length: 12 }, (_, i) => moisCourt(i + 1, locale));
}

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

const sepCache = new Map<string, { decimal: string; group: string }>();

/** Séparateurs décimal et de milliers d'une locale (« , » et espace en français, « . » et « , » en anglais…). */
export function separators(locale = state.locale): { decimal: string; group: string } {
  let s = sepCache.get(locale);
  if (!s) {
    let parts: Intl.NumberFormatPart[] = [];
    try {
      parts = new Intl.NumberFormat(locale, { useGrouping: true }).formatToParts(1234567.5);
    } catch {
      /* locale inconnue : conventions françaises */
    }
    s = { decimal: parts.find((p) => p.type === 'decimal')?.value ?? ',', group: parts.find((p) => p.type === 'group')?.value ?? ' ' };
    sepCache.set(locale, s);
  }
  return s;
}

/** Nombre tel qu'il s'affiche dans un champ de saisie : sans milliers, avec le séparateur décimal de la locale. */
export function fmtInput(n: number, locale = state.locale): string {
  return Number.isFinite(n) ? String(n).replace('.', separators(locale).decimal) : '';
}

/**
 * Convertit une saisie utilisateur en nombre : "1 200,50", "1,200.50", "1.200,50", "1'200.50".
 * Un séparateur seul suivi de trois chiffres ("1.200", "1,200") se lit comme des milliers dans les
 * locales où ce signe groupe les milliers, comme une décimale ailleurs.
 */
export function parseNum(s: string, locale = state.locale): number {
  // Espaces (y compris insécables) et apostrophes servent de séparateurs de milliers.
  let cleaned = s.replace(/[\s'’]/g, '');
  const comma = cleaned.includes(',');
  const dot = cleaned.includes('.');
  if (comma && dot) {
    // Le dernier séparateur est le séparateur décimal.
    cleaned = cleaned.lastIndexOf(',') > cleaned.lastIndexOf('.') ? cleaned.replace(/\./g, '').replace(',', '.') : cleaned.replace(/,/g, '');
  } else if (comma || dot) {
    const sep = comma ? ',' : '.';
    const parts = cleaned.split(sep);
    const { decimal, group } = separators(locale);
    const milliers = parts.length > 2 || (group === sep && decimal !== sep && /^-?[1-9]\d{0,2}$/.test(parts[0]) && /^\d{3}$/.test(parts[1]));
    cleaned = milliers ? parts.join('') : parts.join('.');
  }
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}
