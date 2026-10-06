import { readFileSync } from "node:fs"
import { join } from "node:path"
import vm from "node:vm"

import { describe, expect, it } from "vitest"

import { buildRollbackWorker, ROLLBACK_MARKER } from "../../scripts/pwa-rollback.mjs"

const CURRENT = readFileSync(join(process.cwd(), "public/sw.js"), "utf8")
type Handler = (event: Record<string, unknown>) => void

/** Runs a worker's source and returns what it registered and what its lifecycle did. */
function runWorker(source: string, existingCaches: string[]) {
  const handlers = new Map<string, Handler>()
  const deleted: string[] = []
  const calls = { claim: 0, unregister: 0, skipWaiting: 0, navigate: 0 }
  const sandbox = {
    self: {
      location: { origin: "https://shop.test" },
      addEventListener: (type: string, fn: Handler) => handlers.set(type, fn),
      skipWaiting: () => calls.skipWaiting++,
      clients: {
        claim: () => calls.claim++,
        matchAll: async () => [{ navigate: () => calls.navigate++ }],
      },
      registration: { unregister: async () => calls.unregister++, showNotification: async () => undefined },
    },
    caches: {
      keys: async () => existingCaches.filter((k) => !deleted.includes(k)),
      delete: async (k: string) => deleted.push(k) > 0,
    },
    URL,
    console,
  }
  vm.runInNewContext(source, sandbox)
  return {
    handlers,
    deleted,
    calls,
    async activate() {
      const waits: Promise<unknown>[] = []
      handlers.get("activate")!({ waitUntil: (p: Promise<unknown>) => waits.push(p) })
      await Promise.all(waits)
    },
  }
}

const CACHES = ["affisell-buyer-v2-shell", "affisell-buyer-v2-catalog", "affisell-buyer-v1-shell", "unrelated-cache"]

describe("pwa-rollback: offline (keeps Web Push)", () => {
  const source = buildRollbackWorker("offline", CURRENT)

  it("drops the offline shell: no fetch handler, so every request goes to the network again", () => {
    const w = runWorker(source, CACHES)
    expect(w.handlers.has("fetch")).toBe(false)
    expect(source).not.toContain("networkFirstNavigation")
  })

  it("deletes only the worker's own caches on activation, then takes control", async () => {
    const w = runWorker(source, CACHES)
    await w.activate()
    expect(w.deleted.sort()).toEqual(["affisell-buyer-v1-shell", "affisell-buyer-v2-catalog", "affisell-buyer-v2-shell"])
    expect(w.calls.claim).toBe(1)
    expect(w.calls.unregister).toBe(0)
  })

  it("keeps Web Push byte for byte (handlers copied from the live worker) and what verify:web-push checks", () => {
    const w = runWorker(source, CACHES)
    expect(w.handlers.has("push")).toBe(true)
    expect(w.handlers.has("notificationclick")).toBe(true)
    expect(source.endsWith(CURRENT.slice(CURRENT.indexOf('self.addEventListener("push"')))).toBe(true)
    expect(source).toContain("payload.tag")
    expect(source).toContain("self.location.origin")
  })

  it("is recognised as a rollback, and cannot be applied twice", () => {
    expect(source.startsWith(ROLLBACK_MARKER)).toBe(true)
    expect(() => buildRollbackWorker("offline", source)).toThrow(/already a rollback/)
    expect(() => buildRollbackWorker("unregister", source)).toThrow(/already a rollback/)
  })
})

describe("pwa-rollback: unregister", () => {
  const source = buildRollbackWorker("unregister", CURRENT)

  it("deletes its caches, then unregisters itself", async () => {
    const w = runWorker(source, CACHES)
    await w.activate()
    expect(w.deleted).toHaveLength(3)
    expect(w.calls.unregister).toBe(1)
    expect(w.handlers.has("fetch")).toBe(false)
  })

  it("never navigates or reloads a client (PwaShellRegister re-registers on every visit: that would loop)", async () => {
    const w = runWorker(source, CACHES)
    await w.activate()
    expect(w.calls.navigate).toBe(0)
    expect(source).not.toMatch(/navigate\(|location\.(reload|replace|assign)/)
  })
})

describe("pwa-rollback: safety", () => {
  it("refuses to drop Web Push handlers it cannot find, and unknown modes", () => {
    expect(() => buildRollbackWorker("offline", "self.addEventListener('fetch', () => {})")).toThrow(/Web Push handlers/)
    expect(() => buildRollbackWorker("nope" as never, CURRENT)).toThrow(/Unknown mode/)
  })

  it("the live worker is not a rollback (the tooling must not have been applied by accident)", () => {
    expect(CURRENT).not.toContain(ROLLBACK_MARKER)
  })
})
