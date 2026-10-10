import type { Regime } from '../types';
import { ACTIVITES_BASE, ESTIMATION } from './common';

// États-Unis — sole proprietor / independent contractor (self-employment tax, federal income tax).
const us: Regime = {
  code: 'US',
  pays: 'US',
  statutId: 'independant',
  forme: 'personne',
  nom: { fr: 'États-Unis', en: 'United States', es: 'Estados Unidos', de: 'Vereinigte Staaten', it: 'Stati Uniti', pt: 'Estados Unidos', nl: 'Verenigde Staten' },
  drapeau: '🇺🇸',
  devise: 'USD',
  langues: ['en', 'es', 'fr'],
  statut: { fr: 'Sole proprietor / independent contractor', en: 'Sole proprietor / independent contractor', es: 'Trabajador independiente (sole proprietor)' },
  activites: ACTIVITES_BASE,
  activiteDefaut: 'services',
  identifiants: [
    { id: 'ein', label: { fr: 'EIN (le cas échéant)', en: 'EIN (if any)', es: 'EIN (si procede)' }, placeholder: '12-3456789' },
    { id: 'state', label: { fr: "Immatriculation d'État / licence", en: 'State registration / business license', es: 'Registro estatal / licencia' } },
  ],
  identifiantClient: { fr: 'EIN / Tax ID', en: 'EIN / Tax ID', es: 'EIN / Tax ID' },
  tva: {
    nom: 'Sales tax',
    franchisePossible: false,
    mentionFranchise: { fr: '', en: '' },
    mentionNumero: { fr: 'N° de permis de taxe de vente', en: 'Sales tax permit no.', es: 'N.º de permiso de impuesto sobre ventas' },
  },
  mentions: { retard: { fr: '', en: '' } },
  periodicites: ['trimestrielle', 'annuelle'],
  periodiciteDefaut: 'trimestrielle',
  echeance: { type: 'jours', jours: 15 },
  options: {},
  params: {
    0: {
      seuils: [],
      tvaTaux: [0, 6, 7, 8.25],
      tvaDefaut: 0,
      coefficientNet: 0.9235,
      composantes: [
        {
          id: 'se',
          categorie: 'social',
          type: 'tranches_annuel',
          label: { fr: 'Self-employment tax (Social Security + Medicare)', en: 'Self-employment tax (Social Security + Medicare)', es: 'Impuesto de trabajo por cuenta propia (Seguridad Social + Medicare)' },
          tranches: [{ jusqua: 184_500, taux: 15.3 }, { jusqua: null, taux: 2.9 }],
          note: { fr: 'Sur 92,35 % du bénéfice net ; plafond Social Security 2026.', en: 'On 92.35% of net profit; 2026 Social Security wage base.', es: 'Sobre el 92,35 % del beneficio neto; base máxima de Seguridad Social 2026.' },
        },
        {
          id: 'fit',
          categorie: 'impot',
          type: 'tranches_annuel',
          optionnel: true,
          activeParDefaut: false,
          label: { fr: 'Impôt fédéral sur le revenu (estimation, célibataire)', en: 'Federal income tax (estimate, single filer)', es: 'Impuesto federal sobre la renta (estimación, soltero)' },
          tranches: [{ jusqua: 16_100, taux: 0 }, { jusqua: 28_500, taux: 10 }, { jusqua: 66_500, taux: 12 }, { jusqua: 121_800, taux: 22 }, { jusqua: 217_875, taux: 24 }, { jusqua: 272_325, taux: 32 }, { jusqua: 656_700, taux: 35 }, { jusqua: null, taux: 37 }],
          note: { fr: "Déduction standard 2026 incluse ; impôts d'État non inclus.", en: '2026 standard deduction included; state taxes excluded.', es: 'Deducción estándar 2026 incluida; impuestos estatales excluidos.' },
        },
      ],
    },
  },
  livreRecettes: { fr: 'Journal des revenus', en: 'Income ledger', es: 'Libro de ingresos' },
  avertissement: { ...ESTIMATION },
  sources: ['https://www.irs.gov/businesses/small-businesses-self-employed/self-employment-tax-social-security-and-medicare-taxes'],
};

export default us;
