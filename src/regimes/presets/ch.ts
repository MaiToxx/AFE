import type { Regime } from '../types';
import { ACTIVITES_BASE, ESTIMATION } from './common';

// Suisse — indépendant (raison individuelle). Sources : ahv-iv.ch, estv.admin.ch.
const ch: Regime = {
  code: 'CH',
  nom: { fr: 'Suisse', en: 'Switzerland', de: 'Schweiz', it: 'Svizzera', es: 'Suiza', pt: 'Suíça', nl: 'Zwitserland' },
  drapeau: '🇨🇭',
  devise: 'CHF',
  langues: ['fr', 'de', 'it', 'en'],
  statut: { fr: 'Indépendant (raison individuelle)', en: 'Self-employed (sole proprietorship)', de: 'Selbständigerwerbend (Einzelunternehmen)', it: 'Indipendente (ditta individuale)' },
  activites: ACTIVITES_BASE,
  activiteDefaut: 'services',
  identifiants: [
    { id: 'ide', label: { fr: "IDE (numéro d'identification des entreprises)", en: 'UID (business identification number)', de: 'UID (Unternehmens-Identifikationsnummer)', it: "IDI (numero d'identificazione delle imprese)" }, placeholder: 'CHE-123.456.789' },
    { id: 'tva', label: { fr: 'N° TVA', en: 'VAT no.', de: 'MWST-Nr.', it: 'N. IVA' }, placeholder: 'CHE-123.456.789 TVA', pourTva: true },
  ],
  identifiantClient: { fr: 'IDE / N° TVA', en: 'UID / VAT no.', de: 'UID / MWST-Nr.', it: 'IDI / N. IVA' },
  tva: {
    nom: 'TVA',
    franchisePossible: true,
    mentionFranchise: { fr: 'Non assujetti à la TVA (art. 10 LTVA).', en: 'Not subject to VAT (art. 10 of the Swiss VAT Act).', de: 'Nicht mehrwertsteuerpflichtig (Art. 10 MWSTG).', it: "Non assoggettato all'IVA (art. 10 LIVA)." },
    mentionNumero: { fr: 'N° TVA', en: 'VAT no.', de: 'MWST-Nr.', it: 'N. IVA' },
  },
  mentions: {
    retard: {
      fr: "En cas de retard de paiement, un intérêt moratoire de 5 % l'an est dû (art. 104 CO).",
      en: 'Late payments bear default interest of 5% per year (art. 104 of the Swiss Code of Obligations).',
      de: 'Bei Zahlungsverzug ist ein Verzugszins von 5 % pro Jahr geschuldet (Art. 104 OR).',
      it: 'In caso di ritardo nel pagamento è dovuto un interesse di mora del 5 % annuo (art. 104 CO).',
    },
  },
  periodicites: ['trimestrielle', 'annuelle'],
  periodiciteDefaut: 'trimestrielle',
  echeance: { type: 'jours', jours: 30 },
  options: {},
  params: {
    0: {
      seuils: [{ id: 'tva', kind: 'tva', groupe: 'tous', valeur: 100_000, label: { fr: 'Assujettissement obligatoire à la TVA', en: 'Mandatory VAT registration', de: 'Obligatorische MWST-Pflicht', it: "Assoggettamento obbligatorio all'IVA" } }],
      tvaTaux: [8.1, 3.8, 2.6],
      tvaDefaut: 8.1,
      coefficientNet: 1,
      composantes: [
        {
          id: 'avs',
          categorie: 'social',
          type: 'tranches_annuel',
          label: { fr: 'AVS / AI / APG', en: 'OASI / DI / IC (AHV)', de: 'AHV / IV / EO', it: 'AVS / AI / IPG' },
          tranches: [{ jusqua: 10_100, taux: 5.371 }, { jusqua: 60_500, taux: 7.7 }, { jusqua: null, taux: 10 }],
          min: 530,
          note: {
            fr: "Taux dégressif entre 10 100 et 60 500 CHF approché par un palier ; frais d'administration de la caisse (1 à 3 %) non inclus.",
            en: 'Sliding scale between CHF 10,100 and 60,500 approximated by one step; fund administration costs (1–3%) not included.',
            de: 'Sinkende Beitragsskala zwischen CHF 10 100 und 60 500 durch eine Stufe angenähert; Verwaltungskosten der Kasse (1–3 %) nicht inbegriffen.',
            it: "Scala decrescente tra 10 100 e 60 500 CHF approssimata con un gradino; spese amministrative della cassa (1–3 %) escluse.",
          },
        },
        { id: 'af', categorie: 'social', type: 'pct_net', taux: 1.8, label: { fr: 'Allocations familiales (CAF, taux cantonal)', en: 'Family allowances fund (cantonal rate)', de: 'Familienausgleichskasse (kantonaler Satz)', it: 'Assegni familiari (tasso cantonale)' } },
        { id: 'lpp', categorie: 'social', type: 'pct_net', taux: 7, optionnel: true, activeParDefaut: false, label: { fr: 'Prévoyance professionnelle (LPP, facultative)', en: 'Occupational pension (BVG, optional)', de: 'Berufliche Vorsorge (BVG, freiwillig)', it: 'Previdenza professionale (LPP, facoltativa)' } },
      ],
    },
  },
  livreRecettes: { fr: 'Journal des encaissements', en: 'Receipts journal', de: 'Einnahmenjournal', it: 'Giornale degli incassi' },
  avertissement: {
    ...ESTIMATION,
    fr: 'Estimation simplifiée : cotisations AVS calculées sur le revenu net (CA × coefficient) ; impôts cantonaux et fédéraux non inclus. Ajustez dans Paramètres → Barème.',
    en: 'Simplified estimate: AHV contributions on net income (turnover × coefficient); cantonal and federal taxes not included. Adjust in Settings → Rates.',
    de: 'Vereinfachte Schätzung: AHV-Beiträge auf dem Nettoeinkommen (Umsatz × Koeffizient); Kantons- und Bundessteuern nicht inbegriffen. Anpassen unter Einstellungen → Sätze.',
    it: 'Stima semplificata: contributi AVS sul reddito netto (fatturato × coefficiente); imposte cantonali e federali escluse. Adeguare in Impostazioni → Aliquote.',
  },
  sources: ['https://www.ahv-iv.ch', 'https://www.estv.admin.ch/estv/fr/accueil/taxe-sur-la-valeur-ajoutee.html'],
};

export default ch;
