import type { LeafPath } from "@/lib/category-browse"

const STOP = new Set([
  "the",
  "and",
  "for",
  "with",
  "from",
  "this",
  "that",
  "your",
  "pack",
  "set",
  "new",
  "avec",
  "pour",
  "dans",
  "des",
  "les",
  "une",
  "sur",
  "par",
  "est",
  "son",
  "ses",
  "aux",
  "plus",
  "tout",
  "sans",
  "version",
  "modele",
  "model",
  "edition",
  "nouveau",
  "nouvelle",
])

/** Tokens that often create false positives when matched as substrings in breadcrumbs. */
const WEAK_TOKENS = new Set([
  "connect",
  "connec",
  "conne",
  "connected",
  "sommeil",
  "sleep",
  "smart",
  "band",
  "pro",
  "max",
  "mini",
  "lite",
  "plus",
  "noir",
  "black",
  "white",
  "bleu",
  "red",
  "new",
])

type ProductIntent = {
  id: string
  match: RegExp
  boost: RegExp[]
  penalize: RegExp[]
}

/** Ordered: first matching intent wins. */
const PRODUCT_INTENTS: ProductIntent[] = [
  {
    id: "activity_tracker",
    match:
      /\b(smart\s*band|mi\s*band|bracelet\s*connect|montre\s*connect|fitness\s*tracker|tracker\s*d['']activit|galaxy\s*fit|amazfit|fitbit|oura|whoop|honor\s*band|xiaomi\s*(smart\s*)?band|podometre\s*connect|activity\s*tracker)\b/i,
    boost: [
      /moniteurs?\s+d['']activit/i,
      /moniteurs?\s+biometriques?/i,
      /activity\s+monitor/i,
      /accessoires\s+pour\s+moniteurs\s+d['']activit/i,
    ],
    penalize: [
      /connecteur/i,
      /composants?\s+(electroniques|informatiques)/i,
      /plaques?\s+arriere/i,
      /entree.?sortie/i,
      /generateur/i,
      /bruit\s+blanc/i,
      /circuits?\s+imprimes?/i,
      /telephones?\s+mobiles?/i,
      /bijoux\s*>\s*[^>]*montres/i,
      /montres\s+de\s+poche/i,
    ],
  },
  {
    id: "smartphone",
    match: /\b(iphone|smartphone|galaxy\s*s\d|pixel\s*\d|oneplus|redmi\s*note|telephone\s*portable)\b/i,
    boost: [/telephones?\s+mobiles?/i, /smartphones?/i, /telephones?\s+portables?/i],
    penalize: [/connecteur/i, /composant/i, /moniteurs?\s+d['']activit/i],
  },
  {
    id: "laptop",
    match: /\b(macbook|ordinateur\s*portable|laptop|chromebook|thinkpad|ultrabook)\b/i,
    boost: [/ordinateurs?\s+portables?/i, /laptops?/i],
    penalize: [/connecteur/i, /composant/i],
  },
  {
    id: "headphones",
    match: /\b(ecouteurs?|casque|airpods|earbuds|headphones)\b/i,
    boost: [/ecouteurs?/i, /casques?/i, /audio/i],
    penalize: [/connecteur/i, /composant/i],
  },
]

const PHRASE_BOOSTS: Array<{ phrase: RegExp; breadcrumb: RegExp; points: number }> = [
  { phrase: /montre\s+connect/i, breadcrumb: /moniteurs?\s+d['']activit/i, points: 18 },
  { phrase: /bracelet\s+connect/i, breadcrumb: /moniteurs?\s+d['']activit/i, points: 18 },
  { phrase: /smart\s*band|mi\s*band/i, breadcrumb: /moniteurs?\s+d['']activit/i, points: 20 },
  { phrase: /sommeil|sleep/i, breadcrumb: /moniteurs?\s+d['']activit/i, points: 4 },
  { phrase: /sommeil|sleep/i, breadcrumb: /aides?\s+au\s+sommeil|bruit\s+blanc/i, points: -25 },
]

function normalizeText(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
}

function extractWords(text: string): string[] {
  return normalizeText(text)
    .split(/[^a-z0-9]+/)
    .map((w) => w.trim())
    .filter((w) => w.length >= 3 && !STOP.has(w))
}

function activeIntentForText(normText: string): ProductIntent | null {
  for (const intent of PRODUCT_INTENTS) {
    if (intent.match.test(normText)) return intent
  }
  return null
}

/** Score how well product copy matches a taxonomy breadcrumb (higher = better). */
export function scoreProductTextAgainstBreadcrumb(text: string, breadcrumb: string): number {
  const normText = normalizeText(text)
  const b = normalizeText(breadcrumb)
  const words = extractWords(text)
  if (words.length === 0 && normText.length < 2) return 0

  let score = 0
  const intent = activeIntentForText(normText)

  if (intent) {
    for (const rx of intent.boost) {
      if (rx.test(b)) score += 28
    }
    for (const rx of intent.penalize) {
      if (rx.test(b)) score -= 35
    }
  }

  for (const { phrase, breadcrumb: bRx, points } of PHRASE_BOOSTS) {
    if (phrase.test(normText) && bRx.test(b)) score += points
  }

  for (const w of words) {
    if (WEAK_TOKENS.has(w)) {
      if (b.includes(w)) score += intent ? 0.2 : 0
      continue
    }
    const lengthBonus = Math.min(w.length, 12) * 0.45
    if (b.includes(w)) {
      score += 3 + lengthBonus
    } else if (w.length >= 6) {
      const stem = w.slice(0, 5)
      if (stem.length >= 5 && b.includes(stem)) score += 0.35
    }
  }

  return score
}

const MIN_SUGGESTION_SCORE = 7

/**
 * Suggest leaf categories from title + description using intent-aware scoring.
 * Returns nothing when confidence is too low (no arbitrary filler categories).
 */
export function suggestLeafCategoriesFromProductText(
  title: string,
  description: string,
  leafPaths: LeafPath[],
  limit = 3
): LeafPath[] {
  const text = `${title} ${description}`.trim()
  if (text.length < 2) return []

  const scored = leafPaths
    .map((lp) => ({
      lp,
      s: scoreProductTextAgainstBreadcrumb(text, lp.breadcrumb),
    }))
    .filter(({ s }) => s >= MIN_SUGGESTION_SCORE)
    .sort((a, b) => b.s - a.s)

  if (scored.length === 0) return []

  const top = scored[0]!.s
  const relativeFloor = top * 0.5

  const picked: LeafPath[] = []
  const seen = new Set<string>()
  for (const { lp, s } of scored) {
    if (picked.length >= limit) break
    if (picked.length > 0 && s < relativeFloor) break
    if (seen.has(lp.leafId)) continue
    seen.add(lp.leafId)
    picked.push(lp)
  }

  return picked
}
