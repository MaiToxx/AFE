# AFE — Facturation et cotisations pour indépendants

Application web **offline-first**, installable comme application de bureau (PWA ou exécutable
Windows). Aucune inscription, aucun serveur : toutes les données vivent sur l'appareil (IndexedDB).

## Multi-pays et multilingue

- **16 régimes nationaux** prêts à l'emploi : France (micro-entrepreneur), Belgique, Suisse,
  Luxembourg, Allemagne, Autriche, Pays-Bas, Espagne, Italie (forfettario), Portugal, Irlande,
  Royaume-Uni, Canada, États-Unis, Maroc, plus un régime générique configurable. Le pays
  d'imposition choisi au premier lancement (modifiable ensuite) détermine la **devise**, la **taxe
  sur les ventes** (TVA, BTW, MwSt, IVA, VAT, GST/HST, sales tax…) et sa franchise, les
  **identifiants** à faire figurer (SIRET, numéro d'entreprise, UID, NIF, UTR, EIN, ICE…), les
  **mentions légales** automatiques, les natures d'activité, la périodicité de déclaration et le
  **moteur de cotisations** (pourcentage du CA ou du revenu net, montants fixes, barèmes progressifs,
  minima/plafonds, réductions de début d'activité, options comme l'ACRE ou le versement libératoire,
  retenue à la source pour l'Espagne, le Portugal…).
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
  réellement **encaissé**, simulateur temps réel « CA → net », échéances de déclaration.
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
automatiques dans `%APPDATA%\fr.afe.desktop\sauvegardes`.

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

## Licences (vente du logiciel)

L'application se vérifie **hors ligne** avec des clés de licence signées (ECDSA P-256) :
14 jours d'essai complet, puis la finalisation de nouveaux devis/factures requiert une licence
(les données restent toujours consultables et exportables). L'outillage vendeur est dans
[`scripts/license/`](scripts/license/README.md) : `keygen.mjs` (une fois), puis
`issue.mjs --name "…" --email …` après chaque vente. **`scripts/license/private.jwk` est secret
et n'est jamais commité** — sauvegardez-le hors ligne. Le bouton « Acheter une licence »
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
  périodicités, mentions, composantes de cotisations, seuils, sources) et l'ajouter à `REGIMES`
  dans `src/regimes/index.ts`. Le moteur (`src/regimes/engine.ts`) sait calculer des pourcentages
  du CA ou du revenu net, des montants fixes mensuels et des barèmes progressifs (mensuels ou
  annuels), avec minimum, plafond, réduction de début d'activité et composantes optionnelles.
- **Langue** : créer `src/i18n/<code>.ts` à partir de `fr.ts` (dictionnaire de référence, toute
  clé manquante retombe sur le français) et déclarer la langue dans `src/i18n/index.tsx`. Les
  textes des régimes (`LText`) acceptent toutes les langues ; `fr` et `en` sont obligatoires.

## Structure

```
src/
  db/         modèle de données (types) et base Dexie (IndexedDB), hooks réactifs
  i18n/       dictionnaires d'interface (fr, en, es, de, it, pt, nl)
  regimes/    régimes par pays (presets/), moteur de cotisations, migration de l'ancien barème
  lib/        documents (totaux, numérotation), statistiques, relances, récurrences, formats
  components/ interface (layout, premier lancement, graphiques SVG, formulaires, éditeur de barème)
  pages/      tableau de bord, documents, éditeur, impression, clients, cotisations, recettes, paramètres
```

## Avertissement

Les montants de cotisations et d'impôts sont des **estimations** calculées à partir du barème
configuré. Ils ne remplacent pas la déclaration officielle auprès de l'organisme compétent de
votre pays. Vérifiez les taux en début d'année (Paramètres → Barème).
