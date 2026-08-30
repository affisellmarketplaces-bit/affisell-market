import {
  convertToModelMessages,
  stepCountIs,
  streamText,
  type ToolSet,
  type UIMessage,
} from "ai"

import { logBusiness } from "@/lib/business-log"
import { formatDonaStreamError } from "@/lib/dona/dona-errors"
import { isDonaProviderError, resolveDonaModels, type DonaModelProvider } from "@/lib/dona/dona-model"

export type RunDonaStreamOptions = {
  system: string
  messages: UIMessage[]
  temperature?: number
  tools?: ToolSet
  maxSteps?: number
  logPrefix: "dona-public" | "dona-captain"
}

function streamWithModel(
  model: Parameters<typeof streamText>[0]["model"],
  provider: DonaModelProvider,
  opts: RunDonaStreamOptions,
  modelMessages: Awaited<ReturnType<typeof convertToModelMessages>>
) {
  return streamText({
    model,
    system: opts.system,
    messages: modelMessages,
    tools: opts.tools,
    stopWhen: opts.maxSteps ? stepCountIs(opts.maxSteps) : undefined,
    temperature: opts.temperature ?? 0.75,
    maxRetries: 2,
    onError: ({ error }) => {
      console.error(`[${opts.logPrefix}] streamText`, { provider, error })
    },
  })
}

export async function runDonaStreamResponse(opts: RunDonaStreamOptions): Promise<Response> {
  const bundle = resolveDonaModels()
  if (!bundle) {
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

  const streamOpts = {
    onError: (error: unknown) => {
      const friendly = formatDonaStreamError(error)
      logBusiness(opts.logPrefix, { result: "stream_error", preview: friendly.slice(0, 120) })
      return friendly
    },
  }

  try {
    const primary = streamWithModel(
      bundle.primary,
      bundle.primaryProvider,
      opts,
      modelMessages
    )
    return primary.toUIMessageStreamResponse(streamOpts)
  } catch (primaryError) {
    if (!bundle.fallback || !isDonaProviderError(primaryError)) {
      throw primaryError
    }
    console.error(`[${opts.logPrefix}] primary_failed`, {
      provider: bundle.primaryProvider,
      error: primaryError,
    })
    logBusiness(opts.logPrefix, {
      result: "fallback",
      from: bundle.primaryProvider,
      to: bundle.fallbackProvider,
    })
    const fallback = streamWithModel(
      bundle.fallback,
      bundle.fallbackProvider!,
      opts,
      modelMessages
    )
    return fallback.toUIMessageStreamResponse(streamOpts)
  }
}
