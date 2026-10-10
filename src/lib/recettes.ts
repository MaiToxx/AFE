// Livre des recettes : registre chronologique des encaissements (date, référence de la facture,
// client, nature, montant, mode de règlement).
import { MOYENS, type Client, type Doc, type Paiement } from '../db/types';
import { t } from '../i18n';
import { L } from '../regimes';
import { activiteOf } from '../regimes/engine';
import type { Regime } from '../regimes/types';
import { yearOf } from './dates';
import { fmtDate, round2 } from './format';

export interface LigneRecette {
  id: number;
  date: string;
  reference: string;
  client: string;
  nature: string;
  activite: string;
  montant: number; // montant encaissé (négatif pour un remboursement)
  moyen: string;
}

export function livreRecettes(annee: number, paiements: Paiement[], docsById: Map<number, Doc>, clients: Client[], regime: Regime): LigneRecette[] {
  const clientById = new Map(clients.filter((c) => c.id).map((c) => [c.id!, c.nom]));
  return paiements
    .filter((p) => yearOf(p.date) === annee)
    .map((p) => {
      const d = p.factureId ? docsById.get(p.factureId) : undefined;
      const nature = p.libelle || d?.objet || d?.lignes.find((l) => l.description.trim())?.description || L(activiteOf(regime, p.activite).court);
      return {
        id: p.id ?? 0,
        date: p.date,
        reference: d?.numero || (p.factureId ? t('ledger.draftInvoice') : t('ledger.freeReceipt')),
        client: d?.client?.nom ?? (d?.clientId ? clientById.get(d.clientId) : undefined) ?? '',
        nature,
        activite: p.activite,
        montant: round2(p.montant),
        moyen: t(MOYENS.find((m) => m.value === p.moyen)?.key ?? 'moyen.autre'),
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id);
}

/** CSV lisible par Excel (séparateur « ; », BOM UTF-8). */
export function recettesCSV(rows: LigneRecette[], regime: Regime): string {
  const esc = (s: string | number) => `"${String(s).replace(/"/g, '""')}"`;
  const head = [t('ledger.date'), t('ledger.reference'), t('ledger.client'), t('ledger.nature'), t('ledger.activity'), t('ledger.amount'), t('ledger.method')];
  const lines = rows.map((r) =>
    [fmtDate(r.date), r.reference, r.client, r.nature, L(activiteOf(regime, r.activite).court), r.montant.toFixed(2).replace('.', ','), r.moyen].map(esc).join(';'),
  );
  return '﻿' + [head.map(esc).join(';'), ...lines].join('\r\n') + '\r\n';
}
