import { guardRefusalCode, guardSupplierPurchase } from "@/lib/supplier-purchase/guard.server"
import type {
  BlindCreateOrderInput,
  BlindCreateOrderResult,
  BlindStockRow,
  SupplierAdapter,
} from "@/lib/suppliers/types"

const GENERIC_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

type RestConfig = {
  createOrderPath?: string
  inventoryPath?: string
  /** `GET` path template; `{id}` replaced with supplier order id. Default `/orders/{id}`. */
  orderStatusPath?: string
  /** `POST` path template for cancel. Default `/orders/{id}/cancel`. */
  cancelOrderPath?: string
  /** Extra headers (values must not contain banned branding for partners). */
  extraHeaders?: Record<string, string>
}

export class RestSupplierAdapter implements SupplierAdapter {
  constructor(
    private readonly baseUrl: string,
    private readonly apiKey: string,
    private readonly cfg: RestConfig
  ) {}

  private url(path: string): string {
    const base = this.baseUrl.replace(/\/$/, "")
    const p = path.startsWith("/") ? path : `/${path}`
    return `${base}${p}`
  }

  private headers(): Record<string, string> {
    const h: Record<string, string> = {
      Authorization: `Bearer ${this.apiKey}`,
      "Content-Type": "application/json",
      "User-Agent": GENERIC_UA,
      Accept: "application/json",
      "X-Blind-Dropship": "true",
      ...(this.cfg.extraHeaders ?? {}),
    }
    return h
  }

  async createOrder(data: BlindCreateOrderInput): Promise<BlindCreateOrderResult> {
    const path = this.cfg.createOrderPath ?? "/orders"
    const keys = data.purchaseKeys?.length ? data.purchaseKeys : [`ref:${data.reference}@${this.url(path)}`]
    const guarded = await guardSupplierPurchase<BlindCreateOrderResult | null>(
      { channel: "partner_rest", path: "rest-adapter.createOrder", keys },
      async () => {
        let res: Response
        try {
          res = await fetch(this.url(path), {
            method: "POST",
            headers: this.headers(),
            body: JSON.stringify({
              shipping: data.shipping,
              items: data.items.map((i) => ({
                sku: i.sku,
                quantity: i.quantity,
                /** Wholesale only (integer cents) — never affiliate retail. */
                unit_price_cents: i.unit_price_cents,
              })),
              contact_email: data.contact_email,
              reference: data.reference,
            }),
          })
        } catch (e) {
          // No answer (timeout / reset): the partner may have created the order.
          return { kind: "uncertain", error: `uncertain:partner_create_order_no_answer:${e instanceof Error ? e.message : String(e)}`, value: null }
        }
        if (!res.ok) {
          const t = await res.text().catch(() => "")
          const error = `partner_create_order_failed:${res.status}:${t.slice(0, 500)}`
          // 4xx = the partner refused (nothing created); 5xx = unknown whether it was created.
          return res.status >= 400 && res.status < 500
            ? { kind: "rejected", error, value: null }
            : { kind: "uncertain", error: `uncertain:${error}`, value: null }
        }
        const json = (await res.json().catch(() => null)) as { supplier_order_id?: string; id?: string; order_id?: string } | null
        const supplier_order_id = json?.supplier_order_id ?? json?.order_id ?? json?.id
        if (!supplier_order_id || typeof supplier_order_id !== "string") {
          return { kind: "uncertain", error: "uncertain:partner_create_order_missing_id", value: null }
        }
        return { kind: "placed", supplierOrderId: supplier_order_id, value: { supplier_order_id } }
      },
    )
    if (guarded.kind === "already_placed") return { supplier_order_id: guarded.supplierOrderId }
    if (guarded.kind !== "sent") throw new Error(guardRefusalCode(guarded))
    const o = guarded.outcome
    if (o.kind === "placed") return { supplier_order_id: o.supplierOrderId }
    throw new Error(o.error)
  }

  private pathWithId(template: string, id: string): string {
    return template.replace(/\{id\}/g, encodeURIComponent(id))
  }

  async getOrderStatus(supplierOrderId: string): Promise<unknown> {
    const template = this.cfg.orderStatusPath ?? "/orders/{id}"
    const res = await fetch(this.url(this.pathWithId(template, supplierOrderId)), {
      method: "GET",
      headers: this.headers(),
      signal: AbortSignal.timeout(30_000),
    })
    if (!res.ok) {
      const t = await res.text().catch(() => "")
      throw new Error(`partner_order_status_failed:${res.status}:${t.slice(0, 500)}`)
    }
    return res.json().catch(() => ({}))
  }

  async cancelOrder(
    supplierOrderId: string,
    reason = "cancelled_by_affisell"
  ): Promise<{ cancelled: boolean; raw: unknown }> {
    const template = this.cfg.cancelOrderPath ?? "/orders/{id}/cancel"
    const res = await fetch(this.url(this.pathWithId(template, supplierOrderId)), {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({ reason }),
      signal: AbortSignal.timeout(30_000),
    })
    if (res.status === 404 || res.status === 405) {
      const del = await fetch(this.url(this.pathWithId("/orders/{id}", supplierOrderId)), {
        method: "DELETE",
        headers: this.headers(),
        signal: AbortSignal.timeout(30_000),
      })
      if (!del.ok) {
        const t = await del.text().catch(() => "")
        throw new Error(`partner_cancel_failed:${del.status}:${t.slice(0, 300)}`)
      }
      return { cancelled: true, raw: await del.json().catch(() => ({})) }
    }
    if (!res.ok) {
      const t = await res.text().catch(() => "")
      throw new Error(`partner_cancel_failed:${res.status}:${t.slice(0, 300)}`)
    }
    const raw = await res.json().catch(() => ({}))
    const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {}
    const cancelled = o.cancelled !== false && o.success !== false
    return { cancelled, raw }
  }

  async getStock(): Promise<BlindStockRow[]> {
    const path = this.cfg.inventoryPath ?? "/inventory"
    const res = await fetch(this.url(path), {
      method: "GET",
      headers: this.headers(),
    })
    if (!res.ok) {
      const t = await res.text().catch(() => "")
      throw new Error(`partner_inventory_failed:${res.status}:${t.slice(0, 300)}`)
    }
    const raw = (await res.json().catch(() => null)) as unknown
    const rows: BlindStockRow[] = []
    if (Array.isArray(raw)) {
      for (const row of raw) {
        if (!row || typeof row !== "object") continue
        const o = row as Record<string, unknown>
        const sku = typeof o.sku === "string" ? o.sku : typeof o.SKU === "string" ? o.SKU : ""
        const stock = typeof o.stock === "number" ? o.stock : Number(o.stock ?? o.quantity ?? 0)
        if (sku) rows.push({ sku, stock: Number.isFinite(stock) ? Math.max(0, Math.floor(stock)) : 0 })
      }
    }
    return rows
  }
}
