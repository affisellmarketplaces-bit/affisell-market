"use client"

import type { FormEvent } from "react"
import { Mail, Phone, X } from "lucide-react"
import { signIn } from "next-auth/react"
import { useState } from "react"

type Channel = "email" | "phone"

type Props = {
  open: boolean
  onClose: () => void
  onIdentified: () => void | Promise<void>
}

export function CartCheckoutIdentitySheet({ open, onClose, onIdentified }: Props) {
  const [channel, setChannel] = useState<Channel>("email")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!open) return null

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = await fetch("/api/auth/buyer-identify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          channel === "email" ? { channel: "email", email: email.trim() } : { channel: "phone", phone: phone.trim() }
        ),
      })
      const data = (await res.json()) as { error?: string; checkoutMagic?: string }
      if (!res.ok || !data.checkoutMagic) {
        setError(data.error ?? "Impossible de continuer. Réessayez.")
        return
      }
      const login = await signIn("credentials", {
        checkoutMagic: data.checkoutMagic,
        redirect: false,
        callbackUrl: "/cart",
      })
      if (login?.error) {
        setError("Connexion impossible après identification.")
        return
      }
      await onIdentified()
    } catch {
      setError("Réseau indisponible. Réessayez.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center" role="dialog" aria-modal="true">
      <button
        type="button"
        className="absolute inset-0 bg-zinc-950/50 backdrop-blur-sm"
        aria-label="Fermer"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-md rounded-t-3xl border border-zinc-200 bg-white p-6 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900 sm:rounded-3xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-violet-600 dark:text-violet-400">
              Avant le paiement
            </p>
            <h2 className="mt-1 text-xl font-bold text-zinc-900 dark:text-zinc-50">Continuer avec votre identité</h2>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Votre compte client est créé automatiquement pour suivre vos commandes et votre cashback.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            aria-label="Fermer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-2 rounded-2xl bg-zinc-100 p-1 dark:bg-zinc-800">
          <button
            type="button"
            onClick={() => setChannel("email")}
            className={`flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold transition ${
              channel === "email"
                ? "bg-white text-violet-700 shadow dark:bg-zinc-900 dark:text-violet-300"
                : "text-zinc-600 dark:text-zinc-400"
            }`}
          >
            <Mail className="h-4 w-4" aria-hidden />
            E-mail
          </button>
          <button
            type="button"
            onClick={() => setChannel("phone")}
            className={`flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold transition ${
              channel === "phone"
                ? "bg-white text-violet-700 shadow dark:bg-zinc-900 dark:text-violet-300"
                : "text-zinc-600 dark:text-zinc-400"
            }`}
          >
            <Phone className="h-4 w-4" aria-hidden />
            Téléphone
          </button>
        </div>

        <form onSubmit={(e) => void onSubmit(e)} className="space-y-4">
          {channel === "email" ? (
            <div>
              <label htmlFor="checkout-email" className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Adresse e-mail
              </label>
              <input
                id="checkout-email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="vous@exemple.com"
                className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm outline-none ring-violet-500 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-950"
              />
            </div>
          ) : (
            <div>
              <label htmlFor="checkout-phone" className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Numéro de mobile
              </label>
              <input
                id="checkout-phone"
                type="tel"
                required
                autoComplete="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="06 12 34 56 78"
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
            className="w-full rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-600 py-3.5 text-sm font-semibold text-white shadow-md disabled:opacity-60"
          >
            {loading ? "Préparation…" : "Continuer vers le paiement"}
          </button>
        </form>

        <p className="mt-4 text-center text-xs text-zinc-500 dark:text-zinc-400">
          En validant, vous acceptez la création d’un compte acheteur Affisell pour vos bonus cashback.
        </p>
      </div>
    </div>
  )
}
