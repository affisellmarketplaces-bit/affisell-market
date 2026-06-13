import type { StorefrontRole } from "@/lib/custom-domain-path"
import { storePublicPrefix } from "@/lib/custom-domain-path"
import { normalizeRequestHost } from "@/lib/custom-domain-host"
import { parseStoreSlugFromStoreHost } from "@/lib/store-host-suffix"
import { prisma } from "@/lib/prisma"

export type ResolvedCustomDomainStore = {
  slug: string
  role: StorefrontRole
  storePrefix: string
  hostKind: "custom_domain" | "affisell_subdomain"
}

function domainLookupCandidates(host: string): string[] {
  const base = normalizeRequestHost(host)
  if (!base) return []
  const set = new Set<string>([base])
  if (base.startsWith("www.")) set.add(base.slice(4))
  else set.add(`www.${base}`)
  return [...set]
}

async function resolveStoreRowBySlug(slug: string): Promise<ResolvedCustomDomainStore | null> {
  const store = await prisma.store.findUnique({
    where: { slug },
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
    hostKind: "affisell_subdomain",
  }
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
    hostKind: "custom_domain",
  }
}

/** Verified custom domain first, then auto `{slug}.shops.affisell.com`. */
export async function resolveStoreByHost(hostRaw: string): Promise<ResolvedCustomDomainStore | null> {
  const custom = await resolveStoreByCustomDomain(hostRaw)
  if (custom) return custom

  const host = normalizeRequestHost(hostRaw)
  const slug = parseStoreSlugFromStoreHost(host)
  if (!slug) return null

  return resolveStoreRowBySlug(slug)
}
