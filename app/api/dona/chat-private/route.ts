import { type UIMessage } from "ai"

import { validateAgentMessages } from "@/lib/agent-message-bounds"
import { rateLimitClientKey, rateLimitResponse } from "@/lib/api-rate-limit"
import { logBusiness } from "@/lib/business-log"
import {
  DONA_CAPTAIN_FORBIDDEN,
  isDonaCaptainReferer,
} from "@/lib/dona/captain-access"
import { formatDonaUnavailable } from "@/lib/dona/dona-errors"
import { resolveDonaModels } from "@/lib/dona/dona-model"
import { donaMessageText } from "@/lib/dona/message-utils"
import { DONA_PRIVATE_SYSTEM_PROMPT } from "@/lib/dona/prompt-private"
import { runDonaStreamResponse } from "@/lib/dona/run-dona-stream"
import { privateTools } from "@/lib/dona/tools-private"
import { getEnvInfo } from "@/lib/env"
import { resolveAppLocale } from "@/lib/i18n-locale"

export const runtime = "nodejs"
export const maxDuration = 45
export const dynamic = "force-dynamic"

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

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const parsed = body as { messages?: unknown; locale?: unknown }
  const locale = resolveAppLocale(typeof parsed.locale === "string" ? parsed.locale : null)

  if (!resolveDonaModels()) {
    return Response.json(
      {
        error: "dona_unavailable",
        message: formatDonaUnavailable(locale),
      },
      { status: 503 }
    )
  }

  if (!Array.isArray(parsed.messages)) {
    return Response.json({ error: "Expected { messages: UIMessage[] }" }, { status: 400 })
  }

  const messages = parsed.messages as UIMessage[]
  const bounds = validateAgentMessages(messages)
  if (!bounds.ok) {
    return Response.json({ error: bounds.error }, { status: 400 })
  }

  const lastUser = [...messages].reverse().find((m) => m.role === "user")
  const queryPreview = lastUser ? donaMessageText(lastUser).slice(0, 120) : ""

  logBusiness("dona-captain", { result: "request", queryPreview })

  let envBlock = ""
  try {
    const env = getEnvInfo()
    envBlock = `\n\nRuntime DB: ${env.env.toUpperCase()} · endpoint ${env.dbHost} · branch ${env.branch}.${
      env.isProd ? "\n⚠ CAPITAINE! Tu es sur PROD — prudence absolue." : ""
    }`
  } catch (error) {
    console.error("[dona/chat-private] getEnvInfo", error)
    envBlock = ""
  }

  return runDonaStreamResponse({
    logPrefix: "dona-captain",
    locale,
    system: `${DONA_PRIVATE_SYSTEM_PROMPT}${envBlock}`,
    messages,
    tools: privateTools,
    maxSteps: 8,
    temperature: 0.7,
  })
}
