"use client"

import { toast } from "sonner"

export type InstantScanToastRetry = () => void

export function toastInstantScanLoading(): string | number {
  return toast.loading("InstantScan en cours...")
}

export function toastInstantScanRetrying(): void {
  toast.message("⚡ InstantScan saturé — réessai automatique...")
}

export function toastInstantScanSuccess(args: {
  model: string
  confidencePct: string | null
  latencyMs: number
  toastId?: string | number
}): void {
  const suffix = [args.confidencePct, `${args.latencyMs}ms`].filter(Boolean).join(" • ")
  const message = suffix
    ? `⚡ InstantScan : ${args.model} détecté • ${suffix}`
    : `⚡ InstantScan : ${args.model} détecté`
  if (args.toastId != null) {
    toast.success(message, { id: args.toastId })
    return
  }
  toast.success(message)
}

export function toastInstantScanApiError(args: {
  status: number
  error?: string
  onRetry?: InstantScanToastRetry
}): void {
  const { status, error, onRetry } = args
  const retryAction = onRetry
    ? { label: "Retry", onClick: onRetry }
    : undefined

  if (status === 501 || error === "instantscan_disabled") {
    toast.error("⚡ InstantScan désactivé par l'admin")
    return
  }
  if (status === 401 || status === 403 || error === "missing_api_key") {
    toast.error("⚡ InstantScan : clé OpenAI manquante")
    return
  }
  if (status === 429 || error === "instantscan_rate_limit") {
    toast.error("⚡ InstantScan saturé — réessayez dans 60s", { action: retryAction })
    return
  }
  if (error === "low_confidence") {
    toast.message("InstantScan incertain - complétez manuellement")
    return
  }
  if (status === 0 || error === "network_error") {
    toast.error("⚡ InstantScan erreur réseau — réessayer", { action: retryAction })
    return
  }
  toast.error("⚡ InstantScan erreur — réessayer", { action: retryAction })
}

export function toastInstantScanNetworkError(onRetry?: InstantScanToastRetry): void {
  toast.error("⚡ InstantScan erreur réseau — réessayer", {
    action: onRetry ? { label: "Retry", onClick: onRetry } : undefined,
  })
}
