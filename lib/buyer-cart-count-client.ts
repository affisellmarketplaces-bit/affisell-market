import { guestCartCount } from "@/lib/guest-cart"

type CartLineQty = { qty?: number; quantity?: number }

/** Total units in cart (sums line quantities, not just line count). */
export function sumBuyerCartLines(lines: unknown[]): number {
  if (!Array.isArray(lines)) return 0
  return lines.reduce<number>((sum, row) => {
    if (!row || typeof row !== "object") return sum
    const line = row as CartLineQty
    const q = line.qty ?? line.quantity ?? 1
    const n = Math.round(Number(q))
    return sum + (Number.isFinite(n) && n > 0 ? n : 0)
  }, 0)
}

export async function fetchServerCartCount(): Promise<number> {
  const res = await fetch("/api/cart", { credentials: "include", cache: "no-store" })
  if (!res.ok) return 0
  const lines = (await res.json()) as unknown
  return sumBuyerCartLines(Array.isArray(lines) ? lines : [])
}

export function readLocalCartCount(): number {
  return guestCartCount()
}

export function dispatchCartUpdated(): void {
  if (typeof window === "undefined") return
  window.dispatchEvent(new CustomEvent("affisell:cart-updated"))
}
