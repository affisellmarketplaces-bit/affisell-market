import type { StorefrontRole } from "@/lib/custom-domain-path"
import { storePublicPrefix } from "@/lib/custom-domain-path"
import { normalizeRequestHost } from "@/lib/custom-domain-host"
import { prisma } from "@/lib/prisma"

export type ResolvedCustomDomainStore = {
  slug: string
  role: StorefrontRole
  storePrefix: string
}

function domainLookupCandidates(host: string): string[] {
  const base = normalizeRequestHost(host)
  if (!base) return []
  const set = new Set<string>([base])
  if (base.startsWith("www.")) set.add(base.slice(4))
  else set.add(`www.${base}`)
  return [...set]
}

export async function resolveStoreByCustomDomain(
  hostRaw: string
): Promise<ResolvedCustomDomainStore | null> {
  const candidates = domainLookupCandidates(hostRaw)
  if (candidates.length === 0) return null

  const store = await prisma.store.findFirst({
    where: {
      domainVerified: true,
      customDomain: { in: candidates },
      user: { role: { in: ["AFFILIATE", "SUPPLIER"] } },
    },
    select: {
      slug: true,
      user: { select: { role: true } },
    },
  })

  if (!store) return null
  const role = store.user.role
  if (role !== "AFFILIATE" && role !== "SUPPLIER") return null

  return {
    slug: store.slug,
    role,
    storePrefix: storePublicPrefix(store.slug, role),
  }
}
