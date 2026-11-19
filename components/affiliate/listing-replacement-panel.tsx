"use client"

import Link from "next/link"
import { useTranslations } from "next-intl"
import { useCallback, useEffect, useState } from "react"

import { formatStoreCurrencyFromCents } from "@/lib/market-config"
import type { Alternative, Difference, ReplacementProposal } from "@/lib/reseller-replacement/match"

type Payload = ReplacementProposal & { listingIsListed: boolean }
type Done = { kind: "replaced"; live: boolean; withdrawn: boolean } | { kind: "withdrawn" }

const money = (c: number) => formatStoreCurrencyFromCents(c, { maximumFractionDigits: 2 })
const MONEY_FIELDS = new Set<Difference["field"]>(["selling_price", "net_per_sale", "supplier_price"])

/**
 * Replace an unsellable product: the problem in one sentence, the reliable alternatives with the reseller's real net
 * per sale and the differences, then one explicit confirmation. Nothing is deleted; past orders are untouched.
 */
export function ListingReplacementPanel({ listingId }: { listingId: string }) {
  const t = useTranslations("affiliate.replacement")
  const [data, setData] = useState<Payload | null>(null)
  const [state, setState] = useState<"loading" | "ready" | "error" | "busy">("loading")
  const [pending, setPending] = useState<string | "withdraw" | null>(null)
  const [done, setDone] = useState<Done | null>(null)
  const [msg, setMsg] = useState<string | null>(null)

  const load = useCallback(async () => {
    setState("loading")
    const res = await fetch(`/api/affiliate/listings/${encodeURIComponent(listingId)}/replacement`, {
      cache: "no-store",
      credentials: "include",
    }).catch(() => null)
    if (!res?.ok) {
      setState("error")
      return
    }
    setData((await res.json()) as Payload)
    setState("ready")
  }, [listingId])

  useEffect(() => {
    void load()
  }, [load])

  const act = async (body: Record<string, unknown>) => {
    setState("busy")
    setMsg(null)
    const res = await fetch(`/api/affiliate/listings/${encodeURIComponent(listingId)}/replacement`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ ...body, confirm: true }),
    }).catch(() => null)
    const json = (await res?.json().catch(() => null)) as
      | { ok?: boolean; newListingLive?: boolean; previousListingWithdrawn?: boolean; error?: string }
      | null
    setPending(null)
    if (!res?.ok || !json) {
      setMsg(t(json?.error === "alternative_not_offered" ? "errorChanged" : "error"))
      setState("ready")
      if (json?.error === "alternative_not_offered") void load()
      return
    }
    setDone(
      body.action === "withdraw"
        ? { kind: "withdrawn" }
        : { kind: "replaced", live: Boolean(json.newListingLive), withdrawn: Boolean(json.previousListingWithdrawn) }
    )
    setState("ready")
  }

  if (state === "loading") return <p className="text-sm text-zinc-500">{t("loading")}</p>
  if (state === "error" || !data) {
    return (
      <div className="rounded-xl border border-zinc-200 p-4 text-sm dark:border-zinc-800">
        <p>{t("error")}</p>
        <button type="button" className="mt-2 font-medium text-violet-700 underline" onClick={() => void load()}>
          {t("retry")}
        </button>
      </div>
    )
  }

  if (done) {
    return (
      <section className="space-y-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100" role="status">
        <p className="font-semibold">
          {done.kind === "withdrawn" ? t("doneWithdrawn") : done.live ? t("doneReplaced") : t("doneReplacedPending")}
        </p>
        {done.kind === "replaced" && !done.withdrawn ? <p>{t("doneOldKept")}</p> : null}
        <p className="text-xs">{t("historyKept")}</p>
        <Link href="/dashboard/affiliate" className="inline-block font-medium underline">
          {t("backToShop")}
        </Link>
      </section>
    )
  }

  const o = data.original
  return (
    <section className="space-y-5" aria-labelledby="replace-title">
      <header className="space-y-1">
        <h1 id="replace-title" className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
          {t("title", { product: o.name })}
        </h1>
        <p className="text-sm text-zinc-700 dark:text-zinc-300">
          {o.problem ? t(`problem.${o.problem}`) : t("problem.none")}
        </p>
        <p className="text-xs text-zinc-500">
          {t("currentLine", { price: money(o.sellingPriceHtCents), net: money(data.originalNet.netCents) })}
        </p>
      </header>

      {data.status === "none" ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
          <p className="font-medium">{t(`none.${data.reason}`)}</p>
          <p className="mt-1">{t("noneHint")}</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {data.alternatives.map((a) => (
            <AlternativeCard
              key={a.productId}
              a={a}
              confirming={pending === a.productId}
              busy={state === "busy"}
              onAsk={() => setPending(a.productId)}
              onCancel={() => setPending(null)}
              onConfirm={() => void act({ action: "replace", productId: a.productId })}
            />
          ))}
        </ul>
      )}

      {data.listingIsListed ? (
        <div className="rounded-xl border border-zinc-200 p-4 text-sm dark:border-zinc-800">
          {pending === "withdraw" ? (
            <div className="flex flex-wrap items-center gap-2">
              <span>{t("withdrawConfirm")}</span>
              <button type="button" disabled={state === "busy"} onClick={() => void act({ action: "withdraw" })} className="rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900">
                {t("withdrawYes")}
              </button>
              <button type="button" onClick={() => setPending(null)} className="text-xs underline">
                {t("cancel")}
              </button>
            </div>
          ) : (
            <button type="button" onClick={() => setPending("withdraw")} className="font-medium text-zinc-700 underline dark:text-zinc-300">
              {t("withdrawOnly")}
            </button>
          )}
        </div>
      ) : null}

      {msg ? <p className="text-sm text-red-700" role="alert">{msg}</p> : null}
      <p className="text-xs text-zinc-500">{t("honesty")}</p>
    </section>
  )
}

function AlternativeCard(props: {
  a: Alternative
  confirming: boolean
  busy: boolean
  onAsk: () => void
  onCancel: () => void
  onConfirm: () => void
}) {
  const t = useTranslations("affiliate.replacement")
  const { a } = props
  const value = (d: Difference, v: string | number | null) => {
    if (v == null) return "—"
    if (MONEY_FIELDS.has(d.field) && typeof v === "number") return money(v)
    if (d.field === "commission" && typeof v === "number") return `${v} %`
    if ((d.field === "delivery" || d.field === "return_window") && typeof v === "number") return t("days", { n: v })
    if (d.field === "identity") return t(`identity.${String(v)}`)
    return String(v)
  }
  const tone = (d: Difference) =>
    d.direction === "better" ? "text-emerald-700 dark:text-emerald-300" : d.direction === "worse" ? "text-red-700 dark:text-red-300" : "text-zinc-700 dark:text-zinc-300"
  return (
    <li className="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
      <div className="flex gap-3">
        {a.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={a.imageUrl} alt="" className="h-16 w-16 flex-none rounded-lg object-cover" />
        ) : null}
        <div className="min-w-0">
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${a.match === "identique" ? "bg-emerald-100 text-emerald-800" : "bg-sky-100 text-sky-800"}`}>
            {t(`match.${a.match}`)}
          </span>
          <p className="mt-1 truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">{a.name}</p>
          <p className="text-xs text-zinc-500">{t("availableLine", { n: a.available, supplier: a.supplierLabel })}</p>
          <p className="mt-1 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            {t("netLine", { net: money(a.net.netCents), price: money(a.sellingPriceHtCents) })}
          </p>
        </div>
      </div>
      <table className="mt-3 w-full text-xs">
        <thead>
          <tr className="text-left text-zinc-500">
            <th className="py-1 font-medium">{t("col.what")}</th>
            <th className="py-1 font-medium">{t("col.before")}</th>
            <th className="py-1 font-medium">{t("col.after")}</th>
          </tr>
        </thead>
        <tbody>
          {a.differences
            .filter((d) => d.field !== "identity")
            .map((d) => (
              <tr key={d.field} className="border-t border-zinc-100 dark:border-zinc-800">
                <td className="py-1 pr-2">{t(`field.${d.field}`)}</td>
                <td className="py-1 pr-2">{value(d, d.before)}</td>
                <td className={`py-1 ${tone(d)}`}>{value(d, d.after)}</td>
              </tr>
            ))}
        </tbody>
      </table>
      <div className="mt-3">
        {props.confirming ? (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span>{t("confirmQuestion")}</span>
            <button type="button" disabled={props.busy} onClick={props.onConfirm} className="rounded-md bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">
              {props.busy ? t("working") : t("confirmYes")}
            </button>
            <button type="button" onClick={props.onCancel} className="text-xs underline">
              {t("cancel")}
            </button>
          </div>
        ) : (
          <button type="button" onClick={props.onAsk} className="rounded-md bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white">
            {t("replaceCta")}
          </button>
        )}
      </div>
    </li>
  )
}
