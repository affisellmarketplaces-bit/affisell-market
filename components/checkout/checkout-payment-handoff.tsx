"use client"

import { Lock, Sparkles } from "lucide-react"
import { useTranslations } from "next-intl"

type Props = {
  open: boolean
  phase?: "identifying" | "redirecting"
}

/** Full-screen perceived-speed overlay while identity → Stripe handoff runs. */
export function CheckoutPaymentHandoff({ open, phase = "redirecting" }: Props) {
  const t = useTranslations("cart.identity")

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-zinc-950/70 backdrop-blur-md"
      role="status"
      aria-live="polite"
      aria-busy="true"
      data-testid="checkout-payment-handoff"
    >
      <div className="relative mx-4 w-full max-w-sm overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-zinc-900 to-zinc-950 p-8 text-center shadow-2xl">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(139,92,246,0.35),transparent_55%)]" />
        <div className="relative">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-500/15 ring-1 ring-violet-400/30">
            <Lock className="h-7 w-7 text-violet-300" aria-hidden />
          </div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-violet-300/90">
            {t("handoffSecure")}
          </p>
          <h2 className="mt-2 text-xl font-bold text-white">{t("handoffTitle")}</h2>
          <p className="mt-2 text-sm text-zinc-400">
            {phase === "identifying" ? t("handoffIdentifying") : t("handoffRedirecting")}
          </p>
          <div className="mt-6 flex items-center justify-center gap-2 text-violet-200/80">
            <Sparkles className="h-4 w-4 animate-pulse" aria-hidden />
            <span className="text-xs font-medium">{t("handoffPowered")}</span>
          </div>
          <div className="mt-6 h-1.5 overflow-hidden rounded-full bg-zinc-800">
            <div className="h-full w-2/5 animate-[checkout-handoff_1.1s_ease-in-out_infinite] rounded-full bg-gradient-to-r from-violet-500 via-fuchsia-500 to-violet-500" />
          </div>
        </div>
      </div>
    </div>
  )
}
