"use client"

import { toast } from "sonner"

import { getInstantScanDisplayName, INSTANTSCAN_NAME } from "@/lib/instantscan/flags"

export type InstantScanToastRetry = () => void

function brandName(): string {
  return getInstantScanDisplayName()
}

export function toastInstantScanLoading(): string | number {
  return toast.loading(`${brandName()} en cours...`)
}

export function toastInstantScanRetrying(): void {
  toast.message(`⚡ InstantScan saturé — réessai automatique...`)
}

export function toastInstantScanSuccess(args: {
  model: string
  confidencePct: string | null
  latencyMs: number
  toastId?: string | number
}): void {
  const label = brandName()
  const prefix = label.startsWith("⚡") ? label : `⚡ ${label}`
  const suffix = [args.confidencePct, `${args.latencyMs}ms`].filter(Boolean).join(" • ")
  const message = suffix
    ? `${prefix} : ${args.model} détecté • ${suffix}`
    : `${prefix} : ${args.model} détecté`
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
  const label = INSTANTSCAN_NAME

  if (status === 501 || error === "instantscan_disabled") {
    toast.error(`⚡ ${label} désactivé par l'admin`)
    return
  }
  if (status === 401 || status === 403 || error === "missing_api_key") {
    toast.error(`⚡ ${label} : clé OpenAI manquante`)
    return
  }
  if (status === 429 || error === "instantscan_rate_limit") {
    toast.error(`⚡ ${label} saturé — réessayez dans 60s`, { action: retryAction })
    return
  }
  if (error === "low_confidence") {
    toast.message(`${label} incertain - complétez manuellement`)
    return
  }
  if (status === 0 || error === "network_error") {
    toast.error(`⚡ ${label} erreur réseau — réessayer`, { action: retryAction })
    return
  }
  toast.error(`⚡ ${label} erreur — réessayer`, { action: retryAction })
}

export function toastInstantScanNetworkError(onRetry?: InstantScanToastRetry): void {
  const label = INSTANTSCAN_NAME
  toast.error(`⚡ ${label} erreur réseau — réessayer`, {
    action: onRetry ? { label: "Retry", onClick: onRetry } : undefined,
  })
}
