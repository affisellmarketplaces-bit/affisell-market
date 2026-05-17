/** Heuristic category + spec hints parsed from a product title (Amazon-style). */
export type TitleSuggestions = {
  categorySlug?: string
  brand?: string
  storage_gb?: string
  color?: string
  operating_system?: string
  eu_size?: string
  gender?: string
  platform?: string
}

const COLOR_LABELS: Record<string, string> = {
  noir: "Noir",
  blanc: "Blanc",
  bleu: "Bleu",
  titane: "Titane",
  rouge: "Rouge",
  vert: "Vert",
  rose: "Rose",
  gris: "Gris",
}

function detectStorageGb(lower: string): string | undefined {
  const go = lower.match(/(\d{2,4})\s*go\b/)
  if (go?.[1]) return go[1]
  const gb = lower.match(/(\d{2,4})\s*gb\b/)
  if (gb?.[1]) return gb[1]
  return undefined
}

function detectColor(lower: string): string | undefined {
  const key = Object.keys(COLOR_LABELS).find((c) => lower.includes(c))
  return key ? COLOR_LABELS[key] : undefined
}

export function suggestFromTitle(title: string): TitleSuggestions {
  const lower = title.toLowerCase().trim()
  const suggestions: TitleSuggestions = {}

  if (!lower) return suggestions

  if (
    /smart\s*band|mi\s*band|bracelet\s*connect|montre\s*connect|fitness\s*tracker|galaxy\s*fit|amazfit|fitbit|oura|whoop|honor\s*band|xiaomi\s*band|tracker\s*d.activ|podom[eè]tre\s*connect/i.test(
      lower
    )
  ) {
    suggestions.categorySlug = "moniteurs-d-activite"
  } else if (/iphone|samsung galaxy|smartphone|pixel|xiaomi|oneplus|huawei/.test(lower)) {
    suggestions.categorySlug = "telephones-portables-deverrouilles"
  } else if (/macbook|ordinateur portable|laptop|chromebook/.test(lower)) {
    suggestions.categorySlug = "ordinateurs-portables"
  } else if (/t-shirt|t shirt|tee-shirt|polo|chemise/.test(lower)) {
    suggestions.categorySlug = "hauts"
  } else if (/nike|adidas|sneaker|basket|new balance|puma|converse/.test(lower)) {
    suggestions.categorySlug = "chaussures"
  } else if (/livre|roman|isbn|ebook|e-book/.test(lower)) {
    suggestions.categorySlug = "livres-papier"
  } else if (/jeu vidéo|jeu video|playstation|xbox|nintendo switch/.test(lower)) {
    suggestions.categorySlug = "jeux-video"
  } else if (/parfum|eau de toilette|cosmétique|cosmetique|sérum|serum/.test(lower)) {
    suggestions.categorySlug = "parfums-et-eaux-de-cologne"
  } else if (/croquettes|aliment.*chien|aliment.*chat/.test(lower)) {
    suggestions.categorySlug = "aliments-pour-chiens-sans-ordonnance"
  }

  if (suggestions.categorySlug === "telephones-portables-deverrouilles") {
    if (/apple|iphone/.test(lower)) {
      suggestions.brand = "Apple"
      suggestions.operating_system = "iOS"
    }
    if (/samsung/.test(lower)) {
      suggestions.brand = "Samsung"
      suggestions.operating_system = "Android"
    }
    if (/google|pixel/.test(lower)) suggestions.brand = "Google"
    if (/xiaomi|redmi/.test(lower)) suggestions.brand = "Xiaomi"
    if (/oneplus/.test(lower)) suggestions.brand = "OnePlus"
    if (/huawei/.test(lower)) suggestions.brand = "Huawei"
    if (!suggestions.operating_system && /android/.test(lower)) suggestions.operating_system = "Android"

    const storage = detectStorageGb(lower)
    if (storage) suggestions.storage_gb = storage

    const color = detectColor(lower)
    if (color) suggestions.color = color
  }

  if (suggestions.categorySlug === "chaussures") {
    if (/nike/.test(lower)) suggestions.brand = "Nike"
    if (/adidas/.test(lower)) suggestions.brand = "Adidas"
    if (/new balance/.test(lower)) suggestions.brand = "New Balance"
    if (/puma/.test(lower)) suggestions.brand = "Puma"
    const size = lower.match(/\b(3[6-9]|4[0-6])\b/)
    if (size?.[1]) suggestions.eu_size = size[1]
    const color = detectColor(lower)
    if (color) suggestions.color = color
  }

  if (suggestions.categorySlug === "hauts") {
    if (/homme/.test(lower)) suggestions.gender = "Homme"
    if (/femme/.test(lower)) suggestions.gender = "Femme"
    if (/unisexe/.test(lower)) suggestions.gender = "Unisexe"
    const color = detectColor(lower)
    if (color) suggestions.color = color
  }

  if (suggestions.categorySlug === "jeux-video") {
    if (/playstation|ps5|ps4/.test(lower)) suggestions.platform = "PlayStation 5"
    if (/xbox/.test(lower)) suggestions.platform = "Xbox Series X|S"
    if (/nintendo|switch/.test(lower)) suggestions.platform = "Nintendo Switch"
  }

  return suggestions
}

/** Spec fields only (excludes categorySlug). */
export function titleSuggestionAttributes(s: TitleSuggestions): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(s)) {
    if (key === "categorySlug" || value == null || value === "") continue
    out[key] = String(value)
  }
  return out
}
