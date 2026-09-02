# Checklist juridique — Commissionnaire-affilié (L132-1)

Audit interne Affisell avant mise en production ou levée de fonds.

## Immatriculation & statut

- [ ] L'Affilié-Commissionnaire est **commerçant immatriculé** (RCS / équivalent UE) ou auto-entrepreneur avec activité de revente commissionnée déclarée
- [ ] Profil `MerchantLegalProfile` complété avant **publication live** (KYC publish gate)
- [ ] Compte **Stripe Connect** actif pour encaissement et reversements

## Liberté de prix (anti L134-1)

- [ ] Chaque commande marketplace enregistre `pricingFreedom = true` sur `Order`
- [ ] Snapshot `AffiliateSale` avec `marginAmountCents`, `commissionAmountCents`, `resalePriceCents`
- [ ] Dashboard affilié affiche **Ma Marge (libre)** et **Ma Commission** séparément
- [ ] Aucune clause imposant un prix de revente identique pour tous les affiliés

## Double facturation

- [ ] Facture **client** (`type=CUSTOMER`) émise au nom de l'**Affilié-Commissionnaire**
- [ ] Facture **wholesale** (`type=SUPPLIER`) Fournisseur → Affilié au prix HT fournisseur
- [ ] TVA calculée sur le **prix final TTC** client, pas sur la seule commission
- [ ] Mention légale facture : « Vente en qualité de commissionnaire-affilié — Livraison directe fournisseur »

## Wording & CGV

- [ ] CGA / contrat utilisent **Affilié-Commissionnaire** ou **Commissionnaire-affilié**
- [ ] Contrat titré : **Contrat d'Affiliation-Commission en vente directe sans stock (Art L132-1)**
- [ ] Disclaimer checkout : vendu/facturé par Commissionnaire, livré par Fournisseur
- [ ] **Aucune mention** « apporteur d'affaires » restante
- [ ] **Aucune mention** « agent commercial » pour qualifier l'affilié
- [ ] CGV client identifient le **Commissionnaire comme vendeur** apparent

## Clauses contractuelles obligatoires

- [ ] Marge libre + risque commercial affilié
- [ ] Mandat non transparent (client → affilié seul vendeur)
- [ ] Absence d'exclusivité de prix imposée
- [ ] Clause ducroire documentée si garantie d'impayé

## Code & données

- [ ] `recordAffiliateSaleFromOrder` appelé à chaque fulfill Stripe (idempotent)
- [ ] Tests unitaires `affiliate-commissionnaire-shared`
- [ ] Logs `[affiliate-commissionnaire]` présents dans Metabase

## Dernière revue

| Date | Revue par | Résultat |
|------|-----------|----------|
| {{LAST_UPDATED}} | Agent juridique Affisell | En cours |
