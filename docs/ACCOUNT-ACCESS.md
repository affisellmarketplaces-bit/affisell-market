# Neutraliser des comptes — verrou réversible et fin des sessions

## Ce que fait le code (PR #14)

- **Verrou** : le hash bcrypt stocké est préfixé par `locked-AAAA-MM-JJ:` (`lib/auth-account-lock.ts`). La connexion par mot de passe est refusée comme un mauvais mot de passe, sans appeler bcrypt. Retirer le préfixe rétablit le compte à l'identique : profils, acceptations légales et données métier ne sont pas touchés.
- **Sessions ouvertes** : les sessions JWT durent 30 jours et ne sont pas révocables une par une. Le callback `jwt` relit donc le compte au plus toutes les 5 minutes (`SESSION_REVALIDATE_MS`) :
  - un compte verrouillé ou supprimé perd sa session (le cookie est effacé) ;
  - un changement de rôle est appliqué ;
  - une erreur de base de données garde la session (journalisée) et ne déconnecte personne.

  La lecture ne charge jamais le hash : elle utilise un `count` avec un filtre sur le préfixe.
- **Preuves** :
  - `lib/__tests__/auth-session-revalidation.test.ts` exécute le vrai Auth.js : refus de connexion, fin de session après verrou, suppression, changement de rôle, panne de la base ;
  - contrôle par mutation : la revalidation désactivée fait échouer 2 tests.

## Outil : `scripts/account-access.ts`

Il fonctionne en simulation (*dry run*) par défaut. `--apply` exécute une seule transaction qui relit les comptes sous verrou de ligne, revérifie le plan, et annule tout si le nombre de lignes diffère de `--expect`. Il n'affiche ni hash ni mot de passe. En production, il exige `AFFISELL_ALLOW_PRODUCTION_WRITES=<endpoint>`.

| Commande | Effet |
|---|---|
| `create-admin --email <e>` | Crée un ADMIN nominatif. Mot de passe dans `ADMIN_BOOTSTRAP_PASSWORD` : au moins 16 caractères, refusé s'il figure dans la liste des valeurs publiées. |
| `lock --emails a,b --expect 2` | Verrouille les comptes. Refus si un compte manque, n'a pas de mot de passe, est déjà verrouillé, ou si cela retirerait le **dernier ADMIN actif**. |
| `unlock --emails a --expect 1` | Retire le préfixe (retour arrière). |

## Ordre d'exécution (à lancer par le propriétaire, depuis sa machine)

0. Pré-requis : déployer PR #14. Sans le code déployé, le verrou bloque déjà la connexion (le hash préfixé ne correspond plus), mais les sessions déjà ouvertes durent jusqu'à 30 jours.
1. Créer l'admin nominatif :
   `create-admin --email <vous>@affisell.com`, simulation puis `--apply`.
2. Se connecter avec ce nouvel admin et vérifier l'accès à `/admin`.
3. Verrouiller les 7 comptes de test :
   `lock --expect 7 --emails affiliate-test@affisell.com,gate-affiliate@affisell.com,supplier-test@affisell.com,gate-supplier@affisell.com,privacy-test@affisell.com,gate-customer@affisell.com,gate-legacy@affisell.com`.
4. Verrouiller `admin@affisell.io` (`--expect 1`). L'outil refuse tant que l'étape 1 n'a pas créé un autre admin actif.
5. Preuves : `status --emails …` avant et après chaque étape (date, rôle, verrou, nombre d'admins actifs ; jamais de hash) — copier la sortie dans `docs/OPERATIONS-LOG-2026-11.md`.
6. Retour arrière : `unlock` avec les mêmes e-mails.

Ce mécanisme est une alternative au SQL du §7 de `MEDUSA-CREDENTIALS-REMEDIATION.md`, avec les mêmes effets et davantage de garde-fous.

## Renouvellement coordonné d'`AUTH_SECRET`

`AUTH_SECRET` (ou `NEXTAUTH_SECRET`, même valeur) ne signe pas seulement les sessions. Effet d'un changement de valeur :

| Usage | Fichier | Effet du renouvellement |
|---|---|---|
| Sessions (cookie JWT) | `lib/auth.ts`, `proxy.ts` | Tout le monde est déconnecté une fois. C'est l'effet recherché : une session éventuellement forgée avec l'ancienne valeur meurt aussi. |
| Lien magique checkout | `lib/buyer-checkout-magic.ts` | Durée de vie 10 min : seuls les liens en cours sont perdus. |
| Pass anti-bot | `lib/security/human-pass.ts` | Durée de vie 24 h : le contrôle est simplement redemandé. |
| Capture AliExpress | `lib/fulfillment/ae-capture-token.ts` | Durée de vie 15 min : une capture en cours est à relancer. |
| Référence `APS-…` montrée aux fournisseurs | `lib/supplier-partner-listing-ref.ts` | **Permanente** : toutes les références changeraient. À figer avant le renouvellement (étape 1). |
| État OAuth Shopify | `lib/supplier-sync/shopify/oauth.ts` | Non concerné tant que `SHOPIFY_API_SECRET` ou `CRON_SECRET` est défini. |

Depuis cette PR, la capture AliExpress et la référence `APS-…` refusent de signer en production sans secret (`lib/security/app-secret.ts`). Avant, elles se rabattaient sur un texte publié dans le dépôt, donc falsifiable.

Procédure, une fois le compte Vercel débloqué et dans l'environnement Production :

1. Copier la valeur actuelle d'`AUTH_SECRET` dans `SUPPLIER_PARTNER_LISTING_REF_SECRET`, pour figer les références `APS-…`.
2. Générer une nouvelle valeur (`openssl rand -base64 48`) et la mettre dans `AUTH_SECRET`. Mettre la même valeur dans `NEXTAUTH_SECRET`, ou supprimer cette variable : `proxy.ts` et `lib/auth.ts` doivent lire la même valeur.
3. Redéployer, après les PR #13 et #14.
4. Vérifier, et garder la trace : un ancien cookie de session est refusé ; une nouvelle connexion fonctionne ; une référence `APS-…` connue est inchangée.
5. Prévenir les utilisateurs actifs qu'ils doivent se reconnecter une fois.
