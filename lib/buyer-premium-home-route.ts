/** Buyer premium home — `/` (EN) and `/fr` (FR). */
export function isBuyerPremiumHomePathname(pathname: string): boolean {
  const bare = (pathname.split("?")[0] ?? pathname).replace(/\/$/, "") || "/"
  return bare === "/" || bare === "/fr"
}
