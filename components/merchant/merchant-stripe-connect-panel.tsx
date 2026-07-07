"use client"

import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useEffect, useState } from "react"
import { CheckCircle2, Landmark } from "lucide-react"
import { useTranslations } from "next-intl"

import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type Role = "SUPPLIER" | "AFFILIATE"

type Props = {
  role: Role
  connectOnboarded: boolean
  stripeAccountId: string | null
  verificationApproved: boolean
}

export function MerchantStripeConnectPanel({
  role,
  connectOnboarded,
  stripeAccountId,
  verificationApproved,
}: Props) {
  const t = useTranslations("payoutPolicy.connect")
  const router = useRouter()
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [syncing, setSyncing] = useState(false)

  const title = role === "SUPPLIER" ? t("supplierTitle") : t("affiliateTitle")
  const body = role === "SUPPLIER" ? t("supplierBody") : t("affiliateBody")
  const cta = role === "SUPPLIER" ? t("supplierCta") : t("affiliateCta")
  const verificationHint =
    role === "SUPPLIER" ? t("supplierKycHint") : t("affiliateKycHint")

  const stripeReturn = searchParams.get("stripe") === "return"

  useEffect(() => {
    if (!stripeReturn || !stripeAccountId) return
    let cancelled = false
    setSyncing(true)
    void fetch("/api/stripe/refresh-onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ accountId: stripeAccountId }),
    })
      .then(() => {
        if (cancelled) return
        router.replace(
          role === "SUPPLIER" ? "/dashboard/supplier/balance" : "/dashboard/affiliate/earnings",
          { scroll: false }
        )
        router.refresh()
      })
      .catch(() => {
        if (!cancelled) setError("Impossible de synchroniser Stripe — réessayez.")
      })
      .finally(() => {
        if (!cancelled) setSyncing(false)
      })
    return () => {
      cancelled = true
    }
  }, [role, router, stripeAccountId, stripeReturn])

  async function startConnect() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/stripe/connect/create-account", {
        method: "POST",
        credentials: "include",
      })
      const data = (await res.json()) as { url?: string; error?: string }
      if (!res.ok || !data.url) {
        setError(data.error ?? "Impossible de démarrer Stripe Connect")
        return
      }
      window.location.href = data.url
    } catch {
      setError("Erreur réseau — réessayez")
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="rounded-2xl border border-violet-200/70 bg-gradient-to-br from-white via-violet-50/40 to-teal-50/30 p-5 shadow-sm dark:border-violet-900/40 dark:from-zinc-950 dark:via-violet-950/20 dark:to-teal-950/10 sm:p-6">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300">
          <Landmark className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">{title}</h2>
          <p className="mt-1 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">{body}</p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {!verificationApproved ? (
          <Link
            href="/dashboard/verification"
            className={cn(buttonVariants({ size: "sm" }), "bg-amber-600 text-white hover:bg-amber-700")}
          >
            Compléter la vérification KYC
          </Link>
        ) : connectOnboarded ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
            Stripe Connect actif
          </span>
        ) : (
          <button
            type="button"
            disabled={loading || syncing}
            onClick={() => void startConnect()}
            className={cn(buttonVariants({ size: "sm" }), "bg-violet-600 text-white hover:bg-violet-700")}
          >
            {loading ? "Redirection…" : syncing ? "Synchronisation…" : cta}
          </button>
        )}
      </div>

      {!verificationApproved ? (
        <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">{verificationHint}</p>
      ) : null}
      {error ? <p className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</p> : null}
    </section>
  )
}
