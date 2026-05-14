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
    const res = await fetch(this.url(path), {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({
        shipping: data.shipping,
        items: data.items.map((i) => ({
          sku: i.sku,
          quantity: i.quantity,
          price: i.unit_price_cents / 100,
        })),
        contact_email: data.contact_email,
        reference: data.reference,
      }),
    })
    if (!res.ok) {
      const t = await res.text().catch(() => "")
      throw new Error(`partner_create_order_failed:${res.status}:${t.slice(0, 500)}`)
    }
    const json = (await res.json().catch(() => null)) as { supplier_order_id?: string; id?: string; order_id?: string }
    const supplier_order_id = json?.supplier_order_id ?? json?.order_id ?? json?.id
    if (!supplier_order_id || typeof supplier_order_id !== "string") {
      throw new Error("partner_create_order_missing_id")
    }
    return { supplier_order_id }
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
