import type { Bareme } from '../db/types';

// Taux applicables au régime micro-social (URSSAF). Toutes les valeurs sont en % du CA
// encaissé, modifiables dans Paramètres → Barème.
//
// Sources : urssaf.fr (taux de cotisations auto-entrepreneur), décret n° 2024-484 (trajectoire
// BNC), décret n° 2025-943 (dernier palier BNC ramené à 25,6 % en 2026), economie.gouv.fr.

const COMMUN = {
  acreReduction: 50,
  versementLiberatoire: { vente: 1, bic: 1.7, bnc: 2.2, cipav: 2.2, meuble: 1 },
  cfp: { commercant: 0.1, artisan: 0.3, liberal: 0.2 },
  chambre: {
    cciVente: 0.015,
    cciServices: 0.044,
    cmaVente: 0.22,
    cmaServices: 0.48,
    doubleImmatriculation: 0.007,
  },
  plafondCA: { vente: 188_700, services: 77_700 },
  franchiseTVA: {
    venteBase: 85_000,
    venteMajore: 93_500,
    servicesBase: 37_500,
    servicesMajore: 41_250,
  },
  abattement: { vente: 71, bic: 50, bnc: 34, cipav: 34, meuble: 50 },
} satisfies Omit<Bareme, 'annee' | 'cotisations'>;

export const DEFAULT_BAREMES: Bareme[] = [
  {
    annee: 2024,
    cotisations: { vente: 12.3, bic: 21.2, bnc: 23.1, cipav: 23.2, meuble: 6 },
    ...COMMUN,
  },
  {
    annee: 2025,
    cotisations: { vente: 12.3, bic: 21.2, bnc: 24.6, cipav: 23.2, meuble: 6 },
    ...COMMUN,
  },
  {
    annee: 2026,
    cotisations: { vente: 12.3, bic: 21.2, bnc: 25.6, cipav: 23.2, meuble: 6 },
    ...COMMUN,
  },
];

export function defaultBaremeFor(annee: number): Bareme {
  const exact = DEFAULT_BAREMES.find((b) => b.annee === annee);
  if (exact) return exact;
  const latest = DEFAULT_BAREMES[DEFAULT_BAREMES.length - 1];
  return { ...latest, annee };
}

/** Choisit le barème de l'année demandée, sinon le plus récent disponible. */
export function pickBareme(baremes: Bareme[], annee: number): Bareme {
  const exact = baremes.find((b) => b.annee === annee);
  if (exact) return exact;
  const sorted = [...baremes].sort((a, b) => a.annee - b.annee);
  const before = sorted.filter((b) => b.annee < annee);
  if (before.length) return { ...before[before.length - 1], annee };
  if (sorted.length) return { ...sorted[0], annee };
  return defaultBaremeFor(annee);
}
