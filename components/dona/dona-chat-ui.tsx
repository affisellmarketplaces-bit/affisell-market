"use client"

import type { UIMessage } from "ai"

import { DonaLinkifiedText } from "@/components/dona/dona-linkify-text"
import { DonaAvatarImage } from "@/components/dona/dona-avatar-image"
import {
  DonaProductToolsRail,
  isProductToolPart,
  type DonaProductToolPart,
} from "@/components/dona/dona-product-tools-rail"
import type { AppLocale } from "@/lib/i18n-locale"
import { tMessage } from "@/lib/i18n-pick-message"
import { resolveDonaChatError } from "@/lib/dona/dona-errors"
import {
  donaAssistantHasContent,
  donaMessageText,
} from "@/lib/dona/message-utils"

export { donaAssistantHasContent, donaMessageText }

export function formatDonaTime(date: Date): string {
  return date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
}

export function donaGenericError(locale: AppLocale): string {
  return tMessage(locale, "donaWidget.errors.genericPublic")
}

export function donaCaptainGenericError(locale: AppLocale): string {
  return tMessage(locale, "donaWidget.errors.genericCaptain")
}

export function donaResolvedError(
  error: Error | undefined,
  locale: AppLocale,
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
      <DonaAvatarImage className="mb-2 size-7 rounded-full object-cover" alt="" loading="lazy" />
      <DonaLinkifiedText text={text} />
      <span className="mt-1 block text-[10px] text-white/40">{formatDonaTime(new Date())}</span>
    </div>
  )
}

export function DonaAssistantMessage({ message }: { message: UIMessage }) {
  const text = donaMessageText(message)
  const hasText = text.trim().length > 0
  const toolParts = message.parts.filter(isProductToolPart) as DonaProductToolPart[]

  return (
    <div className="mr-auto max-w-[85%] rounded-2xl rounded-bl-sm border border-white/10 bg-[#1A1A3D] px-4 py-2.5 text-sm leading-relaxed text-white">
      <DonaAvatarImage className="mb-2 size-7 rounded-full object-cover" alt="" loading="lazy" />
      {hasText ? <DonaLinkifiedText text={text} /> : null}
      {toolParts.length > 0 ? <DonaProductToolsRail parts={toolParts} /> : null}
      <span className="mt-1 block text-[10px] text-white/40">{formatDonaTime(new Date())}</span>
    </div>
  )
}

export function filterRenderableMessages(messages: UIMessage[]): UIMessage[] {
  return messages.filter(donaAssistantHasContent)
}
