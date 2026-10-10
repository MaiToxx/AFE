import type { Regime } from '../types';
import { ESTIMATION } from './common';

// Portugal — trabalhador independente (recibos verdes), regime simplificado.
const pt: Regime = {
  code: 'PT',
  pays: 'PT',
  statutId: 'independant',
  forme: 'personne',
  nom: { fr: 'Portugal', en: 'Portugal', pt: 'Portugal', es: 'Portugal', de: 'Portugal', it: 'Portogallo', nl: 'Portugal' },
  drapeau: '🇵🇹',
  devise: 'EUR',
  langues: ['pt', 'en', 'fr'],
  statut: { fr: 'Travailleur indépendant (recibos verdes, régime simplifié)', en: 'Self-employed (green receipts, simplified regime)', pt: 'Trabalhador independente (recibos verdes, regime simplificado)' },
  activites: [
    { id: 'servicos', groupe: 'services', label: { fr: 'Prestations de services', en: 'Services', pt: 'Prestação de serviços' }, court: { fr: 'Services', en: 'Services', pt: 'Serviços' } },
    { id: 'vendas', groupe: 'vente', label: { fr: 'Vente de biens', en: 'Sale of goods', pt: 'Venda de bens' }, court: { fr: 'Vente', en: 'Goods', pt: 'Vendas' } },
  ],
  activiteDefaut: 'servicos',
  identifiants: [
    { id: 'nif', label: { fr: 'NIF', en: 'NIF (tax number)', pt: 'NIF' }, placeholder: '123456789' },
    { id: 'niss', label: { fr: 'NISS (sécurité sociale)', en: 'NISS (social security)', pt: 'NISS' } },
  ],
  identifiantClient: { fr: 'NIF / NIPC', en: 'NIF / NIPC', pt: 'NIF / NIPC' },
  tva: {
    nom: 'IVA',
    franchisePossible: true,
    mentionFranchise: { fr: "IVA – régime d'exonération (article 53.º du CIVA).", en: 'VAT – exemption regime (article 53 of the Portuguese VAT Code).', pt: 'IVA – regime de isenção (artigo 53.º do CIVA).' },
    mentionNumero: { fr: 'NIF', en: 'VAT no.', pt: 'NIF' },
  },
  mentions: {
    retard: {
      fr: 'Intérêts de retard au taux commercial légal (DL 62/2013) et indemnité de 40 € pour frais de recouvrement.',
      en: 'Late payment interest at the legal commercial rate (DL 62/2013) and €40 recovery cost compensation.',
      pt: 'Juros de mora à taxa legal comercial (DL 62/2013) e indemnização de 40 € por custos de cobrança.',
    },
    retenue: {
      fr: "Retenue à la source d'IRS effectuée par le client (art. 101.º du CIRS).",
      en: 'IRS withholding tax applied by the client (art. 101 of the CIRS).',
      pt: 'Retenção na fonte de IRS efetuada pelo adquirente (art. 101.º do CIRS).',
    },
  },
  periodicites: ['trimestrielle'],
  periodiciteDefaut: 'trimestrielle',
  echeance: { type: 'jours', jours: 30 },
  options: {
    acre: {
      label: { fr: 'Première année : exonération de cotisations (12 mois)', en: 'First year: contribution exemption (12 months)', pt: 'Primeiro ano: isenção de contribuições (12 meses)' },
      aide: { fr: "Applicable au premier enregistrement d'activité.", en: 'Applicable to the first registration of activity.', pt: 'Aplicável no primeiro início de atividade.' },
    },
    retenue: { label: { fr: 'Retenue IRS sur les factures aux entreprises (%)', en: 'IRS withholding on invoices to companies (%)', pt: 'Retenção na fonte de IRS em faturas a empresas (%)' }, tauxDefaut: 25, proSeulement: true },
  },
  params: {
    0: {
      seuils: [{ id: 'isencao', kind: 'tva', groupe: 'tous', valeur: 15_000, label: { fr: "Exonération d'IVA (art. 53.º)", en: 'VAT exemption (art. 53)', pt: 'Isenção de IVA (art. 53.º)' } }],
      tvaTaux: [23, 13, 6],
      tvaDefaut: 23,
      coefficientNet: { servicos: 0.7, vendas: 0.2 },
      composantes: [
        {
          id: 'ss',
          categorie: 'social',
          type: 'pct_net',
          taux: 21.4,
          min: 240,
          reductionDebut: { facteur: 0, mois: 12 },
          label: { fr: 'Sécurité sociale (21,4 % de 70 % des services / 20 % des ventes)', en: 'Social security (21.4% of 70% of services / 20% of sales)', pt: 'Segurança Social (21,4 % sobre 70 % dos serviços / 20 % das vendas)' },
          note: { fr: 'Contribution minimale 20 €/mois.', en: 'Minimum contribution €20/month.', pt: 'Contribuição mínima de 20 €/mês.' },
        },
        {
          id: 'irs',
          categorie: 'impot',
          type: 'tranches_annuel',
          optionnel: true,
          activeParDefaut: false,
          label: { fr: 'IRS (estimation)', en: 'IRS income tax (estimate)', pt: 'IRS (estimativa)' },
          tranches: [
            { jusqua: 8_059, taux: 13 },
            { jusqua: 12_160, taux: 16.5 },
            { jusqua: 17_233, taux: 22 },
            { jusqua: 22_306, taux: 25 },
            { jusqua: 28_400, taux: 32 },
            { jusqua: 41_629, taux: 35.5 },
            { jusqua: 44_987, taux: 43.5 },
            { jusqua: 83_696, taux: 45 },
            { jusqua: null, taux: 48 },
          ],
          note: { fr: 'Appliqué ici au revenu net calculé ; le régime simplifié retient 75 % des services.', en: 'Applied here to the computed net income; the simplified regime takes 75% of services.', pt: 'Aplicado aqui ao rendimento líquido calculado; o regime simplificado considera 75 % dos serviços.' },
        },
      ],
    },
  },
  livreRecettes: { fr: "Livre d'enregistrement des recettes", en: 'Receipts register', pt: 'Livro de registo de recibos' },
  avertissement: { ...ESTIMATION },
  sources: ['https://www.seg-social.pt/trabalhadores-independentes', 'https://www.portaldasfinancas.gov.pt'],
};

export default pt;
