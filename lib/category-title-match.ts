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
  "voiture",
  "voitures",
  "vehicule",
  "vehicules",
  "auto",
  "car",
  "vehicle",
  "vehicles",
])

/** When title is a camera product, "voiture" alone must not dominate unrelated leaves. */
const VEHICLE_CONTEXT_WEAK = new Set(["voiture", "voitures", "vehicule", "vehicules", "auto", "car"])

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
  {
    id: "vehicle_camera",
    match:
      /\b(dash\s*cam|dashcam|cam[eé]ra\s+(de\s+)?voiture|camera\s+(de\s+)?voiture|car\s*camera|dvr\s+auto|enregistreur\s+(de\s+)?conduite|triple\s*cam|3\s*canaux|double\s*cam[eé]ra|backup\s*cam|road\s*cam|redtiger|gopro\s+max|front\s*and\s*rear\s*cam)\b/i,
    boost: [
      /cam[eé]ras?\s+de\s+recul/i,
      /electronique\s+pour\s+vehicules/i,
      /cam[eé]ras?\s+video/i,
      /cam[eé]ras?\s+de\s+surveillance/i,
      /appareils\s+photo.*cam[eé]ras/i,
      /cam[eé]ras?\s+embarqu/i,
    ],
    penalize: [
      /animaux/i,
      /animaux de compagnie/i,
      /grille de separation/i,
      /guides?\s+d['']utilisation/i,
      /cabanes.*voiture/i,
      /auvents/i,
      /garages/i,
      /pelouses/i,
      /maison et jardin/i,
      /\bmedias\b/i,
      /jouets/i,
      /vehicules de jeu/i,
    ],
  },
  {
    id: "camera",
    match:
      /\b(cam[eé]ra|camera|webcam|gopro|action\s*cam|mirrorless|reflex|appareil\s+photo\s+num|photographie)\b/i,
    boost: [
      /appareils\s+photo.*cam[eé]ras/i,
      /cam[eé]ras?\s+video/i,
      /cam[eé]ras?\s+de\s+surveillance/i,
      /appareils\s+photo\s+num/i,
    ],
    penalize: [/animaux/i, /guides?\s+d['']utilisation/i, /grille de separation/i, /connecteur/i],
  },
  {
    id: "cookware",
    match:
      /\b(frying\s*pan|skillet|wok|saucepan|cookware|bakeware|marmite|casserole|poele|sauteuse|batterie\s+de\s+cuisine|ustensiles?\s+de\s+cuisine)\b/i,
    boost: [/cookware/i, /bakeware/i, /kitchen/i, /cuisine/i, /ustensiles?/i],
    penalize: [/headphones?/i, /audio/i, /connecteur/i, /telephones?\s+mobiles?/i],
  },
]

const PHRASE_BOOSTS: Array<{ phrase: RegExp; breadcrumb: RegExp; points: number }> = [
  { phrase: /montre\s+connect/i, breadcrumb: /moniteurs?\s+d['']activit/i, points: 18 },
  { phrase: /bracelet\s+connect/i, breadcrumb: /moniteurs?\s+d['']activit/i, points: 18 },
  { phrase: /smart\s*band|mi\s*band/i, breadcrumb: /moniteurs?\s+d['']activit/i, points: 20 },
  { phrase: /sommeil|sleep/i, breadcrumb: /moniteurs?\s+d['']activit/i, points: 4 },
  { phrase: /sommeil|sleep/i, breadcrumb: /aides?\s+au\s+sommeil|bruit\s+blanc/i, points: -25 },
  { phrase: /frying\s*pan|skillet|wok/i, breadcrumb: /cookware|bakeware/i, points: 22 },
  { phrase: /frying\s*pan|skillet/i, breadcrumb: /home\s*&\s*kitchen|kitchen/i, points: 8 },
  {
    phrase: /cam[eé]ra\s+(de\s+)?voiture|dash\s*cam|dashcam|3\s*canaux/i,
    breadcrumb: /cam[eé]ras?\s+de\s+recul/i,
    points: 32,
  },
  {
    phrase: /cam[eé]ra\s+(de\s+)?voiture|dash\s*cam|dashcam/i,
    breadcrumb: /electronique\s+pour\s+vehicules/i,
    points: 14,
  },
  {
    phrase: /cam[eé]ra\s+(de\s+)?voiture|dash\s*cam|dashcam/i,
    breadcrumb: /animaux|grille de separation|guides?\s+d['']utilisation|cabanes|auvents|pelouses/i,
    points: -45,
  },
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

/** Leaf paths that match the detected product intent (for AI catalog priming). */
export function leafPathsForDetectedIntent(
  title: string,
  description: string,
  leafPaths: LeafPath[],
  limit = 16
): LeafPath[] {
  const text = `${title} ${description}`.trim()
  if (text.length < 2) return []
  const intent = activeIntentForText(normalizeText(text))
  if (!intent) return []

  const scored = leafPaths
    .map((lp) => {
      const b = normalizeText(lp.breadcrumb)
      let s = 0
      for (const rx of intent.boost) if (rx.test(b)) s += 10
      for (const rx of intent.penalize) if (rx.test(b)) s -= 20
      return { lp, s }
    })
    .filter(({ s }) => s > 0)
    .sort((a, b) => b.s - a.s)

  const out: LeafPath[] = []
  const seen = new Set<string>()
  for (const { lp } of scored) {
    if (out.length >= limit) break
    if (seen.has(lp.leafId)) continue
    seen.add(lp.leafId)
    out.push(lp)
  }
  return out
}

export function isWearableProductText(title: string, description = ""): boolean {
  const text = `${title} ${description}`.trim()
  if (text.length < 2) return false
  return activeIntentForText(normalizeText(text))?.id === "activity_tracker"
}

/** Secondary picks when marketing says "montre" but Google expects activity monitors. */
const WEARABLE_ALTERNATIVE_LEAVES: Array<{
  breadcrumb: RegExp
  reason: string
}> = [
  {
    breadcrumb: /^vetements et accessoires\s*>\s*bijoux\s*>\s*montres$/i,
    reason:
      "Autre interprétation : montre classique (bijouterie). Déconseillé pour bracelets connectés et smart bands.",
  },
]

export type CategoryAlternativeSuggestion = LeafPath & { reason: string }

export function findWearableCategoryAlternatives(
  title: string,
  description: string,
  leafPaths: LeafPath[],
  primarySuggestions: LeafPath[]
): CategoryAlternativeSuggestion[] {
  if (!isWearableProductText(title, description)) return []

  const primaryHasActivity = primarySuggestions.some((lp) =>
    /moniteurs?\s+d['']activit/i.test(lp.breadcrumb)
  )
  if (primarySuggestions.length > 0 && !primaryHasActivity) return []

  const exclude = new Set(primarySuggestions.map((p) => p.leafId))
  const out: CategoryAlternativeSuggestion[] = []

  for (const alt of WEARABLE_ALTERNATIVE_LEAVES) {
    const lp = leafPaths.find((p) => {
      if (exclude.has(p.leafId)) return false
      return alt.breadcrumb.test(normalizeText(p.breadcrumb))
    })
    if (lp) out.push({ ...lp, reason: alt.reason })
  }

  return out
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
      if (intent?.id === "vehicle_camera" && VEHICLE_CONTEXT_WEAK.has(w)) {
        const cameraCtx = /camera|dash|dvr|canal|canaux|4k|1080|enregistr|recul|surveillance|video/i
        if (b.includes(w) && !cameraCtx.test(b)) score += 0.15
        continue
      }
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
