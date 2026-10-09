import type { ActivityKind, Bareme, Doc, Paiement, Profile } from '../db/types';
import { pickBareme } from './bareme';
import { acreActive, calculer, periodsOfYear, type Calcul, type Period } from './cotisations';
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

export function caParActivite(paiements: Paiement[], docsById: Map<number, Doc>, annee: number): Partial<Record<ActivityKind, number>> {
  const out: Partial<Record<ActivityKind, number>> = {};
  for (const p of paiements) {
    if (yearOf(p.date) !== annee) continue;
    out[p.activite] = (out[p.activite] ?? 0) + caHT(p, docsById);
  }
  return out;
}

export type EtatDeclaration = 'passee' | 'a_declarer' | 'en_cours' | 'a_venir';

export interface DeclarationRow {
  period: Period;
  parActivite: Partial<Record<ActivityKind, number>>;
  calcul: Calcul;
  etat: EtatDeclaration;
}

/** Une ligne par période de déclaration de l'année, avec l'estimation des prélèvements. */
export function declarations(
  annee: number,
  paiements: Paiement[],
  docsById: Map<number, Doc>,
  profile: Profile,
  baremes: Bareme[],
  today: string,
): DeclarationRow[] {
  const bareme = pickBareme(baremes, annee);
  return periodsOfYear(annee, profile.frequence).map((p) => {
    const parActivite: Partial<Record<ActivityKind, number>> = {};
    for (const pay of paiements) {
      if (pay.date < p.start || pay.date > p.end) continue;
      parActivite[pay.activite] = (parActivite[pay.activite] ?? 0) + caHT(pay, docsById);
    }
    const calcul = calculer(parActivite, {
      bareme,
      nature: profile.nature,
      doubleImmatriculation: profile.doubleImmatriculation,
      acre: acreActive(profile, p.end),
      versementLiberatoire: profile.versementLiberatoire,
    });
    const etat: EtatDeclaration =
      p.end < today ? (p.echeance >= today ? 'a_declarer' : 'passee') : p.start <= today ? 'en_cours' : 'a_venir';
    return { period: p, parActivite, calcul, etat };
  });
}

export const sum = (arr: number[]) => arr.reduce((a, b) => a + b, 0);
