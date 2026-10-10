import { db } from '../db/db';
import type { Doc, Profile, Relance } from '../db/types';
import { tIn, type Lang } from '../i18n';
import type { Regime } from '../regimes/types';
import { L, localeFor } from '../regimes';
import { daysBetween, todayISO } from './dates';
import { fmtDate, fmtMoneyIn } from './format';

/** E-mail de relance pré-rempli (mailto:) dans la langue du document. */
export function relanceMailto(doc: Doc, profile: Profile, regime: Regime, reste: number, nbRelances: number, today = todayISO()): string {
  const lang: Lang = doc.langue || profile.langueDocuments;
  const locale = localeFor(lang, profile.pays);
  const devise = doc.devise || profile.devise;
  const money = (n: number) => fmtMoneyIn(locale, devise, n);
  const retard = daysBetween(doc.dateEcheance, today);
  const emetteur = profile.denomination || `${profile.prenom} ${profile.nom}`.trim();
  const v = { numero: doc.numero, date: fmtDate(doc.dateEmission, locale), montant: money(doc.netAPayer ?? doc.totalTTC), reste: money(reste), echeance: fmtDate(doc.dateEcheance, locale), jours: retard, n: nbRelances + 1 };
  const subject = nbRelances >= 1 ? tIn(lang, 'relance.subjectN', v) : tIn(lang, 'relance.subject', v);
  const lignes = [
    tIn(lang, 'relance.hello'),
    '',
    tIn(lang, retard > 0 ? 'relance.bodyLate' : 'relance.bodyDue', v),
    '',
    tIn(lang, profile.iban ? 'relance.payIban' : 'relance.pay', { iban: profile.iban, bic: profile.bic ? `, BIC ${profile.bic}` : '' }),
    '',
  ];
  const retardMention = L(regime.mentions.retard, lang);
  if (doc.client?.type === 'pro' && retard > 0 && retardMention) lignes.push(tIn(lang, 'relance.penalties'), '');
  lignes.push(tIn(lang, 'relance.regards'), emetteur);
  const to = doc.client?.email ?? '';
  return `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(lignes.join('\n'))}`;
}

export async function enregistrerRelance(r: Omit<Relance, 'id'>): Promise<number> {
  return db.relances.add(r);
}

export async function supprimerRelance(id: number): Promise<void> {
  await db.relances.delete(id);
}
