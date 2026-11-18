# Rapports en lecture seule — fiche à valider avant toute lecture de la production

Préparée le 18 novembre 2026. **Aucun de ces rapports n'a été lancé.**

## 1. Base et environnement réellement ciblés

Les rapports lisent `DATABASE_URL`, dans cet ordre : variable du terminal, sinon `.env.local`, sinon `.env`.
D'après la documentation du dépôt, `.env.local` du poste de développement contient l'URL de **production**
(endpoint Neon `ep-misty-sea-al1ne07p`). Je ne peux pas le vérifier moi-même : ce fichier n'existe que sur ta
machine, et je ne l'ai pas lu.

La vérification exacte, **sans aucune connexion** à la base :

```
npm run report:legacy-reseller-imports -- --target
npm run report:listing-readiness -- --target
npm run report:checkout-stock -- --target
```

Chaque commande affiche l'hôte masqué, l'identifiant de l'endpoint, l'environnement (production / staging / local /
non identifié), le fichier d'où vient l'URL, les tables lues et les garanties, puis s'arrête. Aucun mot de passe
n'est affiché.

## 2. Tables et données consultées

| Rapport | Tables | Ce qui est affiché |
|---|---|---|
| `report:legacy-reseller-imports` | Product, ProductAttribute (clés de conformité), AffiliateProduct, Order (comptages), ProductRecall (comptages) | Agrégats : nombre de produits, d'annonces, de revendeurs, ventes, sites d'origine, mois d'import, risques |
| `report:listing-readiness` | Product, ProductAttribute (clés de conformité) | Agrégats et identifiants internes des 10 fournisseurs les plus concernés |
| `report:checkout-stock` | Product | Agrégats et identifiants internes des 10 fournisseurs les plus concernés |

Aucun e-mail, nom de client, adresse ou montant individuel n'est affiché.

## 3. Lecture seule — comment elle est garantie

Deux protections indépendantes, communes aux trois rapports depuis le 18 novembre (`scripts/lib/read-only-report.ts`) :

1. toutes les lectures se font dans une transaction dont la première instruction est `SET TRANSACTION READ ONLY` :
   PostgreSQL lui-même refuse toute écriture (prouvé sur un vrai PostgreSQL dans la CI,
   `fee-reconciliation-db.test.ts`, même mécanisme) ;
2. le client de base de données n'accepte que les lectures (`find`, `count`, `aggregate`, `groupBy`) et refuse le
   reste **avant** d'atteindre la base.

Des tests vérifient qu'aucun des trois scripts ne crée son propre client, n'appelle d'écriture, et que le refus se
produit avant toute connexion (`read-only-reports.test.ts`).

## 4. Absence de mutation, de migration et d'écriture indirecte

- Aucune migration : les scripts n'appellent ni Prisma CLI ni `migrate`.
- Aucune écriture indirecte : pas de trigger déclenché (une transaction en lecture seule ne peut rien insérer),
  pas d'appel au code applicatif qui écrit (journal, événements, notifications), pas de Redis, pas d'appel externe.
- **Verrou d'autorisation** : sur une base de production (ou non identifiée), le rapport refuse de s'exécuter sans
  `--confirm-endpoint=<identifiant de l'endpoint>`. Ce paramètre est la trace écrite de ton autorisation.

## 5. Ce que je te demande

L'autorisation de lancer, sur la base affichée par `--target` :

```
npm run report:legacy-reseller-imports -- --confirm-endpoint=<endpoint>
npm run report:listing-readiness -- --confirm-endpoint=<endpoint>
npm run report:checkout-stock -- --confirm-endpoint=<endpoint>
```

Tu peux les lancer toi-même ; ils ne demandent aucune clé Stripe ni AliExpress. Le rapprochement des frais
(`report:fee-reconciliation`) a ses propres règles (mode plan par défaut, clé restreinte) et n'est pas concerné ici.
