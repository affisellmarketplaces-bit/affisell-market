import { groq } from "@ai-sdk/groq"
import { convertToModelMessages, streamText, type UIMessage } from "ai"

import { rateLimitClientKey, rateLimitResponse } from "@/lib/api-rate-limit"
import { logBusiness } from "@/lib/business-log"
import { resolveAppUrl } from "@/lib/emails/send-order-confirmation"
import {
  SUPPORT_AGENT_SYSTEM_PROMPT,
} from "@/lib/support/support-knowledge"

export const runtime = "nodejs"
export const maxDuration = 30
export const dynamic = "force-dynamic"

function messageText(m: UIMessage): string {
  return m.parts
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join(" ")
}

export async function POST(req: Request) {
  const limited = rateLimitResponse(rateLimitClientKey(req), {
    prefix: "agent-support",
    limit: 20,
    windowMs: 60_000,
  })
  if (limited) return limited

  if (!process.env.GROQ_API_KEY?.trim()) {
    return Response.json(
      {
        error: "support_agent_unavailable",
        hint: "Consultez /faq ou /contact",
      },
      { status: 503 }
    )
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const parsed = body as { messages?: unknown }
  if (!Array.isArray(parsed.messages)) {
    return Response.json({ error: "Expected { messages: UIMessage[] }" }, { status: 400 })
  }

  const messages = parsed.messages as UIMessage[]
  const lastUser = [...messages].reverse().find((m) => m.role === "user")
  const queryPreview = lastUser ? messageText(lastUser).slice(0, 80) : ""

  logBusiness("support-agent", { result: "request", queryPreview })

  const baseUrl = resolveAppUrl()
  const system = `${SUPPORT_AGENT_SYSTEM_PROMPT}\n\nBASE=${baseUrl}`

  const result = streamText({
    model: groq("llama-3.3-70b-versatile"),
    system,
    messages: await convertToModelMessages(messages),
  })

  return result.toUIMessageStreamResponse()
}
