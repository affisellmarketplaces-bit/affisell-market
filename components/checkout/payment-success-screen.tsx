"use client"

import Link from "next/link"
import { motion, useReducedMotion } from "framer-motion"
import { useLocale, useTranslations } from "next-intl"
import { useEffect, useRef } from "react"
import {
  ArrowRight,
  Check,
  Mail,
  Package,
  ShieldCheck,
  Sparkles,
} from "lucide-react"

import { buttonVariants } from "@/components/ui/button"
import { formatStoreCurrencyFromCents } from "@/lib/market-config"
import { cn } from "@/lib/utils"

function formatPaidAmount(cents: number, currency: string | null | undefined, locale: string): string {
  const code = currency?.trim().toUpperCase() || "EUR"
  try {
    return (cents / 100).toLocaleString(locale, {
      style: "currency",
      currency: code,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  } catch {
    return formatStoreCurrencyFromCents(cents)
  }
}

export type PaymentSuccessPayload = {
  paid?: boolean
  fulfilled?: boolean
  verifying?: boolean
  orderId?: string | null
  orderIds?: string[]
  amountTotal?: number | null
  currency?: string | null
  productName?: string | null
  productImageUrl?: string | null
  error?: string
}

type Props = {
  payload: PaymentSuccessPayload
  signedInAsBuyer?: boolean
}

function fireSuccessConfetti() {
  void import("canvas-confetti").then(({ default: confetti }) => {
    confetti({
      particleCount: 72,
      spread: 58,
      origin: { y: 0.62 },
      colors: ["#10b981", "#34d399", "#6ee7b7", "#a78bfa", "#818cf8"],
      disableForReducedMotion: true,
    })
    window.setTimeout(() => {
      confetti({
        particleCount: 36,
        spread: 80,
        origin: { y: 0.55, x: 0.35 },
        colors: ["#10b981", "#34d399", "#22d3ee"],
        disableForReducedMotion: true,
      })
    }, 180)
  })
}

function SuccessCheckmark({ reducedMotion }: { reducedMotion: boolean }) {
  return (
    <motion.div
      className="relative mx-auto flex h-28 w-28 items-center justify-center sm:h-32 sm:w-32"
      initial={reducedMotion ? false : { scale: 0.6, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 260, damping: 18, delay: 0.05 }}
    >
      <span
        className="pointer-events-none absolute inset-0 rounded-full bg-emerald-400/25 blur-2xl"
        aria-hidden
      />
      <motion.span
        className="pointer-events-none absolute inset-[-12%] rounded-full border border-emerald-400/30"
        aria-hidden
        animate={reducedMotion ? undefined : { scale: [1, 1.08, 1], opacity: [0.5, 0.85, 0.5] }}
        transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
      />
      <span className="relative flex h-full w-full items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 via-emerald-500 to-teal-600 shadow-[0_0_48px_-8px_rgba(16,185,129,0.75)]">
        <motion.span
          initial={reducedMotion ? false : { scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 320, damping: 16, delay: 0.2 }}
        >
          <Check className="h-14 w-14 text-white sm:h-16 sm:w-16" strokeWidth={3.5} aria-hidden />
        </motion.span>
      </span>
    </motion.div>
  )
}

function TimelineStep({
  icon: Icon,
  label,
  done,
  delay,
  reducedMotion,
}: {
  icon: typeof Check
  label: string
  done: boolean
  delay: number
  reducedMotion: boolean
}) {
  return (
    <motion.li
      className="flex items-center gap-3 rounded-2xl border border-white/60 bg-white/50 px-4 py-3 backdrop-blur-md dark:border-white/10 dark:bg-zinc-900/40"
      initial={reducedMotion ? false : { opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay, duration: 0.35 }}
    >
      <span
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
          done
            ? "bg-emerald-500/15 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400"
            : "bg-zinc-100 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-500"
        )}
      >
        {done ? <Check className="h-4 w-4" strokeWidth={3} aria-hidden /> : <Icon className="h-4 w-4" aria-hidden />}
      </span>
      <span className="text-sm font-medium text-zinc-700 dark:text-zinc-200">{label}</span>
    </motion.li>
  )
}

export function PaymentSuccessScreen({ payload, signedInAsBuyer = false }: Props) {
  const t = useTranslations("success")
  const locale = useLocale()
  const reducedMotion = useReducedMotion()
  const confettiFired = useRef(false)

  const isError = payload.error === "missing_session"
  const orderCount = payload.orderIds?.length ?? (payload.orderId ? 1 : 0)
  const primaryOrderIdRaw = payload.orderIds?.[0] ?? payload.orderId ?? null
  const primaryOrderRef =
    typeof primaryOrderIdRaw === "string" && primaryOrderIdRaw.trim()
      ? primaryOrderIdRaw.trim().slice(0, 8).toUpperCase()
      : primaryOrderIdRaw != null && String(primaryOrderIdRaw).trim()
        ? String(primaryOrderIdRaw).trim().slice(0, 8).toUpperCase()
        : null

  useEffect(() => {
    if (isError || confettiFired.current) return
    confettiFired.current = true
    fireSuccessConfetti()
  }, [isError])

  const amountLabel =
    typeof payload.amountTotal === "number" && payload.amountTotal > 0
      ? formatPaidAmount(payload.amountTotal, payload.currency, locale)
      : null

  const productTitle =
    payload.productName?.trim() ||
    (orderCount > 1 ? t("itemsPaid", { count: orderCount }) : null)

  const bodyCopy = isError
    ? t("errorBody")
    : payload.fulfilled
      ? orderCount > 1
        ? t("fulfilledMulti", { count: orderCount })
        : t("fulfilledSingle")
      : payload.verifying
        ? t("instantConfirmBody")
        : t("pendingFulfillment")

  return (
    <div className="relative min-h-[calc(100dvh-12rem)] overflow-hidden px-4 py-10 sm:py-14 md:py-16">
      <div
        className="pointer-events-none absolute inset-0 opacity-90 dark:opacity-70"
        style={{
          backgroundImage: `
            radial-gradient(ellipse 90% 60% at 50% -15%, rgba(16,185,129,0.22), transparent 55%),
            radial-gradient(ellipse 55% 45% at 95% 15%, rgba(139,92,246,0.14), transparent 50%),
            radial-gradient(ellipse 50% 40% at 5% 85%, rgba(20,184,166,0.12), transparent 45%)
          `,
        }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(16,185,129,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(16,185,129,0.04)_1px,transparent_1px)] bg-[size:48px_48px] [mask-image:radial-gradient(ellipse_at_center,black,transparent_75%)]"
        aria-hidden
      />

      <motion.div
        className="relative mx-auto max-w-xl"
        initial={reducedMotion ? false : { opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="overflow-hidden rounded-[2rem] border border-white/70 bg-white/75 p-8 shadow-[0_24px_80px_-24px_rgba(16,185,129,0.35)] ring-1 ring-emerald-500/10 backdrop-blur-xl dark:border-white/10 dark:bg-zinc-950/70 dark:shadow-[0_24px_80px_-24px_rgba(0,0,0,0.65)] sm:p-10">
          <div className="text-center">
            {isError ? (
              <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">
                <ShieldCheck className="h-12 w-12" aria-hidden />
              </div>
            ) : (
              <SuccessCheckmark reducedMotion={Boolean(reducedMotion)} />
            )}

            <motion.p
              className="mt-6 inline-flex items-center gap-1.5 rounded-full border border-emerald-200/80 bg-emerald-50/90 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-emerald-800 dark:border-emerald-800/60 dark:bg-emerald-950/50 dark:text-emerald-300"
              initial={reducedMotion ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.25 }}
            >
              <Sparkles className="h-3 w-3" aria-hidden />
              {isError ? t("errorBadge") : t("confirmedBadge")}
            </motion.p>

            <motion.h1
              className="mt-4 text-balance text-3xl font-black tracking-tight text-zinc-900 dark:text-white sm:text-4xl"
              initial={reducedMotion ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              {isError ? t("errorTitle") : t("paymentSuccessful")}
            </motion.h1>

            <motion.p
              className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-zinc-600 dark:text-zinc-300"
              initial={reducedMotion ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.38 }}
            >
              {bodyCopy}
            </motion.p>

            {amountLabel && !isError ? (
              <motion.div
                className="mx-auto mt-5 max-w-sm rounded-2xl border border-emerald-200/70 bg-gradient-to-br from-emerald-50/90 via-white to-white px-4 py-4 text-left shadow-sm dark:border-emerald-900/40 dark:from-emerald-950/30 dark:via-zinc-950 dark:to-zinc-950"
                initial={reducedMotion ? false : { opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.42 }}
              >
                <div className="flex items-center gap-3">
                  {payload.productImageUrl ? (
                    <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-emerald-200/70 bg-white dark:border-emerald-900/50 dark:bg-zinc-900">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={payload.productImageUrl}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    </div>
                  ) : null}
                  <div className="min-w-0 flex-1">
                    {productTitle ? (
                      <p className="line-clamp-2 text-sm font-semibold leading-snug text-zinc-900 dark:text-zinc-50">
                        {productTitle}
                      </p>
                    ) : null}
                    <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-emerald-800/80 dark:text-emerald-300/80">
                      {t("amountPaid")}
                    </p>
                    <p className="text-2xl font-black tabular-nums tracking-tight text-emerald-700 dark:text-emerald-400">
                      {amountLabel}
                    </p>
                  </div>
                </div>
              </motion.div>
            ) : null}

            {primaryOrderRef && !isError ? (
              <motion.p
                className="mt-3 font-mono text-xs text-zinc-500 dark:text-zinc-400"
                initial={reducedMotion ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.46 }}
              >
                {t("orderRef", { id: primaryOrderRef })}
              </motion.p>
            ) : null}
          </div>

          {!isError ? (
            <motion.ul
              className="mt-8 space-y-2"
              aria-label={t("timelineLabel")}
              initial={reducedMotion ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
            >
              <TimelineStep
                icon={ShieldCheck}
                label={t("stepPayment")}
                done
                delay={0.52}
                reducedMotion={Boolean(reducedMotion)}
              />
              <TimelineStep
                icon={Package}
                label={t("stepOrder")}
                done={Boolean(payload.fulfilled)}
                delay={0.58}
                reducedMotion={Boolean(reducedMotion)}
              />
              <TimelineStep
                icon={Mail}
                label={t("stepEmail")}
                done={Boolean(payload.fulfilled)}
                delay={0.64}
                reducedMotion={Boolean(reducedMotion)}
              />
            </motion.ul>
          ) : null}

          <motion.div
            className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-center"
            initial={reducedMotion ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.68 }}
          >
            {!isError ? (
              <Link
                href="/marketplace/account/orders"
                className={cn(
                  buttonVariants({ size: "lg" }),
                  "inline-flex items-center justify-center gap-2 bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100"
                )}
              >
                {t("viewOrders")}
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            ) : null}
            {!signedInAsBuyer ? (
              <Link
                href="/login/customer?callbackUrl=/marketplace/account/orders"
                className={cn(buttonVariants({ variant: "outline", size: "lg" }))}
              >
                {t("signIn")}
              </Link>
            ) : null}
            <Link
              href={isError ? "/" : "/shops/browse"}
              className={cn(buttonVariants({ variant: "ghost", size: "lg" }))}
            >
              {isError ? t("backHome") : t("continueShopping")}
            </Link>
          </motion.div>
        </div>
      </motion.div>
    </div>
  )
}

export function PaymentSuccessLoading() {
  const t = useTranslations("success")

  return (
    <div className="flex min-h-[calc(100dvh-12rem)] flex-col items-center justify-center px-4 py-16">
      <div className="relative flex h-20 w-20 items-center justify-center">
        <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400/20" aria-hidden />
        <span className="relative flex h-16 w-16 items-center justify-center rounded-full border border-emerald-200/80 bg-white/80 shadow-lg backdrop-blur dark:border-emerald-900/50 dark:bg-zinc-900/80">
          <span className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
        </span>
      </div>
      <p className="mt-6 text-sm font-medium text-zinc-600 dark:text-zinc-300">{t("verifyingPayment")}</p>
    </div>
  )
}
