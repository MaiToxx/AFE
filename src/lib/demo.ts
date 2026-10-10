import { db, saveProfile } from '../db/db';
import { normalizeProfile } from '../db/hooks';
import type { CategorieDepense, Client, Depense, Doc, Ligne, MoyenPaiement, Paiement } from '../db/types';
import { t } from '../i18n';
import { getRegime } from '../regimes';
import { addDays, shiftMonth, todayISO, yearOf } from './dates';
import { DOC_DEFAULTS, computeTotals, formatNumero } from './documents';
import { ventiler } from './depenses';
import { round2, uid } from './format';

// Générateur pseudo-aléatoire déterministe pour un jeu de démo stable.
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Prestations de démonstration : clé de libellé, unité, quantité de base, fourchette de prix. */
const PRESTATIONS: [string, string, number, [number, number]][] = [
  ['demo.p1', 'demo.uForfait', 1, [1800, 3200]],
  ['demo.p2', 'demo.uJour', 3, [420, 520]],
  ['demo.p3', 'demo.uMois', 1, [90, 180]],
  ['demo.p4', 'demo.uJour', 4, [450, 550]],
  ['demo.p5', 'demo.uForfait', 1, [600, 1200]],
  ['demo.p6', 'demo.uSeance', 1, [350, 450]],
  ['demo.p7', 'demo.uForfait', 1, [900, 1600]],
  ['demo.p8', 'demo.uHeure', 6, [60, 85]],
];

export async function loadDemo(): Promise<void> {
  const rand = rng(20261008);
  const pick = <T,>(arr: readonly T[]) => arr[Math.floor(rand() * arr.length)];
  const between = (a: number, b: number) => a + rand() * (b - a);

  const today = todayISO();
  const now = new Date().toISOString();

  // Profil : conservé s'il existe (pays et langue choisis), sinon un profil français fictif.
  const existing = await db.profile.get(1);
  if (!existing) {
    await saveProfile({
      nom: 'Martin',
      prenom: 'Camille',
      denomination: 'Camille Martin — Développement web',
      adresse: '12 rue des Lilas',
      codePostal: '69003',
      ville: 'Lyon',
      email: 'camille@exemple.fr',
      telephone: '06 12 34 56 78',
      identifiants: { siret: '123 456 789 00012' },
      siteWeb: 'www.camille-martin.fr',
      activiteLibelle: t('demo.activite'),
      pays: 'FR',
      activite: 'bnc',
      nature: 'liberal',
      frequence: 'trimestrielle',
      dateDebutActivite: '2024-03-01',
      acre: true,
      versementLiberatoire: false,
      assujettiTVA: false,
      couleur: '#2a78d6',
      conditionsPaiement: t('demo.conditions'),
      iban: 'FR76 3000 6000 0112 3456 7890 189',
      bic: 'AGRIFRPP',
    });
  } else if (!existing.nom && !existing.denomination) {
    await saveProfile({ nom: 'Martin', prenom: 'Camille', activiteLibelle: t('demo.activite') });
  }
  const profile = normalizeProfile((await db.profile.get(1)) ?? undefined);
  const regime = getRegime(profile.pays, profile.statut);
  const activite = regime.activites.some((a) => a.id === profile.activite) ? profile.activite : regime.activiteDefaut;
  const prefixeF = profile.prefixeFacture || 'F';
  const prefixeD = profile.prefixeDevis || 'D';

  const clients: Client[] = [
    { nom: 'Boulangerie Dupain', type: 'pro', adresse: '4 place du Marché', codePostal: '69001', ville: 'Lyon', pays: '', email: 'contact@dupain.fr', telephone: '04 78 00 00 01', siret: '812 345 678 00019', notes: '', createdAt: now },
    { nom: 'Studio Lumière SARL', type: 'pro', adresse: '18 cours Gambetta', codePostal: '69007', ville: 'Lyon', pays: '', email: 'hello@studiolumiere.fr', telephone: '04 78 00 00 02', siret: '523 456 789 00023', notes: '', createdAt: now },
    { nom: 'Association Les Jardins Partagés', type: 'pro', adresse: '2 chemin des Prés', codePostal: '38200', ville: 'Vienne', pays: '', email: 'asso@jardins-partages.org', telephone: '', siret: '', notes: '', createdAt: now },
    { nom: 'Cabinet Roche Avocats', type: 'pro', adresse: '55 rue de la République', codePostal: '69002', ville: 'Lyon', pays: '', email: 'secretariat@roche-avocats.fr', telephone: '04 72 00 00 03', siret: '398 765 432 00015', notes: '', createdAt: now },
    { nom: 'Julie Fontaine', type: 'particulier', adresse: '7 allée des Tilleuls', codePostal: '69100', ville: 'Villeurbanne', pays: '', email: 'julie.fontaine@exemple.fr', telephone: '06 98 76 54 32', siret: '', notes: '', createdAt: now },
  ];
  const clientIds = (await db.clients.bulkAdd(clients, { allKeys: true })) as number[];

  const curY = yearOf(today);
  const curM = Number(today.slice(5, 7));
  const docs: Doc[] = [];
  const paiements: Omit<Paiement, 'id'>[] = [];

  // 20 mois d'historique avec une tendance de croissance douce et une saisonnalité.
  for (let back = 20; back >= 0; back--) {
    const { annee, mois } = shiftMonth(curY, curM, -back);
    const growth = 1 + (20 - back) * 0.022;
    const season = mois === 8 ? 0.45 : mois === 12 ? 0.8 : 1;
    const n = Math.max(1, Math.round(between(1.2, 3.2) * season));
    for (let i = 0; i < n; i++) {
      const day = Math.min(28, 2 + Math.floor(rand() * 26));
      const dateEmission = `${annee}-${String(mois).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      if (dateEmission > today) continue;
      const [descKey, uniteKey, qteBase, [pMin, pMax]] = pick(PRESTATIONS);
      const qte = qteBase + (qteBase > 1 ? Math.floor(rand() * 3) : 0);
      const pu = round2(between(pMin, pMax) * growth);
      const ci = Math.floor(rand() * clientIds.length);
      const lignes: Ligne[] = [{ id: uid(), description: t(descKey), quantite: qte, unite: t(uniteKey), prixUnitaire: pu, tauxTVA: profile.tauxTVA }];
      if (rand() < 0.35) lignes.push({ id: uid(), description: t('demo.frais'), quantite: 1, unite: t('demo.uForfait'), prixUnitaire: round2(between(30, 90)), tauxTVA: profile.tauxTVA });
      const base: Doc = {
        ...DOC_DEFAULTS,
        type: 'facture',
        numero: '',
        numeroSeq: 0,
        statut: 'envoyee',
        clientId: clientIds[ci],
        client: { nom: clients[ci].nom, type: clients[ci].type, adresse: clients[ci].adresse, codePostal: clients[ci].codePostal, ville: clients[ci].ville, email: clients[ci].email, siret: clients[ci].siret },
        objet: t(descKey),
        dateEmission,
        dateEcheance: addDays(dateEmission, 30),
        activite,
        langue: profile.langueDocuments,
        devise: profile.devise,
        lignes,
        remise: 0,
        notes: '',
        devisId: null,
        factureId: null,
        totalHT: 0,
        totalTVA: 0,
        totalTTC: 0,
        netAPayer: 0,
        createdAt: now,
        updatedAt: now,
      };
      Object.assign(base, computeTotals(base, profile.assujettiTVA, false));
      docs.push(base);
    }
  }

  docs.sort((a, b) => a.dateEmission.localeCompare(b.dateEmission));
  const seqByYear = new Map<number, number>();
  for (const d of docs) {
    const y = yearOf(d.dateEmission);
    const seq = (seqByYear.get(y) ?? 0) + 1;
    seqByYear.set(y, seq);
    d.numeroSeq = seq;
    d.numero = formatNumero(prefixeF, y, seq);
  }

  const ids = (await db.documents.bulkAdd(docs, { allKeys: true })) as number[];

  // Encaissements : la plupart payées sous 5 à 45 jours ; les plus récentes restent en attente.
  docs.forEach((d, i) => {
    const datePaiement = addDays(d.dateEmission, 5 + Math.floor(rand() * 40));
    const recent = d.dateEmission > addDays(today, -50);
    if (recent && rand() < 0.55) return;
    if (datePaiement > today) return;
    paiements.push({ factureId: ids[i], date: datePaiement, montant: d.totalTTC, moyen: rand() < 0.85 ? 'virement' : 'cb', activite: d.activite, libelle: '' });
    d.statut = 'payee';
    d.id = ids[i];
  });
  await db.paiements.bulkAdd(paiements);
  await db.documents.bulkPut(docs.filter((d) => d.statut === 'payee'));

  // Une facture nettement en retard pour illustrer le suivi.
  const late = docs.filter((d) => d.statut === 'envoyee' && d.dateEcheance < today);
  if (late.length === 0) {
    const d = docs[docs.length - 3];
    if (d?.id) {
      await db.paiements.where('factureId').equals(d.id).delete();
      await db.documents.update(d.id, { statut: 'envoyee', dateEcheance: addDays(today, -12) });
    }
  }

  // Quelques devis.
  const mkDevis = (statut: Doc['statut'], seq: number, offset: number, ci: number, descKey: string, pu: number, qte: number): Doc => {
    const dateEmission = addDays(today, offset);
    const d: Doc = {
      ...DOC_DEFAULTS,
      type: 'devis',
      numero: formatNumero(prefixeD, yearOf(dateEmission), seq),
      numeroSeq: seq,
      statut,
      clientId: clientIds[ci],
      client: { nom: clients[ci].nom, type: clients[ci].type, adresse: clients[ci].adresse, codePostal: clients[ci].codePostal, ville: clients[ci].ville, email: clients[ci].email, siret: clients[ci].siret },
      objet: t(descKey),
      dateEmission,
      dateEcheance: addDays(dateEmission, 30),
      activite,
      langue: profile.langueDocuments,
      devise: profile.devise,
      lignes: [{ id: uid(), description: t(descKey), quantite: qte, unite: t(qte > 1 ? 'demo.uJour' : 'demo.uForfait'), prixUnitaire: pu, tauxTVA: profile.tauxTVA }],
      remise: 0,
      notes: '',
      devisId: null,
      factureId: null,
      totalHT: 0,
      totalTVA: 0,
      totalTTC: 0,
      netAPayer: 0,
      createdAt: now,
      updatedAt: now,
    };
    Object.assign(d, computeTotals(d, profile.assujettiTVA, false));
    return d;
  };
  await db.documents.bulkAdd([mkDevis('envoye', 1, -6, 3, 'demo.d1', 3900, 1), mkDevis('envoye', 2, -2, 1, 'demo.d2', 520, 8), mkDevis('refuse', 3, -40, 4, 'demo.d3', 1400, 1)]);

  // Dépenses des douze derniers mois : abonnements, matériel, déplacements, honoraires…
  const depenses: Omit<Depense, 'id'>[] = [];
  const dep = (date: string, key: string, fournisseur: string, categorie: CategorieDepense, ttc: number, taux: number, moyen: MoyenPaiement = 'cb') => {
    if (date > today) return;
    depenses.push({ date, libelle: t(key), fournisseur, categorie, ...ventiler(ttc, taux), tauxTVA: taux, tvaDeductible: profile.assujettiTVA, deductible: true, moyen, reference: '', notes: '', createdAt: now });
  };
  for (let back = 11; back >= 0; back--) {
    const { annee, mois } = shiftMonth(curY, curM, -back);
    const d = (day: number) => `${annee}-${String(mois).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    dep(d(3), 'demo.x1', 'Officia SaaS', 'logiciels', 14.99, 20);
    dep(d(5), 'demo.x3', 'MobilePro', 'telecom', 29.99, 20, 'virement');
    dep(d(8), 'demo.x8', 'AssurPro', 'assurance', 38, 0, 'virement');
    dep(d(12), 'demo.x10', 'Compta Conseil', 'honoraires', 95, 20, 'virement');
    dep(d(28), 'demo.x9', 'NeoBank', 'banque', 12, 0, 'virement');
    if (back === 11) dep(d(9), 'demo.x2', 'WebHost', 'logiciels', 95.88, 20);
    if (back === 10) dep(d(14), 'demo.x4', 'TechStore', 'materiel', 1899, 20);
    if (back === 7) dep(d(21), 'demo.x5', 'Learnify', 'formation', 450, 20);
    if (back % 4 === 2) dep(d(17), 'demo.x6', 'RailEurope', 'deplacements', 86.5, 10);
    if (back % 3 === 1) dep(d(19), 'demo.x7', 'Bistrot du Centre', 'repas', 42.3, 10);
  }
  await db.depenses.bulkAdd(depenses);
}
