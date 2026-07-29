/** Mirror Attract — client-safe config + route guards (no Prisma). */

export type MirrorShowcaseProduct = {
  id: string
  title: string
  imageUrl: string
  href: string
}

export type MirrorProductPose = {
  xPct: number
  yPct: number
  depth: 0 | 1 | 2
  rotateDeg: number
  delaySec: number
  durationSec: number
  sizeRem: number
}

const BLOCKED_PREFIXES = [
  "/dashboard",
  "/login",
  "/signup",
  "/cart",
  "/checkout",
  "/orders",
  "/admin",
  "/api",
  "/offline",
  "/wc-auth",
] as const

const ALLOWED_PREFIXES = [
  "/",
  "/marketplace",
  "/discover",
  "/shops",
  "/browse",
  "/wishlist",
  "/pulse",
  "/radar",
  "/dropforge",
  "/pricing",
  "/how-it-works",
  "/agent",
  "/creators",
  "/partners",
  "/demo",
  "/lab",
  "/brand",
  "/fr",
  "/en",
] as const

export function isMirrorAttractRouteAllowed(pathname: string): boolean {
  const path = pathname.split("?")[0]?.trim() || "/"
  if (BLOCKED_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`))) {
    return false
  }
  if (path === "/") return true
  return ALLOWED_PREFIXES.some((p) => p !== "/" && (path === p || path.startsWith(`${p}/`)))
}

export function readMirrorAttractEnabled(searchParams?: URLSearchParams | null): boolean {
  if (typeof window !== "undefined") {
    const qs = searchParams ?? new URLSearchParams(window.location.search)
    if (qs.get("attract") === "1" || qs.get("mirror") === "1") return true
  } else if (searchParams?.get("attract") === "1" || searchParams?.get("mirror") === "1") {
    return true
  }
  return process.env.NEXT_PUBLIC_MIRROR_ATTRACT === "1"
}

export function readMirrorAttractForceKiosk(searchParams?: URLSearchParams | null): boolean {
  if (typeof window !== "undefined") {
    const qs = searchParams ?? new URLSearchParams(window.location.search)
    return qs.get("attract") === "1" || qs.get("mirror") === "1"
  }
  return searchParams?.get("attract") === "1" || searchParams?.get("mirror") === "1"
}

export function readMirrorAttractDelayMs(forceKiosk: boolean): number {
  if (forceKiosk) return 2_000
  const raw = process.env.NEXT_PUBLIC_MIRROR_ATTRACT_DELAY_MS?.trim()
  const parsed = raw ? Number(raw) : NaN
  if (Number.isFinite(parsed) && parsed >= 5_000) return parsed
  return 90_000
}

/** Deterministic orbital layout from product index — stable across renders. */
export function mirrorProductPose(index: number, total: number): MirrorProductPose {
  const t = total > 0 ? index / total : 0
  const ring = (index % 3) as 0 | 1 | 2
  const angle = t * Math.PI * 2 + ring * 0.55
  const radius = 28 + ring * 11 + (index % 5) * 2.2
  const xPct = 50 + Math.cos(angle) * radius * 0.42
  const yPct = 46 + Math.sin(angle) * radius * 0.36
  const rotateDeg = -14 + (index % 7) * 4 - ring * 2
  const delaySec = (index % 6) * 0.45
  const durationSec = 5.5 + ring * 1.2 + (index % 4) * 0.35
  const sizeRem = ring === 0 ? 6.25 : ring === 1 ? 5.25 : 4.35

  return {
    xPct: Math.min(92, Math.max(8, xPct)),
    yPct: Math.min(78, Math.max(18, yPct)),
    depth: ring,
    rotateDeg,
    delaySec,
    durationSec,
    sizeRem,
  }
}
