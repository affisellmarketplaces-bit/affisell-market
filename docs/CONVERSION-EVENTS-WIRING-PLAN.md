# Plan de branchement des événements de conversion — à valider

Statut : **décisions D1–D6 prises le 2026-11-23 (§8)** ; préparation technique faite sur la branche, **rien n'est branché dans les pages, aucune collecte, aucune migration appliquée, aucun déploiement**.
Objectif : relier vues de fiches → ajouts panier → checkout → commandes, pour l'intelligence commerciale (dont la mesure qualité des fiches, `lib/listing-quality/`), avec un minimum de données personnelles.

## 1. Ce qui existe déjà (lu dans le code)

| Élément | Fichier | État |
|---|---|---|
| Registre des événements (comportementaux / transactionnels, émis par le navigateur ou non) | `lib/events/names.ts` | Prêt : `product_view`, `product_impression`, `product_click`, `search`, `add_to_cart`, `remove_from_cart`, `checkout_started`, `attribution_touch` ; `purchase`, `refund`, `return_requested`, `delivery`… |
| Écrivain idempotent, ne lève jamais | `lib/events/record.server.ts` → `recordEvents(events, { analyticsConsent })` | Prêt, **appelé par personne** |
| Construction d'une ligne (refuse un événement comportemental sans consentement, refuse un identifiant visiteur sur un événement transactionnel) | `lib/events/row.ts` | Prêt |
| Schéma strict des lots envoyés par le navigateur (20 événements, 16 Ko max) | `lib/events/schema.ts` → `parseClientBatch` | Prêt |
| Propriétés autorisées par événement et nettoyage (recherche, UTM, référent = domaine seul) | `lib/events/properties.ts`, `sanitize.ts` | Prêt |
| Canal d'acquisition (règles fixes) | `lib/events/channel.ts` | Prêt |
| Table `AffisellTrackEvent` + contraintes CHECK | `prisma/schema.prisma`, migration `20261007140000_event_spine` | Écrite ; **application en production non vérifiée** (`npm run schema:verify` à lancer avec ton accord) |
| Préférences cookies (`affisell_cookie_prefs` : analytics / marketing, 180 jours) | `lib/legal/consent.ts`, `cookie-consent-runtime.ts` | Lues **seulement dans le navigateur** — aucun lecteur côté serveur |

**Écritures anciennes encore actives** (hors du nouveau système) : `POST /api/track` (carrousel : `view`, `hover`, `add_to_cart`), `POST /api/pulse/view`, et `lib/agent-checkout.ts` (`checkout_initiated`). Sept lecteurs s'appuient sur `eventType = 'view'` (social proof, opportunités fournisseur / revendeur, tableau de bord fournisseur…).

**Constat à décider (risque existant, pas créé par ce plan)** : `/api/track` et `/api/pulse/view` enregistrent un identifiant de session (`localStorage`, conservé sans limite) ou l'identifiant du compte **sans vérifier le consentement analytique**. Le nouveau système refuserait ces lignes ; l'ancien les écrit. Décision D1 ci-dessous.

## 2. Branchements minimaux (rien d'autre n'est à construire)

| Étape | Quoi | Où | Données |
|---|---|---|---|
| S2 | Lire le consentement **côté serveur** depuis le cookie `affisell_cookie_prefs` (absent ou illisible = pas de consentement) | nouveau `lib/events/consent.server.ts`, réutilise `parseCookieConsent` | aucune |
| S3 | Point d'entrée `POST /api/events` : origine même site, limite de débit par IP et par session, taille déjà bornée, `parseClientBatch`, consentement relu côté serveur, robots exclus (user-agent), horloge du navigateur ramenée à ±5 min | nouveau `app/api/events/route.ts` → `recordEvents` | ce que le schéma autorise |
| S3 | File côté navigateur : envoi groupé (`sendBeacon`), **rien n'est mis en file sans consentement**, identifiant visiteur créé seulement après consentement et effacé au retrait | nouveau `lib/events/client.ts` ; branché sur l'événement `affisell:cookie-consent` déjà émis | `anonymousId` (cookie première partie, durée à fixer, D3) |
| S4 | `product_view` : une fois par affichage de fiche (marketplace et boutique), `source` = `pdp` / `shop` | `app/marketplace/[id]/use-listing-detail-controller.ts` (effet au montage) | `listingId`, `productId` |
| S4 | `add_to_cart` / `remove_from_cart` | `lib/cart-add-client.ts`, `lib/guest-buy-now-client.ts`, page panier | `listingId`, quantité |
| S5 | `checkout_started` émis par le serveur après création de la session Stripe, clé `checkout_started:<sessionStripe>` | `lib/marketplace-checkout.ts` (`marketplaceCheckoutPOST`), `lib/agent-checkout.ts` | consentement lu dans la requête |
| S5 | Commandes payées, remboursements, retours : **lus directement dans `Order` / remboursements / retours** (source de vérité), pas recopiés en événements | — | — |
| S6 | Agrégation journalière par fiche × jour (vues, vues uniques, ajouts panier, checkouts) + purge des lignes brutes | fonction pure + tâche planifiée ; table d'agrégats = **migration (D5)** | comptes seulement |

## 3. Relier événements et commandes sans mauvaise association

- **Clé de rattachement = la fiche (`AffiliateProduct.id`) et le jour**, pas la personne. Une commande appartient à une fiche via `Order.affiliateId` + `Order.productId` (même règle que la mesure qualité et la demande par boutique). La boutique = le revendeur de la fiche ; le produit et le fournisseur s'en déduisent.
- **Option A (recommandée pour démarrer)** : conversion **agrégée** — vues et ajouts panier par fiche et par jour, rapprochés des commandes de la même fiche et du même jour. Aucun lien individuel entre un visiteur et une commande.
- **Option B (à décider, D4)** : parcours individuel — passer l'`anonymousId` dans les métadonnées de la session Stripe pour relier un visiteur consentant à sa commande. Plus précis (taux de conversion vrai, abandon), mais crée un lien entre comportement et achat : décision de ta part, base légale et information à vérifier.
- **Doublons** : `eventId` unique (UUID du navigateur, clé métier côté serveur) ; une vue est comptée une seule fois par session × fiche × 30 minutes à l'agrégation ; les rechargements et retours arrière ne gonflent pas les vues uniques.
- **Événements artificiels / spam** : point d'entrée même site, limite de débit, robots exclus, identifiants de fiche vérifiés à l'agrégation (une fiche inexistante est ignorée), plafond d'événements par session et par jour ; un pic anormal sur une fiche est mis de côté plutôt que compté.

## 4. Métriques, dénominateurs et limites

| Métrique | Population | Consentement requis (à confirmer juridiquement) |
|---|---|---|
| Vues totales par fiche | visiteurs ayant accepté | oui dans ce plan (cf. D2 pour une variante sans identifiant) |
| Vues uniques (sessions distinctes) | visiteurs ayant accepté | oui |
| Ajouts panier, checkouts démarrés | visiteurs ayant accepté | oui |
| Commandes payées, unités, annulations / remboursements | **tous** les acheteurs (données de commande) | non : donnée contractuelle, déjà conservée |

**Piège principal** : les vues ne couvrent que les visiteurs qui acceptent, les commandes couvrent tout le monde. « Commandes ÷ vues » mélange deux populations et **surestime** la conversion. Donc :
- en option A, le rapport s'appelle « commandes pour 100 vues mesurées », jamais « taux de conversion », et il n'est comparé qu'entre fiches ou périodes (le biais de consentement est le même partout, pas la valeur absolue) ;
- un vrai taux de conversion et d'abandon exige l'option B (même population de bout en bout) ;
- seuils minimaux avant tout affichage : au moins 100 vues mesurées par fiche et par période, et vues uniques masquées sous 5 (pas de chiffre qui isole une personne).

## 5. Modèle respectueux de la vie privée

- **Collecte minimale** : aucune adresse IP, aucun e-mail, aucun identifiant de compte sur un événement comportemental (proposition : `userId` jamais rempli pour ces événements, l'`anonymousId` suffit) ; propriétés limitées à la liste blanche existante.
- **Rétention** : lignes brutes 90 jours, puis seuls les agrégats par fiche × jour restent (durées à valider, D3) ; les lignes de l'ancien système suivent la même purge.
- **Cloisonnement** : fournisseur = ses produits, toutes boutiques confondues, en comptes agrégés ; revendeur = sa boutique ; Affisell = agrégats. Aucune ligne brute n'est exposée par une API.
- **Sécurité** : écriture uniquement par l'écrivain existant ; aucune lecture publique ; les droits suivent les routes existantes par rôle.
- **Retrait du consentement** : la file du navigateur est vidée, l'identifiant visiteur effacé, plus rien n'est envoyé ; les lignes déjà agrégées ne contiennent plus d'identifiant.

## 6. Décisions qui te reviennent

1. **D1 — Ancien suivi sans consentement** (`/api/track`, `/api/pulse/view`) : le soumettre au même consentement (les sept lecteurs verront moins de vues), ou le garder tel quel en attendant. Recommandation : le soumettre au consentement en même temps que S3.
2. **D2 — Compteur de vues sans identifiant ni cookie** (un simple +1 par fiche et par jour, pour tous les visiteurs) : il donnerait un dénominateur non biaisé. Certaines mesures d'audience peuvent être dispensées de consentement sous conditions ; **c'est à faire confirmer par un juriste avant de le construire**.
3. **D3 — Durées** : vie de l'identifiant visiteur, rétention des lignes brutes (proposé 90 jours) et des agrégats.
4. **D4 — Parcours individuel (option B)** : relier un visiteur consentant à sa commande, ou rester en agrégé (option A).
5. **D5 — Migrations** : vérifier / appliquer `event_spine` en production, puis la table d'agrégats journaliers.
6. **D6 — Texte de la bannière et de la politique cookies** : il doit mentionner cette mesure avant toute collecte.

## 7. Séquence proposée

1. Après ta validation : S2 + S3 développés et testés **sans être branchés dans les pages** (le point d'entrée répond mais rien ne l'appelle).
2. D1 et D5 décidés → S4 (vues, panier) derrière un interrupteur `CONVERSION_EVENTS_MODE=off|on`, désactivé par défaut.
3. S5 (`checkout_started`) puis S6 (agrégats, purge).
4. Branchement de la mesure qualité des fiches sur les vues mesurées (taux par vue en plus du taux par jour en boutique).
5. Activation en préproduction, contrôle des volumes et des doublons, puis décision d'activation en production.

**Sous mon autonomie, sans rien activer** : fonctions pures d'agrégation et de dédoublonnage, lecteur de consentement côté serveur, tests, documentation. **Soumis à ta validation** : tout ce qui collecte (S3 branché, S4, S5), les migrations, la purge, les textes légaux.

## 8. Décisions du fondateur (2026-11-23) et ce qui est préparé

| Décision | Retenu | Fait sur la branche (rien d'activé) |
|---|---|---|
| D1 | L'ancien suivi respecte le consentement | `/api/track`, `/api/pulse/view` et la ligne `checkout_initiated` de l'assistant n'écrivent plus rien sans consentement analytique, lu **côté serveur** dans le cookie (`lib/events/consent.ts`, prudent : cookie illisible = refus). Le navigateur n'envoie plus rien sans consentement (`lib/affisell-track-client.ts`). Le compteur anonyme des publications Pulse (+1, sans identifiant) est conservé. **Minimisation en plus** : l'identifiant de compte n'est gardé que pour un compte revendeur (`legacyTrackingUserId`), car les trois seuls lecteurs comptent des revendeurs ; l'identifiant d'un acheteur n'est plus jamais enregistré. **Effet attendu une fois déployé** : moins de vues dans les sept lecteurs (seuls les visiteurs consentants comptent). |
| D2 | Pas de compteur sans cookie | Rien construit. |
| D3 | 90 jours de lignes brutes, puis agrégats, purge vérifiable | `lib/events/aggregate.ts` (agrégats par fiche × jour UTC : vues dédoublonnées par session × fiche × 30 min, vues uniques, panier, débuts de paiement ; fiches inconnues écartées ; session > 300 événements / jour exclue ; seuils d'affichage) et `lib/events/purge.ts` (`EVENTS_PURGE_MODE` off par défaut / observe / enforce : un jour n'est supprimé **que si ses agrégats sont stockés**, sinon il est bloqué ; chaque jour supprimé est recompté et prouvé ; un reste ≠ 0 arrête la purge). Non planifié, non relié à la base : sans table d'agrégats (D5), aucune suppression n'est possible. |
| D4 | Mesure agrégée uniquement | Le point d'entrée n'enregistre ni identifiant de compte ni identifiant visiteur durable : seulement un identifiant d'onglet (`sessionStorage`), suffisant pour les vues uniques. Aucun lien vers la commande. Le ratio s'appelle « commandes pour 100 vues mesurées », masqué sous 100 vues ; vues uniques masquées sous 5. |
| D5 | Vérifier, ne rien appliquer | Voir §9. |
| D6 | Préparer les textes, sans publier | `docs/CONVERSION-EVENTS-LEGAL-TEXTS-DRAFT.md` (avec trois écarts constatés entre le code et les textes publiés). |

**Point d'entrée** `POST /api/events` (S3) : interrupteur `CONVERSION_EVENTS_MODE` (seul « on » l'ouvre ; par défaut il répond sans lire la requête), même site, limite par IP (60 / min) et par session (120 / h), taille ≤ 16 Ko, consentement relu dans le cookie **avant** de lire le corps, robots écartés, schéma strict existant, écrivain existant. **Client** `lib/events/client.ts` : double verrou (`NEXT_PUBLIC_CONVERSION_EVENTS_MODE=on` + consentement à chaque envoi), file vidée et identifiant effacé au retrait du consentement ; **importé par aucune page** (un test le vérifie). Tests : `conversion-events-wiring`, `conversion-events-client`.

## 9. Migrations — état vérifié dans le dépôt (D5, rien appliqué, aucune connexion à une base)

- `20261007140000_event_spine` (table `AffisellTrackEvent` enrichie) est **déjà sur `main`**. Son application en production est probable (le build Vercel vérifie le schéma avant de servir), mais **non vérifiée** : `npm run schema:verify` contre la production demande ton accord.
- Six migrations n'existent **que sur cette branche** : `product_price_history`, `listing_price_history`, `reseller_profit_alerts`, `intelligence_decision_journal`, `intelligence_signal_log`, `procurement_debit_register`. **Conséquence** : un déploiement de cette branche échouera à l'étape de vérification du schéma (sortie 5) tant qu'elles ne sont pas appliquées, à la main, avant le push (`schema:migrate -- --expect-endpoint <ep>`). Les lecteurs concernés sont défensifs (table absente = « pas de données »).
- **À créer plus tard (non écrite)** : une table d'agrégats journaliers, seule condition pour que la purge D3 puisse supprimer quoi que ce soit. Proposition : `ListingEventDaily(day DATE, listingId TEXT, views INT, uniqueViews INT, addToCart INT, removeFromCart INT, checkoutsStarted INT, computedAt TIMESTAMPTZ, PRIMARY KEY (day, listingId))` + un registre des jours agrégés et des preuves de purge (comptes seulement). Aucun identifiant de personne. Elle n'est pas ajoutée maintenant pour ne pas alourdir la liste des migrations à appliquer avant déploiement.
- **Index** : la purge par jour s'appuie sur `createdAt` ; l'index `(eventType, createdAt)` existe. À mesurer en préproduction avant toute purge réelle.

## 10. Prochaines étapes, toutes soumises à ton autorisation

1. Relecture juridique et publication des textes (D6), traduits en 8 langues.
2. Déploiement de D1 (réduit la collecte ; possible avant les nouveaux textes).
3. Création et application de la table d'agrégats (migration), puis purge en `observe` en préproduction.
4. Branchement S4 (vues, panier) dans les pages, puis activation en préproduction et contrôle des volumes et des doublons.
