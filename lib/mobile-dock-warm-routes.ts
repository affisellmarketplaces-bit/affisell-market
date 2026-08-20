import { resolveMobileDockItems } from "@/lib/mobile-dock-config"

/** All buyer dock destinations — prefetch on mount so first tap is instant. */
export const MOBILE_DOCK_WARM_ROUTES = [
  ...new Set([
    ...resolveMobileDockItems("browse").map((item) => item.href),
    ...resolveMobileDockItems("account").map((item) => item.href),
  ]),
] as const
