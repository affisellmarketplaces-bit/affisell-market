/**
 * Key product benefits shown as icon chips ("Écran AMOLED", "Autonomie 14 j", …).
 * Pure and client-safe: derives up to N short, deduplicated highlights from the supplier's bullet points
 * (and, as a fallback, the spec table), with an icon inferred from multilingual keywords.
 */

export type HighlightIcon =
  | "screen"
  | "health"
  | "sport"
  | "battery"
  | "water"
  | "camera"
  | "bluetooth"
  | "wifi"
  | "power"
  | "warranty"
  | "material"
  | "size"
  | "weight"
  | "shipping"
  | "sound"
  | "check"

export type ProductHighlight = { icon: HighlightIcon; label: string }

const MAX_LABEL = 28

/** Order matters: the first matching rule wins (specific before generic). */
const ICON_RULES: Array<[HighlightIcon, RegExp]> = [
  ["battery", /batter|autonom|akku|bater[ií]a|batteria|accu\b|bateria|电池|续航|mah\b/i],
  ["water", /waterproof|étanch|etanch|imperm|wasserdicht|waterdicht|wodoodporn|resistente al agua|impermeabile|防水|\bip\s?\d{2}\b|\b\d\s?atm\b/i],
  ["screen", /[eé]cran|screen|display|amoled|oled|\blcd\b|retina|bildschirm|pantalla|schermo|scherm|ekran|屏幕|显示/i],
  ["health", /sant[eé]|health|cardi|heart|pulse|sleep|sommeil|spo2|gesundheit|puls|schlaf|salud|sue[nñ]o|salute|sonno|gezondheid|slaap|zdrowi|tętno|健康|心率|睡眠/i],
  ["sport", /sport|fitness|workout|training|exercice|entra[iî]n|running|course|deporte|entrenamiento|allenamento|sportmodi|trening|bieg|运动|模式/i],
  ["camera", /cam[eé]ra|camera|photo|foto|kamera|fotocamera|aparat|摄像|拍照|\b\d+\s?mp\b/i],
  ["bluetooth", /bluetooth/i],
  ["wifi", /wi-?fi|wlan/i],
  ["sound", /audio|sound|son\b|speaker|haut-parleur|enceinte|bass|lautsprecher|altavoz|altoparlante|luidspreker|głośnik|音质|扬声/i],
  ["power", /charg|charge\b|recharg|usb|watt|\b\d+\s?w\b|laden|carga|ricarica|opladen|ładowan|充电|快充|puissance|power/i],
  ["warranty", /garanti|warranty|garant[ií]a|garanzia|gwarancj|保修|质保/i],
  ["material", /cuir|leather|leder|piel|pelle|leer|skóra|coton|cotton|baumwolle|algod|cotone|katoen|bawełn|bois|wood|holz|madera|legno|hout|drewn|m[eé]tal|steel|acier|inox|alu|aluminium|c[eé]ramique|ceramic|verre|glass|silicone|plastique|mati[eè]re|material|材质|皮革|纯棉/i],
  ["weight", /poids|weight|gewicht|peso|waga|重量|\b\d+(?:[.,]\d+)?\s?(?:kg|g)\b|l[eé]ger|lightweight|leicht/i],
  ["size", /dimension|taille|size|gr[oö][sß]e|tama[nñ]o|misura|maat|rozmiar|尺寸|\b\d+(?:[.,]\d+)?\s?(?:cm|mm|["”]|pouces?|inch)\b/i],
  ["shipping", /livraison|shipping|delivery|versand|env[ií]o|spedizione|verzending|dostaw|配送|发货/i],
]

export function inferHighlightIcon(text: string): HighlightIcon | null {
  for (const [icon, re] of ICON_RULES) if (re.test(text)) return icon
  return null
}

/** Function words that must never end a chip ("… en bois de", "… avec 6"). */
const DANGLING = new Set(
  (
    "de du des d l la le les un une et ou à a au aux en avec pour sur par dans sans " +
    "of and or with for the an to in on at by from " +
    "mit und oder für der die das ein eine von zu im am " +
    "con para y el los las una del al por " +
    "di il lo gli e per da su " +
    "met voor en het een van op " +
    "z i na dla oraz " +
    "的 和 与"
  ).split(" ")
)

function trimDangling(s: string): string {
  const words = s.replace(/[\s,;:(\-–—/&+]+$/u, "").split(" ")
  while (words.length > 1) {
    const last = words[words.length - 1]!.replace(/[’']$/u, "").toLowerCase()
    const isBareNumber = /^\d+$/.test(last) && words.length > 2
    if (DANGLING.has(last) || isBareNumber || /^[dl][’']$/i.test(words[words.length - 1]!)) words.pop()
    else break
  }
  return words.join(" ")
}

function firstClause(s: string): string {
  const c = s.split(/[;|–—]|(?<!\d),|(?<!\d)\.(?=\s|$)/)[0]?.trim() ?? s
  return c.length >= 3 ? c : s
}

/** Strip bullets/emoji/markdown, keep the meaningful part ("Label : value" → "Label value"), cut on a word boundary. */
export function compactHighlightLabel(raw: string, max = MAX_LABEL): string {
  let s = raw
    .replace(/^[\s\-–—•·▪●✔✅☑️✓*#>\d.)]+/u, "")
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, "")
    .replace(/\*\*|__|`/g, "")
    .replace(/\s+/g, " ")
    .trim()

  const kv = s.match(/^([^:]{3,24}?)\s*:\s*(.+)$/u)
  if (kv) {
    const value = firstClause(kv[2]!.trim())
    const combined = `${kv[1]!.trim()} ${value}`
    s = combined.length <= max ? combined : kv[1]!.trim()
  } else {
    s = firstClause(s)
  }

  if (s.length > max) {
    const cut = s.lastIndexOf(" ", max)
    s = cut >= 8 ? s.slice(0, cut) : s.slice(0, max)
    // Cut mid-phrase: back off to before the last function word ("… en bois de haute" → "… en bois").
    const words = s.split(" ")
    for (let i = words.length - 1; i >= 2; i--) {
      if (DANGLING.has(words[i]!.replace(/[’']$/u, "").toLowerCase())) {
        s = words.slice(0, i).join(" ")
        break
      }
    }
  }
  s = trimDangling(s)
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export type HighlightSource = {
  bullets?: readonly string[] | null
  specs?: ReadonlyArray<{ label: string; value: string }> | null
}

/**
 * Up to `max` highlights: bullets with a recognisable topic first (one per icon), then remaining bullets,
 * then spec rows ("Autonomie : 14 jours" → "Autonomie 14 jours"). Never returns duplicates.
 */
export function deriveProductHighlights(source: HighlightSource, max = 4): ProductHighlight[] {
  const out: ProductHighlight[] = []
  const seenLabels = new Set<string>()
  const usedIcons = new Set<HighlightIcon>()

  const push = (raw: string, requireIcon: boolean) => {
    if (out.length >= max) return
    const text = raw.trim()
    if (text.length < 3) return
    const icon = inferHighlightIcon(text)
    if (requireIcon && !icon) return
    if (icon && usedIcons.has(icon)) return
    const label = compactHighlightLabel(text)
    const key = label.toLowerCase()
    if (label.length < 3 || seenLabels.has(key)) return
    seenLabels.add(key)
    if (icon) usedIcons.add(icon)
    out.push({ icon: icon ?? "check", label })
  }

  const bullets = (source.bullets ?? []).filter((b): b is string => typeof b === "string")
  for (const b of bullets) push(b, true)
  for (const b of bullets) push(b, false)

  if (out.length < max) {
    for (const row of source.specs ?? []) {
      const value = row.value?.trim()
      const label = row.label?.trim()
      if (!label || !value || value.length > 24) continue
      push(`${label} ${value}`, true)
    }
  }
  return out.slice(0, max)
}

/** "Popular" badge: enough sales, or a strongly rated product with a meaningful number of reviews, or flagged best-seller. */
export function isShowcasePopular(args: {
  soldCount?: number | null
  averageRating?: number | null
  reviewCount?: number | null
  isBestSeller?: boolean
}): boolean {
  if (args.isBestSeller) return true
  if ((args.soldCount ?? 0) >= 50) return true
  return (args.reviewCount ?? 0) >= 25 && (args.averageRating ?? 0) >= 4.5
}
