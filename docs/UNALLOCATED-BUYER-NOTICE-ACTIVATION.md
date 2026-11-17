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
