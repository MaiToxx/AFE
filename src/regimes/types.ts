// Modèle d'un « régime » : tout ce qui dépend du pays d'imposition (devise, TVA, identifiants,
// mentions légales, catégories d'activité, périodicité et composantes de prélèvements).
import type { Lang } from '../i18n';

/** Texte localisé : français et anglais obligatoires, autres langues facultatives. */
export type LText = { fr: string; en: string } & Partial<Record<Lang, string>>;

export type Groupe = 'vente' | 'services';
export type Frequence = 'mensuelle' | 'trimestrielle' | 'annuelle';
export type Nature = 'commercant' | 'artisan' | 'liberal';

export interface Activite {
  id: string;
  label: LText;
  court: LText;
  /** Groupe pour les plafonds du régime. */
  groupe: Groupe;
  /** Groupe pour les seuils de TVA (France : meublés classés = vente). */
  groupeTva?: Groupe;
}

export interface Seuil {
  id: string;
  kind: 'regime' | 'tva';
  label: LText;
  /** Activités concernées : groupe de plafond, groupe TVA ou toutes. */
  groupe: Groupe | 'tous';
  valeur: number;
  /** Seuil majoré (dépassement immédiat), le cas échéant. */
  majore?: number;
  note?: LText;
}

export type TypeComposante = 'pct_ca' | 'pct_net' | 'fixe_mois' | 'tranches_mois' | 'tranches_annuel';
export type Categorie = 'social' | 'impot' | 'autre';
export type OptionComposante = 'acre' | 'vl' | 'doubleImmatriculation';

export interface Tranche {
  /** Borne supérieure (revenu annuel pour `tranches_annuel`, mensuel pour `tranches_mois`) ; null = sans limite. */
  jusqua: number | null;
  /** Taux marginal (%) pour `tranches_annuel`. */
  taux?: number;
  /** Montant mensuel pour `tranches_mois`. */
  montant?: number;
}

export interface Composante {
  id: string;
  label: LText;
  categorie: Categorie;
  type: TypeComposante;
  /** Taux (%) par défaut pour pct_ca / pct_net. */
  taux?: number;
  tauxParActivite?: Record<string, number>;
  tauxParGroupeTva?: Partial<Record<Groupe, number>>;
  tauxParNature?: Partial<Record<Nature, number>>;
  /** Montant mensuel pour fixe_mois. */
  montant?: number;
  tranches?: Tranche[];
  /** Plancher / plafond annuels du montant de la composante. */
  min?: number;
  max?: number;
  /** Base plafonnée (revenu annuel maximal soumis), pour pct_net. */
  baseMax?: number;
  /** N'existe que pour ces natures (France). */
  natures?: Nature[];
  /** Activée par une option du profil (ACRE, versement libératoire, double immatriculation). */
  option?: OptionComposante;
  /** Composante facultative activable dans le profil (clé `optionsRegime[id]`). */
  optionnel?: boolean;
  activeParDefaut?: boolean;
  /** Réduction de début d'activité (ACRE, tarifa plana, start-up…), si le profil l'a déclarée. */
  reductionDebut?: { facteur: number; mois: number; alignTrimestre?: boolean };
  note?: LText;
}

export interface RegimeParams {
  seuils: Seuil[];
  tvaTaux: number[];
  tvaDefaut: number;
  /** Part du CA considérée comme revenu net (1 = pas d'abattement), globale ou par activité. */
  coefficientNet: number | Record<string, number>;
  composantes: Composante[];
}

export type RegleEcheance = { type: 'jours'; jours: number } | { type: 'fin_mois_suivant' };

export interface Regime {
  code: string;
  nom: LText;
  drapeau: string;
  devise: string;
  /** Langues proposées en priorité pour ce pays (la première sert de défaut). */
  langues: Lang[];
  statut: LText;
  activites: Activite[];
  activiteDefaut: string;
  natures?: { id: Nature; label: LText }[];
  /** Identifiants officiels à afficher sur les documents ; `pourTva` : seulement si assujetti. */
  identifiants: { id: string; label: LText; placeholder?: string; pourTva?: boolean }[];
  identifiantClient: LText;
  tva: {
    nom: string;
    franchisePossible: boolean;
    mentionFranchise: LText;
    mentionNumero: LText;
  };
  mentions: {
    /** Pénalités de retard (clients professionnels). Vide : rien n'est imprimé. */
    retard: LText;
    /** Mention de bas de page spécifique (ex. France : dispensé d'immatriculation). */
    pied?: LText;
    /** Natures pour lesquelles la mention de pied s'affiche (toutes si absent). */
    piedNatures?: Nature[];
    /** Mention imprimée quand une retenue à la source s'applique. */
    retenue?: LText;
  };
  periodicites: Frequence[];
  periodiciteDefaut: Frequence;
  echeance: RegleEcheance;
  options: {
    acre?: { label: LText; aide: LText };
    vl?: { label: LText; aide: LText };
    retenue?: { label: LText; tauxDefaut: number; proSeulement: boolean };
  };
  /** Paramètres par année (clé = année) ou uniques (clé 0). */
  params: Record<number, RegimeParams>;
  livreRecettes: LText;
  avertissement: LText;
  sources: string[];
}
