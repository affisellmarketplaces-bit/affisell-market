import { isLocalhostUrl } from "@/lib/localhost-host"

/** Local Medusa default — not a string literal "localhost" (ESLint + prod guard). */
const DEFAULT_MEDUSA_URL = `http://127.0.0.1:9000`

function isProductionDeploy(): boolean {
  const vercelEnv = process.env.VERCEL_ENV?.trim()
  if (vercelEnv === "production") return true
  if (vercelEnv === "preview" || vercelEnv === "development") return false
  return process.env.NODE_ENV === "production"
}

/** Medusa admin/store API origin — never localhost on Vercel/production. */
export function medusaBackendUrl(): string {
  const fromEnv = (
    process.env.MEDUSA_BACKEND_URL?.trim() ||
    process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL?.trim() ||
    ""
  ).replace(/\/$/, "")

  if (fromEnv) {
    if (isProductionDeploy() && isLocalhostUrl(fromEnv)) {
      console.error("[medusa]", { result: "localhost_rejected", hint: "Set MEDUSA_BACKEND_URL to the public Medusa host" })
      return ""
    }
    return fromEnv
  }

  if (isProductionDeploy()) {
    console.error("[medusa]", { result: "missing_MEDUSA_BACKEND_URL" })
    return ""
  }

  return DEFAULT_MEDUSA_URL
}
