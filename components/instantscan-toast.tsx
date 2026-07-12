"use client"

import { toast } from "sonner"

import { INSTANTSCAN_PRODUCT_NAME } from "@/lib/instantscan/brand"

export type InstantScanToastRetry = () => void

export function toastInstantScanLoading(): string | number {
  return toast.loading(`${INSTANTSCAN_PRODUCT_NAME} en cours...`)
}

export function toastInstantScanRetrying(): void {
  toast.message(`${INSTANTSCAN_PRODUCT_NAME} — réessai automatique…`)
}

export function toastInstantScanSuccess(args: {
  model: string
  confidencePct: string | null
  latencyMs: number
  toastId?: string | number
}): void {
  const suffix = [args.confidencePct, `${args.latencyMs}ms`].filter(Boolean).join(" • ")
  const message = suffix
    ? `${INSTANTSCAN_PRODUCT_NAME} : ${args.model} détecté • ${suffix}`
    : `${INSTANTSCAN_PRODUCT_NAME} : ${args.model} détecté`
  if (args.toastId != null) {
    toast.success(message, { id: args.toastId })
    return
  }
  toast.success(message)
}

export function toastInstantScanApiError(args: {
  status: number
  error?: string
  retryAfterSec?: number
  onRetry?: InstantScanToastRetry
}): void {
  const { status, error, retryAfterSec, onRetry } = args
  const retryAction = onRetry
    ? { label: "Retry", onClick: onRetry }
    : undefined

  if (status === 501 || error === "instantscan_disabled") {
    toast.error(`${INSTANTSCAN_PRODUCT_NAME} désactivé par l'admin`)
    return
  }
  if (status === 403 || error === "session_forbidden") {
    toast.error(`${INSTANTSCAN_PRODUCT_NAME} — session expirée, reconnectez-vous`)
    return
  }
  if (status === 401 || error === "missing_api_key") {
    toast.error(`${INSTANTSCAN_PRODUCT_NAME} : clé OpenAI manquante`)
    return
  }
  if (status === 429 || error === "rate_limit" || error === "instantscan_rate_limit") {
    const wait = retryAfterSec ?? 60
    toast.error(`${INSTANTSCAN_PRODUCT_NAME} saturé — réessayez dans ${wait}s`, {
      action: retryAction,
    })
    return
  }
  if (error === "low_confidence") {
    toast.message(`${INSTANTSCAN_PRODUCT_NAME} incertain — complétez manuellement`)
    return
  }
  if (error === "ai_unavailable") {
    toast.message(`${INSTANTSCAN_PRODUCT_NAME} indisponible — complétez manuellement`, {
      action: retryAction,
    })
    return
  }
  if (status === 0 || error === "network_error") {
    toast.error(`${INSTANTSCAN_PRODUCT_NAME} erreur réseau — réessayer`, { action: retryAction })
    return
  }
  toast.error(`${INSTANTSCAN_PRODUCT_NAME} erreur — réessayer`, { action: retryAction })
}

export function toastInstantScanNetworkError(onRetry?: InstantScanToastRetry): void {
  toast.error(`${INSTANTSCAN_PRODUCT_NAME} erreur réseau — réessayer`, {
    action: onRetry ? { label: "Retry", onClick: onRetry } : undefined,
  })
}
