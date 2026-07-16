/**
 * Affisell dev terminal banner + optional browser open.
 */
import { spawn } from "node:child_process"

export function shouldAutoOpenBrowser(env = process.env) {
  if (env.AFFISELL_DEV_OPEN === "0") return false
  if (env.CI === "true" || env.CI === "1") return false
  if (env.PLAYWRIGHT_WEB_SERVER === "1") return false
  return true
}

export function printAffisellDevBanner(origin, { alreadyRunning = false } = {}) {
  const port = (() => {
    try {
      return new URL(origin).port || "3001"
    } catch {
      return "3001"
    }
  })()

  const head = alreadyRunning
    ? `[affisell dev] Affisell — already running → ${origin}`
    : `[affisell dev] Affisell — ${origin}`

  console.log(
    `\n${head}\n` +
      `  Home:      ${origin}/\n` +
      `  Dashboard: ${origin}/dashboard/supplier\n` +
      `  Radar:     ${origin}/radar\n`
  )
}

export function openDevBrowser(url, env = process.env) {
  if (!shouldAutoOpenBrowser(env)) return

  const opener =
    process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open"

  const child = spawn(opener, process.platform === "win32" ? ["", url] : [url], {
    stdio: "ignore",
    shell: process.platform === "win32",
    detached: true,
  })

  child.unref()
  child.on("error", () => {
    console.log(`[affisell dev] Open manually: ${url}`)
  })
}

export async function openDevBrowserWhenReady(origin, { maxAttempts = 40, intervalMs = 500 } = {}) {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const res = await fetch(`${origin}/`, {
        method: "HEAD",
        signal: AbortSignal.timeout(1500),
      })
      if (res.ok || res.status < 500) {
        openDevBrowser(origin)
        return
      }
    } catch {
      /* server still booting */
    }
    await new Promise((r) => setTimeout(r, intervalMs))
  }
  console.log(`[affisell dev] Server slow to start — open manually: ${origin}`)
}
