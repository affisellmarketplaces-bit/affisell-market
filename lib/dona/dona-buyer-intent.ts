/** Buyer chat intent — client-safe (no Prisma). */

const BESTSELLER_INTENT_RE =
  /\b(plus\s+vendu|best[\s-]?seller|meilleur(?:e)?s?\s+ventes?|top\s+ventes?|classement|bestsellers?|most\s+sold|top\s+selling|#1\s+vente|num[eé]ro\s+un)\b/i

export function isDonaBestsellerIntent(text: string): boolean {
  const t = text.trim()
  if (!t) return false
  return BESTSELLER_INTENT_RE.test(t)
}
