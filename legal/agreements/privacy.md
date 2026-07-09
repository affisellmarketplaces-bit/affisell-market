---
title: Politique de confidentialité
description: Politique RGPD Affisell v1.0.0 — art. 13-14, bases légales, SCC, droits, durées.
version: 1.0.0
locale: fr
lastUpdated: 2026-07-09
order: 4
---

# Politique de Confidentialité - Affisell

**Version 1.0.0 — Effective au 09/07/2026 — Dernière mise à jour : {{LAST_UPDATED}}**

La présente Politique de confidentialité (ci-après la « **Politique** ») informe les personnes concernées, conformément aux **articles 13 et 14 du Règlement (UE) 2016/679 (RGPD)**, du traitement de leurs données personnelles par **Affisell SAS** dans le cadre de la plateforme marketplace Affisell (ci-après la « **Plateforme** »).

L'utilisation de la Plateforme implique la prise de connaissance de la présente Politique, complétée par la [Politique cookies](/legal/cookies-policy) pour les traceurs.

---

## 1. Responsable de traitement

**Affisell SAS**, société par actions simplifiée, immatriculée au **RCS de Paris**, dont le siège social est situé {{ADRESSE}}, numéro SIREN {{SIREN}}, TVA intracommunautaire FR{{TVA}}.

**Contact général** : {{EMAIL}}  
**Délégué à la protection des données (DPO)** : [dpo@affisell.com](mailto:dpo@affisell.com) (également accessible via {{DPO}})

Affisell détermine les finalités et les moyens des traitements décrits ci-après, en qualité de **responsable de traitement** au sens du RGPD.

---

## 2. Données collectées — BLUEPRINT

Les données traitées dépendent du **rôle** de l'Utilisateur sur la Plateforme.

**2.1 CUSTOMER (Acheteur)**  
- **Identité et contact** : adresse email, nom, téléphone le cas échéant  
- **Livraison** : adresse postale, pays, code postal  
- **Commandes** : historique des achats, statuts, références produit, montants  
- **Paiement** : identifiants de transaction Stripe, statut de paiement, logs de session checkout (Affisell ne stocke pas les numéros de carte complets)

**2.2 SUPPLIER (Fournisseur)**  
- **KYB / identité entreprise** : raison sociale, SIREN, SIRET, TVA, statuts juridiques, pièces d'identité dirigeants, extrait Kbis  
- **Bancaire** : IBAN et coordonnées bancaires via **Stripe Connect** (non stockées en clair par Affisell hors identifiants Stripe)  
- **Catalogue** : fiches produits, images, stocks, prix wholesale, logs d'expédition  
- **Technique** : logs webhook commandes, notifications, adresses IP de connexion dashboard

**2.3 AFFILIATE (Affilié)**  
- **Identité** : email, nom, handle réseaux sociaux, profil vitrine  
- **Bancaire** : IBAN via Stripe Connect pour reversement des commissions  
- **Commercial** : tracking des clics et conversions, commissions, marges, listings  
- **Technique** : adresse IP, logs de connexion, User-Agent

**2.4 Tous les rôles**  
- **Cookies et traceurs** : voir article 7 et [Politique cookies](/legal/cookies-policy)  
- **Logs de connexion** : horodatage, IP, identifiant de session, événements de sécurité  
- **User-Agent** : navigateur, appareil, système d'exploitation (logs techniques et anti-fraude)

---

## 3. Finalités et Bases légales

| Finalité | Base légale | Durée de conservation |
|----------|-------------|------------------------|
| **Commande + livraison** (création compte, exécution, SAV, facturation acheteur) | Exécution du contrat — art. 6.1.b RGPD | **10 ans** (obligations comptables et fiscales) |
| **Payout commissions** (Fournisseur, Affilié, reporting DAC7) | Obligation légale — art. 6.1.c RGPD | **10 ans** |
| **Marketing email** (newsletters, offres, relances commerciales Affisell) | Consentement — art. 6.1.a RGPD | Jusqu'au **retrait du consentement** ou désinscription |
| **Anti-fraude** (détection abus, chargebacks, sécurisation comptes) | Intérêt légitime — art. 6.1.f RGPD | **3 ans** à compter du dernier événement pertinent |
| **Amélioration du service** (analytics agrégés, performance) | Intérêt légitime — art. 6.1.f RGPD | **13 mois** maximum pour les cookies analytics ; logs agrégés selon politique interne |
| **Support client** | Exécution du contrat — art. 6.1.b RGPD | Durée de la relation + **3 ans** archivage |

Les traitements fondés sur le **consentement** peuvent être retirés à tout moment sans affecter la licéité des traitements antérieurs.

---

## 4. Destinataires

**4.1 Stripe, Inc.** — traitement des **paiements**, **KYC/KYB Connect**, reversements et remboursements. Un **accord de sous-traitance (DPA)** est en place. Stripe est établi aux **États-Unis** ; les transferts sont encadrés par des **Clauses Contractuelles Types (SCC)** — voir article 5.

**4.2 Fournisseurs** — reçoivent uniquement les données **strictement nécessaires à l'exécution de la commande**, notamment l'**adresse de livraison** et les coordonnées utiles à l'expédition. Ils agissent en qualité de **responsables de traitement distincts** pour leurs propres obligations produit et SAV.

**4.3 Hébergeur — Vercel Inc.** — hébergement applicatif en **région Union européenne** lorsque disponible. **Logs d'accès** conservés **30 jours** sauf incident de sécurité nécessitant une conservation prolongée.

**4.4 Autres** — prestataires email (transactionnel), monitoring, support technique, sous contrat de sous-traitance RGPD. **Autorités publiques** sur réquisition légale.

Affisell ne vend pas vos données personnelles à des tiers.

---

## 5. Transferts hors Union européenne

Certains sous-traitants, notamment **Stripe (États-Unis)**, peuvent traiter des données en dehors de l'**Espace économique européen (EEE)**.

Affisell s'assure de garanties appropriées conformément au chapitre V du RGPD, notamment les **Clauses Contractuelles Types (CCT / SCC) de la Commission européenne — version 2021**, complétées le cas échéant par des mesures techniques et organisationnelles supplémentaires.

**Risques** : les transferts vers des pays tiers peuvent impliquer un niveau de protection différent de celui de l'UE (accès possible par les autorités locales). Affisell limite les données transférées au strict nécessaire et impose des obligations contractuelles à ses sous-traitants.

Pour toute question sur les transferts : **dpo@affisell.com**.

---

## 6. Droits RGPD

Conformément aux articles 15 à 22 du RGPD, vous disposez des droits suivants :

**6.1** **Droit d'accès** — obtenir confirmation du traitement et une copie de vos données  
**6.2** **Droit de rectification** — corriger des données inexactes ou incomplètes  
**6.3** **Droit à l'effacement** (« droit à l'oubli ») — dans les limites des obligations légales de conservation  
**6.4** **Droit à la portabilité** — recevoir vos données dans un format structuré, lorsque le traitement est fondé sur le consentement ou le contrat et automatisé  
**6.5** **Droit d'opposition** — notamment au marketing direct et, pour motifs légitimes, à certains traitements fondés sur l'intérêt légitime  
**6.6** **Droit à la limitation** du traitement dans les cas prévus par le RGPD  
**6.7** **Retrait du consentement** — à tout moment pour les traitements fondés sur le consentement

**Exercice des droits** :  
- Email : **dpo@affisell.com**  
- Espace self-service : [/dashboard/account/gdpr](/dashboard/account/gdpr) ou [/marketplace/account/gdpr](/marketplace/account/gdpr) (export JSON/CSV, suppression de compte, gestion des consentements)

**Délai de réponse** : **1 mois** à compter de la réception de la demande (prolongation de 2 mois possible si complexité, avec information préalable).

**6.8 Réclamation** : vous pouvez introduire une réclamation auprès de la **[CNIL](https://www.cnil.fr/)** (Commission nationale de l'informatique et des libertés), autorité de contrôle française.

---

## 7. Cookies

**7.1 Cookies essentiels** (pas de consentement requis — art. 82 loi Informatique et Libertés / ePrivacy) :  
- **Session** d'authentification (NextAuth)  
- **CSRF** et sécurité des formulaires  
- **`affisell_legal_ok`** — preuve d'acceptation des documents légaux (legal gate)  
- **`affisell_locale`** — préférence de langue  
- Cookies strictement nécessaires au paiement Stripe

**7.2 Cookies analytics et marketing** : déposés **uniquement après consentement** via le bandeau cookies (voir [Politique cookies](/legal/cookies-policy)). Vous pouvez modifier vos préférences à tout moment depuis le lien « Cookies » en pied de page ou l'espace RGPD.

---

## 8. Sécurité

Affisell met en œuvre des mesures techniques et organisationnelles appropriées pour protéger vos données :

- **Chiffrement** des données en transit (**TLS/HTTPS**) et chiffrement au repos (**AES-256**) sur les infrastructures hébergeur  
- **Hachage** des mots de passe (bcrypt) — Affisell ne stocke pas les mots de passe en clair  
- **Audit trail** des actions sensibles (acceptations légales, modifications compte marchand, opérations admin)  
- **MFA (authentification multifacteur)** obligatoire pour les comptes administrateurs Affisell  
- Contrôle d'accès restreint (principe du moindre privilège), sauvegardes et procédures de réponse aux incidents

En cas de violation de données présentant un risque pour vos droits, Affisell notifiera la CNIL et, le cas échéant, les personnes concernées conformément à l'article 34 RGPD.

---

## 9. Modifications

Toute modification **substantielle** de la présente Politique sera portée à votre connaissance par **email** et/ou **bandeau** sur la Plateforme. En cas de changement impactant vos droits, une **réacceptation** pourra être requise via le mécanisme legal gate Affisell.

---

## 10. Contact

**Affisell SAS** — {{ADRESSE}}  
Email : {{EMAIL}}  
DPO : [dpo@affisell.com](mailto:dpo@affisell.com)
