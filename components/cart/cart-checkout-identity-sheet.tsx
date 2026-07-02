"use client"

import type { FormEvent } from "react"
import { Mail, Phone, X } from "lucide-react"
import { useTranslations } from "next-intl"
import { useEffect, useState } from "react"

import { CheckoutPaymentHandoff } from "@/components/checkout/checkout-payment-handoff"
import type { GuestCartItem } from "@/lib/guest-cart"

type Channel = "email" | "phone"

export type CheckoutIdentityPayload = Record<string, unknown>

type Props = {
  open: boolean
  onClose: () => void
  onIdentified: () => void | Promise<void>
  /** When set, one API call → Stripe redirect (fast path). */
  checkoutPayload?: CheckoutIdentityPayload | null
  guestCartItems?: GuestCartItem[]
}

export function CartCheckoutIdentitySheet({
  open,
  onClose,
  onIdentified,
  checkoutPayload = null,
  guestCartItems,
}: Props) {
  const t = useTranslations("cart.identity")
  const [channel, setChannel] = useState<Channel>("email")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [loading, setLoading] = useState(false)
  const [handoffOpen, setHandoffOpen] = useState(false)
  const [handoffPhase, setHandoffPhase] = useState<"identifying" | "redirecting">("identifying")
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setError(null)
    void fetch("/api/auth/session", { credentials: "include", cache: "no-store" }).catch(() => undefined)
  }, [open])

  if (!open && !handoffOpen) return null

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    setHandoffOpen(true)
    setHandoffPhase("identifying")

    const identityBody =
      channel === "email"
        ? { channel: "email" as const, email: email.trim() }
        : { channel: "phone" as const, phone: phone.trim() }

    try {
      if (checkoutPayload) {
        setHandoffPhase("redirecting")
        const res = await fetch("/api/checkout/identified", {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          credentials: "include",
          keepalive: true,
          body: JSON.stringify({
            ...identityBody,
            checkout: checkoutPayload,
            guestCartItems: guestCartItems?.length ? guestCartItems : undefined,
          }),
        })
        const data = (await res.json()) as { url?: string; error?: string }
        if (data.url) {
          if (guestCartItems?.length) {
            try {
              const { writeGuestCart } = await import("@/lib/guest-cart")
              writeGuestCart([])
              window.dispatchEvent(new CustomEvent("affisell:cart-updated"))
            } catch {
              /* guest cart cleanup is best-effort before redirect */
            }
          }
          window.location.assign(data.url)
          return
        }
        setHandoffOpen(false)
        setError(data.error ?? t("identifyFailed"))
        return
      }

      const res = await fetch("/api/auth/buyer-identify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(identityBody),
      })
      const data = (await res.json()) as { error?: string; sessionEstablished?: boolean }
      if (!res.ok || !data.sessionEstablished) {
        setHandoffOpen(false)
        setError(data.error ?? t("identifyFailed"))
        return
      }

      setHandoffPhase("redirecting")
      await onIdentified()
    } catch {
      setHandoffOpen(false)
      setError(t("networkError"))
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <CheckoutPaymentHandoff open={handoffOpen} phase={handoffPhase} />
      {open ? (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center"
          role="dialog"
          aria-modal="true"
          data-testid="checkout-identity-sheet"
        >
          <button
            type="button"
            className="absolute inset-0 bg-zinc-950/50 backdrop-blur-sm"
            aria-label={t("close")}
            onClick={onClose}
          />
          <div className="relative z-10 w-full max-w-md rounded-t-3xl border border-zinc-200 bg-white p-6 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900 sm:rounded-3xl">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-violet-600 dark:text-violet-400">
                  {t("beforePay")}
                </p>
                <h2 className="mt-1 text-xl font-bold text-zinc-900 dark:text-zinc-50">{t("title")}</h2>
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{t("subtitle")}</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-full p-2 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                aria-label={t("close")}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mb-4 grid grid-cols-2 gap-2 rounded-2xl bg-zinc-100 p-1 dark:bg-zinc-800">
          <button
            type="button"
            onClick={() => setChannel("email")}
            data-testid="checkout-identity-email-tab"
                className={`flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold transition ${
                  channel === "email"
                    ? "bg-white text-violet-700 shadow dark:bg-zinc-900 dark:text-violet-300"
                    : "text-zinc-600 dark:text-zinc-400"
                }`}
              >
                <Mail className="h-4 w-4" aria-hidden />
                {t("emailTab")}
              </button>
          <button
            type="button"
            onClick={() => setChannel("phone")}
            data-testid="checkout-identity-phone-tab"
                className={`flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold transition ${
                  channel === "phone"
                    ? "bg-white text-violet-700 shadow dark:bg-zinc-900 dark:text-violet-300"
                    : "text-zinc-600 dark:text-zinc-400"
                }`}
              >
                <Phone className="h-4 w-4" aria-hidden />
                {t("phoneTab")}
              </button>
            </div>

            <form onSubmit={(e) => void onSubmit(e)} className="space-y-4">
              {channel === "email" ? (
                <div>
                  <label
                    htmlFor="checkout-email"
                    className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
                  >
                    {t("emailLabel")}
                  </label>
              <input
                id="checkout-email"
                type="email"
                required
                autoComplete="email"
                data-testid="checkout-identity-email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={t("emailPlaceholder")}
                    className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm outline-none ring-violet-500 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-950"
                  />
                </div>
              ) : (
                <div>
                  <label
                    htmlFor="checkout-phone"
                    className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
                  >
                    {t("phoneLabel")}
                  </label>
              <input
                id="checkout-phone"
                type="tel"
                required
                autoComplete="tel"
                data-testid="checkout-identity-phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder={t("phonePlaceholder")}
                    className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm outline-none ring-violet-500 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-950"
                  />
                </div>
              )}

              {error ? (
                <p className="rounded-xl bg-red-50 px-3 py-2 text-center text-sm text-red-700 dark:bg-red-950/50 dark:text-red-200">
                  {error}
                </p>
              ) : null}

          <button
            type="submit"
            disabled={loading}
            data-testid="checkout-identity-submit"
                className="w-full rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-600 py-3.5 text-sm font-semibold text-white shadow-md disabled:opacity-60"
              >
                {loading ? t("preparing") : t("continueCheckout")}
              </button>
            </form>

            <p className="mt-4 text-center text-xs text-zinc-500 dark:text-zinc-400">{t("legalNote")}</p>
          </div>
        </div>
      ) : null}
    </>
  )
}
