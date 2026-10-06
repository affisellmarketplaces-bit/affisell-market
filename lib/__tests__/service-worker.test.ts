import { readFileSync } from "node:fs"
import { join } from "node:path"
import vm from "node:vm"

import { beforeEach, describe, expect, it } from "vitest"

import {
  PWA_CATALOG_API_PATH,
  PWA_OFFLINE_NAV_PREFIXES,
  PWA_PRECACHE_URLS,
  PWA_PUBLIC_SHELL_PATHS,
  PWA_SHELL_CACHE,
  PWA_SHELL_CACHE_VERSION,
} from "@/lib/pwa-shell-shared"

/**
 * public/sw.js runs unmodified in a sandbox with a fake Cache Storage / network, so these tests pin what a real browser
 * would store: above all that the signed-in visitor's session (embedded in every page) never lands in Cache Storage.
 */
const BASE = "https://shop.test"
const SW_SOURCE = readFileSync(join(process.cwd(), "public/sw.js"), "utf8")

type Handler = (event: Record<string, unknown>) => void
type NetLogEntry = { path: string; credentials: string; acceptLanguage: string | null }

function basic(body: string, init: ResponseInit = {}, overrides: { redirected?: boolean } = {}): Response {
  const res = new Response(body, init)
  // A constructed Response is "default"; same-origin responses from fetch() are "basic".
  Object.defineProperty(res, "type", { value: "basic" })
  if (overrides.redirected) Object.defineProperty(res, "redirected", { value: true })
  return res
}

function createWorker() {
  const handlers = new Map<string, Handler>()
  const stores = new Map<string, Map<string, Response>>()
  const netLog: NetLogEntry[] = []
  const state = {
    online: true,
    now: 1_790_000_000_000, // a realistic Date.now(): the refresh throttle compares against 0
    redirectAnonymous: false,
    anonymousStatus: 200,
  }

  // Cache keys are full URLs (path + query), like the real Cache Storage.
  const norm = (key: string | { url: string }) => {
    const u = new URL(typeof key === "string" ? key : key.url, BASE)
    return u.pathname + u.search
  }

  const net = async (input: { url: string; credentials?: string; headers?: Headers }): Promise<Response> => {
    const path = new URL(input.url, BASE).pathname
    netLog.push({
      path,
      credentials: input.credentials ?? "same-origin",
      acceptLanguage: input.headers?.get("accept-language") ?? null,
    })
    if (!state.online) throw new TypeError("Failed to fetch")
    if (path.startsWith(PWA_CATALOG_API_PATH)) return basic(JSON.stringify({ products: [{ id: "p1" }] }))
    if (input.credentials === "omit") {
      return basic(`<html>anonymous ${path}</html>`, { status: state.anonymousStatus }, { redirected: state.redirectAnonymous })
    }
    return basic(`<html>session alice@example.com ${path}</html>`)
  }

  class SWRequest extends Request {
    constructor(input: string | Request, init?: RequestInit) {
      super(typeof input === "string" ? new URL(input, BASE).href : input, init)
    }
  }

  const caches = {
    async open(name: string) {
      if (!stores.has(name)) stores.set(name, new Map())
      const store = stores.get(name)!
      return {
        async match(key: string) {
          return store.get(norm(key))?.clone()
        },
        async put(key: string, res: Response) {
          store.set(norm(key), res)
        },
        async add(req: { url: string; credentials?: string }) {
          store.set(norm(req), await net(req))
        },
        async keys() {
          return [...store.keys()]
        },
      }
    },
    async keys() {
      return [...stores.keys()]
    },
    async delete(name: string) {
      return stores.delete(name)
    },
  }

  const sandbox = {
    self: {
      location: { origin: BASE },
      addEventListener: (type: string, fn: Handler) => handlers.set(type, fn),
      skipWaiting: () => undefined,
      clients: { claim: () => undefined },
    },
    caches,
    fetch: net,
    Request: SWRequest,
    Response,
    URL,
    Headers,
    Date: { now: () => state.now },
    console,
  }
  vm.runInNewContext(SW_SOURCE, sandbox)

  async function fire(type: string, request: Record<string, unknown>) {
    let responded: Promise<Response> | undefined
    const waits: Promise<unknown>[] = []
    handlers.get(type)!({
      request,
      respondWith: (p: Promise<Response>) => (responded = p),
      waitUntil: (p: Promise<unknown>) => waits.push(p),
    })
    const response = responded ? await responded : undefined
    await Promise.all(waits)
    return { response, intercepted: responded !== undefined }
  }

  return {
    state,
    netLog,
    stores,
    handlers,
    navigate: (path: string) =>
      fire("fetch", {
        method: "GET",
        url: `${BASE}${path}`,
        mode: "navigate",
        credentials: "include",
        headers: new Headers({ "accept-language": "fr-FR" }),
      }),
    request: (init: Record<string, unknown>) => fire("fetch", { headers: new Headers(), ...init }),
    async install() {
      const waits: Promise<unknown>[] = []
      handlers.get("install")!({ waitUntil: (p: Promise<unknown>) => waits.push(p) })
      await Promise.all(waits)
    },
    async activate() {
      const waits: Promise<unknown>[] = []
      handlers.get("activate")!({ waitUntil: (p: Promise<unknown>) => waits.push(p) })
      await Promise.all(waits)
    },
    shellKeys: () => [...(stores.get(PWA_SHELL_CACHE)?.keys() ?? [])],
    shellText: async (path: string) => stores.get(PWA_SHELL_CACHE)?.get(path)?.clone().text(),
  }
}

describe("service worker: kept in sync with lib/pwa-shell-shared.ts", () => {
  it("declares the same cache version, precache list, catalog path and navigation lists", () => {
    expect(SW_SOURCE).toContain(`const CACHE_VERSION = "${PWA_SHELL_CACHE_VERSION}"`)
    expect(SW_SOURCE).toContain(`const CATALOG_API_PATH = "${PWA_CATALOG_API_PATH}"`)
    const list = (items: readonly string[]) => `[${items.map((i) => JSON.stringify(i)).join(", ")}]`
    expect(SW_SOURCE).toContain(`const PRECACHE_URLS = [\n${PWA_PRECACHE_URLS.map((u) => `  ${JSON.stringify(u)},`).join("\n")}\n]`)
    expect(SW_SOURCE).toContain(`const OFFLINE_NAV_PREFIXES = ${list(PWA_OFFLINE_NAV_PREFIXES)}`)
    expect(SW_SOURCE).toContain(`const PUBLIC_SHELL_PATHS = ${list(PWA_PUBLIC_SHELL_PATHS)}`)
  })
})

describe("service worker: offline shell never keeps a signed-in visitor's identity", () => {
  let sw: ReturnType<typeof createWorker>
  beforeEach(() => {
    sw = createWorker()
  })

  it("precaches the offline page without cookies", async () => {
    await sw.install()
    expect(sw.netLog.length).toBe(PWA_PRECACHE_URLS.length)
    expect(sw.netLog.every((r) => r.credentials === "omit")).toBe(true)
    expect(sw.shellKeys()).toContain("/offline")
  })

  it("returns the visitor's own page as is, but stores only the cookie-less copy", async () => {
    const { response, intercepted } = await sw.navigate("/marketplace/bestsellers")
    expect(intercepted).toBe(true)
    expect(await response!.text()).toContain("session alice@example.com")

    const stored = await sw.shellText("/marketplace/bestsellers")
    expect(stored).toContain("anonymous /marketplace/bestsellers")
    expect(stored).not.toContain("alice@example.com")
    const copy = sw.netLog.filter((r) => r.path === "/marketplace/bestsellers" && r.credentials === "omit")
    expect(copy).toHaveLength(1)
    expect(copy[0]!.acceptLanguage).toBe("fr-FR") // the shell keeps the visitor's language
  })

  it("serves the anonymous copy offline for public catalog pages", async () => {
    await sw.navigate("/")
    await sw.navigate("/marketplace/bestsellers")
    sw.state.online = false
    expect(await (await sw.navigate("/")).response!.text()).toContain("anonymous /")
    expect(await (await sw.navigate("/marketplace/bestsellers")).response!.text()).toContain("anonymous /marketplace/bestsellers")
  })

  it("never stores personal or non-listed pages, and answers them offline with the generic offline page", async () => {
    await sw.install()
    for (const path of ["/wishlist", "/cart", "/marketplace", "/marketplace/account/orders", "/marketplace/some-product-id"]) {
      const online = await sw.navigate(path)
      expect(await online.response!.text()).toContain("session alice@example.com") // passes through untouched
    }
    expect(sw.shellKeys()).toEqual(["/offline", "/icons/icon-192.png", "/icons/icon-512.png", "/placeholder-product.jpg"])

    sw.state.online = false
    for (const path of ["/wishlist", "/marketplace/account/orders", "/marketplace/some-product-id"]) {
      const text = await (await sw.navigate(path)).response!.text()
      expect(text).toContain("anonymous /offline")
      expect(text).not.toContain("alice@example.com")
    }
  })

  it("falls back to a plain 503 when nothing is stored at all", async () => {
    sw.state.online = false
    expect((await sw.navigate("/wishlist")).response!.status).toBe(503)
  })

  it("refreshes the anonymous copy at most once an hour per page", async () => {
    await sw.navigate("/")
    await sw.navigate("/")
    const omitCount = () => sw.netLog.filter((r) => r.path === "/" && r.credentials === "omit").length
    expect(omitCount()).toBe(1)
    sw.state.now += 61 * 60 * 1000
    await sw.navigate("/")
    expect(omitCount()).toBe(2)
  })

  it("does not store a redirected or failed anonymous response", async () => {
    sw.state.redirectAnonymous = true
    await sw.navigate("/marketplace/bestsellers")
    expect(sw.shellKeys()).not.toContain("/marketplace/bestsellers")

    sw.state.redirectAnonymous = false
    sw.state.anonymousStatus = 500
    await sw.navigate("/")
    expect(sw.shellKeys()).not.toContain("/")
  })

  it("does not touch non-GET, cross-origin or non-navigation requests", async () => {
    expect((await sw.request({ method: "POST", url: `${BASE}/marketplace`, mode: "navigate" })).intercepted).toBe(false)
    expect((await sw.request({ method: "GET", url: "https://cdn.other.test/x.js", mode: "no-cors" })).intercepted).toBe(false)
    expect((await sw.request({ method: "GET", url: `${BASE}/_next/static/a.js`, mode: "no-cors" })).intercepted).toBe(false)
    expect((await sw.request({ method: "GET", url: `${BASE}/dashboard/supplier`, mode: "navigate" })).intercepted).toBe(false)
  })

  it("catalog API: network first, cached copy offline, empty JSON when nothing is cached", async () => {
    const req = { method: "GET", url: `${BASE}${PWA_CATALOG_API_PATH}?lite=1`, mode: "cors" }
    const online = await sw.request(req)
    expect(await online.response!.json()).toEqual({ products: [{ id: "p1" }] })
    await new Promise((r) => setTimeout(r, 0)) // cache.put is not awaited by the worker

    sw.state.online = false
    expect(await (await sw.request(req)).response!.json()).toEqual({ products: [{ id: "p1" }] })
    expect(await (await sw.request({ ...req, url: `${BASE}${PWA_CATALOG_API_PATH}?other=1` })).response!.json()).toEqual({
      products: [],
      offline: true,
    })
  })

  it("on activation drops the caches of older versions only", async () => {
    await sw.install()
    sw.stores.set("affisell-buyer-v1-shell", new Map())
    sw.stores.set("unrelated-cache", new Map())
    await sw.activate()
    expect([...sw.stores.keys()].sort()).toEqual([PWA_SHELL_CACHE, "unrelated-cache"].sort())
  })
})
