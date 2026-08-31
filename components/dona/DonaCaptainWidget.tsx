"use client"

import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport, type UIMessage } from "ai"
import { AnimatePresence, motion } from "framer-motion"
import { Send, X } from "lucide-react"
import { usePathname } from "next/navigation"
import { useEffect, useMemo, useRef, useState } from "react"

import { useAppLocale } from "@/hooks/use-app-locale"

import {
  donaCaptainGenericError,
  donaMessageText,
  donaResolvedError,
  DonaTypingIndicator,
} from "@/components/dona/dona-chat-ui"
import { DonaAvatarImage } from "@/components/dona/dona-avatar-image"
import { tMessage } from "@/lib/i18n-pick-message"

type CaptainMeta = {
  env: string
  branch: string
  dbHost: string
  isProd: boolean
  label: string
}

function shouldShowCaptain(pathname: string): boolean {
  return pathname.startsWith("/dashboard/supplier") || pathname.startsWith("/radar")
}

function toolNameFromPartType(type: string): string {
  return type.replace(/^tool-/, "")
}

function formatToolOutput(output: unknown): string {
  if (output == null) return ""
  if (typeof output === "object" && output !== null && "error" in output) {
    return String((output as { error: string }).error)
  }
  try {
    return JSON.stringify(output, null, 2)
  } catch {
    return String(output)
  }
}

type ToolPart = {
  type: string
  toolCallId?: string
  state?: string
  output?: unknown
}

function isToolPart(part: { type: string }): part is ToolPart {
  return part.type.startsWith("tool-")
}

function assistantHasVisibleParts(m: UIMessage): boolean {
  if (m.role !== "assistant") return true
  return m.parts.some(
    (p) =>
      (p.type === "text" && "text" in p && Boolean((p as { text: string }).text?.trim())) ||
      isToolPart(p)
  )
}

export function DonaCaptainWidget() {
  const pathname = usePathname() ?? ""
  const locale = useAppLocale()
  const [isOpen, setIsOpen] = useState(false)
  const [meta, setMeta] = useState<CaptainMeta | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [input, setInput] = useState("")

  const { messages, sendMessage, status, error, clearError } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/dona/chat-private",
      prepareSendMessagesRequest: ({ body, messages: msgs, id, trigger, messageId }) => ({
        body: {
          ...(typeof body === "object" && body !== null && !Array.isArray(body) ? body : {}),
          id,
          messages: msgs,
          trigger,
          messageId,
          locale,
        },
      }),
    }),
    onError: (err) => {
      console.error("[dona-captain-widget]", err)
    },
  })

  const busy = status === "submitted" || status === "streaming"
  const visible = shouldShowCaptain(pathname)
  const errorText = donaResolvedError(error, locale, donaCaptainGenericError(locale))

  const welcome = useMemo(() => tMessage(locale, "donaWidget.captain.welcome"), [locale])
  const dialogLabel = tMessage(locale, "donaWidget.captain.dialogLabel")
  const headerTitle = tMessage(locale, "donaWidget.captain.headerTitle")
  const captainBadge = tMessage(locale, "donaWidget.captain.captainBadge")
  const typingLabel = tMessage(locale, "donaWidget.captain.typing")
  const placeholder = tMessage(locale, "donaWidget.captain.placeholder")
  const sendAria = tMessage(locale, "donaWidget.captain.sendAria")
  const closeAria = tMessage(locale, "donaWidget.captain.closeAria")
  const openFabAria = tMessage(locale, "donaWidget.captain.openFabAria")
  const fabBadge = tMessage(locale, "donaWidget.captain.fabBadge")
  const trustFooter = tMessage(locale, "donaWidget.captain.trustFooter")

  const renderableMessages = useMemo(
    () => messages.filter(assistantHasVisibleParts),
    [messages]
  )

  useEffect(() => {
    if (!visible || !isOpen) return
    void fetch("/api/dona/captain-meta", { credentials: "same-origin" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: CaptainMeta | null) => {
        if (data) setMeta(data)
      })
      .catch((e) => {
        console.warn("[dona-captain-widget] captain-meta", e instanceof Error ? e.message : String(e))
      })
  }, [visible, isOpen])

  useEffect(() => {
    if (!isOpen) return
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" })
  }, [messages, status, isOpen, busy, error])

  if (!visible) return null

  async function sendText(text: string) {
    const trimmed = text.trim()
    if (!trimmed || busy) return
    setInput("")
    clearError()
    await sendMessage({ text: trimmed })
  }

  const envLabel = meta?.label ?? "STAGING"
  const envHost = meta?.dbHost ?? "…"
  const captainEnvBadge = tMessage(locale, "donaWidget.captain.captainEnvBadge").replace(
    "{env}",
    envLabel
  )

  return (
    <>
      <AnimatePresence>
        {isOpen ? (
          <motion.div
            key="dona-captain-panel"
            initial={{ opacity: 0, y: 28, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 28, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 400, damping: 34 }}
            className="affisell-dona-panel-mobile fixed inset-0 z-[110] flex flex-col border-2 border-violet-500/60 bg-[#0E0E2C]/98 backdrop-blur-md md:inset-auto md:bottom-24 md:right-6 md:h-[600px] md:w-[420px] md:rounded-2xl md:shadow-2xl"
            role="dialog"
            aria-label={dialogLabel}
          >
            <div className="flex shrink-0 items-start justify-between border-b border-violet-500/30 bg-[#1A1A3D] px-4 py-3 md:rounded-t-2xl">
              <div className="flex min-w-0 items-start gap-2.5">
                <DonaAvatarImage
                  className="mt-0.5 h-[3.75rem] w-[2.65rem] shrink-0 rounded-xl object-cover object-top ring-2 ring-violet-400/50 shadow-[0_0_14px_rgba(124,58,237,0.3)]"
                  alt="Captain Dona"
                  loading="eager"
                  variant="portrait"
                />
                <div>
                  <p className="text-sm font-semibold text-white">{headerTitle}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <span className="rounded-full border border-emerald-400/50 bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-200">
                      {captainBadge}
                    </span>
                    <span className="rounded-full border border-violet-400/40 bg-violet-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-200">
                      {captainEnvBadge}
                    </span>
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${
                        meta?.isProd
                          ? "border-red-400/50 bg-red-500/15 text-red-200"
                          : "border-emerald-400/40 bg-emerald-500/10 text-emerald-200"
                      }`}
                    >
                      {envHost}
                    </span>
                  </div>
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
              <div className="mr-auto max-w-[90%] rounded-2xl rounded-bl-sm border border-white/10 bg-[#1A1A3D] px-4 py-2.5 text-sm text-white">
                <DonaAvatarImage
                  className="mb-2 h-11 w-8 rounded-lg object-cover object-top ring-1 ring-violet-400/40"
                  alt=""
                  loading="lazy"
                  variant="portrait"
                />
                {welcome}
              </div>

              {renderableMessages.map((m) => (
                <div key={m.id} className="space-y-2">
                  {m.role === "assistant" ? (
                    <>
                      {m.parts.map((part, idx) => {
                        if (isToolPart(part)) {
                          const tp = part as ToolPart
                          const name = toolNameFromPartType(tp.type)
                          const hasOutput =
                            tp.state === "output-available" || tp.output !== undefined
                          return (
                            <div
                              key={`${m.id}-tool-${idx}`}
                              className="mr-auto max-w-[95%] rounded-xl border border-violet-500/25 bg-violet-950/30 px-3 py-2 text-xs text-violet-100"
                            >
                              <p className="font-medium">
                                {tMessage(locale, "donaWidget.captain.toolConsult").replace(
                                  "{name}",
                                  name + (!hasOutput ? "…" : "")
                                )}
                              </p>
                              {hasOutput ? (
                                <pre className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap break-words text-[10px] text-white/80">
                                  {formatToolOutput(tp.output)}
                                </pre>
                              ) : null}
                            </div>
                          )
                        }
                        if (part.type === "text" && "text" in part && part.text?.trim()) {
                          return (
                            <div
                              key={`${m.id}-t-${idx}`}
                              className="mr-auto max-w-[90%] rounded-2xl rounded-bl-sm border border-white/10 bg-[#1A1A3D] px-4 py-2.5 text-sm text-white"
                            >
                              <DonaAvatarImage
                                className="mb-2 size-7 rounded-full object-cover object-top ring-1 ring-violet-400/30"
                                alt=""
                                loading="lazy"
                                variant="circle"
                              />
                              {part.text}
                            </div>
                          )
                        }
                        return null
                      })}
                    </>
                  ) : (
                    <div className="ml-auto max-w-[90%] rounded-2xl rounded-br-sm bg-[#7C3AED] px-4 py-2.5 text-sm text-white">
                      {donaMessageText(m)}
                    </div>
                  )}
                </div>
              ))}

              {busy ? <DonaTypingIndicator label={typingLabel} /> : null}

              {error ? (
                <p className="mr-auto max-w-[90%] rounded-xl border border-red-500/30 bg-red-950/40 px-3 py-2 text-xs text-red-100">
                  {errorText}
                </p>
              ) : null}
            </div>

            <form
              className="shrink-0 border-t border-violet-500/20 p-3"
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
                  className="min-w-0 flex-1 rounded-full border border-white/10 bg-[#1A1A3D] px-4 py-3 text-sm text-white outline-none placeholder:text-white/40 focus:border-violet-500/50"
                />
                <button
                  type="submit"
                  disabled={busy || !input.trim()}
                  className="flex size-11 shrink-0 items-center justify-center rounded-full bg-[#7C3AED] text-white disabled:opacity-40"
                  aria-label={sendAria}
                >
                  <Send className="size-4" />
                </button>
              </div>
              <p className="mt-2 text-center text-[10px] text-white/35">{trustFooter}</p>
            </form>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {!isOpen ? (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="affisell-dona-fab affisell-dona-fab-portrait fixed z-[109] flex h-[4.75rem] w-[3.35rem] items-stretch justify-center overflow-hidden rounded-2xl border-2 border-violet-400/70 bg-[#0E0E2C] shadow-[0_0_22px_rgba(124,58,237,0.45)] transition hover:border-violet-300 max-md:active:scale-95"
          aria-label={openFabAria}
        >
          <DonaAvatarImage
            className="size-full object-cover object-top"
            alt="Captain Dona"
            loading="lazy"
            variant="portrait"
          />
          <span className="absolute -right-1 -top-1 rounded-full bg-black px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide text-white">
            {fabBadge}
          </span>
          <span
            className="absolute bottom-1 right-1 size-3 animate-pulse rounded-full border-2 border-white bg-green-400"
            aria-hidden
          />
        </button>
      ) : null}
    </>
  )
}
