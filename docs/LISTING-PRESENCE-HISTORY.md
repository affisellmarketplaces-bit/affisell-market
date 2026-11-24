# Historique de présence des produits en boutique (2026-11-23)

Base : commit `55c658b15`. Migration `20261124090000_listing_presence_history` — **écrite, testée, NON appliquée**
(ni préproduction ni production : décision fondateur).

## 1. Source de vérité et transitions

- Source de vérité de la présence : `AffiliateProduct.isListed` (une ligne par revendeur × produit, unique
  `affiliateId, productId`). La visibilité acheteur dépend aussi du produit (`active`, `isDraft`) — ce sont d'autres axes,
  non historisés ici (le produit a déjà son historique de prix ; son statut commercial a son journal de suspension).
- Transitions possibles : création (listée ou non), listée → retirée, retirée → listée, suppression (listée ou non).
  Aucune suppression en cascade : les clés étrangères vers `Product` et `User` sont en `RESTRICT`, donc une ligne ne
  disparaît que par une suppression explicite.

## 2. Véritables points de mutation et provenance (verrouillés, 2026-11-24)

**La liste n'est plus tenue à la main** : `lib/listing-presence/mutation-registry.ts` (`LISTING_MUTATION_REGISTRY`)
est vérifié à chaque CI par `lib/__tests__/listing-mutation-provenance.test.ts`, qui analyse le dépôt avec le parseur
TypeScript (`lib/testing/listing-mutation-scan.ts`) — pas une recherche de texte.

**Ce qui compte comme mutation** (exactement ce qui déclenche l'enregistrement) :
- INSERT : `create`, `createMany`, `createManyAndReturn`, `upsert` ;
- DELETE : `delete`, `deleteMany` ;
- UPDATE qui PEUT modifier `isListed` : son `data` n'est pas un littéral prouvé sans `isListed`. Les diffusions de littéraux et les conditions sont suivies.
- écritures imbriquées par relation (`affiliateProducts: { create … }`) et SQL brut qui écrit la table ;
- appels des helpers d'historique de prix (`updateListingWithPriceSource`, `upsertListingWithPriceSource`) : leur effet se lit dans leurs arguments.

Les tests sont exclus du balayage, et le dépôt n'a aucune cascade de suppression vers `AffiliateProduct`.

**Recensement au 2026-11-24.**
- **60 écritures** au total ; 18 ne touchent pas `isListed` (prouvé), 42 peuvent changer la vie d'une annonce. Ces dernières se répartissent en :
  - 40 points d'écriture attribués ;
  - 2 helpers dont les appelants sont eux-mêmes listés.
- **Toutes ont une provenance déclarée**, dans leur propre transaction :

| Acteur | Chemins | Source |
|---|---|---|
| Revendeur | ajout (`affiliate/add`, `affiliate/products/add`, `affiliate/listings` POST, ajout rapide, invitation, devis), éditeur (`PATCH listings/[id]`, `PATCH products/[id]`), action groupée, retrait / suppression, publication, remplacement | `listing_create`, `reseller_ui` (hérité de l'historique des prix), `reseller_bulk`, `reseller_remove`, `replacement` |
| Imports | import URL revendeur, import URL marketplace + publication, pont Radar | `import` |
| Fournisseur | suppression, archivage, **suppression groupée de brouillons** | `supplier_withdrawal` |
| Admin | exclusivité, décisions sur imports revendeurs | `exclusivity`, `admin_review` |
| Compte | **suppression de compte revendeur et fournisseur** | `account_deletion` (nouveau) |
| Démo | **fixtures Demo Lab** | `demo` (nouveau) |
| Scripts | **seed, clear-products, copy-to-prod, fixtures de test**, hide-internal-test-products | `script` |

En gras : les chemins sans attribution avant le 2026-11-24 (11 points d'écriture).

**Mécanisme unique.** Toutes les déclarations passent par `lib/listing-presence/declare.ts` (`withListingPresenceSource` / `declareListingPresenceSource`) :
- le module n'a pas `server-only`, donc les scripts et les seeds l'utilisent aussi ;
- `record.server.ts` le réexporte ;
- la déclaration est un `set_config(…, true)` local à la transaction, lu par le déclencheur.

**Défaut corrigé.** Appelé avec un client de transaction déjà ouvert (`tx`), `withListingPresenceSource` exécutait l'écriture **sans rien déclarer**. Elle était donc enregistrée « unattributed ». Elle déclare désormais dans cette transaction.

**Ce que le verrou fait échouer en CI.**
- Une nouvelle écriture absente du registre.
- Une entrée périmée.
- Une source déclarée différente de celle du registre.
- Une déclaration faite dans une autre transaction que l'écriture.
- Une source héritée inconnue de l'historique de présence.
- Un chemin applicatif sans provenance.
- Une source déclarée que le moteur temporel ne sait pas lire.

Il ne bloque pas les écritures qui ne touchent pas `isListed`.

**Inconnu, dit tel quel.**
- Écriture faite hors application sans déclaration (console SQL) : « unattributed ».
- Événements enregistrés avant la déclaration d'un chemin : jamais réécrits.
- Annonces antérieures à l'historique : début inconnu.

Une source inconnue n'est jamais transformée en provenance.

Toutes les écritures, futures et SQL brut compris, restent capturées : c'est le déclencheur de base de données qui
enregistre. La déclaration qualifie, le verrou garantit qu'elle existe.

## 3. Structure

Table `ListingPresenceEvent` (ajout isolé, aucune colonne ajoutée à `AffiliateProduct`) : `id` (ordre d'écriture),
`affiliateProductId`, `affiliateId`, `productId`, `kind` (`created` | `listed` | `unlisted` | `deleted`),
`previousListed`, `newListed`, `source`, `actorId` (facultatif), `effectiveAt` (`clock_timestamp()` de l'écriture).
Contraintes : forme de chaque type d'événement, format de la source et de l'acteur. Pas de clé étrangère (un produit ou
un compte supprimé garde son passé jusqu'à la rétention). Trois index (référencement, produit × date, revendeur × date).

## 4. Garanties

- **Atomicité** : l'événement est écrit par le déclencheur dans la transaction de la mutation. Mutation échouée ou
  annulée = aucun événement ; mutation validée = événement présent (vérifié sur PostgreSQL 16 local et dans la CI).
- **Idempotence** : un événement n'est écrit que si `isListed` change réellement. Double clic, requête rejouée, retrait
  répété, enregistrement qui ne touche pas la présence : rien n'est écrit.
- **Concurrence** : deux retraits simultanés sont sérialisés par le verrou de ligne ; le second ne voit plus de
  changement et n'écrit rien (test CI).
- **Protection** : table en ajout seul — `UPDATE` toujours refusé, `DELETE` refusé sauf dans une transaction qui a
  déclaré le drapeau de purge (rétention, suppression de compte).
- **Jamais bloquant** : une source invalide est remplacée par `unattributed`, jamais refusée ; le déclencheur ne peut
  pas faire échouer l'écriture du référencement pour une raison qui lui serait propre.

## 5. Périodes et référencements préexistants

- Aucune date inventée, aucun remplissage rétroactif : les référencements existants à l'application de la migration
  n'ont pas d'événement. Leur période en cours a un **début inconnu** (`startKnown: false`, borne basse = `createdAt`
  du référencement) et la durée n'est comptée qu'à partir du début de l'historique (`finished_at` de la migration dans
  `_prisma_migrations`, avancé à la limite de la dernière purge de rétention).
- Statuts : `historique_exact`, `debut_inconnu`, `incoherent` (un événement manque : la frontière est dite
  inconnue, jamais devinée), `indisponible` (migration non appliquée).
- Calculs fournis (`lib/listing-presence/periods.ts`) : périodes distinctes, période en cours jamais traitée comme
  terminée, retraits, remises en vente (une première mise en ligne après une création « non listée » n'en est pas une),
  délais entre retrait et remise en vente, durée cumulée, jours de présence dans une fenêtre avec la part inconnue
  (`listedDaysInWindow` : distingue 3 jours de présence de 30).

## 6. Accès et confidentialité

- Revendeur : `GET /api/affiliate/listings/:id/presence` — son propre référencement seulement (404 sinon), jamais
  l'acteur. Fournisseur : aucun accès. Moteurs internes : `loadPresenceForProducts` (agrégation obligatoire avant tout
  affichage).
- Données : identifiants, deux booléens, un type, un code source, un horodatage. Aucune donnée acheteur, aucun texte
  libre, aucune donnée de navigation.
- Rétention proposée : 24 mois (`purgeExpiredListingPresence`, non planifiée — décision fondateur). Une purge rend le
  début des périodes les plus anciennes inconnu, elle n'invente rien.

## 7. Activation (décision fondateur)

1. Préproduction : `DATABASE_URL='<url staging>' npm run schema:migrate -- --expect-endpoint <ep staging>` puis
   `npm run schema:verify`.
2. Vérifier : retirer puis remettre en vente un produit de test → deux événements ; `GET …/presence` → périodes.
3. Production : même procédure avec `--confirm-production`, AVANT le push qui livre le code.
4. Tant que la migration n'est pas appliquée, tous les lecteurs répondent « historique indisponible » ; aucune écriture
   de référencement n'est affectée (le code ne lit ni n'écrit la table hors des déclencheurs ; la déclaration de source
   est un `set_config` qui fonctionne sans la table ; la purge de compte vérifie que la table existe).

## 8. Retour arrière

- Préféré : revenir sur le code ; la table et le déclencheur n'affectent aucune écriture.
- Arrêter l'enregistrement sans perdre l'historique : supprimer uniquement le déclencheur
  `AffiliateProduct_listing_presence_history` (première instruction du script de retour arrière).
- Tout supprimer : `scripts/migration-rollbacks/20261124090000_listing_presence_history.down.sql` (destructif, testé ;
  pour réinstaller, rejouer le SQL de la migration, idempotent — jamais `migrate resolve`).

## 9. Limites

- L'historique commence à l'application de la migration : rien d'exact avant.
- `effectiveAt` est l'heure de l'écriture dans la transaction, non celle de sa validation (écart de quelques
  millisecondes à secondes sur une longue transaction).
- La présence en boutique ne dit pas à elle seule si l'acheteur pouvait acheter (produit en pause, rupture, suspension
  Affisell) : ces axes restent à croiser.
- Depuis le 2026-11-24 la publication, les créations et les imports déclarent leur source ; restent `unattributed` les seeds, la démo, les fixtures et la plupart des scripts. La part réelle est mesurée (`loadPresenceSourceCoverage`).
- Consommateurs : détecteur d'angles morts (exposition, quand l'historique couvre toute la fenêtre) et moteur des opportunités temporelles (`docs` : `AGENTS.md`).
