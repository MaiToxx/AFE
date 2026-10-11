import type { Depense, Doc, Paiement, Profile } from '../db/types';
import { calculer, paramsFor, periodsOfYear, type Calcul, type Period } from '../regimes/engine';
import type { Regime, RegimeParams } from '../regimes/types';
import { monthOf, yearOf } from './dates';
import { depensesDeductibles } from './depenses';

/**
 * Montant qui solde une facture : son net à payer, c'est-à-dire le TTC moins la retenue à la source
 * que le client professionnel verse lui-même à l'administration. C'est le dénominateur des proratas :
 * une facture entièrement réglée compte pour tout son HT et toute sa taxe, même si le client n'en a
 * versé qu'une partie.
 */
export function montantSoldant(d: Pick<Doc, 'totalTTC' | 'netAPayer'>): number {
  return d.netAPayer > 0 && d.netAPayer < d.totalTTC ? d.netAPayer : d.totalTTC;
}

/**
 * Montant HT d'un encaissement : un paiement sur facture est ramené au prorata du HT dans le montant
 * qui solde la facture ; un encaissement libre est saisi HT.
 */
export function caHT(p: Paiement, docsById: Map<number, Doc>): number {
  if (p.factureId) {
    const d = docsById.get(p.factureId);
    if (d && d.totalTTC > 0) return (p.montant * d.totalHT) / montantSoldant(d);
  }
  return p.montant;
}

/** Total encaissé par facture (identifiant → montant), pour éviter de reparcourir les paiements à chaque ligne. */
export function encaisseParFacture(paiements: Paiement[]): Map<number, number> {
  const out = new Map<number, number>();
  for (const p of paiements) {
    if (p.factureId) out.set(p.factureId, (out.get(p.factureId) ?? 0) + p.montant);
  }
  return out;
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
  depenses: Depense[] = [],
): DeclarationRow[] {
  const { params } = paramsFor(regime, overrides, annee);
  return periodsOfYear(annee, profile.frequence, regime.echeance).map((p) => {
    const parActivite: Record<string, number> = {};
    for (const pay of paiements) {
      if (pay.date < p.start || pay.date > p.end) continue;
      parActivite[pay.activite] = (parActivite[pay.activite] ?? 0) + caHT(pay, docsById);
    }
    const calcul = calculer(parActivite, {
      regime,
      params,
      profile,
      periodEnd: p.end,
      mois: p.mois,
      depenses: params.baseRevenu === 'reel' ? depensesDeductibles(depenses, p.start, p.end, profile.assujettiTVA) : 0,
      remuneration: regime.remuneration ? profile.remunerationMensuelle * p.mois : 0,
    });
    const etat: EtatDeclaration = p.end < today ? (p.echeance >= today ? 'a_declarer' : 'passee') : p.start <= today ? 'en_cours' : 'a_venir';
    return { period: p, parActivite, calcul, etat };
  });
}

export const sum = (arr: number[]) => arr.reduce((a, b) => a + b, 0);
