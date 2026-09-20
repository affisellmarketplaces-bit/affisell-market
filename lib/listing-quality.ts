/**
 * Listing quality — pure, client-safe. The difference between a supplier feed pasted as-is and a storefront a
 * buyer trusts: short factual titles, no keyword stuffing, no decorations, believable prices.
 * Nothing here invents information: it only removes noise from, and grades, what the supplier provided.
 */

const EMOJI_RE = /[\p{Extended_Pictographic}\u{FE0F}\u{200D}]/gu
const DECORATION_RE = /[★☆✔✓✅❤♥♦◆◇■□▲△●○※◎☀☎✈✿❀❁➤➜»«]+/g
/** 【…】 / 「…」 / 〔…〕 / [ … ] tags at the very start or end of a title: "【2024 New】", "[Demo Lab]". */
const EDGE_TAG_RE = /^(?:\s*[【\[〔「『(][^】\]〕」』)]{0,40}[】\]〕」』)]\s*)+|(?:\s*[【\[〔「『(][^】\]〕」』)]{0,40}[】\]〕」』)]\s*)+$/gu
const DELIMITER_RE = /\s[-–—|]\s|\s:\s|:\s/
/** Words a title must not end on once it has been cut. */
const DANGLING = new Set([
  "avec", "pour", "et", "de", "du", "des", "la", "le", "les", "un", "une", "en", "à", "au", "aux", "sur", "par", "ou",
  "with", "for", "and", "the", "of", "in", "on", "a", "an", "to", "mit", "für", "und", "con", "per", "y", "para",
])

/** Comfortable single-line card title; longer supplier titles are cut at a natural boundary. */
export const TITLE_SOFT_MAX = 64
export const TITLE_HARD_MAX = 80

function collapse(s: string): string {
  return s.replace(/\s+/g, " ").trim()
}

function isShoutingCase(s: string): boolean {
  const letters = s.replace(/[^\p{L}]/gu, "")
  if (letters.length < 12) return false
  const upper = letters.replace(/[^\p{Lu}]/gu, "").length
  return upper / letters.length > 0.6
}

/** ALL CAPS → sentence case, keeping short acronyms / model codes (≤4 letters or containing digits) as written. */
function unshout(s: string): string {
  return s
    .split(" ")
    .map((w, i) => {
      if (/\d/.test(w) || w.replace(/[^\p{L}]/gu, "").length <= 4) return w
      const lower = w.toLowerCase()
      return i === 0 ? lower.charAt(0).toUpperCase() + lower.slice(1) : lower
    })
    .join(" ")
}

function trimDangling(s: string): string {
  const words = s.split(" ")
  while (words.length > 3 && DANGLING.has(words[words.length - 1]!.toLowerCase().replace(/[.,;:]+$/, ""))) words.pop()
  return words.join(" ").replace(/[\s,;:–—|-]+$/u, "")
}

/**
 * Buyer-facing title: no emoji / decorations / edge tags, no SHOUTING, and — when long — cut at the first natural
 * boundary (" - ", " : ", " | ") that leaves a real product name, else at a word boundary. Never returns "".
 */
export function cleanListingTitle(
  raw: string | null | undefined,
  opts?: { softMax?: number; hardMax?: number; /** Only strip noise (emoji, decorations, edge tags, SHOUTING) — never shorten. */ light?: boolean }
): string {
  const original = collapse(String(raw ?? ""))
  if (!original) return ""
  const softMax = opts?.softMax ?? TITLE_SOFT_MAX
  const hardMax = opts?.hardMax ?? TITLE_HARD_MAX

  let s = original.normalize("NFKC").replace(EMOJI_RE, " ").replace(DECORATION_RE, " ")
  s = collapse(s.replace(EDGE_TAG_RE, " ")).replace(/^[\s,;:–—|-]+|[\s,;:–—|-]+$/gu, "")
  if (!s) return original
  if (isShoutingCase(s)) s = unshout(s)

  if (opts?.light) return s || original

  if (s.length > softMax) {
    const parts = s.split(DELIMITER_RE)
    const head = collapse(parts[0] ?? "")
    if (parts.length > 1 && head.length >= 12 && head.split(" ").length >= 2) {
      s = head
      // A bare "Brand Model" head loses the product type: keep the first clause of the next segment when it fits.
      if (head.split(" ").length <= 3) {
        const clause = collapse((parts[1] ?? "").split(/[,;]/)[0] ?? "")
        if (clause && head.length + 3 + clause.length <= softMax) s = `${head} – ${clause}`
      }
    }
  }
  if (s.length > hardMax) {
    let cut = s.slice(0, hardMax)
    const lastSpace = cut.lastIndexOf(" ")
    if (lastSpace > hardMax * 0.6) cut = cut.slice(0, lastSpace)
    s = trimDangling(collapse(cut))
  }
  s = trimDangling(s)
  return s || original
}

export type TitleIssue = "too_short" | "too_long" | "shouting" | "decorations" | "keyword_stuffing"

/** Repeated content words or long comma/dash-separated feature lists = keyword stuffing. */
function looksStuffed(s: string): boolean {
  const segments = s.split(/[,;|]|\s[-–—]\s/).filter((x) => x.trim().length > 0)
  if (segments.length >= 4) return true
  const words = s.toLowerCase().match(/[\p{L}\p{N}]{4,}/gu) ?? []
  const seen = new Map<string, number>()
  for (const w of words) seen.set(w, (seen.get(w) ?? 0) + 1)
  return [...seen.values()].some((n) => n >= 3)
}

export function assessTitle(raw: string | null | undefined): { issues: TitleIssue[]; suggestion: string; ok: boolean } {
  const title = collapse(String(raw ?? ""))
  const issues: TitleIssue[] = []
  if (title.length < 8) issues.push("too_short")
  if (title.length > TITLE_HARD_MAX) issues.push("too_long")
  if (isShoutingCase(title)) issues.push("shouting")
  if (EMOJI_RE.test(title) || DECORATION_RE.test(title) || new RegExp(EDGE_TAG_RE.source, "u").test(title)) issues.push("decorations")
  EMOJI_RE.lastIndex = 0
  DECORATION_RE.lastIndex = 0
  if (looksStuffed(title)) issues.push("keyword_stuffing")
  return { issues, suggestion: cleanListingTitle(title), ok: issues.length === 0 }
}

/**
 * Believable retail price: ends in a deliberate figure (…,90 / …,99 / …,00 for round luxury-style) instead of a formula
 * residue like 412,34 €. Rounds to the NEAREST such price and never moves a price by more than ~3.5%.
 */
export function psychologicalPriceCents(cents: number): number {
  const c = Math.max(0, Math.round(cents))
  if (c < 200) return c
  const euros = Math.floor(c / 100)
  const candidates =
    c >= 10000
      ? [euros * 100 - 1, euros * 100 + 99, Math.round(euros / 5) * 500 - 1, Math.round(c / 1000) * 1000 - 100]
      : [euros * 100 - 10, euros * 100 + 90, euros * 100 + 99, euros * 100 - 1]
  let best = c
  let bestDist = Infinity
  for (const cand of candidates) {
    if (cand <= 0) continue
    const dist = Math.abs(cand - c)
    if (dist <= c * 0.035 && dist < bestDist) {
      best = cand
      bestDist = dist
    }
  }
  return best
}

export function isFormulaResiduePrice(cents: number): boolean {
  if (cents < 200) return false
  const cent = cents % 100
  return ![0, 90, 99, 95, 50, 49, 89, 79, 29, 9].includes(cent)
}

export type QualityCheckId =
  | "title"
  | "description"
  | "photos"
  | "price"
  | "brand"
  | "warranty"
  | "origin"
  | "delivery"

export type QualityCheck = { id: QualityCheckId; ok: boolean; weight: number }

export type ListingQualityInput = {
  title: string
  description?: string | null
  imageCount: number
  priceCents?: number | null
  brand?: string | null
  hasWarranty?: boolean
  shipsFromCountry?: string | null
  hasDeliveryProfile?: boolean
}

/**
 * 0–100 (weights are renormalised over the checks that apply — the price check is skipped when no buyer price
 * is known, e.g. on the supplier's wholesale form). "excellent" ≥ 80, "good" ≥ 55, otherwise "needs_work".
 */
export function assessListingQuality(input: ListingQualityInput): {
  score: number
  tier: "excellent" | "good" | "needs_work"
  checks: QualityCheck[]
} {
  const titleOk = assessTitle(input.title).ok
  const descLen = collapse(input.description ?? "").length
  const checks: QualityCheck[] = [
    { id: "title", ok: titleOk, weight: 20 },
    { id: "description", ok: descLen >= 120, weight: 15 },
    { id: "photos", ok: input.imageCount >= 3, weight: 20 },
    ...(input.priceCents != null
      ? [{ id: "price" as const, ok: !isFormulaResiduePrice(input.priceCents), weight: 8 }]
      : []),
    { id: "brand", ok: Boolean(input.brand?.trim()), weight: 10 },
    { id: "warranty", ok: input.hasWarranty === true, weight: 9 },
    { id: "origin", ok: Boolean(input.shipsFromCountry?.trim()), weight: 8 },
    { id: "delivery", ok: input.hasDeliveryProfile === true, weight: 10 },
  ]
  const total = checks.reduce((n, c) => n + c.weight, 0)
  const score = Math.round((checks.reduce((n, c) => n + (c.ok ? c.weight : 0), 0) / total) * 100)
  return { score, tier: score >= 80 ? "excellent" : score >= 55 ? "good" : "needs_work", checks }
}
