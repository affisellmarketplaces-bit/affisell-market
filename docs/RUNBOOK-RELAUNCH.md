# Runbook de relance — fusions, configuration, comptes

Ordre unique, de la facture Vercel à la vérification finale. Chaque étape indique **qui** l'exécute, **la preuve** à
conserver dans `docs/OPERATIONS-LOG-2026-11.md` et **le retour arrière**. Rien ici n'est exécuté par Claude : la
production et Vercel restent entre les mains du fondateur.

Détails techniques : `docs/PR13-DEPLOY-AND-INTEGRATION.md` (Lightning), `docs/ACCOUNT-ACCESS.md` (comptes,
`AUTH_SECRET`), `docs/MEDUSA-CREDENTIALS-REMEDIATION.md` (Medusa).

## 0. État de départ (vérifié le 2026-11-26)

| PR | Contenu | CI | Migration |
|---|---|---|---|
| #13 | Verrou Lightning (`LIGHTNING_PAYOUTS_MODE`) | verte | aucune |
| #14 | Identifiants publiés retirés, scan CI, verrou réversible + fin des sessions, liste blanche admin, secrets à échec fermé | verte (Lighthouse : cause corrigée par #15) | aucune |
| #15 | Performance accueil (catalogues hors navigateur, titre au premier envoi, accueil résistant à une panne de base) | verte, Lighthouse 0,67 | aucune |
| #16 | Traductions limitées par zone (empilée sur #15) | lint-and-unit verte ; Lighthouse après rebase sur `main` | aucune |
| #17 | Gain revendeur affiché = net réellement versé (après frais Affisell), prouvé sur 840 cas | lint-and-unit verte | aucune |

Fusion d'essai #13 → #14 → #15 sur `main` : sans conflit, 75 tests combinés verts. **Aucune de ces PR ne demande
de migration** ; aucune variable n'est obligatoire pour démarrer (toutes les nouvelles sont facultatives et sans effet
tant qu'elles ne sont pas définies).

## 1. Débloquer Vercel [fondateur]

1. Régler la facture ; attendre que le statut « Account is blocked » disparaisse d'une PR (re-run du check Vercel).
2. **Preuve** : capture du tableau de bord sans bannière de blocage.

## 2. Fusionner et déployer, une PR à la fois [fondateur]

Pour chaque PR, dans l'ordre **#13 → #14 → #15 → #16 → #17** (#17 est indépendante ; elle peut aussi passer juste après #15) :

1. Fusionner sur `main` (squash ou merge, au choix — garder le même mode pour les quatre).
2. Attendre le déploiement Production **Ready** sur Vercel.
3. Contrôles de fumée (2 minutes) : `/` s'affiche, connexion acheteur, `/dashboard` d'un compte fournisseur de test,
   une fiche produit. Pour #13 : la page de versements fournisseur affiche le verrou Lightning.
4. **Preuve** : SHA déployé + URL du déploiement + résultat des 4 contrôles.
5. **Retour arrière** : « Promote » du déploiement précédent sur Vercel (instantané, aucune donnée touchée).

Pour #16 : après la fusion de #15, rebaser `local/perf-i18n-scoped` sur `main`, changer la base de la PR vers `main`
(Lighthouse ne tourne que pour les PR vers `main`), attendre la CI verte, puis vérifier sur la Preview un tableau de
bord fournisseur et `/admin` (aucune clé brute du type `supplier.xxx` à l'écran).

## 3. Configuration Production [fondateur, dans Vercel → Settings → Environment Variables]

Un seul redéploiement à la fin de l'étape.

| Variable | Valeur | Effet | Retour arrière |
|---|---|---|---|
| `SUPPLIER_PARTNER_LISTING_REF_SECRET` | la valeur **actuelle** d'`AUTH_SECRET` | fige les références `APS-…` avant le renouvellement | supprimer la variable |
| `AUTH_SECRET` (+ `NEXTAUTH_SECRET` identique ou supprimée) | `openssl rand -base64 48` | toutes les sessions se ferment une fois ; toute session forgée avec l'ancienne valeur meurt | remettre l'ancienne valeur |
| `ADMIN_EMAIL_ALLOWLIST` | **ne pas définir encore** (étape 4) | — | — |

**Preuve** : liste des noms de variables modifiées (jamais les valeurs) + horodatage du redéploiement.

## 4. Accès administrateur [fondateur, depuis son poste]

`scripts/account-access.ts` : simulation par défaut, `--apply` pour écrire, une transaction, nombre exact attendu,
refuse de verrouiller le dernier admin actif, n'affiche jamais de hash. Production :
`AFFISELL_ALLOW_PRODUCTION_WRITES=<endpoint>`.

1. **Preuve initiale** : `npx tsx scripts/account-access.ts status --emails admin@affisell.io,<vous>@affisell.com`
2. **Nouvel admin nominatif** : `ADMIN_BOOTSTRAP_PASSWORD=… npx tsx scripts/account-access.ts create-admin --email <vous>@affisell.com`
   (simulation, puis `--apply`). Mot de passe ≥ 16 caractères, stocké dans le gestionnaire de mots de passe.
3. **Vérifier l'accès réel** : se connecter via `/login/admin`, ouvrir `/admin`. Ne pas continuer sans ce succès.
4. **Liste blanche** (deuxième clé, sans écrire en base) : `ADMIN_EMAIL_ALLOWLIST=<vous>@affisell.com` → redéployer.
   Effet : `admin@affisell.io` n'a plus aucun droit admin (portail refusé ; session ouverte rétrogradée en ≤ 5 min),
   et une élévation de rôle écrite en base ne suffit plus pour devenir admin. Revérifier `/admin` avec le nouveau
   compte. **Retour arrière** : supprimer la variable et redéployer.
5. **Verrouiller les 7 comptes de test** :
   `lock --expect 7 --emails affiliate-test@affisell.com,gate-affiliate@affisell.com,supplier-test@affisell.com,gate-supplier@affisell.com,privacy-test@affisell.com,gate-customer@affisell.com,gate-legacy@affisell.com`
   (simulation puis `--apply`). Profils, acceptations légales et données conservés.
6. **Verrouiller `admin@affisell.io`** : `lock --expect 1 --emails admin@affisell.io` (l'outil refuse tant qu'un autre
   admin actif n'existe pas).
7. **Preuve finale** : `status` sur les 9 adresses ; copier la sortie (date, rôle, verrou, nombre d'admins actifs).
8. **Retour arrière** : `unlock --expect <n> --emails …`.

## 5. Medusa [fondateur, après décision]

Medusa reste désactivé. Requêtes A (identité admin) et B (clé secrète) prêtes dans
`docs/MEDUSA-CREDENTIALS-REMEDIATION.md` §4, à exécuter dans la console Neon sous rôle autorisé, après le point de
restauration PITR noté.

## 6. Clôture

- `affisell.io` : confirmer la propriété du domaine (registrar). S'il n'est pas à Affisell, aucune adresse
  `@affisell.io` ne doit garder d'accès — l'étape 4 le garantit déjà.
- Mettre à jour `docs/OPERATIONS-LOG-2026-11.md` avec les preuves des étapes 1 à 5.
