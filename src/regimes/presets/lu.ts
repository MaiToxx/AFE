import type { Regime } from '../types';
import { ACTIVITES_BASE, ESTIMATION } from './common';

// Luxembourg — indépendant (entreprise individuelle), CCSS.
const lu: Regime = {
  code: 'LU',
  pays: 'LU',
  statutId: 'independant',
  forme: 'personne',
  nom: { fr: 'Luxembourg', en: 'Luxembourg', de: 'Luxemburg', es: 'Luxemburgo', it: 'Lussemburgo', pt: 'Luxemburgo', nl: 'Luxemburg' },
  drapeau: '🇱🇺',
  devise: 'EUR',
  langues: ['fr', 'de', 'en'],
  statut: { fr: 'Indépendant (entreprise individuelle)', en: 'Self-employed (sole proprietorship)', de: 'Selbständiger (Einzelunternehmen)' },
  activites: ACTIVITES_BASE,
  activiteDefaut: 'services',
  identifiants: [
    { id: 'matricule', label: { fr: 'Matricule national', en: 'National identification number', de: 'Nationale Kennnummer' } },
    { id: 'tva', label: { fr: 'N° TVA', en: 'VAT number', de: 'MwSt-Nr.' }, placeholder: 'LU12345678', pourTva: true },
    { id: 'autorisation', label: { fr: "Autorisation d'établissement", en: 'Business permit', de: 'Niederlassungsgenehmigung' } },
  ],
  identifiantClient: { fr: 'N° TVA / RCS', en: 'VAT no. / RCS', de: 'MwSt-Nr. / RCS' },
  tva: {
    nom: 'TVA',
    franchisePossible: true,
    mentionFranchise: { fr: 'Franchise des petites entreprises – TVA non applicable (art. 57 de la loi TVA).', en: 'Small enterprise exemption – VAT not applicable (art. 57 of the Luxembourg VAT law).', de: 'Kleinunternehmerregelung – keine MwSt. (Art. 57 MwSt-Gesetz).' },
    mentionNumero: { fr: 'N° TVA', en: 'VAT no.', de: 'MwSt-Nr.' },
  },
  mentions: {
    retard: {
      fr: 'Intérêts de retard au taux légal applicable aux transactions commerciales (loi du 18 avril 2004) et indemnité forfaitaire de 40 €.',
      en: 'Late payment interest at the statutory commercial rate (law of 18 April 2004) and a €40 flat fee.',
      de: 'Verzugszinsen zum gesetzlichen Satz für Handelsgeschäfte (Gesetz vom 18. April 2004) und Pauschale von 40 €.',
    },
  },
  periodicites: ['mensuelle', 'trimestrielle'],
  periodiciteDefaut: 'mensuelle',
  echeance: { type: 'jours', jours: 30 },
  options: {},
  params: {
    0: {
      seuils: [{ id: 'franchise', kind: 'tva', groupe: 'tous', valeur: 50_000, label: { fr: 'Franchise de TVA', en: 'VAT exemption', de: 'MwSt-Befreiung' } }],
      tvaTaux: [17, 14, 8, 3],
      tvaDefaut: 17,
      coefficientNet: 1,
      composantes: [
        {
          id: 'ccss',
          categorie: 'social',
          type: 'pct_net',
          taux: 24.3,
          min: 7_700,
          baseMax: 158_000,
          label: { fr: 'Cotisations CCSS (pension, maladie, dépendance, accident, mutualité)', en: 'CCSS contributions (pension, health, dependency, accident, mutual)', de: 'CCSS-Beiträge (Rente, Kranken-, Pflege-, Unfallversicherung, Mutualität)' },
          note: { fr: 'Assiette minimale = salaire social minimum (≈ 2 638 €/mois), maximale = 5 × SSM.', en: 'Minimum base = social minimum wage (≈ €2,638/month), maximum = 5 × SMW.', de: 'Mindestbemessung = sozialer Mindestlohn (≈ 2 638 €/Monat), Höchstgrenze = 5 × SML.' },
        },
        {
          id: 'ir',
          categorie: 'impot',
          type: 'tranches_annuel',
          optionnel: true,
          activeParDefaut: false,
          label: { fr: 'Impôt sur le revenu, classe 1 (estimation)', en: 'Income tax, class 1 (estimate)', de: 'Einkommensteuer, Klasse 1 (Schätzung)' },
          tranches: [{ jusqua: 13_230, taux: 0 }, { jusqua: 21_000, taux: 12 }, { jusqua: 40_000, taux: 26 }, { jusqua: 60_000, taux: 38 }, { jusqua: 110_000, taux: 41 }, { jusqua: null, taux: 42 }],
          note: { fr: "Barème approché ; hors fonds pour l'emploi (7 %).", en: 'Approximate scale; excludes the employment fund surcharge (7%).', de: 'Angenäherter Tarif; ohne Beschäftigungsfonds (7 %).' },
        },
      ],
    },
  },
  livreRecettes: { fr: 'Livre des recettes', en: 'Receipts book', de: 'Einnahmenbuch' },
  avertissement: { ...ESTIMATION },
  sources: ['https://www.ccss.lu', 'https://guichet.public.lu/fr/entreprises/fiscalite/tva/notions/regime-franchise.html'],
};

export default lu;
