import type { Regime, RegimeParams } from '../types';
import { ACTIVITES_BASE } from './common';
import fr from './fr';
import { CFP_TNS, IDENT_SOCIETE_FR, IR_NOTE, IS_NOTE, PASS, PERIODICITES_TNS, PIED_SOCIETE_FR, SEUILS_TVA_FR, SOURCES_TNS, TNS_MIN, TNS_NOTE, TRANCHES_IR, TRANCHES_IS, TVA_FR, tranchesTNS } from './fr-common';

// France — EURL ou SARL à l'impôt sur les sociétés, gérant majoritaire (travailleur non salarié) :
// cotisations TNS sur la rémunération du gérant, IS sur le bénéfice restant.

const params = (annee: number): RegimeParams => ({
  seuils: structuredClone(SEUILS_TVA_FR),
  tvaTaux: [20, 10, 5.5, 2.1],
  tvaDefaut: 20,
  coefficientNet: 1,
  baseRevenu: 'reel',
  composantes: [
    {
      id: 'tns',
      categorie: 'social',
      type: 'tranches_annuel',
      base: 'remuneration',
      label: { fr: 'Cotisations TNS du gérant (SSI, CSG-CRDS incluses)', en: "Manager's self-employed contributions (SSI, incl. CSG-CRDS)" },
      tranches: tranchesTNS(annee),
      min: TNS_MIN,
      note: { ...TNS_NOTE, fr: `${TNS_NOTE.fr} Dues même sans rémunération (minimales). PASS ${annee} : ${(PASS[annee] ?? PASS[2026]).toLocaleString('fr-FR')} €.` },
    },
    CFP_TNS,
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
      label: { fr: 'Impôt sur le revenu du gérant (estimation, 1 part)', en: "Manager's income tax (estimate, 1 share)" },
      tranches: TRANCHES_IR,
      note: { ...IR_NOTE, fr: `${IR_NOTE.fr} Abattement de 10 % non appliqué.` },
    },
  ],
});

const frEurl: Regime = {
  code: 'FR-EURL',
  pays: 'FR',
  statutId: 'eurl',
  forme: 'societe',
  nom: fr.nom,
  drapeau: fr.drapeau,
  devise: 'EUR',
  langues: ['fr', 'en'],
  statut: { fr: 'EURL / SARL à l’IS — gérant majoritaire (TNS)', en: 'EURL / SARL under corporate tax — majority manager (self-employed)' },
  remuneration: {
    label: { fr: 'Rémunération nette mensuelle du gérant', en: "Manager's net monthly remuneration" },
    aide: { fr: 'Ce que vous vous versez chaque mois, avant impôt sur le revenu. Les cotisations TNS sont calculées dessus ; le reste du bénéfice est soumis à l’IS.', en: 'What you pay yourself each month, before income tax. Self-employed contributions are computed on it; the remaining profit is subject to corporate tax.' },
  },
  activites: ACTIVITES_BASE,
  activiteDefaut: 'services',
  identifiants: IDENT_SOCIETE_FR.map((i) => (i.id === 'forme' ? { ...i, placeholder: 'EURL' } : i)),
  identifiantClient: fr.identifiantClient,
  tva: TVA_FR,
  mentions: { retard: fr.mentions.retard, pied: PIED_SOCIETE_FR },
  periodicites: [...PERIODICITES_TNS],
  periodiciteDefaut: 'mensuelle',
  echeance: { type: 'jours', jours: 5 },
  options: {},
  params: { 2024: params(2024), 2025: params(2025), 2026: params(2026) },
  livreRecettes: { fr: 'Journal des ventes', en: 'Sales journal' },
  avertissement: {
    fr: 'Estimation : cotisations TNS sur la rémunération du gérant (assiette 74 %), IS sur le bénéfice restant (recettes − dépenses − rémunération − cotisations). Hors dividendes (prélèvement forfaitaire de 30 %, cotisations au-delà de 10 % du capital), hors CFE ; comptabilité d’engagement non modélisée.',
    en: "Estimate: self-employed contributions on the manager's remuneration (74% base), corporate tax on the remaining profit (receipts − expenses − remuneration − contributions). Excludes dividends (30% flat tax, contributions above 10% of capital) and the CFE; accrual accounting is not modelled.",
  },
  sources: [...SOURCES_TNS, 'https://www.impots.gouv.fr/professionnel/limpot-sur-les-societes'],
};

export default frEurl;
