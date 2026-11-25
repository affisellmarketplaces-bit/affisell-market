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
5. Retour arrière : `unlock` avec les mêmes e-mails.

Ce mécanisme est une alternative au SQL du §7 de `MEDUSA-CREDENTIALS-REMEDIATION.md`, avec les mêmes effets et davantage de garde-fous.
