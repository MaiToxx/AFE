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
/**
 * Base d'une composante : chiffre d'affaires, revenu (forfaitaire ou réel), rémunération du dirigeant
 * ou résultat (revenu − rémunération − composantes sociales), ce dernier servant à l'impôt.
 */
export type BaseComposante = 'ca' | 'net' | 'remuneration' | 'resultat';
/** Revenu retenu : part forfaitaire du CA (micro) ou réel (recettes − dépenses déductibles). */
export type BaseRevenu = 'forfait' | 'reel';
/** Personne physique (indépendant) ou société (dirigeant rémunéré, impôt sur les sociétés). */
export type Forme = 'personne' | 'societe';

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
  /** Base de calcul ; par défaut le CA pour pct_ca, le revenu pour les autres types. */
  base?: BaseComposante;
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
  /** `reel` : le revenu est recettes − dépenses déductibles (le coefficient est ignoré). Défaut : forfait. */
  baseRevenu?: BaseRevenu;
  composantes: Composante[];
}

export type RegleEcheance = { type: 'jours'; jours: number } | { type: 'fin_mois_suivant' };

export interface Regime {
  /** Identifiant unique du régime (FR, FR-EI, BE-SOC…) ; clé des surcharges de paramètres. */
  code: string;
  /** Pays d'imposition (ISO 3166-1, XX = générique). */
  pays: string;
  /** Statut au sein du pays (micro, ei, eurl, sasu, independant, societe…) ; le premier déclaré est le défaut. */
  statutId: string;
  forme: Forme;
  nom: LText;
  drapeau: string;
  devise: string;
  /** Langues proposées en priorité pour ce pays (la première sert de défaut). */
  langues: Lang[];
  statut: LText;
  /** Rémunération du dirigeant saisie dans le profil (sociétés) : libellé et aide du champ. */
  remuneration?: { label: LText; aide: LText };
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
    /** Périodicités de déclaration de la taxe (défaut : celles du régime + annuelle). */
    periodicites?: Frequence[];
    periodiciteDefaut?: Frequence;
    /** Échéance de la déclaration de taxe (défaut : celle du régime). */
    echeance?: RegleEcheance;
  };
  mentions: {
    /** Pénalités de retard (clients professionnels). Vide : rien n'est imprimé. */
    retard: LText;
    /**
     * Mention de bas de page spécifique (ex. France : dispensé d'immatriculation). Peut contenir des
     * `{identifiant}` remplacés par les identifiants du profil (forme, capital, registre…).
     */
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
