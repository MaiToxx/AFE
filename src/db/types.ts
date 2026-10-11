// Modèle de données. Tout est stocké localement (IndexedDB via Dexie).
import type { Lang } from '../i18n';
import type { Frequence, Nature, RegimeParams } from '../regimes/types';

export type { Frequence, Nature } from '../regimes/types';

export type DocType = 'devis' | 'facture' | 'avoir';

export type DevisStatut = 'brouillon' | 'envoye' | 'accepte' | 'refuse';
export type FactureStatut = 'brouillon' | 'envoyee' | 'payee' | 'annulee';
/** Un avoir est « émis » (statut `envoye`) une fois finalisé. */
export type AvoirStatut = 'brouillon' | 'envoye';
export type Statut = DevisStatut | FactureStatut | AvoirStatut;

export type MoyenPaiement = 'virement' | 'cb' | 'especes' | 'cheque' | 'autre';

export interface Profile {
  id: number; // toujours 1
  nom: string;
  prenom: string;
  denomination: string;
  adresse: string;
  codePostal: string;
  ville: string;
  email: string;
  telephone: string;
  siteWeb: string;
  activiteLibelle: string;
  /** Pays d'imposition (FR, BE, CH…, XX = générique). */
  pays: string;
  /** Statut au sein du pays (micro, ei, eurl, sasu, independant, societe…) ; vide = statut par défaut du pays. */
  statut: string;
  /** Rémunération nette mensuelle que se verse le dirigeant (sociétés). */
  remunerationMensuelle: number;
  /** Périodicité des déclarations de taxe sur les ventes ('' = défaut du régime). */
  periodiciteTVA: Frequence | '';
  /** Langue par défaut des documents émis. */
  langueDocuments: Lang;
  devise: string;
  /** Identifiants officiels selon le régime (siret, tva, nif, uid…). */
  identifiants: Record<string, string>;
  activite: string; // activité par défaut des nouveaux documents (id du régime)
  nature: Nature;
  doubleImmatriculation: boolean;
  frequence: Frequence;
  dateDebutActivite: string; // ISO yyyy-mm-dd
  /** Réduction de début d'activité (ACRE, tarifa plana, start-up…). */
  acre: boolean;
  versementLiberatoire: boolean;
  /** Composantes facultatives du régime activées (clé = id de composante). */
  optionsRegime: Record<string, boolean>;
  assujettiTVA: boolean;
  tauxTVA: number; // %
  /** Retenue à la source appliquée sur les factures aux professionnels (%), si le régime le prévoit. */
  retenueSource: number;
  // Personnalisation des documents
  logo: string; // data URL
  couleur: string; // hex
  themeDocument: 'clair' | 'sombre';
  prefixeFacture: string;
  prefixeDevis: string;
  prefixeAvoir: string;
  /** Numérotation : « annuelle » (F-2026-0001, repart à 1 chaque année) ou « continue » (F-0001, ne repart jamais). */
  numerotation: 'annuelle' | 'continue';
  /** Nombre de chiffres du numéro d'ordre (3 à 6). */
  numeroChiffres: number;
  /**
   * Numéro d'ordre minimal du prochain document de chaque type (0 = suite automatique), pour reprendre
   * la numérotation d'un autre logiciel. En numérotation annuelle, il ne vaut que pour `annee`.
   */
  numeroDepart: { facture: number; devis: number; avoir: number; annee: number };
  delaiPaiementJours: number;
  validiteDevisJours: number;
  conditionsPaiement: string;
  mentionsPied: string;
  iban: string;
  bic: string;
  /** Afficher un QR code de virement SEPA sur les factures en euros (IBAN requis). */
  qrPaiement: boolean;
  /** Conditions générales, imprimées sur une page à part à la suite des documents choisis. */
  cgv: string;
  cgvDevis: boolean;
  cgvFacture: boolean;
  objectifCA: number;
  sauvegardeAuto: boolean;
  /** @deprecated migrés dans `identifiants` (siret, tva). */
  siret: string;
  /** @deprecated */
  numeroTVA: string;
}

export interface Client {
  id?: number;
  nom: string;
  type: 'pro' | 'particulier';
  adresse: string;
  codePostal: string;
  ville: string;
  pays: string;
  email: string;
  telephone: string;
  /** Identifiant officiel du client (SIRET, NIF, UID… selon le régime). */
  siret: string;
  notes: string;
  /** Langue des documents émis pour ce client ('' ou absent : langue par défaut du profil). */
  langue?: Lang | '';
  /** Délai de paiement propre à ce client, en jours (absent ou null : délai par défaut du profil). */
  delaiPaiementJours?: number | null;
  createdAt: string;
}

export interface Ligne {
  id: string;
  description: string;
  quantite: number;
  unite: string;
  prixUnitaire: number; // HT
  tauxTVA: number; // % (ignoré si franchise)
}

export interface ClientSnapshot {
  nom: string;
  type: 'pro' | 'particulier';
  adresse: string;
  codePostal: string;
  ville: string;
  pays?: string;
  email: string;
  siret: string;
}

/**
 * Émetteur tel qu'il était à la finalisation d'un document. Un document émis doit rester identique :
 * il ne suit donc pas les changements ultérieurs du profil (adresse, dénomination, statut, passage à
 * la TVA, coordonnées bancaires, mentions).
 */
export interface EmetteurSnapshot {
  denomination: string;
  prenom: string;
  nom: string;
  activiteLibelle: string;
  adresse: string;
  codePostal: string;
  ville: string;
  email: string;
  telephone: string;
  siteWeb: string;
  pays: string;
  statut: string;
  nature: Nature;
  identifiants: Record<string, string>;
  assujettiTVA: boolean;
  conditionsPaiement: string;
  mentionsPied: string;
  iban: string;
  bic: string;
}

export interface Doc {
  id?: number;
  type: DocType;
  numero: string; // vide tant que brouillon
  numeroSeq: number; // 0 tant que brouillon
  statut: Statut;
  clientId: number | null;
  client: ClientSnapshot | null; // figé à la finalisation
  /** Émetteur figé à la finalisation (absent des documents finalisés avant la version 0.4.3). */
  emetteur?: EmetteurSnapshot | null;
  objet: string;
  dateEmission: string; // ISO
  dateEcheance: string; // facture : échéance ; devis : fin de validité
  activite: string;
  /** Langue d'impression du document ('' = langue par défaut du profil). */
  langue: Lang | '';
  devise: string;
  lignes: Ligne[];
  /** Remise globale : montant HT, ou pourcentage du sous-total selon `remiseType`. */
  remise: number;
  /** Absent sur les documents antérieurs à la version 0.5 : la remise y est un montant. */
  remiseType?: 'montant' | 'pourcent';
  /** Retenue à la source (%) pratiquée par le client professionnel, 0 si aucune. */
  retenue: number;
  notes: string;
  devisId: number | null; // facture issue d'un devis
  factureId: number | null; // devis converti en facture
  avoirDe: number | null; // avoir : facture corrigée
  avoirId: number | null; // facture : avoir émis dessus
  recurrenceId: number | null; // facture générée par une récurrence
  // Mentions complémentaires (facturation électronique 2026)
  prestationDebut: string;
  prestationFin: string;
  bonCommande: string;
  adresseLivraison: string;
  totalHT: number;
  totalTVA: number;
  totalTTC: number;
  montantRetenue: number;
  /** Montant effectivement dû par le client (TTC − retenue). */
  netAPayer: number;
  createdAt: string;
  updatedAt: string;
}

export interface Paiement {
  id?: number;
  factureId: number | null; // null = encaissement libre (sans facture)
  date: string; // date d'encaissement (fait générateur des prélèvements)
  montant: number; // montant encaissé (négatif = remboursement)
  moyen: MoyenPaiement;
  activite: string;
  libelle: string;
}

export type CategorieDepense =
  | 'achats'
  | 'fournitures'
  | 'logiciels'
  | 'loyer'
  | 'telecom'
  | 'deplacements'
  | 'repas'
  | 'vehicule'
  | 'assurance'
  | 'honoraires'
  | 'formation'
  | 'materiel'
  | 'banque'
  | 'cotisations'
  | 'autre';

/** Dépense professionnelle (achat, frais) : base du bénéfice au réel et de la taxe déductible. */
export interface Depense {
  id?: number;
  date: string; // ISO, date de paiement
  libelle: string;
  fournisseur: string;
  categorie: CategorieDepense;
  montantHT: number;
  tauxTVA: number; // %
  montantTVA: number;
  montantTTC: number;
  /** Taxe récupérable (assujettis) : entre dans la taxe déductible de la période. */
  tvaDeductible: boolean;
  /** Déductible du résultat : entre dans le calcul du bénéfice. */
  deductible: boolean;
  moyen: MoyenPaiement;
  reference: string;
  notes: string;
  createdAt: string;
}

/** Catégories de dépenses ; `deductible` : déductibilité du résultat proposée par défaut. */
export const CATEGORIES_DEPENSE: { value: CategorieDepense; key: string; deductible: boolean }[] = [
  { value: 'achats', key: 'cat.achats', deductible: true },
  { value: 'fournitures', key: 'cat.fournitures', deductible: true },
  { value: 'logiciels', key: 'cat.logiciels', deductible: true },
  { value: 'materiel', key: 'cat.materiel', deductible: true },
  { value: 'loyer', key: 'cat.loyer', deductible: true },
  { value: 'telecom', key: 'cat.telecom', deductible: true },
  { value: 'deplacements', key: 'cat.deplacements', deductible: true },
  { value: 'repas', key: 'cat.repas', deductible: true },
  { value: 'vehicule', key: 'cat.vehicule', deductible: true },
  { value: 'assurance', key: 'cat.assurance', deductible: true },
  { value: 'honoraires', key: 'cat.honoraires', deductible: true },
  { value: 'formation', key: 'cat.formation', deductible: true },
  { value: 'banque', key: 'cat.banque', deductible: true },
  { value: 'cotisations', key: 'cat.cotisations', deductible: false },
  { value: 'autre', key: 'cat.autre', deductible: true },
];

/** Prestation enregistrée au catalogue, insérable en une ligne de document. */
export interface Prestation {
  id?: number;
  libelle: string;
  description: string;
  unite: string;
  prixUnitaire: number;
  tauxTVA: number;
}

export type CanalRelance = 'email' | 'telephone' | 'courrier' | 'autre';

export interface Relance {
  id?: number;
  factureId: number;
  date: string;
  canal: CanalRelance;
  note: string;
}

export type FrequenceRecurrence = 'mensuelle' | 'trimestrielle' | 'annuelle';

/** Modèle de facture récurrente : génère un brouillon (ou une facture finalisée) à chaque échéance. */
export interface Recurrence {
  id?: number;
  libelle: string;
  clientId: number | null;
  objet: string;
  activite: string;
  lignes: Ligne[];
  remise: number;
  remiseType?: 'montant' | 'pourcent';
  notes: string;
  frequence: FrequenceRecurrence;
  prochaine: string;
  actif: boolean;
  finaliserAuto: boolean;
  createdAt: string;
}

/** Réglages techniques (langue, clé de licence, début d'essai…), conservés même après « Tout effacer ». */
export interface Setting {
  key: string;
  value: string;
}

/** Paramètres de régime modifiés par l'utilisateur (clé = `CODE:année`, année 0 si non annuel). */
export interface RegimeParamsRow {
  cle: string;
  /** Code du régime (FR, FR-EI, BE-SOC…) ; le nom de colonne est historique. */
  pays: string;
  annee: number;
  params: RegimeParams;
}

/** Ancien barème français (table `baremes`, versions ≤ 0.2.x), conservé pour la migration. */
export interface LegacyBareme {
  annee: number;
  cotisations: Record<string, number>;
  acreReduction: number;
  versementLiberatoire: Record<string, number>;
  cfp: Record<Nature, number>;
  chambre: { cciVente: number; cciServices: number; cmaVente: number; cmaServices: number; doubleImmatriculation: number };
  plafondCA: { vente: number; services: number };
  franchiseTVA: { venteBase: number; venteMajore: number; servicesBase: number; servicesMajore: number };
  abattement: Record<string, number>;
}

export const MOYENS: { value: MoyenPaiement; key: string }[] = [
  { value: 'virement', key: 'moyen.virement' },
  { value: 'cb', key: 'moyen.cb' },
  { value: 'especes', key: 'moyen.especes' },
  { value: 'cheque', key: 'moyen.cheque' },
  { value: 'autre', key: 'moyen.autre' },
];
