import type Groq from "groq-sdk"

import { geminiChatText, hasGeminiApiKey } from "@/lib/ai/gemini-client"

export type RoutedLlmResult = {
  text: string | null
  provider: "gemini" | "groq"
}

type RouteLlmTextOptions = {
  messages: Groq.Chat.Completions.ChatCompletionMessageParam[]
  runGroq: () => Promise<string | null>
}

function contentToText(content: Groq.Chat.Completions.ChatCompletionMessageParam["content"]): string {
  if (typeof content === "string") return content
  if (!Array.isArray(content)) return ""

  return content
    .map((part) => {
      if (part.type === "text") return part.text
      if (part.type === "image_url") return "[image]"
      return ""
    })
    .filter(Boolean)
    .join("\n")
    .trim()
}

function extractSystem(
  messages: Groq.Chat.Completions.ChatCompletionMessageParam[]
): string | undefined {
  const system = messages.find((message) => message.role === "system")
  const text = system ? contentToText(system.content) : ""
  return text || undefined
}

function extractPrompt(messages: Groq.Chat.Completions.ChatCompletionMessageParam[]): string {
  return messages
    .filter((message) => message.role !== "system")
    .map((message) => {
      const text = contentToText(message.content)
      return text ? `${message.role}: ${text}` : ""
    })
    .filter(Boolean)
    .join("\n\n")
    .trim()
}

export async function routeLlmText(options: RouteLlmTextOptions): Promise<RoutedLlmResult> {
  const prompt = extractPrompt(options.messages)
  const system = extractSystem(options.messages)

  if (hasGeminiApiKey() && prompt) {
    try {
      const text = await geminiChatText(prompt, system)
      return { text, provider: "gemini" }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.log("[llm-router]", {
        event: "gemini_fallback_groq",
        message: message.slice(0, 200),
      })
    }
  }

  return { text: await options.runGroq(), provider: "groq" }
}
