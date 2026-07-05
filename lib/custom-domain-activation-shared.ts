/** Custom domain activation state — client-safe (no Prisma). */

export type CustomDomainActivationState = "active" | "needs_domain" | "needs_dns" | "needs_ssl"

export function resolveCustomDomainActivationState(args: {
  customDomain: string | null | undefined
  domainVerified: boolean
  vercelDomainStatus: string | null | undefined
}): CustomDomainActivationState {
  const domain = args.customDomain?.trim()
  if (!domain) return "needs_domain"
  if (!args.domainVerified) return "needs_dns"
  const status = args.vercelDomainStatus?.trim().toLowerCase()
  if (status === "active" || status === "skipped") return "active"
  return "needs_ssl"
}

export function isCustomDomainFullyActive(args: {
  customDomain: string | null | undefined
  domainVerified: boolean
  vercelDomainStatus: string | null | undefined
}): boolean {
  return resolveCustomDomainActivationState(args) === "active"
}
