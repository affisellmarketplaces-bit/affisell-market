"use client"

import { MessageCircle, Radio, Send, Tag, X } from "lucide-react"
import { useCallback, useEffect, useState } from "react"

export type DemoVisitor = {
  id: number
  name: string
  action: string
  time: string
  left: string | null
}

function initials(name: string) {
  if (name.startsWith("Anonymous")) return "?"
  const parts = name.replace(/\.$/, "").split(/\s+/).filter(Boolean)
  const a = parts[0]?.[0] ?? "?"
  const b = parts[1]?.[0] ?? ""
  return (a + b).toUpperCase()
}

function activityLine(v: DemoVisitor) {
  return `${v.name} • ${v.action}`
}

function formatCartLeft(seconds: number | null) {
  if (seconds === null || seconds <= 0) return null
  const m = Math.floor(seconds / 60)
  const r = seconds % 60
  return `${m}:${String(r).padStart(2, "0")} left`
}

/** Parse MM:SS countdown; only call from effects, not render. */
function parseCountdownMmSs(s: string | null): number | null {
  if (!s || !s.includes(":")) return null
  const [mm, ss] = s.trim().split(":")
  const m = Number(mm)
  const sec = Number(ss)
  if (!Number.isFinite(m) || !Number.isFinite(sec)) return null
  return m * 60 + sec
}

function hourlyBarsFromStoreId(storeId: string): number[] {
  let h = 0
  for (let i = 0; i < storeId.length; i++) {
    h = (Math.imul(31, h) + storeId.charCodeAt(i)) >>> 0
  }
  let s = h || 7
  const out: number[] = []
  for (let i = 0; i < 24; i++) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0
    out.push(10 + (s % 70))
  }
  return out
}

export default function AffiliateLiveStore({ storeId }: { storeId: string }) {
  const [visitors, setVisitors] = useState<DemoVisitor[]>([])
  const [cartSeconds, setCartSeconds] = useState<Record<number, number | null>>({})
  const [hourlyTraffic, setHourlyTraffic] = useState<number[]>([])
  const [isClient, setIsClient] = useState(false)
  const [liveCount, setLiveCount] = useState(0)

  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [chatForId, setChatForId] = useState<number | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    const id = window.requestAnimationFrame(() => {
      setIsClient(true)

      const demoVisitors: DemoVisitor[] = [
        { id: 1, name: "Emma R.", action: "cart: Lavender Candle", time: "8m ago", left: "6:13" },
        { id: 2, name: "Julien P.", action: "cart: Portable Speaker", time: "6m ago", left: "9:10" },
        { id: 3, name: "Anonymous", action: "homepage", time: "2m ago", left: null },
        { id: 4, name: "Lina K.", action: "viewing Sac bandoulière cuir", time: "3m ago", left: null },
      ]
      setVisitors(demoVisitors)
      setLiveCount(demoVisitors.length)

      const nextCart: Record<number, number | null> = {}
      for (const v of demoVisitors) {
        nextCart[v.id] = parseCountdownMmSs(v.left)
      }
      setCartSeconds(nextCart)

      setHourlyTraffic(hourlyBarsFromStoreId(storeId))
    })
    return () => window.cancelAnimationFrame(id)
  }, [storeId])

  useEffect(() => {
    const id = window.setInterval(() => {
      setCartSeconds((prev) => {
        const next = { ...prev }
        let changed = false
        for (const k of Object.keys(next)) {
          const key = Number(k)
          const v = next[key]
          if (typeof v !== "number" || v <= 0) continue
          next[key] = v - 1
          changed = true
        }
        return changed ? next : prev
      })
    }, 1000)
    return () => window.clearInterval(id)
  }, [])

  useEffect(() => {
    if (!sidebarOpen) return
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") setSidebarOpen(false)
    }
    window.addEventListener("keydown", onEsc)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      window.removeEventListener("keydown", onEsc)
      document.body.style.overflow = prevOverflow
    }
  }, [sidebarOpen])

  const dismissToast = useCallback(() => setToast(null), [])
  useEffect(() => {
    if (!toast) return
    const t = window.setTimeout(dismissToast, 3400)
    return () => window.clearTimeout(t)
  }, [toast, dismissToast])

  const maxBar = hourlyTraffic.length ? Math.max(...hourlyTraffic, 1) : 1

  if (!isClient) {
    return <div className="w-0" aria-hidden />
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setSidebarOpen(true)}
        className="inline-flex items-center gap-2 rounded-full border border-emerald-500/40 bg-emerald-50/90 px-3 py-1.5 text-xs font-semibold text-emerald-900 shadow-sm ring-1 ring-emerald-500/20 backdrop-blur-sm transition hover:bg-emerald-100/90 dark:border-emerald-400/30 dark:bg-emerald-950/60 dark:text-emerald-100 dark:ring-emerald-400/20 dark:hover:bg-emerald-900/70"
        title="Open live visitors"
      >
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-70" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
        </span>
        <Radio className="h-3.5 w-3.5 opacity-80" aria-hidden />
        <span>
          LIVE • {liveCount} {liveCount === 1 ? "visitor" : "visitors"}
        </span>
      </button>

      {sidebarOpen ? (
        <div
          className="fixed inset-0 z-[90] bg-black/45 backdrop-blur-[2px] transition-opacity dark:bg-black/60"
          aria-hidden
          onClick={() => setSidebarOpen(false)}
        />
      ) : null}

      <aside
        className={`fixed inset-y-0 right-0 z-[95] flex w-full max-w-[380px] flex-col border-l border-white/10 bg-zinc-950/88 shadow-2xl shadow-black/40 backdrop-blur-2xl transition-transform duration-300 ease-out dark:bg-zinc-950/92 ${
          sidebarOpen ? "translate-x-0" : "pointer-events-none translate-x-full"
        }`}
        aria-hidden={!sidebarOpen}
      >
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-400/90">Live store</p>
            <h2 className="mt-0.5 text-lg font-semibold text-white">Visitors</h2>
          </div>
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="rounded-full p-2 text-zinc-400 transition hover:bg-white/10 hover:text-white"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-8 pt-4">
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Active now</h3>
            <p className="mt-0.5 text-[11px] text-zinc-600">Demo visitors (client-only)</p>
            <ul className="mt-4 space-y-3">
              {visitors.map((v) => {
                const cartLabel =
                  v.left != null && v.action.startsWith("cart:")
                    ? formatCartLeft(cartSeconds[v.id] ?? null)
                    : null
                return (
                  <li
                    key={v.id}
                    className="rounded-2xl border border-white/[0.08] bg-white/[0.04] p-3 shadow-inner shadow-black/20"
                  >
                    <div className="flex gap-3">
                      <div
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500/30 to-teal-600/40 text-xs font-bold text-emerald-100 ring-1 ring-white/10"
                        aria-hidden
                      >
                        {initials(v.name)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm leading-snug text-white">{activityLine(v)}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-zinc-500">
                          <span>{v.time}</span>
                          {cartLabel ? (
                            <span className="rounded-md bg-amber-500/15 px-1.5 py-0.5 font-mono text-amber-200/90">
                              {cartLabel}
                            </span>
                          ) : null}
                        </div>
                        {chatForId === v.id ? (
                          <div className="mt-2 flex gap-2">
                            <input
                              type="text"
                              placeholder="Type a message…"
                              className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-xs text-white placeholder:text-zinc-600 focus:border-emerald-500/40 focus:outline-none"
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  setToast(`Demo: message queued for ${v.name}`)
                                  setChatForId(null)
                                }
                              }}
                            />
                            <button
                              type="button"
                              className="rounded-xl bg-emerald-600 px-2 py-2 text-white hover:bg-emerald-500"
                              title="Send"
                              onClick={() => {
                                setToast(`Demo: message queued for ${v.name}`)
                                setChatForId(null)
                              }}
                            >
                              <Send className="h-4 w-4" />
                            </button>
                          </div>
                        ) : null}
                        <div className="mt-2 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => setToast(`10% off popup triggered for ${v.name} (visitor screen)`)}
                            className="inline-flex items-center gap-1 rounded-full border border-emerald-500/35 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-100 transition hover:bg-emerald-500/20"
                          >
                            <Tag className="h-3 w-3" />
                            Send 10% off
                          </button>
                          <button
                            type="button"
                            onClick={() => setChatForId(chatForId === v.id ? null : v.id)}
                            className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-[11px] font-medium text-zinc-200 hover:bg-white/10"
                          >
                            <MessageCircle className="h-3 w-3" />
                            Start chat
                          </button>
                        </div>
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          </section>

          <section className="mt-8 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Today</h3>
            <div className="mt-3 flex flex-wrap gap-4 text-sm">
              <div>
                <p className="text-2xl font-semibold tabular-nums text-white">47</p>
                <p className="text-[11px] text-zinc-500">visitors</p>
              </div>
              <div>
                <p className="text-2xl font-semibold tabular-nums text-white">3</p>
                <p className="text-[11px] text-zinc-500">sales</p>
              </div>
              <div>
                <p className="text-2xl font-semibold tabular-nums text-emerald-300">€127</p>
                <p className="text-[11px] text-zinc-500">revenue</p>
              </div>
            </div>
            <p className="mt-4 text-[10px] font-medium uppercase tracking-wide text-zinc-600">Hourly traffic</p>
            <div className="mt-2 flex h-24 items-end gap-px rounded-lg bg-black/20 px-1 pb-1 pt-2 ring-1 ring-white/5">
              {hourlyTraffic.map((h, i) => (
                <div
                  key={i}
                  className="flex-1 rounded-sm bg-emerald-500/70 transition-colors hover:bg-emerald-400/80"
                  style={{ height: `${(h / maxBar) * 100}%`, minHeight: "4px" }}
                  title={`${i}:00 — ${h}`}
                />
              ))}
            </div>
          </section>
        </div>
      </aside>

      {toast ? (
        <div className="fixed bottom-6 left-1/2 z-[120] w-[min(92vw,380px)] -translate-x-1/2 rounded-2xl border border-white/10 bg-zinc-900/95 px-4 py-3 text-sm text-white shadow-2xl backdrop-blur-xl">
          {toast}
          <button type="button" className="mt-1 block text-[11px] text-zinc-400 underline" onClick={dismissToast}>
            Dismiss
          </button>
        </div>
      ) : null}
    </>
  )
}
