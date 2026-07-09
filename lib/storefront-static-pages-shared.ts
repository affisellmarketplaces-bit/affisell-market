/** Per-store static pages — safe for `"use client"` (no Prisma). */

export const STOREFRONT_STATIC_PAGE_KINDS = ["about", "faq", "returns"] as const
export type StorefrontStaticPageKind = (typeof STOREFRONT_STATIC_PAGE_KINDS)[number]

export type StorefrontFaqItem = {
  question: string
  answer: string
}

export type StorefrontStaticPage = {
  enabled: boolean
  title?: string
  body?: string
  faqItems?: StorefrontFaqItem[]
}

export type StorefrontStaticPages = Record<StorefrontStaticPageKind, StorefrontStaticPage>

export const DEFAULT_STATIC_PAGES: StorefrontStaticPages = {
  about: { enabled: false },
  faq: { enabled: false },
  returns: { enabled: false },
}

const MAX_TITLE = 120
const MAX_BODY = 4000
const MAX_FAQ_ITEMS = 12
const MAX_FAQ_FIELD = 600

function trimOptional(raw: unknown, max: number): string | undefined {
  if (typeof raw !== "string") return undefined
  const t = raw.trim()
  if (!t) return undefined
  return t.slice(0, max)
}

function parseFaqItems(raw: unknown): StorefrontFaqItem[] | undefined {
  if (!Array.isArray(raw)) return undefined
  const out: StorefrontFaqItem[] = []
  for (const row of raw) {
    if (!row || typeof row !== "object") continue
    const o = row as Record<string, unknown>
    const question = trimOptional(o.question, MAX_FAQ_FIELD)
    const answer = trimOptional(o.answer, MAX_FAQ_FIELD)
    if (!question || !answer) continue
    out.push({ question, answer })
    if (out.length >= MAX_FAQ_ITEMS) break
  }
  return out.length > 0 ? out : undefined
}

function parsePage(raw: unknown, fallbackEnabled: boolean): StorefrontStaticPage {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { enabled: fallbackEnabled }
  }
  const o = raw as Record<string, unknown>
  return {
    enabled: typeof o.enabled === "boolean" ? o.enabled : fallbackEnabled,
    title: trimOptional(o.title, MAX_TITLE),
    body: trimOptional(o.body, MAX_BODY),
    faqItems: parseFaqItems(o.faqItems),
  }
}

export function parseStaticPages(raw: unknown): StorefrontStaticPages {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {
      about: { ...DEFAULT_STATIC_PAGES.about },
      faq: { ...DEFAULT_STATIC_PAGES.faq },
      returns: { ...DEFAULT_STATIC_PAGES.returns },
    }
  }
  const o = raw as Record<string, unknown>
  return {
    about: parsePage(o.about, false),
    faq: parsePage(o.faq, false),
    returns: parsePage(o.returns, false),
  }
}

export function parseStaticPagesFromTheme(raw: unknown): StorefrontStaticPages {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return parseStaticPages(undefined)
  }
  const o = raw as Record<string, unknown>
  return parseStaticPages(o.staticPages)
}

export function getEnabledStaticPages(
  pages: StorefrontStaticPages | undefined | null
): StorefrontStaticPageKind[] {
  const resolved = pages ?? DEFAULT_STATIC_PAGES
  return STOREFRONT_STATIC_PAGE_KINDS.filter((kind) => resolved[kind]?.enabled)
}

export function serializeStaticPages(pages: StorefrontStaticPages): string {
  return JSON.stringify(pages)
}

export function staticPagesEqual(a: StorefrontStaticPages, b: StorefrontStaticPages): boolean {
  return serializeStaticPages(a) === serializeStaticPages(b)
}

export function updateStaticPage(
  pages: StorefrontStaticPages,
  kind: StorefrontStaticPageKind,
  patch: Partial<StorefrontStaticPage>
): StorefrontStaticPages {
  return {
    ...pages,
    [kind]: {
      ...pages[kind],
      ...patch,
      faqItems: patch.faqItems ?? pages[kind].faqItems,
    },
  }
}

export function buildDefaultStaticPages(args: {
  storeName: string
  description?: string
}): StorefrontStaticPages {
  const name = args.storeName.trim() || "My Store"
  const body = args.description?.trim() || `${name} — curated products from your favorite creator.`
  return {
    about: {
      enabled: true,
      title: `About ${name}`,
      body,
    },
    faq: {
      enabled: true,
      title: "FAQ",
      faqItems: [
        {
          question: "Who ships my order?",
          answer:
            "Orders are fulfilled by the product supplier. Your creator partner curates the catalog — Affisell handles secure checkout.",
        },
        {
          question: "How do returns work?",
          answer:
            "EU buyers have 14 days to return eligible items. See our Returns page for store-specific details.",
        },
      ],
    },
    returns: {
      enabled: true,
      title: "Returns & refunds",
      body:
        "You have 14 days after delivery to request a return on eligible items (EU consumer law). Contact support with your order number — we coordinate with the supplier. Refunds are processed to your original payment method once the return is accepted.",
    },
  }
}

export function hasMeaningfulStaticPages(pages: StorefrontStaticPages): boolean {
  return STOREFRONT_STATIC_PAGE_KINDS.some((kind) => {
    const page = pages[kind]
    if (!page?.enabled) return false
    if ((page.title ?? "").trim()) return true
    if ((page.body ?? "").trim()) return true
    return (page.faqItems ?? []).some(
      (item) => item.question.trim().length > 0 || item.answer.trim().length > 0
    )
  })
}
