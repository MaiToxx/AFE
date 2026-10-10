import type { Regime, RegimeParams } from '../types';

// France — micro-entrepreneur (régime micro-social). Sources : urssaf.fr, economie.gouv.fr,
// décret n° 2024-484 (trajectoire BNC), décret n° 2025-943 (dernier palier BNC à 25,6 % en 2026).

const params = (bnc: number): RegimeParams => ({
  seuils: [
    { id: 'plafond_vente', kind: 'regime', groupe: 'vente', valeur: 188_700, label: { fr: 'Plafond micro-entreprise (vente)', en: 'Micro-enterprise ceiling (goods)' } },
    { id: 'plafond_services', kind: 'regime', groupe: 'services', valeur: 77_700, label: { fr: 'Plafond micro-entreprise (services)', en: 'Micro-enterprise ceiling (services)' } },
    { id: 'tva_vente', kind: 'tva', groupe: 'vente', valeur: 85_000, majore: 93_500, label: { fr: 'Franchise de TVA (vente / hébergement)', en: 'VAT exemption (goods / accommodation)' } },
    { id: 'tva_services', kind: 'tva', groupe: 'services', valeur: 37_500, majore: 41_250, label: { fr: 'Franchise de TVA (services)', en: 'VAT exemption (services)' } },
  ],
  tvaTaux: [20, 10, 5.5, 2.1],
  tvaDefaut: 20,
  // 1 − abattement forfaitaire (71 % vente, 50 % BIC, 34 % BNC, 50 % meublés classés).
  coefficientNet: { vente: 0.29, bic: 0.5, bnc: 0.66, cipav: 0.66, meuble: 0.5 },
  composantes: [
    {
      id: 'cotisations',
      categorie: 'social',
      type: 'pct_ca',
      label: { fr: 'Cotisations sociales', en: 'Social contributions' },
      tauxParActivite: { vente: 12.3, bic: 21.2, bnc, cipav: 23.2, meuble: 6 },
      reductionDebut: { facteur: 0.5, mois: 12, alignTrimestre: true },
    },
    {
      id: 'cfp',
      categorie: 'social',
      type: 'pct_ca',
      label: { fr: 'Formation professionnelle (CFP)', en: 'Vocational training contribution (CFP)' },
      tauxParNature: { commercant: 0.1, artisan: 0.3, liberal: 0.2 },
    },
    {
      id: 'chambre_cci',
      categorie: 'autre',
      type: 'pct_ca',
      natures: ['commercant'],
      label: { fr: 'Taxe pour frais de chambre (CCI)', en: 'Chamber of commerce levy (CCI)' },
      tauxParGroupeTva: { vente: 0.015, services: 0.044 },
    },
    {
      id: 'chambre_cma',
      categorie: 'autre',
      type: 'pct_ca',
      natures: ['artisan'],
      label: { fr: 'Taxe pour frais de chambre (CMA)', en: 'Chamber of trades levy (CMA)' },
      tauxParGroupeTva: { vente: 0.22, services: 0.48 },
    },
    {
      id: 'chambre_double',
      categorie: 'autre',
      type: 'pct_ca',
      natures: ['artisan'],
      option: 'doubleImmatriculation',
      label: { fr: 'Double immatriculation (part CCI)', en: 'Dual registration levy (CCI share)' },
      taux: 0.007,
    },
    {
      id: 'vl',
      categorie: 'impot',
      type: 'pct_ca',
      option: 'vl',
      label: { fr: 'Impôt sur le revenu (versement libératoire)', en: 'Income tax (flat-rate payment)' },
      tauxParActivite: { vente: 1, bic: 1.7, bnc: 2.2, cipav: 2.2, meuble: 1 },
    },
  ],
});

const fr: Regime = {
  code: 'FR',
  nom: { fr: 'France', en: 'France', es: 'Francia', de: 'Frankreich', it: 'Francia', pt: 'França', nl: 'Frankrijk' },
  drapeau: '🇫🇷',
  devise: 'EUR',
  langues: ['fr', 'en'],
  statut: { fr: 'Micro-entrepreneur (auto-entrepreneur)', en: 'Micro-entrepreneur (auto-entrepreneur)' },
  activites: [
    { id: 'vente', groupe: 'vente', label: { fr: 'Vente de marchandises, fourniture de logement (BIC)', en: 'Sale of goods, accommodation (BIC)' }, court: { fr: 'Vente', en: 'Goods' } },
    { id: 'bic', groupe: 'services', label: { fr: 'Prestations de services commerciales ou artisanales (BIC)', en: 'Commercial or craft services (BIC)' }, court: { fr: 'Services BIC', en: 'Services (BIC)' } },
    { id: 'bnc', groupe: 'services', label: { fr: 'Prestations de services et professions libérales non réglementées (BNC)', en: 'Services and unregulated professions (BNC)' }, court: { fr: 'BNC', en: 'BNC' } },
    { id: 'cipav', groupe: 'services', label: { fr: 'Professions libérales réglementées relevant de la CIPAV (BNC)', en: 'Regulated professions under CIPAV (BNC)' }, court: { fr: 'CIPAV', en: 'CIPAV' } },
    { id: 'meuble', groupe: 'services', groupeTva: 'vente', label: { fr: 'Location de meublés de tourisme classés', en: 'Classified furnished tourist rentals' }, court: { fr: 'Meublés classés', en: 'Furnished rentals' } },
  ],
  activiteDefaut: 'bnc',
  natures: [
    { id: 'commercant', label: { fr: 'Commerçant (CCI)', en: 'Trader (CCI)' } },
    { id: 'artisan', label: { fr: 'Artisan (CMA)', en: 'Craftsperson (CMA)' } },
    { id: 'liberal', label: { fr: 'Profession libérale', en: 'Liberal profession' } },
  ],
  identifiants: [
    { id: 'siret', label: { fr: 'SIRET', en: 'SIRET' }, placeholder: '123 456 789 00012' },
    { id: 'tva', label: { fr: 'N° de TVA intracommunautaire', en: 'EU VAT number' }, placeholder: 'FR12 345678901', pourTva: true },
  ],
  identifiantClient: { fr: 'SIRET', en: 'SIRET' },
  tva: {
    nom: 'TVA',
    franchisePossible: true,
    mentionFranchise: { fr: 'TVA non applicable, art. 293 B du CGI.', en: 'VAT not applicable, art. 293 B of the French Tax Code (CGI).' },
    mentionNumero: { fr: 'N° TVA', en: 'VAT no.' },
  },
  mentions: {
    retard: {
      fr: "Pénalités de retard : trois fois le taux d'intérêt légal en vigueur, exigibles sans rappel dès le lendemain de la date d'échéance. Indemnité forfaitaire pour frais de recouvrement : 40 € (art. L441-10 et D441-5 du Code de commerce). Pas d'escompte pour paiement anticipé.",
      en: 'Late payment penalties: three times the statutory interest rate, due without reminder from the day after the due date. Fixed compensation for recovery costs: €40 (art. L441-10 and D441-5 of the French Commercial Code). No discount for early payment.',
    },
    pied: {
      fr: "Entrepreneur individuel — dispensé d'immatriculation au registre du commerce et des sociétés (RCS) et au répertoire des métiers (RM).",
      en: 'Sole trader — exempt from registration in the trade and companies register (RCS) and the trades register (RM).',
    },
    piedNatures: ['liberal'],
  },
  periodicites: ['mensuelle', 'trimestrielle'],
  periodiciteDefaut: 'mensuelle',
  echeance: { type: 'fin_mois_suivant' },
  options: {
    acre: {
      label: { fr: "Je bénéficie de l'ACRE", en: 'I benefit from ACRE (start-up relief)' },
      aide: { fr: "Cotisations réduites de moitié jusqu'à la fin du 3e trimestre civil suivant le début d'activité.", en: 'Contributions halved until the end of the 3rd calendar quarter following the start of activity.' },
    },
    vl: {
      label: { fr: "J'ai opté pour le versement libératoire de l'impôt sur le revenu", en: 'I opted for the flat-rate income tax payment (versement libératoire)' },
      aide: { fr: "L'impôt est alors prélevé par l'URSSAF avec les cotisations (1 %, 1,7 % ou 2,2 % du CA).", en: 'Income tax is then collected by URSSAF with the contributions (1%, 1.7% or 2.2% of turnover).' },
    },
  },
  params: { 2024: params(23.1), 2025: params(24.6), 2026: params(25.6) },
  livreRecettes: { fr: 'Livre des recettes', en: 'Receipts book (livre des recettes)' },
  avertissement: {
    fr: "Barème URSSAF du régime micro-social. Les montants sont à reporter sur autoentrepreneur.urssaf.fr ; vérifiez les taux chaque début d'année.",
    en: 'URSSAF micro-social scheme rates. Amounts are to be reported on autoentrepreneur.urssaf.fr; check the rates at the start of each year.',
  },
  sources: ['https://www.urssaf.fr/accueil/independant/auto-entrepreneur/taux-cotisations.html', 'https://www.economie.gouv.fr/entreprises/micro-entreprise-auto-entreprise-charges-sociales'],
};

export default fr;
