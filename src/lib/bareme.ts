import type { LegacyBareme } from '../db/types';

// Anciens barèmes français (versions ≤ 0.2.x). Conservés uniquement pour détecter, lors de la
// migration, les barèmes que l'utilisateur avait modifiés : seuls ceux-là deviennent des
// surcharges du régime FR (src/regimes/presets/fr.ts).

const COMMUN = {
  acreReduction: 50,
  versementLiberatoire: { vente: 1, bic: 1.7, bnc: 2.2, cipav: 2.2, meuble: 1 },
  cfp: { commercant: 0.1, artisan: 0.3, liberal: 0.2 },
  chambre: { cciVente: 0.015, cciServices: 0.044, cmaVente: 0.22, cmaServices: 0.48, doubleImmatriculation: 0.007 },
  plafondCA: { vente: 188_700, services: 77_700 },
  franchiseTVA: { venteBase: 85_000, venteMajore: 93_500, servicesBase: 37_500, servicesMajore: 41_250 },
  abattement: { vente: 71, bic: 50, bnc: 34, cipav: 34, meuble: 50 },
};

export const DEFAULT_BAREMES: LegacyBareme[] = [
  { annee: 2024, cotisations: { vente: 12.3, bic: 21.2, bnc: 23.1, cipav: 23.2, meuble: 6 }, ...COMMUN },
  { annee: 2025, cotisations: { vente: 12.3, bic: 21.2, bnc: 24.6, cipav: 23.2, meuble: 6 }, ...COMMUN },
  { annee: 2026, cotisations: { vente: 12.3, bic: 21.2, bnc: 25.6, cipav: 23.2, meuble: 6 }, ...COMMUN },
];

export function baremeEqualsDefault(b: LegacyBareme): boolean {
  const d = DEFAULT_BAREMES.find((x) => x.annee === b.annee);
  return !!d && JSON.stringify(d) === JSON.stringify(b);
}
