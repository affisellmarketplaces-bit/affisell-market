#!/usr/bin/env node
/**
 * Open a local dev URL in the default browser (macOS `open`, Linux `xdg-open`).
 * Avoids zsh glob on `?wizard=v2` — query built in Node.
 *
 * Usage:
 *   node scripts/open-dev-url.mjs /dashboard/supplier/products/new wizard=v2 compose=1
 *   npm run dev:open:wizard-v2
 */
import { spawn } from "node:child_process"
import { devLocalhostUrlWithQuery } from "./dev-localhost-url.mjs"

const pathname = process.argv[2] ?? "/"
const queryPairs = process.argv.slice(3)

const query = {}
for (const pair of queryPairs) {
  const eq = pair.indexOf("=")
  if (eq === -1) continue
  query[pair.slice(0, eq)] = pair.slice(eq + 1)
}

const url = devLocalhostUrlWithQuery(pathname, query)
console.log(`[dev] ${url}`)

const opener = process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open"
const child = spawn(opener, process.platform === "win32" ? ["", url] : [url], {
  stdio: "inherit",
  shell: process.platform === "win32",
})

child.on("error", (err) => {
  console.error("[dev] Could not open browser:", err.message)
  console.error("[dev] Open manually:", url)
  process.exit(1)
})
