import { parseISO } from './dates';

const eur = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });
const eur0 = new Intl.NumberFormat('fr-FR', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
});
const num = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 });
const dateShort = new Intl.DateTimeFormat('fr-FR');
const dateLong = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

export const MOIS_COURT = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
export const MOIS_LONG = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
];

export function fmtEUR(n: number): string {
  return eur.format(round2(n));
}

export function fmtEUR0(n: number): string {
  return eur0.format(n);
}

/** Format compact pour les tuiles : 1 284 € · 12,9 k€ · 1,2 M€ */
export function fmtCompact(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${num.format(Math.round((n / 1_000_000) * 10) / 10)} M€`;
  if (abs >= 10_000) return `${num.format(Math.round((n / 1000) * 10) / 10)} k€`;
  return eur0.format(n);
}

export function fmtNum(n: number): string {
  return num.format(n);
}

export function fmtPct(n: number, digits = 2): string {
  return `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: digits }).format(n)} %`;
}

export function fmtDate(iso: string): string {
  if (!iso) return '';
  return dateShort.format(parseISO(iso));
}

export function fmtDateLong(iso: string): string {
  if (!iso) return '';
  return dateLong.format(parseISO(iso));
}

export function fmtMois(annee: number, mois: number): string {
  return `${MOIS_COURT[mois - 1]} ${annee}`;
}

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

/** Convertit une saisie utilisateur ("1 200,50") en nombre. */
export function parseNum(s: string): number {
  const cleaned = s.replace(/\s/g, '').replace(',', '.');
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}
