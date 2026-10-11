# AFE — Facturation et cotisations pour indépendants

Application web **offline-first**, installable comme application de bureau (PWA ou exécutable
Windows). Aucune inscription, aucun serveur : toutes les données vivent sur l'appareil (IndexedDB).

## Multi-pays, multi-statuts et multilingue

- **16 pays** prêts à l'emploi : France, Belgique, Suisse, Luxembourg, Allemagne, Autriche,
  Pays-Bas, Espagne, Italie, Portugal, Irlande, Royaume-Uni, Canada, États-Unis, Maroc, plus un
  régime générique configurable. Le pays d'imposition choisi au premier lancement (modifiable
  ensuite) détermine la **devise**, la **taxe sur les ventes** (TVA, BTW, MwSt, IVA, VAT, GST/HST,
  sales tax…) et sa franchise, les **identifiants** à faire figurer (SIRET, numéro d'entreprise,
  UID, NIF, UTR, EIN, ICE…), les **mentions légales** automatiques, les natures d'activité, la
  périodicité de déclaration et le **moteur de cotisations** (pourcentage du CA ou du revenu,
  montants fixes, barèmes progressifs, minima/plafonds, réductions de début d'activité, options
  comme l'ACRE ou le versement libératoire, retenue à la source pour l'Espagne, le Portugal…).
- **Plusieurs statuts par pays** (34 régimes au total). France : micro-entrepreneur, entreprise
  individuelle au réel (BNC/BIC à l'impôt sur le revenu, cotisations TNS sur le bénéfice), EURL/SARL
  à l'IS (gérant majoritaire TNS) et SASU/SAS à l'IS (président assimilé salarié). Pour chaque autre
  pays : « indépendant » et « société » (charges sur la rémunération du dirigeant + impôt sur les
  sociétés sur le bénéfice restant, en estimation documentée).
- **Registre des dépenses** (achats, frais, abonnements…) avec ventilation HT/taxe/TTC, catégories,
  déductibilité et export CSV. Pour les régimes au réel, le **bénéfice = recettes encaissées −
  dépenses déductibles** sert de base aux cotisations et à l'impôt ; pour les assujettis, la **taxe
  au réel** (collectée à l'encaissement pour les services, à la facturation pour les biens, moins la
  taxe déductible des dépenses) est calculée par période de déclaration avec report de crédit.
- **7 langues d'interface** : français, anglais, espagnol, allemand, italien, portugais, néerlandais.
  La langue des documents est indépendante : réglage par défaut dans les paramètres et choix
  **par document** (un client allemand reçoit sa facture en allemand). Dates et montants suivent la
  locale (fr-BE, de-CH, en-GB…).
- **Barème éditable** : pour chaque pays, les paramètres (taux, seuils, taux de taxe, coefficient de
  revenu net, composantes optionnelles) sont modifiables par année avec retour aux valeurs par défaut.
  Les valeurs 2024–2026 de la France sont celles de l'URSSAF ; les autres pays sont des estimations
  documentées (sources dans l'éditeur) à vérifier.

## Fonctionnalités

- **Devis, factures, avoirs** : éditeur rapide, enregistrement automatique des brouillons,
  numérotation chronologique continue à la finalisation (`F-2026-0001`), verrouillage des
  documents émis, conversion devis → facture, avoirs (seule façon de corriger une facture transmise),
  duplication, suivi des encaissements partiels ou complets, remboursements d'avoirs.
- **PDF en un clic** : mise en page A4 (logo, couleur, style clair ou sombre), mentions légales du
  pays ajoutées automatiquement (franchise de taxe, pénalités de retard pour les clients
  professionnels, identifiants, IBAN), mentions de période de prestation, catégorie d'opération,
  n° de commande, adresse de livraison. Impression via la boîte de dialogue du navigateur →
  « Enregistrer au format PDF ».
- **Cotisations et impôts** : calcul période par période (mensuel, trimestriel ou annuel) sur le CA
  réellement **encaissé** (ou sur le bénéfice au réel), rémunération du dirigeant et impôt sur les
  sociétés pour les sociétés, simulateur temps réel « CA → net », échéances de déclaration, tableau
  de taxe sur les ventes (collectée, déductible, à payer).
- **Tableau de bord** : CA mensuel (année en cours vs précédente), cotisations estimées, prochaine
  déclaration, impayés, devis en cours, objectif annuel avec projection, top clients, jauges de
  seuils (plafond du régime, franchise de taxe).
- **Livre des recettes** : registre chronologique des encaissements, export CSV, impression.
- **Productivité** : catalogue de prestations, relances d'impayés (e-mail pré-rempli dans la langue
  du document + historique), factures récurrentes générées automatiquement.
- **Sauvegarde / restauration** JSON, sauvegarde automatique (version bureau, toutes les 10 min),
  données de démonstration, thème clair/sombre.

## Démarrer

```bash
npm install
npm run dev
```

Puis ouvrir http://localhost:5173.

## Construire et installer comme application

```bash
npm run build
npm run preview
```

Le dossier `dist/` est entièrement statique : il peut être servi par n'importe quel hébergeur
(ou un simple `npx serve dist`). Dans Chrome ou Edge, cliquer sur « Installer » dans la barre
d'adresse : l'application s'ouvre dans sa propre fenêtre et fonctionne sans connexion.

## Version bureau Windows (Tauri)

Le dossier `src-tauri/` emballe la même interface dans une fenêtre native (WebView2, fourni
avec Windows 11). Prérequis : [Rust](https://rustup.rs) et les *Build Tools C++* de Visual
Studio 2022 (workload « Développement Desktop en C++ »).

```bash
npm run desktop:dev     # fenêtre native branchée sur le serveur Vite (rechargement à chaud)
npm run desktop:build   # exécutable + installateur
```

Résultats de `desktop:build` :

- `src-tauri/target/release/afe.exe` — exécutable portable (~10 Mo) ;
- `src-tauri/target/release/bundle/nsis/AFE_<version>_x64-setup.exe` — installateur (sans
  droits administrateur, raccourci menu Démarrer, désinstallation propre).

Dans la version bureau, l'export de sauvegarde ouvre une boîte « Enregistrer sous » native ;
le service worker PWA est désactivé (inutile hors navigateur). Les données sont stockées dans
le profil WebView2 de l'application (`%LOCALAPPDATA%\fr.afe.desktop`), les sauvegardes
automatiques dans `%APPDATA%\fr.afe.desktop\sauvegardes`. Le début de la période d'essai est en
outre consigné dans le registre (`HKCU\Software\fr.afe.support`) et dans
`%PROGRAMDATA%\fr.afe.support`, que la désinstallation conserve : réinstaller ne redonne pas
d'essai.

### Mises à jour automatiques

Au lancement, l'application interroge `https://github.com/MaiToxx/AFE/releases/latest/download/latest.json`
et propose d'installer une nouvelle version (artefacts signés). Pour publier une version :

1. incrémenter `version` dans `package.json`, `src-tauri/tauri.conf.json` et `src-tauri/Cargo.toml` ;
2. `git tag v0.3.0 && git push origin v0.3.0` : le workflow `.github/workflows/release.yml` compile et
   publie la Release (installateur, signature, `latest.json`).

Secrets GitHub requis : `TAURI_SIGNING_PRIVATE_KEY` (contenu de `scripts/updater/afe-updater.key`,
**jamais commité**) et `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` (vide). Le dépôt (ou un dépôt de
releases dédié) doit être **public** pour que les clients puissent télécharger `latest.json`.
`npm run desktop:build` lit la clé localement via `scripts/desktop-build.mjs`.

## Sécurité et intégrité des données

- **Contenu.** L'application de bureau applique une politique de sécurité du contenu stricte
  (`src-tauri/tauri.conf.json`) : elle n'exécute que ses propres scripts, n'affiche aucune image
  distante et ne peut joindre que les deux adresses de la liste des licences révoquées.
- **Fichiers.** Elle n'accède qu'à son dossier de données et aux fichiers que l'utilisateur choisit
  dans une boîte « Enregistrer sous » (`src-tauri/capabilities/default.json`).
- **Une seule instance.** Un second lancement ramène la fenêtre déjà ouverte au premier plan.
- **Documents émis.** Le numéro est attribué dans une transaction (deux finalisations simultanées
  ne peuvent ni partager un numéro ni en sauter un), et le document garde l'émetteur de sa
  finalisation : identité, adresse, identifiants, régime de taxe et mentions ne changent plus quand
  le profil change.
- **Sauvegardes.** Un fichier importé est contrôlé avant toute écriture (structure, version) et
  l'import est atomique : en cas d'erreur, les données en place sont conservées. Si la base est
  vide alors que des sauvegardes automatiques existent, l'accueil propose de les restaurer.
- **Exports CSV.** Les cellules de texte qui commencent par `=`, `+`, `-` ou `@` sont neutralisées
  pour ne pas être exécutées comme des formules par un tableur.
- **Publication.** Les actions GitHub du flux de release sont figées sur un commit précis : ce flux
  détient la clé qui signe les mises à jour.

## Licences (vente du logiciel)

L'application vérifie elle-même, sans serveur, des clés de licence signées (ECDSA P-256) :
14 jours d'essai complet, puis la finalisation de nouveaux devis/factures requiert une licence
(les données restent toujours consultables et exportables). Une révocation s'applique sans mise
à jour : l'outil vendeur publie une liste signée (`licences/revocations.json`) que l'application
télécharge à chaque lancement, et une licence qui n'a pas pu être vérifiée depuis 30 jours est
suspendue jusqu'à la prochaine connexion. Ce téléchargement ne transmet aucune donnée de
l'utilisateur. L'outillage vendeur est dans
[`scripts/license/`](scripts/license/README.md) : `keygen.mjs` (une fois), puis l'**interface de
gestion des licences** — double-clic sur `licences.cmd` ou `npm run licences` — pour émettre,
renouveler, envoyer, vérifier et révoquer les licences (la ligne de commande `issue.mjs` reste
disponible). **`scripts/license/private.jwk` et le registre sont secrets et ne sont jamais
commités** — sauvegardez-les hors ligne. Le bouton « Acheter une licence »
ouvre `PURCHASE_URL` (`src/lib/license.ts`) dans le navigateur ; tant que cette constante est
vide, il devient « Demander une licence » et ouvre un e-mail pré-rempli vers `SUPPORT_EMAIL`.

## Démonstration et export PDF en ligne de commande

- `http://localhost:5173/#/?demo=1` charge le jeu de démonstration sur une base vide (pratique
  pour présenter l'application).
- `node scripts/export-pdf.mjs <id> <fichier.pdf> [--demo] [--theme clair|sombre]` pilote
  Edge/Chrome en mode headless pour exporter un document en PDF (le serveur `npm run dev` doit
  tourner). Avec `--demo`, un profil vierge est alimenté avec les données de démonstration.

## Ajouter un pays ou une langue

- **Pays** : créer `src/regimes/presets/<code>.ts` (devise, taxe, identifiants, activités,
  périodicités, mentions, composantes de cotisations, seuils, sources) et l'ajouter à `PAYS`
  dans `src/regimes/index.ts`. Le moteur (`src/regimes/engine.ts`) sait calculer des pourcentages
  du CA, du revenu (forfaitaire ou réel), de la rémunération du dirigeant ou du résultat, des
  montants fixes mensuels et des barèmes progressifs (mensuels ou annuels), avec minimum, plafond,
  réduction de début d'activité et composantes optionnelles.
- **Statut** : un régime supplémentaire pour un pays existant porte le même `pays` et un `statutId`
  distinct (voir `fr-ei.ts`, `fr-eurl.ts`, `fr-sasu.ts`) ; une société hors France se décrit en
  quelques lignes avec la fabrique `societe()` de `presets/societe.ts` (impôt sur les sociétés,
  charges sur la rémunération, identifiants de société, mention de pied `{forme}`, `{capital}`,
  `{registre}`).
- **Langue** : créer `src/i18n/<code>.ts` à partir de `fr.ts` (dictionnaire de référence, toute
  clé manquante retombe sur le français) et déclarer la langue dans `src/i18n/index.tsx`. Les
  textes des régimes (`LText`) acceptent toutes les langues ; `fr` et `en` sont obligatoires.

## Structure

```
src/
  db/         modèle de données (types) et base Dexie (IndexedDB), hooks réactifs
  i18n/       dictionnaires d'interface (fr, en, es, de, it, pt, nl)
  regimes/    régimes par pays et statut (presets/), moteur de cotisations, migration de l'ancien barème
  lib/        documents (totaux, numérotation), dépenses, taxe au réel, statistiques, relances, récurrences, formats
  components/ interface (layout, premier lancement, graphiques SVG, formulaires, éditeur de barème)
  pages/      tableau de bord, documents, éditeur, impression, clients, cotisations, recettes, dépenses, paramètres
```

## Avertissement

Les montants de cotisations et d'impôts sont des **estimations** calculées à partir du barème
configuré. Ils ne remplacent pas la déclaration officielle auprès de l'organisme compétent de
votre pays. Vérifiez les taux en début d'année (Paramètres → Barème).
