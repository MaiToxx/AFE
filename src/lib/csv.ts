// Cellules des exports CSV (séparateur « ; », lisibles par Excel et LibreOffice).

/**
 * Cellule de texte. Un tableur exécute comme une formule tout contenu qui commence par = + - ou @ :
 * un nom de client ou un libellé saisi ainsi (ou venu d'une sauvegarde importée) est donc précédé
 * d'une apostrophe, qui le fait lire comme du texte.
 */
export function csvText(value: string | number | null | undefined): string {
  let s = String(value ?? '');
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

/** Cellule numérique : décimale à virgule, signe conservé (un montant négatif reste un nombre). */
export function csvNumber(n: number, digits = 2): string {
  return `"${(Number.isFinite(n) ? n : 0).toFixed(digits).replace('.', ',')}"`;
}

/** Fichier CSV complet : BOM UTF-8 (accents sous Excel) et fins de ligne Windows. */
export function csvFile(rows: string[][]): string {
  return '﻿' + rows.map((r) => r.join(';')).join('\r\n') + '\r\n';
}
