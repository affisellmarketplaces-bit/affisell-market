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

## 2. Véritables points de mutation (écritures, pas lectures)

Environ 78 fichiers mentionnent `isListed` ; la plupart sont des lectures (filtres de boutique, catalogue, SEO,
statistiques). Les écritures réelles :

| Mutation | Où | Source déclarée |
|---|---|---|
| Création | `affiliate/add`, `affiliate/products/add`, `affiliate/listings` (POST), `affiliate-quick-add-listing`, `affiliate-url-import`, `marketplace/import-from-url`, `product-request-commission`, `supplier-invitation-affiliate-listing`, `radar-import-bridge`, `demo/ensure-demo-users`, scripts de seed / fixtures | héritée de l'historique des prix quand déclarée, sinon `unattributed` |
| Activation / désactivation par le revendeur | `PATCH affiliate/listings/[id]`, `PATCH affiliate/products/[id]` (via `updateListingWithPriceSource` → `reseller_ui` hérité), `PATCH affiliate/products/bulk` | `reseller_ui` / `reseller_bulk` |
| Publication | `affiliate-publish-listing.server.ts`, `marketplace/import-from-url` (mise en ligne) | `unattributed` |
| Retrait / remplacement | `reseller-replacement/replace.server.ts` (retrait, fin de remplacement) | `replacement` |
| Retrait ou suppression par le revendeur | `affiliate-listing-remove.ts` | `reseller_remove` |
| Décision admin sur import revendeur | `reseller-import/review.server.ts` (approbation, publication, rejet) | `admin_review` |
| Exclusivité accordée à un autre revendeur | `product-exclusivity.server.ts` | `exclusivity` |
| Retrait du produit par le fournisseur | `supplier-product-remove.server.ts` (archivage, suppression) | `supplier_withdrawal` |
| Suppression de compte | `delete-merchant-account.ts` | événements du revendeur purgés dans la même transaction |
| Traitements / scripts | `radar-import-bridge` (mise hors ligne), `scripts/hide-internal-test-products.ts`, `prisma/seed.ts`, `prisma/clear-products.ts`, deux anciennes migrations SQL (`UPDATE "AffiliateProduct"`, sans effet sur `isListed`) | `unattributed` |

Toutes ces écritures — et toute écriture future, SQL brut compris — sont capturées : c'est le déclencheur de base de
données qui enregistre, pas le code applicatif. La déclaration de source ne sert qu'à qualifier.

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
