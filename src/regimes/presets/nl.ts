import type { Regime } from '../types';
import { ACTIVITES_BASE, ESTIMATION } from './common';

// Pays-Bas — zzp'er / eenmanszaak, kleineondernemersregeling (KOR).
const nl: Regime = {
  code: 'NL',
  pays: 'NL',
  statutId: 'independant',
  forme: 'personne',
  nom: { fr: 'Pays-Bas', en: 'Netherlands', nl: 'Nederland', de: 'Niederlande', es: 'Países Bajos', it: 'Paesi Bassi', pt: 'Países Baixos' },
  drapeau: '🇳🇱',
  devise: 'EUR',
  langues: ['nl', 'en', 'fr'],
  statut: { fr: "Indépendant (zzp'er, eenmanszaak)", en: 'Self-employed (zzp, sole proprietorship)', nl: "Zelfstandige (zzp'er, eenmanszaak)" },
  activites: ACTIVITES_BASE,
  activiteDefaut: 'services',
  identifiants: [
    { id: 'kvk', label: { fr: 'Numéro KVK', en: 'KVK number', nl: 'KVK-nummer' }, placeholder: '12345678' },
    { id: 'btw', label: { fr: 'N° de TVA (btw-id)', en: 'VAT ID (btw-id)', nl: 'Btw-identificatienummer' }, placeholder: 'NL123456789B01', pourTva: true },
  ],
  identifiantClient: { fr: 'KVK / btw-id', en: 'KVK / VAT ID', nl: 'KVK-nummer / btw-id' },
  tva: {
    nom: 'btw',
    franchisePossible: true,
    mentionFranchise: { fr: 'Exonéré de TVA en application du régime des petites entreprises (KOR).', en: 'VAT exempt under the small businesses scheme (KOR).', nl: 'Vrijgesteld van btw op grond van de kleineondernemersregeling (KOR).' },
    mentionNumero: { fr: 'btw-id', en: 'VAT ID', nl: 'Btw-id' },
  },
  mentions: {
    retard: {
      fr: "En cas de retard de paiement : intérêt commercial légal (art. 6:119a BW) et frais de recouvrement extrajudiciaires d'au moins 40 €.",
      en: 'Late payment: statutory commercial interest (art. 6:119a Dutch Civil Code) and extrajudicial collection costs of at least €40.',
      nl: 'Bij te late betaling is de wettelijke handelsrente (art. 6:119a BW) verschuldigd, alsmede buitengerechtelijke incassokosten van ten minste € 40.',
    },
  },
  periodicites: ['trimestrielle', 'mensuelle', 'annuelle'],
  periodiciteDefaut: 'trimestrielle',
  echeance: { type: 'jours', jours: 30 },
  options: {},
  params: {
    0: {
      seuils: [{ id: 'kor', kind: 'tva', groupe: 'tous', valeur: 20_000, label: { fr: 'Régime des petites entreprises (KOR)', en: 'Small businesses scheme (KOR)', nl: 'Kleineondernemersregeling (KOR)' } }],
      tvaTaux: [21, 9],
      tvaDefaut: 21,
      coefficientNet: 1,
      composantes: [
        { id: 'zvw', categorie: 'social', type: 'pct_net', taux: 5.26, baseMax: 75_864, label: { fr: 'Cotisation Zvw (assurance maladie)', en: 'Zvw contribution (health insurance)', nl: 'Inkomensafhankelijke bijdrage Zvw' } },
        {
          id: 'ib',
          categorie: 'impot',
          type: 'tranches_annuel',
          optionnel: true,
          activeParDefaut: false,
          label: { fr: 'Impôt sur le revenu box 1 (estimation)', en: 'Income tax box 1 (estimate)', nl: 'Inkomstenbelasting box 1 (raming)' },
          tranches: [{ jusqua: 38_441, taux: 35.82 }, { jusqua: 76_817, taux: 37.48 }, { jusqua: null, taux: 49.5 }],
          note: { fr: "Hors zelfstandigenaftrek, mkb-winstvrijstelling et crédits d'impôt.", en: 'Excluding self-employed deduction, SME profit exemption and tax credits.', nl: 'Exclusief zelfstandigenaftrek, mkb-winstvrijstelling en heffingskortingen.' },
        },
      ],
    },
  },
  livreRecettes: { fr: 'Administration des ventes', en: 'Sales administration', nl: 'Verkoopadministratie' },
  avertissement: { ...ESTIMATION },
  sources: ['https://www.belastingdienst.nl/wps/wcm/connect/nl/btw/content/kleineondernemersregeling-kor', 'https://www.kvk.nl'],
};

export default nl;
