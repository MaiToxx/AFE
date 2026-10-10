import type { Regime } from '../types';
import { ACTIVITES_BASE, ESTIMATION } from './common';

// Autriche — Einzelunternehmer, Kleinunternehmerregelung (§ 6 Abs. 1 Z 27 UStG), SVS.
const at: Regime = {
  code: 'AT',
  pays: 'AT',
  statutId: 'independant',
  forme: 'personne',
  nom: { fr: 'Autriche', en: 'Austria', de: 'Österreich', es: 'Austria', it: 'Austria', pt: 'Áustria', nl: 'Oostenrijk' },
  drapeau: '🇦🇹',
  devise: 'EUR',
  langues: ['de', 'en', 'fr'],
  statut: { fr: 'Entrepreneur individuel (Kleinunternehmer)', en: 'Sole proprietor (small business)', de: 'Einzelunternehmer (Kleinunternehmer)' },
  activites: ACTIVITES_BASE,
  activiteDefaut: 'services',
  identifiants: [
    { id: 'steuernummer', label: { fr: 'Numéro fiscal', en: 'Tax number', de: 'Steuernummer' } },
    { id: 'uid', label: { fr: 'UID (N° de TVA)', en: 'UID (VAT number)', de: 'UID-Nummer' }, placeholder: 'ATU12345678', pourTva: true },
    { id: 'gisa', label: { fr: 'N° GISA (le cas échéant)', en: 'GISA number (if any)', de: 'GISA-Zahl (falls vorhanden)' } },
  ],
  identifiantClient: { fr: 'UID / Steuernummer', en: 'VAT ID / tax no.', de: 'UID / Steuernummer' },
  tva: {
    nom: 'USt.',
    franchisePossible: true,
    mentionFranchise: { fr: 'Exonéré de TVA – Kleinunternehmer selon § 6 al. 1 ch. 27 UStG.', en: 'VAT exempt – small business under § 6 (1) 27 UStG.', de: 'Umsatzsteuerbefreit – Kleinunternehmer gemäß § 6 Abs. 1 Z 27 UStG.' },
    mentionNumero: { fr: 'UID', en: 'VAT ID', de: 'UID' },
  },
  mentions: {
    retard: {
      fr: 'Intérêts de retard de 9,2 points au-dessus du taux de base (§ 456 UGB) et indemnité forfaitaire de 40 € (§ 458 UGB).',
      en: 'Default interest of 9.2 percentage points above the base rate (§ 456 UGB) and a €40 flat fee (§ 458 UGB).',
      de: 'Verzugszinsen in Höhe von 9,2 Prozentpunkten über dem Basiszinssatz (§ 456 UGB) sowie Pauschale von 40 € (§ 458 UGB).',
    },
  },
  periodicites: ['trimestrielle', 'mensuelle'],
  periodiciteDefaut: 'trimestrielle',
  echeance: { type: 'jours', jours: 15 },
  options: {},
  params: {
    0: {
      seuils: [{ id: 'kleinunternehmer', kind: 'tva', groupe: 'tous', valeur: 55_000, label: { fr: 'Kleinunternehmer (§ 6 UStG)', en: 'Small business VAT threshold', de: 'Kleinunternehmergrenze (§ 6 UStG)' } }],
      tvaTaux: [20, 13, 10],
      tvaDefaut: 20,
      coefficientNet: 1,
      composantes: [
        {
          id: 'svs',
          categorie: 'social',
          type: 'pct_net',
          taux: 26.83,
          min: 1_800,
          baseMax: 90_300,
          label: { fr: 'SVS (retraite 18,5 %, maladie 6,8 %, prévoyance 1,53 %)', en: 'SVS (pension 18.5%, health 6.8%, provision 1.53%)', de: 'SVS (PV 18,5 %, KV 6,8 %, Selbständigenvorsorge 1,53 %)' },
          note: { fr: 'Assiette minimale ≈ 6 600 €/an ; assurance accident forfaitaire (≈ 150 €/an) non incluse.', en: 'Minimum base ≈ €6,600/year; flat accident insurance (≈ €150/year) not included.', de: 'Mindestbeitragsgrundlage ≈ 6 600 €/Jahr; Unfallversicherung pauschal (≈ 150 €/Jahr) nicht inbegriffen.' },
        },
        {
          id: 'est',
          categorie: 'impot',
          type: 'tranches_annuel',
          optionnel: true,
          activeParDefaut: false,
          label: { fr: 'Impôt sur le revenu (estimation)', en: 'Income tax (estimate)', de: 'Einkommensteuer (Schätzung)' },
          tranches: [{ jusqua: 13_540, taux: 0 }, { jusqua: 21_617, taux: 20 }, { jusqua: 35_836, taux: 30 }, { jusqua: 69_166, taux: 40 }, { jusqua: 103_072, taux: 48 }, { jusqua: 1_000_000, taux: 50 }, { jusqua: null, taux: 55 }],
        },
      ],
    },
  },
  livreRecettes: { fr: 'Journal des recettes (E/A-Rechnung)', en: 'Income records', de: 'Einnahmenaufzeichnung (E/A-Rechnung)' },
  avertissement: { ...ESTIMATION },
  sources: ['https://www.svs.at', 'https://www.usp.gv.at/steuern-finanzen/umsatzsteuer/kleinunternehmerregelung.html'],
};

export default at;
