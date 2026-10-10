import type { Regime, RegimeParams } from '../types';
import fr from './fr';
import { CFP_TNS, IR_NOTE, PASS, PERIODICITES_TNS, SEUILS_TVA_FR, SOURCES_TNS, TNS_MIN, TNS_NOTE, TRANCHES_IR, TVA_FR, tranchesTNS } from './fr-common';

// France — entreprise individuelle au régime réel (BNC déclaration contrôlée ou BIC réel simplifié),
// imposée à l'impôt sur le revenu : cotisations TNS sur le bénéfice (recettes − dépenses).

const params = (annee: number): RegimeParams => ({
  seuils: [
    { id: 'reel_vente', kind: 'regime', groupe: 'vente', valeur: 840_000, label: { fr: 'Plafond du réel simplifié (vente)', en: 'Simplified real regime ceiling (goods)' } },
    { id: 'reel_services', kind: 'regime', groupe: 'services', valeur: 254_000, label: { fr: 'Plafond du réel simplifié (services)', en: 'Simplified real regime ceiling (services)' } },
    ...structuredClone(SEUILS_TVA_FR),
  ],
  tvaTaux: [20, 10, 5.5, 2.1],
  tvaDefaut: 20,
  coefficientNet: 1,
  baseRevenu: 'reel',
  composantes: [
    {
      id: 'tns',
      categorie: 'social',
      type: 'tranches_annuel',
      label: { fr: 'Cotisations sociales TNS (SSI, CSG-CRDS incluses)', en: 'Self-employed social contributions (SSI, incl. CSG-CRDS)' },
      tranches: tranchesTNS(annee),
      min: TNS_MIN,
      reductionDebut: { facteur: 0.5, mois: 12 },
      note: { ...TNS_NOTE, fr: `${TNS_NOTE.fr} PASS ${annee} : ${(PASS[annee] ?? PASS[2026]).toLocaleString('fr-FR')} €.` },
    },
    CFP_TNS,
    {
      id: 'ir',
      categorie: 'impot',
      type: 'tranches_annuel',
      base: 'resultat',
      optionnel: true,
      activeParDefaut: false,
      label: { fr: 'Impôt sur le revenu (estimation, 1 part)', en: 'Income tax (estimate, 1 share)' },
      tranches: TRANCHES_IR,
      note: IR_NOTE,
    },
  ],
});

const frEi: Regime = {
  code: 'FR-EI',
  pays: 'FR',
  statutId: 'ei',
  forme: 'personne',
  nom: fr.nom,
  drapeau: fr.drapeau,
  devise: 'EUR',
  langues: ['fr', 'en'],
  statut: { fr: 'Entreprise individuelle au réel (BNC / BIC, impôt sur le revenu)', en: 'Sole proprietorship, real regime (BNC / BIC, income tax)' },
  activites: [
    { id: 'bnc', groupe: 'services', label: { fr: 'Profession libérale — BNC (déclaration contrôlée)', en: 'Liberal profession — BNC (controlled declaration)' }, court: { fr: 'BNC', en: 'BNC' } },
    { id: 'bic', groupe: 'services', label: { fr: 'Prestations de services commerciales ou artisanales — BIC', en: 'Commercial or craft services — BIC' }, court: { fr: 'Services BIC', en: 'Services (BIC)' } },
    { id: 'vente', groupe: 'vente', label: { fr: 'Vente de marchandises, hébergement — BIC', en: 'Sale of goods, accommodation — BIC' }, court: { fr: 'Vente', en: 'Goods' } },
  ],
  activiteDefaut: 'bnc',
  identifiants: [
    { id: 'siret', label: { fr: 'SIRET', en: 'SIRET' }, placeholder: '123 456 789 00012' },
    { id: 'tva', label: { fr: 'N° de TVA intracommunautaire', en: 'EU VAT number' }, placeholder: 'FR12 345678901', pourTva: true },
  ],
  identifiantClient: fr.identifiantClient,
  tva: TVA_FR,
  mentions: {
    retard: fr.mentions.retard,
    pied: { fr: 'Entrepreneur individuel (EI)', en: 'Sole proprietor (EI)' },
  },
  periodicites: [...PERIODICITES_TNS],
  periodiciteDefaut: 'mensuelle',
  echeance: { type: 'jours', jours: 5 },
  options: {
    acre: {
      label: { fr: "Je bénéficie de l'ACRE (exonération de début d'activité)", en: 'I benefit from ACRE (start-up exemption)' },
      aide: { fr: 'Exonération partielle des cotisations pendant les 12 premiers mois (estimée à 50 %, totale sous 75 % du PASS, dégressive au-delà).', en: 'Partial exemption from contributions during the first 12 months (estimated at 50%; full below 75% of the PASS, tapering above).' },
    },
  },
  params: { 2024: params(2024), 2025: params(2025), 2026: params(2026) },
  livreRecettes: { fr: 'Livre-journal des recettes', en: 'Receipts journal' },
  avertissement: {
    fr: 'Estimation des cotisations TNS sur le bénéfice (recettes encaissées − dépenses déductibles saisies dans Dépenses), régularisées par l’URSSAF après la déclaration de revenus. Hors professions réglementées (CIPAV, CARMF…), hors CFE.',
    en: 'Estimate of self-employed contributions on profit (cash receipts − deductible expenses recorded in Expenses), regularised by URSSAF after the income tax return. Excludes regulated professions (CIPAV, CARMF…) and the CFE.',
  },
  sources: SOURCES_TNS,
};

export default frEi;
