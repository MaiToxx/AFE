import type { Regime } from '../types';
import { ACTIVITES_BASE, ESTIMATION } from './common';

// Royaume-Uni — sole trader (Class 4 NI, income tax, VAT threshold).
const gb: Regime = {
  code: 'GB',
  nom: { fr: 'Royaume-Uni', en: 'United Kingdom', es: 'Reino Unido', de: 'Vereinigtes Königreich', it: 'Regno Unito', pt: 'Reino Unido', nl: 'Verenigd Koninkrijk' },
  drapeau: '🇬🇧',
  devise: 'GBP',
  langues: ['en', 'fr'],
  statut: { fr: 'Sole trader', en: 'Sole trader' },
  activites: ACTIVITES_BASE,
  activiteDefaut: 'services',
  identifiants: [
    { id: 'utr', label: { fr: 'UTR (Unique Taxpayer Reference)', en: 'UTR (Unique Taxpayer Reference)' } },
    { id: 'vat', label: { fr: 'N° de TVA', en: 'VAT registration number' }, placeholder: 'GB123456789', pourTva: true },
  ],
  identifiantClient: { fr: 'N° de TVA / Company number', en: 'VAT / company number' },
  tva: {
    nom: 'VAT',
    franchisePossible: true,
    mentionFranchise: { fr: 'Non immatriculé à la TVA.', en: 'Not VAT registered.' },
    mentionNumero: { fr: 'N° TVA', en: 'VAT no.' },
  },
  mentions: {
    retard: {
      fr: "Late Payment of Commercial Debts (Interest) Act 1998 : intérêts de 8 % au-dessus du taux de base de la Banque d'Angleterre et indemnité fixe de 40 £, 70 £ ou 100 £ selon le montant.",
      en: 'Late Payment of Commercial Debts (Interest) Act 1998: interest at 8% above the Bank of England base rate and fixed compensation of £40, £70 or £100 depending on the amount.',
    },
  },
  periodicites: ['annuelle', 'trimestrielle'],
  periodiciteDefaut: 'annuelle',
  echeance: { type: 'jours', jours: 306 },
  options: {},
  params: {
    0: {
      seuils: [{ id: 'vat', kind: 'tva', groupe: 'tous', valeur: 90_000, label: { fr: "Seuil d'immatriculation TVA (12 mois glissants)", en: 'VAT registration threshold (rolling 12 months)' } }],
      tvaTaux: [20, 5, 0],
      tvaDefaut: 20,
      coefficientNet: 1,
      composantes: [
        { id: 'ni4', categorie: 'social', type: 'tranches_annuel', label: { fr: 'National Insurance classe 4', en: 'Class 4 National Insurance' }, tranches: [{ jusqua: 12_570, taux: 0 }, { jusqua: 50_270, taux: 6 }, { jusqua: null, taux: 2 }] },
        {
          id: 'it',
          categorie: 'impot',
          type: 'tranches_annuel',
          optionnel: true,
          activeParDefaut: false,
          label: { fr: 'Impôt sur le revenu (Angleterre, estimation)', en: 'Income tax (England, estimate)' },
          tranches: [{ jusqua: 12_570, taux: 0 }, { jusqua: 50_270, taux: 20 }, { jusqua: 125_140, taux: 40 }, { jusqua: null, taux: 45 }],
          note: { fr: 'Année fiscale du 6 avril au 5 avril ; barème écossais différent.', en: 'Tax year runs 6 April to 5 April; Scottish rates differ.' },
        },
      ],
    },
  },
  livreRecettes: { fr: 'Livre des ventes', en: 'Sales ledger' },
  avertissement: { ...ESTIMATION },
  sources: ['https://www.gov.uk/self-employed-national-insurance-rates', 'https://www.gov.uk/vat-registration-thresholds'],
};

export default gb;
