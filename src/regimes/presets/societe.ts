// Sociétés (dirigeant rémunéré + impôt sur les sociétés) pour les pays hors France : construites à
// partir du régime « indépendant » du pays. Valeurs 2026 indicatives, à vérifier (sources ci-dessous).
import type { Composante, LText, Regime, Tranche } from '../types';
import at from './at';
import be from './be';
import ca from './ca';
import ch from './ch';
import { ACTIVITES_BASE } from './common';
import de from './de';
import es from './es';
import gb from './gb';
import ie from './ie';
import it from './it';
import lu from './lu';
import ma from './ma';
import nl from './nl';
import pt from './pt';
import us from './us';
import xx from './xx';

interface SocieteSpec {
  base: Regime;
  statut: LText;
  /** Exemple de forme juridique (placeholder du champ « Forme juridique »). */
  forme: string;
  /** Exemple de registre (placeholder). */
  registre?: string;
  /** Impôt sur les sociétés : taux unique ou tranches annuelles sur le résultat. */
  is: number | Tranche[];
  isLabel?: LText;
  isNote?: LText;
  /** Charges sociales sur la rémunération du dirigeant. */
  charges: { taux?: number; tranches?: Tranche[]; montant?: number; min?: number; label?: LText; note?: LText };
  avertissement?: LText;
  sources?: string[];
}

const IS_LABEL: LText = { fr: 'Impôt sur les sociétés', en: 'Corporate income tax', es: 'Impuesto sobre sociedades', de: 'Körperschaftsteuer', it: 'Imposta sulle società', pt: 'IRC', nl: 'Vennootschapsbelasting' };
const CHARGES_LABEL: LText = {
  fr: 'Charges sociales sur la rémunération du dirigeant',
  en: "Social charges on the director's remuneration",
  es: 'Cotizaciones sobre la retribución del administrador',
  de: 'Sozialabgaben auf die Geschäftsführervergütung',
  it: "Contributi sul compenso dell'amministratore",
  pt: 'Encargos sociais sobre a remuneração do gerente',
  nl: 'Sociale lasten op de bezoldiging van de bestuurder',
};
const REMUNERATION: NonNullable<Regime['remuneration']> = {
  label: {
    fr: 'Rémunération nette mensuelle du dirigeant',
    en: "Director's net monthly remuneration",
    es: 'Retribución neta mensual del administrador',
    de: 'Monatliche Nettovergütung der Geschäftsführung',
    it: "Compenso netto mensile dell'amministratore",
    pt: 'Remuneração líquida mensal do gerente',
    nl: 'Netto maandelijkse bezoldiging van de bestuurder',
  },
  aide: {
    fr: 'Ce que la société vous verse chaque mois. Les charges sociales sont estimées dessus ; le bénéfice restant (recettes − dépenses − rémunération − charges) est soumis à l’impôt sur les sociétés.',
    en: 'What the company pays you each month. Social charges are estimated on it; the remaining profit (receipts − expenses − remuneration − charges) is subject to corporate tax.',
    es: 'Lo que la sociedad le paga cada mes. Las cotizaciones se estiman sobre ese importe; el beneficio restante tributa en el impuesto sobre sociedades.',
    de: 'Was die Gesellschaft Ihnen monatlich zahlt. Darauf werden die Sozialabgaben geschätzt; der verbleibende Gewinn unterliegt der Körperschaftsteuer.',
    it: "Quanto la società le versa ogni mese. I contributi sono stimati su tale importo; l'utile residuo è soggetto all'imposta sulle società.",
    pt: 'O que a sociedade lhe paga mensalmente. Os encargos sociais são estimados sobre esse valor; o lucro restante fica sujeito a IRC.',
    nl: 'Wat de vennootschap u maandelijks betaalt. De sociale lasten worden daarop geraamd; de resterende winst is onderworpen aan de vennootschapsbelasting.',
  },
};
const AVERTISSEMENT: LText = {
  fr: 'Estimation simplifiée : charges sociales sur la rémunération du dirigeant et impôt sur les sociétés sur le bénéfice (recettes encaissées − dépenses − rémunération − charges). Hors dividendes, impôts locaux et comptabilité d’engagement. Vérifiez les taux dans Paramètres → Barème.',
  en: "Simplified estimate: social charges on the director's remuneration and corporate tax on profit (cash receipts − expenses − remuneration − charges). Excludes dividends, local taxes and accrual accounting. Check the rates in Settings → Rates.",
  es: 'Estimación simplificada: cotizaciones sobre la retribución del administrador e impuesto sobre sociedades sobre el beneficio (cobros − gastos − retribución − cotizaciones). Sin dividendos ni impuestos locales. Revise los tipos en Ajustes → Tabla.',
  de: 'Vereinfachte Schätzung: Sozialabgaben auf die Geschäftsführervergütung und Körperschaftsteuer auf den Gewinn (Einnahmen − Ausgaben − Vergütung − Abgaben). Ohne Dividenden, Gemeindesteuern und Periodenabgrenzung. Sätze unter Einstellungen → Sätze prüfen.',
  it: "Stima semplificata: contributi sul compenso dell'amministratore e imposta sulle società sull'utile (incassi − spese − compenso − contributi). Esclusi dividendi, tributi locali e competenza economica. Verificare le aliquote in Impostazioni → Aliquote.",
  pt: 'Estimativa simplificada: encargos sociais sobre a remuneração do gerente e IRC sobre o lucro (recebimentos − despesas − remuneração − encargos). Sem dividendos, impostos locais nem contabilidade de acréscimo. Verifique as taxas em Definições → Tabela.',
  nl: 'Vereenvoudigde raming: sociale lasten op de bezoldiging van de bestuurder en vennootschapsbelasting op de winst (ontvangsten − uitgaven − bezoldiging − lasten). Zonder dividenden, lokale belastingen en toerekening. Controleer de tarieven in Instellingen → Tarieven.',
};
const JOURNAL_VENTES: LText = { fr: 'Journal des ventes', en: 'Sales journal', es: 'Libro de ventas', de: 'Verkaufsjournal', it: 'Registro delle vendite', pt: 'Diário de vendas', nl: 'Verkoopdagboek' };

export function societe(spec: SocieteSpec): Regime {
  const { base } = spec;
  const years = Object.keys(base.params).map(Number).sort((a, b) => b - a);
  const ref = base.params[years[0]];
  const charges: Composante = spec.charges.montant !== undefined
    ? { id: 'charges', categorie: 'social', type: 'fixe_mois', montant: spec.charges.montant, label: spec.charges.label ?? CHARGES_LABEL, note: spec.charges.note }
    : spec.charges.tranches
      ? { id: 'charges', categorie: 'social', type: 'tranches_annuel', base: 'remuneration', tranches: spec.charges.tranches, min: spec.charges.min, label: spec.charges.label ?? CHARGES_LABEL, note: spec.charges.note }
      : { id: 'charges', categorie: 'social', type: 'pct_net', base: 'remuneration', taux: spec.charges.taux ?? 0, min: spec.charges.min, label: spec.charges.label ?? CHARGES_LABEL, note: spec.charges.note };
  const is: Composante = typeof spec.is === 'number'
    ? { id: 'is', categorie: 'impot', type: 'pct_net', base: 'resultat', taux: spec.is, label: spec.isLabel ?? IS_LABEL, note: spec.isNote }
    : { id: 'is', categorie: 'impot', type: 'tranches_annuel', base: 'resultat', tranches: spec.is, label: spec.isLabel ?? IS_LABEL, note: spec.isNote };
  return {
    code: `${base.pays}-SOC`,
    pays: base.pays,
    statutId: 'societe',
    forme: 'societe',
    nom: base.nom,
    drapeau: base.drapeau,
    devise: base.devise,
    langues: base.langues,
    statut: spec.statut,
    remuneration: REMUNERATION,
    activites: ACTIVITES_BASE,
    activiteDefaut: 'services',
    identifiants: [
      { id: 'forme', label: { fr: 'Forme juridique', en: 'Legal form', es: 'Forma jurídica', de: 'Rechtsform', it: 'Forma giuridica', pt: 'Forma jurídica', nl: 'Rechtsvorm' }, placeholder: spec.forme },
      ...base.identifiants,
      { id: 'registre', label: { fr: 'Registre et numéro d’immatriculation', en: 'Register and registration number', es: 'Registro y número de inscripción', de: 'Register und Registernummer', it: 'Registro e numero di iscrizione', pt: 'Registo e número de matrícula', nl: 'Register en inschrijvingsnummer' }, placeholder: spec.registre },
      { id: 'capital', label: { fr: 'Capital social', en: 'Share capital', es: 'Capital social', de: 'Stammkapital', it: 'Capitale sociale', pt: 'Capital social', nl: 'Maatschappelijk kapitaal' }, placeholder: `10 000 ${base.devise}` },
    ],
    identifiantClient: base.identifiantClient,
    tva: { ...base.tva, periodicites: ['mensuelle', 'trimestrielle', 'annuelle'], periodiciteDefaut: 'trimestrielle' },
    mentions: {
      retard: base.mentions.retard,
      pied: {
        fr: '{forme} au capital de {capital} — {registre}',
        en: '{forme} with a share capital of {capital} — {registre}',
        es: '{forme} con un capital social de {capital} — {registre}',
        de: '{forme} mit einem Stammkapital von {capital} — {registre}',
        it: '{forme} con capitale sociale di {capital} — {registre}',
        pt: '{forme} com o capital social de {capital} — {registre}',
        nl: '{forme} met een maatschappelijk kapitaal van {capital} — {registre}',
      },
    },
    periodicites: ['mensuelle', 'trimestrielle', 'annuelle'],
    periodiciteDefaut: 'trimestrielle',
    echeance: base.echeance,
    options: {},
    params: {
      0: {
        seuils: structuredClone(ref.seuils.filter((s) => s.kind === 'tva')),
        tvaTaux: [...ref.tvaTaux],
        tvaDefaut: ref.tvaDefaut,
        coefficientNet: 1,
        baseRevenu: 'reel',
        composantes: [charges, is],
      },
    },
    livreRecettes: JOURNAL_VENTES,
    avertissement: spec.avertissement ?? AVERTISSEMENT,
    sources: spec.sources ?? base.sources,
  };
}

const N = (fr: string, en: string): LText => ({ fr, en });

export const SOCIETES: Regime[] = [
  societe({
    base: be,
    statut: { fr: 'Société (SRL, SA) — dirigeant d’entreprise indépendant', en: 'Company (SRL/BV, SA/NV) — self-employed company director', nl: 'Vennootschap (BV, NV) — zelfstandige bedrijfsleider', de: 'Gesellschaft (SRL, SA) — selbständiger Geschäftsführer' },
    forme: 'SRL',
    registre: 'RPM Bruxelles',
    is: [{ jusqua: 100_000, taux: 20 }, { jusqua: null, taux: 25 }],
    isNote: N('Taux réduit de 20 % sur les 100 000 premiers euros pour les PME (rémunération du dirigeant d’au moins 45 000 € ou égale au résultat), 25 % au-delà.', 'Reduced 20% rate on the first €100,000 for SMEs (director remuneration of at least €45,000 or equal to the result), 25% above.'),
    charges: { tranches: [{ jusqua: 76_235, taux: 20.5 }, { jusqua: 112_350, taux: 14.16 }, { jusqua: null, taux: 0 }], min: 3_600, note: N('Cotisations INASTI du dirigeant indépendant sur sa rémunération ; minimum légal appliqué.', 'NISSE contributions of the self-employed director on remuneration; legal minimum applied.') },
    sources: ['https://www.inasti.be', 'https://finances.belgium.be/fr/entreprises/impot_des_societes'],
  }),
  societe({
    base: ch,
    statut: { fr: 'Société (Sàrl, SA) — dirigeant salarié', en: 'Company (Sàrl/GmbH, SA/AG) — salaried director', de: 'Gesellschaft (GmbH, AG) — angestellte Geschäftsführung', it: 'Società (Sagl, SA) — dirigente salariato' },
    forme: 'Sàrl',
    registre: 'IDE CHE-123.456.789',
    is: 15,
    isNote: N('Impôt fédéral direct (8,5 % du bénéfice après impôt, soit ≈ 7,8 %) plus impôts cantonal et communal : ≈ 12 à 21 % selon le canton. Taux moyen retenu : 15 %.', 'Direct federal tax (8.5% of after-tax profit, ≈ 7.8%) plus cantonal and communal taxes: ≈ 12–21% depending on the canton. Average rate used: 15%.'),
    charges: { taux: 22, note: N('AVS/AI/APG (10,6 %), AC (2,2 %), LPP, LAA et allocations familiales, parts employeur et salarié, exprimées en pourcentage du net versé (≈ 22 %).', 'OASI/DI/APG (10.6%), unemployment (2.2%), occupational pension, accident insurance and family allowances, employer and employee shares, as a percentage of net pay (≈ 22%).') },
    sources: ['https://www.ahv-iv.ch', 'https://www.estv.admin.ch'],
  }),
  societe({
    base: lu,
    statut: { fr: 'Société (SARL, SARL-S, SA) — dirigeant', en: 'Company (SARL, SARL-S, SA) — director', de: 'Gesellschaft (SARL, SARL-S, SA) — Geschäftsführung' },
    forme: 'SARL-S',
    registre: 'RCS Luxembourg B 123456',
    is: 24.94,
    isNote: N('Impôt sur le revenu des collectivités 17 % (16 % sous 175 000 €) + fonds pour l’emploi 7 % + impôt commercial communal (Luxembourg-Ville 6,75 %) ≈ 24,94 %.', 'Corporate income tax 17% (16% below €175,000) + employment fund 7% + municipal business tax (Luxembourg City 6.75%) ≈ 24.94%.'),
    charges: { taux: 25, note: N('Cotisations CCSS (pension, maladie, dépendance, accident, mutualité), parts salariale et patronale, ≈ 25 % du net.', 'CCSS contributions (pension, health, dependency, accident, mutual insurance), employee and employer shares, ≈ 25% of net.') },
    sources: ['https://www.ccss.lu', 'https://impotsdirects.public.lu'],
  }),
  societe({
    base: de,
    statut: { fr: 'Société de capitaux (GmbH, UG) — gérant', en: 'Corporation (GmbH, UG) — managing director', de: 'Kapitalgesellschaft (GmbH, UG) — Geschäftsführung' },
    forme: 'GmbH',
    registre: 'HRB 12345, Amtsgericht München',
    is: 30,
    isNote: N('Körperschaftsteuer 15 % + Solidaritätszuschlag 5,5 % de la KSt + Gewerbesteuer (3,5 % × taux communal, ≈ 14 %) ≈ 30 % du bénéfice.', 'Corporate tax 15% + solidarity surcharge 5.5% of corporate tax + trade tax (3.5% × municipal multiplier, ≈ 14%) ≈ 30% of profit.'),
    charges: { taux: 20, note: N('Un gérant associé majoritaire n’est généralement pas soumis à l’assurance sociale obligatoire : estimation de 20 % du net pour l’assurance maladie et la prévoyance privées. Gérant minoritaire ou salarié : ≈ 40 %.', 'A controlling shareholder-manager is usually exempt from statutory social insurance: 20% of net assumed for private health and pension cover. Minority or employed managers: ≈ 40%.') },
    sources: ['https://www.bundesfinanzministerium.de', 'https://www.deutsche-rentenversicherung.de'],
  }),
  societe({
    base: at,
    statut: { fr: 'GmbH / FlexKapG — gérant', en: 'GmbH / FlexKapG — managing director', de: 'GmbH / FlexKapG — Geschäftsführung' },
    forme: 'GmbH',
    registre: 'FN 123456a, Handelsgericht Wien',
    is: 23,
    isNote: N('Körperschaftsteuer 23 % (depuis 2024) ; impôt minimum annuel de 500 € pour une GmbH.', 'Corporate tax 23% (since 2024); minimum annual tax of €500 for a GmbH.'),
    charges: { taux: 27, note: N('Gérant associé majoritaire assuré selon la GSVG : ≈ 27 % de la rémunération (pension 18,5 %, maladie 6,8 %, accident, prévoyance), jusqu’au plafond.', 'Controlling managing director insured under the GSVG: ≈ 27% of remuneration (pension 18.5%, health 6.8%, accident, provision), up to the ceiling.') },
    sources: ['https://www.svs.at', 'https://www.bmf.gv.at'],
  }),
  societe({
    base: nl,
    statut: { fr: 'BV — directeur-grand actionnaire (DGA)', en: 'BV — director-major shareholder (DGA)', nl: 'BV — directeur-grootaandeelhouder (DGA)' },
    forme: 'B.V.',
    registre: 'KvK 12345678',
    is: [{ jusqua: 200_000, taux: 19 }, { jusqua: null, taux: 25.8 }],
    isNote: N('Vennootschapsbelasting : 19 % jusqu’à 200 000 €, 25,8 % au-delà.', 'Corporate tax: 19% up to €200,000, 25.8% above.'),
    charges: { taux: 6, note: N('Le DGA ne relève pas des assurances salariés : seule la contribution Zvw (≈ 5,3 %) et une prévoyance minimale sont retenues (≈ 6 % du net). Salaire minimum d’usage (gebruikelijk loon) ≈ 56 000 €/an. L’impôt sur le salaire (loonheffing) n’est pas inclus.', 'The DGA is not covered by employee insurance: only the Zvw contribution (≈ 5.3%) and minimal provision are retained (≈ 6% of net). Customary minimum salary ≈ €56,000/yr. Payroll income tax (loonheffing) is not included.') },
    sources: ['https://www.belastingdienst.nl'],
  }),
  societe({
    base: es,
    statut: { fr: 'Société (SL) — administrateur', en: 'Company (SL) — administrator', es: 'Sociedad (SL) — administrador' },
    forme: 'S.L.',
    registre: 'Registro Mercantil de Madrid, tomo 1234',
    is: 25,
    isNote: N('Impuesto sobre Sociedades : 25 % (23 % si le chiffre d’affaires est inférieur à 1 M€, 15 % les deux premiers exercices bénéficiaires pour les sociétés nouvelles).', 'Corporate tax: 25% (23% if turnover is below €1M, 15% for the first two profitable years of new companies).'),
    charges: { montant: 350, note: N('Autónomo societario : cotisation RETA minimale (≈ 350 €/mois en 2026), quelle que soit la rémunération ; retenue IRPF sur la rémunération non incluse.', 'Company-director self-employed (autónomo societario): minimum RETA contribution (≈ €350/month in 2026) regardless of remuneration; IRPF withholding on remuneration not included.') },
    sources: ['https://www.seg-social.es', 'https://sede.agenciatributaria.gob.es'],
  }),
  societe({
    base: it,
    statut: { fr: 'Société (SRL) — administrateur', en: 'Company (SRL) — director', it: 'Società (SRL) — amministratore' },
    forme: 'S.r.l.',
    registre: 'REA MI-1234567',
    is: 27.9,
    isNote: N('IRES 24 % + IRAP 3,9 % (taux ordinaire, variable selon la région) ≈ 27,9 % du résultat.', 'IRES 24% + IRAP 3.9% (standard rate, varies by region) ≈ 27.9% of the result.'),
    charges: { taux: 26, note: N('Compenso amministratore : INPS gestione separata (≈ 26 %, dont un tiers à la charge de l’administrateur) ; commerçants/artisans ≈ 24,5 % sur le minimal.', 'Director fees: INPS separate scheme (≈ 26%, one third borne by the director); traders/craftspeople ≈ 24.5% on the minimum base.') },
    sources: ['https://www.inps.it', 'https://www.agenziaentrate.gov.it'],
  }),
  societe({
    base: pt,
    statut: { fr: 'Société (Lda, unipessoal) — gérant', en: 'Company (Lda, unipessoal) — manager', pt: 'Sociedade (Lda, unipessoal) — gerente' },
    forme: 'Lda',
    registre: 'Conservatória do Registo Comercial de Lisboa, NIPC 512345678',
    is: [{ jusqua: 50_000, taux: 17.5 }, { jusqua: null, taux: 21.5 }],
    isNote: N('IRC 20 % (16 % sur les 50 000 premiers euros pour les PME) + derrama municipal jusqu’à 1,5 %.', 'IRC 20% (16% on the first €50,000 for SMEs) + municipal surcharge up to 1.5%.'),
    charges: { taux: 34.75, note: N('Taxa social única du gérant : 23,75 % (employeur) + 11 % (gérant) de la rémunération ; base minimale égale à l’IAS.', 'Single social tax for managers: 23.75% (employer) + 11% (manager) of remuneration; minimum base equal to the IAS.') },
    sources: ['https://www.seg-social.pt', 'https://info.portaldasfinancas.gov.pt'],
  }),
  societe({
    base: ie,
    statut: { fr: 'Limited company — directeur', en: 'Limited company — director' },
    forme: 'Ltd',
    registre: 'CRO 123456',
    is: 12.5,
    isNote: N('Corporation tax : 12,5 % sur les bénéfices commerciaux (25 % sur les revenus passifs).', 'Corporation tax: 12.5% on trading profits (25% on passive income).'),
    charges: { taux: 4.2, note: N('Proprietary director : PRSI classe S 4,2 % de la rémunération (pas de PRSI employeur) ; USC et impôt sur le revenu non inclus.', 'Proprietary director: PRSI class S at 4.2% of remuneration (no employer PRSI); USC and income tax not included.') },
    sources: ['https://www.revenue.ie', 'https://www.gov.ie/prsi'],
  }),
  societe({
    base: gb,
    statut: { fr: 'Limited company — directeur', en: 'Limited company — director' },
    forme: 'Ltd',
    registre: 'Companies House 12345678',
    is: [{ jusqua: 50_000, taux: 19 }, { jusqua: 250_000, taux: 26.5 }, { jusqua: null, taux: 25 }],
    isNote: N('Corporation tax : 19 % jusqu’à 50 000 £, 25 % au-delà de 250 000 £, taux marginal de 26,5 % entre les deux (marginal relief).', 'Corporation tax: 19% up to £50,000, 25% above £250,000, 26.5% marginal rate in between (marginal relief).'),
    charges: { tranches: [{ jusqua: 5_000, taux: 0 }, { jusqua: 12_570, taux: 15 }, { jusqua: 50_270, taux: 23 }, { jusqua: null, taux: 17 }], note: N('National Insurance sur le salaire du directeur : employeur 15 % au-dessus de 5 000 £, salarié 8 % entre 12 570 et 50 270 £ puis 2 %. Income tax non inclus.', "National Insurance on the director's salary: employer 15% above £5,000, employee 8% between £12,570 and £50,270 then 2%. Income tax not included.") },
    sources: ['https://www.gov.uk/corporation-tax-rates', 'https://www.gov.uk/national-insurance-rates-letters'],
  }),
  societe({
    base: ca,
    statut: { fr: 'Société par actions (inc.) — dirigeant', en: 'Corporation (Inc.) — director' },
    forme: 'Inc.',
    registre: 'NEQ 1234567890',
    is: [{ jusqua: 500_000, taux: 12.2 }, { jusqua: null, taux: 26.5 }],
    isNote: N('Déduction pour petite entreprise : ≈ 9 % fédéral + ≈ 3,2 % provincial jusqu’à 500 000 $ de revenu actif ; ≈ 26,5 % au-delà (variable selon la province).', 'Small business deduction: ≈ 9% federal + ≈ 3.2% provincial up to $500,000 of active income; ≈ 26.5% above (varies by province).'),
    charges: { tranches: [{ jusqua: 71_300, taux: 11.9 }, { jusqua: 81_200, taux: 8 }, { jusqua: null, taux: 0 }], note: N('RPC/RRQ parts employeur et employé (≈ 11,9 % jusqu’au maximum, RPC2 8 % jusqu’au second plafond) ; assurance-emploi non due pour un actionnaire de contrôle.', 'CPP/QPP employer and employee shares (≈ 11.9% up to the maximum, CPP2 8% up to the second ceiling); EI not payable for a controlling shareholder.') },
    sources: ['https://www.canada.ca/fr/agence-revenu', 'https://www.revenuquebec.ca'],
  }),
  societe({
    base: us,
    statut: { fr: 'Corporation / LLC imposée comme société — dirigeant', en: 'Corporation / LLC taxed as a corporation — officer' },
    forme: 'LLC',
    registre: 'Delaware file no. 1234567 · EIN 12-3456789',
    is: 27,
    isNote: N('Impôt fédéral sur les sociétés 21 % + impôt d’État (0 à 11,5 %, ≈ 6 % en moyenne) ≈ 27 %. Les LLC et S-corporations transparentes sont imposées chez l’associé.', 'Federal corporate tax 21% + state tax (0–11.5%, ≈ 6% average) ≈ 27%. Pass-through LLCs and S-corporations are taxed at the owner level.'),
    charges: { tranches: [{ jusqua: 176_100, taux: 15.3 }, { jusqua: null, taux: 2.9 }], note: N('FICA parts employeur et salarié : 12,4 % Social Security jusqu’au plafond + 2,9 % Medicare ; impôt fédéral et d’État sur le salaire non inclus.', 'Employer and employee FICA: 12.4% Social Security up to the wage base + 2.9% Medicare; federal and state income tax on wages not included.') },
    sources: ['https://www.irs.gov/businesses/corporations', 'https://www.ssa.gov/oact/cola/cbb.html'],
  }),
  societe({
    base: ma,
    statut: { fr: 'Société (SARL, SARL AU) — gérant', en: 'Company (SARL, SARL AU) — manager' },
    forme: 'SARL AU',
    registre: 'RC Casablanca 123456 · ICE 001234567000012',
    is: 20,
    isNote: N('Impôt sur les sociétés : taux cible unifié de 20 % en 2026 (35 % au-delà de 100 M MAD de bénéfice) ; cotisation minimale de 0,25 % du CA.', 'Corporate tax: unified target rate of 20% in 2026 (35% above MAD 100M of profit); minimum contribution of 0.25% of turnover.'),
    charges: { taux: 26, note: N('CNSS parts patronale (≈ 21 %) et salariale (≈ 6,7 %) y compris AMO, avec plafond de 6 000 MAD/mois pour les prestations sociales ; estimation ≈ 26 % du net.', 'CNSS employer (≈ 21%) and employee (≈ 6.7%) shares including AMO, with a MAD 6,000/month ceiling for social benefits; estimate ≈ 26% of net.') },
    sources: ['https://www.cnss.ma', 'https://www.tax.gov.ma'],
  }),
  societe({
    base: xx,
    statut: { fr: 'Société — dirigeant rémunéré (paramétrable)', en: 'Company — paid director (configurable)', es: 'Sociedad — administrador retribuido (configurable)', de: 'Gesellschaft — vergütete Geschäftsführung (konfigurierbar)', it: 'Società — amministratore retribuito (configurabile)', pt: 'Sociedade — gerente remunerado (configurável)', nl: 'Vennootschap — bezoldigde bestuurder (instelbaar)' },
    forme: 'Ltd',
    is: 25,
    charges: { taux: 30 },
    sources: [],
  }),
];
