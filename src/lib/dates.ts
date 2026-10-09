// Dates manipulées sous forme de chaînes ISO locales "yyyy-mm-dd" (pas de fuseau horaire).

const pad = (n: number) => String(n).padStart(2, '0');

export function toISO(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function todayISO(): string {
  return toISO(new Date());
}

export function parseISO(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function addDays(iso: string, n: number): string {
  const d = parseISO(iso);
  d.setDate(d.getDate() + n);
  return toISO(d);
}

export function yearOf(iso: string): number {
  return Number(iso.slice(0, 4));
}

/** Mois de 1 à 12. */
export function monthOf(iso: string): number {
  return Number(iso.slice(5, 7));
}

export function lastDayOfMonth(annee: number, mois: number): number {
  return new Date(annee, mois, 0).getDate();
}

export function startOfMonth(annee: number, mois: number): string {
  return `${annee}-${pad(mois)}-01`;
}

export function endOfMonth(annee: number, mois: number): string {
  return `${annee}-${pad(mois)}-${pad(lastDayOfMonth(annee, mois))}`;
}

/** Décale (année, mois) de n mois ; mois 1–12. */
export function shiftMonth(annee: number, mois: number, n: number): { annee: number; mois: number } {
  const idx = annee * 12 + (mois - 1) + n;
  return { annee: Math.floor(idx / 12), mois: (idx % 12) + 1 };
}

export function isValidISO(iso: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(iso) && !Number.isNaN(parseISO(iso).getTime());
}

/** Ajoute n mois en conservant le jour (ramené au dernier jour du mois si besoin). */
export function addMonths(iso: string, n: number): string {
  const d = parseISO(iso);
  const { annee, mois } = shiftMonth(d.getFullYear(), d.getMonth() + 1, n);
  const day = Math.min(d.getDate(), lastDayOfMonth(annee, mois));
  return `${annee}-${pad(mois)}-${pad(day)}`;
}

/** Nombre de jours entre deux dates ISO (positif si `b` est après `a`). */
export function daysBetween(a: string, b: string): number {
  return Math.round((parseISO(b).getTime() - parseISO(a).getTime()) / 86_400_000);
}
