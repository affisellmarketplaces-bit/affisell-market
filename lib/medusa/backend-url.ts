const DEFAULT_MEDUSA_URL = "http://localhost:9000"

export function medusaBackendUrl(): string {
  return (
    process.env.MEDUSA_BACKEND_URL?.trim() ||
    process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL?.trim() ||
    DEFAULT_MEDUSA_URL
  ).replace(/\/$/, "")
}
