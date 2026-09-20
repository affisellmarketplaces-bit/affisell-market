/**
 * A storefront name is the brand a buyer sees on the product card and the receipt. A pasted link, an @handle or an
 * e-mail is never a brand — it signals an unfinished (or scraped) shop. Pure and client-safe.
 */
export type StoreNameProblem = "empty" | "too_short" | "link" | "handle" | "email" | "generic" | "digits_only"

const LINK_RE = /(?:https?:\/\/|www\.|\.(?:com|fr|net|org|io|co|shop|store|app)\b(?:\/|\s|$))/i
const GENERIC_RE = /^(?:my|the|our|your)?\s*(?:online\s+)?(?:store|shop|boutique|magasin|tienda|laden)$/i

export function assessStoreName(raw: string | null | undefined): { ok: boolean; problem?: StoreNameProblem } {
  const name = (raw ?? "").replace(/\s+/g, " ").trim()
  if (!name) return { ok: false, problem: "empty" }
  if (name.includes("@") && /\S+@\S+\.\S+/.test(name)) return { ok: false, problem: "email" }
  if (LINK_RE.test(name)) return { ok: false, problem: "link" }
  if (name.includes("@") || /^#/.test(name)) return { ok: false, problem: "handle" }
  if (name.replace(/[^\p{L}\p{N}]/gu, "").length < 2) return { ok: false, problem: "too_short" }
  if (/^[\d\s\W]+$/u.test(name)) return { ok: false, problem: "digits_only" }
  if (GENERIC_RE.test(name)) return { ok: false, problem: "generic" }
  return { ok: true }
}

export function isPresentableStoreName(raw: string | null | undefined): boolean {
  return assessStoreName(raw).ok
}
