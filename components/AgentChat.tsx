"use client"

import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport } from "ai"
import { motion } from "framer-motion"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { useCallback, useEffect, useRef, useState } from "react"

import {
  AgentToolSearchProductsPart,
  type SearchProductsToolPart,
} from "@/components/agent-tool-search-products"
import type { AgentHistoryApiResponse } from "@/lib/agent-history"
import type { AgentSearchToolResult } from "@/lib/agent-product-card-types"
import { getOrCreateAgentSessionId } from "@/lib/agent-session"
import type { UIMessage } from "ai"

type WebkitSpeechRecognitionCtor = new () => {
  lang: string
  interimResults: boolean
  maxAlternatives: number
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null
  onerror: ((event: unknown) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
}

function messageText(m: UIMessage): string {
  return m.parts
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join("")
}

function assistantHasRenderableContent(m: UIMessage): boolean {
  if (m.role !== "assistant") return false
  const text = messageText(m).trim()
  if (text.length > 0) return true
  return m.parts.some((p) => p.type === "tool-searchProducts")
}

function parseCheckoutFromText(text: string): { cleanedText: string; checkoutUrl: string | null } {
  const m = text.match(/<checkoutUrl>(.*?)<\/checkoutUrl>/i)
  if (!m?.[1]) return { cleanedText: text, checkoutUrl: null }
  return {
    cleanedText: text.replace(m[0], "").trim(),
    checkoutUrl: m[1].trim() || null,
  }
}

export function AgentChat() {
  const searchParams = useSearchParams()
  const scrollRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [input, setInput] = useState("")
  const [lastQuery, setLastQuery] = useState<string | null>(null)
  const [visionBusy, setVisionBusy] = useState(false)
  const [visionPreview, setVisionPreview] = useState<string | null>(null)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [visionError, setVisionError] = useState<string | null>(null)
  const [listening, setListening] = useState(false)
  const prefillDone = useRef(false)
  const recognitionRef = useRef<{
    stop: () => void
  } | null>(null)

  const loadHistory = useCallback(async () => {
    getOrCreateAgentSessionId()
    const sid = getOrCreateAgentSessionId()
    const url =
      sid.length >= 8
        ? `/api/agent/history?sessionId=${encodeURIComponent(sid)}`
        : "/api/agent/history"
    try {
      const res = await fetch(url, { credentials: "include" })
      if (!res.ok) return
      const data = (await res.json()) as AgentHistoryApiResponse
      setLastQuery(data.lastQuery)
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async history hydrate on mount
    void loadHistory()
  }, [loadHistory])

  useEffect(() => {
    if (prefillDone.current || !lastQuery?.trim()) return
    setInput((cur) => {
      if (cur.trim() !== "") {
        prefillDone.current = true
        return cur
      }
      prefillDone.current = true
      return lastQuery
    })
  }, [lastQuery])

  const { messages, setMessages, sendMessage, status, error, stop, clearError } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/agent",
      prepareSendMessagesRequest: ({ body, messages: msgs, id, trigger, messageId }) => ({
        body: {
          ...(typeof body === "object" && body !== null && !Array.isArray(body) ? body : {}),
          id,
          messages: msgs,
          trigger,
          messageId,
          sessionId: getOrCreateAgentSessionId(),
        },
      }),
    }),
    onFinish: () => {
      void loadHistory()
    },
  })

  const busy = status === "submitted" || status === "streaming"
  const paymentSuccess = searchParams.get("success") === "true"

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" })
  }, [messages, status])

  async function sendFromInput() {
    if (imageFile) {
      if (busy || visionBusy) return
      setVisionBusy(true)
      setVisionError(null)
      clearError()
      try {
        const formData = new FormData()
        formData.append("image", imageFile)
        const res = await fetch("/api/agent/vision", { method: "POST", body: formData })
        const data = (await res.json()) as (AgentSearchToolResult & { keywords?: string; error?: string })
        console.log("[agent/vision] response", data)
        if (!res.ok || !Array.isArray(data.products)) {
          setVisionError(data.error ?? "Analyse visuelle indisponible.")
          return
        }
        const output: string[] = []
        for (const p of data.products) {
          output.push(
            JSON.stringify({
              g: 0,
              id: p.id,
              name: p.name,
              price: p.price,
              imageUrl: p.imageUrl,
              brand: p.brand,
              description: p.description,
            })
          )
        }
        for (const p of data.similarProducts ?? []) {
          output.push(
            JSON.stringify({
              g: 1,
              id: p.id,
              name: p.name,
              price: p.price,
              imageUrl: p.imageUrl,
              brand: p.brand,
              description: p.description,
            })
          )
        }
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            parts: [
              {
                type: "text",
                text: `Analyse de l'image: ${data.keywords?.trim() || "mots-clés détectés"}`,
              },
              {
                type: "tool-searchProducts",
                state: "output-available",
                toolCallId: crypto.randomUUID(),
                output,
              },
            ],
          } as UIMessage,
        ])
        setVisionPreview(null)
        setImageFile(null)
      } catch (e) {
        console.error("[agent/vision] client failed", e)
        setVisionError("Analyse visuelle indisponible.")
      } finally {
        setVisionBusy(false)
      }
      return
    }

    const text = input.trim()
    if (!text || busy) return
    setInput("")
    clearError()
    await sendMessage({ text })
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    await sendFromInput()
  }

  function startVoiceInput() {
    if (busy || visionBusy || listening) return
    const Ctor = (
      window as unknown as { webkitSpeechRecognition?: WebkitSpeechRecognitionCtor }
    ).webkitSpeechRecognition
    if (!Ctor) {
      setVisionError("Reconnaissance vocale non supportée sur ce navigateur.")
      return
    }
    const recognition = new Ctor()
    recognition.lang = "fr-FR"
    recognition.interimResults = false
    recognition.maxAlternatives = 1
    recognition.onresult = (event) => {
      const transcript = event.results?.[0]?.[0]?.transcript?.trim() || ""
      if (!transcript) return
      setInput(transcript)
      clearError()
      void sendMessage({ text: transcript })
    }
    recognition.onerror = () => {
      setVisionError("La reconnaissance vocale a échoué.")
    }
    recognition.onend = () => {
      setListening(false)
      recognitionRef.current = null
    }
    recognitionRef.current = recognition
    setListening(true)
    recognition.start()
  }

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop()
    }
  }, [])

  async function onPickImage(file: File) {
    if (!/^image\/(jpeg|png|webp)$/i.test(file.type)) {
      setVisionError("Format invalide. Utilisez JPG, PNG ou WEBP.")
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setVisionError("Image trop lourde (max 5MB).")
      return
    }

    const base64 = await new Promise<string>((resolve, reject) => {
      const r = new FileReader()
      r.onload = () => resolve(typeof r.result === "string" ? r.result : "")
      r.onerror = () => reject(new Error("read-failed"))
      r.readAsDataURL(file)
    })

    if (!base64) return
    setVisionPreview(base64)
    setImageFile(file)
    setVisionError(null)
  }

  return (
    <div className="mx-auto w-full">
      <div className="relative h-[72vh] w-full overflow-hidden rounded-[2.5rem] border border-white/10 shadow-2xl">
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-[#0A0A0B]" />
          <div
            className="absolute -right-40 -top-40 h-96 w-96 animate-pulse rounded-full bg-violet-600/30 blur-3xl"
            style={{ animationDuration: "4s" }}
          />
          <div
            className="absolute -bottom-40 -left-40 h-96 w-96 animate-pulse rounded-full bg-pink-600/30 blur-3xl"
            style={{ animationDuration: "6s" }}
          />
          <div
            className="absolute left-1/2 top-1/2 h-[28rem] w-[28rem] -translate-x-1/2 -translate-y-1/2 animate-pulse rounded-full bg-blue-600/20 blur-3xl"
            style={{ animationDuration: "8s" }}
          />
          <div
            className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage:
                'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noiseFilter\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noiseFilter)\'/%3E%3C/svg%3E")',
            }}
          />
        </div>
        <div className="relative z-10 flex h-full flex-col bg-black/40 backdrop-blur-3xl">
          {paymentSuccess ? (
            <div className="m-4 rounded-xl border border-emerald-400/40 bg-emerald-900/30 px-3 py-2 text-sm font-medium text-emerald-200">
              ✅ Commande confirmée!
            </div>
          ) : null}
          <div
            ref={scrollRef}
            className="flex min-h-[420px] flex-1 flex-col gap-3 overflow-y-auto p-4 md:p-6"
          >
            {messages.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center p-12 text-center">
                <div className="mb-6 flex h-20 w-20 animate-pulse items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-pink-500">
                  <span className="text-3xl">✨</span>
                </div>
                <h3 className="mb-2 text-2xl font-semibold text-white">Que cherchez-vous aujourd&apos;hui?</h3>
                <p className="mb-8 text-zinc-400">Photo, voix ou texte — je trouve tout</p>
                <div className="grid w-full max-w-md grid-cols-2 gap-3">
                  {["👟 Nike Air Max < 100€", "👜 Sac cuir tendance", "⌚ Montre minimaliste", "👕 T-shirt oversize"].map(
                    (q) => (
                      <button
                        key={q}
                        type="button"
                        onClick={() => setInput(q)}
                        className="rounded-2xl border border-white/10 bg-white/5 p-4 text-left text-sm text-white backdrop-blur-md transition-all hover:scale-105 hover:border-violet-500/50 hover:bg-white/10"
                      >
                        {q}
                      </button>
                    )
                  )}
                </div>
              </div>
            ) : null}

            {busy && messages.length > 0 && messages[messages.length - 1]?.role === "user" ? (
              <div className="flex justify-start">
                <div className="max-w-[90%] rounded-2xl rounded-bl-sm bg-white/10 px-4 py-3 text-sm text-zinc-100 backdrop-blur-md">
                  <span className="inline-flex items-center gap-2">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-violet-400" />
                    Recherche en cours…
                  </span>
                </div>
              </div>
            ) : null}

            {messages.map((m) => {
              const isUser = m.role === "user"
              const text = messageText(m)

              if (isUser) {
                if (!text.trim()) return null
                return (
                  <motion.div
                    key={m.id}
                    className="ml-auto max-w-[80%] rounded-2xl rounded-br-sm bg-violet-600 px-4 py-3 text-sm text-white"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                      <p className="whitespace-pre-wrap break-words">{text}</p>
                  </motion.div>
                )
              }

              if (!assistantHasRenderableContent(m)) return null

              return (
                <motion.div
                  key={m.id}
                  className="mr-auto w-full max-w-[92%] rounded-2xl rounded-bl-sm bg-white/10 px-4 py-3 text-sm leading-relaxed text-zinc-100 backdrop-blur-md"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                    {m.parts.map((part, idx) => {
                      if (part.type === "text" && "text" in part && part.text?.trim()) {
                        const { cleanedText, checkoutUrl } = parseCheckoutFromText(part.text)
                        return (
                          <div key={`${m.id}-t-${idx}`} className="space-y-2">
                            <p className="whitespace-pre-wrap break-words">{cleanedText}</p>
                            {checkoutUrl ? (
                              <Link
                                href={checkoutUrl}
                                className="inline-flex items-center rounded-xl bg-emerald-600 px-5 py-3 text-base font-bold text-white shadow-lg shadow-emerald-900/30 hover:bg-emerald-500"
                              >
                                Payer maintenant →
                              </Link>
                            ) : null}
                          </div>
                        )
                      }
                      if (part.type === "tool-searchProducts") {
                        const toolPart = part as unknown as SearchProductsToolPart
                        return (
                          <AgentToolSearchProductsPart
                            key={`${m.id}-${toolPart.toolCallId ?? idx}`}
                            part={toolPart}
                          />
                        )
                      }
                      return null
                    })}
                </motion.div>
              )
            })}
          </div>

          {error ? (
            <div
              role="alert"
            className="mx-4 mb-3 rounded-xl border border-red-500/40 bg-red-950/50 px-3 py-2 text-sm text-red-200"
            >
              {error.message}
              <button
                type="button"
                onClick={() => clearError()}
                className="ml-3 underline hover:text-white"
              >
                Fermer
              </button>
            </div>
          ) : null}

          <form onSubmit={onSubmit} className="border-t border-white/5 bg-black/35 p-4">
            {visionPreview ? (
              <div className="mb-1 inline-flex w-fit items-center gap-2 rounded-lg border border-white/10 bg-white/5 p-1.5 backdrop-blur-md">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={visionPreview} alt="" className="h-10 w-10 rounded object-cover" />
                <button
                  type="button"
                  onClick={() => {
                    setVisionPreview(null)
                    setImageFile(null)
                    setVisionError(null)
                  }}
                  className="text-xs text-zinc-300 underline"
                >
                  Retirer
                </button>
              </div>
            ) : null}
            <label className="sr-only" htmlFor="agent-input">
              Message
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) void onPickImage(file)
                e.currentTarget.value = ""
              }}
            />
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={busy || visionBusy || listening}
                className="h-12 w-12 rounded-2xl bg-white/10 text-lg text-zinc-200 transition hover:bg-white/20 disabled:opacity-50"
                aria-label="Recherche visuelle"
                title="Ajouter une photo"
              >
                📷
              </button>
              <button
                type="button"
                onClick={startVoiceInput}
                disabled={busy || visionBusy || listening}
                className="h-12 w-12 rounded-2xl bg-white/10 text-lg text-zinc-200 transition hover:bg-white/20 disabled:opacity-50"
                aria-label="Entrée vocale"
                title="Parler"
              >
                🎤
              </button>
              <textarea
              id="agent-input"
              rows={2}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault()
                  void sendFromInput()
                }
              }}
              disabled={busy}
              placeholder="Montrez-moi des chaussures…"
              className="min-h-[52px] flex-1 resize-y rounded-2xl border-0 bg-white/10 px-5 py-4 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-500 disabled:opacity-60"
              />
              <div className="flex shrink-0 gap-2">
                {busy ? (
                  <button
                    type="button"
                    onClick={() => void stop()}
                    className="rounded-2xl border border-white/10 px-4 py-3 text-sm font-medium text-zinc-200 hover:bg-white/10"
                  >
                    Stop
                  </button>
                ) : null}
                <button
                  type="submit"
                  disabled={busy || visionBusy || (!input.trim() && !imageFile)}
                  className="rounded-2xl bg-gradient-to-r from-violet-600 to-pink-600 px-6 py-4 text-sm font-medium text-white shadow-lg shadow-violet-900/20 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Envoyer
                </button>
              </div>
            </div>
          </form>
          {visionBusy ? (
            <p className="mt-2 text-xs text-zinc-400">Analyse de l&apos;image...</p>
          ) : null}
          {listening ? <p className="mt-2 text-xs text-violet-300">🎤 Écoute...</p> : null}
          {visionError ? <p className="mt-2 text-xs text-red-300">{visionError}</p> : null}
        </div>
      </div>
    </div>
  )
}
