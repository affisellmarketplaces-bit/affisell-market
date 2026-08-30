"use client"

let initialized = false
let clientScore = 100
const reportedBotReasons = new Set<string>()

function reportClientBot(reason: string): void {
  if (reportedBotReasons.has(reason)) return
  reportedBotReasons.add(reason)
  void fetch("/api/security/logs", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type: "CLIENT_BOT",
      ua: navigator.userAgent,
      path: location.pathname,
      data: reason,
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
      reportClientBot("client_rate_burst")
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
        reportClientBot("instant_paste")
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

function registerAutofillBurstGuard(): void {
  const filledAt: number[] = []

  document.addEventListener(
    "input",
    (event) => {
      const target = event.target
      if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)) return
      if (!target.value.trim()) return

      const now = Date.now()
      filledAt.push(now)
      while (filledAt.length > 0 && now - (filledAt[0] ?? now) > 500) filledAt.shift()

      if (filledAt.length >= 5) {
        clientScore = Math.min(clientScore, 20)
        reportClientBot("autofill_burst")
        filledAt.length = 0
      }
    },
    true
  )
}

function detectAutomation(): string[] {
  const reasons: string[] = []
  const nav = navigator as Navigator & {
    webdriver?: boolean
    chrome?: { runtime?: unknown }
  }

  if (nav.webdriver) reasons.push("navigator.webdriver")

  const w = window as Window & {
    _phantom?: unknown
    __nightmare?: unknown
    callPhantom?: unknown
  }
  if (w._phantom || w.__nightmare || w.callPhantom) reasons.push("phantom_headless")

  const ua = navigator.userAgent.toLowerCase()
  if (/headless|puppeteer|selenium|playwright/i.test(ua)) {
    reasons.push("headless_ua")
  }

  if (!nav.chrome && /chrome/i.test(ua)) {
    reasons.push("missing_window.chrome")
  }

  if (window.outerWidth - window.innerWidth > 160) {
    reasons.push("devtools_open")
  }

  return reasons
}

function runAutomationCheck(): void {
  const reasons = detectAutomation()
  if (reasons.length === 0) return

  clientScore = Math.max(0, clientScore - reasons.length * 20)
  for (const reason of reasons) {
    reportClientBot(reason)
  }
}

function checkDevtoolsOpen(): void {
  if (window.outerWidth - window.innerWidth > 160) {
    reportClientBot("devtools_open")
  }
}

/** Client-side humanoid heuristics — call once from root layout. */
export function initClientGuard(): void {
  if (initialized || typeof window === "undefined") return
  initialized = true

  registerClientRateLimit()
  registerCopyPasteGuard()
  registerAutofillBurstGuard()

  window.setTimeout(() => {
    runAutomationCheck()
  }, 2000)

  window.setInterval(() => {
    checkDevtoolsOpen()
  }, 10_000)
}

export function getClientGuardScore(): number {
  return clientScore
}
