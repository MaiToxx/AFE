import type { Regime } from '../types';
import { ACTIVITES_BASE, ESTIMATION } from './common';

// Canada — travailleur autonome (fédéral ; TPS/TVH, RPC).
const ca: Regime = {
  code: 'CA',
  pays: 'CA',
  statutId: 'independant',
  forme: 'personne',
  nom: { fr: 'Canada', en: 'Canada', es: 'Canadá', de: 'Kanada', it: 'Canada', pt: 'Canadá', nl: 'Canada' },
  drapeau: '🇨🇦',
  devise: 'CAD',
  langues: ['fr', 'en'],
  statut: { fr: 'Travailleur autonome (entreprise individuelle)', en: 'Self-employed (sole proprietorship)' },
  activites: ACTIVITES_BASE,
  activiteDefaut: 'services',
  identifiants: [
    { id: 'ne', label: { fr: "Numéro d'entreprise (NE)", en: 'Business Number (BN)' }, placeholder: '123456789' },
    { id: 'tps', label: { fr: 'N° de TPS/TVH', en: 'GST/HST number' }, placeholder: '123456789 RT0001', pourTva: true },
    { id: 'neq', label: { fr: 'NEQ (Québec, le cas échéant)', en: 'NEQ (Quebec, if any)' } },
  ],
  identifiantClient: { fr: "Numéro d'entreprise", en: 'Business number' },
  tva: {
    nom: 'TPS/TVH',
    franchisePossible: true,
    mentionFranchise: { fr: "Petit fournisseur – TPS/TVH non facturée (paragraphe 148(1) de la Loi sur la taxe d'accise).", en: 'Small supplier – no GST/HST charged (subsection 148(1) of the Excise Tax Act).' },
    mentionNumero: { fr: 'N° TPS/TVH', en: 'GST/HST no.' },
  },
  mentions: { retard: { fr: '', en: '' } },
  periodicites: ['trimestrielle', 'annuelle'],
  periodiciteDefaut: 'trimestrielle',
  echeance: { type: 'jours', jours: 15 },
  options: {},
  params: {
    0: {
      seuils: [{ id: 'petit_fournisseur', kind: 'tva', groupe: 'tous', valeur: 30_000, label: { fr: 'Petit fournisseur (TPS/TVH, quatre trimestres consécutifs)', en: 'Small supplier (GST/HST, four consecutive quarters)' } }],
      tvaTaux: [5, 13, 15, 14.975],
      tvaDefaut: 5,
      coefficientNet: 1,
      composantes: [
        {
          id: 'rpc',
          categorie: 'social',
          type: 'tranches_annuel',
          label: { fr: 'Cotisations RPC/RRQ (travail autonome)', en: 'CPP/QPP contributions (self-employed)' },
          tranches: [{ jusqua: 3_500, taux: 0 }, { jusqua: 71_300, taux: 11.9 }, { jusqua: 81_200, taux: 8 }, { jusqua: null, taux: 0 }],
          note: { fr: 'Au Québec, RRQ 12,8 % ; RQAP non inclus.', en: 'In Quebec, QPP 12.8%; QPIP not included.' },
        },
        {
          id: 'if',
          categorie: 'impot',
          type: 'tranches_annuel',
          optionnel: true,
          activeParDefaut: false,
          label: { fr: 'Impôt fédéral (estimation, hors provincial)', en: 'Federal income tax (estimate, excluding provincial)' },
          tranches: [{ jusqua: 16_129, taux: 0 }, { jusqua: 57_375, taux: 14 }, { jusqua: 114_750, taux: 20.5 }, { jusqua: 177_882, taux: 26 }, { jusqua: 253_414, taux: 29 }, { jusqua: null, taux: 33 }],
        },
      ],
    },
  },
  livreRecettes: { fr: 'Journal des revenus', en: 'Income journal' },
  avertissement: { ...ESTIMATION },
  sources: ['https://www.canada.ca/fr/agence-revenu/services/impot/entreprises/sujets/tps-tvh-entreprises.html'],
};

export default ca;
