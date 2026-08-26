import { z } from "zod"

import { requireAdminSession } from "@/lib/admin/require-admin-session"
import { hasOpenAiFallback, openaiChatText } from "@/lib/ai/openai-chat-fallback"
import {
  AFFISELL_LEGAL_SYSTEM_PROMPT,
  buildLegalUserMessage,
  LEGAL_AI_MODEL,
  type LegalAnalyzeType,
} from "@/lib/legal/brain"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const postSchema = z
  .object({
    type: z.enum(["doctrine", "contract", "risk", "compliance", "litigation"] satisfies LegalAnalyzeType[]),
    content: z.string().max(120_000).optional(),
    question: z.string().max(8_000).optional(),
  })
  .strict()

export async function POST(req: Request) {
  const gate = await requireAdminSession()
  if (!gate.ok) {
    return Response.json({ ok: false, error: gate.error }, { status: gate.status })
  }

  if (!hasOpenAiFallback()) {
    console.log("[legal]", { stage: "analyze", result: "openai_key_missing" })
    return Response.json(
      {
        ok: false,
        error: "openai_key_missing",
        analysis: null,
      },
      { status: 503 }
    )
  }

  let body: z.infer<typeof postSchema>
  try {
    const raw = (await req.json()) as unknown
    body = postSchema.parse(raw)
  } catch (error) {
    const message = error instanceof Error ? error.message : "invalid_body"
    console.log("[legal]", { stage: "analyze", result: "validation_error", message })
    return Response.json({ ok: false, error: "invalid_body", analysis: null }, { status: 400 })
  }

  let userMessage: string
  try {
    userMessage = buildLegalUserMessage(body)
  } catch (error) {
    const code = error instanceof Error ? error.message : "invalid_input"
    console.log("[legal]", { stage: "analyze", result: "input_error", type: body.type, code })
    return Response.json({ ok: false, error: code, analysis: null }, { status: 400 })
  }

  try {
    const analysis = await openaiChatText({
      model: LEGAL_AI_MODEL,
      temperature: 0.15,
      max_tokens: 4_096,
      messages: [
        { role: "system", content: AFFISELL_LEGAL_SYSTEM_PROMPT },
        { role: "user", content: userMessage },
      ],
    })

    if (!analysis) {
      console.log("[legal]", { stage: "analyze", result: "empty_response", type: body.type })
      return Response.json(
        { ok: false, error: "empty_response", analysis: null },
        { status: 502 }
      )
    }

    console.log("[legal]", {
      stage: "analyze",
      result: "ok",
      type: body.type,
      chars: analysis.length,
    })

    return Response.json({ ok: true, analysis })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error("[legal]", { stage: "analyze", result: "openai_error", type: body.type, error: message })
    return Response.json({ ok: false, error: "openai_error", analysis: null }, { status: 502 })
  }
}
