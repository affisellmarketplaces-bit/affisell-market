# Medusa — identifiants exposés : correctifs, dépendances et neutralisation en production

État au 2026-11-25. Branche `local/security-medusa-credentials` (depuis `main`). **Aucune opération en production n'a
été exécutée** : les requêtes de la §4 attendent une autorisation écrite, chacune séparément.

## 1. Constat (vérifié)

- Le dépôt GitHub est **public**. Le mot de passe de l'administrateur Medusa y figurait en clair dans 3 fichiers depuis
  le premier commit de l'historique (`6e37f0e5d`, 2026-10-05). Il reste dans l'historique : il est **compromis**.
- Production Neon (`affisell` / `production` / `neondb`, lecture seule, 2026-11-25) : les tables Medusa sont dans le
  schéma `public`. `admin@affisell.com` : 1 identité `emailpass` active, créée le 2026-06-23 22:44 UTC, **jamais
  modifiée** ; seul utilisateur Medusa actif. 2 clés API, non révoquées : une publiable (2026-06-24), une **secrète**
  (2026-06-25), sans date de dernier usage.
- Railway (compte connecté, créé le 2026-11-04) : **0 projet**, supprimés compris. Aucun service Medusa.
- Même défaut pour 3 comptes de test de l'application (scripts `verify-*-onboarding.ts`, `verify-privacy-gate.ts`) :
  mot de passe littéral dans un dépôt public.

## 2. Correctifs de code (cette branche)

| Vulnérabilité | Correctif |
|---|---|
| Mot de passe admin Medusa en clair (`package.json`, `setup-auto.mjs`, `validate-tryon-sync.mjs`) | Lu uniquement depuis `MEDUSA_ADMIN_EMAIL` / `MEDUSA_ADMIN_PASSWORD` (`medusa-backend/scripts/lib/admin-credentials.mjs`) : e-mail valide, ≥ 16 caractères, sans espace autour, **refus d'une valeur publiée** (comparaison par SHA-256). Les erreurs nomment la variable, jamais la valeur. `user:create` → `scripts/create-admin-user.mjs` (pas de shell) |
| Mots de passe des comptes de test en clair (3 scripts `verify-*`) | `VERIFY_TEST_ACCOUNT_PASSWORD`, sinon aléatoire (18 octets) affiché une fois à la création |
| Les scripts Medusa héritaient `DATABASE_URL` du `../.env.local` (la production sur un poste de dev) — c'est ainsi que Medusa a écrit en production | `medusa-backend/scripts/lib/database-target-guard.mjs` : `DATABASE_URL` hérité de `../.env.local` → refus ; `DATABASE_URL` / `DATABASE_URL_PRISMA` sur l'endpoint de production → refus sans `AFFISELL_ALLOW_PRODUCTION_WRITES=<endpoint>` (même règle que le reste du dépôt). Branché dans `with-env.mjs` (toutes les commandes `medusa`), `setup-auto.mjs`, et `validate-tryon-sync.mjs` (qui copiait l'URL de l'app dans Medusa) |
| `JWT_SECRET` / `COOKIE_SECRET` retombaient sur `"supersecret"` : un Medusa démarré sans eux accepte des jetons falsifiables | `medusa-backend/src/lib/session-secrets.ts` : obligatoires, ≥ 32 caractères, valeurs faibles refusées ; Medusa ne démarre pas sinon |
| Aucune détection de secrets en CI | Étape `Secret scan` dans `ci.yml` : `node scripts/verify-no-secrets.mjs --all` sur chaque fichier suivi. Motifs (`scripts/lib/secret-scan.mjs`) : clés Stripe/OpenAI/Groq/GitHub/AWS/PEM, **clé secrète Medusa**, **mot de passe passé à `medusa user -p`**, **variable `*PASSWORD` affectée d'un littéral**, et **les valeurs publiées, par empreinte** (`scripts/lib/compromised-credentials.mjs`, empreintes seulement) |
| Gabarit `.env.template` invitait à mettre « la même URL Neon que la racine » dans `DATABASE_URL_PRISMA` | Texte corrigé (base locale ou staging ; production refusée) ; ajout de `MEDUSA_ADMIN_EMAIL` / `MEDUSA_ADMIN_PASSWORD` vides |

Preuves : `lib/__tests__/medusa-credentials-hardening.test.ts` (29 tests) ; contre-épreuve — les anciens fichiers
remis en place font échouer les tests et le scan les signale (« Known compromised credential ») ; `with-env.mjs`
lancé avec une URL de production factice → refus code 2 avant tout démarrage de Medusa ; avec une `DATABASE_URL`
héritée de `../.env.local` → refus code 2.

## 3. Dépendances de chaque identifiant

| Identifiant | Où il est utilisé (dépôt) | Environnements externes | Effet d'une neutralisation sur Affisell |
|---|---|---|---|
| Compte `admin@affisell.com` / identité `emailpass` | Seulement les scripts locaux Medusa (`setup:auto`, `user:create`, `validate-tryon-sync`) — connexion à l'admin Medusa | Production Neon : présent, actif. Aucun serveur Medusa trouvé (Railway vide, `admin.affisell.com` injoignable) | **Aucun** : l'application Affisell ne se connecte jamais avec ce compte |
| Clé API secrète Medusa | Valeur attendue de `MEDUSA_ADMIN_TOKEN` (le script `setup:auto` invite à l'y copier) | Production Neon : 1 clé secrète active. Usage réel : **inconnu** (valeur Vercel non inspectée) | Synchronisation des commandes et des expéditions vers Medusa : déjà inopérante sans serveur Medusa ; les erreurs sont attrapées (`[medusa] sync failed`), jamais propagées au paiement |
| `MEDUSA_ADMIN_TOKEN` | `lib/medusa-admin.impl.ts` → `createMedusaOrder`, `syncOrderFulfillment` ; scripts `heal-medusa-*`, `verify-medusa-admin-token` ; e2e try-on | Vercel : **non inspecté** (compte bloqué ; outil de lecture des variables non disponible ici). Absent du dépôt (gabarit vide) | Sans lui : les synchros sont ignorées avec un avertissement (comportement prévu) |
| `JWT_SECRET` / `COOKIE_SECRET` | `medusa-config.ts` uniquement (Medusa). Pas utilisés par l'application Affisell (NextAuth a `AUTH_SECRET`) | Railway : aucun service. Postes de dev : `medusa-backend/.env` (non inspecté) | Aucun |

## 4. Neutralisation en production — PRÉPARÉE, NON EXÉCUTÉE

Console Neon, projet `affisell`, branche `production`, base `neondb`. Chaque opération est indépendante, vise **une
seule ligne**, s'annule d'elle-même si ce n'est pas exactement une, et se défait.

### 4.0 Pré-contrôle commun (lecture seule) — noter les deux `id`

```sql
BEGIN READ ONLY;
SELECT 'identite' AS objet, id, deleted_at IS NULL AS active, updated_at
  FROM provider_identity WHERE entity_id = 'admin@affisell.com' AND provider = 'emailpass'
UNION ALL
SELECT 'cle_secrete', id, (revoked_at IS NULL AND deleted_at IS NULL), updated_at
  FROM api_key WHERE type = 'secret';
ROLLBACK;
```
Attendu : 1 ligne `identite` active, 1 ligne `cle_secrete` active. Sinon : ne rien exécuter, revenir vers moi.

### 4.A Désactiver l'identité de connexion de `admin@affisell.com`

```sql
BEGIN;
DO $$
DECLARE v_id text; v_n int;
BEGIN
  SELECT id INTO STRICT v_id FROM provider_identity
   WHERE entity_id = 'admin@affisell.com' AND provider = 'emailpass' AND deleted_at IS NULL;
  UPDATE provider_identity SET deleted_at = now(), updated_at = now()
   WHERE id = v_id AND deleted_at IS NULL;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n <> 1 THEN RAISE EXCEPTION 'abandon: % ligne(s)', v_n; END IF;
  IF (SELECT count(*) FROM provider_identity WHERE entity_id = 'admin@affisell.com' AND deleted_at IS NULL) <> 0
    THEN RAISE EXCEPTION 'abandon: identite encore active'; END IF;
END $$;
SELECT count(*) FILTER (WHERE deleted_at IS NULL) AS actives, count(*) AS total
  FROM provider_identity WHERE entity_id = 'admin@affisell.com';
COMMIT;
```
- Effet : la connexion e-mail / mot de passe à l'admin Medusa est impossible (Medusa ignore les identités supprimées).
  L'`auth_identity` et l'utilisateur restent : retour arrière simple. Les jetons déjà émis par un éventuel serveur
  restent valides jusqu'à expiration — seule la rotation de `JWT_SECRET` de ce serveur les invalide.
- Contrôle : `actives = 0`, `total = 1`.
- Retour arrière : `UPDATE provider_identity SET deleted_at = NULL WHERE id = '<id noté>' AND deleted_at IS NOT NULL;`
  (1 ligne attendue). À ne faire qu'après avoir changé le mot de passe.
- Conséquences Affisell : aucune.

### 4.B Révoquer la clé API secrète Medusa

```sql
BEGIN;
DO $$
DECLARE v_id text; v_n int;
BEGIN
  SELECT id INTO STRICT v_id FROM api_key
   WHERE type = 'secret' AND revoked_at IS NULL AND deleted_at IS NULL;
  UPDATE api_key SET revoked_at = now(), revoked_by = 'security-remediation-2026-11', updated_at = now()
   WHERE id = v_id AND revoked_at IS NULL;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n <> 1 THEN RAISE EXCEPTION 'abandon: % ligne(s)', v_n; END IF;
END $$;
SELECT type, revoked_at IS NOT NULL AS revoquee FROM api_key ORDER BY created_at;
COMMIT;
```
- Effet : la clé n'est plus acceptée par Medusa (révoquée = `revoked_at` passé). La clé publiable n'est pas touchée.
- Contrôle : clé `secret` → `revoquee = t` ; clé publiable → `f`.
- Retour arrière : `UPDATE api_key SET revoked_at = NULL, revoked_by = NULL WHERE id = '<id noté>';` (1 ligne).
- Conséquences Affisell : si `MEDUSA_ADMIN_TOKEN` (Vercel) est cette clé, les synchros vers Medusa — déjà sans serveur —
  échoueront en 401 au lieu d'une erreur réseau ; erreurs attrapées, aucun effet sur le paiement ou les versements.

## 5. Medusa est-il nécessaire au lancement ? Non, d'après le code.

| Fonction | Dépend de Medusa ? | Déjà assurée par Affisell |
|---|---|---|
| Catalogue, fiches, publication, paiement, versements, retours | Non | Oui (Prisma + Stripe) |
| Miroir des commandes payées dans Medusa (`syncMarketplaceOrderToMedusa`) | Oui, optionnel : ignoré sans `medusaHandle` ni `MEDUSA_ADMIN_TOKEN`, erreurs attrapées | La commande Affisell est la référence |
| Miroir des expéditions (`syncOrderFulfillment`) | Oui, optionnel, ignoré sans jeton | Suivi dans Affisell |
| Page `/produits/[handle]` (essayage virtuel, fiche Medusa) | Partiellement : lit l'API Medusa, avec repli Prisma | L'essayage d'Affisell (Replicate, `TRY_ON_ENABLED`) ne passe pas par Medusa |
| Branche « panier Medusa » de `POST /api/checkout` | Seulement si le corps a la forme Medusa | Le checkout marketplace d'Affisell |

Recommandation : **garder Medusa désactivé** (aucun serveur, aucune variable Medusa en production) jusqu'à ce qu'un
besoin soit démontré ; ne rien supprimer du code. Avant tout redéploiement : nouvelle base dédiée (pas la production
Affisell), secrets de session neufs, nouveau mot de passe, nouvelle clé secrète.

## 6. Risques restant ouverts

1. Le mot de passe reste dans l'historique Git public : la neutralisation (§4) et la rotation sont la seule défense.
   **Pas de réécriture d'historique** : elle casserait les PR #9 à #13 et les clones, sans effacer les copies déjà faites
   (caches GitHub, `refs/pull/*`).
2. **Comptes de test de l'application en production ?** `affiliate-test@`, `supplier-test@`, `privacy-test@affisell.com`
   ont pu être créés en production avec des mots de passe publiés (scripts présents depuis 2026-10-05, garde
   anti-production ajoutée le 2026-10-08). Ce sont des comptes Affisell (connexion au tableau de bord), donc plus exposés
   que Medusa. Lecture à autoriser :
   ```sql
   BEGIN READ ONLY;
   SELECT email, role, ("password" IS NOT NULL) AS a_mot_de_passe, "createdAt"
     FROM "User" WHERE email IN ('affiliate-test@affisell.com','supplier-test@affisell.com','privacy-test@affisell.com');
   ROLLBACK;
   ```
3. `MEDUSA_ADMIN_TOKEN` et `NEXT_PUBLIC_MEDUSA_*` sur Vercel : non inspectés.
4. `.env.railway` décrit toujours un Medusa branché sur la base Neon de l'application (`${{Neon.DATABASE_URL}}`) :
   décision d'architecture (base dédiée) à prendre avant tout déploiement.
5. Le scan de secrets repose sur des motifs : un secret de forme inconnue passerait. Un outil dédié (gitleaks) sur
   l'historique complet reste recommandé.
