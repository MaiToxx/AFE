# Licences AFE — outillage vendeur

Les licences sont des clés signées (ECDSA P-256) que l'application vérifie elle-même, sans
serveur, grâce à la clé publique embarquée dans `src/lib/license-public-key.ts`. Seule la liste
des licences révoquées est consultée en ligne (voir « Révocation »).

| Fichier | Rôle |
|---|---|
| `private.jwk` | **Clé privée. SECRET.** Non commitée (`.gitignore`). À sauvegarder hors ligne : sans elle, impossible d'émettre de nouvelles licences compatibles avec les versions distribuées, ni de révoquer. |
| `registre.csv` | Registre des licences émises, clés comprises (non commité). |
| `sauvegardes/` | Copie quotidienne du registre avant sa première modification du jour (30 jours conservés, non commitée). |
| `admin.mjs`, `admin/` | **Interface de gestion** (voir ci-dessous). |
| `registre.mjs` | Lecture/écriture du registre, émission et liste signée des révocations, communs à l'interface et à la ligne de commande. |
| `publication.mjs` | Publication en ligne de la liste des révocations (git) et choix du format des clés. |
| `../../licences/revocations.json` | **Liste signée des licences révoquées**, publiée dans le dépôt et téléchargée par l'application. Elle ne contient que des numéros de licence, aucun nom. |
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
- **révoquer** une licence (remboursement, clé diffusée) ou la rétablir : la décision est publiée
  en ligne aussitôt et s'applique sans mise à jour de l'application.

`npm run licences -- --demo` ouvre l'interface avec des données fictives, sans rien enregistrer.
`npm run licences -- --sans-publication` n'envoie rien en ligne de lui-même : la liste des
révocations se publie alors avec le bouton « Publier maintenant ».

### Sécurité

L'outil est réservé au vendeur : il n'est pas inclus dans l'application distribuée. Le serveur
n'écoute que sur `127.0.0.1`, exige un jeton de session aléatoire (cookie `HttpOnly`,
`SameSite=Strict`), refuse les noms d'hôte et les origines étrangers, et ne renvoie jamais la
clé privée. Pour garder la clé privée et le registre ailleurs que dans le dépôt (disque chiffré,
clé USB), définissez la variable d'environnement `AFE_LICENCES_DIR` sur ce dossier.

### Révocation

Révoquer ou rétablir une licence prend effet **sans mise à jour de l'application** :

1. l'outil inscrit la décision au registre, puis régénère la liste signée
   `licences/revocations.json` et sa copie embarquée `src/lib/revocation-list.ts` ;
2. il valide ces deux fichiers, et eux seuls, puis les pousse sur la branche `main` du dépôt ;
3. l'application télécharge la liste depuis `raw.githubusercontent.com` (à défaut, depuis son
   miroir jsDelivr), en vérifie la signature avec la clé publique embarquée et l'applique.

L'application consulte la liste à chaque lancement, à l'activation d'une clé, puis au plus toutes
les six heures tant qu'elle reste ouverte. GitHub met environ cinq minutes à servir un fichier
modifié : une révocation est donc effective au premier lancement connecté qui suit, quelques
minutes après la publication. Vous seul pouvez révoquer ou rétablir une licence : une liste qui
n'est pas signée par votre clé privée est ignorée, de même qu'une liste plus ancienne que celle
déjà reçue. Le téléchargement ne transmet aucune donnée de l'utilisateur.

**Hors connexion.** Une licence reste utilisable 30 jours après la dernière vérification réussie
(ou après son émission, si elle est plus récente). Passé ce délai, la finalisation des documents
est suspendue jusqu'à la prochaine connexion ; les données restent accessibles. Sans cette règle,
il suffirait de couper l'accès à Internet pour échapper à une révocation. Le délai se règle dans
`src/lib/revocations.ts` (`REVOCATION_GRACE_DAYS` ; `0` supprime toute exigence de connexion).
Une panne de votre côté (fichier absent, service en erreur) ne pénalise jamais le client : seule
l'impossibilité de joindre le service fait courir le délai.

**Publication.** Elle suppose que le dépôt soit sur la branche `main` et que `git push` fonctionne
depuis ce poste. La liste est aussi remise en accord avec le registre, et publiée, à chaque
démarrage de l'outil. Si l'envoi échoue (pas de connexion, dépôt en ligne en avance), la
révocation reste enregistrée, un bandeau le signale et le bouton « Publier maintenant » relance
l'envoi. Attention : `git push origin main` envoie aussi les commits locaux pas encore poussés.

**Format des clés.** Les versions 0.4.1 et antérieures ne consultent pas la liste en ligne. Pour
qu'une clé ne puisse pas s'y réfugier, les clés émises une fois la version 0.4.2 publiée sont à un
format (`v: 2`) que ces anciennes versions refusent ; le message au client l'invite alors à
installer la dernière version. L'outil lit la version publiée dans `latest.json` (l'adresse de
mise à jour automatique) et bascule de lui-même ; tant qu'elle est antérieure à 0.4.2, ou
illisible, il émet au format d'origine. Les clés émises avant cette bascule restent acceptées par
toutes les versions : sur une version 0.4.1 ou antérieure, leur révocation ne prend effet qu'à la
mise à jour.

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
renouvelle), `revoquee` (date de révocation), `langue` et `format` (format de la clé, 1 ou 2).
Les registres créés par les versions précédentes sont lus tels quels et complétés à la première
modification. Les
colonnes que vous ajoutez dans un tableur sont conservées. Fermez le tableur avant d'utiliser
l'interface : un fichier verrouillé ne peut pas être mis à jour.

## Abonnements

Un abonnement est une licence avec une date d'expiration. Chaque renouvellement produit une
**nouvelle clé** à envoyer au client, qui la colle à la place de l'ancienne. Le filtre
« À renouveler » liste les abonnements arrivant à échéance sous 14 jours ou échus depuis moins
de 30 jours.

## Comportement côté application

- 14 jours d'essai complet à partir du premier lancement (`settings.trialStart`).
- **L'essai ne se relance pas en réinstallant.** Dans l'application Windows, la date de début est
  aussi consignée hors du dossier de l'application, à deux endroits que la désinstallation
  n'efface pas : la valeur `etat` de la clé de registre `HKCU\Software\fr.afe.support` et le
  fichier `%PROGRAMDATA%\fr.afe.support\etat.dat` (commun à tous les comptes de la machine).
  Au lancement, la plus ancienne des dates connues l'emporte, et un emplacement effacé est recréé
  à partir de l'autre. Restaurer une sauvegarde ne repousse pas non plus le début de l'essai. La
  valeur consignée est une date encodée, sans aucune donnée personnelle.
- Sans licence ensuite : consultation, export et PDF des documents existants restent possibles ;
  la **finalisation** de nouveaux devis/factures est bloquée jusqu'à activation. Le contrôle est
  fait au moment où le numéro du document est attribué (`src/lib/licenseGate.ts`), pas seulement
  par les écrans : il vaut aussi pour les factures récurrentes finalisées automatiquement.
- **Horloge reculée.** L'essai se décompte depuis la plus haute date que l'application a observée.
  Pour une licence, la date du jour n'est jamais prise antérieure à la compilation de la version
  installée ni à la signature de la dernière liste de révocations reçue.
- Licence expirée (abonnement), révoquée, non vérifiée en ligne depuis plus de 30 jours ou
  version non couverte (`maxMajor`) : même comportement.
- La licence est incluse dans les sauvegardes JSON : le client la retrouve en changeant de machine.

## Limites (sans serveur)

- La protection de l'essai vise la réinstallation simple. Un utilisateur averti qui supprime à la
  fois la valeur du registre, le fichier de `%PROGRAMDATA%` et les données de l'application repart
  de zéro. Dans la version web, effacer les données du site suffit : un navigateur ne permet pas
  de conserver la date ailleurs.
- Une horloge reculée en permanence, avant chaque lancement, échappe encore au décompte de l'essai.
- Le code source est public : une personne capable de le compiler peut en retirer les contrôles.
  Rendre le dépôt privé demande de publier ailleurs les versions et la liste des révocations, que
  les applications installées téléchargent depuis ce dépôt.
- Une clé peut être partagée entre plusieurs personnes ; la révoquer la désactive partout. Limiter
  le nombre de machines par clé demanderait une activation en ligne, donc un petit serveur.
- Une clé émise avant la publication de la version 0.4.2 reste utilisable, même révoquée, sur une
  version 0.4.1 ou antérieure qui n'est jamais mise à jour.
- Ne régénérez jamais la paire de clés (`keygen.mjs --force`) sans distribuer une nouvelle
  version de l'application et réémettre toutes les licences.
