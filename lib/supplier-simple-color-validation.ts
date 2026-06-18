/** PDP swatch / listing color names (mode « Couleurs & tailles ») — plus permissif que les SKU. */
export const SIMPLE_COLOR_NAME_MAX = 48

/** Letters, numbers, spaces, hyphen, slash, ampersand, apostrophe, parens, dot (incl. accents). */
export const SIMPLE_COLOR_NAME_REGEX = /^[\p{L}\p{N}\s\-/&'()+.]+$/u

export const SIMPLE_COLOR_COMMA_ERROR =
  "Pas de virgule dans un nom de couleur — une ligne = une couleur."

export const SIMPLE_COLOR_PLUS_ERROR =
  "Pas de « + » dans le nom — indiquez une seule couleur par ligne, ou passez au tableau SKU."

export const SIMPLE_COLOR_CHARS_ERROR =
  "Caractères autorisés : lettres, chiffres, espaces, - / & ' ( ) . (ex. Noir/Rouge, X1(7.8Ah 25KM))."

export type SimpleColorValidationIssue = {
  index: number
  message: string
}

export function validateSimpleColorName(name: string): string | null {
  const n = name.trim()
  if (!n) return null
  if (n.includes(",")) return SIMPLE_COLOR_COMMA_ERROR
  if (n.includes("+")) return SIMPLE_COLOR_PLUS_ERROR
  if (n.length > SIMPLE_COLOR_NAME_MAX) {
    return `Maximum ${SIMPLE_COLOR_NAME_MAX} caractères.`
  }
  if (!SIMPLE_COLOR_NAME_REGEX.test(n)) {
    return SIMPLE_COLOR_CHARS_ERROR
  }
  return null
}

export function validateSimpleColorRows(
  rows: { name: string }[]
): SimpleColorValidationIssue[] {
  const issues: SimpleColorValidationIssue[] = []
  const seen = new Map<string, number>()

  rows.forEach((row, index) => {
    const n = row.name.trim()
    if (!n) return
    const fieldErr = validateSimpleColorName(n)
    if (fieldErr) {
      issues.push({ index, message: fieldErr })
    }
    const key = n.toLowerCase()
    const prev = seen.get(key)
    if (prev != null) {
      issues.push({
        index,
        message: `Couleur « ${n} » déjà utilisée (ligne ${prev + 1}).`,
      })
    } else {
      seen.set(key, index)
    }
  })

  return issues
}
