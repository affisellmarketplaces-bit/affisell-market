# Fonctions « IA » : honnêteté et mesure

> Règle du fondateur : **ne pas créer de fausse intelligence artificielle. Si une fonctionnalité repose sur une règle
> déterministe, l'indiquer clairement.** Corollaire : un chiffre de précision, de latence ou de coût n'est affiché que s'il a été
> **mesuré** ; sinon il est absent ou marqué « objectif non mesuré ».
> État du code décrit ici : branche `fix/ai-honesty-and-measurement` (2026-11-13). Rien de ce document n'a été exécuté contre un
> vrai modèle ni contre la production.

## 1. Ce que fait réellement chaque fonction

| Fonction | Ce que c'est vraiment | Étiquette dans le produit |
|---|---|---|
| **InstantScan — étape « rapprochement catalogue »** (anciennement « CLIP » / stage `embed`) | Un modèle de vision mini (`gpt-4o-mini` par défaut) lit la photo et écrit des **indices texte** ; ils sont comparés **comme du texte** (vecteurs lexicaux par hachage de caractères et de mots, `hashedLexicalVector`) à une liste de modèles **écrite à la main** (`lib/ai/curated-product-catalog.ts`). **Aucun CLIP, aucune image vectorisée, aucun modèle d'embedding.** | stage `catalog_match`, `provenance.method = catalog_lexical_match`, jamais de `confidence`, toujours `needsReview` |
| **InstantScan — vision complète** | Un appel à un modèle de vision (`gpt-4o` par défaut). La `confidence` renvoyée est ce que **le modèle écrit sur lui-même**, plafonnée par quelques règles (`auditProductVisionConfidence`) : ce n'est pas une probabilité calibrée. Absente si le modèle n'en donne pas. | stage `gpt4o` ou `mini` (si repli), `provenance.modelUsed`, `provenance.fallbackUsed`, `provenance.confidenceSource` |
| **Liste « Top 100 »** | Une liste éditoriale de 81 modèles d'électronique, tapée à la main. **Pas un classement mesuré.** Elle était complétée jusqu'à 100 par des lignes factices `generic-sku-N` (supprimées) et les variantes recevaient un prix forfaitaire inventé (749 / 1599 / 299 : supprimé, `null`). | `CURATED_PRODUCT_CATALOG` ; une ligne `synthetic: true` n'est jamais indexée ni retournée |
| **World Radar — lignes générées** | Le générateur déterministe (`lib/radar/scoring-engine.ts`) : un pool d'archétypes écrits à la main, une pondération culturelle et un bruit issu d'un hachage. **Aucun signal social / e-commerce / recherche n'est lu.** | `source: "mock"`, ligne `synthetic: true`, libellé « Démo · signaux simulés », badge DÉMO, bandeau |
| **World Radar — lignes réelles** | Annonces du catalogue Affisell FR (prix, titre, image réels ; `growthRate`, `searches` et `competition` y sont **dérivés**, pas mesurés) et mots-clés Serper/Google (volumes et croissance de l'API ; `competition` constant). | `source: "live"` seulement si **toutes** les lignes viennent d'un de ces deux fournisseurs ; `isLive` exige en plus un scan de moins d'une heure |
| **Arbitrage Score™ / Saturation** | Formules à poids fixes (`lib/radar/arbitrage-score.ts`, `saturation.ts`). La « prédiction » de saturation est une division linéaire, pas une prévision apprise. | note « formules (règles), pas un modèle d'IA » dans le terminal |
| **Globe Radar** | Commandes, imports et pics de vente réels **complétés** par des événements générés quand il y en a moins de 12 ; la ville des imports et des pics est choisie par hachage. | `source: live \| mixed \| demo`, `synthetic` par événement, `locationSource: estimated`, badge LIVE seulement si `live` |
| **Market Intelligence** | **Aucune source de marché.** 3 fiches écrites à la main (iPhone 17 Pro, JBL Tune Flex, AirPods Pro 3) et une heuristique (catégorie + prix). Le cron toutes les 6 h rafraîchit seulement le TTL de ces 3 fiches (il les étiquetait « live » : corrigé). | `origin: fixture \| heuristic`, `market_data.measured = false` |
| **Smart Margin / marge optimale / score de succès** | Arithmétique à seuils fixes sur une fiche marché non mesurée (`margin-optimizer.ts`, `success-scorer.ts`). Les élasticités et les poids sont des constantes tapées à la main, jamais validées sur des ventes réelles. Le « score de succès » n'est pas une probabilité. | `method: "rule_based"`, titre « Smart Margin » (plus « AI »), « Score de succès (règle de calcul, pas une probabilité) » |
| **Optimiseur de prix affilié** | Règle statistique sur les annonces comparables d'Affisell ; sans données : prix fournisseur × 1,4. | `method: "statistical_rule"`, note de règle dans les 8 langues |
| `/api/ai/pricing`, `/api/ai/style-advice` | Trois multiplicateurs fixes ; trois phrases-modèles. Aucun modèle. | `method: "rule_based"` / `"static_templates"` |
| **Profit presets, score de confiance fournisseur** | Arithmétique et trois contrôles tout-ou-rien (Stripe actif, volume, suivi valide). | commentaire de tête « NOT AI » ; un test garde l'étiquette |

## 2. Mesure : tokens, coût estimé, latence

**Module** : `lib/ai/usage-log.ts` (+ `usage-stats.ts`, `model-pricing.ts`). Aucune migration de schéma.

- Chaque requête des clients LLM de l'application passe par `meterModelCall`, qui chronomètre l'appel, lit l'objet `usage`
  **renvoyé par le fournisseur** (jetons réels), calcule un **coût estimé** et écrit une ligne JSON `[ai-usage] {...}` dans les
  logs et dans un journal borné. Un appel en échec est journalisé aussi (classe d'erreur seulement, jamais le message, jamais le
  prompt, jamais l'image, jamais d'identifiant d'utilisateur) ; il n'est **pas** compté comme « modèle ayant répondu ».
- **Périmètre exact.** *Couvert* (un test, `ai-usage-coverage.test.ts`, échoue si un nouvel appel direct à un fournisseur n'utilise
  pas `meterModelCall`) : OpenAI chat et embeddings, **y compris la génération de description GPT-4o**
  (`affiliate-product-generate-description.ts`), Groq, Anthropic (**les deux clients**, `anthropic-messages.ts` et
  `anthropic-client.ts`), Gemini. *Non couvert* : l'endpoint de modération OpenAI (`lib/reviews/moderation.ts`, gratuit, sans
  compteur de jetons), les prestataires qui ne sont pas des appels LLM facturés au jeton (Replicate pour l'essayage, vidéo Veo,
  outils image), les scripts de développement (`scripts/i18n-translate-*`, `scripts/llm-eval`). **Un coût affiché est donc un
  minimum, jamais le total des dépenses d'IA.** (La première version de ce document et de `usage-log.ts` affirmait que *toute*
  requête était mesurée : c'était faux pour la description GPT-4o et le client Anthropic simple, corrigé.)
- L'étape (« palier ») vient d'un contexte asynchrone posé par l'analyseur : `cues_extraction` (étape catalogue),
  `vision_full`, `vision_legacy`, `category_match`. Sans contexte : `unlabelled`. Chaque analyse complète écrit en plus un
  enregistrement `pipeline` (étape finale `catalog_match | mini | gpt4o | groq | error`, latence de bout en bout).
- **Journal** : liste Redis plafonnée (2000 enregistrements, 30 jours) si `UPSTASH_REDIS_REST_URL/TOKEN` sont configurés,
  sinon mémoire de **l'instance serveur** (volatile, partielle). La page admin dit lequel des deux elle lit.
- **Page** : `/admin/instantscan-performance` — par étape : appels, échecs (avec les modèles demandés qui ont échoué et la durée
  d'un échec), latence p50/p95 **des appels réussis** (un timeout est un échec, pas une latence ; si toutes les requêtes ont
  échoué la page écrit « aucune réponse »), jetons, coût estimé, **modèles ayant répondu (appels réussis uniquement)** et, pour
  un repli, « répondu(s) par le modèle de repli » (tentatives réussies) séparé de « tentative(s) de repli en échec ». « Aucune
  mesure » quand le journal est vide. Elle liste aussi ce qui n'est **pas** mesuré.
- **Table de prix** : `lib/ai/model-pricing.ts`, version `2026-11-13`. Tarifs publics saisis à la main pour `gpt-4o`,
  `gpt-4o-mini`, `text-embedding-3-small` ; **à vérifier** auprès du fournisseur. Un modèle absent de la table (Groq, Anthropic,
  Gemini aujourd'hui) a un coût **inconnu**, jamais deviné. Ajouter un tarif vérifié sans déploiement :
  `AI_MODEL_PRICING_JSON='{"openai/gpt-oss-20b":{"inputPerMTokUsd":0.1,"outputPerMTokUsd":0.5}}'` (la version devient
  `2026-11-13+env`). Le coût est donc : jetons réels × tarif saisi = **estimation**.
- Les événements PostHog `instant_scan_*` (`lib/telemetry.ts`) sont définis mais **jamais émis** (aucun appelant) : ne pas s'y
  fier. Les câbler enverrait des identifiants utilisateur à un tiers ; décision du propriétaire.

## 3. Banc d'essai de précision

### 3.1 Ce qui tourne dans les tests (modèle simulé, données synthétiques)

`lib/__tests__/instantscan-benchmark.test.ts` remplace l'ancien test « précision 98 % », qui comparait un texte à lui-même.
Le banc (`lib/ai/bench/`) appelle le **vrai chemin de production** (`parseVisualCuesPayload` → `cuesToLexicalVector` →
`rankCatalogByVector`, seuil de production) sur 24 cas **écrits à la main** (18 dans le catalogue, 6 hors catalogue) dont le
« modèle de vision » est un script. Il calcule top-k, taux de réponse, précision quand il répond, taux de fausse acceptation
et latence p50/p95. Il **échoue** si le banc n'est pas branché : aucun cas, pas de cas hors catalogue, aucune latence mesurée,
ou une sensibilité nulle au catalogue / à la réponse du modèle (un oracle fait 100 %, un runner muet 0 %).

Résultat actuel (figé dans le test comme garde de non-régression, **pas une performance du produit**) : top-1 88,9 %,
top-5 94,4 %, précision quand il répond 100 %, fausse acceptation 0 %, et surtout **taux de réponse 20,8 %** : même avec des
indices propres, l'étape n'atteint le seuil de 0,95 que pour 5 cas sur 24, donc elle passe la main au modèle complet presque
toujours. Le « chemin rapide » promis est rarement emprunté. Un rapport sur données synthétiques porte en première ligne
« SYNTHETIC … NOT a product performance ».

### 3.2 Mesurer avec un vrai modèle (non exécuté ici)

Prérequis : des **photos réelles** étiquetées par un humain ; une clé `OPENAI_API_KEY` ; un budget (une requête vision mini par
photo ; le coût réel s'affiche dans les lignes `[ai-usage]`).

1. **Constituer le jeu** (JSON) : `[{ "id": "p001", "imageUrl": "https://…", "truth": "iphone-17-pro" }, …]`.
   `truth` = un `id` de `lib/ai/curated-product-catalog.ts`, ou `null` si le produit photographié n'est pas dans la liste.
   Règles : photos de fournisseurs réels (pas des images de presse), cas hors catalogue en nombre comparable (≥ 30 %), coques et
   accessoires, mauvaises photos, deux personnes qui étiquettent indépendamment et un arbitrage sur les désaccords, **jeu séparé
   de celui qui a servi à régler les prompts ou le seuil**.
2. **Taille** : pour affirmer un taux avec un intervalle de confiance honnête, utiliser la borne basse de Wilson à 95 %. Exemple :
   « 98,5 % » ne se démontre qu'avec ≈ 250 photos **sans aucune erreur** (borne basse ≈ 98,5 %) ; avec 100 photos dont 98 justes
   la borne basse est ≈ 93 %.
3. **Lancer** (jamais en CI) :
   `NODE_OPTIONS="--conditions=react-server" npx tsx scripts/bench-instantscan.ts --dataset <fichier.json> --real`
   Sans `--real` ou sans jeu, le script refuse et n'appelle rien (vérifié : code de sortie 2). Il n'écrit dans aucune base.
4. **Lire le rapport** : il affiche « REAL labelled photos, model: … ». Les chiffres ne valent que pour **ce** modèle, **ce** jeu et
   **ce** seuil. Les citer avec la taille du jeu et l'intervalle ; ne jamais les extrapoler au catalogue entier ni à d'autres
   photos. La précision de l'étape complète (`vision_full`) se mesure de la même façon en remplaçant le runner : le harnais
   (`runBench`, `BenchRunner`) est indépendant de l'étape.
5. Consigner le résultat (date, jeu, taille, modèle, rapport) ici ou dans le document maître ; c'est seulement alors qu'un chiffre
   peut apparaître dans l'interface.

## 4. Encore promis, non mesuré

- Précision de reconnaissance (« 98,5 % », « top 100 SKUs ») : **aucun jeu étiqueté, aucune mesure**.
- « CLIP ~200 ms » : l'étape n'utilise pas CLIP ; sa latence réelle est mesurée (modèle de vision mini + calcul local), pas promise.
- « p95 < 2 s » et « ~0,003 $ par analyse » : objectifs retirés ; la latence et le coût par étape sont mesurés dès qu'InstantScan
  tourne (il est désactivé par défaut : `ENABLE_INSTANTSCAN`). Aucun coût **par analyse** n'est calculé (pas d'identifiant de
  corrélation entre appels), seulement par étape.
- Les prix de la table sont saisis à la main ; Groq, Anthropic et Gemini n'ont aucun tarif.
- World Radar : aucune donnée réelle hors France (Affisell) et hors Serper ; Market Intelligence : aucune donnée de marché.
- Aucun score (Arbitrage, succès, confiance) n'est versionné ni historisé, donc aucun n'est validé contre des résultats réels.

## 5. Points d'attention au déploiement

- Aucune migration. `AI_MODEL_PRICING_JSON` est facultative.
- Après déploiement, les lignes du radar stockées par l'ancienne version et dont la source n'est ni `Affisell` ni `Google` ne sont
  plus servies comme « cache » : la requête relance un scan, puis retombe sur le générateur étiqueté « démo ».
- L'import de « winners » du Radar (`radar-import-bridge.server.ts`) lit le même payload : un winner `synthetic` peut encore être
  importé comme produit. À traiter séparément (décision du propriétaire).
- Le texte légal `PROBABILITY_DISCLAIMER` a été corrigé (« score calculé par une règle … pas une probabilité statistique ») :
  à faire valider.
