import type { Regime } from '../types';
import { ESTIMATION } from './common';

// Italie — partita IVA en regime forfettario (L. 190/2014).
const it: Regime = {
  code: 'IT',
  nom: { fr: 'Italie', en: 'Italy', it: 'Italia', es: 'Italia', de: 'Italien', pt: 'Itália', nl: 'Italië' },
  drapeau: '🇮🇹',
  devise: 'EUR',
  langues: ['it', 'en', 'fr'],
  statut: { fr: 'Partita IVA en régime forfettario', en: 'Sole trader under the flat-rate (forfettario) regime', it: 'Partita IVA in regime forfettario' },
  activites: [
    { id: 'professioni', groupe: 'services', label: { fr: 'Professions et services (coefficient 78 %)', en: 'Professions and services (78% coefficient)', it: 'Attività professionali e servizi (coefficiente 78 %)' }, court: { fr: 'Services', en: 'Services', it: 'Servizi' } },
    { id: 'commercio', groupe: 'vente', label: { fr: 'Commerce (coefficient 40 %)', en: 'Trade (40% coefficient)', it: 'Commercio (coefficiente 40 %)' }, court: { fr: 'Commerce', en: 'Trade', it: 'Commercio' } },
    { id: 'altre', groupe: 'services', label: { fr: 'Autres activités (coefficient 67 %)', en: 'Other activities (67% coefficient)', it: 'Altre attività (coefficiente 67 %)' }, court: { fr: 'Autres', en: 'Other', it: 'Altre' } },
  ],
  activiteDefaut: 'professioni',
  identifiants: [
    { id: 'piva', label: { fr: 'Partita IVA', en: 'VAT number (Partita IVA)', it: 'Partita IVA' }, placeholder: 'IT01234567890' },
    { id: 'cf', label: { fr: 'Codice fiscale', en: 'Tax code (Codice fiscale)', it: 'Codice fiscale' } },
  ],
  identifiantClient: { fr: 'Partita IVA / Codice fiscale', en: 'VAT no. / tax code', it: 'Partita IVA / Codice fiscale' },
  tva: {
    nom: 'IVA',
    franchisePossible: true,
    mentionFranchise: {
      fr: "Opération sans application de l'IVA, régime forfettario (art. 1, al. 54-89, L. 190/2014) ; non soumise à retenue d'acompte ; droit de timbre de 2 € acquitté sur les factures de plus de 77,47 €.",
      en: 'Transaction not subject to VAT under the flat-rate regime (art. 1, par. 54-89, Law 190/2014); not subject to withholding tax; €2 stamp duty paid on invoices above €77.47.',
      it: "Operazione effettuata ai sensi dell'art. 1, commi da 54 a 89, L. 190/2014 – regime forfettario. Non soggetta a IVA né a ritenuta d'acconto. Imposta di bollo da 2 € assolta per importi superiori a 77,47 €.",
    },
    mentionNumero: { fr: 'P. IVA', en: 'VAT no.', it: 'P. IVA' },
  },
  mentions: {
    retard: {
      fr: 'Intérêts de retard au sens du D.Lgs. 231/2002 (taux BCE majoré de 8 points) et indemnité forfaitaire de 40 € pour frais de recouvrement.',
      en: 'Late payment interest under Legislative Decree 231/2002 (ECB rate plus 8 points) and €40 fixed compensation for recovery costs.',
      it: 'Interessi di mora ai sensi del D.Lgs. 231/2002 (tasso BCE maggiorato di 8 punti) e importo forfettario di 40 € per i costi di recupero.',
    },
  },
  periodicites: ['annuelle', 'trimestrielle'],
  periodiciteDefaut: 'annuelle',
  echeance: { type: 'jours', jours: 181 },
  options: {
    acre: {
      label: { fr: 'Start-up : imposta sostitutiva à 5 % (5 premières années)', en: 'Start-up: 5% substitute tax (first 5 years)', it: 'Start-up: imposta sostitutiva al 5 % (primi 5 anni)' },
      aide: { fr: "Réservé aux nouvelles activités sans continuité avec une activité précédente.", en: 'Reserved for new activities not continuing a previous one.', it: 'Riservata alle nuove attività che non proseguono attività precedenti.' },
    },
  },
  params: {
    0: {
      seuils: [{ id: 'forfettario', kind: 'regime', groupe: 'tous', valeur: 85_000, majore: 100_000, label: { fr: 'Plafond du régime forfettario', en: 'Flat-rate regime ceiling', it: 'Limite ricavi regime forfettario' } }],
      tvaTaux: [22, 10, 5, 4],
      tvaDefaut: 22,
      coefficientNet: { professioni: 0.78, commercio: 0.4, altre: 0.67 },
      composantes: [
        {
          id: 'inps',
          categorie: 'social',
          type: 'pct_net',
          taux: 26.07,
          label: { fr: 'INPS gestione separata', en: 'INPS separate scheme', it: 'INPS gestione separata' },
          note: { fr: 'Artisans et commerçants : gestion IVS avec minimum fixe (≈ 4 500 €/an) et réduction de 35 % possible — ajustez.', en: 'Artisans and traders: IVS scheme with fixed minimum (≈ €4,500/year) and optional 35% reduction — adjust.', it: 'Artigiani e commercianti: gestione IVS con minimale fisso (≈ 4 500 €/anno) e riduzione del 35 % opzionale — adeguare.' },
        },
        {
          id: 'sostitutiva',
          categorie: 'impot',
          type: 'pct_net',
          taux: 15,
          reductionDebut: { facteur: 1 / 3, mois: 60 },
          label: { fr: 'Imposta sostitutiva (15 %, 5 % start-up)', en: 'Substitute tax (15%, 5% for start-ups)', it: 'Imposta sostitutiva (15 %, 5 % start-up)' },
          note: { fr: 'Calculée sur le revenu forfaitaire avant déduction des cotisations versées.', en: 'Computed on the flat-rate income before deducting contributions paid.', it: 'Calcolata sul reddito forfettario al lordo dei contributi versati.' },
        },
      ],
    },
  },
  livreRecettes: { fr: 'Registre des encaissements', en: 'Receipts register', it: 'Registro degli incassi' },
  avertissement: { ...ESTIMATION },
  sources: ['https://www.agenziaentrate.gov.it/portale/web/guest/regime-forfetario-le-regole', 'https://www.inps.it'],
};

export default it;
