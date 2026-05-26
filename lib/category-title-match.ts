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
  "play",
  "vehicle",
  "vehicles",
  "fil",
  "sans",
])

/** Short tokens must match whole breadcrumb words — avoids "car" inside "carte" / "carplay" noise. */
const SHORT_TOKEN_MAX_LEN = 4

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
    id: "car_infotainment",
    match:
      /\b(car\s*play|carplay|android\s*auto|mirrorlink|apple\s*play|adaptateur\s+(auto|vehicule|voiture)|autoradio|poste\s+radio|ecran\s+(auto|vehicule|voiture)|kit\s+multimedia\s+auto|systeme\s+multimedia|lecteur\s+multimedia\s+auto|interface\s+multimedia|boitier\s+carplay|module\s+carplay|sans\s+fil\s+pour\s+(auto|voiture)|wireless\s+carplay)\b/i,
    boost: [
      /electronique\s+pour\s+vehicules/i,
      /lecteurs.*audio.*video.*integres/i,
      /mains.?libres.*vehicules/i,
      /systemes?\s+de\s+navigation\s+gps/i,
      /accessoires\s+pour\s+gps/i,
      /haut.?parleurs?\s+pour\s+vehicules/i,
      /amplificateurs?\s+pour\s+vehicules/i,
    ],
    penalize: [
      /cartes?\s+prepayees?/i,
      /cartes?\s+sim/i,
      /telephonie/i,
      /telephones?\s+mobiles?/i,
      /deverrouill/i,
      /forfaits?\s+mobiles?/i,
      /recharge\s+de\s+cartes?/i,
    ],
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
  {
    id: "portable_fan",
    match:
      /\b(ventilateur|ventilateurs|brumisateur|brumisateurs|refroidisseur\s*portable|air\s*cooler|climatiseur\s*portable|fan\s*usb|mini\s*fan|handheld\s*fan)\b/i,
    boost: [
      /ventilateurs?\s+portables?/i,
      /ventilateurs?\s+de\s+table/i,
      /ventilateurs?\s+muraux/i,
      /ventilateurs?/i,
      /brumisateurs?/i,
      /climatisation/i,
      /chauffage\s+et\s+climatisation/i,
    ],
    penalize: [
      /velo/i,
      /cyclisme/i,
      /vitesses?\s+de\s+velo/i,
      /transmission/i,
      /equipements?\s+sportifs/i,
      /football/i,
      /securite\s+a\s+domicile/i,
      /lampes?\s+de\s+securite/i,
      /surveillance/i,
      /enregistrement/i,
      /sport/i,
      /pieces?\s+detachees/i,
    ],
  },
  {
    id: "power_bank",
    match: /\b(power\s*bank|batterie\s+externe|chargeur\s+portable|bank\s*\d+\s*mah|\d+\s*mah)\b/i,
    boost: [/batteries?\s+externes?/i, /chargeurs?\s+portables?/i, /batteries?\s+pour\s+telephones?/i],
    penalize: [/velo/i, /cyclisme/i, /surveillance/i, /securite/i, /football/i],
  },
  {
    id: "furniture_storage",
    match:
      /\b(commode|armoire|etagere|étagère|meuble\s+de\s+rangement|buffet|placard|dressing|nightstand|chevet)\b/i,
    boost: [/meubles?/i, /rangement/i, /commodes?/i, /armoires?/i, /etageres?/i, /mobilier/i],
    penalize: [/velo/i, /sport/i, /electronique/i, /telephonie/i],
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
  {
    phrase: /car\s*play|carplay|android\s*auto/i,
    breadcrumb: /lecteurs.*audio.*video.*integres|electronique\s+pour\s+vehicules/i,
    points: 36,
  },
  {
    phrase: /car\s*play|carplay|android\s*auto|adaptateur.*(?:auto|voiture|vehicule)/i,
    breadcrumb: /cartes?\s+prepayees?|cartes?\s+sim|forfaits?\s+mobiles?/i,
    points: -50,
  },
  {
    phrase: /ventilateur\s+portable|mini\s*fan|handheld\s*fan/i,
    breadcrumb: /ventilateurs?\s+portables?|brumisateurs?/i,
    points: 42,
  },
  {
    phrase: /ventilateur|brumisateur/i,
    breadcrumb: /ventilateurs?|climatisation|chauffage\s+et\s+climatisation/i,
    points: 28,
  },
  {
    phrase: /ventilateur|brumisateur/i,
    breadcrumb: /velo|cyclisme|vitesses?.*velo|securite|surveillance|football|sport/i,
    points: -55,
  },
  {
    phrase: /lumiere|lampe/i,
    breadcrumb: /lampes?\s+de\s+securite|surveillance/i,
    points: -30,
  },
]

const COMPOUND_TERMS: Array<{ pattern: RegExp; token: string }> = [
  { pattern: /\bcar\s*play\b|\bcarplay\b/i, token: "carplay" },
  { pattern: /\bandroid\s*auto\b/i, token: "androidauto" },
]

function normalizeText(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
}

function frenchWordForms(word: string): string[] {
  const w = word.toLowerCase()
  const forms = new Set<string>([w])
  if (w.length >= 4 && w.endsWith("s") && !w.endsWith("ss") && !w.endsWith("us")) {
    forms.add(w.slice(0, -1))
  }
  if (w.length >= 4 && w.endsWith("x")) {
    forms.add(w.slice(0, -1))
  }
  if (w.length >= 5 && w.endsWith("eaux")) {
    forms.add(w.slice(0, -1))
  }
  return [...forms]
}

function tokenMatchesSearchWord(token: string, word: string): boolean {
  if (token === word) return true
  const tokenForms = frenchWordForms(token)
  const wordForms = frenchWordForms(word)
  for (const tf of tokenForms) {
    for (const wf of wordForms) {
      if (tf === wf) return true
      if (wf.length >= 5 && tf.length >= 5 && (tf.startsWith(wf.slice(0, 5)) || wf.startsWith(tf.slice(0, 5)))) {
        return true
      }
    }
  }
  return false
}

function breadcrumbWordTokens(breadcrumb: string): Set<string> {
  return new Set(
    normalizeText(breadcrumb)
      .split(/[^a-z0-9]+/)
      .map((w) => w.trim())
      .filter((w) => w.length >= 2)
  )
}

/** Whole-word match in breadcrumb; handles FR plurals (ventilateur ↔ ventilateurs). */
export function wordMatchesInBreadcrumb(word: string, breadcrumb: string): boolean {
  const w = word.trim().toLowerCase()
  if (w.length < 2) return false
  const tokens = breadcrumbWordTokens(breadcrumb)
  for (const token of tokens) {
    if (tokenMatchesSearchWord(token, w)) return true
  }

  if (w.length <= SHORT_TOKEN_MAX_LEN) return false

  const b = normalizeText(breadcrumb)
  let idx = 0
  while (idx < b.length) {
    const at = b.indexOf(w, idx)
    if (at < 0) break
    const before = at === 0 ? "" : b[at - 1]!
    const after = at + w.length >= b.length ? "" : b[at + w.length]!
    const isBoundary = (ch: string) => !/[a-z0-9]/.test(ch)
    if (isBoundary(before) && isBoundary(after)) return true
    idx = at + 1
  }
  return false
}

export function extractProductTitleTokens(text: string): string[] {
  const norm = normalizeText(text)
  const out: string[] = []
  const seen = new Set<string>()

  const push = (w: string) => {
    if (w.length < 3 || STOP.has(w) || seen.has(w)) return
    seen.add(w)
    out.push(w)
  }

  for (const { pattern, token } of COMPOUND_TERMS) {
    if (pattern.test(norm)) push(token)
  }

  for (const w of norm.split(/[^a-z0-9]+/)) {
    const t = w.trim()
    if (t.length < 3 || STOP.has(t)) continue
    if (t === "carplay" || t === "androidauto") {
      push(t)
      continue
    }
    if (seen.has("carplay") && (t === "car" || t === "play")) continue
    if (seen.has("androidauto") && (t === "android" || t === "auto")) continue
    push(t)
  }

  return out
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
  const words = extractProductTitleTokens(text)
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
        if (wordMatchesInBreadcrumb(w, b) && !cameraCtx.test(b)) score += 0.15
        continue
      }
      if (intent?.id === "car_infotainment" && (w === "car" || w === "auto" || w === "play")) {
        continue
      }
      /** Fan titles often mention lumière / power bank as accessories — do not drive security categories. */
      if (intent?.id === "portable_fan" && (w === "lumiere" || w === "power" || w === "bank")) {
        continue
      }
      if (wordMatchesInBreadcrumb(w, b)) score += intent ? 0.2 : 0
      continue
    }
    const lengthBonus = Math.min(w.length, 12) * 0.45
    if (wordMatchesInBreadcrumb(w, b)) {
      score += 3 + lengthBonus
    } else if (w.length >= 6) {
      const stem = w.slice(0, 5)
      if (stem.length >= 5 && wordMatchesInBreadcrumb(stem, b)) score += 0.35
    }
  }

  return score
}

const MIN_SUGGESTION_SCORE = 7

/** Drop suggestions that contradict detected product intent or score too low. */
export function isCategorySuggestionViable(
  text: string,
  breadcrumb: string,
  minScore = MIN_SUGGESTION_SCORE
): boolean {
  const score = scoreProductTextAgainstBreadcrumb(text, breadcrumb)
  if (score < minScore) return false
  const intent = activeIntentForText(normalizeText(text.trim()))
  if (!intent) return true
  const b = normalizeText(breadcrumb)
  for (const rx of intent.penalize) {
    if (rx.test(b) && score < minScore + 12) return false
  }
  return true
}

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
