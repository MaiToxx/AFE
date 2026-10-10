// Éléments communs aux statuts français hors micro : cotisations des travailleurs non salariés (TNS),
// barème de l'impôt sur le revenu, impôt sur les sociétés, seuils de TVA.
import type { Composante, LText, Regime, Seuil, Tranche } from '../types';
import fr from './fr';

/** Plafond annuel de la sécurité sociale. */
export const PASS: Record<number, number> = { 2024: 46_368, 2025: 47_100, 2026: 48_060 };

/**
 * Cotisations TNS (SSI) avec CSG-CRDS, en taux effectifs appliqués au revenu avant abattement.
 * Depuis 2025 l'assiette sociale vaut 74 % du revenu (abattement forfaitaire de 26 %) : les taux
 * (≈ 42 % jusqu'à 1 PASS, ≈ 28,5 % jusqu'à 4 PASS, ≈ 20,5 % au-delà) sont donc appliqués à 74 %
 * du revenu, soit des bornes divisées par 0,74. Avant 2025 : CSG sur revenu + cotisations.
 */
export function tranchesTNS(annee: number): Tranche[] {
  const pass = PASS[annee] ?? PASS[2026];
  if (annee < 2025) return [{ jusqua: pass, taux: 44 }, { jusqua: 4 * pass, taux: 29 }, { jusqua: null, taux: 20 }];
  const k = 0.74;
  return [
    { jusqua: Math.round(pass / k), taux: 31.1 },
    { jusqua: Math.round((4 * pass) / k), taux: 21.1 },
    { jusqua: null, taux: 15.2 },
  ];
}

/** Cotisations minimales annuelles (retraite de base, indemnités journalières, invalidité-décès). */
export const TNS_MIN = 1_160;

export const TNS_NOTE: LText = {
  fr: "Retraite de base et complémentaire, maladie-maternité, indemnités journalières, invalidité-décès, allocations familiales et CSG-CRDS, sur une assiette égale à 74 % du revenu (abattement de 26 % depuis 2025). Cotisations minimales appliquées ; régularisation l'année suivante sur le revenu réel déclaré.",
  en: 'Basic and supplementary pension, health, daily allowances, disability-death, family allowances and CSG-CRDS, on a base equal to 74% of income (26% allowance since 2025). Minimum contributions applied; regularised the following year on actual declared income.',
};

/** Barème de l'impôt sur le revenu pour une part (revenus 2025 imposés en 2026), hors décote. */
export const TRANCHES_IR: Tranche[] = [
  { jusqua: 11_497, taux: 0 },
  { jusqua: 29_315, taux: 11 },
  { jusqua: 83_823, taux: 30 },
  { jusqua: 180_294, taux: 41 },
  { jusqua: null, taux: 45 },
];

export const IR_NOTE: LText = {
  fr: 'Barème progressif pour une part fiscale, appliqué au revenu après cotisations ; hors autres revenus du foyer, décote, réductions et crédits d’impôt. Indicatif.',
  en: 'Progressive scale for one tax share, applied to income after contributions; excluding other household income, rebates, reductions and tax credits. Indicative.',
};

/** Impôt sur les sociétés : 15 % jusqu'à 42 500 € de bénéfice (PME), 25 % au-delà. */
export const TRANCHES_IS: Tranche[] = [{ jusqua: 42_500, taux: 15 }, { jusqua: null, taux: 25 }];

export const IS_NOTE: LText = {
  fr: 'Taux réduit de 15 % jusqu’à 42 500 € de bénéfice (CA < 10 M€, capital détenu à 75 % au moins par des personnes physiques), 25 % au-delà. Bénéfice = recettes − dépenses − rémunération − charges sociales. Hors CFE et contribution sociale.',
  en: 'Reduced 15% rate up to €42,500 of profit (turnover < €10M, at least 75% of capital held by individuals), 25% above. Profit = receipts − expenses − remuneration − social charges. Excluding CFE and social contribution.',
};

export const CFP_TNS: Composante = {
  id: 'cfp',
  categorie: 'social',
  type: 'fixe_mois',
  montant: 10,
  label: { fr: 'Formation professionnelle (CFP)', en: 'Vocational training contribution (CFP)' },
  note: { fr: '0,25 % du PASS par an (≈ 120 €), appelée en novembre.', en: '0.25% of the PASS per year (≈ €120), called in November.' },
};

/** Seuils de franchise en base de TVA (identiques au micro). */
export const SEUILS_TVA_FR: Seuil[] = fr.params[2026].seuils.filter((s) => s.kind === 'tva');

/** TVA au réel : CA12 annuelle (réel simplifié) par défaut, CA3 mensuelle ou trimestrielle sinon. */
export const TVA_FR: Regime['tva'] = {
  ...fr.tva,
  periodicites: ['annuelle', 'trimestrielle', 'mensuelle'],
  periodiciteDefaut: 'annuelle',
  echeance: { type: 'jours', jours: 20 },
};

export const IDENT_SOCIETE_FR = [
  { id: 'forme', label: { fr: 'Forme juridique', en: 'Legal form' }, placeholder: 'SASU' },
  { id: 'siret', label: { fr: 'SIRET', en: 'SIRET' }, placeholder: '123 456 789 00012' },
  { id: 'rcs', label: { fr: 'RCS (ville et numéro)', en: 'RCS (city and number)' }, placeholder: 'RCS Lyon 123 456 789' },
  { id: 'capital', label: { fr: 'Capital social', en: 'Share capital' }, placeholder: '1 000 €' },
  { id: 'tva', label: { fr: 'N° de TVA intracommunautaire', en: 'EU VAT number' }, placeholder: 'FR12 345678901', pourTva: true },
];

export const PIED_SOCIETE_FR: LText = { fr: '{forme} au capital de {capital} — {rcs}', en: '{forme} with a share capital of {capital} — {rcs}' };

export const PERIODICITES_TNS = ['mensuelle', 'trimestrielle'] as const;

export const SOURCES_TNS = [
  'https://www.urssaf.fr/accueil/independant/artisan-commercant/taux-cotisations.html',
  'https://www.urssaf.fr/accueil/independant/profession-liberale/taux-cotisations.html',
  'https://www.impots.gouv.fr/professionnel',
];
