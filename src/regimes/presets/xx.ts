import type { Regime } from '../types';
import { ACTIVITES_BASE, INDEPENDANT, JOURNAL, TVA_NO } from './common';

// Régime générique : tout est à paramétrer par l'utilisateur (Paramètres → Barème).
const xx: Regime = {
  code: 'XX',
  nom: { fr: 'Autre pays (paramétrable)', en: 'Other country (configurable)', es: 'Otro país (configurable)', de: 'Anderes Land (konfigurierbar)', it: 'Altro paese (configurabile)', pt: 'Outro país (configurável)', nl: 'Ander land (instelbaar)' },
  drapeau: '🌍',
  devise: 'EUR',
  langues: ['en', 'fr', 'es', 'de', 'it', 'pt', 'nl'],
  statut: INDEPENDANT,
  activites: ACTIVITES_BASE,
  activiteDefaut: 'services',
  identifiants: [
    { id: 'id1', label: { fr: "Identifiant d'entreprise", en: 'Business identifier', es: 'Identificador de empresa', de: 'Unternehmenskennung', it: 'Identificativo impresa', pt: 'Identificador da empresa', nl: 'Bedrijfsidentificatie' } },
    { id: 'tva', label: { fr: 'N° de TVA / taxe', en: 'VAT / tax number', es: 'N.º de IVA', de: 'USt-IdNr.', it: 'Partita IVA', pt: 'N.º de IVA', nl: 'Btw-nummer' }, pourTva: true },
  ],
  identifiantClient: { fr: 'Identifiant', en: 'Identifier', es: 'Identificador', de: 'Kennung', it: 'Identificativo', pt: 'Identificador', nl: 'Identificatie' },
  tva: {
    nom: 'TVA',
    franchisePossible: true,
    mentionFranchise: { fr: 'TVA non applicable.', en: 'VAT not applicable.', es: 'IVA no aplicable.', de: 'Keine Umsatzsteuer.', it: 'IVA non applicabile.', pt: 'IVA não aplicável.', nl: 'Btw niet van toepassing.' },
    mentionNumero: TVA_NO,
  },
  mentions: { retard: { fr: '', en: '' } },
  periodicites: ['mensuelle', 'trimestrielle', 'annuelle'],
  periodiciteDefaut: 'trimestrielle',
  echeance: { type: 'jours', jours: 30 },
  options: {
    retenue: {
      label: { fr: 'Retenue à la source sur les factures aux professionnels (%)', en: 'Withholding tax on invoices to businesses (%)', es: 'Retención en facturas a empresas (%)', de: 'Quellensteuer auf Rechnungen an Unternehmen (%)', it: "Ritenuta d'acconto sulle fatture a imprese (%)", pt: 'Retenção na fonte em faturas a empresas (%)', nl: 'Bronheffing op facturen aan bedrijven (%)' },
      tauxDefaut: 0,
      proSeulement: true,
    },
  },
  params: {
    0: {
      seuils: [{ id: 'tva', kind: 'tva', groupe: 'tous', valeur: 0, label: { fr: "Seuil d'exonération de TVA (0 = aucun)", en: 'VAT exemption threshold (0 = none)', es: 'Umbral de exención de IVA (0 = ninguno)', de: 'Grenze der USt-Befreiung (0 = keine)', it: 'Soglia di esenzione IVA (0 = nessuna)', pt: 'Limiar de isenção de IVA (0 = nenhum)', nl: 'Btw-vrijstellingsdrempel (0 = geen)' } }],
      tvaTaux: [20, 10, 5, 0],
      tvaDefaut: 20,
      coefficientNet: 1,
      composantes: [
        { id: 'social_ca', categorie: 'social', type: 'pct_ca', taux: 0, label: { fr: 'Cotisations sociales (% du CA)', en: 'Social contributions (% of turnover)', es: 'Cotizaciones sociales (% de la facturación)', de: 'Sozialbeiträge (% des Umsatzes)', it: 'Contributi sociali (% del fatturato)', pt: 'Contribuições sociais (% da faturação)', nl: 'Sociale bijdragen (% van de omzet)' } },
        { id: 'social_net', categorie: 'social', type: 'pct_net', taux: 0, label: { fr: 'Cotisations sociales (% du revenu net)', en: 'Social contributions (% of net income)', es: 'Cotizaciones sociales (% del rendimiento neto)', de: 'Sozialbeiträge (% des Nettoeinkommens)', it: 'Contributi sociali (% del reddito netto)', pt: 'Contribuições sociais (% do rendimento líquido)', nl: 'Sociale bijdragen (% van het netto-inkomen)' } },
        { id: 'impot_net', categorie: 'impot', type: 'pct_net', taux: 0, label: { fr: 'Impôt (% du revenu net)', en: 'Income tax (% of net income)', es: 'Impuesto (% del rendimiento neto)', de: 'Einkommensteuer (% des Nettoeinkommens)', it: 'Imposta (% del reddito netto)', pt: 'Imposto (% do rendimento líquido)', nl: 'Belasting (% van het netto-inkomen)' } },
        { id: 'forfait', categorie: 'autre', type: 'fixe_mois', montant: 0, label: { fr: 'Forfait mensuel', en: 'Monthly flat amount', es: 'Importe fijo mensual', de: 'Monatliche Pauschale', it: 'Forfait mensile', pt: 'Montante fixo mensal', nl: 'Maandelijks vast bedrag' } },
      ],
    },
  },
  livreRecettes: JOURNAL,
  avertissement: { fr: 'Régime générique : renseignez vos seuils et vos taux dans Paramètres → Barème.', en: 'Generic regime: enter your thresholds and rates in Settings → Rates.', es: 'Régimen genérico: introduzca sus umbrales y tipos en Ajustes → Tarifas.', de: 'Generisches Schema: Grenzen und Sätze unter Einstellungen → Sätze eintragen.', it: 'Regime generico: inserire soglie e aliquote in Impostazioni → Aliquote.', pt: 'Regime genérico: introduza os seus limiares e taxas em Definições → Taxas.', nl: 'Generiek stelsel: vul uw drempels en tarieven in bij Instellingen → Tarieven.' },
  sources: [],
};

export default xx;
