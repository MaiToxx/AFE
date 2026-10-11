// Échéancier : tout ce qui attend l'utilisateur à une date donnée (déclarations de cotisations et de
// taxe, factures à encaisser, devis qui arrivent en fin de validité, factures récurrentes à générer),
// factures en retard classées par ancienneté, et export vers un agenda (.ics).
import type { Doc, Recurrence } from '../db/types';
import { addDays, daysBetween } from './dates';
import { montantDu } from './documents';
import type { DeclarationRow } from './stats';
import type { TvaRow } from './tva';

export type TypeEcheance = 'declaration' | 'taxe' | 'facture' | 'devis' | 'recurrence';

export interface Echeance {
  /** Identifiant stable, repris dans l'export vers un agenda. */
  cle: string;
  date: string;
  type: TypeEcheance;
  /** Numéro du document, période déclarée ou nom du modèle récurrent. */
  reference: string;
  /** Client concerné, le cas échéant. */
  detail: string;
  /** Montant en jeu (reste à encaisser, estimation des prélèvements…), s'il y en a un. */
  montant: number | null;
  /** Vrai pour un montant estimé (période de déclaration pas encore close). */
  estimation: boolean;
  /** Adresse de l'écran concerné dans l'application. */
  lien: string;
  /** Jours de retard si positif, jours restants (en négatif) sinon. */
  retard: number;
}

export interface EcheancesOptions {
  docs: Doc[];
  /** Total encaissé par facture. */
  encaisse: Map<number, number>;
  recurrences: Recurrence[];
  nomClient: (d: Pick<Doc, 'client' | 'clientId'>) => string;
  declarations: DeclarationRow[];
  taxe: TvaRow[];
  today: string;
  /** Nombre de jours à venir à couvrir (les retards sont toujours inclus). */
  horizon: number;
}

/** Reste à encaisser sur une facture émise (0 si soldée). */
export function resteDu(doc: Doc, encaisse: Map<number, number>): number {
  const reste = montantDu(doc) - (encaisse.get(doc.id ?? 0) ?? 0);
  return reste > 0.005 ? Math.round(reste * 100) / 100 : 0;
}

export function echeances(o: EcheancesOptions): Echeance[] {
  const limite = addDays(o.today, o.horizon);
  const out: Echeance[] = [];
  const ajouter = (e: Omit<Echeance, 'retard'>) => out.push({ ...e, retard: daysBetween(e.date, o.today) });

  // Déclarations dont la date limite n'est pas passée (une échéance passée est supposée faite).
  for (const r of o.declarations) {
    const d = r.period.echeance;
    if (d < o.today || d > limite || r.etat === 'a_venir') continue;
    ajouter({ cle: `declaration-${r.period.key}`, date: d, type: 'declaration', reference: r.period.label, detail: '', montant: r.calcul.total, estimation: r.etat === 'en_cours', lien: '/cotisations' });
  }
  for (const r of o.taxe) {
    const d = r.period.echeance;
    if (d < o.today || d > limite || r.etat === 'a_venir') continue;
    ajouter({ cle: `taxe-${r.period.key}`, date: d, type: 'taxe', reference: r.period.label, detail: '', montant: r.aPayer, estimation: r.etat === 'en_cours', lien: '/cotisations' });
  }
  for (const d of o.docs) {
    if (!d.id || !d.dateEcheance) continue;
    if (d.type === 'facture' && d.statut === 'envoyee') {
      const reste = resteDu(d, o.encaisse);
      if (reste > 0 && d.dateEcheance <= limite) ajouter({ cle: `facture-${d.id}`, date: d.dateEcheance, type: 'facture', reference: d.numero, detail: o.nomClient(d), montant: reste, estimation: false, lien: `/documents/${d.id}` });
    } else if (d.type === 'devis' && d.statut === 'envoye') {
      // Devis sans réponse : fin de validité à venir, ou dépassée depuis moins d'un mois.
      if (d.dateEcheance <= limite && d.dateEcheance >= addDays(o.today, -30)) ajouter({ cle: `devis-${d.id}`, date: d.dateEcheance, type: 'devis', reference: d.numero, detail: o.nomClient(d), montant: d.totalTTC, estimation: false, lien: `/documents/${d.id}` });
    }
  }
  for (const r of o.recurrences) {
    if (!r.actif || !r.id || r.prochaine > limite) continue;
    ajouter({ cle: `recurrence-${r.id}-${r.prochaine}`, date: r.prochaine, type: 'recurrence', reference: r.libelle, detail: o.nomClient({ client: null, clientId: r.clientId }), montant: null, estimation: false, lien: '/documents?type=recurrente' });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date) || a.cle.localeCompare(b.cle));
}

export interface TrancheRetard {
  /** 1 : jusqu'à 30 jours ; 2 : 31 à 60 ; 3 : 61 à 90 ; 4 : au-delà. */
  rang: 1 | 2 | 3 | 4;
  montant: number;
  nombre: number;
}

/** Factures en retard de paiement, réparties par ancienneté du retard. */
export function retardsParAnciennete(docs: Doc[], encaisse: Map<number, number>, today: string): { tranches: TrancheRetard[]; total: number; factures: { doc: Doc; reste: number; jours: number }[] } {
  const tranches: TrancheRetard[] = [1, 2, 3, 4].map((rang) => ({ rang: rang as TrancheRetard['rang'], montant: 0, nombre: 0 }));
  const factures: { doc: Doc; reste: number; jours: number }[] = [];
  for (const d of docs) {
    if (d.type !== 'facture' || d.statut !== 'envoyee' || !d.dateEcheance || d.dateEcheance >= today) continue;
    const reste = resteDu(d, encaisse);
    if (reste <= 0) continue;
    const jours = daysBetween(d.dateEcheance, today);
    const t = tranches[jours <= 30 ? 0 : jours <= 60 ? 1 : jours <= 90 ? 2 : 3];
    t.montant += reste;
    t.nombre += 1;
    factures.push({ doc: d, reste, jours });
  }
  factures.sort((a, b) => b.jours - a.jours);
  return { tranches, total: tranches.reduce((s, t) => s + t.montant, 0), factures };
}

// ------------------------------------------------------------------------------ agenda (.ics)

const echapper = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

/** Une ligne d'agenda ne dépasse pas 75 octets : la suite est repliée sur des lignes commençant par une espace. */
function plier(ligne: string): string {
  const octets = new TextEncoder().encode(ligne);
  if (octets.length <= 75) return ligne;
  const morceaux: string[] = [];
  let debut = 0;
  let limite = 75;
  while (debut < octets.length) {
    let fin = Math.min(debut + limite, octets.length);
    // Ne pas couper au milieu d'un caractère codé sur plusieurs octets.
    while (fin < octets.length && (octets[fin] & 0xc0) === 0x80) fin--;
    morceaux.push(new TextDecoder().decode(octets.slice(debut, fin)));
    debut = fin;
    limite = 74;
  }
  return morceaux.join('\r\n ');
}

/**
 * Fichier d'agenda (iCalendar) : un événement d'une journée par échéance. `texte` donne le titre et la
 * description de chacune dans la langue de l'utilisateur.
 */
export function echeancesICS(liste: Echeance[], texte: (e: Echeance) => { titre: string; description: string }, maintenant = new Date()): string {
  const horodatage = maintenant.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  const jour = (iso: string) => iso.replace(/-/g, '');
  const lignes = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//AFE//Echeances//FR', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH'];
  for (const e of liste) {
    const { titre, description } = texte(e);
    lignes.push('BEGIN:VEVENT', `UID:${e.cle}@afe`, `DTSTAMP:${horodatage}`, `DTSTART;VALUE=DATE:${jour(e.date)}`, `DTEND;VALUE=DATE:${jour(addDays(e.date, 1))}`, `SUMMARY:${echapper(titre)}`);
    if (description) lignes.push(`DESCRIPTION:${echapper(description)}`);
    lignes.push('TRANSP:TRANSPARENT', 'END:VEVENT');
  }
  lignes.push('END:VCALENDAR');
  return lignes.map(plier).join('\r\n') + '\r\n';
}
