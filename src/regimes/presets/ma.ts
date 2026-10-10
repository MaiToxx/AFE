import type { Regime } from '../types';
import { ESTIMATION } from './common';

// Maroc — auto-entrepreneur (loi 114-13) : impôt libératoire sur le CA.
const ma: Regime = {
  code: 'MA',
  pays: 'MA',
  statutId: 'independant',
  forme: 'personne',
  nom: { fr: 'Maroc', en: 'Morocco', es: 'Marruecos', de: 'Marokko', it: 'Marocco', pt: 'Marrocos', nl: 'Marokko' },
  drapeau: '🇲🇦',
  devise: 'MAD',
  langues: ['fr', 'en'],
  statut: { fr: 'Auto-entrepreneur (loi 114-13)', en: 'Auto-entrepreneur (law 114-13)' },
  activites: [
    { id: 'services', groupe: 'services', label: { fr: 'Prestations de services', en: 'Services' }, court: { fr: 'Services', en: 'Services' } },
    { id: 'commerce', groupe: 'vente', label: { fr: 'Activités commerciales, industrielles et artisanales', en: 'Commercial, industrial and craft activities' }, court: { fr: 'Commerce / artisanat', en: 'Trade / crafts' } },
  ],
  activiteDefaut: 'services',
  identifiants: [
    { id: 'ae', label: { fr: "N° d'auto-entrepreneur / ICE", en: 'Auto-entrepreneur no. / ICE' } },
    { id: 'cin', label: { fr: 'CIN', en: 'National ID (CIN)' } },
  ],
  identifiantClient: { fr: 'ICE', en: 'ICE' },
  tva: {
    nom: 'TVA',
    franchisePossible: true,
    mentionFranchise: { fr: "Auto-entrepreneur – hors champ d'application de la TVA (loi 114-13).", en: 'Auto-entrepreneur – outside the scope of VAT (law 114-13).' },
    mentionNumero: { fr: 'IF', en: 'Tax ID' },
  },
  mentions: { retard: { fr: '', en: '' } },
  periodicites: ['trimestrielle'],
  periodiciteDefaut: 'trimestrielle',
  echeance: { type: 'jours', jours: 30 },
  options: {},
  params: {
    0: {
      seuils: [
        { id: 'plafond_commerce', kind: 'regime', groupe: 'vente', valeur: 500_000, label: { fr: 'Plafond du statut (commerce, industrie, artisanat)', en: 'Status ceiling (trade, industry, crafts)' } },
        { id: 'plafond_services', kind: 'regime', groupe: 'services', valeur: 200_000, label: { fr: 'Plafond du statut (services)', en: 'Status ceiling (services)' } },
      ],
      tvaTaux: [20, 14, 10, 7],
      tvaDefaut: 20,
      coefficientNet: 1,
      composantes: [
        {
          id: 'ir',
          categorie: 'impot',
          type: 'pct_ca',
          tauxParActivite: { commerce: 0.5, services: 1 },
          label: { fr: 'Impôt sur le revenu libératoire (0,5 % / 1 % du CA)', en: 'Flat income tax (0.5% / 1% of turnover)' },
          note: { fr: 'Au-delà de 80 000 MAD de CA avec un même client, le surplus est soumis à une retenue de 30 %.', en: 'Above MAD 80,000 of turnover with a single client, the excess is subject to a 30% withholding.' },
        },
        {
          id: 'cnss',
          categorie: 'social',
          type: 'fixe_mois',
          montant: 0,
          optionnel: true,
          activeParDefaut: false,
          label: { fr: 'Cotisation CNSS / AMO du régime auto-entrepreneur (à renseigner)', en: 'CNSS / AMO contribution for the auto-entrepreneur scheme (to be set)' },
        },
      ],
    },
  },
  livreRecettes: { fr: 'Registre des recettes', en: 'Receipts register' },
  avertissement: { ...ESTIMATION },
  sources: ['https://ae.gov.ma'],
};

export default ma;
