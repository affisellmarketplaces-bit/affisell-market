"use client"

type ClientGuardHit = {
  type: string
  detail: string
}

let initialized = false
let clientScore = 100

function pushClientLog(type: string, data: Record<string, unknown>): void {
  void fetch("/api/security/logs", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type,
      data,
      path: typeof window !== "undefined" ? window.location.pathname : "",
    }),
  }).catch(() => undefined)
}

function registerClientRateLimit(): void {
  const hits: number[] = []
  const originalFetch = window.fetch.bind(window)
  window.fetch = (...args) => {
    const now = Date.now()
    hits.push(now)
    while (hits.length > 0 && now - (hits[0] ?? now) > 2000) hits.shift()
    if (hits.length >= 20) {
      clientScore = Math.min(clientScore, 25)
      pushClientLog("CLIENT_BOT", { reason: "client_rate_burst", count: hits.length })
    }
    return originalFetch(...args)
  }
}

function registerCopyPasteGuard(): void {
  document.addEventListener(
    "paste",
    (event) => {
      const target = event.target
      if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)) return
      const focusedAt = Number(target.dataset.affisellFocusedAt ?? "0")
      if (focusedAt > 0 && Date.now() - focusedAt < 100) {
        clientScore = Math.min(clientScore, 35)
        pushClientLog("CLIENT_BOT", { reason: "instant_paste", field: target.name || target.id })
      }
    },
    true
  )

  document.addEventListener(
    "focusin",
    (event) => {
      const target = event.target
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
        target.dataset.affisellFocusedAt = String(Date.now())
      }
    },
    true
  )
}

function detectAutomation(): ClientGuardHit[] {
  const hits: ClientGuardHit[] = []
  const nav = navigator as Navigator & {
    webdriver?: boolean
    chrome?: { runtime?: unknown }
  }

  if (nav.webdriver) hits.push({ type: "webdriver", detail: "navigator.webdriver" })

  const w = window as Window & { _phantom?: unknown; callPhantom?: unknown }
  if (w._phantom || w.callPhantom) hits.push({ type: "phantom", detail: "phantomjs" })

  const ua = navigator.userAgent.toLowerCase()
  if (/headless|puppeteer|selenium|playwright/i.test(ua)) {
    hits.push({ type: "headless_ua", detail: ua.slice(0, 80) })
  }

  if (!nav.chrome && /chrome/i.test(ua)) {
    hits.push({ type: "headless_chrome", detail: "missing window.chrome" })
  }

  if (window.outerWidth - window.innerWidth > 160) {
    hits.push({ type: "devtools", detail: "devtools_open" })
  }

  return hits
}

/** Client-side humanoid heuristics — call once from root layout. */
export function initClientGuard(): number {
  if (initialized || typeof window === "undefined") return clientScore
  initialized = true

  registerClientRateLimit()
  registerCopyPasteGuard()

  const automationHits = detectAutomation()
  if (automationHits.length > 0) {
    clientScore = Math.max(0, clientScore - automationHits.length * 20)
    pushClientLog("CLIENT_BOT", {
      reason: "automation_signals",
      hits: automationHits,
      score: clientScore,
    })
  }

  return clientScore
}

export function getClientGuardScore(): number {
  return clientScore
}
