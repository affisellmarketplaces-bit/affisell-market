#!/usr/bin/env node
/**
 * Affisell Ing CLI
 *
 *   npx tsx scripts/ing.ts analyze
 *   npx tsx scripts/ing.ts fix --task=manual_required_flood
 *   npx tsx scripts/ing.ts fix --task=prisma_engine_empty --dry-run
 */
import "dotenv/config"

import { IngCoder } from "@/lib/ai-engineer/coder"
import { LogObserver, taskIdFromCliFlag } from "@/lib/ai-engineer/observer"
import { IngShipper } from "@/lib/ai-engineer/shipper"

function parseTaskFlag(): string | null {
  const arg = process.argv.find((a) => a.startsWith("--task="))
  return arg ? arg.slice("--task=".length) : null
}

async function main() {
  const cmd = process.argv[2] ?? "analyze"
  const dryRun = process.argv.includes("--dry-run")
  const observer = new LogObserver()

  if (cmd === "analyze") {
    const result = await observer.analyzeLastLogs(100)
    console.log(JSON.stringify(result, null, 2))
    return
  }

  if (cmd === "fix") {
    const rawTask = parseTaskFlag()
    if (!rawTask) {
      console.error("Usage: npx tsx scripts/ing.ts fix --task=prisma_engine_empty [--dry-run]")
      process.exit(1)
    }
    const taskId = taskIdFromCliFlag(rawTask)
    if (!taskId) {
      console.error(`Unknown task id: ${rawTask}`)
      process.exit(1)
    }

    const { tasks } = await observer.analyzeLastLogs(100)
    const task = observer.findTask(tasks, taskId)
    if (!task) {
      console.error(`Task ${taskId} not detected in current logs/context. Run analyze first.`)
      process.exit(1)
    }

    const coder = new IngCoder()
    const actions =
      task.type === "BUG"
        ? await coder.fixBug(task, { dryRun })
        : await coder.implementFeature(task.description)

    const shipper = new IngShipper()
    const shipped = await shipper.ship(actions, {
      dryRun,
      message: `fix(ing): ${task.id} — CLI auto-fix`,
    })

    console.log(JSON.stringify({ task, actions, shipped }, null, 2))
    return
  }

  console.error(`Unknown command: ${cmd}. Use analyze | fix`)
  process.exit(1)
}

main().catch((error) => {
  console.error("[ing]", {
    result: "cli_error",
    error: error instanceof Error ? error.message : String(error),
  })
  process.exit(1)
})
