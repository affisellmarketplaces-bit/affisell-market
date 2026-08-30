import { openai } from "@ai-sdk/openai"
import { convertToModelMessages, stepCountIs, streamText, type UIMessage } from "ai"

import { validateAgentMessages } from "@/lib/agent-message-bounds"
import { rateLimitClientKey, rateLimitResponse } from "@/lib/api-rate-limit"
import { logBusiness } from "@/lib/business-log"
import {
  DONA_CAPTAIN_FORBIDDEN,
  isDonaCaptainReferer,
} from "@/lib/dona/captain-access"
import { DONA_PRIVATE_SYSTEM_PROMPT } from "@/lib/dona/prompt-private"
import { privateTools } from "@/lib/dona/tools-private"
import { getEnvInfo } from "@/lib/env"

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
  if (!isDonaCaptainReferer(req)) {
    return Response.json({ error: DONA_CAPTAIN_FORBIDDEN }, { status: 403 })
  }

  const limited = rateLimitResponse(rateLimitClientKey(req), {
    prefix: "dona-captain",
    limit: 20,
    windowMs: 60_000,
  })
  if (limited) return limited

  if (!process.env.OPENAI_API_KEY?.trim()) {
    return Response.json(
      { error: "dona_unavailable", message: "Dona Capitaine: OPENAI_API_KEY manquante." },
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
  const queryPreview = lastUser ? messageText(lastUser).slice(0, 120) : ""

  logBusiness("dona-captain", { result: "request", queryPreview })

  let envBlock = ""
  try {
    const env = getEnvInfo()
    envBlock = `\n\nRuntime DB: ${env.env.toUpperCase()} · endpoint ${env.dbHost} · branch ${env.branch}.${
      env.isProd ? "\n⚠ CAPITAINE! Tu es sur PROD — prudence absolue." : ""
    }`
  } catch {
    envBlock = ""
  }

  const result = streamText({
    model: openai("gpt-4o-mini"),
    system: `${DONA_PRIVATE_SYSTEM_PROMPT}${envBlock}`,
    messages: await convertToModelMessages(messages),
    tools: privateTools,
    stopWhen: stepCountIs(8),
    temperature: 0.7,
    onError: ({ error }) => {
      console.error("[dona/chat-private] streamText", error)
    },
  })

  return result.toUIMessageStreamResponse()
}
