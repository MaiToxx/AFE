import type { Regime } from '../types';
import { ACTIVITES_BASE, ESTIMATION } from './common';

// Allemagne — Einzelunternehmer / Freiberufler, Kleinunternehmerregelung (§ 19 UStG).
const de: Regime = {
  code: 'DE',
  pays: 'DE',
  statutId: 'independant',
  forme: 'personne',
  nom: { fr: 'Allemagne', en: 'Germany', de: 'Deutschland', es: 'Alemania', it: 'Germania', pt: 'Alemanha', nl: 'Duitsland' },
  drapeau: '🇩🇪',
  devise: 'EUR',
  langues: ['de', 'en', 'fr'],
  statut: { fr: 'Entrepreneur individuel / profession libérale (Kleinunternehmer)', en: 'Sole proprietor / freelancer (small business)', de: 'Einzelunternehmer / Freiberufler (Kleinunternehmer)' },
  activites: ACTIVITES_BASE,
  activiteDefaut: 'services',
  identifiants: [
    { id: 'steuernummer', label: { fr: 'Numéro fiscal (Steuernummer)', en: 'Tax number (Steuernummer)', de: 'Steuernummer' }, placeholder: '12/345/67890' },
    { id: 'ustid', label: { fr: 'N° de TVA intracommunautaire (USt-IdNr.)', en: 'VAT ID (USt-IdNr.)', de: 'USt-IdNr.' }, placeholder: 'DE123456789', pourTva: true },
    { id: 'hrb', label: { fr: 'Registre du commerce (le cas échéant)', en: 'Commercial register no. (if any)', de: 'Handelsregisternummer (falls vorhanden)' } },
  ],
  identifiantClient: { fr: 'Steuernummer / USt-IdNr.', en: 'Tax no. / VAT ID', de: 'Steuernummer / USt-IdNr.' },
  tva: {
    nom: 'USt.',
    franchisePossible: true,
    mentionFranchise: { fr: "Conformément au § 19 UStG, aucune TVA n'est facturée (Kleinunternehmerregelung).", en: 'In accordance with § 19 UStG, no VAT is charged (small business scheme).', de: 'Gemäß § 19 UStG wird keine Umsatzsteuer berechnet.' },
    mentionNumero: { fr: 'USt-IdNr.', en: 'VAT ID', de: 'USt-IdNr.' },
  },
  mentions: {
    retard: {
      fr: 'En cas de retard de paiement : intérêts de 9 points au-dessus du taux de base (§ 288 BGB) et indemnité forfaitaire de 40 € (§ 288 al. 5 BGB).',
      en: 'Late payment: interest of 9 percentage points above the base rate (§ 288 BGB) and a flat fee of €40 (§ 288 (5) BGB).',
      de: 'Bei Zahlungsverzug fallen Verzugszinsen in Höhe von 9 Prozentpunkten über dem Basiszinssatz (§ 288 BGB) sowie eine Pauschale von 40 € (§ 288 Abs. 5 BGB) an.',
    },
  },
  periodicites: ['trimestrielle', 'mensuelle', 'annuelle'],
  periodiciteDefaut: 'trimestrielle',
  echeance: { type: 'jours', jours: 10 },
  options: {},
  params: {
    0: {
      seuils: [
        {
          id: 'kleinunternehmer',
          kind: 'tva',
          groupe: 'tous',
          valeur: 25_000,
          majore: 100_000,
          label: { fr: "Kleinunternehmer (§ 19 UStG) – CA de l'année précédente", en: 'Small business scheme (§ 19 UStG) – previous year turnover', de: 'Kleinunternehmerregelung (§ 19 UStG) – Vorjahresumsatz' },
          note: { fr: "Et 100 000 € maximum dans l'année en cours.", en: 'And at most €100,000 in the current year.', de: 'Und höchstens 100 000 € im laufenden Jahr.' },
        },
      ],
      tvaTaux: [19, 7],
      tvaDefaut: 19,
      coefficientNet: 1,
      composantes: [
        {
          id: 'kv',
          categorie: 'social',
          type: 'pct_net',
          taux: 17.5,
          min: 2_700,
          baseMax: 66_150,
          label: { fr: 'Assurance maladie (GKV volontaire, taux moyen)', en: 'Health insurance (voluntary statutory, average rate)', de: 'Krankenversicherung (freiwillig GKV, Durchschnittssatz)' },
          note: { fr: '14,6 % + taux additionnel moyen ≈ 2,9 % ; assiette minimale ≈ 1 250 €/mois, maximale 5 512 €/mois.', en: '14.6% + average additional rate ≈ 2.9%; minimum base ≈ €1,250/month, maximum €5,512/month.', de: '14,6 % + durchschnittlicher Zusatzbeitrag ≈ 2,9 %; Mindestbemessung ≈ 1 250 €/Monat, Höchstgrenze 5 512 €/Monat.' },
        },
        { id: 'pv', categorie: 'social', type: 'pct_net', taux: 3.6, min: 540, baseMax: 66_150, label: { fr: 'Assurance dépendance (PV)', en: 'Long-term care insurance (PV)', de: 'Pflegeversicherung' } },
        { id: 'rv', categorie: 'social', type: 'pct_net', taux: 18.6, optionnel: true, activeParDefaut: false, baseMax: 96_600, label: { fr: 'Assurance retraite (RV, obligatoire pour certaines professions)', en: 'Pension insurance (RV, mandatory for some professions)', de: 'Rentenversicherung (für bestimmte Berufe pflichtig)' } },
        {
          id: 'est',
          categorie: 'impot',
          type: 'tranches_annuel',
          optionnel: true,
          activeParDefaut: false,
          label: { fr: 'Impôt sur le revenu (estimation)', en: 'Income tax (estimate)', de: 'Einkommensteuer (Schätzung)' },
          tranches: [{ jusqua: 12_348, taux: 0 }, { jusqua: 17_800, taux: 19 }, { jusqua: 69_800, taux: 33 }, { jusqua: 277_825, taux: 42 }, { jusqua: null, taux: 45 }],
          note: { fr: 'Barème linéaire-progressif approché par paliers ; hors Solidaritätszuschlag et Kirchensteuer.', en: 'Linear-progressive scale approximated by brackets; excludes solidarity surcharge and church tax.', de: 'Linear-progressiver Tarif durch Stufen angenähert; ohne Solidaritätszuschlag und Kirchensteuer.' },
        },
      ],
    },
  },
  livreRecettes: { fr: 'Journal des recettes (EÜR)', en: 'Income records (EÜR)', de: 'Einnahmenaufzeichnung (EÜR)' },
  avertissement: {
    ...ESTIMATION,
    fr: "Estimation simplifiée sur le revenu net (CA × coefficient). Les taux de votre caisse maladie, l'obligation de retraite et la Gewerbesteuer dépendent de votre situation. Ajustez dans Paramètres → Barème.",
    en: 'Simplified estimate on net income (turnover × coefficient). Your health fund rates, pension obligation and trade tax depend on your situation. Adjust in Settings → Rates.',
    de: 'Vereinfachte Schätzung auf Basis des Nettoeinkommens (Umsatz × Koeffizient). Kassensätze, Rentenversicherungspflicht und Gewerbesteuer hängen von Ihrer Situation ab. Anpassen unter Einstellungen → Sätze.',
  },
  sources: ['https://www.gesetze-im-internet.de/ustg_1980/__19.html', 'https://www.deutsche-rentenversicherung.de'],
};

export default de;
