"use client"

import { useEffect, useRef, useState } from "react"

type ShieldBlockedHumanButtonProps = {
  returnTo: string
}

type VerifyPhase = "idle" | "scanning" | "success" | "error"

const VERIFY_TIMEOUT_MS = 12_000

export function ShieldBlockedHumanButton({ returnTo }: ShieldBlockedHumanButtonProps) {
  const startedAtRef = useRef(Date.now())
  const [phase, setPhase] = useState<VerifyPhase>("idle")
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    startedAtRef.current = Date.now()
  }, [])

  async function handleHumanClaim() {
    if (phase === "scanning" || phase === "success") return

    setPhase("scanning")
    setMessage(null)

    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), VERIFY_TIMEOUT_MS)

    try {
      const res = await fetch("/api/security/verify-human", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          startedAt: startedAtRef.current,
          returnTo,
          website: "",
        }),
      })

      const payload = (await res.json().catch(() => null)) as {
        ok?: boolean
        redirectTo?: string
        error?: string
      } | null

      if (!res.ok || !payload?.ok) {
        console.warn("[shield-verify]", {
          step: "client_reject",
          status: res.status,
          error: payload?.error ?? "unknown",
        })
        setPhase("error")
        setMessage("Vérification impossible. Réessayez dans quelques secondes.")
        return
      }

      setPhase("success")
      setMessage("Identité confirmée — redirection…")
      window.setTimeout(() => {
        window.location.assign(payload.redirectTo?.trim() || returnTo || "/")
      }, 420)
    } catch (err) {
      const aborted = err instanceof DOMException && err.name === "AbortError"
      console.warn("[shield-verify]", {
        step: aborted ? "client_timeout" : "client_error",
        message: err instanceof Error ? err.message : "unknown",
      })
      setPhase("error")
      setMessage(
        aborted
          ? "Délai dépassé. Vérifiez votre connexion puis réessayez."
          : "Erreur réseau. Réessayez."
      )
    } finally {
      window.clearTimeout(timeout)
    }
  }

  const busy = phase === "scanning" || phase === "success"
  const label =
    phase === "scanning"
      ? "Analyse biométrique…"
      : phase === "success"
        ? "Accès débloqué ✓"
        : phase === "error"
          ? "Réessayer la vérification"
          : "Confirmer que je suis humain"

  return (
    <div className="mt-4 space-y-2">
      <button
        type="button"
        disabled={busy}
        onClick={() => void handleHumanClaim()}
        className="relative inline-flex w-full items-center justify-center overflow-hidden rounded-full border border-violet-300/70 bg-gradient-to-r from-violet-600 via-indigo-600 to-blue-700 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-violet-900/25 transition hover:brightness-110 disabled:cursor-wait disabled:opacity-80"
      >
        {phase === "scanning" ? (
          <span
            className="absolute inset-0 animate-pulse bg-gradient-to-r from-transparent via-white/20 to-transparent"
            aria-hidden
          />
        ) : null}
        <span className="relative">{label}</span>
      </button>
      {message ? (
        <p
          className={`text-xs ${phase === "error" ? "text-rose-600" : "text-emerald-700"}`}
          role="status"
        >
          {message}
        </p>
      ) : (
        <p className="text-xs text-zinc-500">
          Passe humain 24 h · sans captcha · cookie sécurisé Affisell
        </p>
      )}
    </div>
  )
}
