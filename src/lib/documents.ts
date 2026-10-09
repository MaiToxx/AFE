import { db } from '../db/db';
import type { Client, ClientSnapshot, Doc, DocType, Ligne, MoyenPaiement, Paiement, Profile, Statut } from '../db/types';
import { addDays, todayISO, yearOf } from './dates';
import { round2, uid } from './format';

export function ligneTotalHT(l: Ligne): number {
  return round2((l.quantite || 0) * (l.prixUnitaire || 0));
}

export function computeTotals(
  doc: Pick<Doc, 'lignes' | 'remise'>,
  assujettiTVA: boolean,
): Pick<Doc, 'totalHT' | 'totalTVA' | 'totalTTC'> {
  const brut = doc.lignes.reduce((s, l) => s + ligneTotalHT(l), 0);
  const remise = Math.min(Math.max(doc.remise || 0, 0), brut);
  const totalHT = round2(brut - remise);
  let tva = 0;
  if (assujettiTVA && brut > 0) {
    const coef = totalHT / brut; // la remise globale est répartie au prorata
    for (const l of doc.lignes) tva += ((ligneTotalHT(l) * coef) * (l.tauxTVA || 0)) / 100;
  }
  const totalTVA = round2(tva);
  return { totalHT, totalTVA, totalTTC: round2(totalHT + totalTVA) };
}

export function newLigne(tauxTVA: number): Ligne {
  return { id: uid(), description: '', quantite: 1, unite: '', prixUnitaire: 0, tauxTVA };
}

/** Valeurs par défaut des champs ajoutés après la v1 (documents anciens). */
export const DOC_DEFAULTS = {
  avoirDe: null as number | null,
  avoirId: null as number | null,
  recurrenceId: null as number | null,
  prestationDebut: '',
  prestationFin: '',
  bonCommande: '',
  adresseLivraison: '',
};

export function prefixeFor(type: DocType, profile: Profile): string {
  return type === 'facture' ? profile.prefixeFacture : type === 'avoir' ? profile.prefixeAvoir : profile.prefixeDevis;
}

export function newDoc(type: DocType, profile: Profile, clientId: number | null = null): Doc {
  const now = new Date().toISOString();
  const today = todayISO();
  const delai = type === 'facture' ? profile.delaiPaiementJours : type === 'devis' ? profile.validiteDevisJours : 0;
  return {
    ...DOC_DEFAULTS,
    type,
    numero: '',
    numeroSeq: 0,
    statut: 'brouillon',
    clientId,
    client: null,
    objet: '',
    dateEmission: today,
    dateEcheance: addDays(today, delai || 30),
    activite: profile.activite,
    lignes: [newLigne(profile.tauxTVA)],
    remise: 0,
    notes: '',
    devisId: null,
    factureId: null,
    totalHT: 0,
    totalTVA: 0,
    totalTTC: 0,
    createdAt: now,
    updatedAt: now,
  };
}

export function formatNumero(prefix: string, annee: number, seq: number): string {
  const n = `${annee}-${String(seq).padStart(4, '0')}`;
  return prefix ? `${prefix}-${n}` : n;
}

/** Prochain numéro de séquence pour un type de document et une année donnés. */
export async function nextSeq(type: DocType, annee: number): Promise<number> {
  const docs = await db.documents.where('type').equals(type).toArray();
  const max = docs
    .filter((d) => d.numeroSeq > 0 && yearOf(d.dateEmission) === annee)
    .reduce((m, d) => Math.max(m, d.numeroSeq), 0);
  return max + 1;
}

export function clientSnapshot(c: Client): ClientSnapshot {
  return {
    nom: c.nom,
    type: c.type,
    adresse: c.adresse,
    codePostal: c.codePostal,
    ville: c.ville,
    email: c.email,
    siret: c.siret,
  };
}

/** Attribue un numéro, fige le client et passe le document en « envoyé ». */
export async function finaliser(doc: Doc, profile: Profile): Promise<Doc> {
  if (!doc.id) throw new Error('Document non enregistré.');
  if (!doc.clientId) throw new Error('Choisissez un client avant de finaliser.');
  const client = await db.clients.get(doc.clientId);
  if (!client) throw new Error('Client introuvable.');
  const annee = yearOf(doc.dateEmission);
  const seq = doc.numeroSeq > 0 ? doc.numeroSeq : await nextSeq(doc.type, annee);
  const prefix = prefixeFor(doc.type, profile);
  const updated: Doc = {
    ...doc,
    ...computeTotals(doc, profile.assujettiTVA),
    numeroSeq: seq,
    numero: doc.numero || formatNumero(prefix, annee, seq),
    client: clientSnapshot(client),
    statut: doc.type === 'facture' ? 'envoyee' : 'envoye',
    updatedAt: new Date().toISOString(),
  };
  await db.documents.put(updated);
  // Un avoir couvrant une facture jamais encaissée l'annule.
  if (doc.type === 'avoir' && doc.avoirDe) {
    const facture = await db.documents.get(doc.avoirDe);
    const paye = (await db.paiements.where('factureId').equals(doc.avoirDe).toArray()).reduce((s, p) => s + p.montant, 0);
    if (facture && paye <= 0.005 && updated.totalTTC >= facture.totalTTC - 0.005) {
      await db.documents.update(doc.avoirDe, { statut: 'annulee', updatedAt: new Date().toISOString() });
    }
  }
  return updated;
}

/** Crée un avoir (brouillon) reprenant les lignes d'une facture finalisée. */
export async function avoirDepuisFacture(facture: Doc, profile: Profile): Promise<number> {
  const a = newDoc('avoir', profile, facture.clientId);
  a.objet = facture.objet;
  a.activite = facture.activite;
  a.lignes = facture.lignes.map((l) => ({ ...l, id: uid() }));
  a.remise = facture.remise;
  a.client = facture.client;
  a.avoirDe = facture.id ?? null;
  a.bonCommande = facture.bonCommande ?? '';
  const id = await saveDoc(a, profile);
  if (facture.id) await db.documents.update(facture.id, { avoirId: id });
  return id;
}

/** Montant déjà remboursé au titre d'un avoir (paiements négatifs sur la facture d'origine). */
export function montantRembourse(avoir: Doc, paiements: Paiement[]): number {
  if (!avoir.avoirDe) return 0;
  return round2(paiements.filter((p) => p.factureId === avoir.avoirDe && p.montant < 0).reduce((s, p) => s - p.montant, 0));
}

/** Enregistre le remboursement d'un avoir : encaissement négatif sur la facture d'origine (réduit le CA de la période). */
export async function rembourser(avoir: Doc, p: { date: string; montant: number; moyen: MoyenPaiement; libelle: string }): Promise<void> {
  if (!avoir.avoirDe) throw new Error("Cet avoir n'est lié à aucune facture.");
  const factureId = avoir.avoirDe;
  await db.transaction('rw', [db.documents, db.paiements], async () => {
    await db.paiements.add({
      factureId,
      date: p.date,
      montant: -Math.abs(p.montant),
      moyen: p.moyen,
      activite: avoir.activite,
      libelle: p.libelle || `Remboursement ${avoir.numero}`,
    });
    const facture = await db.documents.get(factureId);
    if (!facture) return;
    const total = (await db.paiements.where('factureId').equals(factureId).toArray()).reduce((s, x) => s + x.montant, 0);
    const statut: Statut = total <= 0.005 ? 'annulee' : total >= facture.totalTTC - 0.005 ? 'payee' : 'envoyee';
    await db.documents.update(factureId, { statut, updatedAt: new Date().toISOString() });
  });
}

export async function saveDoc(doc: Doc, profile: Profile): Promise<number> {
  const updated: Doc = {
    ...doc,
    ...computeTotals(doc, profile.assujettiTVA),
    updatedAt: new Date().toISOString(),
  };
  return db.documents.put(updated);
}

export async function setStatut(id: number, statut: Statut): Promise<void> {
  await db.documents.update(id, { statut, updatedAt: new Date().toISOString() });
}

export async function dupliquer(doc: Doc, profile: Profile): Promise<number> {
  const copy = newDoc(doc.type, profile, doc.clientId);
  copy.objet = doc.objet;
  copy.activite = doc.activite;
  copy.lignes = doc.lignes.map((l) => ({ ...l, id: uid() }));
  copy.remise = doc.remise;
  copy.notes = doc.notes;
  return saveDoc(copy, profile);
}

/** Crée une facture (brouillon) à partir d'un devis et relie les deux. */
export async function factureDepuisDevis(devis: Doc, profile: Profile): Promise<number> {
  const f = newDoc('facture', profile, devis.clientId);
  f.objet = devis.objet;
  f.activite = devis.activite;
  f.lignes = devis.lignes.map((l) => ({ ...l, id: uid() }));
  f.remise = devis.remise;
  f.notes = devis.notes;
  f.devisId = devis.id ?? null;
  const id = await saveDoc(f, profile);
  if (devis.id) await db.documents.update(devis.id, { factureId: id, statut: 'accepte' });
  return id;
}

export async function supprimerDoc(doc: Doc): Promise<void> {
  if (!doc.id) return;
  await db.transaction('rw', [db.documents, db.paiements], async () => {
    await db.paiements.where('factureId').equals(doc.id!).delete();
    if (doc.devisId) await db.documents.update(doc.devisId, { factureId: null });
    if (doc.factureId) await db.documents.update(doc.factureId, { devisId: null });
    if (doc.avoirDe) await db.documents.update(doc.avoirDe, { avoirId: null });
    if (doc.avoirId) await db.documents.update(doc.avoirId, { avoirDe: null });
    await db.documents.delete(doc.id!);
  });
}

export function montantPaye(doc: Doc, paiements: Paiement[]): number {
  if (!doc.id) return 0;
  return round2(paiements.filter((p) => p.factureId === doc.id).reduce((s, p) => s + p.montant, 0));
}

/** Enregistre un encaissement et met la facture à jour (payée si soldée). */
export async function encaisser(doc: Doc, p: Omit<Paiement, 'id' | 'factureId' | 'activite'>): Promise<void> {
  if (!doc.id) return;
  await db.transaction('rw', [db.documents, db.paiements], async () => {
    await db.paiements.add({ ...p, factureId: doc.id!, activite: doc.activite });
    const all = await db.paiements.where('factureId').equals(doc.id!).toArray();
    const total = all.reduce((s, x) => s + x.montant, 0);
    const statut: Statut = total >= doc.totalTTC - 0.005 ? 'payee' : 'envoyee';
    await db.documents.update(doc.id!, { statut, updatedAt: new Date().toISOString() });
  });
}

export async function supprimerPaiement(p: Paiement): Promise<void> {
  if (!p.id) return;
  await db.transaction('rw', [db.documents, db.paiements], async () => {
    await db.paiements.delete(p.id!);
    if (p.factureId) {
      const doc = await db.documents.get(p.factureId);
      if (doc && doc.statut === 'payee') {
        const rest = await db.paiements.where('factureId').equals(p.factureId).toArray();
        const total = rest.reduce((s, x) => s + x.montant, 0);
        if (total < doc.totalTTC - 0.005) await db.documents.update(doc.id!, { statut: 'envoyee' });
      }
    }
  });
}

export type Tone = 'neutral' | 'info' | 'good' | 'warning' | 'critical';

export function statutInfo(doc: Doc, paye = 0, today = todayISO()): { label: string; tone: Tone } {
  switch (doc.statut) {
    case 'brouillon':
      return { label: 'Brouillon', tone: 'neutral' };
    case 'envoye':
      if (doc.type === 'avoir') return { label: 'Émis', tone: 'good' };
      return doc.dateEcheance && doc.dateEcheance < today
        ? { label: 'Expiré', tone: 'warning' }
        : { label: 'Envoyé', tone: 'info' };
    case 'accepte':
      return { label: 'Accepté', tone: 'good' };
    case 'refuse':
      return { label: 'Refusé', tone: 'critical' };
    case 'envoyee':
      if (paye > 0) return { label: 'Partiellement payée', tone: 'warning' };
      return doc.dateEcheance && doc.dateEcheance < today
        ? { label: 'En retard', tone: 'critical' }
        : { label: 'Envoyée', tone: 'info' };
    case 'payee':
      return { label: 'Payée', tone: 'good' };
    case 'annulee':
      return { label: 'Annulée', tone: 'neutral' };
  }
}

export function docLabel(doc: Doc): string {
  const base = doc.type === 'facture' ? 'Facture' : doc.type === 'avoir' ? 'Avoir' : 'Devis';
  return doc.numero ? `${base} ${doc.numero}` : `${base} (brouillon)`;
}

export function isLocked(doc: Doc): boolean {
  return doc.statut !== 'brouillon';
}
