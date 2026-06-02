import { authorizeCronRequest } from "@/lib/cron/authorize-cron-request"
import { openBlindSecret } from "@/lib/blind-dropship-crypto"
import { buildSupplierAdapterFromConfig } from "@/lib/suppliers/build-rest-adapter"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(req: Request) {
  const denied = authorizeCronRequest(req)
  if (denied) return denied

  const suppliers = await prisma.blindDropshipSupplier.findMany({
    where: { isBlindDropship: true, apiType: "rest" },
  })

  const summary: { id: string; updated: number; error?: string }[] = []

  for (const s of suppliers) {
    try {
      const key = openBlindSecret(s.apiKeyEncrypted)
      const adapter = buildSupplierAdapterFromConfig({
        apiEndpoint: s.apiEndpoint,
        apiKeyPlain: key,
        config: (s.config ?? {}) as Record<string, unknown>,
      })
      const rows = await adapter.getStock()
      let updated = 0
      for (const row of rows) {
        const r = await prisma.product.updateMany({
          where: {
            supplierId: s.linkedUserId,
            supplierSku: row.sku,
          },
          data: {
            stock: row.stock,
            active: row.stock > 0,
          },
        })
        updated += r.count
      }
      await prisma.blindDropshipSupplier.update({
        where: { id: s.id },
        data: { lastStockSyncAt: new Date(), lastStockError: null },
      })
      summary.push({ id: s.id, updated })
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      await prisma.blindDropshipSupplier.update({
        where: { id: s.id },
        data: { lastStockError: msg.slice(0, 2000) },
      })
      summary.push({ id: s.id, updated: 0, error: msg })
    }
  }

  return Response.json({ ok: true, suppliers: summary.length, summary })
}
