// Registre des dépenses : coût réel d'une dépense, totaux par période et par catégorie, export CSV.
import { CATEGORIES_DEPENSE, MOYENS, type CategorieDepense, type Depense } from '../db/types';
import { t } from '../i18n';
import { csvFile, csvNumber, csvText } from './csv';
import { monthOf, yearOf } from './dates';
import { fmtDate, round2 } from './format';

/** Ventile un montant TTC selon un taux de taxe. */
export function ventiler(ttc: number, taux: number): { montantHT: number; montantTVA: number; montantTTC: number } {
  const montantTTC = round2(ttc);
  const montantHT = taux > 0 ? round2(montantTTC / (1 + taux / 100)) : montantTTC;
  return { montantHT, montantTVA: round2(montantTTC - montantHT), montantTTC };
}

/**
 * Coût d'une dépense pour le résultat : hors taxe si la taxe est récupérée (assujetti et taxe
 * déductible), toutes taxes comprises sinon.
 */
export function coutDepense(d: Depense, assujetti: boolean): number {
  return assujetti && d.tvaDeductible ? d.montantHT : d.montantTTC;
}

/** Dépenses déductibles du résultat entre deux dates incluses. */
export function depensesDeductibles(depenses: Depense[], start: string, end: string, assujetti: boolean): number {
  let s = 0;
  for (const d of depenses) {
    if (!d.deductible || d.date < start || d.date > end) continue;
    s += coutDepense(d, assujetti);
  }
  return s;
}

export function depensesParMois(depenses: Depense[], annee: number, assujetti: boolean): number[] {
  const out = Array(12).fill(0) as number[];
  for (const d of depenses) {
    if (yearOf(d.date) !== annee) continue;
    out[monthOf(d.date) - 1] += coutDepense(d, assujetti);
  }
  return out;
}

export interface TotauxDepenses {
  ttc: number;
  ht: number;
  tva: number;
  tvaDeductible: number;
  /** Coût déductible du résultat. */
  deductible: number;
  nb: number;
}

export function totauxDepenses(depenses: Depense[], annee: number, assujetti: boolean): TotauxDepenses {
  const out: TotauxDepenses = { ttc: 0, ht: 0, tva: 0, tvaDeductible: 0, deductible: 0, nb: 0 };
  for (const d of depenses) {
    if (yearOf(d.date) !== annee) continue;
    out.nb++;
    out.ttc += d.montantTTC;
    out.ht += d.montantHT;
    out.tva += d.montantTVA;
    if (d.tvaDeductible) out.tvaDeductible += d.montantTVA;
    if (d.deductible) out.deductible += coutDepense(d, assujetti);
  }
  return out;
}

export function depensesParCategorie(depenses: Depense[], annee: number, assujetti: boolean): { categorie: CategorieDepense; montant: number }[] {
  const map = new Map<CategorieDepense, number>();
  for (const d of depenses) {
    if (yearOf(d.date) !== annee) continue;
    map.set(d.categorie, (map.get(d.categorie) ?? 0) + coutDepense(d, assujetti));
  }
  return [...map.entries()].map(([categorie, montant]) => ({ categorie, montant })).sort((a, b) => b.montant - a.montant);
}

export function categorieKey(c: CategorieDepense): string {
  return CATEGORIES_DEPENSE.find((x) => x.value === c)?.key ?? 'cat.autre';
}

/** CSV lisible par Excel (séparateur « ; », BOM UTF-8). */
export function depensesCSV(rows: Depense[]): string {
  const head = [t('ledger.date'), t('exp.label'), t('exp.supplier'), t('exp.category'), t('exp.excl'), `${t('exp.tax')} (%)`, t('exp.tax'), t('exp.incl'), t('exp.taxRecovered'), t('exp.deductible'), t('ledger.method'), t('exp.reference')].map(csvText);
  const lines = rows.map((d) => [
    csvText(fmtDate(d.date)),
    csvText(d.libelle),
    csvText(d.fournisseur),
    csvText(t(categorieKey(d.categorie))),
    csvNumber(d.montantHT),
    csvNumber(d.tauxTVA),
    csvNumber(d.montantTVA),
    csvNumber(d.montantTTC),
    csvText(d.tvaDeductible ? t('common.yes') : t('common.no')),
    csvText(d.deductible ? t('common.yes') : t('common.no')),
    csvText(t(MOYENS.find((m) => m.value === d.moyen)?.key ?? 'moyen.autre')),
    csvText(d.reference),
  ]);
  return csvFile([head, ...lines]);
}
