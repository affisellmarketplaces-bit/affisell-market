"use client"

import { Download } from "lucide-react"
import { useTranslations } from "next-intl"
import { useState } from "react"

import { Button } from "@/components/ui/button"

export function AffiliateDac7ExportButton() {
  const t = useTranslations("affiliate.dac7Export")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={busy}
        className="inline-flex gap-2"
        onClick={async () => {
          setError(null)
          setBusy(true)
          try {
            const res = await fetch("/api/affiliate/dac7-export", { cache: "no-store" })
            if (!res.ok) {
              const j = (await res.json().catch(() => ({}))) as { error?: string }
              setError(j.error ?? t("error"))
              return
            }
            const blob = await res.blob()
            const url = URL.createObjectURL(blob)
            const a = document.createElement("a")
            a.href = url
            a.download = `affisell-dac7-recap-${new Date().getUTCFullYear()}.csv`
            a.click()
            URL.revokeObjectURL(url)
          } catch {
            setError(t("error"))
          } finally {
            setBusy(false)
          }
        }}
      >
        <Download className="size-4" aria-hidden />
        {busy ? t("downloading") : t("cta")}
      </Button>
      <p className="text-xs text-violet-100/70">{t("hint")}</p>
      {error ? (
        <p className="text-xs text-rose-300" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}
