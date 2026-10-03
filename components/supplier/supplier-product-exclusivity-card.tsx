"use client"

import { useCallback, useEffect, useState } from "react"
import { useLocale, useTranslations } from "next-intl"
import { Loader2, Lock } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"

type Holder = { affiliateId: string; storeName: string | null; grantedAt: string | null; until: string; canRevoke: boolean }
type RequestRow = { id: string; affiliateId: string; storeName: string | null; message: string | null; createdAt: string }
type View = {
  holder: Holder | null
  requests: RequestRow[]
  liveListings: number
  rules: { minDays: number; maxDays: number; defaultDays: number; revokeWindowHours: number }
}
type EvictConfirm = { requestId?: string; storeSlug?: string; affiliateId?: string; days: number; count: number }

const TERMS = [30, 60, 90, 180, 365] as const
const KNOWN_ERRORS = new Set([
  "product_not_found",
  "not_a_marketplace_product",
  "affiliate_not_eligible",
  "store_not_found",
  "held_by_other",
  "revoke_window_closed",
  "not_exclusive",
])

/**
 * Supplier side of per-product reseller exclusivity: see the current holder, answer reseller requests, grant (with the
 * explicit choice to remove other resellers), extend, or cancel inside the cooling-off window.
 */
export function SupplierProductExclusivityCard({ productId }: { productId: string }) {
  const t = useTranslations("productExclusivity.supplier")
  const locale = useLocale()
  const [view, setView] = useState<View | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [storeSlug, setStoreSlug] = useState("")
  const [days, setDays] = useState<number>(90)
  const [evict, setEvict] = useState<EvictConfirm | null>(null)

  const endpoint = `/api/supplier/products/${encodeURIComponent(productId)}/exclusivity`
  const fmtDate = useCallback(
    (iso: string) => new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(new Date(iso)),
    [locale]
  )
  const errorText = (code: unknown) =>
    typeof code === "string" && KNOWN_ERRORS.has(code) ? t(`errors.${code}`) : t("errors.generic")

  const load = useCallback(async () => {
    try {
      const res = await fetch(endpoint, { credentials: "include", cache: "no-store" })
      if (!res.ok) throw new Error(String(res.status))
      const data = (await res.json()) as View
      setView(data)
      setDays(data.rules.defaultDays)
      setLoadFailed(false)
    } catch {
      setLoadFailed(true)
    }
  }, [endpoint])

  useEffect(() => {
    void load()
  }, [load])

  async function call(method: "POST" | "DELETE", body?: unknown): Promise<{ ok: boolean; status: number; data: Record<string, unknown> }> {
    setBusy(true)
    try {
      const res = await fetch(endpoint, {
        method,
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
      })
      const data = (await res.json().catch(() => ({}))) as Record<string, unknown>
      return { ok: res.ok, status: res.status, data }
    } catch {
      return { ok: false, status: 0, data: {} }
    } finally {
      setBusy(false)
    }
  }

  async function grant(args: { requestId?: string; storeSlug?: string; affiliateId?: string; days: number; evictOthers?: boolean }) {
    const res = await call("POST", { action: "grant", ...args })
    if (res.ok) {
      const until = fmtDate(String(res.data.until))
      const evicted = Number(res.data.evicted ?? 0)
      toast.success(evicted > 0 ? t("grantedEvicted", { date: until, count: evicted }) : t("granted", { date: until }))
      setEvict(null)
      setStoreSlug("")
      await load()
      return
    }
    if (res.data.error === "other_listings") {
      setEvict({ ...args, count: Number(res.data.otherListings ?? 0) })
      return
    }
    toast.error(errorText(res.data.error))
  }

  async function decline(requestId: string) {
    const res = await call("POST", { action: "decline", requestId })
    if (res.ok) {
      toast.success(t("declined"))
      await load()
    } else {
      toast.error(errorText(res.data.error))
    }
  }

  async function revoke() {
    const res = await call("DELETE")
    if (res.ok) {
      toast.success(t("revoked"))
      await load()
    } else {
      toast.error(errorText(res.data.error))
    }
  }

  return (
    <section
      data-testid="supplier-product-exclusivity"
      className="mt-8 rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900/60"
    >
      <h2 className="flex items-center gap-2 text-base font-semibold text-zinc-900 dark:text-zinc-50">
        <Lock className="size-4 text-violet-600" aria-hidden />
        {t("title")}
      </h2>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">{t("intro")}</p>

      {!view && !loadFailed ? (
        <p className="mt-4 flex items-center gap-2 text-sm text-zinc-500">
          <Loader2 className="size-4 animate-spin" aria-hidden /> {t("loading")}
        </p>
      ) : null}
      {loadFailed ? <p className="mt-4 text-sm text-red-600">{t("loadError")}</p> : null}

      {view ? (
        <div className="mt-4 space-y-5">
          {view.holder ? (
            <div className="rounded-xl border border-violet-200 bg-violet-50/70 p-4 dark:border-violet-900/60 dark:bg-violet-950/30">
              <p className="text-sm font-semibold text-violet-900 dark:text-violet-100">{t("holderTitle")}</p>
              <p className="mt-0.5 text-sm text-violet-800 dark:text-violet-200">
                {t("holderLine", { store: view.holder.storeName ?? view.holder.affiliateId, date: fmtDate(view.holder.until) })}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => void grant({ affiliateId: view.holder!.affiliateId, days: 30 })}
                >
                  {t("extend", { days: 30 })}
                </Button>
                {view.holder.canRevoke ? (
                  <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void revoke()}>
                    {t("revoke")}
                  </Button>
                ) : null}
              </div>
              <p className="mt-2 text-xs text-violet-800/80 dark:text-violet-200/80">
                {t(view.holder.canRevoke ? "revokeHint" : "noRevokeHint", { hours: view.rules.revokeWindowHours })}
              </p>
            </div>
          ) : (
            <>
              <div>
                <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">{t("requestsTitle")}</h3>
                {view.requests.length === 0 ? (
                  <p className="mt-1 text-sm text-zinc-500">{t("noRequests")}</p>
                ) : (
                  <ul className="mt-2 space-y-2">
                    {view.requests.map((r) => (
                      <li key={r.id} className="rounded-xl border border-zinc-200 p-3 dark:border-zinc-800">
                        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">{r.storeName ?? r.affiliateId}</p>
                        {r.message ? <p className="mt-0.5 text-sm text-zinc-600 dark:text-zinc-300">{r.message}</p> : null}
                        <div className="mt-2 flex flex-wrap gap-2">
                          <Button type="button" size="sm" disabled={busy} onClick={() => void grant({ requestId: r.id, days })}>
                            {t("accept")}
                          </Button>
                          <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void decline(r.id)}>
                            {t("decline")}
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <form
                className="space-y-3"
                onSubmit={(e) => {
                  e.preventDefault()
                  if (storeSlug.trim()) void grant({ storeSlug: storeSlug.trim(), days })
                }}
              >
                <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">{t("grantTitle")}</h3>
                <div className="grid gap-3 sm:grid-cols-[1fr_9rem]">
                  <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-300">
                    {t("storeSlugLabel")}
                    <input
                      value={storeSlug}
                      onChange={(e) => setStoreSlug(e.target.value)}
                      placeholder={t("storeSlugPlaceholder")}
                      className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                    />
                  </label>
                  <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-300">
                    {t("termLabel")}
                    <select
                      value={days}
                      onChange={(e) => setDays(Number(e.target.value))}
                      className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                    >
                      {TERMS.filter((d) => d >= view.rules.minDays && d <= view.rules.maxDays).map((d) => (
                        <option key={d} value={d}>
                          {t("termDays", { days: d })}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <Button type="submit" size="sm" disabled={busy || !storeSlug.trim()}>
                  {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
                  {t("grantCta")}
                </Button>
              </form>
            </>
          )}

          {evict ? (
            <div role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
              <p>{t("confirmEvict", { count: evict.count })}</p>
              <Button
                type="button"
                size="sm"
                className="mt-3"
                disabled={busy}
                onClick={() => void grant({ ...evict, evictOthers: true })}
              >
                {t("confirmEvictCta")}
              </Button>
            </div>
          ) : null}

          <p className="text-xs text-zinc-500 dark:text-zinc-400">{t("rules")}</p>
        </div>
      ) : null}
    </section>
  )
}
