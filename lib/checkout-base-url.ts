import { appBaseUrl } from "@/lib/app-base-url"

function normalizeBaseUrl(raw: string): string {
  return raw.trim().replace(/\/$/, "")
}

function requestOrigin(request: Request): string | null {
  try {
    const origin = new URL(request.url).origin
    if (!origin || origin === "null") return null
    return normalizeBaseUrl(origin)
  } catch {
    return null
  }
}

/** Stripe success/cancel URLs must return to the browser origin that started checkout. */
export function resolveCheckoutBaseUrl(request?: Request): string {
  const fromRequest = request ? requestOrigin(request) : null
  if (fromRequest) {
    if (process.env.NODE_ENV === "development") {
      return fromRequest
    }
    if (!fromRequest.includes("localhost") && !fromRequest.includes("127.0.0.1")) {
      return fromRequest
    }
  }

  const fromEnv =
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    process.env.NEXT_PUBLIC_BASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.APP_URL?.trim() ||
    process.env.AUTH_URL?.trim()

  if (fromEnv) return normalizeBaseUrl(fromEnv)
  return normalizeBaseUrl(appBaseUrl())
}
