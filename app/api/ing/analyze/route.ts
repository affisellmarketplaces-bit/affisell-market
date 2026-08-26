import { z } from "zod"

import { requireAdminSession } from "@/lib/admin/require-admin-session"
import { IngCoder } from "@/lib/ai-engineer/coder"
import { LogObserver } from "@/lib/ai-engineer/observer"
import { IngShipper } from "@/lib/ai-engineer/shipper"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const gate = await requireAdminSession()
  if (!gate.ok) {
    return Response.json({ error: gate.error }, { status: gate.status })
  }

  try {
    const observer = new LogObserver()
    const result = await observer.analyzeLastLogs(100)
    return Response.json(result)
  } catch (error) {
    console.error("[ing]", {
      stage: "analyze_get",
      error: error instanceof Error ? error.message : String(error),
    })
    return Response.json({ error: "analyze_failed" }, { status: 500 })
  }
}

const postSchema = z
  .object({
    taskId: z.string().min(1),
    autoFix: z.boolean().optional(),
    dryRun: z.boolean().optional(),
  })
  .strict()

export async function POST(req: Request) {
  const gate = await requireAdminSession()
  if (!gate.ok) {
    return Response.json({ error: gate.error }, { status: gate.status })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 })
  }

  const parsed = postSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: "invalid_body" }, { status: 400 })
  }

  const { taskId, autoFix = false, dryRun = false } = parsed.data

  try {
    const observer = new LogObserver()
    const { tasks } = await observer.analyzeLastLogs(100)
    const task = observer.findTask(tasks, taskId)
    if (!task) {
      return Response.json({ error: "task_not_found", taskId }, { status: 404 })
    }

    if (!autoFix) {
      return Response.json({ task, actions: [], shipped: null })
    }

    const coder = new IngCoder()
    const actions =
      task.type === "BUG"
        ? await coder.fixBug(task, { dryRun })
        : await coder.implementFeature(task.description)

    const shipper = new IngShipper()
    const shipped = await shipper.ship(actions, {
      dryRun,
      message: `fix(ing): ${task.id} — ${task.description.slice(0, 72)}`,
    })

    console.log("[ing]", { result: "analyze_post", taskId, autoFix, dryRun, shipped: shipped.commit })

    return Response.json({ task, actions, shipped })
  } catch (error) {
    console.error("[ing]", {
      stage: "analyze_post",
      taskId,
      error: error instanceof Error ? error.message : String(error),
    })
    return Response.json({ error: "fix_failed" }, { status: 500 })
  }
}
