import type { Regime, RegimeParams } from '../types';
import { ACTIVITES_BASE } from './common';
import fr from './fr';
import { IDENT_SOCIETE_FR, IR_NOTE, IS_NOTE, PERIODICITES_TNS, PIED_SOCIETE_FR, SEUILS_TVA_FR, TRANCHES_IR, TRANCHES_IS, TVA_FR } from './fr-common';

// France — SASU ou SAS à l'impôt sur les sociétés, président assimilé salarié : charges sociales
// (parts salariale et patronale) sur la rémunération du président, IS sur le bénéfice restant.

const params = (): RegimeParams => ({
  seuils: structuredClone(SEUILS_TVA_FR),
  tvaTaux: [20, 10, 5.5, 2.1],
  tvaDefaut: 20,
  coefficientNet: 1,
  baseRevenu: 'reel',
  composantes: [
    {
      id: 'charges',
      categorie: 'social',
      type: 'pct_net',
      base: 'remuneration',
      taux: 82,
      label: { fr: 'Charges sociales sur la rémunération du président (salariales + patronales)', en: "Social charges on the president's remuneration (employee + employer)" },
      note: {
        fr: '≈ 82 % du net versé : brut ≈ net ÷ 0,78 (cotisations salariales ≈ 22 %), charges patronales ≈ 42 % du brut (sans assurance chômage). CSG-CRDS incluses, formation et taxe d’apprentissage comprises. Aucune charge si le président n’est pas rémunéré.',
        en: '≈ 82% of the net paid: gross ≈ net ÷ 0.78 (employee contributions ≈ 22%), employer charges ≈ 42% of gross (no unemployment insurance). Includes CSG-CRDS, training and apprenticeship levies. No charge if the president is unpaid.',
      },
    },
    {
      id: 'is',
      categorie: 'impot',
      type: 'tranches_annuel',
      base: 'resultat',
      label: { fr: 'Impôt sur les sociétés', en: 'Corporate income tax' },
      tranches: TRANCHES_IS,
      note: IS_NOTE,
    },
    {
      id: 'ir',
      categorie: 'impot',
      type: 'tranches_annuel',
      base: 'remuneration',
      optionnel: true,
      activeParDefaut: false,
      label: { fr: 'Impôt sur le revenu du président (estimation, 1 part)', en: "President's income tax (estimate, 1 share)" },
      tranches: TRANCHES_IR,
      note: { ...IR_NOTE, fr: `${IR_NOTE.fr} Abattement de 10 % non appliqué.` },
    },
  ],
});

const frSasu: Regime = {
  code: 'FR-SASU',
  pays: 'FR',
  statutId: 'sasu',
  forme: 'societe',
  nom: fr.nom,
  drapeau: fr.drapeau,
  devise: 'EUR',
  langues: ['fr', 'en'],
  statut: { fr: 'SASU / SAS à l’IS — président assimilé salarié', en: 'SASU / SAS under corporate tax — president treated as employee' },
  remuneration: {
    label: { fr: 'Rémunération nette mensuelle du président', en: "President's net monthly remuneration" },
    aide: { fr: 'Salaire net que vous vous versez chaque mois (0 si vous ne vous rémunérez pas). Les charges sociales sont estimées dessus ; le reste du bénéfice est soumis à l’IS.', en: 'Net salary you pay yourself each month (0 if unpaid). Social charges are estimated on it; the remaining profit is subject to corporate tax.' },
  },
  activites: ACTIVITES_BASE,
  activiteDefaut: 'services',
  identifiants: IDENT_SOCIETE_FR,
  identifiantClient: fr.identifiantClient,
  tva: TVA_FR,
  mentions: { retard: fr.mentions.retard, pied: PIED_SOCIETE_FR },
  periodicites: [...PERIODICITES_TNS],
  periodiciteDefaut: 'mensuelle',
  echeance: { type: 'jours', jours: 15 },
  options: {},
  params: { 0: params() },
  livreRecettes: { fr: 'Journal des ventes', en: 'Sales journal' },
  avertissement: {
    fr: 'Estimation : charges sociales sur la rémunération du président (≈ 82 % du net), IS sur le bénéfice restant (recettes − dépenses − rémunération − charges). Hors dividendes (prélèvement forfaitaire de 30 %), hors CFE ; comptabilité d’engagement non modélisée.',
    en: "Estimate: social charges on the president's remuneration (≈ 82% of net), corporate tax on the remaining profit (receipts − expenses − remuneration − charges). Excludes dividends (30% flat tax) and the CFE; accrual accounting is not modelled.",
  },
  sources: ['https://www.urssaf.fr/accueil/employeur/calculer-cotisations/taux-cotisations.html', 'https://www.impots.gouv.fr/professionnel/limpot-sur-les-societes'],
};

export default frSasu;
