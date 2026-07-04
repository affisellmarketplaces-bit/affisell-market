/** Brand Studio PostHog funnel — client-safe (no Prisma). */

export const BRAND_POSTHOG_FUNNEL = [
  {
    id: "preset",
    event: "brand_preset_selected",
    buyerEvent: "storefront_preset_viewed",
  },
  {
    id: "launch",
    event: "brand_launch_applied",
    buyerEvent: null,
  },
  {
    id: "share",
    event: "brand_share_link_copied",
    buyerEvent: null,
  },
  {
    id: "immersive",
    event: "storefront_immersive_viewed",
    buyerEvent: "storefront_immersive_viewed",
  },
] as const

export type BrandPosthogFunnelStepId = (typeof BRAND_POSTHOG_FUNNEL)[number]["id"]

/** Map capture host (us.i.posthog.com) → app host for dashboard links. */
export function posthogAppHostFromCaptureHost(captureHost: string): string {
  const trimmed = captureHost.trim().replace(/\/+$/, "")
  if (trimmed.includes("eu.i.posthog")) return "https://eu.posthog.com"
  if (trimmed.includes("us.i.posthog")) return "https://us.posthog.com"
  return trimmed.replace(".i.posthog.com", ".posthog.com")
}

export function buildPosthogProjectEventsUrl(args: {
  projectId: string
  captureHost?: string
  event?: string
}): string {
  const appHost = posthogAppHostFromCaptureHost(
    args.captureHost ?? "https://us.i.posthog.com"
  )
  const base = `${appHost}/project/${encodeURIComponent(args.projectId.trim())}/activity/explore`
  if (!args.event?.trim()) return base
  const params = new URLSearchParams({
    event: args.event.trim(),
  })
  return `${base}?${params.toString()}`
}

export function buildPosthogPresetInsightUrl(args: {
  projectId: string
  presetId: string
  captureHost?: string
}): string {
  const appHost = posthogAppHostFromCaptureHost(
    args.captureHost ?? "https://us.i.posthog.com"
  )
  const params = new URLSearchParams({
    event: "storefront_preset_viewed",
    properties: JSON.stringify([{ key: "presetId", value: args.presetId }]),
  })
  return `${appHost}/project/${encodeURIComponent(args.projectId.trim())}/activity/explore?${params.toString()}`
}

/** Deep link to preset A/B experiment events in PostHog. */
export function buildPosthogPresetAbExperimentUrl(args: {
  projectId: string
  storeSlug: string
  captureHost?: string
}): string {
  const appHost = posthogAppHostFromCaptureHost(
    args.captureHost ?? "https://us.i.posthog.com"
  )
  const params = new URLSearchParams({
    event: "storefront_preset_ab_viewed",
    properties: JSON.stringify([{ key: "storeSlug", value: args.storeSlug.trim() }]),
  })
  return `${appHost}/project/${encodeURIComponent(args.projectId.trim())}/activity/explore?${params.toString()}`
}
