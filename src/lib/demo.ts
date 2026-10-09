import { db, saveProfile } from '../db/db';
import type { Client, Doc, Ligne, Paiement } from '../db/types';
import { addDays, shiftMonth, todayISO, yearOf } from './dates';
import { DOC_DEFAULTS, computeTotals, formatNumero } from './documents';
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

const PRESTATIONS = [
  ['Développement site vitrine', 'forfait', 1, [1800, 3200]],
  ['Intégration maquettes Figma', 'jour', 3, [420, 520]],
  ['Maintenance et hébergement mensuel', 'mois', 1, [90, 180]],
  ['Développement fonctionnalité e-commerce', 'jour', 4, [450, 550]],
  ['Audit performance et SEO technique', 'forfait', 1, [600, 1200]],
  ['Formation WordPress (½ journée)', 'séance', 1, [350, 450]],
  ['Refonte identité graphique', 'forfait', 1, [900, 1600]],
  ['Accompagnement technique', 'heure', 6, [60, 85]],
] as const;

export async function loadDemo(): Promise<void> {
  const rand = rng(20261008);
  const pick = <T,>(arr: readonly T[]) => arr[Math.floor(rand() * arr.length)];
  const between = (a: number, b: number) => a + rand() * (b - a);

  const today = todayISO();
  const now = new Date().toISOString();

  await saveProfile({
    nom: 'Martin',
    prenom: 'Camille',
    denomination: 'Camille Martin — Développement web',
    adresse: '12 rue des Lilas',
    codePostal: '69003',
    ville: 'Lyon',
    email: 'camille@exemple.fr',
    telephone: '06 12 34 56 78',
    siret: '123 456 789 00012',
    siteWeb: 'www.camille-martin.fr',
    activiteLibelle: 'Développement web et conseil',
    activite: 'bnc',
    nature: 'liberal',
    frequence: 'trimestrielle',
    dateDebutActivite: '2024-03-01',
    acre: true,
    versementLiberatoire: false,
    assujettiTVA: false,
    couleur: '#2a78d6',
    conditionsPaiement: 'Paiement à 30 jours par virement bancaire.',
    iban: 'FR76 3000 6000 0112 3456 7890 189',
    bic: 'AGRIFRPP',
  });

  const clients: Client[] = [
    { nom: 'Boulangerie Dupain', type: 'pro', adresse: '4 place du Marché', codePostal: '69001', ville: 'Lyon', email: 'contact@dupain.fr', telephone: '04 78 00 00 01', siret: '812 345 678 00019', notes: '', createdAt: now },
    { nom: 'Studio Lumière SARL', type: 'pro', adresse: '18 cours Gambetta', codePostal: '69007', ville: 'Lyon', email: 'hello@studiolumiere.fr', telephone: '04 78 00 00 02', siret: '523 456 789 00023', notes: 'Facturer en fin de mois.', createdAt: now },
    { nom: 'Association Les Jardins Partagés', type: 'pro', adresse: '2 chemin des Prés', codePostal: '38200', ville: 'Vienne', email: 'asso@jardins-partages.org', telephone: '', siret: '', notes: '', createdAt: now },
    { nom: 'Cabinet Roche Avocats', type: 'pro', adresse: '55 rue de la République', codePostal: '69002', ville: 'Lyon', email: 'secretariat@roche-avocats.fr', telephone: '04 72 00 00 03', siret: '398 765 432 00015', notes: '', createdAt: now },
    { nom: 'Julie Fontaine', type: 'particulier', adresse: '7 allée des Tilleuls', codePostal: '69100', ville: 'Villeurbanne', email: 'julie.fontaine@exemple.fr', telephone: '06 98 76 54 32', siret: '', notes: 'Photographe indépendante.', createdAt: now },
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
      const [desc, unite, qteBase, [pMin, pMax]] = pick(PRESTATIONS);
      const qte = qteBase + (qteBase > 1 ? Math.floor(rand() * 3) : 0);
      const pu = round2((between(pMin, pMax) * growth) / (qteBase > 1 ? 1 : 1));
      const ci = Math.floor(rand() * clientIds.length);
      const lignes: Ligne[] = [{ id: uid(), description: desc, quantite: qte, unite, prixUnitaire: pu, tauxTVA: 20 }];
      if (rand() < 0.35) {
        lignes.push({ id: uid(), description: 'Frais de déplacement', quantite: 1, unite: 'forfait', prixUnitaire: round2(between(30, 90)), tauxTVA: 20 });
      }
      const base: Doc = {
        ...DOC_DEFAULTS,
        type: 'facture',
        numero: '',
        numeroSeq: 0,
        statut: 'envoyee',
        clientId: clientIds[ci],
        client: {
          nom: clients[ci].nom, type: clients[ci].type, adresse: clients[ci].adresse,
          codePostal: clients[ci].codePostal, ville: clients[ci].ville, email: clients[ci].email, siret: clients[ci].siret,
        },
        objet: desc,
        dateEmission,
        dateEcheance: addDays(dateEmission, 30),
        activite: 'bnc',
        lignes,
        remise: 0,
        notes: '',
        devisId: null,
        factureId: null,
        totalHT: 0, totalTVA: 0, totalTTC: 0,
        createdAt: now,
        updatedAt: now,
      };
      Object.assign(base, computeTotals(base, false));
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
    d.numero = formatNumero('F', y, seq);
  }

  const ids = (await db.documents.bulkAdd(docs, { allKeys: true })) as number[];

  // Encaissements : la plupart payées sous 5 à 45 jours ; les plus récentes restent en attente.
  docs.forEach((d, i) => {
    const datePaiement = addDays(d.dateEmission, 5 + Math.floor(rand() * 40));
    const recent = d.dateEmission > addDays(today, -50);
    if (recent && rand() < 0.55) return; // en attente de paiement
    if (datePaiement > today) return;
    paiements.push({
      factureId: ids[i],
      date: datePaiement,
      montant: d.totalTTC,
      moyen: rand() < 0.85 ? 'virement' : 'cb',
      activite: d.activite,
      libelle: '',
    });
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
  const mkDevis = (statut: Doc['statut'], seq: number, offset: number, ci: number, desc: string, pu: number, qte: number): Doc => {
    const dateEmission = addDays(today, offset);
    const d: Doc = {
      ...DOC_DEFAULTS,
      type: 'devis', numero: formatNumero('D', yearOf(dateEmission), seq), numeroSeq: seq, statut,
      clientId: clientIds[ci],
      client: {
        nom: clients[ci].nom, type: clients[ci].type, adresse: clients[ci].adresse,
        codePostal: clients[ci].codePostal, ville: clients[ci].ville, email: clients[ci].email, siret: clients[ci].siret,
      },
      objet: desc, dateEmission, dateEcheance: addDays(dateEmission, 30), activite: 'bnc',
      lignes: [{ id: uid(), description: desc, quantite: qte, unite: qte > 1 ? 'jour' : 'forfait', prixUnitaire: pu, tauxTVA: 20 }],
      remise: 0, notes: '', devisId: null, factureId: null, totalHT: 0, totalTVA: 0, totalTTC: 0, createdAt: now, updatedAt: now,
    };
    Object.assign(d, computeTotals(d, false));
    return d;
  };
  await db.documents.bulkAdd([
    mkDevis('envoye', 1, -6, 3, 'Refonte du site du cabinet', 3900, 1),
    mkDevis('envoye', 2, -2, 1, "Application de réservation en ligne", 520, 8),
    mkDevis('refuse', 3, -40, 4, 'Portfolio photo en ligne', 1400, 1),
  ]);
}
