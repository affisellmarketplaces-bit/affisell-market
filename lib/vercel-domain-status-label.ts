/** Human labels for Vercel domain status — client-safe. */

export function vercelDomainStatusLabel(status: string | null | undefined): string {
  switch (status) {
    case "active":
      return "SSL active on Vercel"
    case "pending":
      return "SSL pending — DNS propagating"
    case "registered":
      return "Registered on Vercel"
    case "failed":
      return "Vercel registration failed"
    case "skipped":
      return "Add domain manually in Vercel"
    default:
      return "Not registered on Vercel yet"
  }
}
