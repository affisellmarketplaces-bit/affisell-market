"use client"

import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport } from "ai"
import { AnimatePresence, motion } from "framer-motion"
import { Send, X } from "lucide-react"
import { useLocale } from "next-intl"
import { usePathname } from "next/navigation"
import { useEffect, useMemo, useRef, useState } from "react"

import {
  DonaAssistantMessage,
  DonaTypingIndicator,
  DonaUserBubble,
  donaGenericError,
  donaMessageText,
  donaResolvedError,
  filterRenderableMessages,
  formatDonaTime,
} from "@/components/dona/dona-chat-ui"
import { DonaAvatarImage } from "@/components/dona/dona-avatar-image"
import {
  donaPublicBadge,
  donaPublicPlaceholder,
  donaPublicWelcome,
  resolveDonaPublicAudience,
} from "@/lib/dona/dona-audience"
import type { AppLocale } from "@/lib/i18n-locale"
import { tMessage } from "@/lib/i18n-pick-message"

function shouldHideWidget(pathname: string): boolean {
  return pathname.startsWith("/dashboard") || pathname.startsWith("/admin")
}

export function DonaPublicWidget() {
  const pathname = usePathname() ?? ""
  const locale = useLocale() as AppLocale
  const audience = useMemo(() => resolveDonaPublicAudience(pathname), [pathname])
  const [isOpen, setIsOpen] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [input, setInput] = useState("")

  const { messages, sendMessage, status, error, clearError } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/dona/chat-public",
      prepareSendMessagesRequest: ({ body, messages: msgs, id, trigger, messageId }) => ({
        body: {
          ...(typeof body === "object" && body !== null && !Array.isArray(body) ? body : {}),
          id,
          messages: msgs,
          trigger,
          messageId,
          audience,
          locale,
        },
      }),
    }),
    onError: (err) => {
      console.error("[dona-public-widget]", err)
    },
  })

  const busy = status === "submitted" || status === "streaming"
  const placeholder = useMemo(() => donaPublicPlaceholder(audience, locale), [audience, locale])
  const welcome = useMemo(() => donaPublicWelcome(audience, locale), [audience, locale])
  const badge = useMemo(() => donaPublicBadge(audience, locale), [audience, locale])
  const visibleMessages = useMemo(() => filterRenderableMessages(messages), [messages])
  const errorText = donaResolvedError(error, locale, donaGenericError(locale))

  const dialogLabel = tMessage(locale, "donaWidget.public.dialogLabel")
  const headerTitle = tMessage(locale, "donaWidget.public.headerTitle")
  const typingLabel = tMessage(locale, "donaWidget.public.typing")
  const sendAria = tMessage(locale, "donaWidget.public.sendAria")
  const closeAria = tMessage(locale, "donaWidget.public.closeAria")
  const openFabAria = tMessage(locale, "donaWidget.public.openFabAria")
  const trustFooter = tMessage(locale, "donaWidget.public.trustFooter")
  const localeBadge = tMessage(locale, "donaWidget.public.localeBadge")

  useEffect(() => {
    if (!isOpen) return
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" })
  }, [messages, status, isOpen, busy, error])

  if (shouldHideWidget(pathname)) {
    return null
  }

  async function sendText(text: string) {
    const trimmed = text.trim()
    if (!trimmed || busy) return
    setInput("")
    clearError()
    await sendMessage({ text: trimmed })
  }

  return (
    <>
      <AnimatePresence>
        {isOpen ? (
          <motion.div
            key="dona-panel"
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.96 }}
            transition={{ type: "spring", stiffness: 420, damping: 32 }}
            className="affisell-dona-panel-mobile fixed inset-0 z-[100] flex flex-col bg-[#0E0E2C]/95 backdrop-blur-md md:inset-auto md:bottom-24 md:right-6 md:h-[520px] md:w-[380px] md:rounded-2xl md:border md:border-violet-500/20 md:shadow-2xl"
            role="dialog"
            aria-label={dialogLabel}
          >
            <div className="flex shrink-0 items-center justify-between border-b border-white/10 bg-[#1A1A3D] px-4 py-3 md:rounded-t-2xl">
              <div className="flex min-w-0 items-center gap-2">
                <DonaAvatarImage
                  className="size-8 shrink-0 rounded-full object-cover ring-1 ring-violet-400/40"
                  alt="Dona"
                  loading="eager"
                />
                <div>
                  <p className="text-sm font-semibold text-white">{headerTitle}</p>
                  <span className="mt-0.5 inline-block rounded-full border border-violet-400/30 bg-violet-500/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-violet-200">
                    {badge} · {localeBadge}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-lg p-1.5 text-white/70 transition hover:bg-white/10 hover:text-white"
                aria-label={closeAria}
              >
                <X className="size-5" />
              </button>
            </div>

            <div ref={scrollRef} className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
              <div className="mr-auto max-w-[85%] rounded-2xl rounded-bl-sm border border-white/10 bg-[#1A1A3D] px-4 py-2.5 text-sm leading-relaxed text-white">
                <DonaAvatarImage
                  className="mb-2 size-7 rounded-full object-cover"
                  alt=""
                  loading="lazy"
                />
                {welcome}
                <span className="mt-1 block text-[10px] text-white/40">{formatDonaTime(new Date())}</span>
              </div>

              {visibleMessages.map((m) =>
                m.role === "user" ? (
                  <DonaUserBubble key={m.id} text={donaMessageText(m)} />
                ) : (
                  <DonaAssistantMessage key={m.id} message={m} />
                )
              )}

              {busy ? <DonaTypingIndicator label={typingLabel} /> : null}

              {error ? (
                <p className="mr-auto max-w-[85%] rounded-2xl border border-amber-500/30 bg-amber-950/40 px-4 py-2 text-xs text-amber-100">
                  {errorText}
                </p>
              ) : null}
            </div>

            <form
              className="shrink-0 border-t border-white/10 p-3"
              onSubmit={(e) => {
                e.preventDefault()
                void sendText(input)
              }}
            >
              <div className="flex gap-2">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={placeholder}
                  disabled={busy}
                  className="min-w-0 flex-1 rounded-full border border-white/10 bg-[#1A1A3D] px-4 py-3 text-sm text-white outline-none placeholder:text-white/40 focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/30"
                  aria-label={placeholder}
                />
                <button
                  type="submit"
                  disabled={busy || !input.trim()}
                  className="flex size-11 shrink-0 items-center justify-center rounded-full bg-[#7C3AED] text-white shadow-[0_0_16px_rgba(124,58,237,0.45)] transition hover:bg-violet-500 disabled:opacity-40"
                  aria-label={sendAria}
                >
                  <Send className="size-4" />
                </button>
              </div>
              <p className="mt-2 text-center text-[10px] text-white/40">{trustFooter}</p>
            </form>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {!isOpen ? (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="affisell-dona-fab fixed z-[99] flex size-14 items-center justify-center overflow-hidden rounded-full border-2 border-white bg-[#7C3AED] shadow-xl ring-2 ring-violet-200 transition hover:scale-105 hover:bg-violet-500 max-md:active:scale-95"
          aria-label={openFabAria}
        >
          <DonaAvatarImage
            className="size-full rounded-full object-cover"
            alt="Dona"
            loading="lazy"
          />
          <span
            className="absolute bottom-1 right-1 size-3 animate-pulse rounded-full border-2 border-white bg-green-400"
            aria-hidden
          />
        </button>
      ) : null}
    </>
  )
}
