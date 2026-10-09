import { db } from '../db/db';
import type { Doc, Profile, Relance } from '../db/types';
import { daysBetween, todayISO } from './dates';
import { fmtDate, fmtEUR } from './format';

/** E-mail de relance pré-rempli (mailto:) pour une facture en attente de paiement. */
export function relanceMailto(doc: Doc, profile: Profile, reste: number, nbRelances: number, today = todayISO()): string {
  const retard = daysBetween(doc.dateEcheance, today);
  const emetteur = profile.denomination || `${profile.prenom} ${profile.nom}`.trim();
  const subject = `${nbRelances >= 1 ? `Relance n° ${nbRelances + 1}` : 'Rappel'} — facture ${doc.numero} du ${fmtDate(doc.dateEmission)}`;
  const lignes = [
    'Bonjour,',
    '',
    `Sauf erreur de notre part, la facture ${doc.numero} du ${fmtDate(doc.dateEmission)}, d'un montant de ${fmtEUR(doc.totalTTC)}${reste < doc.totalTTC ? ` (reste dû : ${fmtEUR(reste)})` : ''}, ` +
      (retard > 0
        ? `est arrivée à échéance le ${fmtDate(doc.dateEcheance)}, soit depuis ${retard} jour${retard > 1 ? 's' : ''}.`
        : `arrive à échéance le ${fmtDate(doc.dateEcheance)}.`),
    '',
    `Merci de bien vouloir procéder à son règlement${profile.iban ? ` par virement (IBAN ${profile.iban}${profile.bic ? `, BIC ${profile.bic}` : ''})` : ''} dans les meilleurs délais, ou de nous indiquer si un paiement est déjà en cours.`,
    '',
  ];
  if (doc.client?.type === 'pro' && retard > 0) {
    lignes.push(
      "Conformément aux conditions figurant sur la facture, tout retard de paiement entraîne des pénalités de retard ainsi qu'une indemnité forfaitaire de 40 € pour frais de recouvrement (art. L441-10 du Code de commerce).",
      '',
    );
  }
  lignes.push('Cordialement,', emetteur);
  const to = doc.client?.email ?? '';
  return `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(lignes.join('\n'))}`;
}

export async function enregistrerRelance(r: Omit<Relance, 'id'>): Promise<number> {
  return db.relances.add(r);
}

export async function supprimerRelance(id: number): Promise<void> {
  await db.relances.delete(id);
}
