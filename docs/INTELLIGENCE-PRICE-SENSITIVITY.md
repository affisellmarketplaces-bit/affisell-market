# Sensibilité de la demande au prix — revue de la méthode (2026-11-18)

Code : `lib/strategic-intelligence/price-response.ts` (mesure, agrégation, fiabilité, validation),
`demand-adjusted-simulation.ts` (simulation), `price-estimate-history.server.ts` (historique des prévisions).
Usage **interne** uniquement : cockpit `/admin/intelligence`. Rien n'est montré aux revendeurs comme recommandation de prix,
et aucun prix n'est modifié.

## 1. Ce que le code faisait, ce qui était faux ou trop fort, ce qui a changé

| Point revu | Avant | Problème | Après |
|---|---|---|---|
| Définition de l'élasticité | Différence de log des **commandes** de l'annonce, moins celle des autres annonces du même produit, divisée par ln(p1/p0) | Juste, mais jamais écrit clairement : il s'agit de commandes et non d'unités, de l'annonce et non du produit, et le +½ sur les comptes atténue l'estimation sur de petits volumes | Inchangé, désormais documenté en tête du fichier |
| Groupe de comparaison | Autres annonces du même produit sans changement du prix principal | Une annonce **créée pendant la fenêtre** gonflait l'« après » des témoins. Une annonce dont seul le prix d'une **variante** avait changé restait un témoin | Annonces trop récentes exclues (comme annonce modifiée : motif `listing_too_new` ; comme témoin : ignorée). Tout changement de prix d'une variante disqualifie le témoin |
| Périodes avant / après | ±14 jours, commandes du jour du changement comptées « après » | Correct | Inchangé |
| Effets fixes | Annonce (avant / après) et produit × jours (témoins) | Rien sur le revendeur × temps. L'affichage disait « trafic, promotions, ruptures neutralisés » : **trop fort** | La formulation exacte devient : neutralisé = ce qui touche **dans la même proportion** toutes les annonces du produit les mêmes jours ; non neutralisé = campagne, trafic ou coupon propres au revendeur, annonce masquée, stock d'une variante, moment choisi, ventes prises aux autres revendeurs, conversion et visibilité confondues (`PRICE_RESPONSE_SCOPE`, figé par un test) |
| Biais du moment choisi | Mentionné, jamais testé | Une baisse décidée après de mauvaises ventes peut sembler efficace (retour à la moyenne) | **Placebo** : même calcul sur les 14 jours précédents, sans changement de prix. Un écart déjà présent fait baisser la fiabilité |
| Dépendance entre observations | Chaque changement était traité comme indépendant | Les changements d'un même produit partagent leurs témoins | Nombre minimal de produits distincts (3). L'influence est testée en retirant **un produit** à la fois ; une conclusion qui dépend d'un seul produit est signalée comme « fragile » |
| Petits échantillons, valeurs atypiques | Moyenne pondérée à effet fixe, ±2 erreurs types | Intervalle **trop étroit** dès que les changements divergent. Un changement très précis pouvait tout décider | Effets aléatoires (DerSimonian–Laird) ; erreur type = la plus grande entre DL et Hartung–Knapp ; quantiles de Student ; hétérogénéité I² affichée |
| Intervalles | Un seul intervalle | Celui de la **moyenne** d'une catégorie était appliqué à un produit | Deux intervalles : celui de la moyenne (seule base des conclusions) et celui d'un **produit pris isolément**, plus large, seul utilisé par la simulation |
| Seuil de 5 changements | Suffisait pour tirer une conclusion | Il suffit pour un premier calcul, pas pour avoir confiance | Niveau de **fiabilité** déterminé par la propriété la plus faible (§2) |

## 2. Niveau de fiabilité

- **Insuffisante** : moins de 3 produits distincts, ou un seul revendeur à l'origine des changements. Aucun signal n'est émis.
- **Faible** : au moins une des conditions suivantes :
  - moins de 15 changements ou moins de 5 produits ;
  - revendeurs inconnus ;
  - conclusion qui dépend d'un seul produit ;
  - placebo non testable ou en écart ;
  - hétérogénéité supérieure à 75 % ;
  - estimation instable entre les deux moitiés de la période ;
  - validation hors échantillon impossible, ou qui ne montre pas une meilleure prévision que le volume constant.

  Le signal est affiché comme « à étudier », avec une confiance basse et la consigne « ne rien décider ».
- **Modérée** : toutes les vérifications passent, y compris une prévision hors échantillon **meilleure que le volume constant** (au moins 10 prévisions, z ≥ 2).
- **Solide** : niveau modéré, avec au moins 40 changements, 15 produits, 10 revendeurs, 15 placebos, une hétérogénéité d'au plus 50 % et une estimation stable.

Seules les fiabilités « modérée » et « solide » modifient un volume simulé.

## 3. Validation : ce que le modèle prédit, et à quel point il a raison

- **Hors échantillon, sans regarder l'avenir** (`backtestEvents`) : chaque changement est prédit uniquement à partir des changements dont la fenêtre était terminée à sa date. La prévision est comparée au volume constant (« le prix ne change rien »). Le calcul donne l'erreur moyenne, un z apparié, et la part des résultats tombés dans l'intervalle annoncé (environ 95 % attendus si l'incertitude affichée est honnête).
- **Historique des prévisions** (`intelligence.price_response_estimate` dans `AuditLog`, aucune migration) :
  - la tâche quotidienne enregistre l'estimation de chaque périmètre, une ligne par jour avec un identifiant déterministe ;
  - le cockpit note ensuite chaque nouveau changement de prix avec la **dernière estimation enregistrée avant** ce changement.
- **Stabilité** : comparaison de la première et de la seconde moitié de la période, et effet du retrait d'un produit à la fois.
- **Catégories insuffisamment documentées** : listées sur le cockpit avec ce qui leur manque.

## 4. Simulation : trois niveaux

- **Observé** : les commandes et marges du produit sur 30 jours.
- **Estimé** : une variation de prix dans le même sens et de même ampleur que ce qui a été observé, avec l'intervalle « un produit ». Le cockpit précise si le produit contribue lui-même à la mesure.
- **Hypothétique** : le même calcul au-delà de ce qui a été observé (variation plus grande, ou hausse alors que presque seules des baisses ont été mesurées). Il est affiché et étiqueté, jamais présenté comme une estimation.

Sinon, la simulation revient au **volume constant** et affiche la raison.

## 5. Limites qui restent

- Pas de données de visites : on ne peut pas séparer l'effet sur la conversion de l'effet sur la visibilité.
- Pas d'historique de la visibilité d'une annonce : une annonce masquée pendant la fenêtre n'est pas détectée.
- Pas d'historique des promotions propres à un revendeur.
- Les comptes de commandes sont souvent plus dispersés qu'une loi de Poisson : la variance entre changements l'absorbe en partie, sans le corriger.
- Avec une fenêtre de 14 jours et 60 jours de commandes lues, le placebo n'existe que pour les changements datant de 28 à 46 jours.
