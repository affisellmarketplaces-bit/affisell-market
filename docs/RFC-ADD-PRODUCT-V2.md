# RFC — Add Product Wizard v2 (« 1-Click Paradigm »)

**Status:** Implemented (MVP foundation)  
**Owner:** Product / Growth  
**Rollback:** `ENABLE_WIZARD_V2=0` + deploy (<2 min) or `?wizard=v1`

## Problem

Audit `add-product friction report` (Jul 2026): UX **5.5/10**, **8–15 min** completion, **~35% drop** on image upload. Targets: **<60 s**, **<10% drop**, **NPS >50**.

## Goals / Non-goals

| Goals | Non-goals (v2.0) |
|-------|------------------|
| Zero regression — v1 via `?wizard=v1` | Full BullMQ worker fleet |
| Feature flag `ENABLE_WIZARD_V2` (default off prod) | Storybook (phase 2) |
| PostHog events before rollout | 100% canary automation in code |
| WCAG 2.1 AA on v2 shell | Replace Medusa catalog |

## Entry routing

```
/dashboard/supplier/products/new
  ├─ ?wizard=v1  → SupplierAddProductForm (legacy)
  ├─ ?wizard=v2  → SupplierProductWizardV2
  ├─ ?mode=pro   → v1 (alias)
  └─ ENABLE_WIZARD_V2=1 (no query) → v2
```

Server: `lib/product-wizard-v2/feature-flag.ts`  
Client shell: `components/supplier/supplier-products-new-shell.tsx`

### Local testing (port 3001)

```bash
npm run dev
npm run dev:open:wizard-v2   # opens /dashboard/supplier/products/new?wizard=v2&compose=1
# or (quote query — zsh glob on unquoted ?wizard=v2):
open "http://localhost:3001/dashboard/supplier/products/new?wizard=v2&compose=1"
```

Set `ENABLE_WIZARD_V2=1` in `.env.local` to default to v2 without query param.

## Modes

| Mode | UX | Target time |
|------|-----|-------------|
| **Express** | Paste URL → scrape (`/api/import-china`) → preview → publish | ~15 s |
| **Guided** | Chat steps: photo → AI → price → defaults → publish | ~60 s |
| **Pro** | Redirect `?wizard=v1&compose=1` | unchanged |

## Architecture

### 3.1 Zero-Wait CDN (`lib/upload/zero-wait-uploader.ts`)

- Upload starts on `file` select (not submit).
- Client resize 1200px (`processProductGalleryImageFile`), prefer AVIF blob, JPEG fallback.
- Chunked upload helper (512 KB) with exponential backoff retries.
- States: `pending` → `processing` → `uploading` → `ready` | `error`.
- Publish blocked until all slots `ready` (durable HTTPS URL).
- Fallback path: existing `/api/upload/processed-image` (Vercel Blob).  
  Future: S3 presigned + BullMQ queue (documented, not wired in MVP).

### 3.2 AI First (`lib/ai/product-analyzer.ts`)

- `POST /api/ai/analyze-product` — supplier auth.
- Input: `{ imageUrl }` or `{ imageDataUrl }`.
- Output: `{ title, description, category, attributes, suggestedPrice, cached }`.
- Model: Groq vision (`GROQ_VISION_MODEL`) + `classifyAffisellProduct` leaf match.
- Cache: Upstash Redis 7d (`product-analysis:{sha256}`) or in-memory LRU fallback.

### 3.3 Smart defaults (`MerchantDefault`)

```prisma
model MerchantDefault {
  userId               String @unique
  countryCode          String?
  warehouseType        String?  // local | regional | international
  offerMode            String?
  defaultCommissionPct Int?
}
```

Loaded on wizard mount; collapsed « Avancé » section; PATCH on change.

### 3.4 Live preview (`components/supplier/product-live-preview.tsx`)

- Grid `lg:grid-cols-[minmax(0,400px)_1fr]`.
- Debounced 300 ms affiliate `ProductCard` preview.
- Mobile: `role="complementary"` drawer pattern.

### 3.5 Gamification (`lib/gamification/xp.ts`)

- `User.xp`, `User.productStreak`, `User.lastProductPublishedAt`.
- +10 XP/product, +50 XP first published product.
- `level = max(1, floor(sqrt(xp / 100)))`.
- Toast + optional confetti on award (`POST /api/supplier/gamification/award-product`).

## Analytics (PostHog)

| Event | Properties |
|-------|------------|
| `wizard_v2_view` | `mode`, `entry_point` |
| `wizard_v2_step_complete` | `step`, `duration_ms`, `method` |
| `wizard_v2_publish_success` | `duration_total_ms`, `ai_used`, `image_count` |
| `wizard_v2_publish_blocked` | `reason`, `field` |
| `wizard_v2_abandon` | `last_step`, `duration_ms` |

Helper: `lib/analytics/wizard-v2-posthog.ts`  
Admin stub: `/dashboard/admin/product-funnel`

## Rollout

1. **Phase 1:** `ENABLE_WIZARD_V2=1` admins only (manual env per user check TBD).
2. **Phase 2:** 5% random — compare `time_to_publish` p50 in PostHog.
3. **Phase 3:** 50% if p50 <90 s and drop <15%.
4. **Phase 4:** 100% if NPS >40.
5. **Kill switch:** `ENABLE_WIZARD_V2=0`.

## Perf budgets

- LCP <2.5 s — lazy-load v2 bundle only when routed to v2.
- CLS <0.1 — reserved preview height `min-h-[320px]`.
- FID <100 ms — upload in Web Worker path deferred (main-thread canvas MVP).

## Tests

| Suite | Target |
|-------|--------|
| `zero-wait-uploader.test.ts` | chunking, retry, ready gate |
| `product-analyzer.test.ts` | parse, cache key, fallback |
| `gamification-xp.test.ts` | XP, level, streak |
| `wizard-v2-feature-flag.test.ts` | routing matrix |
| E2E Playwright | phase 2 CI job |

## Files map

```
docs/RFC-ADD-PRODUCT-V2.md
lib/product-wizard-v2/feature-flag.ts
lib/upload/zero-wait-uploader.ts
lib/ai/product-analyzer.ts
lib/ai/product-analysis-cache.ts
lib/gamification/xp.ts
lib/merchant-defaults.ts
lib/analytics/wizard-v2-posthog.ts
app/api/ai/analyze-product/route.ts
app/api/supplier/merchant-defaults/route.ts
app/api/supplier/gamification/award-product/route.ts
components/supplier/wizard-v2/*
components/supplier/product-live-preview.tsx
app/dashboard/admin/product-funnel/page.tsx
prisma/migrations/20260710180000_wizard_v2_merchant_defaults_gamification/
```
