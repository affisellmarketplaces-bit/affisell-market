# Horizon d'observation selon le contexte — méthode (2026-11-24)

**Question** : compte tenu de ce produit, de son contexte et des données réellement disponibles, quel horizon
d'observation est raisonnable avant d'évaluer sa performance ? Réponse personnalisée **seulement** quand une
validation indépendante la défend ; sinon la règle actuelle reste.

Code : `lib/reseller-copilot/contextual-horizon.ts` (pur) + `.server.ts` (lecture seule). Tests :
`lib/__tests__/contextual-horizon.test.ts`. Interrupteur `CONTEXTUAL_HORIZON_MODE` = `off` (défaut) | `observe` | `on`.

## 1. Facteurs et classes de données

| Classe | Facteurs | Pourquoi |
|---|---|---|
| Historisé (connu à la décision, reconstruit exactement pour le passé) | catégorie, ancienneté du produit au début de la période (`createdAt`), boutiques concurrentes en vente au début (historique de présence), remise en vente | aucune fuite |
| Recalculé (connu à une décision prise aujourd'hui, valeur actuelle pour le passé) | gamme de prix fournisseur, fiche complète (éléments à association établie), délai de retour étendu | utilisable au moment de la prédiction ; bruit d'étiquette à l'entraînement, dit |
| Fuites (jamais utilisées) | ventes de la période, demande actuelle, vendable aujourd'hui, tendance actuelle, durée de la période | information future |
| Inconnus (jamais inventés) | trafic, disponibilité passée, prix revendeur au début, photos au début | non enregistrés |

Bandes volontairement larges (3 niveaux) pour éviter les segments artificiellement précis.

## 2. Censure

Le délai avant première vente est un temps de survie. Une période encore en vente ou retirée sans vente est
**censurée** à sa durée — jamais « ne vendra pas », jamais un faux échec. Estimateur de Kaplan–Meier ; horizon =
moment où 75 % des premières ventes survenant dans les 90 jours sont arrivées, borné [14, 60] (règle actuelle
conservée), arrondi à la semaine pour une valeur personnalisée.

## 3. Découverte (moitié ancienne des périodes, par date de début)

Log-rank à k groupes par facteur et par paire ; Benjamini–Hochberg 10 % ; robustesse : toujours p < 0,05 sans le
revendeur dominant et sans la catégorie dominante ; niveaux ≥ 20 premières ventes de ≥ 5 revendeurs ; effet
commercialement significatif (≥ 7 jours d'écart à l'horizon général). Une paire n'est utilisée que si ses deux
facteurs sont retenus seuls. Stabilité vérifiée sur la moitié récente (confirmé / non confirmé / inversé).

## 4. Évaluation (moitié récente uniquement)

Modèles ajustés sur la moitié ancienne, revendeur de la période test toujours retiré de sa référence :
baseline = règle actuelle (produit → catégorie → général, premières ventes seulement), général KM, catégorie KM,
catégorie × prix KM, contextuel KM. Perte quantile (τ = 0,75) sur les périodes suivies 90 jours complets
(sinon les ventes tardives seraient sous-représentées), comparée **par produit** : z ≥ 2, test des signes
p < 0,05, z ≥ 2 sans le produit le plus favorable, ≥ 6 produits, ≥ 30 ventes. Calibration : part des premières
ventes arrivées avant l'horizon (Wilson 95 % autour de 75 %), hors horizons aux bornes (comptés à part : la borne
est une règle produit). Verdict contextuel `meilleur` seulement si tout tient et si la calibration n'est pas pire
que la baseline ; sinon `experimental`, `abandonne` (aucun facteur retenu) ou `insuffisant`.

## 5. Résultats sur données synthétiques (seule validation possible ici)

- Effet réel injecté (concurrence) : retenu, stable sur la moitié récente, le modèle contextuel bat la règle
  actuelle (z ≈ 4,6, signes p ≈ 0,02, robuste), calibré hors bornes.
- Aucun effet : 0 facteur retenu sur 12 tirages indépendants → `abandonne`.
- Effet porté par un revendeur dominant : rejeté (non robuste).
- Défauts trouvés et corrigés pendant la validation : paire retenue à cause d'un seul de ses facteurs ; calibration
  biaisée par la censure (mesure restreinte au suivi complet) ; bornes [14, 60] faussant la calibration.

**Aucune donnée réelle n'a été analysée** : la migration de l'historique de présence n'est pas appliquée.

## 6. Utilisation dans le plan et boucle continue

Le plan n'utilise l'horizon contextuel que si `CONTEXTUAL_HORIZON_MODE=on`, verdict `meilleur`, cellule du profil
fiable **sans le revendeur concerné**, écart ≥ 7 jours, et jamais à la place de la référence propre au produit.
Le texte dit le profil, l'écart à la référence générale, la source et « estimation indicative ». Instantané
quotidien du verdict (`copilot.contextual_horizon_snapshot`, clés fermées) → dérive des facteurs (stable / nouveau /
perdu / intermittent). L'évaluation des plans sépare horizons contextuels et standard. Rien n'est réajusté
automatiquement.
