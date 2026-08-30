import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  generateText,
  stepCountIs,
  streamText,
  type ToolSet,
  type UIMessage,
  type UIMessageStreamWriter,
} from "ai"

import { logBusiness } from "@/lib/business-log"
import { formatDonaStreamError } from "@/lib/dona/dona-errors"
import { isDonaProviderError, resolveDonaModelAttempts } from "@/lib/dona/dona-model"
import {
  donaCaptainOfflineReply,
  donaPublicOfflineReply,
} from "@/lib/dona/dona-static-fallback"

export type RunDonaStreamOptions = {
  system: string
  messages: UIMessage[]
  temperature?: number
  tools?: ToolSet
  maxSteps?: number
  logPrefix: "dona-public" | "dona-captain"
}

type DonaStreamWriter = UIMessageStreamWriter<UIMessage>

function chunkText(text: string, size: number): string[] {
  const chunks: string[] = []
  for (let i = 0; i < text.length; i += size) {
    chunks.push(text.slice(i, i + size))
  }
  return chunks
}

function writeAssistantTextStream(writer: DonaStreamWriter, text: string, messageId: string) {
  writer.write({ type: "start", messageId })
  writer.write({ type: "start-step" })
  writer.write({ type: "text-start", id: messageId })
  for (const delta of chunkText(text, 28)) {
    writer.write({ type: "text-delta", id: messageId, delta })
  }
  writer.write({ type: "text-end", id: messageId })
  writer.write({ type: "finish-step" })
  writer.write({ type: "finish", finishReason: "stop" })
}

function writeOfflineFallback(
  writer: DonaStreamWriter,
  opts: RunDonaStreamOptions,
  mode: "public" | "captain"
) {
  const text =
    mode === "public"
      ? donaPublicOfflineReply(opts.messages)
      : donaCaptainOfflineReply(opts.messages)
  writeAssistantTextStream(writer, text, crypto.randomUUID())
  logBusiness(opts.logPrefix, { result: "offline_fallback", mode })
}

async function streamWithToolAttempts(
  writer: DonaStreamWriter,
  opts: RunDonaStreamOptions,
  modelMessages: Awaited<ReturnType<typeof convertToModelMessages>>,
  attempts: ReturnType<typeof resolveDonaModelAttempts>
): Promise<void> {
  let lastError: unknown = null

  for (const attempt of attempts) {
    try {
      const result = streamText({
        model: attempt.model,
        system: opts.system,
        messages: modelMessages,
        tools: opts.tools,
        stopWhen: opts.maxSteps ? stepCountIs(opts.maxSteps) : undefined,
        temperature: opts.temperature ?? 0.75,
        maxRetries: 1,
        onError: ({ error }) => {
          console.error(`[${opts.logPrefix}] streamText`, {
            provider: attempt.provider,
            model: attempt.modelId,
            error,
          })
        },
      })

      const reader = result.toUIMessageStream().getReader()
      let sawError = false

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        if (value && typeof value === "object" && "type" in value && value.type === "error") {
          sawError = true
          lastError = "errorText" in value ? value.errorText : value
          break
        }
        writer.write(value)
      }

      if (!sawError) {
        logBusiness(opts.logPrefix, {
          result: "ok",
          provider: attempt.provider,
          model: attempt.modelId,
          mode: "stream_tools",
        })
        return
      }

      if (!isDonaProviderError(lastError)) {
        writer.write({
          type: "error",
          errorText: formatDonaStreamError(lastError),
        })
        return
      }
    } catch (error) {
      lastError = error
      console.error(`[${opts.logPrefix}] tool_stream_attempt`, {
        provider: attempt.provider,
        model: attempt.modelId,
        error,
      })
      if (!isDonaProviderError(error)) throw error
    }
  }

  logBusiness(opts.logPrefix, {
    result: "all_attempts_failed",
    preview: formatDonaStreamError(lastError).slice(0, 120),
  })
  writeOfflineFallback(writer, opts, opts.logPrefix === "dona-captain" ? "captain" : "public")
}

async function streamPublicTextAttempts(
  writer: DonaStreamWriter,
  opts: RunDonaStreamOptions,
  modelMessages: Awaited<ReturnType<typeof convertToModelMessages>>,
  attempts: ReturnType<typeof resolveDonaModelAttempts>
): Promise<void> {
  let lastError: unknown = null

  for (const attempt of attempts) {
    try {
      const { text } = await generateText({
        model: attempt.model,
        system: opts.system,
        messages: modelMessages,
        temperature: opts.temperature ?? 0.75,
        maxRetries: 1,
      })

      const trimmed = text?.trim()
      if (!trimmed) throw new Error("empty_model_response")

      writeAssistantTextStream(writer, trimmed, crypto.randomUUID())
      logBusiness(opts.logPrefix, {
        result: "ok",
        provider: attempt.provider,
        model: attempt.modelId,
        mode: "generate_text",
      })
      return
    } catch (error) {
      lastError = error
      console.error(`[${opts.logPrefix}] text_attempt`, {
        provider: attempt.provider,
        model: attempt.modelId,
        error,
      })
      if (!isDonaProviderError(error)) throw error
    }
  }

  logBusiness(opts.logPrefix, {
    result: "all_attempts_failed",
    preview: formatDonaStreamError(lastError).slice(0, 120),
  })
  writeOfflineFallback(writer, opts, "public")
}

export async function runDonaStreamResponse(opts: RunDonaStreamOptions): Promise<Response> {
  const attempts = resolveDonaModelAttempts()
  if (attempts.length === 0) {
    return Response.json(
      {
        error: "dona_unavailable",
        message: formatDonaStreamError(new Error("missing_api_keys"), "fr"),
      },
      { status: 503 }
    )
  }

  let modelMessages: Awaited<ReturnType<typeof convertToModelMessages>>
  try {
    modelMessages = await convertToModelMessages(opts.messages)
  } catch (error) {
    const message = error instanceof Error ? error.message : "invalid_messages"
    console.error(`[${opts.logPrefix}] convertToModelMessages`, error)
    return Response.json({ error: message }, { status: 400 })
  }

  const stream = createUIMessageStream({
    originalMessages: opts.messages,
    execute: async ({ writer }) => {
      if (opts.tools) {
        await streamWithToolAttempts(writer, opts, modelMessages, attempts)
        return
      }
      await streamPublicTextAttempts(writer, opts, modelMessages, attempts)
    },
    onError: (error) => formatDonaStreamError(error),
  })

  return createUIMessageStreamResponse({ stream })
}
