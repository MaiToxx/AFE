# AFE — Tableau de bord pour auto-entrepreneurs

Application web **offline-first**, installable comme application de bureau (PWA). Aucune
inscription, aucun serveur : toutes les données vivent dans le navigateur (IndexedDB).

## Fonctionnalités

- **Devis et factures** : éditeur rapide, enregistrement automatique des brouillons,
  numérotation chronologique continue à la finalisation (`F-2026-0001`), verrouillage des
  factures finalisées, conversion devis → facture, duplication, annulation, suivi des
  encaissements (partiels ou complets).
- **PDF en un clic** : mise en page A4 propre (logo, couleur d'accent, mentions légales
  automatiques : franchise de TVA, pénalités de retard et indemnité de 40 € pour les clients
  professionnels, IBAN, SIRET…). Impression via la boîte de dialogue du navigateur →
  « Enregistrer au format PDF ».
- **Cotisations sociales** : calcul période par période (mensuel ou trimestriel) sur le CA
  réellement **encaissé**, avec ACRE, CFP, taxe pour frais de chambre consulaire et versement
  libératoire. Simulateur temps réel « CA → net ».
- **Tableau de bord** : CA mensuel (année en cours vs précédente), cotisations estimées,
  prochaine déclaration, impayés, jauges de plafond micro et de franchise de TVA.
- **Barème modifiable** : les taux URSSAF (2024–2026 inclus) sont éditables par année.
- **Sauvegarde / restauration** JSON, données de démonstration, thème clair/sombre.

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
- `src-tauri/target/release/bundle/nsis/AFE_0.1.0_x64-setup.exe` — installateur (sans
  droits administrateur, raccourci menu Démarrer, désinstallation propre).

Dans la version bureau, l'export de sauvegarde ouvre une boîte « Enregistrer sous » native ;
le service worker PWA est désactivé (inutile hors navigateur). Les données sont stockées dans
le profil WebView2 de l'application (`%LOCALAPPDATA%\fr.afe.desktop`).

## Démonstration et export PDF en ligne de commande

- `http://localhost:5173/#/?demo=1` charge le jeu de démonstration sur une base vide (pratique
  pour présenter l'application).
- `node scripts/export-pdf.mjs <id> <fichier.pdf> [--demo]` pilote Edge/Chrome en mode headless
  pour exporter un document en PDF (le serveur `npm run dev` doit tourner). Avec `--demo`, un profil
  vierge est alimenté avec les données de démonstration avant l'export.

## Structure

```
src/
  db/        modèle de données (types) et base Dexie (IndexedDB), hooks réactifs
  lib/       barème URSSAF, calcul des cotisations, documents (totaux, numérotation), stats
  components/ interface (layout, graphiques SVG, formulaires)
  pages/     tableau de bord, documents, éditeur, impression, clients, cotisations, paramètres
```

## Avertissement

Les montants de cotisations sont des **estimations** calculées à partir du barème configuré.
Ils ne remplacent pas la déclaration officielle sur autoentrepreneur.urssaf.fr. Vérifiez les
taux en début d'année (Paramètres → Barème URSSAF).
