import type { Regime } from '../types';
import { ESTIMATION } from './common';

// Espagne — trabajador autónomo (estimación directa simplificada), RETA par tranches de revenu.
const es: Regime = {
  code: 'ES',
  nom: { fr: 'Espagne', en: 'Spain', es: 'España', de: 'Spanien', it: 'Spagna', pt: 'Espanha', nl: 'Spanje' },
  drapeau: '🇪🇸',
  devise: 'EUR',
  langues: ['es', 'en', 'fr'],
  statut: { fr: 'Travailleur autonome (autónomo, estimación directa simplificada)', en: 'Self-employed (autónomo, simplified direct estimation)', es: 'Trabajador autónomo (estimación directa simplificada)' },
  activites: [
    { id: 'profesional', groupe: 'services', label: { fr: 'Activité professionnelle (services)', en: 'Professional activity (services)', es: 'Actividad profesional (servicios)' }, court: { fr: 'Services', en: 'Services', es: 'Servicios' } },
    { id: 'empresarial', groupe: 'vente', label: { fr: 'Activité commerciale (vente de biens)', en: 'Business activity (goods)', es: 'Actividad empresarial (venta de bienes)' }, court: { fr: 'Vente', en: 'Goods', es: 'Venta' } },
  ],
  activiteDefaut: 'profesional',
  identifiants: [
    { id: 'nif', label: { fr: 'NIF', en: 'NIF (tax ID)', es: 'NIF' }, placeholder: '12345678A' },
    { id: 'nss', label: { fr: 'N° de sécurité sociale (NAF)', en: 'Social security number', es: 'Número de afiliación a la Seguridad Social' } },
  ],
  identifiantClient: { fr: 'NIF / CIF', en: 'NIF / CIF', es: 'NIF / CIF' },
  tva: {
    nom: 'IVA',
    franchisePossible: true,
    mentionFranchise: {
      fr: "Opération exonérée d'IVA en application du régime de franchise des petites entreprises.",
      en: 'VAT-exempt transaction under the small business exemption scheme.',
      es: 'Operación exenta de IVA en aplicación del régimen de franquicia para pequeñas empresas.',
    },
    mentionNumero: { fr: 'NIF-IVA', en: 'VAT no.', es: 'NIF-IVA' },
  },
  mentions: {
    retard: {
      fr: 'Intérêts de retard conformément à la loi 3/2004 : taux légal majoré de 8 points ; indemnité de 40 € pour frais de recouvrement.',
      en: 'Late payment interest under Law 3/2004: legal rate plus 8 points; €40 recovery cost compensation.',
      es: 'Intereses de demora conforme a la Ley 3/2004: tipo legal más 8 puntos; indemnización de 40 € por costes de cobro.',
    },
    retenue: {
      fr: "Retenue à la source d'IRPF pratiquée par le client (art. 101 LIRPF).",
      en: 'IRPF withholding tax applied by the client (art. 101 LIRPF).',
      es: 'Retención de IRPF practicada por el pagador (art. 101 LIRPF).',
    },
  },
  periodicites: ['trimestrielle', 'mensuelle'],
  periodiciteDefaut: 'trimestrielle',
  echeance: { type: 'jours', jours: 20 },
  options: {
    acre: {
      label: { fr: 'Tarifa plana (80 €/mois les 12 premiers mois)', en: 'Flat rate (€80/month for the first 12 months)', es: 'Tarifa plana (80 €/mes los 12 primeros meses)' },
      aide: { fr: 'Approchée ici par une réduction de 60 % de la cotisation pendant 12 mois.', en: 'Approximated here by a 60% reduction of the quota for 12 months.', es: 'Aproximada aquí mediante una reducción del 60 % de la cuota durante 12 meses.' },
    },
    retenue: { label: { fr: 'Retenue IRPF sur les factures aux professionnels (%)', en: 'IRPF withholding on invoices to businesses (%)', es: 'Retención de IRPF en facturas a empresas y profesionales (%)' }, tauxDefaut: 15, proSeulement: true },
  },
  params: {
    0: {
      seuils: [
        {
          id: 'franquicia',
          kind: 'tva',
          groupe: 'tous',
          valeur: 85_000,
          label: { fr: "Régime de franchise d'IVA (annoncé pour 2026)", en: 'VAT exemption scheme (announced for 2026)', es: 'Régimen de franquicia del IVA (previsto 2026)' },
          note: { fr: 'À confirmer dans la réglementation définitive.', en: 'To be confirmed in the final regulations.', es: 'Pendiente de confirmación en la normativa definitiva.' },
        },
      ],
      tvaTaux: [21, 10, 4],
      tvaDefaut: 21,
      coefficientNet: 0.95,
      composantes: [
        {
          id: 'cuota',
          categorie: 'social',
          type: 'tranches_mois',
          label: { fr: "Cotisation d'autonome (RETA, par tranche de revenu net mensuel)", en: 'Self-employed contribution (RETA, by monthly net income bracket)', es: 'Cuota de autónomos (RETA, por tramo de rendimiento neto mensual)' },
          tranches: [
            { jusqua: 670, montant: 200 },
            { jusqua: 900, montant: 220 },
            { jusqua: 1_166.7, montant: 260 },
            { jusqua: 1_300, montant: 291 },
            { jusqua: 1_700, montant: 294 },
            { jusqua: 1_850, montant: 350 },
            { jusqua: 2_030, montant: 370 },
            { jusqua: 2_330, montant: 390 },
            { jusqua: 2_760, montant: 415 },
            { jusqua: 3_190, montant: 440 },
            { jusqua: 3_620, montant: 465 },
            { jusqua: 4_050, montant: 490 },
            { jusqua: 6_000, montant: 530 },
            { jusqua: null, montant: 590 },
          ],
          reductionDebut: { facteur: 0.4, mois: 12 },
          note: { fr: 'Table 2025 (2026 en négociation) ; la tarifa plana remplace la cotisation par 80 €/mois.', en: '2025 table (2026 under negotiation); the flat rate replaces the quota with €80/month.', es: 'Tabla 2025 (2026 en negociación); la tarifa plana sustituye la cuota por 80 €/mes.' },
        },
        { id: 'irpf', categorie: 'impot', type: 'pct_net', taux: 20, optionnel: true, activeParDefaut: false, label: { fr: "Acompte d'IRPF (modelo 130, 20 % du bénéfice)", en: 'IRPF instalment (form 130, 20% of profit)', es: 'Pago fraccionado de IRPF (modelo 130, 20 % del rendimiento)' } },
      ],
    },
  },
  livreRecettes: { fr: 'Livre-registre des revenus', en: 'Income register', es: 'Libro registro de ingresos' },
  avertissement: { ...ESTIMATION },
  sources: ['https://www.seg-social.es/wps/portal/wss/internet/Trabajadores/CotizacionRecaudacionTrabajadores/36537', 'https://sede.agenciatributaria.gob.es'],
};

export default es;
