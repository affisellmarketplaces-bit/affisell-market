"use client"

import { signOut } from "next-auth/react"
import {
  AlertTriangle,
  ArrowRight,
  Loader2,
  MessageSquareText,
  ShieldAlert,
  Trash2,
  X,
} from "lucide-react"
import { useLocale, useTranslations } from "next-intl"
import { useCallback, useEffect, useId, useState } from "react"

import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type {
  AccountDeletionPreview,
  AccountDeletionReasonCode,
} from "@/lib/account-deletion-shared"
import {
  isAccountDeletionConfirmed,
  normalizeAccountDeletionEmail,
} from "@/lib/account-deletion-shared"
import { cn } from "@/lib/utils"

type Variant = "merchant" | "gdpr"

type Props = {
  variant: Variant
  triggerClassName?: string
  triggerLabel?: string
  triggerStyle?: "button" | "destructive"
}

type Step = "impact" | "reason" | "confirm"

const STEPS: Step[] = ["impact", "reason", "confirm"]

export function AccountDeletionFlow({
  variant,
  triggerClassName,
  triggerLabel,
  triggerStyle = "button",
}: Props) {
  const t = useTranslations("accountDeletion")
  const locale = useLocale()
  const titleId = useId()
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<Step>("impact")
  const [preview, setPreview] = useState<AccountDeletionPreview | null>(null)
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [reasonCode, setReasonCode] = useState<AccountDeletionReasonCode | "">("")
  const [reasonDetail, setReasonDetail] = useState("")
  const [confirmEmail, setConfirmEmail] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reset = useCallback(() => {
    setStep("impact")
    setReasonCode("")
    setReasonDetail("")
    setConfirmEmail("")
    setError(null)
    setBusy(false)
  }, [])

  const close = useCallback(() => {
    setOpen(false)
    reset()
    setPreview(null)
  }, [reset])

  const loadPreview = useCallback(async () => {
    setLoadingPreview(true)
    setError(null)
    try {
      const res = await fetch("/api/account/deletion-preview", { cache: "no-store" })
      const data = (await res.json().catch(() => ({}))) as AccountDeletionPreview & { error?: string }
      if (!res.ok) {
        setError(data.error ?? t("errors.previewFailed"))
        return
      }
      setPreview(data)
    } catch {
      setError(t("errors.network"))
    } finally {
      setLoadingPreview(false)
    }
  }, [t])

  useEffect(() => {
    if (!open) return
    void loadPreview()
  }, [open, loadPreview])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) close()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, busy, close])

  const emailReady =
    preview != null && isAccountDeletionConfirmed({ confirmEmail }, preview.email)

  const reasonReady =
    reasonCode !== "" &&
    (reasonCode !== "other" || reasonDetail.trim().length >= 10)

  const impactItems = preview
    ? (t.raw(`impact.${preview.impactScope}`) as string[])
    : []

  const reasonCodes = preview?.reasonCodes ?? []

  function stepIndex(current: Step): number {
    return STEPS.indexOf(current)
  }

  async function executeDelete() {
    if (!preview || !emailReady || !reasonReady || !reasonCode) return
    setBusy(true)
    setError(null)
    try {
      const payload = {
        confirmEmail: normalizeAccountDeletionEmail(confirmEmail),
        reasonCode,
        reasonDetail: reasonDetail.trim() || undefined,
        locale,
        source: variant,
      }
      const res =
        variant === "merchant"
          ? await fetch("/api/user/account", {
              method: "DELETE",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            })
          : await fetch("/api/gdpr/delete", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            })

      const data = (await res.json().catch(() => ({}))) as { error?: string; code?: string }
      if (!res.ok) {
        if (data.code === "HAS_ORDERS") {
          setError(t("errors.hasOrders"))
        } else if (data.code === "OPEN_BUYER_ORDERS") {
          setError(t("errors.openBuyerOrders"))
        } else if (data.code === "REASON_REQUIRED") {
          setError(t("errors.reasonRequired"))
        } else if (data.code === "REASON_DETAIL_REQUIRED") {
          setError(t("errors.reasonDetailRequired"))
        } else {
          setError(data.error ?? t("errors.deleteFailed"))
        }
        return
      }

      if (variant === "merchant") {
        await signOut({ callbackUrl: "/" })
        return
      }
      window.location.href = "/"
    } catch {
      setError(t("errors.network"))
    } finally {
      setBusy(false)
    }
  }

  const triggerContent =
    triggerLabel ?? (variant === "merchant" ? t("triggerMerchant") : t("triggerGdpr"))

  return (
    <>
      <button
        type="button"
        className={cn(
          triggerStyle === "destructive"
            ? cn(buttonVariants({ variant: "destructive", size: "sm" }), "gap-1.5")
            : cn(
                buttonVariants({ variant: "outline", size: "sm" }),
                "gap-1.5 border-red-200 bg-white/90 text-red-700 hover:bg-red-50 dark:border-red-900/60 dark:bg-zinc-900/90 dark:text-red-400 dark:hover:bg-red-950/40"
              ),
          triggerClassName
        )}
        onClick={() => {
          reset()
          setOpen(true)
        }}
      >
        <Trash2 className="size-4 shrink-0" aria-hidden />
        {triggerContent}
      </button>

      {open ? (
        <div
          className="affisell-account-delete-overlay fixed inset-0 z-[360] flex items-end justify-center p-0 sm:items-center sm:p-4"
          role="presentation"
        >
          <button
            type="button"
            aria-label={t("cancel")}
            className="absolute inset-0 bg-zinc-950/60 backdrop-blur-[2px]"
            onClick={() => {
              if (!busy) close()
            }}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="affisell-account-delete-panel relative flex max-h-[min(92dvh,720px)] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl border border-red-200/70 bg-white shadow-2xl dark:border-red-950/60 dark:bg-zinc-950 sm:rounded-3xl"
          >
            <div className="affisell-account-delete-aurora pointer-events-none absolute inset-x-0 top-0 h-32 opacity-80" />

            <div className="relative flex items-start gap-3 border-b border-red-100/80 px-5 py-4 dark:border-red-950/50 sm:px-6 sm:py-5">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl border border-red-200/80 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
                <ShieldAlert className="size-5" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-red-600/90 dark:text-red-400/90">
                  {t("eyebrow")}
                </p>
                <h2 id={titleId} className="mt-1 text-lg font-semibold tracking-tight text-zinc-900 dark:text-white">
                  {t("title")}
                </h2>
                <p className="mt-1 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                  {t("subtitle")}
                </p>
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={close}
                className="rounded-xl p-2 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 disabled:opacity-50 dark:hover:bg-zinc-900 dark:hover:text-zinc-200"
                aria-label={t("cancel")}
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="relative flex-1 overflow-y-auto px-5 py-4 sm:px-6 sm:py-5">
              <div className="mb-5 grid grid-cols-3 gap-1">
                {STEPS.map((s, index) => {
                  const active = step === s
                  const done = stepIndex(step) > index
                  return (
                    <div key={s} className="flex flex-col items-center gap-1.5 text-center">
                      <span
                        className={cn(
                          "flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-colors",
                          active || done
                            ? "bg-red-600 text-white"
                            : "bg-zinc-100 text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400"
                        )}
                      >
                        {index + 1}
                      </span>
                      <span
                        className={cn(
                          "text-[10px] font-medium leading-tight sm:text-xs",
                          active ? "text-zinc-900 dark:text-white" : "text-zinc-500 dark:text-zinc-400"
                        )}
                      >
                        {s === "impact"
                          ? t("stepImpact")
                          : s === "reason"
                            ? t("stepReason")
                            : t("stepConfirm")}
                      </span>
                    </div>
                  )
                })}
              </div>

              {loadingPreview ? (
                <div className="flex items-center gap-2 py-8 text-sm text-zinc-500">
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                  {t("loadingPreview")}
                </div>
              ) : preview ? (
                <>
                  {step === "impact" ? (
                    <div className="space-y-4">
                      {!preview.canDelete ? (
                        <div className="flex gap-3 rounded-2xl border border-amber-300/80 bg-amber-50/90 p-4 dark:border-amber-800/50 dark:bg-amber-950/30">
                          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-700 dark:text-amber-300" />
                          <div className="space-y-1 text-sm">
                            <p className="font-medium text-amber-900 dark:text-amber-100">
                              {preview.blockCode === "OPEN_BUYER_ORDERS"
                                ? t("blockedOpenOrdersTitle")
                                : t("blockedOrdersTitle")}
                            </p>
                            <p className="text-amber-800/90 dark:text-amber-200/90">
                              {preview.blockCode === "OPEN_BUYER_ORDERS"
                                ? t("blockedOpenOrdersBody")
                                : t("blockedOrdersBody")}
                            </p>
                            <a
                              href="mailto:support@affisell.com"
                              className="inline-flex font-medium text-amber-900 underline underline-offset-2 dark:text-amber-100"
                            >
                              {t("contactSupport")}
                            </a>
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm text-zinc-600 dark:text-zinc-400">{t("impactIntro")}</p>
                      )}

                      <ul className="space-y-2">
                        {impactItems.map((item) => (
                          <li
                            key={item}
                            className="flex items-start gap-2 rounded-xl border border-zinc-200/80 bg-zinc-50/80 px-3 py-2.5 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-zinc-300"
                          >
                            <span className="mt-1 size-1.5 shrink-0 rounded-full bg-red-500" aria-hidden />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {step === "reason" ? (
                    <div className="space-y-4">
                      <div className="flex items-start gap-2 rounded-2xl border border-violet-200/80 bg-violet-50/70 px-3 py-3 dark:border-violet-900/50 dark:bg-violet-950/20">
                        <MessageSquareText className="mt-0.5 size-4 shrink-0 text-violet-700 dark:text-violet-300" />
                        <p className="text-sm leading-relaxed text-violet-900/90 dark:text-violet-100/90">
                          {t("feedbackNote")}
                        </p>
                      </div>

                      <fieldset className="space-y-3">
                        <legend className="text-sm font-medium text-zinc-900 dark:text-white">
                          {t("reasonLegend")}
                        </legend>
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                          {reasonCodes.map((code) => {
                            const selected = reasonCode === code
                            return (
                              <button
                                key={code}
                                type="button"
                                disabled={busy || !preview.canDelete}
                                onClick={() => setReasonCode(code)}
                                className={cn(
                                  "rounded-xl border px-3 py-2.5 text-left text-sm transition-all",
                                  selected
                                    ? "border-red-500 bg-red-50 text-red-900 shadow-sm dark:border-red-500/70 dark:bg-red-950/40 dark:text-red-100"
                                    : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-zinc-700"
                                )}
                              >
                                {t(`reasons.${code}`)}
                              </button>
                            )
                          })}
                        </div>
                      </fieldset>

                      <div className="space-y-2">
                        <Label htmlFor={`${titleId}-detail`} className="text-sm font-medium">
                          {reasonCode === "other" ? t("reasonDetailRequiredLabel") : t("reasonDetailOptionalLabel")}
                        </Label>
                        <textarea
                          id={`${titleId}-detail`}
                          rows={3}
                          maxLength={500}
                          disabled={busy || !preview.canDelete || !reasonCode}
                          value={reasonDetail}
                          onChange={(e) => setReasonDetail(e.target.value)}
                          placeholder={t("reasonDetailPlaceholder")}
                          className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-800 outline-none ring-violet-500/30 focus:ring-2 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
                        />
                        {reasonCode === "other" && reasonDetail.trim().length > 0 && reasonDetail.trim().length < 10 ? (
                          <p className="text-xs text-amber-700 dark:text-amber-300">{t("reasonDetailMinHint")}</p>
                        ) : null}
                      </div>
                    </div>
                  ) : null}

                  {step === "confirm" ? (
                    <div className="space-y-4">
                      <p className="text-sm text-zinc-600 dark:text-zinc-400">{t("confirmIntro")}</p>
                      {reasonCode ? (
                        <p className="rounded-xl border border-zinc-200/80 bg-zinc-50/80 px-3 py-2 text-xs text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-zinc-400">
                          {t("reasonSummary", { reason: t(`reasons.${reasonCode}`) })}
                        </p>
                      ) : null}
                      <div className="space-y-2">
                        <Label htmlFor={`${titleId}-email`} className="text-sm font-medium">
                          {t("confirmLabel")}
                        </Label>
                        <Input
                          id={`${titleId}-email`}
                          type="email"
                          autoComplete="off"
                          autoCorrect="off"
                          spellCheck={false}
                          placeholder={preview.email}
                          value={confirmEmail}
                          disabled={busy || !preview.canDelete}
                          onChange={(e) => setConfirmEmail(e.target.value)}
                          className="font-mono text-sm"
                        />
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">
                          {t("confirmHint", { email: preview.email })}
                        </p>
                      </div>
                    </div>
                  ) : null}

                  {error ? (
                    <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
                      {error}
                    </p>
                  ) : null}
                </>
              ) : (
                <p className="py-6 text-sm text-red-600 dark:text-red-400">{error ?? t("errors.previewFailed")}</p>
              )}
            </div>

            <div className="relative flex flex-col-reverse gap-2 border-t border-zinc-200/80 px-5 py-4 dark:border-zinc-800 sm:flex-row sm:justify-between sm:px-6">
              <Button
                type="button"
                variant="outline"
                disabled={busy || step === "impact"}
                onClick={() => {
                  if (step === "confirm") setStep("reason")
                  else if (step === "reason") setStep("impact")
                }}
                className={cn(step === "impact" && "invisible")}
              >
                {t("back")}
              </Button>
              <div className="flex flex-col-reverse gap-2 sm:flex-row">
                <Button type="button" variant="outline" disabled={busy} onClick={close}>
                  {t("cancel")}
                </Button>
                {step === "impact" ? (
                  <Button
                    type="button"
                    variant="destructive"
                    disabled={busy || loadingPreview || !preview?.canDelete}
                    onClick={() => setStep("reason")}
                    className="gap-1.5"
                  >
                    {t("continue")}
                    <ArrowRight className="size-4" aria-hidden />
                  </Button>
                ) : null}
                {step === "reason" ? (
                  <Button
                    type="button"
                    variant="destructive"
                    disabled={busy || !reasonReady || !preview?.canDelete}
                    onClick={() => setStep("confirm")}
                    className="gap-1.5"
                  >
                    {t("continue")}
                    <ArrowRight className="size-4" aria-hidden />
                  </Button>
                ) : null}
                {step === "confirm" ? (
                  <Button
                    type="button"
                    variant="destructive"
                    disabled={busy || !emailReady || !preview?.canDelete}
                    onClick={() => void executeDelete()}
                    className="gap-1.5"
                  >
                    {busy ? (
                      <>
                        <Loader2 className="size-4 animate-spin" aria-hidden />
                        {t("deleting")}
                      </>
                    ) : (
                      <>
                        <Trash2 className="size-4" aria-hidden />
                        {t("confirmDelete")}
                      </>
                    )}
                  </Button>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
