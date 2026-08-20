"use client"

import { Suspense, useCallback, useState } from "react"
import Link from "next/link"
import {
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
  Loader2,
  Plug,
  RefreshCw,
  Shield,
  Sparkles,
  Store,
  Unplug,
  Webhook,
  Zap,
} from "lucide-react"
import { toast } from "sonner"

import { SupplierIntegrationsOAuthToast } from "@/components/supplier/supplier-integrations-oauth-toast"
import { buttonVariants } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import type { IntegrationSyncStats } from "@/lib/supplier/load-supplier-integrations"
import { cn } from "@/lib/utils"

export type IntegrationViewModel = {
  id: string
  platform: string
  name: string
  enabled: boolean
  config: Record<string, unknown>
  shopDomain?: string | null
  status?: string | null
  lastSyncAt: string | null
  lastSyncError: string | null
  syncStats: IntegrationSyncStats | null
  inboundUrl: string | null
  liveConnected: boolean
  productCount?: number
  decoupledProductCount?: number
}

type Props = {
  initialIntegrations: IntegrationViewModel[]
  schemaMode: "live" | "legacy"
  loadError?: string | null
  shopifyOAuthConfigured: boolean
  encryptionConfigured: boolean
}

function relativeTime(iso: string | null): string {
  if (!iso) return "Never"
  const diff = Date.now() - new Date(iso).getTime()
  if (diff < 60_000) return "Just now"
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} min ago`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} h ago`
  return new Date(iso).toLocaleString()
}

export function SupplierIntegrationsHub({
  initialIntegrations,
  schemaMode,
  loadError,
  shopifyOAuthConfigured,
  encryptionConfigured,
}: Props) {
  const [integrations, setIntegrations] = useState(initialIntegrations)
  const [listBusy, setListBusy] = useState(false)
  const [error, setError] = useState<string | null>(loadError ?? null)
  const [shop, setShop] = useState("")
  const [token, setToken] = useState("")
  const [intName, setIntName] = useState("main")
  const [busyId, setBusyId] = useState<string | null>(null)
  const [lastWebhookSecret, setLastWebhookSecret] = useState<string | null>(null)
  const [disconnectTarget, setDisconnectTarget] = useState<IntegrationViewModel | null>(null)

  const shopifyRow = integrations.find((r) => r.platform === "shopify")
  const shopifyConnected = Boolean(shopifyRow?.liveConnected)

  const load = useCallback(async () => {
    setListBusy(true)
    setError(null)
    try {
      const res = await fetch("/api/supplier/integrations", { cache: "no-store" })
      const data = (await res.json().catch(() => ({}))) as {
        integrations?: IntegrationViewModel[]
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

  function connectShopifyOAuth() {
    const host = shop.trim()
    if (!host) {
      setError("Enter your Shopify store domain (e.g. your-store.myshopify.com)")
      return
    }
    if (!shopifyOAuthConfigured) {
      setError("Add SHOPIFY_API_KEY, SHOPIFY_API_SECRET, and SHOPIFY_APP_URL to .env.local")
      return
    }
    if (!encryptionConfigured) {
      setError("Add ENCRYPTION_KEY (openssl rand -hex 32) to .env.local for OAuth tokens")
      return
    }
    window.location.href = `/api/integrations/shopify/auth?shop=${encodeURIComponent(host)}`
  }

  async function liveSyncShopify(integrationId?: string) {
    setError(null)
    setBusyId("live-sync")
    const res = await fetch("/api/integrations/shopify/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(integrationId ? { integrationId } : {}),
    })
    const data = (await res.json().catch(() => ({}))) as {
      error?: string
      syncedCount?: number
      jobId?: string
    }
    setBusyId(null)
    if (!res.ok) {
      setError(data.error ?? "Live sync failed")
      return
    }
    toast.success(`Sync complete — ${data.syncedCount ?? 0} products processed`)
    await load()
  }

  async function confirmDecouple() {
    if (!disconnectTarget) return
    setError(null)
    setBusyId("decouple")
    const res = await fetch("/api/integrations/shopify/disconnect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ integrationId: disconnectTarget.id }),
    })
    const data = (await res.json().catch(() => ({}))) as {
      error?: string
      productsDecoupled?: number
      message?: string
    }
    setBusyId(null)
    setDisconnectTarget(null)
    if (!res.ok) {
      setError(data.error ?? "Disconnect failed")
      return
    }
    toast.success(
      data.message ??
        `${data.productsDecoupled ?? 0} products kept on Affisell — zero lock-in.`
    )
    await load()
  }

  async function addShopifyManual() {
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
    toast.success("Manual Shopify token saved")
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
    if (data.integration?.webhookSecretPlain) setLastWebhookSecret(data.integration.webhookSecretPlain)
    toast.success("Webhook endpoint created")
    await load()
  }

  async function removeIntegration(id: string) {
    const row = integrations.find((r) => r.id === id)
    if (row?.liveConnected || row?.platform === "shopify") {
      setDisconnectTarget(row ?? { id, platform: "shopify", name: "main", enabled: true, config: {}, lastSyncAt: null, lastSyncError: null, syncStats: null, inboundUrl: null, liveConnected: true })
      return
    }
    if (!confirm("Disconnect this integration?")) return
    await fetch(`/api/supplier/integrations/${id}`, { method: "DELETE" })
    toast.success("Integration removed")
    await load()
  }

  const stats = shopifyRow?.syncStats

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <Link
        href="/dashboard/supplier"
        className={cn(
          buttonVariants({ variant: "ghost", size: "sm" }),
          "-ml-2 mb-6 inline-flex gap-2 text-zinc-600 dark:text-zinc-300"
        )}
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Back to supplier dashboard
      </Link>

      <div className="relative mb-8 overflow-hidden rounded-3xl border border-violet-200/60 bg-gradient-to-br from-violet-600/[0.08] via-white to-fuchsia-500/[0.06] p-6 shadow-[0_24px_80px_-40px_rgba(91,33,217,0.45)] dark:border-violet-500/20 dark:from-violet-950/40 dark:via-zinc-950 dark:to-fuchsia-950/20 sm:p-8">
        <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-violet-500/10 blur-3xl" aria-hidden />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-600 dark:text-violet-300">
              Live catalog mirror
            </p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-3xl">
              Platform sync
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">
              Connect Shopify once — clone your catalog into Affisell. Disconnect anytime: products
              stay yours. Zero lock-in. Clone &amp; Own.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200/80 bg-emerald-50/90 px-3 py-1 text-xs font-semibold text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-200">
              <Shield className="h-3.5 w-3.5" aria-hidden />
              AES-256-GCM
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-violet-200/80 bg-violet-50/90 px-3 py-1 text-xs font-semibold text-violet-800 dark:border-violet-900/50 dark:bg-violet-950/40 dark:text-violet-200">
              <Zap className="h-3.5 w-3.5" aria-hidden />
              Event-driven
            </span>
          </div>
        </div>

        {schemaMode === "legacy" ? (
          <p className="relative mt-4 rounded-xl border border-amber-200/80 bg-amber-50/90 px-3 py-2 text-xs text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100">
            Database schema pending — run <code className="font-mono">npx prisma migrate deploy</code> then{" "}
            <code className="font-mono">npm run dev:restart</code> for full live sync.
          </p>
        ) : null}
      </div>

      {error ? (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="relative overflow-hidden border-violet-200/70 p-6 dark:border-violet-900/40 lg:col-span-3">
          <div className="flex items-center gap-2">
            <Store className="h-5 w-5 text-violet-600 dark:text-violet-300" aria-hidden />
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Shopify Live Sync</h2>
          </div>

          {shopifyConnected && shopifyRow ? (
            <div className="mt-5 space-y-4">
              <div className="flex items-start gap-3 rounded-2xl border border-emerald-200/80 bg-emerald-50/70 p-4 dark:border-emerald-900/40 dark:bg-emerald-950/25">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <div className="min-w-0">
                  <p className="font-semibold text-emerald-900 dark:text-emerald-100">
                    Connected · {shopifyRow.shopDomain ?? "Shopify"}
                  </p>
                  <p className="mt-1 text-xs text-emerald-800/90 dark:text-emerald-200/90">
                    Last sync {relativeTime(shopifyRow.lastSyncAt)}
                    {shopifyRow.status === "ERROR" ? " · needs attention" : " · live"}
                  </p>
                  {shopifyRow.lastSyncError ? (
                    <p className="mt-2 text-xs text-red-600 dark:text-red-400">{shopifyRow.lastSyncError}</p>
                  ) : null}
                </div>
              </div>

              {stats ? (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {[
                    { label: "Fetched", value: stats.fetched },
                    { label: "New", value: stats.created },
                    { label: "Updated", value: stats.updated },
                    { label: "Skipped", value: stats.skipped },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className="rounded-xl border border-zinc-200/80 bg-zinc-50/80 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900/50"
                    >
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                        {item.label}
                      </p>
                      <p className="mt-1 text-xl font-bold tabular-nums text-zinc-900 dark:text-zinc-50">
                        {item.value}
                      </p>
                    </div>
                  ))}
                </div>
              ) : null}

              {(shopifyRow.productCount ?? 0) > 0 ? (
                <Link
                  href="/dashboard/supplier/products"
                  className="inline-flex items-center gap-2 text-sm font-medium text-violet-700 hover:underline dark:text-violet-300"
                >
                  <ExternalLink className="h-4 w-4" aria-hidden />
                  View {shopifyRow.productCount} synced products
                  {(shopifyRow.decoupledProductCount ?? 0) > 0
                    ? ` (${shopifyRow.decoupledProductCount} native)`
                    : null}
                </Link>
              ) : null}

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className={cn(buttonVariants(), "gap-2")}
                  disabled={busyId === "live-sync"}
                  onClick={() => void liveSyncShopify(shopifyRow.id)}
                >
                  {busyId === "live-sync" ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  ) : (
                    <RefreshCw className="h-4 w-4" aria-hidden />
                  )}
                  Sync now
                </button>
                <button
                  type="button"
                  className={cn(buttonVariants({ variant: "outline" }), "gap-2")}
                  onClick={() => setDisconnectTarget(shopifyRow)}
                >
                  <Unplug className="h-4 w-4" aria-hidden />
                  Disconnect
                </button>
              </div>
            </div>
          ) : shopifyRow?.status === "DISCONNECTED" ? (
            <div className="mt-5 space-y-4">
              <div className="rounded-2xl border border-zinc-200/80 bg-zinc-50/80 p-4 dark:border-zinc-700 dark:bg-zinc-900/40">
                <p className="font-semibold text-zinc-800 dark:text-zinc-100">
                  Disconnected · {shopifyRow.shopDomain ?? "Shopify"}
                </p>
                <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                  {shopifyRow.productCount ?? 0} products remain active on Affisell (Clone &amp; Own).
                  Edit stock and price manually in your catalog.
                </p>
              </div>
              <label className="block text-xs font-medium uppercase tracking-wide text-zinc-500">
                Reconnect store domain
                <input
                  className="mt-2 w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm shadow-sm dark:border-zinc-700 dark:bg-zinc-950"
                  placeholder="your-brand.myshopify.com"
                  value={shop}
                  onChange={(e) => setShop(e.target.value)}
                  autoComplete="off"
                />
              </label>
              <button
                type="button"
                className={cn(buttonVariants(), "gap-2")}
                onClick={connectShopifyOAuth}
              >
                <Plug className="h-4 w-4" aria-hidden />
                Reconnect Shopify
              </button>
            </div>
          ) : (
            <div className="mt-5 space-y-4">
              <label className="block text-xs font-medium uppercase tracking-wide text-zinc-500">
                Store domain
                <input
                  className="mt-2 w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm shadow-sm dark:border-zinc-700 dark:bg-zinc-950"
                  placeholder="your-brand.myshopify.com"
                  value={shop}
                  onChange={(e) => setShop(e.target.value)}
                  autoComplete="off"
                />
              </label>
              <button
                type="button"
                className={cn(buttonVariants({ size: "lg" }), "w-full gap-2 sm:w-auto")}
                onClick={connectShopifyOAuth}
              >
                <Plug className="h-4 w-4" aria-hidden />
                Connect Shopify
              </button>
              {!shopifyOAuthConfigured || !encryptionConfigured ? (
                <p className="text-xs text-zinc-500">
                  Dev setup: add{" "}
                  <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">SHOPIFY_*</code> and{" "}
                  <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">ENCRYPTION_KEY</code> to{" "}
                  <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">.env.local</code>
                </p>
              ) : null}
            </div>
          )}

          <details className="mt-6 rounded-xl border border-zinc-200/80 p-4 dark:border-zinc-700">
            <summary className="cursor-pointer text-sm font-medium text-zinc-600 dark:text-zinc-400">
              Advanced — manual Admin API token
            </summary>
            <div className="mt-4 space-y-3">
              <input
                className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                placeholder="Connection name"
                value={intName}
                onChange={(e) => setIntName(e.target.value)}
              />
              <input
                className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                type="password"
                placeholder="Admin API access token"
                value={token}
                onChange={(e) => setToken(e.target.value)}
              />
              <button
                type="button"
                className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                disabled={busyId === "new-shopify"}
                onClick={() => void addShopifyManual()}
              >
                Save manual token
              </button>
            </div>
          </details>
        </Card>

        <Card className="border-zinc-200/80 p-6 dark:border-zinc-700 lg:col-span-2">
          <div className="flex items-center gap-2">
            <Webhook className="h-5 w-5 text-zinc-700 dark:text-zinc-200" aria-hidden />
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Inbound webhook</h2>
          </div>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Push product drafts from Zapier, Make, or your ERP — idempotent, signed payloads.
          </p>
          <button
            type="button"
            className={cn(buttonVariants({ variant: "outline" }), "mt-4 w-full")}
            disabled={busyId === "new-webhook"}
            onClick={() => void addWebhook()}
          >
            {busyId === "new-webhook" ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Sparkles className="mr-2 h-4 w-4" aria-hidden />
            )}
            Create webhook endpoint
          </button>
          {lastWebhookSecret ? (
            <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs dark:border-amber-900 dark:bg-amber-950/30">
              Secret (copy now): <code className="break-all font-mono">{lastWebhookSecret}</code>
            </p>
          ) : null}
        </Card>
      </div>

      <Card className="mt-6 border-zinc-200/80 p-6 opacity-80 dark:border-zinc-700">
        <div className="flex items-center gap-2">
          <Store className="h-5 w-5 text-zinc-400" aria-hidden />
          <h2 className="text-lg font-semibold text-zinc-700 dark:text-zinc-300">WooCommerce</h2>
          <span className="rounded-full bg-zinc-200 px-2 py-0.5 text-[10px] font-bold uppercase text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
            Soon
          </span>
        </div>
        <p className="mt-2 text-sm text-zinc-500">
          Same Clone &amp; Own flow — sync once, disconnect, keep selling natively on Affisell.
        </p>
      </Card>

      {disconnectTarget ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="decouple-title"
        >
          <div className="max-w-md rounded-2xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-700 dark:bg-zinc-950">
            <h3 id="decouple-title" className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              Disconnect {disconnectTarget.shopDomain ?? disconnectTarget.platform}?
            </h3>
            <p className="mt-3 text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">
              Your products will stay active on Affisell. You can keep selling without Shopify.
              Stock is frozen at the last sync — edit it manually anytime. Zero lock-in.
            </p>
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                className={cn(buttonVariants({ variant: "outline" }))}
                disabled={busyId === "decouple"}
                onClick={() => setDisconnectTarget(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className={cn(buttonVariants({ variant: "destructive" }), "gap-2")}
                disabled={busyId === "decouple"}
                onClick={() => void confirmDecouple()}
              >
                {busyId === "decouple" ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <Unplug className="h-4 w-4" aria-hidden />
                )}
                Confirm disconnect
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="mt-8">
        <div className="mb-4 flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">All connections</h2>
          <button
            type="button"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-2")}
            disabled={listBusy}
            onClick={() => void load()}
          >
            {listBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Refresh
          </button>
        </div>
        {listBusy && integrations.length === 0 ? (
          <div className="space-y-3">
            <div className="h-24 animate-pulse rounded-2xl bg-zinc-100 dark:bg-zinc-800" />
            <div className="h-24 animate-pulse rounded-2xl bg-zinc-100 dark:bg-zinc-800" />
          </div>
        ) : integrations.length === 0 ? (
          <p className="text-sm text-zinc-500">No integrations yet — connect Shopify above.</p>
        ) : (
          <ul className="space-y-3">
            {integrations.map((row) => (
              <li
                key={row.id}
                className="rounded-2xl border border-zinc-200/80 bg-white/80 p-4 dark:border-zinc-700 dark:bg-zinc-950/50"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-medium capitalize text-zinc-900 dark:text-zinc-50">
                      {row.platform} · {row.name}
                    </p>
                    <p className="text-xs text-zinc-500">
                      {row.enabled ? "Enabled" : "Disabled"} · sync {relativeTime(row.lastSyncAt)}
                    </p>
                  </div>
                  {row.liveConnected ? (
                    <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                      Live
                    </span>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Suspense fallback={null}>
        <SupplierIntegrationsOAuthToast />
      </Suspense>
    </div>
  )
}