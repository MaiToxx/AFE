// Taxe sur les ventes au réel : taxe collectée (encaissements pour les services, facturation pour
// les biens), taxe déductible (dépenses) et solde par période de déclaration, avec report de crédit.
import type { Depense, Doc, Paiement, Profile } from '../db/types';
import { groupeOf, periodsOfYear, tvaEcheance, tvaFrequence, type Period } from '../regimes/engine';
import type { Regime } from '../regimes/types';
import type { EtatDeclaration } from './stats';

export interface TvaRow {
  period: Period;
  collectee: number;
  deductible: number;
  /** Collectée − déductible de la période (avant report). */
  nette: number;
  /** Montant à verser après imputation du crédit reporté. */
  aPayer: number;
  /** Crédit reporté sur la période suivante. */
  credit: number;
  etat: EtatDeclaration;
}

function finalisee(d: Doc): boolean {
  return d.type !== 'devis' && d.statut !== 'brouillon' && d.statut !== 'annulee';
}

/** Lignes de déclaration de taxe d'une année. Le crédit est reporté de période en période (pas d'une année sur l'autre). */
export function tvaParPeriode(annee: number, docs: Doc[], paiements: Paiement[], depenses: Depense[], profile: Profile, regime: Regime, today: string): TvaRow[] {
  const docsById = new Map(docs.filter((d) => d.id).map((d) => [d.id!, d]));
  const periods = periodsOfYear(annee, tvaFrequence(regime, profile), tvaEcheance(regime));
  let credit = 0;
  return periods.map((p) => {
    let collectee = 0;
    // Services : taxe exigible à l'encaissement, au prorata de la facture.
    for (const pay of paiements) {
      if (pay.date < p.start || pay.date > p.end || !pay.factureId) continue;
      const d = docsById.get(pay.factureId);
      if (!d || d.totalTVA <= 0 || d.totalTTC <= 0 || groupeOf(regime, d.activite) === 'vente') continue;
      collectee += (pay.montant * d.totalTVA) / d.totalTTC;
    }
    // Biens : taxe exigible à la livraison (date de facture) ; les avoirs viennent en déduction.
    for (const d of docs) {
      if (!finalisee(d) || d.dateEmission < p.start || d.dateEmission > p.end || d.totalTVA <= 0 || groupeOf(regime, d.activite) !== 'vente') continue;
      collectee += d.type === 'avoir' ? -d.totalTVA : d.totalTVA;
    }
    let deductible = 0;
    for (const dep of depenses) {
      if (!dep.tvaDeductible || dep.date < p.start || dep.date > p.end) continue;
      deductible += dep.montantTVA;
    }
    const nette = collectee - deductible;
    const solde = nette - credit;
    const aPayer = Math.max(0, solde);
    credit = Math.max(0, -solde);
    const etat: EtatDeclaration = p.end < today ? (p.echeance >= today ? 'a_declarer' : 'passee') : p.start <= today ? 'en_cours' : 'a_venir';
    return { period: p, collectee, deductible, nette, aPayer, credit, etat };
  });
}
