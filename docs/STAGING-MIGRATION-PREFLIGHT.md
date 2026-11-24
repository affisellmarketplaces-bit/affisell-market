# Préparation de la migration du staging : inventaire et décision (2026-11-24)

> Mission en lecture seule. **Aucune base n'a été contactée**, ni le staging ni la production. Aucune migration n'a été appliquée, aucun schéma modifié, aucun drapeau changé.
>
> Seule base utilisée : un PostgreSQL 16 jetable créé pour l'occasion sur cette machine, joignable par socket local uniquement, puis détruit.
>
> Branche `release/finalisation-2026-11-13`, tête `0d7362a77`. Elle est identique à `origin` : aucune divergence. Le commit `0d7362a77` y figure ; une autre session pousse aussi sur cette branche. Une branche locale `backup/reconciliation-db-fix-111dd9bb8` conserve un correctif équivalent, non poussé et non fusionné.

## 1. Ce qui est connu et ce qui ne l'est pas

| Question | Réponse | Preuve |
|---|---|---|
| Migrations présentes dans le dépôt | **206** (`prisma/migrations`), appliquées par Prisma dans l'ordre de leur nom | Liste du répertoire |
| État du staging (migrations appliquées, en attente, échouées) | **INCONNU** | Cette session n'a ni l'URL du staging ni aucun identifiant, et ne doit pas en chercher. Ni l'historique Git ni une base locale ne permettent de déduire cet état. |
| État de la production | **INCONNU** (hors mission) | Même raison |
| Migrations déclarées « appliquées nulle part » par la documentation | `20261119090000_procurement_debit_register` et `20261124090000_listing_presence_history` | `docs/PROCUREMENT-DEBIT-REGISTER.md` §0 et `docs/LISTING-PRESENCE-HISTORY.md`. Il s'agit d'une déclaration écrite, pas d'une lecture de la base. |
| Autres migrations récentes | Notées « à appliquer à la main avant la mise en ligne », sans trace écrite d'une application | `AGENTS.md`. Leur absence d'application n'est pas prouvée non plus. |

**Commande en lecture seule qui lèverait l'inconnue**. Elle n'a pas été exécutée et demande une autorisation ainsi que l'URL du staging, fournie par le fondateur :

```
DATABASE_URL='<url staging>' node scripts/prisma-explicit-db.mjs status
```

La session est rendue en lecture seule par le serveur (`default_transaction_read_only=on`). Le script vérifie que l'endpoint est bien `ep-shy-wind-…` avant de lire quoi que ce soit.

Il faut compléter par `DATABASE_URL='<url staging>' npm run schema:verify`, qui reste en lecture seule. **Attention** : `schema:verify` ne contrôle le catalogue que pour la colonne vertébrale d'événements. Les tables d'historique sont contrôlées par `npm run report:presence-readiness`, également en lecture seule.

## 2. Inventaire des dix migrations les plus récentes

Ce sont les candidates les plus probables à « en attente ». Rien ne prouve non plus que les migrations antérieures soient appliquées sur le staging : leur état est à lire lui aussi.

| # | Migration | Objet | Objets créés ou modifiés | Nature | Risque sur les données existantes | Dépend de |
|---|---|---|---|---|---|---|
| 1 | `20261007100000_supplier_compliance_profile` | Profil réutilisable fabricant / représentant UE d'un fournisseur | Table `SupplierComplianceProfile`, index unique, clé étrangère vers `User` (supprimée puis recréée) | Additive | Aucun : nouvelle table | `User` |
| 2 | `20261007120000_order_return_terms` | Fenêtre de retour figée à l'achat | Table `OrderReturnTerms` | Additive | Aucun | — |
| 3 | `20261007140000_event_spine` | Colonne vertébrale d'événements (S1) | 15 colonnes nullables, 1 index unique et 3 index **non concurrents**, 3 CHECK sur `AffisellTrackEvent` | Additive, sur une **table existante** | Pas de perte de données. En revanche, verrous : les CHECK (sans `NOT VALID`) parcourent toute la table sous verrou exclusif, et les index sont construits sans `CONCURRENTLY`, ce qui bloque les écritures de la table pendant leur construction. La durée dépend du volume de la table, **inconnu**. **Non idempotente** : relancée à la main, elle échoue. | `AffisellTrackEvent` |
| 4 | `20261116200000_product_price_history` | Historique des prix fournisseur | Table `ProductPriceHistory`, 3 fonctions, déclencheurs sur **`Product`** et `ProductVariant` | Additive | Le déclencheur s'exécute à chaque écriture de prix sur la table la plus sollicitée. Il n'ajoute que des lignes et ne refuse rien. Coût par écriture non mesuré sur les volumes réels. | `Product`, `ProductVariant` |
| 5 | `20261117090000_listing_price_history` | Historique des prix de vente revendeur | Table `ListingPriceHistory`, fonction, déclencheur sur `AffiliateProduct` | Additive | Même nature. `effectiveAt` prend `CURRENT_TIMESTAMP`, qui dépend du fuseau horaire de la session (voir §3). | `AffiliateProduct` |
| 6 | `20261117120000_reseller_profit_alerts` | Alertes de rentabilité revendeurs | 3 tables, index uniques | Additive | Aucun | — |
| 7 | `20261117150000_intelligence_decision_journal` | Journal des décisions du cockpit | 2 tables, index unique partiel | Additive | Aucun | — |
| 8 | `20261117180000_intelligence_signal_log` | Historique des signaux | 1 table, 1 index | Additive | Aucun | — |
| 9 | `20261119090000_procurement_debit_register` | Registre des débits d'achat | 2 tables, contraintes, fonction et déclencheur de plafond | Additive, isolée | Aucun | — |
| 10 | `20261124090000_listing_presence_history` | Historique de présence (collecte) | Table `ListingPresenceEvent`, 3 fonctions, déclencheur sur `AffiliateProduct` (création, changement de `isListed`, suppression), déclencheurs « ajout seul » et anti-TRUNCATE | Additive, isolée (aucune clé étrangère) | Aucune donnée réécrite. **Démarre la collecte dès son application.** | `AffiliateProduct` |

Aucune des dix migrations ne supprime de table ou de colonne, ne réécrit de données (`UPDATE` / `DELETE` hors fonctions) ni ne remplit rétroactivement quoi que ce soit.

Les `INSERT` présents dans les fichiers se trouvent à l'intérieur des fonctions de déclenchement. La seule instruction `DROP` touche la clé étrangère du n° 1, qui est recréée aussitôt.

**Utiles à la collecte de présence** : le n° 10 est indispensable. Le n° 5 est facultatif (voir §3).

**Sans rapport avec la collecte**, mais appliquées quand même par `migrate deploy` si elles sont en attente : les n°s 1 à 4 et 6 à 9.

## 3. Dépendances réelles

- **La présence ne dépend pas de l'historique des prix.** Le SQL du n° 10 ne lit que `AffiliateProduct`. Le moteur de rapprochement lit `ListingPriceHistory` uniquement après avoir vérifié qu'elle existe (`to_regclass`).
  - Sans elle, le témoin « création » passe en `source_illisible` (non vérifiable).
  - Les témoins « retrait journalisé » et « état courant » fonctionnent toujours.
  - L'historique des prix n'est donc **pas nécessaire**. Il ajoute seulement un témoin de création indépendant.
- **Risque propre à l'historique des prix** : il écrit `CURRENT_TIMESTAMP`, qui suit le fuseau de la session. Le rapprochement en tient compte : il lit `pg_settings.reset_val` de `TimeZone`. En UTC la marge est nulle ; sinon une marge de 14 h est exclue.
  - Le fuseau par défaut du staging est **inconnu**. Il se lit avec `SHOW TimeZone` en lecture seule.
- **Appliquer une migration isolément n'est pas possible avec les outils du projet.** `prisma migrate deploy` applique *toutes* les migrations en attente, dans l'ordre. Rien dans le projet n'en sélectionne une seule.
  - `migrate resolve --applied` est interdit par les tests du dépôt, et il serait de toute façon mensonger.
  - Le n° 10 étant le dernier, l'appliquer revient à appliquer d'abord tout ce qui est en attente avant lui.
  - Si le staging est en retard, **l'application est groupée**.
  - Jouer à la main le SQL d'une seule migration laisserait `_prisma_migrations` en désaccord. La migration serait alors rejouée au déploiement suivant : sans conséquence pour celles qui sont idempotentes, avec un **échec** pour le n° 3.

## 4. Restauration : préparation, non validée

- **Point de restauration** : Neon conserve un historique continu (PITR). Avant l'application, il faut :
  1. noter l'**heure UTC** exacte (`date -u +%FT%TZ`) ;
  2. créer une branche Neon enfant du staging à cet instant (`restore-check-<AAAAMMJJ-HHMM>`), en lecture seule. C'est l'empreinte vérifiable du « avant ».

  La fenêtre de rétention du plan Neon est **inconnue**. Elle se lit dans la console, en lecture seule : `docs/BACKUP-RESTORE.md` §3.1.
- **Restaurer les données n'est pas annuler le schéma.**
  - Le PITR remet *toute* la branche (données, schéma et `_prisma_migrations`) à l'instant T, sur place, sur le même endpoint, selon `docs/BACKUP-RESTORE.md` §3.5. Tout ce qui a été écrit après T est perdu.
  - Un retour arrière de schéma (`scripts/migration-rollbacks/*.down.sql`, disponible pour les n°s 9 et 10 seulement) supprime les objets mais **laisse la ligne dans `_prisma_migrations`**. Prisma croit alors la migration appliquée. Pour la recréer, il faut rejouer son SQL à la main (idempotent), jamais `migrate resolve`. `schema:verify` ne voit pas cet écart pour ces tables ; `report:presence-readiness` le voit.
  - Les n°s 1 à 8 n'ont pas de fichier de retour arrière. Le retour arrière le moins risqué est de **revenir au code précédent** : toutes les tables sont nouvelles et isolées, et les colonnes du n° 3 sont nullables.
- **Compatibilité Neon / Prisma** : une restauration sur place garde l'endpoint, donc les gardes du dépôt reconnaissent toujours le staging.
  - Une restauration vers une *nouvelle* branche changerait d'endpoint : `schema-deploy` refuserait alors (cible inconnue), ce qui est voulu.
- **Ce qui a été vérifié aujourd'hui**, sur une base locale jetable : `npm run rehearse:migrations` (`scripts/rehearse-migration-chain.sh`).
  - **Les 206 migrations rejouées depuis une base vide : 204 passent, 2 échouent.** Ce sont `20260801210000_sponsor_success_fee` et `20260801220000_sponsor_charge_reversed_cents`, car les tables `SponsorCampaign` / `SponsorCampaignCharge` n'ont jamais été créées par une migration (anciennes passes `db push` ou d'auto-réparation).
    - Conséquence : **la chaîne seule ne reconstruit pas le schéma**. Une base de staging ne peut pas être reproduite fidèlement à partir du dépôt, et la CI construit son schéma depuis le modèle de données, pas depuis la chaîne.
    - Les dix migrations récentes s'appliquent proprement sur l'état produit par la chaîne.
  - Ré-application des dix : neuf sont idempotentes ; le n° 3 ne l'est pas.
  - Retour arrière de la présence : `down.sql` ramène à 0 déclencheur et supprime la table. Le SQL de la migration rejoué ramène les 3 déclencheurs et la table.
  - **Non vérifié** : un PITR Neon réel, la durée des verrous du n° 3 sur le vrai volume de `AffisellTrackEvent`, le comportement de `prisma migrate deploy` lui-même (moteur Prisma absent de cet environnement).
- **Test de restauration isolé le plus sûr**, sans toucher au staging ni à la production :
  1. dans une branche Neon **enfant** du staging créée à T (sur autorisation, elle est jetable), appliquer `schema:migrate` avec l'endpoint de cette branche ;
  2. vérifier, en lecture seule, `report:presence-readiness` et `probe:capture-sentinel` (variante staging encore refusée par conception) ;
  3. chronométrer les verrous du n° 3 ;
  4. supprimer la branche.

  C'est la seule répétition sur des données de forme réelle. Elle demande une autorisation écrite : création de branche Neon et clé d'API.

## 5. Stratégie d'application la moins risquée

Pour décision, rien n'est exécuté ici.

1. **Lire** l'état du staging (§1, lecture seule, autorisation n° 1) : migrations en attente, migrations échouées (`P3009`), fuseau par défaut, volume de `AffisellTrackEvent`.
2. Si une migration est en état **échoué** : s'arrêter. La procédure `resolve --rolled-back` relève d'une décision distincte.
3. **Répéter** sur une branche Neon enfant (§4), puis contrôler les verrous et `report:presence-readiness`.
4. **Point de restauration** : heure UTC plus branche `restore-check-…`, et rétention confirmée.
5. **Appliquer** sur le staging, de façon groupée (c'est inévitable) : `DATABASE_URL='<staging>' npm run schema:migrate -- --expect-endpoint ep-shy-wind-…`, dans une fenêtre où le staging reçoit peu d'écritures (verrous du n° 3). Puis `schema:verify` et `report:presence-readiness`.
6. Seulement ensuite, la suite de `docs/STAGING-COLLECTION-DECISION.md` (sonde, J+1, J+7). Aucun moteur n'est activé avant les étapes prévues dans ce document.

Option de réduction du risque si le staging est très en retard : appliquer d'abord sans le n° 10.

**Ce n'est pas possible tel quel**, car Prisma applique jusqu'à la dernière migration. Cela demanderait de livrer le n° 10 dans un commit postérieur au premier `migrate deploy`, c'est-à-dire un ordre de fusion, ce qui relève d'une décision du fondateur.

## 6. Recommandation

**BLOQUÉ — INFORMATIONS MANQUANTES.**

Le SQL du dépôt ne présente pas de risque de migration bloquant : tout est additif, et les verrous du n° 3 sont à mesurer.

En revanche, la liste des migrations en attente sur le staging, l'existence d'une migration échouée, le fuseau par défaut, la rétention PITR et le volume de `AffisellTrackEvent` sont inconnus.

La décision ne peut pas être prise sans la lecture du §1, qui demande une autorisation et l'URL du staging.
