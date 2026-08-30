"use client"

import type { UIMessage } from "ai"

import { DonaLinkifiedText } from "@/components/dona/dona-linkify-text"
import {
  DonaToolSearchProductsPart,
  type DonaSearchProductsToolPart,
} from "@/components/dona/dona-tool-search-products"
import { resolveDonaChatError } from "@/lib/dona/dona-errors"
import {
  donaAssistantHasContent,
  donaMessageText,
} from "@/lib/dona/message-utils"

export { donaAssistantHasContent, donaMessageText }

export function formatDonaTime(date: Date): string {
  return date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
}

export function resolvePublicLocale(): "fr" | "en" {
  if (typeof navigator === "undefined") return "fr"
  return navigator.language.toLowerCase().startsWith("fr") ? "fr" : "en"
}

export function donaGenericError(locale: "fr" | "en"): string {
  return locale === "fr"
    ? "Dona: le réacteur tousse. Réessaie — ou va voir /sell comme un adulte responsable. 💜"
    : "Dona: reactor hiccup. Retry — or hit /sell like a responsible adult. 💜"
}

export function donaCaptainGenericError(locale: "fr" | "en"): string {
  return locale === "fr"
    ? "Dona Capitaine: accès refusé ou réacteur froid. Reste sur /dashboard/supplier. 💜"
    : "Dona Captain: access denied or cold reactor. Stay on /dashboard/supplier. 💜"
}

export function donaResolvedError(
  error: Error | undefined,
  locale: "fr" | "en",
  fallback: string
): string {
  return resolveDonaChatError(error, locale, fallback)
}

export function DonaTypingIndicator({ label }: { label: string }) {
  return (
    <div className="mr-auto flex items-center gap-1.5 text-xs text-white/50">
      <span className="inline-flex gap-1">
        <span className="size-1.5 animate-bounce rounded-full bg-violet-400 [animation-delay:0ms]" />
        <span className="size-1.5 animate-bounce rounded-full bg-violet-400 [animation-delay:150ms]" />
        <span className="size-1.5 animate-bounce rounded-full bg-violet-400 [animation-delay:300ms]" />
      </span>
      {label}
    </div>
  )
}

export function DonaUserBubble({ text }: { text: string }) {
  return (
    <div className="ml-auto max-w-[85%] rounded-2xl rounded-br-sm bg-[#7C3AED] px-4 py-2.5 text-sm leading-relaxed text-white">
      {text}
      <span className="mt-1 block text-[10px] text-white/40">{formatDonaTime(new Date())}</span>
    </div>
  )
}

export function DonaAssistantBubble({ text }: { text: string }) {
  return (
    <div className="mr-auto max-w-[85%] rounded-2xl rounded-bl-sm border border-white/10 bg-[#1A1A3D] px-4 py-2.5 text-sm leading-relaxed text-white">
      <span className="mb-1 block text-base" aria-hidden>
        💜
      </span>
      <DonaLinkifiedText text={text} />
      <span className="mt-1 block text-[10px] text-white/40">{formatDonaTime(new Date())}</span>
    </div>
  )
}

export function DonaAssistantMessage({ message }: { message: UIMessage }) {
  const text = donaMessageText(message)
  const hasText = text.trim().length > 0
  const toolParts = message.parts.filter((p) => p.type === "tool-searchProducts")

  return (
    <div className="mr-auto max-w-[85%] rounded-2xl rounded-bl-sm border border-white/10 bg-[#1A1A3D] px-4 py-2.5 text-sm leading-relaxed text-white">
      <span className="mb-1 block text-base" aria-hidden>
        💜
      </span>
      {hasText ? <DonaLinkifiedText text={text} /> : null}
      {toolParts.map((part, idx) => {
        if (part.type !== "tool-searchProducts") return null
        return (
          <DonaToolSearchProductsPart
            key={`tool-${"toolCallId" in part && typeof part.toolCallId === "string" ? part.toolCallId : idx}`}
            part={part as DonaSearchProductsToolPart}
          />
        )
      })}
      <span className="mt-1 block text-[10px] text-white/40">{formatDonaTime(new Date())}</span>
    </div>
  )
}

export function filterRenderableMessages(messages: UIMessage[]): UIMessage[] {
  return messages.filter(donaAssistantHasContent)
}
