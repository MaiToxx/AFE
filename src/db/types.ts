// Modèle de données. Tout est stocké localement (IndexedDB via Dexie).

/** Catégorie d'activité au sens URSSAF : détermine le taux de cotisations. */
export type ActivityKind = 'vente' | 'bic' | 'bnc' | 'cipav' | 'meuble';

/** Nature de l'activité : détermine la CFP et la taxe pour frais de chambre consulaire. */
export type Nature = 'commercant' | 'artisan' | 'liberal';

export type Frequence = 'mensuelle' | 'trimestrielle';

export type DocType = 'devis' | 'facture';

export type DevisStatut = 'brouillon' | 'envoye' | 'accepte' | 'refuse';
export type FactureStatut = 'brouillon' | 'envoyee' | 'payee' | 'annulee';
export type Statut = DevisStatut | FactureStatut;

export type MoyenPaiement = 'virement' | 'cb' | 'especes' | 'cheque' | 'autre';

export interface Profile {
  id: number; // toujours 1
  nom: string;
  prenom: string;
  denomination: string; // nom commercial (optionnel)
  adresse: string;
  codePostal: string;
  ville: string;
  email: string;
  telephone: string;
  siret: string;
  siteWeb: string;
  activiteLibelle: string;
  activite: ActivityKind; // activité par défaut des nouveaux documents
  nature: Nature;
  doubleImmatriculation: boolean; // artisan aussi inscrit au RCS
  frequence: Frequence;
  dateDebutActivite: string; // ISO yyyy-mm-dd
  acre: boolean;
  versementLiberatoire: boolean;
  assujettiTVA: boolean;
  tauxTVA: number; // %
  numeroTVA: string;
  // Personnalisation des documents
  logo: string; // data URL
  couleur: string; // hex
  prefixeFacture: string;
  prefixeDevis: string;
  delaiPaiementJours: number;
  validiteDevisJours: number;
  conditionsPaiement: string;
  mentionsPied: string;
  iban: string;
  bic: string;
}

export interface Client {
  id?: number;
  nom: string;
  type: 'pro' | 'particulier';
  adresse: string;
  codePostal: string;
  ville: string;
  email: string;
  telephone: string;
  siret: string;
  notes: string;
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
  email: string;
  siret: string;
}

export interface Doc {
  id?: number;
  type: DocType;
  numero: string; // vide tant que brouillon
  numeroSeq: number; // 0 tant que brouillon
  statut: Statut;
  clientId: number | null;
  client: ClientSnapshot | null; // figé à la finalisation
  objet: string;
  dateEmission: string; // ISO
  dateEcheance: string; // facture : échéance ; devis : fin de validité
  activite: ActivityKind;
  lignes: Ligne[];
  remise: number; // € HT
  notes: string;
  devisId: number | null; // facture issue d'un devis
  factureId: number | null; // devis converti en facture
  totalHT: number;
  totalTVA: number;
  totalTTC: number;
  createdAt: string;
  updatedAt: string;
}

export interface Paiement {
  id?: number;
  factureId: number | null; // null = encaissement libre (sans facture)
  date: string; // date d'encaissement (fait générateur des cotisations)
  montant: number; // TTC encaissé
  moyen: MoyenPaiement;
  activite: ActivityKind;
  libelle: string;
}

/** Réglages techniques (clé de licence, début d'essai…), conservés même après « Tout effacer ». */
export interface Setting {
  key: string;
  value: string;
}

export interface Bareme {
  annee: number;
  cotisations: Record<ActivityKind, number>; // % du CA
  acreReduction: number; // % de réduction des cotisations pendant l'ACRE
  versementLiberatoire: Record<ActivityKind, number>; // % du CA
  cfp: Record<Nature, number>; // % du CA
  chambre: {
    cciVente: number;
    cciServices: number;
    cmaVente: number;
    cmaServices: number;
    doubleImmatriculation: number;
  };
  plafondCA: { vente: number; services: number };
  franchiseTVA: {
    venteBase: number;
    venteMajore: number;
    servicesBase: number;
    servicesMajore: number;
  };
  abattement: Record<ActivityKind, number>; // % (régime micro, sans VL)
}

export const ACTIVITES: { value: ActivityKind; label: string; court: string }[] = [
  { value: 'vente', label: 'Vente de marchandises, fourniture de logement (BIC)', court: 'Vente' },
  { value: 'bic', label: 'Prestations de services commerciales ou artisanales (BIC)', court: 'Services BIC' },
  { value: 'bnc', label: 'Prestations de services et professions libérales non réglementées (BNC)', court: 'BNC' },
  { value: 'cipav', label: 'Professions libérales réglementées relevant de la CIPAV (BNC)', court: 'CIPAV' },
  { value: 'meuble', label: 'Location de meublés de tourisme classés', court: 'Meublés classés' },
];

export const NATURES: { value: Nature; label: string }[] = [
  { value: 'commercant', label: 'Commerçant (CCI)' },
  { value: 'artisan', label: 'Artisan (CMA)' },
  { value: 'liberal', label: 'Profession libérale' },
];

export const MOYENS: { value: MoyenPaiement; label: string }[] = [
  { value: 'virement', label: 'Virement' },
  { value: 'cb', label: 'Carte bancaire' },
  { value: 'especes', label: 'Espèces' },
  { value: 'cheque', label: 'Chèque' },
  { value: 'autre', label: 'Autre' },
];

/** Les activités "vente" au sens des plafonds et seuils (vs prestations de services). */
export function isVente(a: ActivityKind): boolean {
  return a === 'vente';
}

/** Les activités relevant du seuil TVA "vente / hébergement" (85 000 €). */
export function isTVAVente(a: ActivityKind): boolean {
  return a === 'vente' || a === 'meuble';
}
