import { prisma } from "@/lib/prisma"

import { collectDevLogLines, filterRelevantLogLines } from "@/lib/ai-engineer/log-sources"
import { auditFulfillmentPoolerConfig } from "@/lib/ai-engineer/pooler-audit"
import type { IngAnalyzeResult, IngTask, IngTaskId } from "@/lib/ai-engineer/types"

function countMatches(lines: string[], pattern: string | RegExp): number {
  return lines.filter((line) =>
    typeof pattern === "string" ? line.includes(pattern) : pattern.test(line)
  ).length
}

function pickSample(lines: string[], pattern: string | RegExp, max = 5): string[] {
  return lines
    .filter((line) => (typeof pattern === "string" ? line.includes(pattern) : pattern.test(line)))
    .slice(-max)
}

export class LogObserver {
  async analyzeLastLogs(limit = 100): Promise<IngAnalyzeResult> {
    const rawLines = collectDevLogLines(limit)
    const lines = filterRelevantLogLines(rawLines)
    const tasks: IngTask[] = []

    const engineEmptyCount = countMatches(lines, "Engine was empty")
    const manualRequiredCount = countMatches(lines, "manual_required")
    const autoBuyFailedCount = countMatches(lines, "auto_buy_async_failed")
    const emailFailedCount = countMatches(
      lines,
      /email_failed|order_confirmation_email_failed/
    )

    const poolerAudit = auditFulfillmentPoolerConfig()

    let dbManualGroups = 0
    try {
      dbManualGroups = await prisma.fulfillmentGroup.count({
        where: {
          status: "AWAITING_SHIPMENT",
          supplierIntegrationId: null,
        },
      })
    } catch (error) {
      console.warn("[ing]", {
        stage: "db_manual_count",
        error: error instanceof Error ? error.message : String(error),
      })
    }

    if (engineEmptyCount > 0 || !poolerAudit.healthy || poolerAudit.directUrlHasPooler) {
      tasks.push({
        id: "prisma_engine_empty",
        type: "BUG",
        description:
          engineEmptyCount > 0
            ? `Neon "Engine was empty" (${engineEmptyCount}×) — fulfillment writes must use direct URL (pooler:false)`
            : "Fulfillment direct DB URL misconfigured (pooler detected or strip missing)",
        logs: pickSample(lines, "Engine was empty"),
        priority: 95,
        count: engineEmptyCount,
        autoFixable: !poolerAudit.poolerStripPresent || poolerAudit.directUrlHasPooler,
      })
    }

    if (!poolerAudit.healthy && !tasks.some((t) => t.id === "prisma_engine_empty")) {
      tasks.push({
        id: "fulfillment_pooler_misconfig",
        type: "BUG",
        description: "Restore pooler→direct strip in ensure-database-url-unpooled.ts for fulfillment writes",
        logs: [`directHost=${poolerAudit.directHost ?? "unset"}`, `poolerStrip=${poolerAudit.poolerStripPresent}`],
        priority: 90,
        autoFixable: true,
      })
    }

    const manualSignal = Math.max(manualRequiredCount, dbManualGroups)
    if (manualSignal >= 5) {
      tasks.push({
        id: "manual_required_flood",
        type: "FEATURE",
        description:
          `${manualSignal} parcels en manual_required — connecter suppliers Shopify/Woo (sourceIntegrationId) pour auto-buy`,
        logs: pickSample(lines, "manual_required"),
        priority: 70,
        count: manualSignal,
        autoFixable: false,
      })
    }

    if (autoBuyFailedCount >= 2) {
      tasks.push({
        id: "auto_buy_async_failed",
        type: "BUG",
        description: `auto_buy_async_failed (${autoBuyFailedCount}×) — vérifier credentials integration + orchestrator retry`,
        logs: pickSample(lines, "auto_buy_async_failed"),
        priority: 80,
        count: autoBuyFailedCount,
        autoFixable: false,
      })
    }

    if (emailFailedCount >= 3) {
      tasks.push({
        id: "email_failed_spike",
        type: "OPTIMIZATION",
        description: `Spike email_failed (${emailFailedCount}×) — vérifier RESEND_FROM_EMAIL / TEST_EMAIL_TO`,
        logs: pickSample(lines, /email_failed/),
        priority: 50,
        count: emailFailedCount,
        autoFixable: false,
      })
    }

    tasks.sort((a, b) => b.priority - a.priority)

    console.log("[ing]", {
      result: "analyze",
      tasks: tasks.length,
      logLinesScanned: lines.length,
      dbManualGroups,
      poolerHealthy: poolerAudit.healthy,
    })

    return {
      tasks,
      logLinesScanned: lines.length,
      observedAt: new Date().toISOString(),
    }
  }

  findTask(tasks: IngTask[], taskId: string): IngTask | null {
    return tasks.find((t) => t.id === taskId) ?? null
  }
}

export function taskIdFromCliFlag(raw: string): IngTaskId | null {
  const allowed: IngTaskId[] = [
    "prisma_engine_empty",
    "manual_required_flood",
    "auto_buy_async_failed",
    "email_failed_spike",
    "fulfillment_pooler_misconfig",
  ]
  return allowed.includes(raw as IngTaskId) ? (raw as IngTaskId) : null
}
