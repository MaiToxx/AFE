import { db } from '../db/db';
import type { Doc, FrequenceRecurrence, Profile, Recurrence } from '../db/types';
import { addDays, addMonths, todayISO } from './dates';
import { finaliser, newDoc, saveDoc } from './documents';
import { uid } from './format';

export const FREQUENCES: { value: FrequenceRecurrence; key: string; mois: number }[] = [
  { value: 'mensuelle', key: 'freq.monthly', mois: 1 },
  { value: 'trimestrielle', key: 'freq.quarterly', mois: 3 },
  { value: 'annuelle', key: 'freq.yearly', mois: 12 },
];

export function prochaineDate(iso: string, frequence: FrequenceRecurrence): string {
  return addMonths(iso, FREQUENCES.find((f) => f.value === frequence)?.mois ?? 1);
}

/** Crée un modèle de facture récurrente à partir d'une facture existante. */
export async function creerRecurrence(
  facture: Doc,
  opts: { libelle: string; frequence: FrequenceRecurrence; prochaine: string; finaliserAuto: boolean },
): Promise<number> {
  return db.recurrences.add({
    libelle: opts.libelle,
    clientId: facture.clientId,
    objet: facture.objet,
    activite: facture.activite,
    lignes: facture.lignes.map((l) => ({ ...l, id: uid() })),
    remise: facture.remise,
    notes: facture.notes,
    frequence: opts.frequence,
    prochaine: opts.prochaine,
    actif: true,
    finaliserAuto: opts.finaliserAuto,
    createdAt: new Date().toISOString(),
  });
}

/** Génère la facture d'une occurrence et avance la prochaine date. */
export async function genererOccurrence(rec: Recurrence, profile: Profile): Promise<number> {
  const f = newDoc('facture', profile, rec.clientId);
  f.objet = rec.objet;
  f.activite = rec.activite;
  f.lignes = rec.lignes.map((l) => ({ ...l, id: uid() }));
  f.remise = rec.remise;
  f.notes = rec.notes;
  f.dateEmission = rec.prochaine;
  f.dateEcheance = addDays(rec.prochaine, profile.delaiPaiementJours || 30);
  f.recurrenceId = rec.id ?? null;
  const id = await saveDoc(f, profile);
  if (rec.finaliserAuto && rec.clientId) {
    try {
      await finaliser({ ...f, id }, profile);
    } catch {
      /* client supprimé ou document incomplet : la facture reste en brouillon */
    }
  }
  await db.recurrences.update(rec.id!, { prochaine: prochaineDate(rec.prochaine, rec.frequence) });
  return id;
}

/** Génère toutes les occurrences échues (appelé au lancement). Renvoie le nombre de factures créées. */
export async function genererRecurrences(profile: Profile, today = todayISO()): Promise<number> {
  const dues = (await db.recurrences.toArray()).filter((r) => r.actif && r.prochaine <= today);
  let n = 0;
  for (const rec of dues) {
    let courant = rec;
    // Garde-fou : au plus 24 occurrences de rattrapage par modèle.
    for (let i = 0; i < 24 && courant.prochaine <= today; i++) {
      await genererOccurrence(courant, profile);
      n++;
      courant = { ...courant, prochaine: prochaineDate(courant.prochaine, courant.frequence) };
    }
  }
  return n;
}
