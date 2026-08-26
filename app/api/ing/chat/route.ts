import { z } from "zod"

import { requireAdminSession } from "@/lib/admin/require-admin-session"
import { ingChatPlan } from "@/lib/ai-engineer/chat"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const postSchema = z.object({ message: z.string().min(1).max(4000) }).strict()

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

  try {
    const plan = await ingChatPlan(parsed.data.message)
    return Response.json(plan)
  } catch (error) {
    console.error("[ing]", {
      stage: "chat",
      error: error instanceof Error ? error.message : String(error),
    })
    return Response.json({ error: "chat_failed" }, { status: 500 })
  }
}
