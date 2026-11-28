import type { ChinaBuyAdapterResult } from "@/lib/china-buying/adapters/superbuy"
import { guardRefusalCode, guardSupplierPurchase } from "@/lib/supplier-purchase/guard.server"

/**
 * One guarded purchase at a China buying agent (Superbuy, Anovabuy). Same lock as every supplier purchase
 * (lib/supplier-purchase/guard.server.ts): policy `china_agent` + an atomic claim on the purchase keys — the agent's
 * own idempotency (ChinaBuyRouteLog.idempotencyKey, checked BEFORE the call and written AFTER it) cannot stop two
 * concurrent calls, the claim does. 4xx = refused (re-claimable); timeout / 5xx / no reference = uncertain (never
 * re-sent automatically); a missing reference is no longer invented (`<agent>_<timestamp>`).
 */
export async function chinaAgentPurchase(args: {
  agent: "superbuy" | "anovabuy"
  url: string
  headers: Record<string, string>
  body: Record<string, unknown>
  purchaseKeys: string[]
  refOf: (json: Record<string, unknown>) => string | undefined
  errorOf: (json: Record<string, unknown>) => string | undefined
}): Promise<ChinaBuyAdapterResult> {
  const guarded = await guardSupplierPurchase<ChinaBuyAdapterResult>(
    { channel: "china_agent", path: `china-buying.${args.agent}`, keys: args.purchaseKeys },
    async () => {
      let res: Response
      try {
        res = await fetch(args.url, { method: "POST", headers: args.headers, body: JSON.stringify(args.body) })
      } catch (e) {
        const error = `uncertain:${args.agent}_no_answer:${e instanceof Error ? e.message : String(e)}`
        return { kind: "uncertain", error, value: { ok: false, status: "API_FAIL", error } }
      }
      const json = ((await res.json().catch(() => ({}))) ?? {}) as Record<string, unknown>
      if (!res.ok) {
        const error = args.errorOf(json) ?? `${args.agent}_${res.status}`
        return res.status >= 400 && res.status < 500
          ? { kind: "rejected", error, value: { ok: false, status: "API_FAIL", error } }
          : {
              kind: "uncertain",
              error: `uncertain:${error}`,
              value: { ok: false, status: "API_FAIL", error: `uncertain:${error}` },
            }
      }
      const ref = args.refOf(json)
      if (!ref) {
        const error = `uncertain:${args.agent}_answer_without_reference`
        return { kind: "uncertain", error, value: { ok: false, status: "API_FAIL", error } }
      }
      return { kind: "placed", supplierOrderId: ref, value: { ok: true, status: "API_OK", externalRef: ref } }
    },
  )
  if (guarded.kind === "sent") return guarded.outcome.value
  if (guarded.kind === "already_placed") return { ok: true, status: "API_OK", externalRef: guarded.supplierOrderId }
  return { ok: false, status: "API_FAIL", error: guardRefusalCode(guarded) }
}
