# Anciens imports revendeurs — inventaire et méthode de régularisation

Préparé le 18 novembre 2026. Rien n'a été supprimé, dépublié ni modifié.

## Ce qui est concerné

Les produits importés par lien par des revendeurs avant la mise en place de la validation
(`importSource = reseller_url_import`, aucune étiquette `import-review:*`). Ils ont été publiés et mis en ligne sans
contrôle d'un administrateur. Ils apparaissent dans `/admin/reseller-imports`, filtre « Anciens imports ».

## Inventaire (lecture seule)

`npm run report:legacy-reseller-imports` (voir `PRODUCTION-REPORTS-AUTHORIZATION.md` : `--target` d'abord, puis
`--confirm-endpoint=…` sur la production, après ton accord). Il donne :

- nombre de produits, en ligne / en brouillon ;
- nombre d'annonces, visibles, et de revendeurs concernés ;
- ventes : produits vendus sur 90 jours, commandes payées sur 90 jours et au total ;
- sites d'origine (hôte de l'URL importée) et mois d'import ;
- risques sur les produits **en ligne** : données de sécurité produit obligatoires absentes, rappel produit ouvert,
  absence de photo, stock de remplissage (1 / 99 / 100 / 999), description vide, prix nul, source inconnue.

## Risques identifiés (avant chiffrage)

1. **Conformité** : un import par lien ne porte presque jamais les données fabricant / responsable UE. Un produit
   physique vendu dans l'UE sans ces informations est exposé au règlement sur la sécurité générale des produits.
2. **Propriété du produit** : ces fiches sont rattachées au compte « Import Vault », pas à un fournisseur qui en
   répond. Personne n'est engagé contractuellement sur leur livraison, leurs retours, leur garantie.
3. **Stock fictif** : le stock importé n'est pas un inventaire tenu à jour.
4. **Contenu** : photos et textes copiés depuis un autre site (droits d'auteur, marques).

## Méthode de régularisation proposée

Par lots, dans cet ordre, chaque décision passant par la page admin (raison obligatoire, journal) :

1. **Lancer l'inventaire** (avec ton autorisation) pour connaître les volumes réels.
2. **Retirer en priorité** (refus) les produits en ligne avec un rappel ouvert, sans photo, à prix nul ou de source
   inconnue : aucun de ces produits ne peut être vendu proprement.
3. **Produits qui se vendent** (ventes sur 90 jours) : ne pas les retirer d'un coup. Chercher un fournisseur du
   catalogue qui propose le même article (même GTIN quand il existe) et proposer aux revendeurs de basculer leur
   annonce ; sinon, compléter les données de sécurité puis approuver, ou refuser avec un préavis aux revendeurs.
4. **Produits qui ne se vendent pas** : refus groupé après un message aux revendeurs concernés (délai à fixer).
5. Une fois le stock d'anciens imports à zéro, l'étiquette `legacy_unreviewed` disparaît d'elle-même de la liste.

Points à décider par toi : retirer ou garder pendant la régularisation ; délai de préavis aux revendeurs ; si un
refus groupé doit exister dans l'outil (aujourd'hui, une décision par produit).
