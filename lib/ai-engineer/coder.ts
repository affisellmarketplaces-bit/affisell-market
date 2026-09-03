import { writeFileSync } from "node:fs"
import { join } from "node:path"
import { spawnSync } from "node:child_process"

import { auditAdminSessionBridge } from "@/lib/ai-engineer/admin-session-audit"
import { devLocalhostUrl } from "@/lib/dev-localhost-url"
import { AFFISELL_CONTEXT } from "@/lib/ai-engineer/context"
import { buildPoolerStripPatch } from "@/lib/ai-engineer/pooler-audit"
import { runIngManualNudgeCron } from "@/lib/cron/ing-manual-nudge"
import type { IngAction, IngTask } from "@/lib/ai-engineer/types"

function runTscCheck(): { ok: boolean; output: string } {
  const result = spawnSync("npx", ["tsc", "--noEmit"], {
    cwd: process.cwd(),
    encoding: "utf8",
    timeout: 120_000,
  })
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`.trim()
  return { ok: result.status === 0, output: output.slice(-2000) }
}

export class IngCoder {
  async fixBug(task: IngTask, options?: { dryRun?: boolean }): Promise<IngAction[]> {
    const dryRun = options?.dryRun ?? false
    const actions: IngAction[] = []

    if (
      task.id === "prisma_engine_empty" ||
      task.id === "fulfillment_pooler_misconfig"
    ) {
      const patch = buildPoolerStripPatch()
      if (!patch) {
        console.log("[ing]", { result: "fix_skip", taskId: task.id, reason: "pooler_already_healthy" })
        return [
          {
            file: "lib/ensure-database-url-unpooled.ts",
            change: "no-op",
            reason: "Pooler strip already present and direct URL is healthy",
            test: "auditFulfillmentPoolerConfig().healthy === true",
          },
        ]
      }

      if (!dryRun) {
        writeFileSync(join(process.cwd(), patch.file), patch.content, "utf8")
      }

      actions.push({
        file: patch.file,
        change: dryRun ? "[dry-run] restore -pooler hostname strip" : "restore -pooler hostname strip",
        reason: `${AFFISELL_CONTEXT.split("\n")[4]} — ${task.description}`,
        test: "npx tsc --noEmit",
      })

      const check = runTscCheck()
      actions.push({
        file: "tsconfig.json",
        change: check.ok ? "tsc OK" : "tsc failed",
        reason: "Post-fix typecheck",
        test: check.output.slice(-400),
      })

      console.log("[ing]", { result: "fix_bug", taskId: task.id, dryRun, tscOk: check.ok })
      return actions
    }

    if (task.id === "manual_required_flood") {
      const nudge = await runIngManualNudgeCron({ dryRun })
      const supplierCount =
        typeof nudge.suppliers === "number" ? nudge.suppliers : nudge.suppliers.length
      console.log("[ing]", {
        result: "fix_manual_nudge",
        taskId: task.id,
        dryRun,
        sent: nudge.sent,
        supplierCount,
        skipped48h: nudge.skipped48h,
      })

      let change: string
      if (dryRun) {
        change = `dry-run — ${supplierCount} suppliers, ${nudge.groupsCount} groups, ${nudge.skipped48h} skipped 48h`
      } else if (nudge.sent > 0) {
        change = `sent ${nudge.sent} nudges (${nudge.nudgeLogsWritten} logged), ${nudge.skipped48h} skipped 48h`
      } else if (nudge.skipped48h > 0) {
        change = `0 sent — ${nudge.skipped48h} supplier(s) déjà nudgés <48h (anti-spam). ${nudge.groupsCount} groups manual restants.`
      } else {
        change = `0 sent — aucun supplier éligible (${nudge.groupsCount} groups manual)`
      }

      return [
        {
          file: "app/api/cron/ing-manual-nudge/route.ts",
          change,
          reason: task.description,
          test: `curl -s '${devLocalhostUrl("/api/cron/ing-manual-nudge?dry=1")}'`,
        },
      ]
    }

    if (task.id === "next_auth_provider_missing") {
      const audit = auditAdminSessionBridge()
      if (audit.healthy) {
        console.log("[ing]", { result: "fix_skip", taskId: task.id, reason: "admin_session_bridge_healthy" })
        return [
          {
            file: "app/dashboard/admin/layout.tsx",
            change: "no-op",
            reason: "AdminLayoutChrome + server session bridge already in place (no useSession in admin-auth-actions)",
            test: "auditAdminSessionBridge().healthy === true",
          },
        ]
      }

      actions.push({
        file: "components/admin/admin-auth-actions.tsx",
        change: "manual",
        reason:
          "Remove useSession(); pass session from app/admin/layout.tsx + app/dashboard/admin/layout.tsx via AdminLayoutChrome",
        test: `curl -s -o /dev/null -w '%{http_code}' ${devLocalhostUrl("/dashboard/admin/ing")}`,
      })
      console.log("[ing]", { result: "fix_manual", taskId: task.id, audit })
      return actions
    }

    console.log("[ing]", { result: "fix_not_implemented", taskId: task.id, type: task.type })
    return actions
  }

  async implementFeature(description: string): Promise<IngAction[]> {
    console.log("[ing]", { result: "feature_stub", description: description.slice(0, 120) })
    return [
      {
        file: "lib/integrations/providers/custom-api.provider.ts",
        change: "not implemented in MVP",
        reason: `Feature request: ${description}`,
        test: "Follow Woo provider pattern — clone lib/integrations/providers/woo.provider.ts",
      },
    ]
  }
}
