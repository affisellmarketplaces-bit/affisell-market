import { z } from "zod"

import { requireAdminSession } from "@/lib/admin/require-admin-session"
import { createRecall } from "@/lib/legal/gpsr"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const postSchema = z
  .object({
    productId: z.string().min(1),
    reason: z.string().min(10).max(5000),
    riskLevel: z.enum(["faible", "grave", "critique"]),
    lotNumber: z.string().optional(),
  })
  .strict()

export async function POST(req: Request) {
  const gate = await requireAdminSession()
  if (!gate.ok) {
    return Response.json({ error: gate.error }, { status: gate.status })
  }

  try {
    const body = postSchema.parse(await req.json())
    const recall = await createRecall(body)
    return Response.json({ ok: true, recall })
  } catch (error) {
    const message = error instanceof Error ? error.message : "create_failed"
    console.error("[legal:recall]", { stage: "create", error: message })
    const status = message === "product_not_found" ? 404 : 400
    return Response.json({ ok: false, error: message }, { status })
  }
}

export async function GET(req: Request) {
  const gate = await requireAdminSession()
  if (!gate.ok) {
    return Response.json({ error: gate.error }, { status: gate.status })
  }

  const recalls = await prisma.productRecall.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
  })

  return Response.json({ ok: true, recalls })
}
