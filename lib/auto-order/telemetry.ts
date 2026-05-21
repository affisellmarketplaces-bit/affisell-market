import { capturePosthog } from "@/lib/analytics/posthog"

export function logAutoOrder(event: string, props?: Record<string, string | number | boolean | null>) {
  if (process.env.NODE_ENV === "development") {
    console.info(`[auto-order] ${event}`, props ?? {})
  }
  capturePosthog(`auto_order_${event}`, props)
}
