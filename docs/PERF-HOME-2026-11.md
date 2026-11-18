# Performance de l'accueil — causes mesurées et corrections (2026-11-17/18)

Mesures réalisées dans la CI (`lighthouse-mobile.yml`), sur le build de production lancé sans base de données, donc avec un catalogue vide. Deux instruments :

- Lighthouse mobile, 3 passages, débit simulé de 1,6 Mbit/s, CPU ×4 ;
- un **vrai Chrome** piloté par Playwright (`scripts/lcp-candidates.mjs`), qui relève chaque candidat LCP et son élément, avec un réseau et un CPU réellement ralentis.

Les deux scripts de diagnostic restent dans le dépôt (`scripts/lighthouse-diagnostics.mjs`, `scripts/lcp-candidates.mjs`) et impriment leurs résultats à chaque passage de la CI.

## Ce qui a été mesuré avant correction

| Mesure | Avant (commits `33ad16e5c` → `421ff0f8e`) |
|---|---|
| Lighthouse LCP (3 passages) | 12,5 – 13,9 s, au-dessus du seuil d'erreur de 12 s : échec répété |
| Lighthouse FCP | ≈ 2,0 s |
| Réponse serveur (TTFB) | 35–50 ms : **le serveur n'est pas en cause** |
| Scripts au démarrage | 48 requêtes / **1 716 Kio** transférés |
| Plus gros script | 781 Kio puis 1 022 Kio transférés (2,1 à 2,8 Mo bruts) |
| Vrai Chrome : LCP réel | **3,5 s** (le titre du hero, `buyer-premium-hero`, rendu côté serveur) |
| Vrai Chrome : événement `load` | **8,8 s** |

**Lecture.** Le contenu principal s'affiche en 3,5 s. Le LCP de 13 s est une **estimation** de Lighthouse : son mode simulé range devant l'affichage tous les téléchargements lancés avant lui. Ce que Lighthouse signalait est réel pour autant : le poids du JavaScript, qui retardait la fin du chargement et l'interactivité (8,8 s).

L'audit « élément LCP » de Lighthouse 12.1 tombe en erreur sur ces traces (`RootCauses … frame_sequence`). Le vrai Chrome a donc été nécessaire pour identifier l'élément.

## Causes dominantes identifiées

1. **Les 8 catalogues de traduction complets (environ 3,6 Mo de texte) étaient dans le JavaScript que télécharge chaque visiteur.** Le gros script contenait les catalogues ; l'analyse des imports a identifié trois chemins :
   - `LanguageSwitcher` (en-tête et pied de page, toutes les pages) → `lib/i18n-ui-locale.ts`, qui réexportait `pickBinaryLabel` depuis `lib/i18n-pick-message.ts` → `lib/i18n-load-messages.ts` → `messages/*.json` ;
   - le widget Dona, chargé après un délai d'inactivité sur toutes les pages publiques : `tMessage` dans le widget, ses messages d'erreur, sa carte d'inscription et ses textes d'audience ;
   - le bandeau cookies (toutes les pages) : `legal/consent` → `entity` → `fee-labels` → `order-payout-policy` → `order-return-policy` → `order-return-types` (libellés via `tMessage`), pour une seule fonction pure.
2. **`app/error.tsx`**, la limite d'erreur racine livrée avec chaque page, importait `messages/en.json` et `messages/fr.json` (environ 890 Ko) pour afficher cinq phrases.
3. **`FastLink` et `NavPill` forçaient `prefetch={true}`.** Selon la documentation de Next 16 (`node_modules/next/dist/docs`), cela précharge la page **entière, données comprises**, pour chaque lien visible. Or toutes les pages sont dynamiques, puisque la mise en page racine lit les en-têtes.

## Corrections (réversibles, testées)

| Correction | Fichiers | Garde-fou |
|---|---|---|
| `pickBinaryLabel` déplacé dans un module sans dépendance (anciens imports conservés) | `lib/i18n-binary-label.ts` | `client-bundle-catalogues.test.ts` : parcourt les imports statiques et différés depuis la mise en page, l'accueil et la limite d'erreur, et échoue si du code client atteint un catalogue. Vérifié : il échoue avec l'ancien import. |
| Dona lit les messages déjà présents dans le fournisseur de traduction (même repli sur l'anglais que `tMessage`) | `hooks/use-message-picker.ts`, `components/dona/*`, `lib/dona/dona-audience.ts` | idem, et `dona-signup-cta.test.ts` (8 langues) |
| Statuts de retour isolés dans un module pur (anciens imports conservés) | `lib/order-return-status.ts` | idem |
| Page d'erreur : copie dédiée, **8 langues au lieu de 2** | `lib/app-error-copy.ts` | `app-error-copy.test.ts` : identique à `messages/*.json`, et aucun composant client n'importe un catalogue entier |
| Liens visibles : préchargement par défaut de Next (« auto ») ; le survol, le focus et le toucher préchargent toujours la page entière | `lib/link-prefetch-policy.ts` | `link-prefetch-policy.test.ts` |

## Après correction (commit `9eae8e059`, mêmes instruments)

| Mesure | Avant | Après |
|---|---|---|
| Scripts au démarrage | 48 / 1 716 Kio | **36 / 598 Kio** (−65 %) |
| Plus gros script | 1 022 Kio | 68 Kio |
| Lighthouse LCP | 12,5 – 13,9 s (échec) | **6,7 – 7,6 s** (vérification au vert) |
| Lighthouse TBT | 590 – 1 850 ms | 720 – 1 430 ms (variable d'un passage à l'autre) |
| Vrai Chrome : `load` | 8,8 s | **3,8 s** |
| Vrai Chrome : LCP (titre du hero) | 3,5 s | 3,45 s (inchangé : le hero n'a jamais dépendu de ce JavaScript) |
| Requêtes de préchargement | 24 | 24 (voir ci-dessous) |

Aucune fonctionnalité retirée : mêmes textes, mêmes langues. La page d'erreur gagne 6 langues.

## Limites et points ouverts (non corrigés, avec la raison)

- **Le préchargement des liens n'a pas d'effet mesurable dans la CI.** Les 24 requêtes restent : Next continue à demander la coquille de chaque route visible. L'effet attendu, moins de rendus serveur complets avec leurs requêtes en base, ne se voit pas dans une CI sans base. Il reste à confirmer sur une préproduction.
- **Les traductions de la langue active restent intégrées à chaque page** (HTML de 511 Ko, 143 Kio transférés). 82 espaces de noms, soit 87 % du volume, sont utilisés par des composants client : un tri par espace de noms ne gagnerait qu'environ 13 % et risquerait des textes manquants après une navigation côté client. La vraie correction passerait par des fournisseurs de traduction par zone (acheteur, tableau de bord). C'est un chantier à part.
- ~~Premier octet retenu par le catalogue~~ : **confirmé puis corrigé**, voir la section suivante.
- Les gros halos flous animés du hero (`buyer-home-mesh-canvas`) n'apparaissent pas comme coût dominant dans ces mesures. Ils n'ont pas été touchés.


## Lot 2 (2026-11-18) — le premier octet ne dépend plus de la base

**Chemin d'exécution (lu dans le code, puis mesuré).** `app/page.tsx` rendait `HomeLcpPreloadBoundary` **hors de tout `Suspense`**. Ce composant attend `loadHomeMarketplaceShellSafe` : arbre des catégories (cache par requête seulement), annonces (cache de 60 s), compteurs d'offres (aucun cache entre requêtes), puis le cache Redis des titres traduits. Le délai maximal est de 12 s (`HOME_SHELL_TIMEOUT_MS`). Sans `loading.tsx` à la racine, React ne peut envoyer aucun octet de la page tant que ce composant n'a pas fini, y compris le hero, qui ne dépend d'aucune donnée. La section catalogue avait pourtant déjà son propre `Suspense` et son squelette : c'est ce composant de préchargement qui annulait leur effet. La mise en page racine, elle, n'interroge pas la base pour un visiteur anonyme (session JWT, pas de domaine de boutique sur la plateforme).

**Condition d'apparition.** Le retard est proportionnel à la latence de la base. Il est maximal lors d'un réveil Neon, sur un lien lent, ou si la base est injoignable.

**Instrument.** Job CI `home-server-timing` (`lighthouse-mobile.yml`) : PostgreSQL jetable avec le schéma complet, relais TCP qui ajoute 150 ms par paquet (`scripts/perf/tcp-delay-proxy.mjs`), et chronométrage du flux HTML (`scripts/perf/stream-timing.mjs`). On y ajoute un vrai Chrome mobile ralenti (`scripts/lcp-candidates.mjs`).

| Base | Premier octet avant (`6f814c41b`) | Premier octet après (`4701b2f02`) | Hero dans le flux, après | Fin du flux, après |
|---|---|---|---|---|
| locale (rapide) | 118 – 130 ms | 96 – 110 ms | idem | 113 – 125 ms |
| +150 ms par paquet | 700 – 704 ms | **90 – 91 ms** | 91 – 93 ms | 673 – 680 ms (catalogue) |
| injoignable | **10,1 – 10,3 s** | **106 ms** | 107 ms | 10,1 s (catalogue vide après le délai) |

Vrai Chrome mobile ralenti, après correction : le titre du hero (LCP) s'affiche à **3,7 s avec la base lente et 3,4 s avec la base injoignable**. Avant, il ne pouvait pas apparaître avant le premier octet, soit au moins 10,1 s. Lighthouse (catalogue vide) : LCP 7,5 – 7,6 s, JavaScript initial 598 Kio, valeurs inchangées par ce lot.

**Correction.** `<Suspense fallback={null}>` autour de `HomeLcpPreloadBoundary`. Ce composant ne rend que des balises `<link rel="preload">` : aucune mise en page, rien de visible. Les préchargements d'images arrivent dans le même morceau du flux que le catalogue qu'ils servent. Le référencement est inchangé : la réponse HTML complète contient toujours le catalogue, et seul l'ordre d'arrivée change. Le test `home-first-byte.test.ts` verrouille cette correction.

**Limite observée.** Avec une base injoignable, `DOMContentLoaded` attend la fin du flux (10,1 s), même si la page est visible à 3,4 s. Réduire ce délai demanderait de raccourcir le délai d'attente du catalogue (12 s), ce qui modifie son comportement de repli. Ce n'est pas fait ici.

## Traductions de la langue active : étude chiffrée (non implémentée)

- Elles pèsent **≈ 115 Kio compressés, soit environ 80 % des 143 Kio de la page HTML** (catalogue anglais : 347 Kio bruts).
- Les espaces de noms qu'aucun module client ne nomme représentent 16 espaces et 35 Ko, soit 9,5 %. Gain faible, avec un risque de textes manquants (`useTranslations()` sans espace de noms dans `partner-mobile-dock`, clés construites dynamiquement).
- Les espaces de noms qu'aucun module client d'une route **publique** ne nomme représentent 28 espaces et 81 Ko, soit 22 %, ou environ 25 Kio compressés. Il faudrait des fournisseurs imbriqués dans les mises en page du tableau de bord et de l'administration. Le fournisseur racine persiste lors des navigations côté client, d'où cette exigence. Les traductions seraient alors doublées sur les pages du tableau de bord, et le grand espace `supplier` (56 Ko) reste utilisé par des pages publiques.
- **Décision : non engagé.** Le gain réel est d'environ 18 % du document, pour une refonte des fournisseurs et un risque de régression des traductions. La voie qui supprimerait vraiment ce poids est de rendre côté serveur les textes des composants qui n'ont pas besoin d'être interactifs. C'est un chantier progressif, composant par composant, pas une bascule.
