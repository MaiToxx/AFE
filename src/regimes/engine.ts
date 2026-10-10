// Moteur de calcul des prélèvements, indépendant du pays : périodes de déclaration,
// composantes (pourcentage du CA ou du revenu, forfaits, tranches) et seuils.
import type { Profile } from '../db/types';
import { getLang, tIn, type Lang } from '../i18n';
import { addDays, addMonths, endOfMonth, monthOf, shiftMonth, startOfMonth, yearOf } from '../lib/dates';
import { moisLong } from '../lib/format';
import type { Activite, Composante, Frequence, Groupe, RegimeParams, Regime, RegleEcheance, Seuil } from './types';

/** Période de déclaration. */
export interface Period {
  key: string;
  label: string;
  court: string;
  annee: number;
  start: string;
  end: string;
  echeance: string;
  mois: number;
}

function echeanceDe(end: string, regle: RegleEcheance): string {
  if (regle.type === 'fin_mois_suivant') {
    const next = shiftMonth(yearOf(end), monthOf(end), 1);
    return endOfMonth(next.annee, next.mois);
  }
  return addDays(end, regle.jours);
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function periodsOfYear(annee: number, frequence: Frequence, regle: RegleEcheance, lang: Lang = getLang()): Period[] {
  if (frequence === 'mensuelle') {
    return Array.from({ length: 12 }, (_, i) => {
      const m = i + 1;
      const end = endOfMonth(annee, m);
      return {
        key: `${annee}-M${String(m).padStart(2, '0')}`,
        label: `${cap(moisLong(m))} ${annee}`,
        court: moisLong(m),
        annee,
        start: startOfMonth(annee, m),
        end,
        echeance: echeanceDe(end, regle),
        mois: 1,
      };
    });
  }
  if (frequence === 'trimestrielle') {
    return [1, 2, 3, 4].map((q) => {
      const m1 = (q - 1) * 3 + 1;
      const end = endOfMonth(annee, m1 + 2);
      return {
        key: `${annee}-T${q}`,
        label: tIn(lang, `period.quarter.${q}`, { annee }),
        court: tIn(lang, 'period.quarterShort', { n: q }),
        annee,
        start: startOfMonth(annee, m1),
        end,
        echeance: echeanceDe(end, regle),
        mois: 3,
      };
    });
  }
  const end = endOfMonth(annee, 12);
  return [{ key: `${annee}-A`, label: tIn(lang, 'period.year', { annee }), court: String(annee), annee, start: startOfMonth(annee, 1), end, echeance: echeanceDe(end, regle), mois: 12 }];
}

export function periodOf(iso: string, frequence: Frequence, regle: RegleEcheance): Period {
  const periods = periodsOfYear(yearOf(iso), frequence, regle);
  return periods.find((p) => iso >= p.start && iso <= p.end) ?? periods[0];
}

/** Paramètres applicables à une année : surcharge utilisateur, sinon préréglage (année exacte ou plus proche antérieure). */
export function paramsFor(regime: Regime, overrides: Record<number, RegimeParams>, annee: number): { params: RegimeParams; annee: number; surcharge: boolean } {
  const annuel = !(0 in regime.params);
  const cle = annuel ? annee : 0;
  if (overrides[cle]) return { params: overrides[cle], annee: cle, surcharge: true };
  if (!annuel) return { params: regime.params[0], annee: 0, surcharge: false };
  const years = Object.keys(regime.params).map(Number).sort((a, b) => a - b);
  const exact = years.includes(annee) ? annee : [...years].reverse().find((y) => y < annee) ?? years[0];
  // Surcharge d'une année antérieure ? Non : les surcharges sont propres à leur année.
  return { params: regime.params[exact], annee: exact, surcharge: false };
}

export function activiteOf(regime: Regime, id: string): Activite {
  return regime.activites.find((a) => a.id === id) ?? regime.activites.find((a) => a.id === regime.activiteDefaut) ?? regime.activites[0];
}

export function groupeOf(regime: Regime, id: string): Groupe {
  return activiteOf(regime, id).groupe;
}

export function groupeTvaOf(regime: Regime, id: string): Groupe {
  const a = activiteOf(regime, id);
  return a.groupeTva ?? a.groupe;
}

export function coefficientNet(params: RegimeParams, activite: string): number {
  const c = params.coefficientNet;
  if (typeof c === 'number') return c;
  return c[activite] ?? 1;
}

/** Fin de la réduction de début d'activité pour une composante. */
export function finReduction(dateDebut: string, red: NonNullable<Composante['reductionDebut']>): string {
  if (red.alignTrimestre) {
    // France (ACRE) : jusqu'à la fin du 3e trimestre civil suivant celui du début d'activité.
    const y = yearOf(dateDebut);
    const q = Math.ceil(monthOf(dateDebut) / 3);
    const trimestres = Math.round(red.mois / 3) - 1;
    const absQ = y * 4 + (q - 1) + trimestres;
    return endOfMonth(Math.floor(absQ / 4), ((absQ % 4) + 1) * 3);
  }
  return addDays(addMonths(dateDebut, red.mois), -1);
}

export function reductionActive(profile: Pick<Profile, 'acre' | 'dateDebutActivite'>, red: Composante['reductionDebut'], periodEnd: string): boolean {
  if (!red || !profile.acre || !profile.dateDebutActivite) return false;
  return periodEnd >= profile.dateDebutActivite && periodEnd <= finReduction(profile.dateDebutActivite, red);
}

/** La composante s'applique-t-elle à ce profil ? */
export function composanteActive(c: Composante, profile: Profile): boolean {
  if (c.natures && !c.natures.includes(profile.nature)) return false;
  if (c.option === 'vl' && !profile.versementLiberatoire) return false;
  if (c.option === 'acre' && !profile.acre) return false;
  if (c.option === 'doubleImmatriculation' && !profile.doubleImmatriculation) return false;
  if (c.optionnel) {
    const v = profile.optionsRegime?.[c.id];
    return v === undefined ? !!c.activeParDefaut : v;
  }
  return true;
}

export interface CalcOptions {
  regime: Regime;
  params: RegimeParams;
  profile: Profile;
  /** Fin de la période (pour la réduction de début d'activité). */
  periodEnd: string;
  /** Nombre de mois couverts (1, 3 ou 12). */
  mois: number;
}

export interface CalcLigne {
  composante: Composante;
  /** Base de calcul (CA ou revenu net) utilisée. */
  base: number;
  /** Taux affiché (%), si pertinent. */
  taux?: number;
  montant: number;
  reduit: boolean;
}

export interface Calcul {
  ca: number;
  net: number;
  lignes: CalcLigne[];
  social: number;
  impot: number;
  autre: number;
  total: number;
  reste: number;
  tauxEffectif: number;
  reduit: boolean;
}

function tauxPour(c: Composante, regime: Regime, activite: string, profile: Profile): number {
  if (c.tauxParActivite && c.tauxParActivite[activite] !== undefined) return c.tauxParActivite[activite];
  if (c.tauxParGroupeTva) {
    const g = c.tauxParGroupeTva[groupeTvaOf(regime, activite)];
    if (g !== undefined) return g;
  }
  if (c.tauxParNature) {
    const n = c.tauxParNature[profile.nature];
    if (n !== undefined) return n;
  }
  return c.taux ?? 0;
}

function progressif(base: number, tranches: Composante['tranches']): number {
  let total = 0;
  let prec = 0;
  for (const tr of tranches ?? []) {
    const haut = tr.jusqua ?? Infinity;
    if (base > prec) total += (Math.min(base, haut) - prec) * ((tr.taux ?? 0) / 100);
    if (base <= haut) break;
    prec = haut;
  }
  return total;
}

/** Calcule les prélèvements d'une période à partir du CA encaissé par activité. */
export function calculer(caParActivite: Record<string, number>, o: CalcOptions): Calcul {
  const { regime, params, profile, mois } = o;
  const entries = Object.entries(caParActivite).filter(([, v]) => v > 0);
  const ca = entries.reduce((s, [, v]) => s + v, 0);
  const net = entries.reduce((s, [a, v]) => s + v * coefficientNet(params, a), 0);
  const lignes: CalcLigne[] = [];
  let reduit = false;

  for (const c of params.composantes) {
    if (!composanteActive(c, profile)) continue;
    let montant = 0;
    let base = 0;
    let taux: number | undefined;
    switch (c.type) {
      case 'pct_ca': {
        base = ca;
        let somme = 0;
        for (const [a, v] of entries) somme += (v * tauxPour(c, regime, a, profile)) / 100;
        montant = somme;
        taux = ca > 0 ? (somme / ca) * 100 : tauxPour(c, regime, profile.activite, profile);
        break;
      }
      case 'pct_net': {
        let b = net;
        if (c.baseMax !== undefined) b = Math.min(b, (c.baseMax * mois) / 12);
        base = b;
        taux = c.taux ?? 0;
        montant = (b * taux) / 100;
        break;
      }
      case 'fixe_mois':
        base = 0;
        montant = (c.montant ?? 0) * mois;
        break;
      case 'tranches_mois': {
        const mensuel = mois > 0 ? net / mois : net;
        base = mensuel;
        const tr = (c.tranches ?? []).find((x) => x.jusqua === null || mensuel <= x.jusqua) ?? (c.tranches ?? [])[(c.tranches ?? []).length - 1];
        montant = (tr?.montant ?? 0) * mois;
        break;
      }
      case 'tranches_annuel': {
        const annuel = mois > 0 ? (net * 12) / mois : net;
        base = annuel;
        montant = (progressif(annuel, c.tranches) * mois) / 12;
        taux = annuel > 0 ? (progressif(annuel, c.tranches) / annuel) * 100 : undefined;
        break;
      }
    }
    if (c.min !== undefined) montant = Math.max(montant, (c.min * mois) / 12);
    if (c.max !== undefined) montant = Math.min(montant, (c.max * mois) / 12);
    let r = false;
    if (c.reductionDebut && reductionActive(profile, c.reductionDebut, o.periodEnd)) {
      montant *= c.reductionDebut.facteur;
      if (taux !== undefined) taux *= c.reductionDebut.facteur;
      r = true;
      reduit = true;
    }
    if (montant === 0 && c.type !== 'fixe_mois' && ca === 0) continue;
    lignes.push({ composante: c, base, taux, montant, reduit: r });
  }

  const somme = (cat: Composante['categorie']) => lignes.filter((l) => l.composante.categorie === cat).reduce((s, l) => s + l.montant, 0);
  const social = somme('social');
  const impot = somme('impot');
  const autre = somme('autre');
  const total = social + impot + autre;
  return { ca, net, lignes, social, impot, autre, total, reste: ca - total, tauxEffectif: ca > 0 ? (total / ca) * 100 : 0, reduit };
}

/** Seuils applicables au profil, avec le CA annuel qui leur correspond. */
export function seuilsApplicables(regime: Regime, params: RegimeParams, profile: Profile, caParActivite: Record<string, number>): { seuil: Seuil; valeur: number }[] {
  const out: { seuil: Seuil; valeur: number }[] = [];
  for (const s of params.seuils) {
    if (s.kind === 'tva' && (profile.assujettiTVA || !regime.tva.franchisePossible)) continue;
    let valeur = 0;
    for (const [a, v] of Object.entries(caParActivite)) {
      const g = s.kind === 'tva' ? groupeTvaOf(regime, a) : groupeOf(regime, a);
      if (s.groupe === 'tous' || s.groupe === g) valeur += v;
    }
    // Un seuil de groupe ne s'affiche que s'il concerne l'activité principale ou un CA existant.
    const gPrincipal = s.kind === 'tva' ? groupeTvaOf(regime, profile.activite) : groupeOf(regime, profile.activite);
    if (s.groupe !== 'tous' && s.groupe !== gPrincipal && valeur === 0) continue;
    out.push({ seuil: s, valeur });
  }
  return out;
}
