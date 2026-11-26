# Bannière et politiques — brouillon des mises à jour (décision D6)

Statut : **brouillon, non publié** (2026-11-23). Aucun fichier `legal/*.md` ni texte de bannière n'est modifié. À relire par un juriste avant publication, puis à traduire dans les 8 langues (`legal/content/<langue>/`, `messages/*.json`).

Cadre retenu par le fondateur le 2026-11-23 : D1 tout suivi comportemental (ancien et nouveau) soumis au consentement « Analytics » ; D2 pas de compteur sans cookie ; D3 lignes brutes 90 jours puis agrégats seulement, purge vérifiable ; D4 mesure agrégée, pas de lien individuel entre un visiteur et sa commande.

## 1. Écarts constatés entre le code et les textes publiés (faits, lus le 2026-11-23)

| Texte publié | Ce que fait le code | Fichier |
|---|---|---|
| Politique cookies 3.1 : `affisell_cookie_consent` conservé **13 mois** | Le cookie est écrit pour **180 jours** | `lib/legal/cookie-consent-runtime.ts` (`persistCookieConsentPrefs`) |
| Le cookie `affisell_cookie_prefs` (choix détaillés analytics / marketing) | **Absent** de la liste, alors qu'il est écrit à chaque choix | même fichier |
| Politique cookies 3.2 : seule « Vercel Analytics » est citée | Un identifiant de session en `localStorage` et des vues de produits sont enregistrés par Affisell (carrousel, Pulse, assistant) | `lib/affisell-track-client.ts`, `app/api/track`, `app/api/pulse/view`, `lib/agent-checkout.ts` |
| Politique de confidentialité art. 3 : « analytics agrégés » sous l'**intérêt légitime** | La politique cookies (et la décision D1) les placent sous le **consentement** | `legal/privacy-policy.md` |
| Politique cookies art. 2 : bandeau « style **Axeptio** » | Bandeau propre à Affisell | — |
| — | Depuis le 2026-11-23 (branche, non déployé) : ancien suivi soumis au consentement, et l'identifiant de compte n'est plus gardé que pour un compte **revendeur** (les seuls lecteurs comptent des revendeurs) | `lib/events/consent.ts` (`legacyTrackingUserId`) |

## 2. Politique cookies — texte proposé

**Article 3.1 — tableau des cookies essentiels**, remplacer la dernière ligne par :

| Cookie | Finalité | Durée |
|--------|----------|-------|
| `affisell_cookie_consent` | Mémoriser que vous avez fait un choix | 6 mois |
| `affisell_cookie_prefs` | Mémoriser le détail de vos choix (mesure d'audience, marketing) | 6 mois |

**Article 3.2 — remplacer par :**

> ### 3.2 — Mesure d'audience (catégorie « Analytics »)
>
> Uniquement si vous acceptez la catégorie « Analytics » :
>
> | Outil | Finalité | Données | Durée |
> |-------|----------|---------|-------|
> | Vercel Analytics | Mesure d'audience agrégée et performance des pages | Données techniques de navigation | Selon l'outil |
> | Mesure Affisell des fiches produits | Compter, par fiche et par jour, les consultations, les ajouts au panier et les débuts de paiement, afin d'aider les fournisseurs et revendeurs à améliorer leurs fiches | Un identifiant aléatoire propre à l'onglet (effacé à sa fermeture), la fiche consultée, la date. **Ni votre nom, ni votre e-mail, ni votre identifiant de compte, ni votre adresse IP** ne sont rattachés à ces événements | Événements détaillés : **90 jours**, puis seuls des totaux par fiche et par jour sont conservés |
>
> | Consultations de produits par les **comptes revendeurs** | Compter combien de revendeurs s'intéressent à un produit (seul ce nombre est montré au fournisseur, jamais leur identité) | Identifiant du compte revendeur, produit consulté, date | 90 jours |
>
> Ces mesures servent à des statistiques agrégées : elles ne sont pas utilisées pour relier votre navigation à vos commandes, ni pour vous proposer de la publicité. Si vous refusez ou retirez votre accord, rien n'est enregistré et l'identifiant de l'onglet est effacé.
>
> **Base légale** : votre consentement, que vous pouvez retirer à tout moment depuis « Gérer les cookies ».

**Article 2** : remplacer « (style **Axeptio**) » par rien.

## 3. Politique de confidentialité — texte proposé

- **Article 2, ligne « Technique »** : « Logs, IP, cookies et mesure d'audience (voir [Politique cookies](/legal/cookies-policy)) | Sécurité, amélioration du service, statistiques agrégées par fiche produit (avec votre accord) ».
- **Article 3** : retirer « analytics agrégés » de l'intérêt légitime ; ajouter au consentement : « mesure d'audience et statistiques de consultation des fiches produits ».
- **Article 5** : ajouter « Événements de mesure d'audience : **90 jours**, puis uniquement des totaux par fiche et par jour, sans identifiant. »

## 4. Bandeau — texte proposé

Corps actuel : « Nous utilisons des cookies essentiels pour faire fonctionner Affisell, et des cookies d'audience uniquement avec votre accord. »

Proposé : « Nous utilisons des cookies essentiels pour faire fonctionner Affisell. Avec votre accord, nous mesurons aussi l'audience et la consultation des fiches produits, sous forme de statistiques, pour améliorer le catalogue. »

## 5. Points que seul un juriste peut trancher (aucune affirmation juridique ici)

1. La formulation ci-dessus suffit-elle comme information préalable au consentement ?
2. La durée de 6 mois du choix de consentement (au lieu des 13 mois annoncés) : aligner le texte sur le code, ou l'inverse.
3. Les durées de conservation existantes de l'article 5 (dont celle des données comptables) : hors du périmètre de ce chantier, à revoir dans la même relecture.

## 6. Ordre de publication proposé

1. Relecture juridique de ce brouillon.
2. Textes adoptés → traduction en 8 langues → nouvelle version de `LEGAL_DOC_VERSION` si la procédure de réacceptation l'exige.
3. Publication des textes **avant** toute activation de `CONVERSION_EVENTS_MODE`.
4. D1 (ancien suivi sous consentement) peut être déployé **avant** les nouveaux textes : il réduit la collecte et rend le code conforme à la politique cookies déjà publiée.
