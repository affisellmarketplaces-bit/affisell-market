import { openai } from "@ai-sdk/openai"
import { convertToModelMessages, streamText, type UIMessage } from "ai"

import { validateAgentMessages } from "@/lib/agent-message-bounds"
import { rateLimitClientKey, rateLimitResponse } from "@/lib/api-rate-limit"
import { logBusiness } from "@/lib/business-log"
import { DONA_PUBLIC_SYSTEM_PROMPT } from "@/lib/dona/prompt-public"

export const runtime = "nodejs"
export const maxDuration = 15
export const dynamic = "force-dynamic"

function messageText(m: UIMessage): string {
  return m.parts
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join(" ")
}

export async function POST(req: Request) {
  const limited = rateLimitResponse(rateLimitClientKey(req), {
    prefix: "dona-public",
    limit: 15,
    windowMs: 60_000,
  })
  if (limited) return limited

  if (!process.env.OPENAI_API_KEY?.trim()) {
    return Response.json(
      {
        error: "dona_unavailable",
        message: "Dona: OpenAI offline — explore /sell ou /radar en attendant.",
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
  const bounds = validateAgentMessages(messages)
  if (!bounds.ok) {
    return Response.json({ error: bounds.error }, { status: 400 })
  }

  const lastUser = [...messages].reverse().find((m) => m.role === "user")
  const queryPreview = lastUser ? messageText(lastUser).slice(0, 100) : ""

  logBusiness("dona-public", { result: "request", queryPreview })

  const result = streamText({
    model: openai("gpt-4o-mini"),
    system: DONA_PUBLIC_SYSTEM_PROMPT,
    messages: await convertToModelMessages(messages),
    temperature: 0.8,
  })

  return result.toUIMessageStreamResponse()
}
