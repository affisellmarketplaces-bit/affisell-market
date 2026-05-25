/** Keys under `storefront.domain` for Vercel/hosting status — map in UI with next-intl. */

export type VercelDomainStatusKey =
  | "vercelActive"
  | "vercelPending"
  | "vercelRegistered"
  | "vercelFailed"
  | "vercelSkipped"
  | "vercelUnknown"

export function vercelDomainStatusMessageKey(
  status: string | null | undefined
): VercelDomainStatusKey {
  switch (status) {
    case "active":
      return "vercelActive"
    case "pending":
      return "vercelPending"
    case "registered":
      return "vercelRegistered"
    case "failed":
      return "vercelFailed"
    case "skipped":
      return "vercelSkipped"
    default:
      return "vercelUnknown"
  }
}
