/**
 * What a visible link prefetches before the visitor shows any intent.
 *
 * `null` = Next's default ("auto"): a static route is prefetched whole, a DYNAMIC route only down to its nearest
 * `loading` boundary. Every Affisell page is dynamic (the root layout reads the request headers), so `true` — which
 * FastLink and NavPill used to force — made every link that scrolled into view prefetch the FULL page: one complete
 * server render with its database queries per link. Measured on the home (Lighthouse CI, 2026-11-17): 24 such requests
 * at startup, competing with the page's own scripts, and ~12 server renders per visit.
 *
 * Intent still warms the full route: hover, focus and touch call `router.prefetch` (FastLink / NavPill `warm`).
 */
export const VIEWPORT_LINK_PREFETCH = null
