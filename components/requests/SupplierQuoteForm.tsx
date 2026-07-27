"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useMemo, useState, type FormEvent } from "react"
import { useTranslations } from "next-intl"
import { toast } from "sonner"

import { DeliveryBadge } from "@/components/logistics/DeliveryBadge"
import { buildSupplierDeliveryFeedbackCopy } from "@/lib/product-request-i18n"
import type { ProductQuoteDto } from "@/lib/product-request-types"

export function SupplierQuoteForm({
  requestId,
  requestCountries,
  existingQuote,
}: {
  requestId: string
  requestCountries: string[]
  existingQuote: ProductQuoteDto | null
}) {
  const router = useRouter()
  const t = useTranslations("productRequests")
  const tForm = useTranslations("productRequests.supplier.quoteForm")
  const tStatus = useTranslations("productRequests.status")
  const [price, setPrice] = useState("")
  const [moq, setMoq] = useState("50")
  const [deliveryDays, setDeliveryDays] = useState("7")
  const [message, setMessage] = useState("")
  const [pending, setPending] = useState(false)

  const daysNum = Number(deliveryDays)
  const feedback = useMemo(() => {
    if (!Number.isFinite(daysNum) || daysNum < 1) return null
    return buildSupplierDeliveryFeedbackCopy(daysNum, requestCountries, (key, values) =>
      t(`supplierFeedback.${key}`, values ?? {})
    )
  }, [daysNum, requestCountries, t])

  if (existingQuote) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-bold text-zinc-900">{tForm("titleExisting")}</h2>
          <span
            className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${
              existingQuote.status === "accepted"
                ? "bg-emerald-50 text-emerald-700"
                : existingQuote.status === "rejected"
                  ? "bg-zinc-100 text-zinc-500"
                  : "bg-amber-50 text-amber-800"
            }`}
          >
            {tStatus(existingQuote.status as "pending" | "accepted" | "rejected")}
          </span>
        </div>
        <dl className="mt-3 grid gap-2 text-sm text-zinc-700 sm:grid-cols-3">
          <div>
            <dt className="text-xs text-zinc-500">{tForm("priceLabel")}</dt>
            <dd className="font-semibold">{existingQuote.price}€</dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-500">{tForm("moqLabel")}</dt>
            <dd className="font-semibold">{existingQuote.moq}</dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-500">{tForm("deliveryLabel")}</dt>
            <dd className="mt-0.5">
              <DeliveryBadge
                days={existingQuote.deliveryDays}
                countries={requestCountries}
                variant="full"
              />
            </dd>
          </div>
        </dl>
        {existingQuote.message ? (
          <p className="mt-3 text-xs text-zinc-600 whitespace-pre-wrap">{existingQuote.message}</p>
        ) : null}
      </div>
    )
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const priceN = Number(price)
    const moqN = Number(moq)
    const daysN = Number(deliveryDays)
    if (!Number.isFinite(priceN) || priceN <= 0) {
      toast.error(tForm("toastPriceRequired"))
      return
    }
    if (!Number.isFinite(moqN) || moqN < 1) {
      toast.error(tForm("toastMoqRequired"))
      return
    }
    if (!Number.isFinite(daysN) || daysN < 1) {
      toast.error(tForm("toastDeliveryRequired"))
      return
    }

    setPending(true)
    try {
      const res = await fetch(`/api/requests/${requestId}/quotes`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          price: priceN,
          moq: moqN,
          deliveryDays: daysN,
          message: message.trim() || undefined,
        }),
      })
      const json = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        toast.error(
          json.error === "already_quoted" ? tForm("toastAlreadyQuoted") : tForm("toastSubmitFailed")
        )
        return
      }
      toast.success(tForm("toastSubmitSuccess"))
      router.refresh()
    } catch {
      toast.error(t("common.networkError"))
    } finally {
      setPending(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-xl border border-orange-200 bg-orange-50/60 p-4">
      <h2 className="text-sm font-bold text-orange-950">{tForm("titleNew")}</h2>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block text-xs font-medium text-zinc-700">
          {tForm("priceLabel")}
          <input
            type="number"
            step="0.01"
            min="0.01"
            required
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
          />
        </label>
        <label className="block text-xs font-medium text-zinc-700">
          {tForm("moqLabel")}
          <input
            type="number"
            min="1"
            required
            value={moq}
            onChange={(e) => setMoq(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
          />
        </label>
        <label className="block text-xs font-medium text-zinc-700">
          {tForm("deliveryLabel")}
          <input
            type="number"
            min="1"
            required
            value={deliveryDays}
            onChange={(e) => setDeliveryDays(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
          />
        </label>
      </div>

      {feedback ? (
        <p
          className={`rounded-lg border px-3 py-2 text-xs font-medium ${
            feedback.tone === "boost"
              ? "border-emerald-300 bg-emerald-50 text-emerald-900"
              : feedback.tone === "ok"
                ? "border-amber-300 bg-amber-50 text-amber-950"
                : "border-red-400 bg-red-50 text-red-900"
          }`}
        >
          {feedback.message}
        </p>
      ) : null}

      <label className="block text-xs font-medium text-zinc-700">
        {tForm("messageLabel")}
        <textarea
          rows={3}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={tForm("messagePlaceholder")}
          className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="inline-flex w-full items-center justify-center rounded-xl bg-[#6D28D9] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#5B21B6] disabled:opacity-60"
      >
        {pending ? tForm("submitting") : tForm("submit")}
      </button>
      <Link href="/dashboard/supplier/requests" className="block text-center text-xs text-zinc-500 hover:underline">
        {tForm("backLink")}
      </Link>
    </form>
  )
}
