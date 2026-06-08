"use client"

import { CheckCircle2, Loader2, ScanLine } from "lucide-react"
import { useTranslations } from "next-intl"
import { useCallback, useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

type CheckInResult = {
  orderId: string
  customerEmail: string
  productName: string
  seatLabels: string[]
  checkedInAt: string
  alreadyCheckedIn: boolean
}

type Props = {
  onCheckedIn: (result: CheckInResult) => void
  className?: string
}

export function SupplierBookingCheckInForm({ onCheckedIn, className }: Props) {
  const t = useTranslations("supplier.booking.roster")
  const [tokenInput, setTokenInput] = useState("")
  const [busy, setBusy] = useState(false)
  const [lastSuccess, setLastSuccess] = useState<CheckInResult | null>(null)

  const submit = useCallback(async () => {
    const token = tokenInput.trim()
    if (token.length < 8) {
      toast.error(t("invalidToken"))
      return
    }
    setBusy(true)
    try {
      const res = await fetch("/api/supplier/booking/check-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      })
      const json = (await res.json()) as CheckInResult & { error?: string; ok?: boolean }
      if (!res.ok) {
        const key = json.error ?? "checkInFailed"
        toast.error(t(`errors.${key}` as "errors.not_found"))
        return
      }
      const result: CheckInResult = {
        orderId: json.orderId,
        customerEmail: json.customerEmail,
        productName: json.productName,
        seatLabels: json.seatLabels ?? [],
        checkedInAt: json.checkedInAt,
        alreadyCheckedIn: json.alreadyCheckedIn,
      }
      setLastSuccess(result)
      onCheckedIn(result)
      setTokenInput("")
      toast.success(json.alreadyCheckedIn ? t("alreadyCheckedIn") : t("checkInSuccess"))
    } catch {
      toast.error(t("checkInFailed"))
    } finally {
      setBusy(false)
    }
  }, [onCheckedIn, t, tokenInput])

  return (
    <div
      className={cn(
        "rounded-2xl border border-cyan-300/40 bg-gradient-to-br from-cyan-950/80 via-slate-950 to-violet-950 p-5 text-white shadow-lg",
        className
      )}
    >
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-400/15 ring-1 ring-cyan-400/30">
          <ScanLine className="h-5 w-5 text-cyan-300" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold text-cyan-50">{t("checkInTitle")}</h2>
          <p className="mt-1 text-sm text-cyan-100/75">{t("checkInHint")}</p>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        <Input
          value={tokenInput}
          onChange={(e) => setTokenInput(e.target.value)}
          placeholder={t("tokenPlaceholder")}
          className="border-white/15 bg-black/30 text-white placeholder:text-zinc-500"
          onKeyDown={(e) => {
            if (e.key === "Enter") void submit()
          }}
          disabled={busy}
        />
        <Button
          type="button"
          onClick={() => void submit()}
          disabled={busy || tokenInput.trim().length < 8}
          className="shrink-0 bg-cyan-500 text-slate-950 hover:bg-cyan-400"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : t("checkInCta")}
        </Button>
      </div>

      {lastSuccess ? (
        <p className="mt-3 flex items-center gap-2 text-sm text-emerald-300">
          <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />
          {lastSuccess.productName} · {lastSuccess.customerEmail}
          {lastSuccess.seatLabels.length > 0 ? ` · ${lastSuccess.seatLabels.join(", ")}` : ""}
        </p>
      ) : null}
    </div>
  )
}
