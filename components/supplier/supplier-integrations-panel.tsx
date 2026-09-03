"use client"

import { useCallback, useMemo, useState } from "react"
import { CheckCircle2, Loader2, Plug, RefreshCw, Webhook } from "lucide-react"
import { toast } from "sonner"

import { buttonVariants } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"

type IntegrationRow = {
  id: string
  platform: string
  name: string
  enabled: boolean
  config: Record<string, unknown>
  shopDomain?: string | null
  status?: string | null
  lastSyncAt: string | null
  lastSyncError: string | null
  lastSyncSummary: unknown
  inboundUrl: string | null
}

type Props = { initialIntegrations: IntegrationRow[] }

export function SupplierIntegrationsPanel({ initialIntegrations }: Props) {
  const [integrations, setIntegrations] = useState(initialIntegrations)
  const [listBusy, setListBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [shop, setShop] = useState("")
  const [token, setToken] = useState("")
  const [intName, setIntName] = useState("main")
  const [busyId, setBusyId] = useState<string | null>(null)
  const [previewById, setPreviewById] = useState<Record<string, unknown>>({})
  const [lastWebhookSecret, setLastWebhookSecret] = useState<string | null>(null)

  const load = useCallback(async () => {
    setListBusy(true)
    setError(null)
    try {
      const res = await fetch("/api/supplier/integrations", { cache: "no-store" })
      const data = (await res.json().catch(() => ({}))) as {
        integrations?: IntegrationRow[]
        error?: string
      }
      if (!res.ok) {
        setError(data.error ?? "Could not load integrations")
        return
      }
      setIntegrations(data.integrations ?? [])
    } finally {
      setListBusy(false)
    }
  }, [])

  async function addShopify() {
    setError(null)
    setBusyId("new-shopify")
    const res = await fetch("/api/supplier/integrations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        platform: "shopify",
        name: intName || "main",
        config: { shop, accessToken: token },
      }),
    })
    const data = (await res.json().catch(() => ({}))) as { error?: string }
    setBusyId(null)
    if (!res.ok) {
      setError(data.error ?? "Could not save Shopify connection")
      return
    }
    setToken("")
    await load()
  }

  async function addWebhook() {
    setError(null)
    setBusyId("new-webhook")
    const res = await fetch("/api/supplier/integrations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ platform: "webhook", name: intName || "main" }),
    })
    const data = (await res.json().catch(() => ({}))) as {
      error?: string
      integration?: { webhookSecretPlain?: string }
    }
    setBusyId(null)
    if (!res.ok) {
      setError(data.error ?? "Could not create webhook")
      return
    }
    if (data.integration?.webhookSecretPlain)
      setLastWebhookSecret(data.integration.webhookSecretPlain)
    await load()
  }

  const shopifyLive = useMemo(
    () =>
      integrations.find(
        (r) =>
          r.platform === "shopify" &&
          r.enabled &&
          (r.status === "CONNECTED" || Boolean(r.config?.oauth))
      ),
    [integrations]
  )

  function connectShopifyOAuth() {
    const host = shop.trim()
    if (!host) {
      setError("Enter your Shopify store hostname first")
      return
    }
    window.location.href = `/api/integrations/shopify/auth?shop=${encodeURIComponent(host)}`
  }

  async function liveSyncShopify() {
    setError(null)
    setBusyId("live-sync")
    const res = await fetch("/api/integrations/shopify/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    })
    const data = (await res.json().catch(() => ({}))) as {
      error?: string
      syncedCount?: number
      summary?: { created?: number; updated?: number; skipped?: number }
    }
    setBusyId(null)
    if (!res.ok) {
      setError(data.error ?? "Live sync failed")
      return
    }
    toast.success(`Sync terminée — ${data.syncedCount ?? 0} produit(s) traités`)
    await load()
  }

  async function syncShopify(id: string) {
    if (shopifyLive?.id === id && shopifyLive.config?.oauth) {
      await liveSyncShopify()
      return
    }
    setError(null)
    setBusyId(id)
    const res = await fetch(`/api/supplier/integrations/${id}/shopify-sync`, {
      method: "POST",
    })
    const data = (await res.json().catch(() => ({}))) as {
      error?: string
      summary?: unknown
    }
    setBusyId(null)
    if (!res.ok) setError(data.error ?? "Shopify sync failed")
    await load()
  }

  async function previewShopify(id: string) {
    setError(null)
    setBusyId(`pv-${id}`)
    const res = await fetch(`/api/supplier/integrations/${id}/shopify-preview`, {
      cache: "no-store",
    })
    const data = (await res.json().catch(() => ({}))) as {
      error?: string
      preview?: unknown[]
    }
    setBusyId(null)
    if (!res.ok) {
      setError(data.error ?? "Preview unavailable")
      return
    }
    setPreviewById((m) => ({ ...m, [id]: data.preview ?? [] }))
  }

  async function toggleEnabled(id: string, enabled: boolean) {
    await fetch(`/api/supplier/integrations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: !enabled }),
    })
    await load()
  }

  async function toggleAutoSync(id: string, config: Record<string, unknown>) {
    const next = config.autoSync !== false ? false : true
    setBusyId(`as-${id}`)
    const res = await fetch(`/api/supplier/integrations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ config: { autoSync: next } }),
    })
    setBusyId(null)
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      setError(data.error ?? "Could not update auto-sync")
      return
    }
    await load()
  }

  async function removeIntegration(id: string) {
    if (!confirm("Remove this integration?")) return
    await fetch(`/api/supplier/integrations/${id}`, { method: "DELETE" })
    await load()
  }

  return (
    <div className="space-y-8">
      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </p>
      ) : null}

      <Card className="border-violet-200/80 bg-gradient-to-br from-violet-50/80 to-white p-5 dark:border-violet-900/50 dark:from-violet-950/30 dark:to-zinc-950">
        <h2 className="font-semibold text-zinc-900 dark:text-zinc-50">Blind dropship API (optional)</h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Parallel to native Affisell listings: partner REST receives <strong>wholesale cost only</strong>, ships to the
          shopper address we pass through, and posts tracking to a signed webhook. Configure with{" "}
          <code className="rounded bg-white/80 px-1 text-xs dark:bg-zinc-900/80">PUT /api/supplier/blind-dropship-profile</code>{" "}
          (supplier session). Set <code className="rounded bg-white/80 px-1 text-xs dark:bg-zinc-900/80">supplierSku</code>{" "}
          + <code className="rounded bg-white/80 px-1 text-xs dark:bg-zinc-900/80">supplierWholesaleCents</code> on each
          catalog product, then checkout with{" "}
          <code className="rounded bg-white/80 px-1 text-xs dark:bg-zinc-900/80">checkoutMode: &quot;blind_dropship&quot;</code>.
        </p>
      </Card>

      <Card className="border-zinc-200 p-5 dark:border-zinc-700">
        <h2 className="font-semibold text-zinc-900 dark:text-zinc-50">New integration</h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          If you use more than one connection, give each a short name (e.g.{" "}
          <span className="font-medium text-zinc-700 dark:text-zinc-300">main</span> or your region).
        </p>
        <label className="mt-3 block text-xs font-medium uppercase tracking-wide text-zinc-500">
          Connection name
          <input
            className="mt-1 w-full max-w-md rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            value={intName}
            onChange={(e) => setIntName(e.target.value)}
          />
        </label>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <div>
            <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-50">Shopify Live Sync</h3>
            <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
              OAuth sécurisé — stock & prix miroir en temps réel via webhooks. Tokens chiffrés AES-256.
            </p>
            {shopifyLive ? (
              <div className="mt-3 rounded-lg border border-emerald-200/80 bg-emerald-50/80 px-3 py-2 text-sm dark:border-emerald-900/50 dark:bg-emerald-950/30">
                <p className="flex items-center gap-2 font-medium text-emerald-800 dark:text-emerald-200">
                  <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />
                  Connecté — {shopifyLive.shopDomain ?? String(shopifyLive.config.shop ?? "Shopify")}
                </p>
                <p className="mt-1 text-xs text-emerald-700/90 dark:text-emerald-300/90">
                  {shopifyLive.lastSyncAt
                    ? `Dernière sync ${new Date(shopifyLive.lastSyncAt).toLocaleString()}`
                    : "Sync initiale en cours…"}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    className={cn(buttonVariants({ size: "sm" }), "gap-1.5")}
                    disabled={busyId === "live-sync" || busyId === shopifyLive.id}
                    onClick={() => void liveSyncShopify()}
                  >
                    {busyId === "live-sync" ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                    ) : (
                      <RefreshCw className="h-3.5 w-3.5" aria-hidden />
                    )}
                    Resync
                  </button>
                  <button
                    type="button"
                    className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                    onClick={() => void removeIntegration(shopifyLive.id)}
                  >
                    Disconnect
                  </button>
                </div>
              </div>
            ) : (
              <>
                <label className="mt-3 block text-xs font-medium text-zinc-500">
                  Store domain
                  <input
                    className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                    placeholder="your-store.myshopify.com"
                    value={shop}
                    onChange={(e) => setShop(e.target.value)}
                    autoComplete="off"
                  />
                </label>
                <button
                  type="button"
                  className={cn(buttonVariants(), "mt-3 gap-2")}
                  disabled={busyId === "oauth-shopify"}
                  onClick={connectShopifyOAuth}
                >
                  <Plug className="h-4 w-4" aria-hidden />
                  Connecter Shopify
                </button>
              </>
            )}

            <details className="mt-4 rounded-md border border-zinc-200/80 p-3 dark:border-zinc-700">
              <summary className="cursor-pointer text-xs font-medium text-zinc-600 dark:text-zinc-400">
                Advanced — Admin API token (legacy)
              </summary>
              <p className="mt-2 text-xs text-zinc-500">
                Manual token import — use OAuth above for live sync + webhooks.
              </p>
              <label className="mt-3 block text-xs font-medium text-zinc-500">
                Access token
                <input
                  className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                  type="password"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  autoComplete="off"
                />
              </label>
              <button
                type="button"
                className={cn(buttonVariants({ variant: "outline", size: "sm" }), "mt-3")}
                disabled={busyId === "new-shopify"}
                onClick={() => void addShopify()}
              >
                {busyId === "new-shopify" ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                ) : null}
                Save manual token
              </button>
            </details>
          </div>

          <div>
            <h3 className="flex items-center gap-2 text-sm font-medium text-zinc-900 dark:text-zinc-50">
              <Webhook className="h-4 w-4" aria-hidden />
              Inbound webhook
            </h3>
            <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
              Creates a private URL and secret to push product drafts automatically from Zapier,
              Make, or your own system.
            </p>
            <button
              type="button"
              className={cn(buttonVariants({ variant: "outline" }), "mt-3")}
              disabled={busyId === "new-webhook"}
              onClick={() => void addWebhook()}
            >
              {busyId === "new-webhook" ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
              ) : null}
              Create webhook + secret
            </button>
            {lastWebhookSecret ? (
              <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
                Secret (copy now; shown once):{" "}
                <code className="break-all font-mono">{lastWebhookSecret}</code>
              </p>
            ) : null}
          </div>
        </div>
      </Card>

      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            Saved integrations
          </h2>
          <button
            type="button"
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              "inline-flex gap-2"
            )}
            disabled={listBusy}
            onClick={() => void load()}
          >
            {listBusy ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <RefreshCw className="h-4 w-4" aria-hidden />
            )}
            Refresh
          </button>
        </div>
        {integrations.length === 0 ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">None yet.</p>
        ) : (
          integrations.map((row) => (
            <Card
              key={row.id}
              className="border-zinc-200 p-4 dark:border-zinc-700"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-zinc-900 dark:text-zinc-50">
                    {row.platform === "shopify" ? "Shopify" : "Webhook"} — {row.name}
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">
                    {row.lastSyncAt
                      ? `Last sync: ${new Date(row.lastSyncAt).toLocaleString()}`
                      : "Never synced"}
                  </p>
                  {row.lastSyncError ? (
                    <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                      {row.lastSyncError}
                    </p>
                  ) : null}
                  {row.inboundUrl ? (
                    <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-400">
                      URL for your automation tool:{" "}
                      <span className="break-all font-mono text-zinc-800 dark:text-zinc-200">
                        {row.inboundUrl}
                      </span>
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  {row.platform === "shopify" ? (
                    <>
                      <label className="flex cursor-pointer items-center gap-2 rounded-md border border-zinc-200 px-2 py-1 text-xs dark:border-zinc-700">
                        <input
                          type="checkbox"
                          className="rounded"
                          checked={row.config.autoSync !== false}
                          disabled={busyId === `as-${row.id}`}
                          onChange={() => void toggleAutoSync(row.id, row.config)}
                        />
                        Auto-sync (cron)
                      </label>
                      <button
                        type="button"
                        className={cn(buttonVariants({ size: "sm", variant: "outline" }))}
                        disabled={busyId === `pv-${row.id}`}
                        onClick={() => void previewShopify(row.id)}
                      >
                        Mapping preview
                      </button>
                      <button
                        type="button"
                        className={cn(buttonVariants({ size: "sm" }))}
                        disabled={busyId === row.id}
                        onClick={() => void syncShopify(row.id)}
                      >
                        {busyId === row.id ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                        ) : (
                          <RefreshCw className="mr-2 h-4 w-4" aria-hidden />
                        )}
                        Sync now
                      </button>
                    </>
                  ) : null}
                  <button
                    type="button"
                    className={cn(
                      buttonVariants({ size: "sm", variant: "secondary" })
                    )}
                    onClick={() => void toggleEnabled(row.id, row.enabled)}
                  >
                    {row.enabled ? "Disable" : "Enable"}
                  </button>
                  <button
                    type="button"
                    className={cn(buttonVariants({ size: "sm", variant: "destructive" }))}
                    onClick={() => void removeIntegration(row.id)}
                  >
                    Remove
                  </button>
                </div>
              </div>
              {row.platform === "shopify" && previewById[row.id] ? (
                <pre className="mt-3 max-h-40 overflow-auto rounded-md bg-zinc-100 p-2 text-xs dark:bg-zinc-900">
                  {JSON.stringify(previewById[row.id], null, 2)}
                </pre>
              ) : null}
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
