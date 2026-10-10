import type { Regime } from '../types';
import { ACTIVITES_BASE, ESTIMATION } from './common';

// Irlande — sole trader (PRSI class S, USC, income tax).
const ie: Regime = {
  code: 'IE',
  pays: 'IE',
  statutId: 'independant',
  forme: 'personne',
  nom: { fr: 'Irlande', en: 'Ireland', es: 'Irlanda', de: 'Irland', it: 'Irlanda', pt: 'Irlanda', nl: 'Ierland' },
  drapeau: '🇮🇪',
  devise: 'EUR',
  langues: ['en', 'fr'],
  statut: { fr: 'Sole trader', en: 'Sole trader' },
  activites: ACTIVITES_BASE,
  activiteDefaut: 'services',
  identifiants: [
    { id: 'ppsn', label: { fr: 'PPSN / numéro de référence fiscal', en: 'PPSN / tax reference number' } },
    { id: 'vat', label: { fr: 'N° de TVA', en: 'VAT number' }, placeholder: 'IE1234567T', pourTva: true },
    { id: 'cro', label: { fr: 'N° CRO (nom commercial, le cas échéant)', en: 'CRO business name number (if any)' } },
  ],
  identifiantClient: { fr: 'N° de TVA / CRO', en: 'VAT / CRO number' },
  tva: {
    nom: 'VAT',
    franchisePossible: true,
    mentionFranchise: { fr: "Non immatriculé à la TVA – chiffre d'affaires inférieur au seuil d'immatriculation.", en: 'Not registered for VAT – turnover below the registration threshold.' },
    mentionNumero: { fr: 'N° TVA', en: 'VAT no.' },
  },
  mentions: {
    retard: {
      fr: 'Intérêts de retard conformément au règlement de 2012 sur les retards de paiement dans les transactions commerciales (taux BCE majoré de 8 points) et indemnité forfaitaire de 40 €, 70 € ou 100 € selon le montant.',
      en: 'Late payment interest under the European Communities (Late Payment in Commercial Transactions) Regulations 2012 (ECB rate plus 8 points) and compensation of €40, €70 or €100 depending on the amount.',
    },
  },
  periodicites: ['annuelle', 'trimestrielle'],
  periodiciteDefaut: 'annuelle',
  echeance: { type: 'jours', jours: 304 },
  options: {},
  params: {
    0: {
      seuils: [
        { id: 'vat_services', kind: 'tva', groupe: 'services', valeur: 42_500, label: { fr: "Seuil d'immatriculation TVA (services)", en: 'VAT registration threshold (services)' } },
        { id: 'vat_goods', kind: 'tva', groupe: 'vente', valeur: 85_000, label: { fr: "Seuil d'immatriculation TVA (biens)", en: 'VAT registration threshold (goods)' } },
      ],
      tvaTaux: [23, 13.5, 9],
      tvaDefaut: 23,
      coefficientNet: 1,
      composantes: [
        { id: 'prsi', categorie: 'social', type: 'pct_net', taux: 4.2, min: 650, label: { fr: 'PRSI classe S', en: 'PRSI Class S' } },
        {
          id: 'usc',
          categorie: 'impot',
          type: 'tranches_annuel',
          label: { fr: 'USC (Universal Social Charge)', en: 'Universal Social Charge (USC)' },
          tranches: [{ jusqua: 12_012, taux: 0.5 }, { jusqua: 27_382, taux: 2 }, { jusqua: 70_044, taux: 3 }, { jusqua: null, taux: 8 }],
          note: { fr: 'Exonération si revenu ≤ 13 000 €.', en: 'Exempt if income ≤ €13,000.' },
        },
        {
          id: 'it',
          categorie: 'impot',
          type: 'tranches_annuel',
          optionnel: true,
          activeParDefaut: false,
          label: { fr: 'Impôt sur le revenu (estimation, célibataire)', en: 'Income tax (estimate, single person)' },
          tranches: [{ jusqua: 44_000, taux: 20 }, { jusqua: null, taux: 40 }],
          note: { fr: "Avant crédits d'impôt (personnel 2 000 €, revenu d'activité 2 000 €).", en: 'Before tax credits (personal €2,000, earned income €2,000).' },
        },
      ],
    },
  },
  livreRecettes: { fr: 'Livre des recettes', en: 'Receipts book' },
  avertissement: { ...ESTIMATION },
  sources: ['https://www.revenue.ie/en/vat/vat-registration/who-should-register-for-vat/index.aspx', 'https://www.gov.ie/en/service/5a6a5-prsi-class-s-self-employed/'],
};

export default ie;
