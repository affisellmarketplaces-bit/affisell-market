# E-mail acheteur « ligne payée sans commande » — validation en préproduction et activation progressive

> Statut au 2026-11-17 : mécanisme **construit et testé (tests unitaires et d'intégration simulés)**, **jamais exécuté** contre
> Resend, Stripe ou une base réelle. Aucun e-mail client n'est autorisé : toute activation en production exige l'accord
> explicite du fondateur. Rien dans ce document n'a été exécuté.

## 1. Ce que fait le mécanisme (rappel)

- Interrupteur `UNALLOCATED_LINE_BUYER_EMAIL` lu à chaque appel :
  - absent / autre valeur = **off** (rien n'est lu, réservé ni envoyé) ;
  - `shadow` = le plan est calculé et journalisé (`[unallocated-buyer-notice] shadow_would_send`, sans adresse e-mail), **rien n'est réservé ni envoyé** ;
  - `true` = envoi.
- Destinataire : l'adresse saisie par le payeur sur Stripe pour cette session, relue côté serveur (`payment_status === "paid"`). Jamais stockée dans une trace.
- État du remboursement établi à partir des faits :
  - `not_triggered` : aucune preuve de remboursement ;
  - `requested` : identifiant connu, statut illisible ;
  - `in_progress` : statut Stripe `pending` ou `requires_action` ;
  - `confirmed` : `succeeded` ;
  - **`uncertain`** : le paiement porte un remboursement que rien n'explique (ni preuve de ligne, ni `metadata.orderId`), ou la liste des remboursements est illisible. Dans ce cas, **aucun premier e-mail** n'est envoyé (`uncertain_hold`) et la page de succès **ne dit rien sur l'argent**.
- Deux e-mails au plus par session :
  - `initial` ;
  - `refund_confirmed` (seulement si l'initial ne disait pas déjà « confirmé »).
- Chaque tentative est réservée **avant** l'envoi par une ligne `AuditLog` d'identifiant déterministe. Cet identifiant sert de clé d'idempotence Resend. La réservation conserve un instantané (état, langue, montant, devise, revendeur) pour pouvoir **renvoyer exactement le même contenu**.

### Reprises

| Situation | Comportement |
|---|---|
| Échec enregistré (`:failed`) | Nouvelle tentative n+1 (5 au maximum), nouvelle clé |
| Réservation sans issue depuis moins de 5 min | `in_flight` : on attend |
| Réservation sans issue depuis 5 min à 20 h | **Reprise** : même clé et même contenu. Resend (fenêtre de 24 h) renvoie l'e-mail d'origine sans en émettre un second |
| Resend répond `invalid_idempotent_request` ou `concurrent_idempotent_requests` | Pas de second envoi, **une** alerte ops |
| Réservation sans issue depuis plus de 20 h | `in_doubt` : rien n'est envoyé, **une** alerte ops (ligne `…:alerted`) ; un humain tranche via `POST /api/admin/unallocated-buyer-notices/resolve` |

Cron `GET /api/cron/unallocated-buyer-notices` (toutes les 30 min, mode souple). Il couvre les sessions des 30 derniers jours et procède ainsi :

- il **écarte les sessions terminées avant toute lecture Stripe** ;
- il traite d'abord celles qui attendent leur premier e-mail ;
- il plafonne à 50 sessions par passage.

## 2. Vérifications faites (code et tests, sans service réel)

| Point | Preuve | Nature |
|---|---|---|
| Désactivé par défaut, mode `shadow` sans effet | `unallocated-buyer-notice-server.test.ts` « switch » | test (Resend et Stripe simulés) |
| Un seul e-mail, y compris avec 3 exécutions concurrentes | idem « one notice, no duplicate » | test |
| Échec puis tentative 2, aucune adresse ni message fournisseur dans les traces | idem | test |
| Plantage entre l'envoi et son enregistrement : même clé et **même HTML** | idem « crash between the send and its record » | test |
| Conflit d'idempotence : aucun second e-mail, une alerte | idem | test (réponse Resend **simulée**) |
| Plus de 20 h : aucun envoi, une alerte, résolution par un administrateur | idem | test |
| Remboursement inexpliqué ou illisible : envoi retenu, page muette sur l'argent | idem + `checkout-success-outcome.test.ts` | test |
| E-mail « remboursé » uniquement après `succeeded` | idem | test (statuts Stripe simulés) |
| 8 langues × 5 combinaisons type/état : aucune clé non résolue | idem « every language » | test |

## 3. Limites que les tests ne démontrent PAS

1. **Le comportement réel de Resend** : la fenêtre de 24 h, les codes `invalid_idempotent_request` et `concurrent_idempotent_requests`, la déduplication sur une reprise. Ils sont tirés de la documentation publique, sans réponse réelle observée.
2. **Les statuts réels des remboursements Stripe** et le contenu réel de `refunds.list` (métadonnées posées par le tableau de bord, remboursements partiels de commande).
3. **Le rendu dans de vrais clients de messagerie** (Gmail, Outlook, Apple Mail, mode sombre) et la délivrabilité (SPF, DKIM, réputation du domaine d'envoi).
4. **Le comportement sur une vraie base** : les tests utilisent une table `AuditLog` en mémoire. La contrainte d'unicité de PostgreSQL est la même clé primaire, mais elle n'a pas été exercée ici.
5. **Le cron GitHub ne vise que la production** (`VERCEL_APP_URL`). En préproduction, il faut l'appeler à la main.
6. **Un remboursement partiel exact fait à la main sur une commande**, sans `metadata.orderId`, passe pour « inexpliqué ». L'e-mail est alors retenu, alors qu'il aurait pu partir. C'est un faux positif voulu, du côté sûr.

## 4. Procédure de validation en préproduction (à exécuter avec l'accord du fondateur)

**Prérequis, sans exception :**

- base **staging** (`ep-shy-wind-…`) ;
- Stripe en **mode test** (`sk_test_…`) ;
- Resend avec l'expéditeur **sandbox** (`onboarding@resend.dev`) et `TEST_EMAIL_TO=<boîte de l'équipe>`.

**Garde-fou dans le code** : hors production (`VERCEL_ENV` différent de `production`), l'e-mail n'est envoyé **que** si l'expéditeur est le sandbox **et** que `TEST_EMAIL_TO` est défini. Sinon, le statut est `preview_recipient_not_redirected` : rien n'est réservé ni envoyé. Avec un domaine vérifié, Resend écrirait au **vrai** destinataire. Vérifier tout de même `RESEND_FROM_EMAIL` et `TEST_EMAIL_TO`.

1. `UNALLOCATED_LINE_BUYER_EMAIL=shadow` sur l'environnement Preview, puis redéployer la Preview.
2. Créer une ligne non allouée : publier un produit de test, puis payer avec la carte de test `4242…`. Juste avant le paiement, désactiver l'annonce : le motif sera `listing_inactive`.
3. Page de succès : elle doit afficher « paiement reçu, article non confirmé ». La phrase sur l'argent doit être « Aucun remboursement n'a encore été émis » : remboursement automatique désactivé.
4. Appeler le cron à la main : `curl -H "Authorization: Bearer $CRON_SECRET_PREVIEW" https://<preview>/api/cron/unallocated-buyer-notices`. Attendu : `byStatus.shadow = 1`, une ligne de journal `shadow_would_send`, aucune ligne `unallocated-buyer-notice:*` en base.
5. Passer à `UNALLOCATED_LINE_BUYER_EMAIL=true` puis redéployer. Relancer le cron : un e-mail arrive dans `TEST_EMAIL_TO`. Le relancer encore : `nothing_new`, pas de second e-mail.
6. **Remboursement exact par le tableau de bord**, en mode test et au montant de l'alerte : la page passe à « remboursé ». Au passage suivant du cron, l'e-mail « remboursement confirmé » part, une seule fois.
7. **Remboursement ambigu** : sur une autre session de test, rembourser un montant arbitraire. Attendu : `uncertain_hold`, aucun e-mail, page muette sur l'argent.
8. **Échec simulé** : mettre temporairement un `RESEND_API_KEY` invalide sur la Preview. Attendu : `failed`. Remettre la clé : la tentative 2 part.
9. **Reprise** : supprimer en staging la ligne `…:initial:1:sent`, attendre 5 min, relancer. Attendu : `recovered`, et **un seul** e-mail dans la boîte (vérifier dans les journaux Resend que la clé a été dédupliquée). **C'est la preuve qui manque aujourd'hui (limite 1).**
10. Consigner les résultats ici, avec la date et le nom de la personne qui a validé.

## 5. Conditions d'une activation progressive en production (décision du fondateur)

1. Les étapes 1 à 9 ci-dessus sont validées et consignées.
2. Le domaine d'envoi est vérifié (SPF et DKIM) et `SLACK_WEBHOOK_URL` ou `DISCORD_WEBHOOK_URL` est configuré : sans eux, les alertes « en doute » ne sont visibles que dans les journaux.
3. **Phase A, `shadow` pendant 7 jours** : lire les lignes `shadow_would_send` et les compteurs du cron. On vérifie le nombre de sessions concernées, la part de `uncertain_hold` et l'absence d'`error`.
4. **Phase B, `true`** : surveiller pendant 48 h les journaux Resend (rebonds, plaintes) et les alertes ops. Retour arrière immédiat : supprimer la variable (lue à chaque requête, sans redéploiement de code).
5. Aucune autre bascule n'est nécessaire. Le remboursement automatique (`UNALLOCATED_LINE_AUTO_REFUND`) est une décision **distincte**, que celle-ci n'entraîne pas.

## 6. Tentative d'exécution du 2026-11-17 (autorisée par le fondateur) — étapes bloquées, motifs exacts

Rien n'a été envoyé, aucune donnée n'a été lue ou modifiée. Chaque blocage relève d'une configuration ou d'une action extérieure au périmètre autorisé ; conformément à la consigne, l'étape concernée a été arrêtée.

| Étape | Blocage constaté | Ce qui le lève |
|---|---|---|
| 1–9 (préproduction) | Aucun déploiement de préproduction n'est joignable : l'hébergement Vercel est suspendu (facture impayée), et les outils Vercel de cette session ne gèrent ni les déploiements ni les variables d'environnement. | Réactivation du compte Vercel, puis variables de Preview (base staging, `sk_test_…`, expéditeur sandbox, `TEST_EMAIL_TO`, `CRON_SECRET` de Preview) posées par le fondateur. |
| Idempotence Resend réelle | `api.resend.com` est **refusé** par le pare-feu sortant des deux environnements de l'agent (conteneur : `connect_rejected` ; machine virtuelle : aucune connexion). Aucune clé Resend de test n'est disponible à l'agent (et il ne lit pas celles des fichiers `.env`). | **Prêt, en un clic** : workflow manuel `Resend — live buyer-notice probe` (`.github/workflows/resend-live-probe.yml`). Il demande deux secrets de dépôt : `RESEND_TEST_API_KEY` et `RESEND_TEST_EMAIL_TO`, une adresse dont l'équipe a le contrôle et qui est celle du titulaire du compte Resend (l'expéditeur sandbox n'écrit qu'à elle). |
| Fenêtre de conservation de la clé | Elle exige deux exécutions espacées de 24 h. | Relancer le même workflow ≥ 24 h plus tard avec `replay_key` et `replay_id`, imprimés par la première exécution. |
| Rendu Gmail / Outlook | Il exige une boîte réelle. | Le même workflow envoie les 8 langues et tous les états (16 e-mails préfixés `[TEST Affisell]`) à `RESEND_TEST_EMAIL_TO`. Pour Outlook, faire suivre l'adresse de test vers une boîte Outlook, ou en utiliser une comme `RESEND_TEST_EMAIL_TO`. |

**Ce que prouve le workflow, avec les réponses réelles de Resend** (`lib/__tests__/live-resend-buyer-notice.test.ts`, code de production : rendu, `sendResendEmail`, clé d'idempotence) :

- même clé et même contenu : **même identifiant** d'e-mail (le renvoi est dédupliqué, et la reprise après plantage repose sur ce point) ;
- même clé et autre contenu : refus `invalid_idempotent_request` ;
- clé de plus de 24 h : nouvel identifiant.

Le test **échoue** si Resend se comporte autrement. Ce serait alors une découverte bloquante pour l'activation, et non un détail. Il refuse de s'exécuter sans l'expéditeur sandbox et `TEST_EMAIL_TO`, ainsi qu'en production.

Restent hors de ce workflow et attendent la préproduction : les remboursements ambigus et manuels sur Stripe en mode test, ainsi que la cohérence avec la page de succès (étapes 6, 7 et 3).

## 7. Revue de sécurité du workflow `Resend — live buyer-notice probe` (2026-11-18) — rien n'a été lancé, aucun secret demandé

Fichiers relus intégralement : `.github/workflows/resend-live-probe.yml`, `lib/__tests__/live-resend-buyer-notice.test.ts`, et le code applicatif qu'ils exécutent : `lib/emails/resend-delivery.ts`, `lib/emails/resolve-resend-recipient.ts`, `lib/env/resend.ts`, `lib/unallocated-buyer-notice.server.ts` (`buildNoticeCopy`). J'ai aussi vérifié la source du SDK `resend` 6.12.4.

| Point demandé | Constat avant revue | État après correction (`4701b2f02`) |
|---|---|---|
| Permissions GitHub Actions | `contents: read` seulement ; déclenchement **manuel uniquement** (ni push, ni PR, ni planification) | Inchangé. S'y ajoutent `persist-credentials: false` (le jeton GitHub n'est pas laissé dans le dépôt cloné) et `concurrency` (jamais deux exécutions en parallèle) |
| Exécution impossible en production | Aucun secret de production n'est référencé (pas de base, pas de Stripe, pas de `VERCEL_*`). Le test exige `isProductionEmailDelivery() === false` | De plus, `VERCEL_ENV: ""` est forcé, et la base et Stripe sont remplacés par des modules vides dans le test : aucune donnée réelle n'est accessible |
| Provenance du code exécuté | **Faille** : n'importe quelle branche pouvait lancer le workflow avec du code modifié, et les secrets de dépôt étaient disponibles sur toutes les branches | L'exécution est **refusée** si le SHA saisi (`expected_sha`) diffère du commit exécuté, ou si la branche n'est ni `release/finalisation-2026-11-13` ni `main`. Les secrets passent dans un **environnement GitHub protégé** `resend-probe` (approbation du fondateur à chaque exécution, branches autorisées) |
| Destination exclusive des e-mails | Le résolveur de l'application redirige vers `TEST_EMAIL_TO` hors production avec l'expéditeur sandbox ; le destinataire nominal était `buyer-never-used@example.com` | **Avant chaque envoi**, le test interroge le résolveur de l'application : si la destination n'est pas la boîte de test, il s'arrête sans rien envoyer. Le destinataire nominal est sur le domaine réservé `.invalid` (RFC 2606 : impossible à livrer par définition). Côté Resend, l'expéditeur sandbox ne livre qu'au titulaire du compte : c'est une seconde barrière, indépendante du code |
| Secrets et journaux | GitHub masque automatiquement les valeurs des secrets. Le message d'erreur du fournisseur était journalisé et pouvait reprendre l'adresse | Seuls les **codes** d'erreur Resend sont journalisés. Les adresses sont masquées par `maskEmailForLog`. Une assertion qui échoue n'affiche que des booléens, des codes ou des identifiants d'e-mail |
| Envoi à un véritable acheteur | Impossible : aucune donnée d'acheteur n'est lue, il n'y a ni base ni Stripe | Inchangé, avec en plus le contrôle de destination avant chaque envoi |
| Conséquences d'une relance | Chaque exécution utilise une **nouvelle** clé aléatoire : 17 e-mails de plus vers la boîte de test, aucun effet ailleurs, aucune donnée écrite | Inchangé ; jamais deux exécutions en même temps |
| Coûts | Quelques minutes d'Actions par exécution (incluses dans le quota GitHub, sinon facturées à la minute). Resend : 17 e-mails, dans l'offre gratuite (100 par jour) | Inchangé |
| Test à 24 h | **Défaut** : la clé ne portait que la date ; une relance trop tôt aurait faussement « échoué ». Surtout, ce n'était pas le bon contrôle | La clé porte son heure de création. **Entre 18 et 20 h**, le renvoi **doit** être dédupliqué : c'est la fenêtre de reprise de l'application (20 h), et l'échec signalerait un risque de double envoi. Après 24 h 05 min, un nouvel envoi est attendu (Resend documente 24 h). Entre les deux, le contrôle est ignoré avec un message |

**Risques résiduels**

- (1) Les actions `actions/checkout@v4` et `actions/setup-node@v4` sont référencées par étiquette, comme dans les autres workflows du dépôt. Les épingler par empreinte de commit est recommandé ; leurs dépôts n'étaient pas lisibles depuis cette session.
- (2) Pendant le test, la clé Resend est présente dans l'environnement du processus `vitest`, donc lisible par toute dépendance npm. C'est pourquoi on utilise une clé « Sending access » uniquement, sur un compte Resend de test, révoquée après usage.
- (3) Créer l'environnement `resend-probe` **avant** d'y mettre les secrets, avec approbation obligatoire ; GitHub crée sinon un environnement non protégé au premier lancement (il serait vide, donc le workflow s'arrêterait à « Require the test secrets »).

**Conclusion.** Après ces corrections, le workflow ne peut écrire qu'à la boîte de test, ne lit aucune donnée réelle, ne s'exécute que sur le commit relu et après ton approbation, et ne laisse fuir ni la clé ni l'adresse. Je le considère sûr à exécuter **une fois les risques (2) et (3) traités**. Je ne l'ai pas lancé et je n'ai demandé aucun secret.

### 7 bis. Revue finale (2026-11-18, commit `4996a23f7`) — corrigé directement, rien lancé, aucun secret demandé

Ce qui précède contenait une **affirmation fausse** : « les adresses sont masquées par `maskEmailForLog` » n'était vrai que pour le test. Le code applicatif `sendResendEmail`, que le test appelle, écrivait en clair dans les journaux le message d'erreur de Resend (qui reprend l'adresse) et le destinataire prévu. Corrigé.

| Point | Constat | Correction et preuve |
|---|---|---|
| Actions épinglées | `@v4` (étiquette déplaçable) | `actions/checkout@11d5960…677262` et `actions/setup-node@49933ea…820020` : empreintes complètes, lues de deux sources concordantes (journal « Download action repository » d'une exécution CI et `git ls-remote` des dépôts). Le cache npm partagé est retiré (`npm ci` vérifie de toute façon les empreintes du lockfile). Test : toute ligne `uses:` doit porter une empreinte de 40 caractères |
| Jeton `GITHUB_TOKEN` | `contents: read` | Inchangé ; le test refuse tout `write`, `write-all` ou `id-token` |
| Accès aux secrets | Uniquement dans l'environnement `resend-probe`, après le contrôle de provenance | Le test vérifie que la première référence `secrets.` vient **après** ce contrôle, et qu'aucun artefact ni cache n'est publié |
| Déclenchement par une branche ou une PR non autorisée | Déclencheur manuel uniquement (le test refuse `push`, `pull_request`, `pull_request_target`, `schedule`, `workflow_run`, `repository_dispatch`). Une PR, y compris depuis un fork, ne peut pas le lancer. **Mais** le contrôle de branche et de SHA est écrit dans le fichier du workflow : quelqu'un qui a le droit d'écriture peut pousser une branche dont le workflow l'a retiré | La vraie barrière est donc **la protection de l'environnement**, appliquée par GitHub et non par le fichier : branches autorisées = les deux branches, plus ton approbation à chaque exécution. Au moment d'approuver, vérifie que le commit affiché est bien celui que tu as relu |
| Injection par les champs saisis | Les champs `expected_sha`, `replay_key` et `replay_id` passent par `env`, jamais dans un script | Test : aucune expression `${{ … }}` dans un bloc `run:` |
| Destination de chacun des 17 e-mails | Le destinataire nominal (`no-real-buyer@affisell-probe.invalid`) n'est jamais utilisé : c'est le résolveur de l'application qui fixe la destination | `assertProbeEnvironment` refuse avant tout envoi : production (`VERCEL_ENV=production`), expéditeur non sandbox, `TEST_EMAIL_TO` absent ou mal formé. `assertRoutesToTestInbox` refuse **chaque** envoi si le résolveur ne renvoie pas la boîte de test. Test sans réseau (vrai `sendResendEmail`, vrai résolveur, SDK remplacé par un enregistreur) : sur les 17 envois, en cas de succès comme de refus de Resend, **chaque** `to` est la boîte de test, et il n'y a jamais de `cc`, `bcc` ni `reply_to`. Le repli de `sendResendEmail` (nouvel essai vers `TEST_EMAIL_TO`) ne se déclenche pas, puisque la destination est déjà la boîte de test. En production, le test prouve que le garde arrête l'envoi |
| Fuites dans les journaux | `sendResendEmail` écrivait en clair l'adresse prévue et le message de Resend | `redactEmails` remplace toute adresse par `[email]` dans le message du fournisseur ; l'adresse prévue est masquée. Le test vérifie que la sortie ne contient ni la clé, ni la boîte de test (**quelle que soit la casse** : GitHub ne masque que le texte exact du secret, et Resend renvoie l'adresse en minuscules), ni le destinataire nominal |
| Relance et interruption | — | Une relance de l'exécution redemande ton approbation, reprend le même commit et crée une nouvelle clé aléatoire : 17 e-mails de plus vers la boîte de test, rien d'écrit ailleurs. Une interruption ne laisse que des e-mails déjà reçus par la boîte de test ; aucune donnée ni aucun état n'est conservé |

**Ce qui reste hors du code** : le processus de test a la clé en mémoire, donc toute dépendance npm compromise pourrait la lire. Utilise une clé « Sending access » sur un compte Resend de test, révoquée juste après.

**Actions manuelles, à faire par toi seulement quand tu décideras de lancer le test (rien n'a été fait)** :
1. GitHub → Settings → Environments → créer `resend-probe` **avant** d'y mettre le moindre secret :
   - *Required reviewers* : toi ;
   - *Deployment branches* : « Selected branches », avec `release/finalisation-2026-11-13` et `main` ;
   - ne pas cocher l'option qui permet aux administrateurs de passer outre.
2. Sur un compte Resend de test, créer une clé « Sending access ». L'adresse du titulaire de ce compte sera `RESEND_TEST_EMAIL_TO`. Ajouter les deux secrets **dans l'environnement**, pas au niveau du dépôt.
3. Lancer le workflow depuis la branche, avec `expected_sha` égal au commit relu. Approuver après avoir vérifié le commit affiché. Contrôler la boîte de réception, Gmail et Outlook.
4. Pour le contrôle à 18–20 h : relancer avec les champs `replay_key` et `replay_id` affichés par la première exécution.
5. Révoquer la clé, puis supprimer les secrets.

## 8. Préproduction sans Vercel, avec l'infrastructure existante (étude, 2026-11-18)

- **Possible et sans coût : une préproduction éphémère dans GitHub Actions.** Elle combine un PostgreSQL jetable (déjà utilisé par les tests de la CI et par `home-server-timing`), la vraie application (`next start` sur le commit exact) et un faux serveur Resend local. Le SDK `resend` lit `RESEND_BASE_URL` (vérifié dans sa source, version 6.12.4) : aucun e-mail ne sort du runner. On peut y appeler le vrai cron `/api/cron/unallocated-buyer-notices` avec un `CRON_SECRET` généré pour l'exécution.
- **Ce qu'elle ne couvre pas sans décision de ta part.** Stripe : la notification relit la session et les remboursements chez Stripe. Il faudrait soit une clé Stripe **de mode test** (aucune opération financière réelle, mais c'est un secret, donc ta décision), soit faire pointer le client Stripe vers `stripe-mock`. Cette seconde option modifie la configuration du client de paiement ; je ne la propose pas.
- **Déjà fait dans cet esprit.** `lib/__tests__/unallocated-buyer-notice-db.test.ts` exécute le mécanisme réel sur un **vrai PostgreSQL** dans la CI : 8 envois simultanés donnent une seule réservation (clé primaire), la reprise, l'alerte unique, la résolution administrateur unique, et le balayage du cron avec les vraies formes de requêtes. Cela lève la limite n° 4 de la §3. **Ce test a révélé un vrai défaut**, invisible au test en mémoire, qui est séquentiel : deux résolutions administrateur simultanées, l'une « envoyé » et l'autre « échoué », réussissaient toutes les deux. Corrigé : une ligne `:resolved` à clé déterministe est écrite dans la même transaction que le résultat, donc une seule résolution l'emporte.
