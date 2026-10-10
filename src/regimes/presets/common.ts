import type { Activite, LText } from '../types';

export const VENTE: LText = {
  fr: 'Vente de biens / marchandises',
  en: 'Sale of goods',
  es: 'Venta de bienes',
  de: 'Warenverkauf',
  it: 'Vendita di beni',
  pt: 'Venda de bens',
  nl: 'Verkoop van goederen',
};
export const VENTE_COURT: LText = { fr: 'Vente', en: 'Goods', es: 'Venta', de: 'Waren', it: 'Vendita', pt: 'Vendas', nl: 'Goederen' };
export const SERVICES: LText = {
  fr: 'Prestations de services',
  en: 'Services',
  es: 'Prestación de servicios',
  de: 'Dienstleistungen',
  it: 'Prestazioni di servizi',
  pt: 'Prestação de serviços',
  nl: 'Diensten',
};
export const SERVICES_COURT: LText = { fr: 'Services', en: 'Services', es: 'Servicios', de: 'Dienste', it: 'Servizi', pt: 'Serviços', nl: 'Diensten' };

/** Deux catégories génériques : biens et services. */
export const ACTIVITES_BASE: Activite[] = [
  { id: 'services', label: SERVICES, court: SERVICES_COURT, groupe: 'services' },
  { id: 'vente', label: VENTE, court: VENTE_COURT, groupe: 'vente' },
];

export const INDEPENDANT: LText = {
  fr: 'Indépendant (personne physique)',
  en: 'Self-employed (sole trader)',
  es: 'Trabajador autónomo',
  de: 'Selbständig (Einzelunternehmen)',
  it: 'Lavoratore autonomo',
  pt: 'Trabalhador independente',
  nl: 'Zelfstandige (eenmanszaak)',
};

export const TVA_NO: LText = { fr: 'N° TVA', en: 'VAT no.', es: 'NIF-IVA', de: 'USt-IdNr.', it: 'P. IVA', pt: 'NIF', nl: 'Btw-nr.' };

/** Directive 2011/7/UE : intérêts BCE + 8 points et indemnité forfaitaire de 40 €. */
export const RETARD_UE: LText = {
  fr: "Pénalités de retard : intérêts au taux directeur de la BCE majoré de 8 points, exigibles sans rappel dès le lendemain de l'échéance ; indemnité forfaitaire pour frais de recouvrement : 40 €.",
  en: 'Late payment: interest at the ECB reference rate plus 8 percentage points, due without reminder from the day after the due date; fixed compensation for recovery costs: €40.',
  es: 'Intereses de demora al tipo de referencia del BCE más 8 puntos, exigibles sin requerimiento desde el día siguiente al vencimiento; indemnización fija por costes de cobro: 40 €.',
  de: 'Verzugszinsen in Höhe des EZB-Leitzinses zuzüglich 8 Prozentpunkten ab dem Tag nach Fälligkeit ohne Mahnung; pauschale Entschädigung für Beitreibungskosten: 40 €.',
  it: 'Interessi di mora al tasso di riferimento BCE maggiorato di 8 punti, dovuti senza sollecito dal giorno successivo alla scadenza; importo forfettario per costi di recupero: 40 €.',
  pt: 'Juros de mora à taxa de referência do BCE acrescida de 8 pontos, devidos sem interpelação a partir do dia seguinte ao vencimento; indemnização fixa por custos de cobrança: 40 €.',
  nl: 'Verwijlinteresten tegen de ECB-referentierente plus 8 procentpunten, verschuldigd zonder aanmaning vanaf de dag na de vervaldatum; forfaitaire vergoeding voor invorderingskosten: € 40.',
};

export const ESTIMATION: LText = {
  fr: 'Estimation simplifiée calculée sur le chiffre d’affaires encaissé (et un coefficient de revenu net) ; elle ne remplace pas vos déclarations officielles. Vérifiez et ajustez les taux dans Paramètres → Barème.',
  en: 'Simplified estimate computed from cash receipts (and a net-income coefficient); it does not replace your official returns. Check and adjust the rates in Settings → Rates.',
  es: 'Estimación simplificada calculada sobre los ingresos cobrados (y un coeficiente de rendimiento neto); no sustituye a sus declaraciones oficiales. Revise y ajuste los tipos en Ajustes → Tarifas.',
  de: 'Vereinfachte Schätzung auf Basis der vereinnahmten Umsätze (und eines Nettoeinkommens-Koeffizienten); sie ersetzt keine amtlichen Erklärungen. Prüfen und passen Sie die Sätze unter Einstellungen → Sätze an.',
  it: 'Stima semplificata calcolata sugli incassi (e su un coefficiente di reddito netto); non sostituisce le dichiarazioni ufficiali. Verificare e adeguare le aliquote in Impostazioni → Aliquote.',
  pt: 'Estimativa simplificada calculada sobre os recebimentos (e um coeficiente de rendimento líquido); não substitui as suas declarações oficiais. Verifique e ajuste as taxas em Definições → Taxas.',
  nl: 'Vereenvoudigde raming op basis van de ontvangen omzet (en een netto-inkomenscoëfficiënt); vervangt uw officiële aangiften niet. Controleer en pas de tarieven aan in Instellingen → Tarieven.',
};

export const JOURNAL: LText = {
  fr: 'Journal des encaissements',
  en: 'Receipts journal',
  es: 'Libro registro de ingresos',
  de: 'Einnahmenjournal',
  it: 'Registro degli incassi',
  pt: 'Livro de registo de recebimentos',
  nl: 'Ontvangstenjournaal',
};
