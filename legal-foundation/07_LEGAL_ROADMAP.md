# 07 — LEGAL ROADMAP (Phase 2+)

> **Statut** : interne · v2026-07-09  
> Prérequis : validation Phase 1 (`/legal-foundation/*`) par Legal + CEO.

---

## Principes d’implémentation

1. **Ne pas casser** les routes `/cgu`, `/cgv`, `/legal/*` existantes pendant la migration.
2. **Idempotence** : acceptations et versions rejouables sans doublon.
3. **1 PR = 1 slice** reviewable ; ordre ci-dessous obligatoire.
4. **Tests** : `curl` gate + `npm run email:dev` si mails consentement.

---

## Phase 2 — Infrastructure

### PR1 — Infra Prisma LMS

- Modèles : `LegalDocument`, `LegalVersion`, `LegalAcceptance` (ou équivalent).
- Lien `User` / `Order` → versions acceptées.
- Migration + seed versions courantes (CGU, CGV, CGA, CGS, Privacy, Cookies).
- **Gap fermé** : dual pipeline `legal/content` vs `legal/*.md`.

### PR2 — Versioning & publication

- API interne : publier version, déprécier, `effectiveAt`.
- Sync `lib/legal-versions.ts` → DB source of truth.
- Admin UI ou script `legal:publish` (cron-safe).

### PR3 — Consentements & gate unifié

- Étendre `lib/middleware-terms-gate.ts` : CGU + Privacy (merchants + buyers si requis).
- `TermsAcceptanceLog` enrichi (documentId, version, IP, userAgent).
- **Gap fermé** : gate partiel CGS/CGA only.

---

## Phase 3 — Contrats publics

### PR4 — CGU / Privacy alignement Blueprint

- Intégrer décisions Phase 1 (marge 300 %, reversal, produit dangereux).
- i18n 8 locales via pipeline unique.
- Réacceptation forcée si bump major.

### PR5 — CGV checkout

- Acceptation CGV **au checkout** (buyer), liée à `Order`.
- **Gap fermé** : CGV non trackée aujourd’hui.

### PR6 — CGA / CGS marchands

- Alignement commissions, clawback, KYC.
- Gate dashboard inchangé fonctionnellement, backed par LMS.

---

## Phase 4 — Enforcement produit

### PR7 — Plafond markup 300 %

- Validation serveur `AffiliateProduct` / listing publish.
- UI warning < 300 %, hard block > 300 %.
- **Gap fermé** : marge 500 % non tranchée en code.

### PR8 — Promos & `discountFundedBy`

- Champ ledger : qui finance coupon / cashback.
- Reporting Metabase `[legal-promo]`.

### PR9 — Reversal fail & clawback UX

- Dashboard marchand : créances `REFUND_PENDING_CLAWBACK`.
- Suspension payout automatique + notifications email.

---

## Phase 5 — Conformité avancée

### PR10 — Agent Agreement

- Document + gate rôle `AGENT`.
- Distinction Agent vs Affiliate dans onboarding.

### PR11 — DAC7 automation

- Job annuel + preview marchand.
- Validation données `MerchantLegalProfile`.

### PR12 — MAP / prix minimum supplier (optionnel)

- Si suppliers demandent plafond markup contractuel par SKU.

---

## Phase 6 — Gouvernance continue

### PR13 — Legal CMS interne

- Édition contrôlée, diff review Legal avant publish.
- Export PDF / archive pour audit.

### PR14 — Internationalisation juridique

- Clauses consommateur par pays (hors FR).
- Stripe Tax + mentions légales locales.

---

## Critères de done Phase 2 (global)

| Critère | Mesure |
|---------|--------|
| Une source de vérité contrats | DB `LegalVersion` |
| Buyer CGV prouvable | `Order.legalAcceptanceId` ou équivalent |
| Merchant gate complet | CGU + CGS/CGA + Privacy |
| Markup cap enforced | 300 % max server-side |
| Reversal fail owned | clawback ledger + UI |
| Audit trail | `TermsAcceptanceLog` immuable |

---

## Hors scope immédiat

- Refonte complète `/app/(legal)` design.
- Changement modèle Stripe (separate charges and transfers vs destination).
- Assurance responsabilité produit tierce.

---

*Référence : audit Phase 0, `01_LEGAL_BLUEPRINT.md`, `06_LEGAL_DECISIONS.md`*
