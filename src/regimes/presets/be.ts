import type { Regime } from '../types';
import { ACTIVITES_BASE, ESTIMATION } from './common';

// Belgique — indépendant à titre principal (personne physique). Sources : inasti.be, finances.belgium.be.
const be: Regime = {
  code: 'BE',
  pays: 'BE',
  statutId: 'independant',
  forme: 'personne',
  nom: { fr: 'Belgique', en: 'Belgium', nl: 'België', de: 'Belgien', es: 'Bélgica', it: 'Belgio', pt: 'Bélgica' },
  drapeau: '🇧🇪',
  devise: 'EUR',
  langues: ['fr', 'nl', 'de', 'en'],
  statut: { fr: 'Indépendant à titre principal (personne physique)', en: 'Self-employed in main occupation (natural person)', nl: 'Zelfstandige in hoofdberoep (natuurlijke persoon)', de: 'Selbständiger im Hauptberuf (natürliche Person)' },
  activites: ACTIVITES_BASE,
  activiteDefaut: 'services',
  identifiants: [
    { id: 'bce', label: { fr: "Numéro d'entreprise (BCE)", en: 'Enterprise number (CBE)', nl: 'Ondernemingsnummer (KBO)', de: 'Unternehmensnummer (ZDU)' }, placeholder: '0123.456.789' },
    { id: 'tva', label: { fr: 'N° de TVA', en: 'VAT number', nl: 'Btw-nummer', de: 'MwSt-Nummer' }, placeholder: 'BE 0123.456.789', pourTva: true },
  ],
  identifiantClient: { fr: "N° d'entreprise / TVA", en: 'Enterprise / VAT number', nl: 'Ondernemings- / btw-nummer', de: 'Unternehmens- / MwSt-Nummer' },
  tva: {
    nom: 'TVA',
    franchisePossible: true,
    mentionFranchise: {
      fr: 'Régime particulier de franchise des petites entreprises – TVA non applicable (art. 56bis du Code de la TVA).',
      en: 'Special VAT exemption scheme for small enterprises – VAT not applicable (art. 56bis of the Belgian VAT Code).',
      nl: 'Bijzondere vrijstellingsregeling kleine ondernemingen – btw niet van toepassing (art. 56bis Wbtw).',
      de: 'Sonderregelung der Steuerbefreiung für Kleinunternehmen – keine MwSt. (Art. 56bis MwStGB).',
    },
    mentionNumero: { fr: 'N° TVA', en: 'VAT no.', nl: 'Btw-nr.', de: 'MwSt-Nr.' },
  },
  mentions: {
    retard: {
      fr: "Pénalités de retard (loi du 2 août 2002) : intérêts au taux directeur de la BCE majoré de 8 points dès le lendemain de l'échéance, sans mise en demeure ; indemnité forfaitaire pour frais de recouvrement : 40 €.",
      en: 'Late payment (Act of 2 August 2002): interest at the ECB reference rate plus 8 points from the day after the due date, without formal notice; fixed compensation for recovery costs: €40.',
      nl: 'Bij laattijdige betaling (wet van 2 augustus 2002): verwijlinteresten tegen de ECB-referentierente plus 8 punten vanaf de dag na de vervaldatum, zonder ingebrekestelling; forfaitaire vergoeding voor invorderingskosten: € 40.',
      de: 'Bei Zahlungsverzug (Gesetz vom 2. August 2002): Zinsen zum EZB-Leitzins zuzüglich 8 Punkten ab dem Tag nach Fälligkeit, ohne Mahnung; pauschale Entschädigung für Beitreibungskosten: 40 €.',
    },
  },
  periodicites: ['trimestrielle', 'mensuelle'],
  periodiciteDefaut: 'trimestrielle',
  echeance: { type: 'jours', jours: 20 },
  options: {},
  params: {
    0: {
      seuils: [{ id: 'tva', kind: 'tva', groupe: 'tous', valeur: 25_000, label: { fr: 'Franchise de TVA petites entreprises', en: 'Small enterprise VAT exemption', nl: 'Btw-vrijstelling kleine ondernemingen', de: 'MwSt-Befreiung für Kleinunternehmen' } }],
      tvaTaux: [21, 12, 6],
      tvaDefaut: 21,
      coefficientNet: 1,
      composantes: [
        {
          id: 'inasti',
          categorie: 'social',
          type: 'tranches_annuel',
          label: { fr: 'Cotisations sociales (INASTI)', en: 'Social security contributions (NISSE)', nl: 'Sociale bijdragen (RSVZ)', de: 'Sozialbeiträge (LISVS)' },
          tranches: [{ jusqua: 76_235, taux: 20.5 }, { jusqua: 112_350, taux: 14.16 }, { jusqua: null, taux: 0 }],
          min: 3_600,
          note: {
            fr: 'Cotisations provisoires régularisées deux ans plus tard sur le revenu réel ; minimum légal appliqué. Frais de gestion de la caisse (3 à 4 %) non inclus.',
            en: 'Provisional contributions regularised two years later on actual income; legal minimum applied. Fund management fees (3–4%) not included.',
            nl: 'Voorlopige bijdragen, twee jaar later geregulariseerd op het werkelijke inkomen; wettelijk minimum toegepast. Beheerskosten van het fonds (3 à 4 %) niet inbegrepen.',
          },
        },
        {
          id: 'ipp',
          categorie: 'impot',
          type: 'tranches_annuel',
          optionnel: true,
          activeParDefaut: false,
          label: { fr: 'Impôt des personnes physiques (estimation)', en: 'Personal income tax (estimate)', nl: 'Personenbelasting (raming)', de: 'Einkommensteuer (Schätzung)' },
          tranches: [{ jusqua: 10_910, taux: 0 }, { jusqua: 16_320, taux: 25 }, { jusqua: 28_800, taux: 40 }, { jusqua: 49_840, taux: 45 }, { jusqua: null, taux: 50 }],
          note: { fr: 'Hors additionnels communaux et réductions ; quotité exemptée de base incluse.', en: 'Excluding municipal surcharges and reductions; basic tax-free allowance included.', nl: 'Exclusief gemeentelijke opcentiemen en verminderingen; belastingvrije som inbegrepen.' },
        },
      ],
    },
  },
  livreRecettes: { fr: 'Journal des recettes', en: 'Sales journal', nl: 'Dagboek van ontvangsten', de: 'Einnahmenjournal' },
  avertissement: {
    ...ESTIMATION,
    fr: 'Estimation simplifiée : les cotisations belges se calculent sur le revenu net réel (CA moins frais), régularisé a posteriori. Ajustez le coefficient de revenu net et les taux dans Paramètres → Barème.',
    en: 'Simplified estimate: Belgian contributions are based on actual net income (turnover minus expenses), regularised later. Adjust the net-income coefficient and the rates in Settings → Rates.',
    nl: 'Vereenvoudigde raming: Belgische bijdragen worden berekend op het werkelijke netto-inkomen (omzet min kosten), later geregulariseerd. Pas de coëfficiënt en de tarieven aan in Instellingen → Tarieven.',
  },
  sources: ['https://www.inasti.be', 'https://finances.belgium.be/fr/entreprises/tva/franchise'],
};

export default be;
