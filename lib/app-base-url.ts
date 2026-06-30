import { resolvePublicAppUrl } from "@/lib/public-app-url"

/** Public app origin (no server-only deps — safe for client bundles). */
export function appBaseUrl(): string {
  return resolvePublicAppUrl()
}
