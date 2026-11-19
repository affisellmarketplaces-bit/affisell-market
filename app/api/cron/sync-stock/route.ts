import { authorizeCronRequest } from "@/lib/cron/authorize-cron-request"
import { openBlindSecret } from "@/lib/blind-dropship-crypto"
import { buildSupplierAdapterFromConfig } from "@/lib/suppliers/build-rest-adapter"
import { prisma } from "@/lib/prisma"
import {
  emptyPartnerStockObservation,
  partnerStockUpdate,
  planPartnerStockWrite,
  recordPartnerStockPlan,
  resolvePartnerStockSyncMode,
} from "@/lib/stock/partner-stock"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(req: Request) {
  const denied = authorizeCronRequest(req)
  if (denied) return denied

  // Observation by default (founder rule: no activation without authorisation): computes what WOULD be written.
  // `off` = immediate stop: nothing is read, nothing is called, nothing is written (the kill switch of the protocol).
  const mode = resolvePartnerStockSyncMode()
  if (mode === "off") return Response.json({ ok: true, mode, suppliers: 0, summary: [] })
  // One id per run: every log line of the run carries it, so a day of the observation week can be followed end to end.
  const runId = `sync-stock:${new Date().toISOString()}:${Math.random().toString(36).slice(2, 8)}`

  const suppliers = await prisma.blindDropshipSupplier.findMany({
    where: { isBlindDropship: true, apiType: "rest" },
  })

  const summary: { id: string; updated: number; error?: string; observation: ReturnType<typeof emptyPartnerStockObservation> }[] = []
  // What the run saw (or WOULD have written in observe) — the material of the one-week observation protocol.
  const observation = emptyPartnerStockObservation()

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
      const skipped: Record<string, number> = {}
      const supplierObs = emptyPartnerStockObservation()
      for (const row of rows) {
        const products = await prisma.product.findMany({
          where: { supplierId: s.linkedUserId, supplierSku: row.sku },
          select: { id: true, stock: true, variants: true },
        })
        for (const p of products) {
          const plan = planPartnerStockWrite(row.stock, p)
          recordPartnerStockPlan(observation, p.stock, plan)
          recordPartnerStockPlan(supplierObs, p.stock, plan)
          if (plan.action === "skip") {
            skipped[plan.reason] = (skipped[plan.reason] ?? 0) + 1
            continue
          }
          if (mode === "observe") {
            console.log("[sync-stock]", { runId, result: "would_write", productId: p.id, from: p.stock, to: plan.stock })
            continue
          }
          // Availability axis ONLY (lifecycle rule, founder 2026-11-18): a partner's stock never re-lists a product a
          // supplier paused or Affisell recalled, and never unpublishes a sold-out one. `active` is not written.
          await prisma.product.update({ where: { id: p.id }, data: partnerStockUpdate(plan.stock) })
          updated += 1
        }
      }
      if (Object.keys(skipped).length > 0) console.log("[sync-stock]", { runId, supplier: s.id, mode, skipped })
      if (mode === "enforce") {
        await prisma.blindDropshipSupplier.update({
          where: { id: s.id },
          data: { lastStockSyncAt: new Date(), lastStockError: null },
        })
      }
      summary.push({ id: s.id, updated, observation: supplierObs })
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      if (mode === "enforce") {
        await prisma.blindDropshipSupplier.update({
          where: { id: s.id },
          data: { lastStockError: msg.slice(0, 2000) },
        })
      }
      console.error("[sync-stock]", { runId, supplier: s.id, result: "supplier_failed", error: msg.slice(0, 300) })
      summary.push({ id: s.id, updated: 0, error: msg, observation: emptyPartnerStockObservation() })
    }
  }

  console.log("[sync-stock]", { runId, result: "run_observation", mode, suppliers: summary.length, ...observation })
  return Response.json({ ok: true, mode, runId, suppliers: summary.length, summary, observation })
}
