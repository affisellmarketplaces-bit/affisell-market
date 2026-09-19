#!/usr/bin/env node
/**
 * After resetting the Neon role password: paste the NEW connection string in your clipboard
 * (Neon console -> branch "production" -> Connect -> copy), then run:
 *
 *   npm run env:rotate-db-password
 *
 * It replaces ONLY the password inside every URL of .env / .env.local that points at the same Neon
 * project endpoint and role, keeping each URL's shape (pooled / direct / params). Nothing is printed
 * except counts. Add --dry to preview.
 */
import fs from "node:fs"
import { execFileSync } from "node:child_process"

const dry = process.argv.includes("--dry")
const files = [".env", ".env.local"].filter((f) => fs.existsSync(f))

let clip = ""
try {
  clip = execFileSync("pbpaste", { encoding: "utf8" }).trim().replace(/^["']|["']$/g, "")
} catch {
  console.error("Cannot read the clipboard (macOS pbpaste needed).")
  process.exit(1)
}
let next
try {
  next = new URL(clip.replace(/^postgres(ql)?:(?=postgres(ql)?:\/\/)/i, ""))
} catch {
  console.error("Clipboard does not contain a postgres connection string. Copy it from Neon (Connect) first.")
  process.exit(1)
}
if (!/^postgres/.test(next.protocol) || !next.password) {
  console.error("Clipboard URL has no password — use 'Show password' before copying.")
  process.exit(1)
}
const endpointOf = (host) => host.split(".")[0].replace(/-pooler$/, "") + "@" + host.split(".").slice(1).join(".")
const target = endpointOf(next.hostname)
const newPassword = next.password // already URL-encoded as Neon provides it

let total = 0
for (const file of files) {
  const lines = fs.readFileSync(file, "utf8").split("\n")
  let changed = 0
  const out = lines.map((line) => {
    const m = line.match(/^([A-Z0-9_]+)=(["']?)(postgres(?:ql)?:\/\/)([^:@/]+):([^@]*)@([^/?"']+)(.*?)(["']?)$/)
    if (!m) return line
    const [, key, q1, scheme, user, , host, rest, q2] = m
    if (endpointOf(host) !== target || user !== next.username) return line
    changed++
    return `${key}=${q1}${scheme}${user}:${newPassword}@${host}${rest}${q2}`
  })
  if (changed && !dry) {
    fs.copyFileSync(file, `${file}.bak-before-rotate`)
    fs.writeFileSync(file, out.join("\n"))
  }
  console.log(`${file}: ${changed} URL(s) ${dry ? "would be " : ""}updated`)
  total += changed
}
if (total === 0) console.log("No URL matched this endpoint/role — check that you copied the PRODUCTION branch string.")
else if (!dry) console.log("Done. Restart the dev server. Backups: *.bak-before-rotate (delete them once verified; they hold the OLD password).")
