# Licences AFE — outillage vendeur

Les licences sont des clés signées (ECDSA P-256) vérifiées **hors ligne** par l'application
grâce à la clé publique embarquée dans `src/lib/license-public-key.ts`.

| Fichier | Rôle |
|---|---|
| `private.jwk` | **Clé privée. SECRET.** Non commitée (`.gitignore`). À sauvegarder hors ligne : sans elle, impossible d'émettre de nouvelles licences compatibles avec les versions distribuées. |
| `registre.csv` | Registre des licences émises, clés comprises (non commité). |
| `sauvegardes/` | Copie quotidienne du registre avant sa première modification du jour (30 jours conservés, non commitée). |
| `admin.mjs`, `admin/` | **Interface de gestion** (voir ci-dessous). |
| `registre.mjs` | Lecture/écriture du registre et émission, communs à l'interface et à la ligne de commande. |
| `keygen.mjs` | Génère la paire de clés (une seule fois). |
| `issue.mjs` | Émet une licence en ligne de commande. |
| `verify.mjs` | Vérifie une clé en ligne de commande. |

## Interface de gestion

Double-cliquez sur **`licences.cmd`** à la racine du projet (ou lancez `npm run licences`).
Une fenêtre de console s'ouvre, puis l'interface dans votre navigateur. Laissez la console
ouverte pendant l'utilisation ; fermez-la, ou cliquez sur « Quitter », pour arrêter.

L'interface permet de :

- **voir** toutes les licences avec leur état (active, à renouveler, expirée, révoquée), les
  rechercher, les filtrer et les trier ;
- **émettre** une licence : à vie, annuelle, mensuelle ou jusqu'à une date choisie, avec une
  limite facultative de version majeure et une note privée ;
- **renouveler** un abonnement en un clic : la nouvelle période s'ajoute à l'échéance en cours
  (le client ne perd aucun jour) ; l'ancienne clé est conservée dans l'historique ;
- **envoyer** la clé au client : message pré-rédigé dans l'une des sept langues de l'application,
  à ouvrir dans votre messagerie ou dans Gmail, ou à copier ;
- **vérifier** une clé reçue d'un client (à qui elle appartient, si elle est valide) ;
- **révoquer** une licence (remboursement, clé diffusée) ou la rétablir.

`npm run licences -- --demo` ouvre l'interface avec des données fictives, sans rien enregistrer.

### Sécurité

L'outil est réservé au vendeur : il n'est pas inclus dans l'application distribuée. Le serveur
n'écoute que sur `127.0.0.1`, exige un jeton de session aléatoire (cookie `HttpOnly`,
`SameSite=Strict`), refuse les noms d'hôte et les origines étrangers, et ne renvoie jamais la
clé privée. Pour garder la clé privée et le registre ailleurs que dans le dépôt (disque chiffré,
clé USB), définissez la variable d'environnement `AFE_LICENCES_DIR` sur ce dossier.

### Révocation

L'application fonctionne hors ligne : une révocation ne peut donc pas être immédiate. L'interface
inscrit les identifiants révoqués dans `src/lib/revoked.ts`, **embarqué dans l'application**.
La licence est refusée à partir de la version publiée après la révocation ; les versions déjà
installées continuent de l'accepter tant qu'elles ne sont pas mises à jour. Après une révocation,
publiez donc une nouvelle version (ce fichier ne contient que des numéros de licence, aucun nom).

## Ligne de commande

```bash
node scripts/license/issue.mjs --name "Jean Dupont" --email jean@exemple.fr
```

Options : `--plan abonnement --expires 2027-12-31` (licence à durée limitée), `--periode mensuel`
ou `annuel` (durée proposée au renouvellement), `--max-major 1` (licence limitée aux versions
1.x : les mises à jour majeures peuvent alors être vendues séparément), `--note "commande #123"`
(note privée, conservée dans le registre et non inscrite dans la clé), `--langue en` (langue du
message au client).

Le client colle la clé dans **Paramètres → Licence → Activer**. La clé n'est liée à aucune
machine ; elle affiche le nom et l'e-mail de l'acheteur dans l'application, ce qui dissuade le
partage.

## Registre

`registre.csv` (séparateur « ; », UTF-8) contient une ligne par clé émise : `id`, `date`, `nom`,
`email`, `plan`, `expire`, `maxMajor`, `note`, `cle`, puis `periode`, `remplace` (clé que celle-ci
renouvelle), `revoquee` (date de révocation) et `langue`. Les registres créés par les versions
précédentes (neuf colonnes) sont lus tels quels et complétés à la première modification. Les
colonnes que vous ajoutez dans un tableur sont conservées. Fermez le tableur avant d'utiliser
l'interface : un fichier verrouillé ne peut pas être mis à jour.

## Abonnements

Un abonnement est une licence avec une date d'expiration. Chaque renouvellement produit une
**nouvelle clé** à envoyer au client, qui la colle à la place de l'ancienne. Le filtre
« À renouveler » liste les abonnements arrivant à échéance sous 14 jours ou échus depuis moins
de 30 jours.

## Comportement côté application

- 14 jours d'essai complet à partir du premier lancement (`settings.trialStart`).
- Sans licence ensuite : consultation, export et PDF des documents existants restent possibles ;
  la **finalisation** de nouveaux devis/factures est bloquée jusqu'à activation.
- Licence expirée (abonnement), révoquée ou version non couverte (`maxMajor`) : même comportement.
- La licence est incluse dans les sauvegardes JSON : le client la retrouve en changeant de machine.

## Limites (hors ligne, sans serveur)

- Un utilisateur peut réinitialiser l'essai en effaçant les données du navigateur / de l'application.
- Une clé peut être partagée entre plusieurs personnes, et une révocation n'agit qu'à la mise à
  jour suivante. Pour aller plus loin : activation en ligne avec limitation du nombre de machines
  et révocation immédiate — cela nécessite un petit serveur.
- Ne régénérez jamais la paire de clés (`keygen.mjs --force`) sans distribuer une nouvelle
  version de l'application et réémettre toutes les licences.
