# Licences AFE — outillage vendeur

Les licences sont des clés signées (ECDSA P-256) vérifiées **hors ligne** par l'application
grâce à la clé publique embarquée dans `src/lib/license-public-key.ts`.

| Fichier | Rôle |
|---|---|
| `private.jwk` | **Clé privée. SECRET.** Non commitée (`.gitignore`). À sauvegarder hors ligne : sans elle, impossible d'émettre de nouvelles licences compatibles avec les versions distribuées. |
| `registre.csv` | Journal des licences émises (non commité). |
| `keygen.mjs` | Génère la paire de clés (une seule fois). |
| `issue.mjs` | Émet une licence après une vente. |
| `verify.mjs` | Vérifie une clé. |

## Émettre une licence après une vente

```bash
node scripts/license/issue.mjs --name "Jean Dupont" --email jean@exemple.fr
```

Options : `--plan abonnement --expires 2027-12-31` (licence à durée limitée),
`--max-major 1` (licence perpétuelle limitée aux versions 1.x : les mises à jour majeures
peuvent alors être vendues séparément), `--note "commande #123"`.

Envoyez la clé affichée au client : il la colle dans **Paramètres → Licence → Activer**.
La clé n'est liée à aucune machine ; elle affiche le nom et l'e-mail de l'acheteur dans
l'application, ce qui dissuade le partage.

## Comportement côté application

- 14 jours d'essai complet à partir du premier lancement (`settings.trialStart`).
- Sans licence ensuite : consultation, export et PDF des documents existants restent possibles ;
  la **finalisation** de nouveaux devis/factures est bloquée jusqu'à activation.
- Licence expirée (abonnement) ou version non couverte (`maxMajor`) : même comportement.
- La licence est incluse dans les sauvegardes JSON : le client la retrouve en changeant de machine.

## Limites (hors ligne, sans serveur)

- Un utilisateur peut réinitialiser l'essai en effaçant les données du navigateur / de l'application.
- Une clé peut être partagée entre plusieurs personnes. Pour aller plus loin : activation en
  ligne avec limitation du nombre de machines et révocation — cela nécessite un petit serveur.
- Ne régénérez jamais la paire de clés (`keygen.mjs --force`) sans distribuer une nouvelle
  version de l'application et réémettre toutes les licences.
