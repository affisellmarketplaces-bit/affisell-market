#!/usr/bin/env node
/**
 * Measurement helper (CI only): a TCP relay that adds a fixed delay to every chunk in both directions — a stand-in for
 * a distant or waking database (Neon cold start, cross-region link). Order is kept (equal Node timers fire FIFO).
 * Usage: node scripts/perf/tcp-delay-proxy.mjs <listenPort> <targetHost:port> <delayMs>
 */
import net from "node:net"

const [listenPort, target, delayArg] = process.argv.slice(2)
const [host, port] = String(target).split(":")
const delay = Number(delayArg ?? 0)

net
  .createServer((client) => {
    const upstream = net.connect(Number(port), host)
    const relay = (from, to) => {
      from.on("data", (chunk) => setTimeout(() => to.write(chunk), delay))
      from.on("end", () => setTimeout(() => to.end(), delay))
      from.on("error", () => to.destroy())
    }
    relay(client, upstream)
    relay(upstream, client)
  })
  .listen(Number(listenPort), "127.0.0.1", () => console.log(`[tcp-delay] :${listenPort} -> ${target} (+${delay} ms per chunk)`))
