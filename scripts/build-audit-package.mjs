#!/usr/bin/env node
/**
 * Build Affisell_Audit_Package.zip — code + auto-generated audit docs, no secrets.
 * Run: node scripts/build-audit-package.mjs
 */
import { execSync, spawnSync } from "node:child_process"
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs"
import { join, relative } from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..")
const STAGE = join(ROOT, ".audit-staging")
const ZIP_OUT = join(ROOT, "Affisell_Audit_Package.zip")

const SECRET_PATTERNS = [
  { name: "Groq API key", re: /\bgsk_[A-Za-z0-9]{20,}\b/ },
  { name: "OpenAI API key", re: /\bsk-[A-Za-z0-9]{20,}\b/ },
  { name: "Stripe live secret", re: /\bsk_live_[A-Za-z0-9]{10,}\b/ },
  { name: "Stripe test secret", re: /\bsk_test_[A-Za-z0-9]{10,}\b/ },
  { name: "AWS access key", re: /\bAKIA[0-9A-Z]{16}\b/ },
  { name: "Resend API key", re: /\bre_[A-Za-z0-9]{20,}\b/ },
  { name: "Private key block", re: /-----BEGIN (RSA |EC )?PRIVATE KEY-----/ },
]

const COPY_DIRS = [
  "app",
  "components",
  "lib",
  "prisma",
  "types",
  "hooks",
  "public",
  "docs",
  "legal",
  "scripts",
  "i18n",
  "messages",
  "emails",
]

const COPY_FILES = [
  "package.json",
  "package-lock.json",
  "tsconfig.json",
  "next.config.ts",
  "proxy.ts",
  "README.md",
  "AGENTS.md",
  "CLAUDE.md",
  ".cursorrules",
  ".env.example",
  "postcss.config.mjs",
  "eslint.config.mjs",
  "vitest.config.ts",
  "playwright.config.ts",
  "components.json",
]

const SKIP_DIR_NAMES = new Set([
  "node_modules",
  ".next",
  "dist",
  "build",
  "coverage",
  ".cache",
  ".git",
  ".audit-staging",
  "medusa-backend",
])

const SKIP_FILE_NAMES = new Set([
  ".env",
  ".env.local",
  ".env.production",
  ".env.development",
  ".DS_Store",
])

function walkFiles(dir, acc = []) {
  if (!existsSync(dir)) return acc
  for (const name of readdirSync(dir)) {
    if (SKIP_DIR_NAMES.has(name)) continue
    const full = join(dir, name)
    const st = statSync(full)
    if (st.isDirectory()) walkFiles(full, acc)
    else acc.push(full)
  }
  return acc
}

function countGlob(dir, pattern) {
  try {
    const out = execSync(
      `find "${dir}" ${pattern} 2>/dev/null | wc -l | tr -d ' '`,
      { encoding: "utf8", cwd: ROOT }
    )
    return parseInt(out.trim(), 10) || 0
  } catch {
    return 0
  }
}

function listApiGroups() {
  const apiRoot = join(ROOT, "app/api")
  const groups = {}
  walkFiles(apiRoot).forEach((f) => {
    if (!f.endsWith("route.ts")) return
    const rel = relative(apiRoot, f)
    const seg = rel.split("/")[0]
    groups[seg] = (groups[seg] || 0) + 1
  })
  return Object.entries(groups)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
}

function prismaModels() {
  const schema = readFileSync(join(ROOT, "prisma/schema.prisma"), "utf8")
  return [...schema.matchAll(/^model (\w+)/gm)].map((m) => m[1])
}

function readPkg() {
  return JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"))
}

/** Top-level tree only — avoids multi-MB trees under app/ or lib/. */
function treeLines(dir) {
  if (!existsSync(dir)) return []
  const lines = []
  const entries = readdirSync(dir)
    .filter((n) => !SKIP_DIR_NAMES.has(n) && !n.startsWith("."))
    .sort()
  for (let i = 0; i < entries.length; i++) {
    const name = entries[i]
    const full = join(dir, name)
    const isLast = i === entries.length - 1
    const branch = isLast ? "└── " : "├── "
    const st = statSync(full)
    lines.push(`${branch}${name}${st.isDirectory() ? "/" : ""}`)
  }
  return lines
}

function findDeprecated() {
  const hits = []
  for (const dir of ["lib", "app", "components"]) {
    const base = join(ROOT, dir)
    if (!existsSync(base)) continue
    for (const f of walkFiles(base)) {
      if (!/\.(ts|tsx)$/.test(f)) continue
      const text = readFileSync(f, "utf8")
      if (text.includes("@deprecated")) {
        const rel = relative(ROOT, f)
        const line = text.split("\n").findIndex((l) => l.includes("@deprecated")) + 1
        hits.push({ file: rel, line })
      }
    }
  }
  return hits.slice(0, 30)
}

function scanSecretsInStage() {
  const hits = []
  for (const f of walkFiles(STAGE)) {
    if (f.includes(".env") && !f.endsWith(".env.example")) continue
    let text
    try {
      text = readFileSync(f, "utf8")
    } catch {
      continue
    }
    if (text.includes("\0")) continue
    for (const { name, re } of SECRET_PATTERNS) {
      if (re.test(text)) hits.push({ file: relative(STAGE, f), kind: name })
    }
  }
  return hits
}

function copyToStage() {
  rmSync(STAGE, { recursive: true, force: true })
  mkdirSync(STAGE, { recursive: true })

  for (const d of COPY_DIRS) {
    const src = join(ROOT, d)
    if (!existsSync(src)) continue
    cpSync(src, join(STAGE, d), {
      recursive: true,
      filter: (srcPath) => {
        const parts = srcPath.split("/")
        if (parts.some((p) => SKIP_DIR_NAMES.has(p))) return false
        const base = parts[parts.length - 1]
        if (SKIP_FILE_NAMES.has(base)) return false
        if (base.startsWith(".env") && base !== ".env.example") return false
        return true
      },
    })
  }

  for (const f of COPY_FILES) {
    const src = join(ROOT, f)
    if (existsSync(src)) cpSync(src, join(STAGE, f))
  }

  // public: skip large non-essential binaries if any
  const publicDir = join(STAGE, "public")
  if (existsSync(publicDir)) {
    for (const f of walkFiles(publicDir)) {
      const st = statSync(f)
      if (st.size > 5 * 1024 * 1024) {
        rmSync(f)
        console.log("[audit-package] skipped large public asset:", relative(STAGE, f))
      }
    }
  }
}

function writeDocs(stats) {
  const docsDir = join(STAGE, "docs")
  mkdirSync(docsDir, { recursive: true })

  const models = stats.models
  const apiGroups = stats.apiGroups
  const pkg = stats.pkg

  const deps = Object.keys(pkg.dependencies || {})
  const devDeps = Object.keys(pkg.devDependencies || {})

  writeFileSync(
    join(docsDir, "PROJECT_OVERVIEW.md"),
    `# Project Overview — Affisell

> Auto-generated audit document. Generated: ${stats.generatedAt}

## Mission

**Affisell** is an EU-first affiliate marketplace connecting three personas:

| Persona | Role (DB) | Primary surface |
|---------|-----------|-----------------|
| **Supplier** | \`SUPPLIER\` | Catalog, wholesale pricing, fulfillment, Stripe Connect |
| **Affiliate / Creator** | \`AFFILIATE\` | Storefront, margins, listings, Brand Studio |
| **Buyer** | \`CUSTOMER\` | Marketplace, shops, checkout, orders, reviews |

Additional roles: **ADMIN** (ops), **AGENT** (sourcing missions), demo users (\`*@demo.affisell.com\`).

## Business model

1. Suppliers publish products with wholesale + commission (bps).
2. Affiliates curate listings with retail margin on their storefront.
3. Buyers purchase via Stripe/PayPal checkout; platform splits fees (supplier fee, affiliate platform fee, VAT).
4. **1 Order = 1 Product** — no multi-item cart checkout at order level (cart exists for UX but orders are product-scoped).

## Tech stack (summary)

- **Runtime**: Node 24+, Next.js ${pkg.dependencies?.next ?? "16.x"}, React 19
- **DB**: PostgreSQL via Prisma (${models.length} models)
- **Auth**: NextAuth v5 (JWT + Prisma adapter)
- **Payments**: Stripe Connect + PayPal (feature-flagged)
- **Email**: Resend + React Email v1.3
- **Cache / rate-limit**: Upstash Redis
- **AI**: OpenAI (vision/InstantScan), Groq, Google Generative AI, Replicate (Veo/video)
- **Deploy**: Vercel (standalone output), Sentry optional

## Repository layout

\`\`\`
${stats.tree}
\`\`\`

## Key entry points

- \`app/\` — App Router pages (${stats.pages} pages) + API (${stats.apiRoutes} routes)
- \`lib/\` — Domain logic (~${stats.libFiles} TypeScript files)
- \`components/\` — UI (${stats.components} React components)
- \`proxy.ts\` — Edge middleware (i18n, auth, custom domains, legal gate) — Next.js 16 convention
- \`prisma/schema.prisma\` — Single source of truth for data model

## Environment

Copy \`.env.example\` → \`.env\`. Never commit real secrets. See \`AGENTS.md\` for feature flags (Demo Lab, video paywall, legal gate v2, InstantScan).

## Related audit docs

See \`AUDIT_INDEX.md\` at package root and sibling files in this \`docs/\` folder.
`
  )

  writeFileSync(
    join(docsDir, "ARCHITECTURE.md"),
    `# Architecture — Affisell

> Generated: ${stats.generatedAt}

## High-level diagram

\`\`\`
                    ┌─────────────────────────────────────┐
                    │           proxy.ts (Edge)            │
                    │  i18n · auth · custom domain · legal │
                    └─────────────────┬───────────────────┘
                                      │
          ┌───────────────────────────┼───────────────────────────┐
          ▼                           ▼                           ▼
   app/(marketing)            app/dashboard/*              app/api/*
   marketplace, shops          supplier/affiliate/admin      REST + webhooks
          │                           │                           │
          └───────────────────────────┼───────────────────────────┘
                                      ▼
                              lib/* (server-only)
                                      │
                    ┌─────────────────┼─────────────────┐
                    ▼                 ▼                 ▼
               Prisma/PostgreSQL   Upstash Redis    Stripe/Resend/S3
\`\`\`

## Layers

### Presentation (\`app/\`, \`components/\`)

- **App Router** with route groups: marketing, dashboard (supplier/affiliate/admin), legal, shops.
- Client components must not import Prisma-backed \`lib/*\` modules directly — use \`*-types.ts\` / \`*-shared.ts\` (see \`AGENTS.md\`).

### Edge / routing (\`proxy.ts\`)

Merged responsibilities (documented in README as middleware):

1. **next-intl** — locales \`en|fr|de|es|it|nl|pl|zh\`; cookie \`affisell_locale\`
2. **NextAuth JWT** — protected dashboard paths
3. **Custom domains** — \`/api/store/resolve-host\` rewrite to \`/shops/:slug\`
4. **Legal gate** — terms re-acceptance (\`lib/middleware-terms-gate.ts\`)

### Domain (\`lib/\`)

Organized by feature: \`lib/stripe-*\`, \`lib/ai/*\`, \`lib/legal/*\`, \`lib/instantscan/*\`, \`lib/cron/*\`, etc.

### Data (\`prisma/\`)

- ${models.length} Prisma models, migrations in \`prisma/migrations/\`
- Idempotency patterns: \`ProcessedWebhook\`, unique constraints on external IDs

### Async / background

- **Cron routes**: \`app/api/cron/*\` — Bearer \`CRON_SECRET\` (GitHub Actions scheduler)
- **Inngest** / **BullMQ** — job queues for heavy work
- **Webhooks**: Stripe, PayPal, AfterShip, supplier tracking, try-on

## Security headers

\`next.config.ts\` applies \`lib/security-headers.ts\` globally; embed routes use relaxed CSP.

## i18n

- \`i18n/routing.ts\` + \`messages/{locale}.json\` (1700+ keys per locale)
- URL prefix \`/fr\` only on selected marketing routes; elsewhere cookie-driven

## Observability

- Structured logs with \`[module]\` prefix (see \`.cursorrules\`)
- Sentry (optional), Vercel Analytics, PostHog (Smart Margin events)
- Logtail integration (\`@logtail/next\`)

## Not included in this audit package

- \`medusa-backend/\` — separate Medusa v2 experiment/sync layer (excluded: size + node_modules)
- Production \`.env*\` files
`
  )

  writeFileSync(
    join(docsDir, "FEATURES.md"),
    `# Features — Affisell

> Generated: ${stats.generatedAt}

## Supplier

| Feature | Location | Notes |
|---------|----------|-------|
| Product wizard v1/v2 | \`app/dashboard/supplier/products/*\` | Flag \`ENABLE_WIZARD_V2\`, query \`?wizard=v2\` |
| **InstantScan** | \`/api/ai/analyze-product\` | Vision AI product import from photo |
| **Smart Margin AI** | \`/api/ai/margin-analysis\` | Cortex Phase 1 — margin + success score |
| CSV import | \`/api/supplier/import-csv\` | Bulk catalog |
| Variants & attributes | \`lib/supplier-*\`, category templates | Taxonomy-driven |
| Orders & tracking | \`/api/supplier/orders/*\` | Validate tracking, returns |
| Stripe Connect KYC | \`lib/stripe-*\`, dashboard onboarding | Payouts, lightning payout |
| Video generation (Veo) | \`/api/supplier/*video*\` | Paywall paused by default |
| Try-on (garment) | \`/api/supplier/products/[id]/try-on/*\` | Virtual try-on jobs |
| Gamification / XP | \`/api/supplier/gamification/*\` | Wizard v2 engagement |
| Trust tiers | \`supplierTrustTier\` on User | SPARK / FORGE / ORBITAL |
| Supplier extension | \`apps/affisell-supplier-extension\` | Browser extension (not in zip) |

## Affiliate / Creator

| Feature | Location | Notes |
|---------|----------|-------|
| Discover catalog | \`/api/affiliate/discover-catalog\` | Margin opportunities |
| Listings & storefront | \`/shops/{slug}\`, Brand Studio | Custom theme JSON |
| Custom domain + SSL | \`/api/store/verify-domain\` | Vercel hostname API |
| Margin auto-fix | \`/api/affiliate/margin-auto-fix-all\` | Bulk pricing |
| DAC7 export | \`/api/affiliate/dac7-export\` | EU tax reporting |
| Pulse swipe feed | \`/api/buyer/swipe-feed\` | Buyer discovery UX |
| Sponsor campaigns | \`SponsorCampaign\` model | Promoted listings |

## Buyer

| Feature | Location | Notes |
|---------|----------|-------|
| Marketplace | \`/marketplace/*\` | Curated affiliate listings |
| Cart | \`/api/cart/*\` | Pre-checkout |
| Checkout | \`/api/checkout/*\`, Stripe | Stripe + PayPal paths |
| Orders & returns | \`/api/account/orders/*\` | Self-service |
| Wishlist + price alerts | \`/api/wishlist/*\`, cron alerts | Web push optional |
| Reviews | \`/marketplace/{id}?writeReview=true\` | Post-order nudge crons |
| Booking slots | \`BookingSlot\`, \`BookingSeat\` | Service products |
| Auctions | \`Auction\`, \`AuctionBid\` | Optional product mode |

## Platform / Admin

| Feature | Location |
|---------|----------|
| Ops signals | \`OpsSignal\`, admin dashboards |
| Supplier leads CRM | \`/api/admin/supplier-leads/*\` |
| Payout legacy backfill | \`/api/admin/payout-legacy\` |
| Expansion pilots | \`scripts/expansion-*\` |
| Demo Lab | \`/demo\`, \`POST /api/demo/feedback\` |
| Agent network | \`SourcingAgent\`, \`AgentMission\` |

## Automation (cron sample)

Top API groups by route count: ${apiGroups.map(([g, n]) => `\`${g}\` (${n})`).join(", ")}.

Representative crons: onboarding emails, abandoned cart, reconcile payouts, sync store domains, review nudges, market intelligence sync, try-on retention.

## Feature flags (env)

See \`.env.example\`: \`ENABLE_INSTANTSCAN\`, \`ENABLE_WIZARD_V2\`, \`DEMO_LAB_ENABLED\`, \`VIDEO_PAYWALL_PAUSED\`, \`LEGAL_GATE_V2_ENABLED\`, \`MARKETPLACE_PAYPAL_ENABLED\`, etc.
`
  )

  writeFileSync(
    join(docsDir, "DATABASE.md"),
    `# Database — Affisell

> Generated: ${stats.generatedAt}

## Overview

- **ORM**: Prisma ${pkg.dependencies?.["@prisma/client"] ?? "6.x"}
- **Provider**: PostgreSQL
- **Models / tables**: ${models.length} (\`model\` declarations ≈ physical tables)
- **Schema**: \`prisma/schema.prisma\`
- **Migrations**: \`prisma/migrations/\` — never edit applied migrations

## Core entity groups

### Identity & auth
\`User\`, \`Account\`, \`Session\`, \`VerificationToken\`, \`PasswordResetToken\`
- \`User.role\`: string default \`CUSTOMER\` — values include SUPPLIER, AFFILIATE, ADMIN, AGENT

### Profiles & store
\`SupplierProfile\`, \`AffiliateProfile\`, \`Store\`, \`MerchantDefault\`, \`MerchantLegalProfile\`

### Catalog
\`Product\`, \`ProductVariant\`, \`ProductAttribute\`, \`Category\`, \`Attribute\`, \`AttributeOption\`, \`CategoryAttribute\`, \`CategoryTemplate\`, \`Subcategory\`, \`ProductVideo\`, \`ProductReview\`

### Marketplace & affiliate
\`AffiliateProduct\`, \`AffiliateSwipe\`, \`SponsorCampaign\`, \`LuxuryCollection\`, \`SearchHistory\`

### Commerce
\`Order\` (1 product per order), \`Cart\`, \`CartItem\`, \`OrderReturn\`, \`OrderTrackingEvent\`, \`OrderFulfillmentMessage\`, \`OrderShipExtension\`
- Payouts: \`MerchantPayoutLedger\`, \`TransferAttempt\`, \`TransferReversal\`, \`OrderStripeRefund\`

### Legal & compliance
\`LegalDocument\`, \`LegalVersion\`, \`LegalAcceptance\`, \`LegalPolicy\`, \`TermsAcceptanceLog\`, \`MerchantLegalDocument\`

### Engagement
\`Review\`, \`ReviewVote\`, \`ReviewReply\`, \`Wishlist\`, \`GuestWishlist\`, \`PushSubscription\`, \`Notification\`, \`CommunityPost\`, \`Follow\`

### Fulfillment integrations
\`FulfillmentProvider\`, \`SupplierFulfillmentOrder\`, \`BlindDropshipSupplier\`, \`WooCommerceApiCredential\`, \`AutodsFulfillmentLog\`, \`SupplierIntegration\`

### AI / media jobs
\`VideoGenerationJob\`, \`TryOnJob\`, \`TryOn\`

### Agent / ops
\`SourcingAgent\`, \`AgentMission\`, \`AgentLedgerEntry\`, \`OpsSignal\`, \`OpsScanSnapshot\`, \`DemoFeedback\`

### Idempotency & webhooks
\`ProcessedWebhook\` — dedupe external webhook deliveries

## Full model list

${models.map((m) => `- \`${m}\``).join("\n")}

## Indexing & conventions

- CUID primary keys (\`@default(cuid())\`)
- JSON columns for flexible snapshots (\`supplierMetrics\`, \`storefrontTheme\`, Stripe capabilities)
- Fee fields in **basis points** (bps): e.g. \`defaultSupplierCommissionRateBps\`, \`affiliatePlatformFeeBps\`

## Seeds

- \`prisma/seed-legal.ts\` — legal documents
- \`npm run demo:ensure\` — Demo Lab users (idempotent)
`
  )

  const apiGroupTable = apiGroups
    .map(([g, n]) => `| \`${g}\` | ${n} |`)
    .join("\n")

  writeFileSync(
    join(docsDir, "API_OVERVIEW.md"),
    `# API Overview — Affisell

> Generated: ${stats.generatedAt}

## Summary

| Metric | Value |
|--------|------:|
| Total route handlers | ${stats.apiRoutes} |
| Pattern | \`app/api/**/route.ts\` (App Router) |

## Top route groups

| Prefix | Routes |
|--------|-------:|
${apiGroupTable}

## Authentication patterns

| Pattern | Usage |
|---------|-------|
| NextAuth session | Dashboard + user-scoped APIs |
| Bearer \`CRON_SECRET\` | All \`/api/cron/*\` |
| Stripe webhook signature | \`/api/webhooks/stripe\` |
| Supplier HMAC / tokens | Supplier webhooks, extension tokens |
| Public + rate limit | AI analyze, margin-analysis (Upstash) |

## Key API families

### AI
- \`POST /api/ai/analyze-product\` — InstantScan vision pipeline
- \`POST /api/ai/margin-analysis\` — Smart Margin AI (100 req/h user limit)

### Checkout & payments
- \`/api/checkout/*\`, \`/api/stripe/create-checkout\`, \`/api/stripe/verify-pro\`
- Webhooks: Stripe, PayPal (if enabled)

### Supplier
- CRUD products, orders, returns, import, gamification, notifications

### Affiliate
- Listings, discover, margin tools, DAC7 export, catalog add

### Store / domain
- \`/api/store/verify-domain\`, \`/api/store/resolve-host\`, brand generation APIs

### Legal
- \`/api/legal/documents\`, \`/api/legal/acceptance\`, gate sync

### Cron (sample)
- \`sync-market-intelligence\`, \`sync-store-vercel-domains\`, \`reconcile\`, \`onboarding\`, \`abandoned-cart\`

## Rate limiting

Upstash Redis via \`@upstash/ratelimit\` on sensitive AI and auth endpoints.

## Error handling convention

Typed JSON errors; business logs \`console.log('[module]', { ... })\` per \`.cursorrules\`.
`
  )

  writeFileSync(
    join(docsDir, "ROLE_SYSTEM.md"),
    `# Role System — Affisell

> Generated: ${stats.generatedAt}

## User roles

Stored on \`User.role\` (string, default \`CUSTOMER\`).

| Role | Description | Dashboard base |
|------|-------------|----------------|
| \`CUSTOMER\` | Buyer — orders, wishlist, reviews | \`/account/*\`, marketplace |
| \`SUPPLIER\` | Catalog owner, fulfillment, Connect payouts | \`/dashboard/supplier/*\` |
| \`AFFILIATE\` | Creator — listings, storefront, margins | \`/dashboard/affiliate/*\` |
| \`ADMIN\` | Internal ops — leads, payouts, expansion | \`/dashboard/admin/*\` |
| \`AGENT\` | Sourcing agent missions (China buy routes) | \`/agent/*\` |

Signup flows: \`/signup/supplier\`, \`/signup/affiliate\`, role query params on marketing CTAs.

## Auth stack

- **NextAuth v5** (\`next-auth\`) with Prisma adapter
- JWT in middleware via \`getToken\` from \`next-auth/jwt\`
- Session helpers: \`lib/supplier-or-admin-session.ts\`, buyer identify flow

## Authorization patterns

1. **Route-level**: \`proxy.ts\` redirects unauthenticated users from dashboard paths
2. **API-level**: session check + resource ownership (supplierId, affiliateId on rows)
3. **Admin**: explicit ADMIN role or allowlist patterns in admin routes

## Legal / terms gating

- **CGU/CGS/CGA** acceptance timestamps on \`User\`
- \`lib/middleware-terms-gate.ts\` — blocks dashboard until terms accepted
- **Legal Gate v2**: \`LEGAL_GATE_V2_ENABLED\` env + \`LegalPolicy\` DB flag
- Role-specific terms: \`lib/legal/role-terms.ts\`, signup consent components

## Stripe Connect linkage

- \`User.stripeAccountId\` — Connect Express/Standard for suppliers/affiliates receiving payouts
- \`stripeOnboardedAt\`, \`stripeCapabilities\` JSON for capability gating

## Trust & verification

- \`isVerifiedSupplier\`, \`supplierTrustTier\` (NONE → ORBITAL)
- Merchant verification gate API: \`/api/merchant/verification-gate\`

## Demo Lab users

Emails matching \`*@demo.affisell.com\` — password-gated entry, preview env auto-enabled.
`
  )

  writeFileSync(
    join(docsDir, "PAYMENT_SYSTEM.md"),
    `# Payment System — Affisell

> Generated: ${stats.generatedAt}

## Providers

| Provider | Status | Key files |
|----------|--------|-----------|
| **Stripe** | Primary | \`lib/stripe-*\`, \`/api/stripe/*\`, webhooks |
| **PayPal** | Feature-flagged | \`MARKETPLACE_PAYPAL_ENABLED\`, verify script |

## Checkout flow

1. Buyer adds listing to cart (\`/api/cart/add\`)
2. Checkout session created (\`/api/checkout\`, \`/api/stripe/create-checkout\`)
3. Payment succeeds → webhook → \`Order\` created (**1 order = 1 product**)
4. Commission split applied (\`lib/stripe-marketplace-commission-split.ts\`)
5. Fulfillment + tracking → payout eligibility

## Stripe Connect

- Suppliers/affiliates onboard via Connect (\`stripeAccountId\`)
- Transfers to connected accounts recorded in \`MerchantPayoutLedger\`
- \`TransferAttempt\`, \`TransferReversal\` for clawback / refunds
- **Lightning payout**: admin-approved instant payout path

## Fees (basis points)

Configured per user / category / product:

- \`supplierFeeBpsCatalog\` / \`supplierFeeBpsAutoBuy\` — platform fee on wholesale
- \`affiliatePlatformFeeBps\` — fee on affiliate earnings
- \`defaultSupplierCommissionRateBps\` — supplier → affiliate commission offer

## VAT

- Seller VAT number on \`User.vatNumber\`
- VAT settlement scripts: \`npm run test:vat*\`, \`lib/*vat*\`
- EU-first defaults in \`lib/market-config.ts\`

## Refunds & returns

- \`OrderStripeRefund\`, \`OrderReturn\` models
- Supplier return handling: \`/api/supplier/returns/[returnId]\`
- Cron: \`retry-pending-clawback\`

## Subscriptions (Affisell+ / Pro)

- \`User.isPro\`, \`stripeSubscriptionId\`
- Video paywall: **paused by default** (\`VIDEO_PAYWALL_PAUSED\`) — unlimited Veo in test mode

## Webhook idempotency

\`ProcessedWebhook\` table prevents duplicate Stripe/webhook processing.

## Reconciliation

Cron \`/api/cron/reconcile\` — payout vs Stripe balance alignment (ops-critical).

## Security

- Never log full payment intents or card data
- Webhook signature verification on all payment webhooks
- No Stripe secrets in repository (\`.env.example\` placeholders only)
`
  )

  writeFileSync(
    join(docsDir, "MARKETPLACE_FLOW.md"),
    `# Marketplace Flow — Affisell

> Generated: ${stats.generatedAt}

## End-to-end flow

\`\`\`
Supplier creates Product
        │
        ▼
Affiliate adds to catalog (AffiliateProduct) + sets margin
        │
        ▼
Listing visible on /marketplace/{affiliateProductId} and /shops/{slug}
        │
        ▼
Buyer discovers (search, Pulse swipe, Command-K, wishlist alerts)
        │
        ▼
Add to cart → Checkout (Stripe/PayPal)
        │
        ▼
Order created (status pipeline: paid → processing → shipped → delivered)
        │
        ▼
Commission split + MerchantPayoutLedger entries
        │
        ▼
Post-purchase: review nudge, repurchase reminder, referral UGC
\`\`\`

## URL conventions

- Listing page: \`/marketplace/{affiliateProductId}\`
- Review prompt: \`/marketplace/{affiliateProductId}?writeReview=true&orderId={id}\`
- Affiliate shop: \`/shops/{slug}\` or custom domain → rewrite via \`proxy.ts\`

## 1 Order = 1 Product

Affisell convention (see \`.cursorrules\`): orders reference a single \`product\` / listing — no \`order.items[]\` multi-SKU model.

## Pricing display

- Wholesale (supplier) → commission bps → affiliate retail price
- \`lib/affiliate-catalog-margin-display.ts\` — client-safe margin math

## Discovery surfaces

| Surface | API / component |
|---------|-----------------|
| Global marketplace | \`/marketplace\`, filters by category |
| Affiliate shop | Store-themed catalog |
| Pulse swipe | \`/api/buyer/swipe-feed\` |
| Discover | \`/api/affiliate/discover-catalog\` (affiliate-side) |
| Sponsored | \`SponsorCampaign\` |

## Fulfillment

- Native supplier ship + tracking validation
- Integrations: AutoDS, WooCommerce, blind dropship providers
- AfterShip webhook for tracking updates

## Returns & disputes

- Buyer initiates return via account APIs
- Supplier approves/rejects via dashboard
- Impacts supplier trust metrics (\`supplierMetrics\` JSON)

## Images

Always resolve via \`resolveOrderConfirmationImageUrl(order)\` — no hardcoded product image URLs in emails/UI.
`
  )

  writeFileSync(
    join(docsDir, "AI_FEATURES.md"),
    `# AI Features — Affisell

> Generated: ${stats.generatedAt}

## Overview

| Feature | API | Models / providers | Status |
|---------|-----|-------------------|--------|
| **InstantScan** | \`POST /api/ai/analyze-product\` | OpenAI GPT-4o vision | Prod flag \`ENABLE_INSTANTSCAN=1\` |
| **Smart Margin AI** | \`POST /api/ai/margin-analysis\` | Heuristics + fixtures + Redis cache | Cortex Phase 1 shipped |
| Product classification | Various supplier APIs | Groq / OpenAI | Production |
| Brand copy / FAQ | \`/api/store/generate-brand-*\` | LLM | Production |
| Hero video (Veo) | \`/api/store/generate-hero-video\` | Google Veo / Replicate | Paywall paused |
| Virtual try-on | \`/api/try-on/*\` | MediaPipe + external | Pilot |
| Background removal | Client ONNX | @imgly/background-removal | Photo studio |
| i18n batch translate | \`scripts/i18n-translate-locale.mjs\` | Groq | Dev tooling |

## InstantScan pipeline

Files: \`lib/ai/product-analyzer.ts\`, \`lib/ai/instantscan-client.ts\`, \`lib/ai/vision-image-url.ts\`

1. Client uploads image (zero-wait uploader → CDN)
2. Server fetches CDN URL → base64 for vision API
3. GPT-4o extracts title, description, attributes, category hints
4. Rate-limited per user (Upstash); partial results on low confidence
5. Wizard v2 integrates Express / Guided / Pro modes

Env: \`OPENAI_API_KEY\`, \`PRODUCT_VISION_V2_MODEL=gpt-4o\`, \`ENABLE_INSTANTSCAN=1\`

## Smart Margin AI (Cortex Phase 1)

Files: \`lib/ai/margin-optimizer.ts\`, \`lib/ai/success-scorer.ts\`, \`lib/ai/market-intelligence.ts\`

1. Market data: Redis cache → 2026 fixtures → category heuristics (no live scraper yet)
2. Margin optimizer suggests price bands + commission adjustments
3. Success probability score for listing publish decision
4. Cron \`GET /api/cron/sync-market-intelligence\` refreshes fixture cache every 6h
5. PostHog events via \`lib/analytics/smart-margin-posthog.ts\`
6. Legal disclaimers: \`lib/legal/disclaimers.ts\`

Tests: \`npm run test:ai\` (45 tests), wizard integration tests

## Rate limits

- Margin analysis: 100 requests/hour per user
- InstantScan: session single-flight + cached quota

## Phase 2 roadmap (not yet implemented)

Live market intelligence: Amazon BSR, Google Trends, TikTok signals — see \`ROADMAP.md\`.

## Dependencies

\`openai\`, \`groq-sdk\`, \`@ai-sdk/groq\`, \`@google/generative-ai\`, \`ai\` (Vercel AI SDK), \`replicate\`
`
  )

  writeFileSync(
    join(docsDir, "LEGAL_FOUNDATION_STATUS.md"),
    `# Legal Foundation Status — Affisell

> Generated: ${stats.generatedAt}

## Content sources

| Location | Purpose |
|----------|---------|
| \`legal/content/{locale}/*.md\` | Localized legal markdown (en, fr, de, es, it, nl, pl, zh) |
| \`legal/agreements/*.md\` | Base agreement templates |
| \`lib/legal/*\` | Runtime resolution, acceptance, gate logic |
| \`app/legal/*\`, \`app/(legal)/*\` | Public legal pages |

## Document types

- Terms of service (CGU)
- Terms of sale (CGV)
- Supplier terms (CGA / conditions-fournisseur)
- Affiliate terms (CGS / conditions-affilie)
- Privacy policy, cookies policy, refund policy
- Affisell+ terms, mentions légales

## Database tracking

- \`LegalDocument\`, \`LegalVersion\`, \`LegalAcceptance\`
- \`TermsAcceptanceLog\`, \`MerchantLegalDocument\`
- User fields: \`cguAcceptedAt\`, \`termsAcceptedAt\`, privacy timestamps

## Acceptance flows

1. **Signup**: \`components/legal/legal-signup-consent.tsx\`, role-specific checkboxes
2. **Stripe KYC**: \`lib/legal/stripe-kyc-legal-acceptance.ts\`
3. **Re-acceptance gate**: middleware blocks dashboard until current version accepted
4. **APIs**: \`/api/legal/acceptance\`, \`/api/user/role-terms-acceptance\`

## Legal Gate v2

- Env: \`LEGAL_GATE_V2_ENABLED\` (0/1)
- DB policy: \`LegalPolicy\` key \`LEGAL_GATE_V2_ENABLED\`
- Default: **off** unless explicitly enabled

## Cookie consent

- \`react-cookie-consent\` + \`lib/legal/cookie-consent-runtime.ts\`
- Analytics gated: \`components/legal/analytics-gated-deferred.tsx\`

## Publishing workflow

Scripts: \`npm run legal:seed\`, \`npm run legal:publish\`, \`npm run legal:backfill:acceptances\`

## EU focus

- Entity constants: \`lib/legal/entity.ts\`, \`lib/legal/company-env.ts\`
- Normative sources registry: \`lib/legal/normative-sources.ts\`
- Protected checkout page for high-risk categories

## Audit note

Legal markdown in this package is **informational for architecture review** — not legal advice. Verify jurisdiction and version hashes in production DB before compliance sign-off.
`
  )

  const deprecated = stats.deprecated

  writeFileSync(
    join(docsDir, "KNOWN_LIMITATIONS.md"),
    `# Known Limitations — Affisell

> Generated: ${stats.generatedAt}

## Product / business

| Limitation | Impact | Mitigation |
|------------|--------|------------|
| **1 Order = 1 Product** | No native multi-SKU checkout order | Cart UX only; document for integrators |
| Market intelligence fixtures | Smart Margin uses 2026 fixtures/heuristics, not live Amazon/Trends | Phase 2 Cortex roadmap |
| Video paywall paused | Unlimited free Veo generations | Set \`VIDEO_PAYWALL_PAUSED=0\` to enforce limits |
| Legal Gate v2 default off | Old gate behavior unless enabled | Enable via env + LegalPolicy |
| PayPal optional | Stripe-only in some regions | \`MARKETPLACE_PAYPAL_ENABLED\` |

## Technical

| Limitation | Notes |
|------------|-------|
| Next.js 16 \`proxy.ts\` | Not classic \`middleware.ts\` — auditors must read \`proxy.ts\` |
| Medusa backend excluded | Separate subproject; sync scripts exist but not primary path |
| Client cannot import Prisma libs | Requires \`*-types.ts\` split — occasional footgun |
| Large \`lib/\` surface (~${stats.libFiles} files) | High coupling risk in some modules |
| 386 API routes | Broad attack surface — rate limits not uniform on all routes |

## AI-specific

- InstantScan confidence may return partial fields on low-quality photos
- Vision model env must be valid (\`gpt-4o\`); invalid model names fall back
- Margin analysis disclaimer required — not financial advice (\`lib/legal/disclaimers.ts\`)

## Operational

- Cron depends on GitHub Actions + \`CRON_SECRET\` — missed cron if misconfigured
- Custom domain SSL depends on Vercel API token + DNS propagation delays
- Demo Lab must be explicitly disabled in production (\`DEMO_LAB_ENABLED=0\`)

## Testing gaps (inferred)

- E2E via Playwright exists but not exhaustive for 203 pages
- Many cron paths rely on manual \`curl\` verification per \`.cursorrules\`
`
  )

  writeFileSync(
    join(docsDir, "TECH_DEBT.md"),
    `# Technical Debt — Affisell

> Generated: ${stats.generatedAt}

## Explicit markers

| Type | Count in app/lib/components | Notes |
|------|------------------------------|-------|
| \`TODO\` | ${stats.todoCount} | Minimal explicit TODO comments |
| \`FIXME\` | ${stats.fixmeCount} | Minimal explicit FIXME comments |

## @deprecated symbols (${deprecated.length} sampled)

${deprecated.length ? deprecated.map((d) => `- \`${d.file}:${d.line}\``).join("\n") : "- None found in sample scan"}

Common themes: InstantScan legacy naming, middleware alias (\`proxy\` export), old legal gate helpers, gallery persist URL flow.

## Structural debt

1. **Role as string** — \`User.role\` not enum at DB level; typos possible
2. **386 API routes** — inconsistent auth middleware patterns across routes
3. **Dual wizard v1/v2** — maintenance burden until v1 retired
4. **README references \`middleware.ts\`** — actual file is \`proxy.ts\` (Next 16)
5. **medusa-backend** — parallel commerce stack, unclear long-term ownership
6. **Fee fields proliferation** — legacy \`supplierFeeBps\` vs catalog/autobuy split

## Recommended audit focus areas

- Payment webhook idempotency edge cases (refund + clawback race)
- Custom domain rewrite + auth cookie domain alignment
- AI endpoint abuse (rate limits, cost caps)
- Payout ledger reconciliation vs Stripe dashboard
- Legal acceptance version drift across locales

## Quality gates present

- \`npm run verify:no-secrets\` — pre-push secret scan
- \`npm run check:client-prisma\` — client import guard
- Vitest suites: \`test:ai\`, \`test:wizard:v2\`, VAT tests
- ESLint + TypeScript strict (project standard)
`
  )

  writeFileSync(
    join(docsDir, "ROADMAP.md"),
    `# Roadmap — Affisell (inferred from codebase)

> Generated: ${stats.generatedAt}

## Near-term (evidence in repo)

| Initiative | Signals | Success metric |
|------------|---------|----------------|
| **Wizard v2 GA** | RFC \`docs/RFC-ADD-PRODUCT-V2.md\`, feature flag | Retire v1, +conversion on publish |
| **InstantScan prod** | \`ENABLE_INSTANTSCAN\`, hardening commits | Supplier time-to-list < 2 min |
| **Smart Margin Phase 2** | Comments in \`market-intelligence.ts\` | Live scraper APIs, acceptance > 60% |
| **Legal Gate v2** | \`LegalPolicy\`, middleware gate | 100% re-acceptance on version bump |
| **Store domains automation** | Cron sync Vercel domains | SSL active < 24h after DNS |

## Medium-term

- PayPal checkout rollout (\`verify:paypal:prod\`)
- Web push expansion (price alerts shipped; more event types)
- Agent network scale (\`SourcingAgent\`, mission ledger)
- Try-on pilot → GA for fashion suppliers
- Expansion pilots (\`scripts/expansion-*\`, C-suite tooling)

## Long-term / strategic (.cursorrules lens)

1. **+10% LTV metric** on each feature — repurchase crons, review nudges, wishlist alerts already wired
2. **Founder automation** — cron-heavy ops (reconcile, onboarding, supplier reports)
3. **Amazon/Shopify parity** — InstantScan (photo → listing), Smart Margin (pricing intelligence), custom domains (Shopify-like storefronts)

## Explicit non-goals (current)

- Multi-product orders (by design)
- Including medusa-backend in primary deploy path
- Live financial advice from AI (disclaimer-bound heuristics only)

## Documentation debt

- Add \`CHANGELOG.md\` at repo root (currently absent)
- Align README middleware → proxy.ts naming
- Consolidate audit docs regeneration via \`npm run audit:package\`
`
  )
}

function writeAuditIndex(stats) {
  const pkg = stats.pkg
  const deps = Object.entries(pkg.dependencies || {})
    .slice(0, 25)
    .map(([k, v]) => `- \`${k}\`: ${v}`)
    .join("\n")

  writeFileSync(
    join(STAGE, "AUDIT_INDEX.md"),
    `# Affisell — Audit Index

> Generated: ${stats.generatedAt}  
> Package: \`Affisell_Audit_Package.zip\`  
> Purpose: Senior IA architecture & security audit (no secrets included)

---

## Metrics

| Item | Count |
|------|------:|
| API Routes (\`app/api/**/route.ts\`) | ${stats.apiRoutes} |
| Pages (\`app/**/page.tsx\`) | ${stats.pages} |
| React components (\`components/**/*.tsx\`) | ${stats.components} |
| lib TypeScript files | ${stats.libFiles} |
| Hooks | ${stats.hooks} |
| Prisma models | ${stats.models.length} |
| DB tables (≈ models) | ${stats.models.length} |
| Public assets (images/icons/manifest) | ${stats.publicAssets} |

---

## Project tree (top-level)

\`\`\`
affisell-market/
${stats.tree}
\`\`\`

---

## Technologies

| Layer | Choice |
|-------|--------|
| Framework | Next.js ${pkg.dependencies?.next ?? "?"} (App Router, standalone) |
| Language | TypeScript ${pkg.devDependencies?.typescript ?? "5.x"} strict |
| UI | React ${pkg.dependencies?.react ?? "19"}, Tailwind 4, shadcn, Radix/Base UI |
| ORM | Prisma ${pkg.dependencies?.prisma ?? "6.x"} + PostgreSQL |
| Auth | NextAuth ${pkg.dependencies?.["next-auth"] ?? "5 beta"} |
| Payments | Stripe ${pkg.dependencies?.stripe ?? "22.x"}, PayPal (optional) |
| Email | Resend + React Email |
| Cache | Upstash Redis |
| AI | OpenAI, Groq, Google GenAI, Vercel AI SDK |
| i18n | next-intl (8 locales) |
| Deploy | Vercel, Sentry optional |
| Testing | Vitest, Playwright |

---

## Main dependencies

${deps}

*(See \`package.json\` for full list — ${Object.keys(pkg.dependencies || {}).length} prod + ${Object.keys(pkg.devDependencies || {}).length} dev)*

---

## Existing features (production-ready signals)

- Full marketplace: supplier catalog → affiliate listings → buyer checkout
- Stripe Connect payouts + reconciliation crons
- Custom storefront domains + Brand Studio theming
- Wizard v2 + InstantScan + Smart Margin AI (Cortex Phase 1)
- Legal CMS + acceptance gate + multi-locale documents
- Demo Lab, web push, wishlist price alerts, booking/auctions
- Supplier trust tiers, returns, DAC7 export, agent missions

---

## Incomplete / fixture-based features

- Smart Margin live market scrapers (fixtures/heuristics only)
- Video Pro paywall (founder pause — unlimited test mode)
- Legal Gate v2 (off by default)
- Try-on pilot scope
- Medusa backend sync (parallel stack, excluded from package)

---

## TODO / FIXME detected

| Marker | Count (app, lib, components, scripts) |
|--------|----------------------------------------:|
| TODO | ${stats.todoCount} |
| FIXME | ${stats.fixmeCount} |

${stats.todoSamples.length ? "**Sample TODO lines:**\n" + stats.todoSamples.map((s) => `- \`${s}\``).join("\n") : "No explicit TODO/FIXME comments found in primary source trees."}

See \`docs/TECH_DEBT.md\` for \`@deprecated\` inventory.

---

## Audit documentation map

| File | Topic |
|------|-------|
| \`docs/PROJECT_OVERVIEW.md\` | Mission, personas, stack |
| \`docs/ARCHITECTURE.md\` | Layers, routing, async |
| \`docs/FEATURES.md\` | Feature catalog by persona |
| \`docs/DATABASE.md\` | Prisma models & groups |
| \`docs/API_OVERVIEW.md\` | REST/cron/webhook map |
| \`docs/ROLE_SYSTEM.md\` | Auth & authorization |
| \`docs/PAYMENT_SYSTEM.md\` | Stripe, fees, VAT |
| \`docs/MARKETPLACE_FLOW.md\` | Commerce lifecycle |
| \`docs/AI_FEATURES.md\` | InstantScan, Smart Margin |
| \`docs/LEGAL_FOUNDATION_STATUS.md\` | Compliance artifacts |
| \`docs/KNOWN_LIMITATIONS.md\` | Constraints & risks |
| \`docs/TECH_DEBT.md\` | Debt register |
| \`docs/ROADMAP.md\` | Inferred roadmap |

---

## Security checklist (pre-zip)

- [x] No \`.env\`, \`.env.local\`, \`.env.production\` included
- [x] \`.env.example\` only (empty placeholders)
- [x] \`node_modules/\`, \`.next/\`, \`medusa-backend/\` excluded
- [x] Secret pattern scan on staging (${stats.secretHits.length} hits)
- [ ] Production build verified separately: run \`npm run build\` on source repo

---

## How to use this package

1. Start with \`AUDIT_INDEX.md\` (this file) + \`docs/PROJECT_OVERVIEW.md\`
2. Read \`prisma/schema.prisma\` for data model
3. Trace \`proxy.ts\` for request routing
4. Sample API routes under \`app/api/cron/\`, \`app/api/checkout/\`, \`app/api/ai/\`
5. Cross-check \`.cursorrules\` and \`AGENTS.md\` for team conventions

*End of audit index.*
`
  )
}

function countTodoFixme() {
  let todo = 0
  let fixme = 0
  const samples = []
  for (const dir of ["app", "lib", "components", "scripts"]) {
    const base = join(ROOT, dir)
    if (!existsSync(base)) continue
    for (const f of walkFiles(base)) {
      if (!/\.(ts|tsx|md)$/.test(f)) continue
      const lines = readFileSync(f, "utf8").split("\n")
      lines.forEach((line, i) => {
        if (/\bTODO\b/.test(line)) {
          todo++
          if (samples.length < 15) samples.push(`${relative(ROOT, f)}:${i + 1}`)
        }
        if (/\bFIXME\b/.test(line)) fixme++
      })
    }
  }
  return { todo, fixme, samples }
}

function createZip() {
  rmSync(ZIP_OUT, { force: true })
  const folderName = "Affisell_Audit_Package"
  const renamed = join(ROOT, folderName)
  rmSync(renamed, { recursive: true, force: true })
  cpSync(STAGE, renamed, { recursive: true })
  try {
    execSync(`zip -r "${ZIP_OUT}" "${folderName}" -x "**/.DS_Store"`, {
      cwd: ROOT,
      stdio: "inherit",
    })
  } finally {
    rmSync(renamed, { recursive: true, force: true })
  }
  execSync(`unzip -t "${ZIP_OUT}"`, { cwd: ROOT, stdio: "inherit" })
}

function main() {
  console.log("[audit-package] collecting stats…")
  const pkg = readPkg()
  const models = prismaModels()
  const { todo, fixme, samples } = countTodoFixme()
  const stats = {
    generatedAt: new Date().toISOString().slice(0, 10),
    apiRoutes: countGlob(join(ROOT, "app/api"), "-name route.ts"),
    pages: countGlob(join(ROOT, "app"), "-name page.tsx"),
    components: countGlob(join(ROOT, "components"), "-name '*.tsx'"),
    libFiles: countGlob(join(ROOT, "lib"), "-name '*.ts'"),
    hooks: countGlob(join(ROOT, "hooks"), "-type f"),
    publicAssets: countGlob(
      join(ROOT, "public"),
      "-type f \\( -name '*.png' -o -name '*.svg' -o -name '*.ico' -o -name '*.webp' -o -name '*.json' -o -name '*.webmanifest' \\)"
    ),
    models,
    apiGroups: listApiGroups(),
    pkg,
    tree: treeLines(ROOT).join("\n"),
    deprecated: findDeprecated(),
    todoCount: todo,
    fixmeCount: fixme,
    todoSamples: samples,
    secretHits: [],
  }

  console.log("[audit-package] copying source to staging…")
  copyToStage()

  console.log("[audit-package] generating documentation…")
  writeDocs(stats)
  stats.secretHits = scanSecretsInStage()
  writeAuditIndex(stats)

  if (stats.secretHits.length > 0) {
    console.error("[audit-package] SECRET SCAN FAILED:")
    for (const h of stats.secretHits) {
      console.error(`  ${h.kind}: ${h.file}`)
    }
    process.exit(1)
  }
  console.log("[audit-package] secret scan: OK (0 hits)")

  console.log("[audit-package] creating zip…")
  createZip()

  const size = execSync(`du -h "${ZIP_OUT}" | cut -f1`, { encoding: "utf8" }).trim()
  console.log(`[audit-package] ✓ ${ZIP_OUT} (${size})`)
  rmSync(STAGE, { recursive: true, force: true })
}

main()
