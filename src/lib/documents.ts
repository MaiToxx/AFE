import { db } from '../db/db';
import type { Client, ClientSnapshot, Doc, DocType, Ligne, MoyenPaiement, Paiement, Profile, Statut } from '../db/types';
import type { Lang } from '../i18n';
import { addDays, todayISO, yearOf } from './dates';
import { round2, uid } from './format';

export type Tone = 'neutral' | 'info' | 'good' | 'warning' | 'critical';

export function ligneTotalHT(l: Ligne): number {
  return round2((l.quantite || 0) * (l.prixUnitaire || 0));
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
  langue: '' as Lang | '',
  devise: '',
  retenue: 0,
  montantRetenue: 0,
};

export function normalizeDoc(d: Doc): Doc {
  const n: Doc = { ...DOC_DEFAULTS, ...d };
  if (n.netAPayer === undefined || n.netAPayer === null) n.netAPayer = round2(n.totalTTC - (n.montantRetenue || 0));
  return n;
}

export function computeTotals(
  doc: Pick<Doc, 'lignes' | 'remise' | 'retenue'>,
  assujettiTVA: boolean,
  appliquerRetenue: boolean,
): Pick<Doc, 'totalHT' | 'totalTVA' | 'totalTTC' | 'montantRetenue' | 'netAPayer'> {
  const brut = doc.lignes.reduce((s, l) => s + ligneTotalHT(l), 0);
  const remise = Math.min(Math.max(doc.remise || 0, 0), brut);
  const totalHT = round2(brut - remise);
  let tva = 0;
  if (assujettiTVA && brut > 0) {
    const coef = totalHT / brut; // la remise globale est répartie au prorata
    for (const l of doc.lignes) tva += (ligneTotalHT(l) * coef * (l.tauxTVA || 0)) / 100;
  }
  const totalTVA = round2(tva);
  const totalTTC = round2(totalHT + totalTVA);
  const montantRetenue = appliquerRetenue && doc.retenue > 0 ? round2((totalHT * doc.retenue) / 100) : 0;
  return { totalHT, totalTVA, totalTTC, montantRetenue, netAPayer: round2(totalTTC - montantRetenue) };
}

export function newLigne(tauxTVA: number): Ligne {
  return { id: uid(), description: '', quantite: 1, unite: '', prixUnitaire: 0, tauxTVA };
}

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
    langue: profile.langueDocuments,
    devise: profile.devise,
    lignes: [newLigne(profile.tauxTVA)],
    remise: 0,
    retenue: profile.retenueSource || 0,
    notes: '',
    devisId: null,
    factureId: null,
    totalHT: 0,
    totalTVA: 0,
    totalTTC: 0,
    montantRetenue: 0,
    netAPayer: 0,
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
  const max = docs.filter((d) => d.numeroSeq > 0 && yearOf(d.dateEmission) === annee).reduce((m, d) => Math.max(m, d.numeroSeq), 0);
  return max + 1;
}

export function clientSnapshot(c: Client): ClientSnapshot {
  return { nom: c.nom, type: c.type, adresse: c.adresse, codePostal: c.codePostal, ville: c.ville, pays: c.pays, email: c.email, siret: c.siret };
}

/** La retenue à la source ne s'applique qu'aux clients professionnels. */
async function clientEstPro(doc: Doc): Promise<boolean> {
  if (doc.client) return doc.client.type === 'pro';
  if (!doc.clientId) return false;
  const c = await db.clients.get(doc.clientId);
  return c?.type === 'pro';
}

export async function saveDoc(doc: Doc, profile: Profile): Promise<number> {
  const pro = await clientEstPro(doc);
  const updated: Doc = { ...doc, ...computeTotals(doc, profile.assujettiTVA, pro), updatedAt: new Date().toISOString() };
  return db.documents.put(updated);
}

/** Attribue un numéro, fige le client et passe le document en « envoyé ». */
export async function finaliser(doc: Doc, profile: Profile): Promise<Doc> {
  if (!doc.id) throw new Error('doc.notSaved');
  if (!doc.clientId) throw new Error('doc.noClient');
  const client = await db.clients.get(doc.clientId);
  if (!client) throw new Error('doc.clientMissing');
  const annee = yearOf(doc.dateEmission);
  const seq = doc.numeroSeq > 0 ? doc.numeroSeq : await nextSeq(doc.type, annee);
  const updated: Doc = {
    ...doc,
    ...computeTotals(doc, profile.assujettiTVA, client.type === 'pro'),
    numeroSeq: seq,
    numero: doc.numero || formatNumero(prefixeFor(doc.type, profile), annee, seq),
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

export async function setStatut(id: number, statut: Statut): Promise<void> {
  await db.documents.update(id, { statut, updatedAt: new Date().toISOString() });
}

export async function dupliquer(doc: Doc, profile: Profile): Promise<number> {
  const copy = newDoc(doc.type, profile, doc.clientId);
  copy.objet = doc.objet;
  copy.activite = doc.activite;
  copy.langue = doc.langue;
  copy.lignes = doc.lignes.map((l) => ({ ...l, id: uid() }));
  copy.remise = doc.remise;
  copy.retenue = doc.retenue;
  copy.notes = doc.notes;
  return saveDoc(copy, profile);
}

/** Crée une facture (brouillon) à partir d'un devis et relie les deux. */
export async function factureDepuisDevis(devis: Doc, profile: Profile): Promise<number> {
  const f = newDoc('facture', profile, devis.clientId);
  f.objet = devis.objet;
  f.activite = devis.activite;
  f.langue = devis.langue;
  f.lignes = devis.lignes.map((l) => ({ ...l, id: uid() }));
  f.remise = devis.remise;
  f.retenue = devis.retenue;
  f.notes = devis.notes;
  f.devisId = devis.id ?? null;
  f.bonCommande = devis.bonCommande;
  const id = await saveDoc(f, profile);
  if (devis.id) await db.documents.update(devis.id, { factureId: id, statut: 'accepte' });
  return id;
}

/** Crée un avoir (brouillon) reprenant les lignes d'une facture finalisée. */
export async function avoirDepuisFacture(facture: Doc, profile: Profile): Promise<number> {
  const a = newDoc('avoir', profile, facture.clientId);
  a.objet = facture.objet;
  a.activite = facture.activite;
  a.langue = facture.langue;
  a.devise = facture.devise || profile.devise;
  a.lignes = facture.lignes.map((l) => ({ ...l, id: uid() }));
  a.remise = facture.remise;
  a.retenue = facture.retenue;
  a.client = facture.client;
  a.avoirDe = facture.id ?? null;
  a.bonCommande = facture.bonCommande ?? '';
  const id = await saveDoc(a, profile);
  if (facture.id) await db.documents.update(facture.id, { avoirId: id });
  return id;
}

export async function supprimerDoc(doc: Doc): Promise<void> {
  if (!doc.id) return;
  await db.transaction('rw', [db.documents, db.paiements, db.relances], async () => {
    await db.paiements.where('factureId').equals(doc.id!).delete();
    await db.relances.where('factureId').equals(doc.id!).delete();
    if (doc.devisId) await db.documents.update(doc.devisId, { factureId: null });
    if (doc.factureId) await db.documents.update(doc.factureId, { devisId: null });
    if (doc.avoirDe) await db.documents.update(doc.avoirDe, { avoirId: null });
    if (doc.avoirId) await db.documents.update(doc.avoirId, { avoirDe: null });
    await db.documents.delete(doc.id!);
  });
}

/** Montant dû par le client (TTC moins retenue à la source). */
export function montantDu(doc: Doc): number {
  return doc.netAPayer ?? doc.totalTTC;
}

export function montantPaye(doc: Doc, paiements: Paiement[]): number {
  if (!doc.id) return 0;
  return round2(paiements.filter((p) => p.factureId === doc.id).reduce((s, p) => s + p.montant, 0));
}

/** Montant déjà remboursé au titre d'un avoir (paiements négatifs sur la facture d'origine). */
export function montantRembourse(avoir: Doc, paiements: Paiement[]): number {
  if (!avoir.avoirDe) return 0;
  return round2(paiements.filter((p) => p.factureId === avoir.avoirDe && p.montant < 0).reduce((s, p) => s - p.montant, 0));
}

/** Enregistre un encaissement et met la facture à jour (payée si soldée). */
export async function encaisser(doc: Doc, p: Omit<Paiement, 'id' | 'factureId' | 'activite'>): Promise<void> {
  if (!doc.id) return;
  await db.transaction('rw', [db.documents, db.paiements], async () => {
    await db.paiements.add({ ...p, factureId: doc.id!, activite: doc.activite });
    const all = await db.paiements.where('factureId').equals(doc.id!).toArray();
    const total = all.reduce((s, x) => s + x.montant, 0);
    const statut: Statut = total >= montantDu(doc) - 0.005 ? 'payee' : 'envoyee';
    await db.documents.update(doc.id!, { statut, updatedAt: new Date().toISOString() });
  });
}

/** Enregistre le remboursement d'un avoir : encaissement négatif sur la facture d'origine. */
export async function rembourser(avoir: Doc, p: { date: string; montant: number; moyen: MoyenPaiement; libelle: string }): Promise<void> {
  if (!avoir.avoirDe) throw new Error('doc.avoirUnlinked');
  const factureId = avoir.avoirDe;
  await db.transaction('rw', [db.documents, db.paiements], async () => {
    await db.paiements.add({ factureId, date: p.date, montant: -Math.abs(p.montant), moyen: p.moyen, activite: avoir.activite, libelle: p.libelle || `${avoir.numero}` });
    const facture = await db.documents.get(factureId);
    if (!facture) return;
    const total = (await db.paiements.where('factureId').equals(factureId).toArray()).reduce((s, x) => s + x.montant, 0);
    const statut: Statut = total <= 0.005 ? 'annulee' : total >= montantDu(normalizeDoc(facture)) - 0.005 ? 'payee' : 'envoyee';
    await db.documents.update(factureId, { statut, updatedAt: new Date().toISOString() });
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
        if (total < montantDu(normalizeDoc(doc)) - 0.005) await db.documents.update(doc.id!, { statut: 'envoyee' });
      }
    }
  });
}

/** Statut d'affichage : clé de traduction et teinte. */
export function statutInfo(doc: Doc, paye = 0, today = todayISO()): { key: string; tone: Tone } {
  switch (doc.statut) {
    case 'brouillon':
      return { key: 'status.draft', tone: 'neutral' };
    case 'envoye':
      if (doc.type === 'avoir') return { key: 'status.issued', tone: 'good' };
      return doc.dateEcheance && doc.dateEcheance < today ? { key: 'status.expired', tone: 'warning' } : { key: 'status.sent', tone: 'info' };
    case 'accepte':
      return { key: 'status.accepted', tone: 'good' };
    case 'refuse':
      return { key: 'status.refused', tone: 'critical' };
    case 'envoyee':
      if (paye > 0) return { key: 'status.partial', tone: 'warning' };
      return doc.dateEcheance && doc.dateEcheance < today ? { key: 'status.late', tone: 'critical' } : { key: 'status.sentF', tone: 'info' };
    case 'payee':
      return { key: 'status.paid', tone: 'good' };
    case 'annulee':
      return { key: 'status.cancelled', tone: 'neutral' };
  }
}

export function docTypeKey(type: DocType): string {
  return type === 'facture' ? 'doc.invoice' : type === 'avoir' ? 'doc.creditNote' : 'doc.quote';
}

export function docLabel(doc: Doc, tt: (key: string) => string): string {
  const base = tt(docTypeKey(doc.type));
  return doc.numero ? `${base} ${doc.numero}` : `${base} (${tt('status.draft').toLowerCase()})`;
}

export function isLocked(doc: Doc): boolean {
  return doc.statut !== 'brouillon';
}
