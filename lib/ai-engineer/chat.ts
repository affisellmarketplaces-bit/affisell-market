import { groqChatText } from "@/lib/ai/groq-client"
import { AFFISELL_CONTEXT } from "@/lib/ai-engineer/context"
import { collectDevLogLines, filterRelevantLogLines } from "@/lib/ai-engineer/log-sources"
import { LogObserver } from "@/lib/ai-engineer/observer"
import type { IngChatPlan } from "@/lib/ai-engineer/types"

export async function ingChatPlan(message: string): Promise<IngChatPlan> {
  const observer = new LogObserver()
  const { tasks } = await observer.analyzeLastLogs(50)
  const logLines = filterRelevantLogLines(collectDevLogLines(50)).slice(-50)

  const system = `${AFFISELL_CONTEXT}

Tu es Affisell Ing, senior humanoid engineer. Réponds en français, concis, actionnable.
Retourne JSON strict:
{
  "summary": "1 phrase",
  "reply": "réponse au fondateur",
  "suggestedActions": ["étape 1", "étape 2"]
}`

  const user = `Message fondateur: ${message}

Tasks détectées par LogObserver:
${JSON.stringify(tasks, null, 2)}

Derniers logs (${logLines.length} lignes):
${logLines.join("\n") || "(aucun log pertinent dans .affisell/ing-dev.log)"}`

  let reply = "Ing observe — connecte Shopify/Woo pour réduire manual_required."
  let summary = "Analyse logs + contexte Affisell"

  const llm = await groqChatText({
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    temperature: 0.2,
    max_tokens: 800,
    response_format: { type: "json_object" },
  })

  if (llm) {
    try {
      const parsed = JSON.parse(llm) as {
        summary?: string
        reply?: string
        suggestedActions?: string[]
      }
      if (parsed.summary) summary = parsed.summary
      if (parsed.reply) reply = parsed.reply
      if (parsed.suggestedActions?.length) {
        reply += `\n\nPlan:\n${parsed.suggestedActions.map((s, i) => `${i + 1}. ${s}`).join("\n")}`
      }
    } catch (error) {
      console.warn("[ing]", {
        stage: "chat_parse",
        error: error instanceof Error ? error.message : String(error),
      })
      reply = llm
    }
  }

  const actions = tasks
    .filter((t) => t.autoFixable)
    .map((t) => ({
      file: t.id === "prisma_engine_empty" ? "lib/ensure-database-url-unpooled.ts" : "—",
      change: `auto-fix ${t.id}`,
      reason: t.description,
      test: "npm run ing analyze",
    }))

  console.log("[ing]", { result: "chat", message: message.slice(0, 80), tasks: tasks.length })

  return { summary, tasks, actions, reply }
}
