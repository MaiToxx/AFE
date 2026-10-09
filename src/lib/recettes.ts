// Livre des recettes : registre chronologique des encaissements, obligatoire pour tout
// micro-entrepreneur (date, référence de la facture, client, nature, montant, mode de règlement).
import { ACTIVITES, MOYENS, type ActivityKind, type Client, type Doc, type Paiement } from '../db/types';
import { yearOf } from './dates';
import { fmtDate, round2 } from './format';

export interface LigneRecette {
  id: number;
  date: string;
  reference: string;
  client: string;
  nature: string;
  activite: ActivityKind;
  montant: number; // montant encaissé (négatif pour un remboursement)
  moyen: string;
}

export function livreRecettes(annee: number, paiements: Paiement[], docsById: Map<number, Doc>, clients: Client[]): LigneRecette[] {
  const clientById = new Map(clients.filter((c) => c.id).map((c) => [c.id!, c.nom]));
  return paiements
    .filter((p) => yearOf(p.date) === annee)
    .map((p) => {
      const d = p.factureId ? docsById.get(p.factureId) : undefined;
      const nature =
        p.libelle || d?.objet || d?.lignes.find((l) => l.description.trim())?.description || ACTIVITES.find((a) => a.value === p.activite)?.court || '';
      return {
        id: p.id ?? 0,
        date: p.date,
        reference: d?.numero || (p.factureId ? 'Facture (brouillon)' : 'Encaissement libre'),
        client: d?.client?.nom ?? (d?.clientId ? clientById.get(d.clientId) : undefined) ?? '',
        nature,
        activite: p.activite,
        montant: round2(p.montant),
        moyen: MOYENS.find((m) => m.value === p.moyen)?.label ?? p.moyen,
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id);
}

/** CSV lisible par Excel (séparateur « ; », BOM UTF-8, montants avec virgule). */
export function recettesCSV(rows: LigneRecette[]): string {
  const esc = (s: string | number) => `"${String(s).replace(/"/g, '""')}"`;
  const head = ['Date', 'Référence', 'Client', 'Nature', 'Activité', 'Montant encaissé', 'Mode de règlement'];
  const lines = rows.map((r) =>
    [
      fmtDate(r.date),
      r.reference,
      r.client,
      r.nature,
      ACTIVITES.find((a) => a.value === r.activite)?.court ?? r.activite,
      r.montant.toFixed(2).replace('.', ','),
      r.moyen,
    ]
      .map(esc)
      .join(';'),
  );
  return '﻿' + [head.map(esc).join(';'), ...lines].join('\r\n') + '\r\n';
}
