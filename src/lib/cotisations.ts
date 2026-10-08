import type { ActivityKind, Bareme, Frequence, Nature, Profile } from '../db/types';
import { isTVAVente, isVente } from '../db/types';
import { endOfMonth, monthOf, shiftMonth, startOfMonth, yearOf } from './dates';
import { MOIS_LONG } from './format';

/** Période de déclaration URSSAF (mois ou trimestre civil). */
export interface Period {
  key: string;
  label: string;
  court: string;
  annee: number;
  start: string;
  end: string;
  /** Date limite de déclaration et de paiement. */
  echeance: string;
}

const ORDINAUX = ['1er', '2e', '3e', '4e'];

export function periodsOfYear(annee: number, frequence: Frequence): Period[] {
  if (frequence === 'mensuelle') {
    return Array.from({ length: 12 }, (_, i) => {
      const m = i + 1;
      const next = shiftMonth(annee, m, 1);
      return {
        key: `${annee}-M${String(m).padStart(2, '0')}`,
        label: `${MOIS_LONG[i].charAt(0).toUpperCase()}${MOIS_LONG[i].slice(1)} ${annee}`,
        court: MOIS_LONG[i],
        annee,
        start: startOfMonth(annee, m),
        end: endOfMonth(annee, m),
        echeance: endOfMonth(next.annee, next.mois),
      };
    });
  }
  return [1, 2, 3, 4].map((q) => {
    const m1 = (q - 1) * 3 + 1;
    const m3 = m1 + 2;
    const next = shiftMonth(annee, m3, 1);
    return {
      key: `${annee}-T${q}`,
      label: `${ORDINAUX[q - 1]} trimestre ${annee}`,
      court: `T${q}`,
      annee,
      start: startOfMonth(annee, m1),
      end: endOfMonth(annee, m3),
      echeance: endOfMonth(next.annee, next.mois),
    };
  });
}

export function periodOf(iso: string, frequence: Frequence): Period {
  const periods = periodsOfYear(yearOf(iso), frequence);
  return periods.find((p) => iso >= p.start && iso <= p.end) ?? periods[0];
}

/**
 * Fin de l'ACRE : l'exonération court jusqu'à la fin du 3e trimestre civil
 * qui suit celui du début d'activité (soit 4 trimestres au total).
 */
export function acreEnd(dateDebut: string): string {
  const y = yearOf(dateDebut);
  const q = Math.ceil(monthOf(dateDebut) / 3);
  const absQ = y * 4 + (q - 1) + 3;
  const ey = Math.floor(absQ / 4);
  const endMonth = ((absQ % 4) + 1) * 3;
  return endOfMonth(ey, endMonth);
}

/** L'ACRE s'applique-t-elle à la période se terminant à `periodEnd` ? */
export function acreActive(
  profile: Pick<Profile, 'acre' | 'dateDebutActivite'>,
  periodEnd: string,
): boolean {
  if (!profile.acre || !profile.dateDebutActivite) return false;
  return periodEnd >= profile.dateDebutActivite && periodEnd <= acreEnd(profile.dateDebutActivite);
}

export interface CalcOptions {
  bareme: Bareme;
  nature: Nature;
  doubleImmatriculation: boolean;
  acre: boolean;
  versementLiberatoire: boolean;
}

export interface CalcLigne {
  activite: ActivityKind;
  ca: number;
  tauxCotisations: number;
  cotisations: number;
  vl: number;
  cfp: number;
  chambre: number;
}

export interface Calcul {
  ca: number;
  cotisations: number;
  cfp: number;
  chambre: number;
  vl: number;
  total: number;
  net: number;
  tauxEffectif: number;
  acre: boolean;
  lignes: CalcLigne[];
}

export function tauxChambre(a: ActivityKind, o: Pick<CalcOptions, 'bareme' | 'nature' | 'doubleImmatriculation'>): number {
  const vente = isTVAVente(a);
  const c = o.bareme.chambre;
  if (o.nature === 'commercant') return vente ? c.cciVente : c.cciServices;
  if (o.nature === 'artisan') {
    return (vente ? c.cmaVente : c.cmaServices) + (o.doubleImmatriculation ? c.doubleImmatriculation : 0);
  }
  return 0;
}

export function tauxCotisations(a: ActivityKind, o: Pick<CalcOptions, 'bareme' | 'acre'>): number {
  const base = o.bareme.cotisations[a];
  return o.acre ? base * (1 - o.bareme.acreReduction / 100) : base;
}

/** Taux global prélevé par l'URSSAF (cotisations + CFP + chambre + VL éventuel). */
export function tauxGlobal(a: ActivityKind, o: CalcOptions): number {
  return (
    tauxCotisations(a, o) +
    o.bareme.cfp[o.nature] +
    tauxChambre(a, o) +
    (o.versementLiberatoire ? o.bareme.versementLiberatoire[a] : 0)
  );
}

/** Calcule les prélèvements dus sur un CA encaissé, ventilé par activité. */
export function calculer(ca: Partial<Record<ActivityKind, number>>, o: CalcOptions): Calcul {
  const lignes: CalcLigne[] = [];
  for (const [act, montant] of Object.entries(ca) as [ActivityKind, number | undefined][]) {
    if (!montant) continue;
    const taux = tauxCotisations(act, o);
    lignes.push({
      activite: act,
      ca: montant,
      tauxCotisations: taux,
      cotisations: (montant * taux) / 100,
      vl: o.versementLiberatoire ? (montant * o.bareme.versementLiberatoire[act]) / 100 : 0,
      cfp: (montant * o.bareme.cfp[o.nature]) / 100,
      chambre: (montant * tauxChambre(act, o)) / 100,
    });
  }
  const sum = (f: (l: CalcLigne) => number) => lignes.reduce((s, l) => s + f(l), 0);
  const total = sum((l) => l.cotisations + l.vl + l.cfp + l.chambre);
  const caTotal = sum((l) => l.ca);
  return {
    ca: caTotal,
    cotisations: sum((l) => l.cotisations),
    cfp: sum((l) => l.cfp),
    chambre: sum((l) => l.chambre),
    vl: sum((l) => l.vl),
    total,
    net: caTotal - total,
    tauxEffectif: caTotal ? (total / caTotal) * 100 : 0,
    acre: o.acre,
    lignes,
  };
}

export function plafondFor(a: ActivityKind, b: Bareme): number {
  return isVente(a) ? b.plafondCA.vente : b.plafondCA.services;
}

export function franchiseFor(a: ActivityKind, b: Bareme): { base: number; majore: number } {
  return isTVAVente(a)
    ? { base: b.franchiseTVA.venteBase, majore: b.franchiseTVA.venteMajore }
    : { base: b.franchiseTVA.servicesBase, majore: b.franchiseTVA.servicesMajore };
}
