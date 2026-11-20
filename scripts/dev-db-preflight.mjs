#!/usr/bin/env node
/**
 * Local dev preflight: can THIS machine open a Postgres connection (TCP 5432) to the database named in .env.local?
 * Prints the host only — never the user, the password or the URL. Opens a bare TCP socket, sends nothing: no query,
 * no write, no Prisma client. Exit 0 always (the dev server starts anyway); the message says what to do.
 *
 * Why: "Can't reach database server at …:5432" (P1001) in `next dev` was hard to read. Neon answers on HTTPS (443) and
 * Postgres (5432); many Wi-Fi networks, VPNs and firewalls block 5432 only — then every page that reads the database
 * fails while the rest of the internet works.
 */
import { existsSync, readFileSync } from "node:fs"
import net from "node:net"
import tls from "node:tls"

import { parse } from "dotenv"

function databaseHost() {
  for (const file of [".env.local", ".env"]) {
    if (!existsSync(file)) continue
    const env = parse(readFileSync(file))
    for (const key of ["DATABASE_URL", "DIRECT_URL", "DATABASE_URL_UNPOOLED"]) {
      const raw = env[key]?.trim()
      if (!raw) continue
      try {
        const u = new URL(raw)
        return { file, key, host: u.hostname, port: Number(u.port || 5432) }
      } catch {
        /* not a URL: try the next one */
      }
    }
  }
  return null
}

function probe(connect, ms) {
  return new Promise((resolve) => {
    let done = false
    const finish = (r) => {
      if (done) return
      done = true
      try {
        sock.destroy()
      } catch {
        /* ignore */
      }
      resolve(r)
    }
    const sock = connect()
    sock.setTimeout(ms, () => finish("timeout"))
    sock.once("error", (e) => finish(e.code || "error"))
    sock.once(sock instanceof tls.TLSSocket ? "secureConnect" : "connect", () => finish("ok"))
  })
}

const target = databaseHost()
if (!target) {
  console.log("[db-preflight] aucune DATABASE_URL lisible dans .env.local / .env — rien à tester.")
  process.exit(0)
}
const pg = await probe(() => net.connect(target.port, target.host), 6000)
if (pg === "ok") {
  console.log(`[db-preflight] OK — ${target.host}:${target.port} joignable (${target.key}, ${target.file}).`)
  process.exit(0)
}
const https = await probe(() => tls.connect({ host: target.host, port: 443, servername: target.host }), 6000)
console.log(`\n[db-preflight] ⚠ Base de données INJOIGNABLE en Postgres : ${target.host}:${target.port} → ${pg}`)
if (https === "ok") {
  console.log("  Le même serveur répond en HTTPS (443) : c'est le RÉSEAU de cette machine qui bloque le port 5432")
  console.log("  (Wi-Fi d'entreprise / d'hôtel / public, VPN, pare-feu type Little Snitch).")
  console.log("  → Changez de réseau (partage de connexion du téléphone), ou coupez le VPN, puis relancez.")
} else if (pg === "ENOTFOUND" || pg === "EAI_AGAIN") {
  console.log("  Le nom ne se résout pas : la machine n'a pas d'accès Internet (ou DNS en panne). Vérifiez la connexion.")
} else {
  console.log(`  HTTPS (443) ne répond pas non plus (${https}) : pas d'accès Internet, ou le projet Neon est indisponible`)
  console.log("  (vérifiez https://neonstatus.com et l'état du projet sur console.neon.tech).")
}
console.log("  Le serveur démarre quand même ; les pages qui lisent la base afficheront l'erreur tant que ce n'est pas réglé.\n")
