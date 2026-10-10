import type { Doc, Paiement, Profile } from '../db/types';
import { calculer, paramsFor, periodsOfYear, type Calcul, type Period } from '../regimes/engine';
import type { Regime, RegimeParams } from '../regimes/types';
import { monthOf, yearOf } from './dates';

/**
 * Montant HT d'un encaissement : un paiement sur facture est ramené au prorata HT/TTC
 * de la facture ; un encaissement libre est saisi HT.
 */
export function caHT(p: Paiement, docsById: Map<number, Doc>): number {
  if (p.factureId) {
    const d = docsById.get(p.factureId);
    if (d && d.totalTTC > 0) return (p.montant * d.totalHT) / d.totalTTC;
  }
  return p.montant;
}

export function encaissementsParMois(paiements: Paiement[], docsById: Map<number, Doc>, annee: number): number[] {
  const out = Array(12).fill(0) as number[];
  for (const p of paiements) {
    if (yearOf(p.date) !== annee) continue;
    out[monthOf(p.date) - 1] += caHT(p, docsById);
  }
  return out;
}

export function factureParMois(docs: Doc[], annee: number): number[] {
  const out = Array(12).fill(0) as number[];
  for (const d of docs) {
    if (d.type === 'devis' || d.statut === 'brouillon' || d.statut === 'annulee') continue;
    if (yearOf(d.dateEmission) !== annee) continue;
    // Les avoirs viennent en déduction du CA facturé.
    out[monthOf(d.dateEmission) - 1] += d.type === 'avoir' ? -d.totalHT : d.totalHT;
  }
  return out;
}

export function caParActivite(paiements: Paiement[], docsById: Map<number, Doc>, annee: number): Record<string, number> {
  const out: Record<string, number> = {};
  for (const p of paiements) {
    if (yearOf(p.date) !== annee) continue;
    out[p.activite] = (out[p.activite] ?? 0) + caHT(p, docsById);
  }
  return out;
}

export type EtatDeclaration = 'passee' | 'a_declarer' | 'en_cours' | 'a_venir';

export interface DeclarationRow {
  period: Period;
  parActivite: Record<string, number>;
  calcul: Calcul;
  etat: EtatDeclaration;
}

/** Une ligne par période de déclaration de l'année, avec l'estimation des prélèvements. */
export function declarations(
  annee: number,
  paiements: Paiement[],
  docsById: Map<number, Doc>,
  profile: Profile,
  regime: Regime,
  overrides: Record<number, RegimeParams>,
  today: string,
): DeclarationRow[] {
  const { params } = paramsFor(regime, overrides, annee);
  return periodsOfYear(annee, profile.frequence, regime.echeance).map((p) => {
    const parActivite: Record<string, number> = {};
    for (const pay of paiements) {
      if (pay.date < p.start || pay.date > p.end) continue;
      parActivite[pay.activite] = (parActivite[pay.activite] ?? 0) + caHT(pay, docsById);
    }
    const calcul = calculer(parActivite, { regime, params, profile, periodEnd: p.end, mois: p.mois });
    const etat: EtatDeclaration = p.end < today ? (p.echeance >= today ? 'a_declarer' : 'passee') : p.start <= today ? 'en_cours' : 'a_venir';
    return { period: p, parActivite, calcul, etat };
  });
}

export const sum = (arr: number[]) => arr.reduce((a, b) => a + b, 0);
