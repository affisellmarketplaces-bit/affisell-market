import { collectCatalogHealthSignals } from "@/lib/sentinel/collectors/catalog-health"
import { collectFulfillmentFailedSignals } from "@/lib/sentinel/collectors/fulfillment-failed"
import { collectI18nParitySignals } from "@/lib/sentinel/collectors/i18n-parity"
import { collectProviderErrorSignals } from "@/lib/sentinel/collectors/provider-errors"
import { collectStripeStuckSignals } from "@/lib/sentinel/collectors/stripe-stuck"
import { collectWebhookErrorSignals } from "@/lib/sentinel/collectors/webhook-errors"
import { withSignalIds } from "@/lib/sentinel/signal-id"
import type { SentinelSignalInput } from "@/lib/sentinel/types"
import { opsWebhookAlert } from "@/lib/ops-webhook"
import { prisma } from "@/lib/prisma"

export type SentinelScanResult = {
  scannedAt: string
  detected: number
  resolved: number
  open: number
  newP0: number
}

async function collectAllSignals(): Promise<SentinelSignalInput[]> {
  const batches = await Promise.all([
    collectStripeStuckSignals(),
    collectFulfillmentFailedSignals(),
    collectWebhookErrorSignals(),
    collectCatalogHealthSignals(),
    collectI18nParitySignals(),
    collectProviderErrorSignals(),
  ])
  return batches.flat()
}

export async function runSentinelScan(opts?: { alertNewP0?: boolean }): Promise<SentinelScanResult> {
  const scannedAt = new Date()
  const raw = await collectAllSignals()
  const signals = withSignalIds(raw)
  const activeIds = new Set(signals.map((s) => s.id))

  const existingOpen = await prisma.opsSignal.findMany({
    where: { resolvedAt: null },
    select: { id: true, severity: true, code: true },
  })
  const existingOpenIds = new Set(existingOpen.map((s) => s.id))
  let newP0 = 0

  for (const s of signals) {
    const wasOpen = existingOpenIds.has(s.id)
    await prisma.opsSignal.upsert({
      where: { id: s.id },
      create: {
        id: s.id,
        severity: s.severity,
        domain: s.domain,
        code: s.code,
        title: s.title,
        detail: s.detail,
        metric: s.metric ?? null,
        entityType: s.entityType ?? null,
        entityId: s.entityId ?? null,
        playbook: s.playbook ?? null,
        detectedAt: scannedAt,
        lastSeenAt: scannedAt,
      },
      update: {
        severity: s.severity,
        domain: s.domain,
        code: s.code,
        title: s.title,
        detail: s.detail,
        metric: s.metric ?? null,
        entityType: s.entityType ?? null,
        entityId: s.entityId ?? null,
        playbook: s.playbook ?? null,
        resolvedAt: null,
        lastSeenAt: scannedAt,
      },
    })
    if (s.severity === "P0" && !wasOpen) newP0 += 1
  }

  const toResolve = existingOpen.filter((s) => !activeIds.has(s.id))
  if (toResolve.length > 0) {
    await prisma.opsSignal.updateMany({
      where: { id: { in: toResolve.map((s) => s.id) } },
      data: { resolvedAt: scannedAt },
    })
  }

  const open = await prisma.opsSignal.count({ where: { resolvedAt: null } })

  console.log("[sentinel]", {
    detected: signals.length,
    resolved: toResolve.length,
    open,
    newP0,
    result: "scan_complete",
  })

  if (opts?.alertNewP0 !== false && newP0 > 0) {
    const p0Titles = signals.filter((s) => s.severity === "P0").slice(0, 5).map((s) => s.title)
    void opsWebhookAlert(
      `🚨 Affisell Sentinel — ${newP0} new P0 signal(s)\n${p0Titles.join("\n")}`
    )
  }

  return {
    scannedAt: scannedAt.toISOString(),
    detected: signals.length,
    resolved: toResolve.length,
    open,
    newP0,
  }
}
