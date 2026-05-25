import { prisma } from "@/lib/prisma"
import {
  isVercelDomainAutoProvisionEnabled,
  provisionMerchantDomainOnVercel,
  getVercelProjectDomain,
  type VercelDomainProvisionResult,
} from "@/lib/vercel-project-domains"

export async function syncStoreVercelDomainStatus(storeId: string): Promise<{
  vercelDomainStatus: string | null
  vercelDomainError: string | null
  vercelDomainSyncedAt: Date | null
}> {
  const store = await prisma.store.findUnique({
    where: { id: storeId },
    select: { customDomain: true, domainVerified: true, vercelDomainStatus: true },
  })
  if (!store?.customDomain || !store.domainVerified) {
    return {
      vercelDomainStatus: store?.vercelDomainStatus ?? null,
      vercelDomainError: null,
      vercelDomainSyncedAt: null,
    }
  }

  if (!isVercelDomainAutoProvisionEnabled()) {
    return {
      vercelDomainStatus: "skipped",
      vercelDomainError: null,
      vercelDomainSyncedAt: new Date(),
    }
  }

  const remote = await getVercelProjectDomain(store.customDomain)
  if (!remote) {
    return {
      vercelDomainStatus: store.vercelDomainStatus ?? "pending",
      vercelDomainError: null,
      vercelDomainSyncedAt: new Date(),
    }
  }

  const status = remote.status
  await prisma.store.update({
    where: { id: storeId },
    data: {
      vercelDomainStatus: status,
      vercelDomainError: null,
      vercelDomainSyncedAt: new Date(),
    },
  })

  return {
    vercelDomainStatus: status,
    vercelDomainError: null,
    vercelDomainSyncedAt: new Date(),
  }
}

export async function applyVercelProvisionResult(
  storeId: string,
  result: VercelDomainProvisionResult
): Promise<void> {
  await prisma.store.update({
    where: { id: storeId },
    data: {
      vercelDomainStatus: result.status,
      vercelDomainError: result.status === "failed" ? (result.message ?? "Vercel error") : null,
      vercelDomainSyncedAt: new Date(),
    },
  })
}

export async function provisionStoreCustomDomainOnVercel(
  storeId: string,
  domain: string
): Promise<VercelDomainProvisionResult> {
  const result = await provisionMerchantDomainOnVercel(domain)
  await applyVercelProvisionResult(storeId, result)
  return result
}
