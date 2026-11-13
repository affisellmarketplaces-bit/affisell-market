import { readFileSync } from "node:fs"
import dns from "node:dns"
import Module from "node:module"
import net from "node:net"
import { join } from "node:path"
import tls from "node:tls"
import { inspect } from "node:util"

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { captureEntrySnapshot } from "../../scripts/lib/radar-entry-snapshot.mjs"
import { runRadarSeedCli } from "../../scripts/radar-seed-run"

/**
 * RSK-90 lot A — the WHOLE program, end to end, with every effect replaced by a recorder.
 *
 *  - the env files, the terminal and the historical guard are module doubles that push events on one ordered trace;
 *  - the generated Radar client is a fake served in place of `require(".prisma/client-mi")` (the CJS loader is intercepted), and
 *    every method of it pushes an event;
 *  - `net`, `dns` and `tls` are spied and THROW: a connection attempt would fail the test loudly;
 *  - `process.exit` throws: the program must report its code, never exit on its own.
 *
 * Every class of target is DISABLED in the shipped program (three independent literals). Two kinds of test follow from that:
 *  - REFUSAL tests run the program as shipped (`runRadarSeedCli`): nothing after the class decision can happen;
 *  - tests of what sits behind the literals (proofs, token, factory, probe, writes, final states) run a VARIANT of the same file in
 *    which ONE literal is `true`, obtained by importing `scripts/radar-seed-run.ts?lift=<class>` (see vitest-env/radar-literal-variant.ts:
 *    an in-memory rewrite of one exact line, for Vitest only). They are the only tests that ever run the code behind a literal.
 *
 * What this proves, and what it cannot: these are JavaScript-level spies. The native Prisma engine opens its own sockets and is not
 * observable here; the absence of a connection is shown INDIRECTLY (no client is ever constructed, hence no engine). Each
 * refusal test is paired with a negative control (the lifted variant MUST light up the same recorders), otherwise "nothing happened"
 * would be vacuous.
 */

const h = vi.hoisted(() => ({
  trace: [] as string[],
  sources: {
    files: [] as Array<{ label: string; resolution: boolean; values: Record<string, string>; definedTargetNames: string[]; allowNames: string[]; guardedNames?: string[] }>,
    unreadable: [] as string[],
  },
  surface: { existing: [] as string[], unreadEnvFiles: [] as string[] },
  clientConfig: null as unknown,
  interactive: false,
  interactiveCalls: 0,
  prompt: { kind: "answer", text: "" } as { kind: "answer"; text: string } | { kind: "aborted" } | { kind: "closed" },
  questions: [] as string[],
  guardCalls: [] as Array<{ tool: string; options: unknown }>,
  clientModule: null as unknown,
  ctorArgs: [] as unknown[],
  ctorSideEffect: null as null | (() => void),
  analyzeCalls: 0,
  analyzeOverride: null as null | ((real: (url: string) => unknown, url: string, call: number) => unknown),
  builderThrowsFor: null as null | string,
}))

vi.mock("../../scripts/lib/radar-sources.mjs", () => ({
  readRadarSources: () => {
    h.trace.push("sources.read")
    return { files: h.sources.files.map((f) => ({ guardedNames: [], ...f })), unreadable: h.sources.unreadable }
  },
  inspectEnvSurface: () => h.surface,
  readClientConfig: () => h.clientConfig,
}))
vi.mock("../../scripts/lib/radar-prompt.mjs", () => ({
  isInteractiveTerminal: () => {
    h.interactiveCalls += 1
    return h.interactive
  },
  askRadarProof: async (question: string) => {
    h.trace.push("prompt.ask")
    h.questions.push(question)
    return h.prompt
  },
}))
vi.mock("../../scripts/lib/production-guard.mjs", () => ({
  assertNotProductionByAccident: (tool: string, options: unknown) => {
    h.trace.push("guard.call")
    h.guardCalls.push({ tool, options })
  },
}))
vi.mock("../../scripts/lib/radar-target.mjs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../scripts/lib/radar-target.mjs")>()
  return {
    ...actual,
    analyzeTargetUrl: (url: string) => {
      h.analyzeCalls += 1
      return h.analyzeOverride ? h.analyzeOverride(actual.analyzeTargetUrl as (u: string) => unknown, url, h.analyzeCalls) : actual.analyzeTargetUrl(url)
    },
  }
})
vi.mock("../../lib/radar/world-mock-catalog", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../lib/radar/world-mock-catalog")>()
  return {
    ...actual,
    buildMockWinnersForCountry: (code: string, count: number) => {
      if (h.builderThrowsFor === code) throw new Error("builder failed at host-SENTINEL")
      return actual.buildMockWinnersForCountry(code, count)
    },
  }
})

const target = await vi.importActual<typeof import("../../scripts/lib/radar-target.mjs")>("../../scripts/lib/radar-target.mjs")
const { RADAR_MODEL_NAMES, RADAR_SCHEMA, ALLOW_VARIABLES, TARGET_VARIABLES, GUARDED_VARIABLES, formatIdentity, STATE } = target

/* ------------------------------------------------------------------ the lifted variants (the ONLY way behind a literal) */

type Lift = "staging" | "production" | "loopback"
const variants = new Map<Lift, Promise<{ runRadarSeedCli: () => Promise<number> }>>()
/** The program with ONE literal rewritten in memory (see vitest-env/radar-literal-variant.ts). Same file, same dependencies, same doubles. */
function lifted(lift: Lift): Promise<() => Promise<number>> {
  if (!variants.has(lift)) {
    const specifier = `../../scripts/radar-seed-run.ts?lift=${lift}`
    variants.set(lift, import(/* @vite-ignore */ specifier))
  }
  return (variants.get(lift) as Promise<{ runRadarSeedCli: () => Promise<number> }>).then((m) => m.runRadarSeedCli)
}

/* ------------------------------------------------------------------ synthetic targets (never resolvable, never connected) */

const root = process.cwd()
const sharedSource = readFileSync(join(root, "scripts/env-shared.mjs"), "utf8")
function marker(name: "PROD_NEON_MARKER" | "STAGING_NEON_MARKER"): string {
  const found = new RegExp(`const ${name} = "([^"]+)"`).exec(sharedSource)
  if (!found) throw new Error(`${name} not found`)
  return found[1]
}
const PASSWORD = "p4ss-SENTINEL-do-not-print"
const USER = "user-SENTINEL"
const QUERY = "?sslmode=require&channel_binding=require"
const neon = (mark: string, db = "radardb", query = QUERY) =>
  `postgresql://${USER}:${PASSWORD}@ep-${mark}-zz000000-pooler.c-3.eu-central-1.aws.neon.tech/${db}${query}`
const PROD_URL = neon(marker("PROD_NEON_MARKER"))
const STAGING_URL = neon(marker("STAGING_NEON_MARKER"))
const UNKNOWN_NEON_URL = neon("unlisted")
const loopback = (host = "localhost", port = "5433", db = "radar") => `postgresql://radar:${PASSWORD}@${host}:${port}/${db}`

function identityOf(url: string): string {
  const analysis = target.analyzeTargetUrl(url)
  if (!analysis.ok) throw new Error(`unusable fixture: ${analysis.key}`)
  return formatIdentity(analysis.identity)
}
const STAGING_ID = identityOf(STAGING_URL)
const PROD_ID = identityOf(PROD_URL)
const LOOPBACK_ID = identityOf(loopback())

/* ------------------------------------------------------------------ harness */

type SourceFile = (typeof h.sources.files)[number]
type Entry = {
  env?: Record<string, string>
  argv?: string[]
  execArgv?: string[]
  nodeOptions?: string
  files?: SourceFile[]
  unreadable?: string[]
  surface?: { existing?: string[]; unreadEnvFiles?: string[] }
  clientConfig?: unknown
  interactive?: boolean
  prompt?: typeof h.prompt
  client?: unknown
}

const CLIENT_DIR = "/fake/repo/node_modules/.prisma/client-mi"
/** What the generated client's entry file says about the env files it loads (the shape of Prisma 6.19's `index.js`). */
function clientConfig(over: Record<string, unknown> = {}, text?: string) {
  const body =
    text ??
    `"relativeEnvPaths": {\n    "rootEnvPath": null,\n    "schemaEnvPath": "../../../.env"\n  },\n  "relativePath": "../../../prisma",\n  "datasourceNames": [\n    "db"\n  ],\n  "inlineDatasources": {\n    "db": {\n      "url": {\n        "fromEnvVar": "RADAR_DATABASE_URL",\n        "value": null\n      }\n    }\n  },`
  return { ok: true, text: body, clientDir: CLIENT_DIR, expectedClientDir: CLIENT_DIR, repoRoot: "/fake/repo", schemaBeside: true, ...over }
}

const touched = new Map<string, string | undefined>()
const savedProcess = { argv: process.argv, execArgv: process.execArgv }
let out: string[] = []
let streams: Record<"log" | "error" | "warn" | "info", string[]> = { log: [], error: [], warn: [], info: [] }
let exitSpy: { mock: { calls: unknown[][] } }

function setEnv(name: string, value: string | undefined) {
  if (!touched.has(name)) touched.set(name, process.env[name])
  if (value === undefined) delete process.env[name]
  else process.env[name] = value
}

function enter(e: Entry = {}) {
  for (const name of [...TARGET_VARIABLES, ...ALLOW_VARIABLES, ...GUARDED_VARIABLES, "NODE_OPTIONS"]) setEnv(name, undefined)
  for (const [name, value] of Object.entries(e.env ?? {})) setEnv(name, value)
  if (e.nodeOptions) setEnv("NODE_OPTIONS", e.nodeOptions)
  Object.defineProperty(process, "argv", { value: ["node", "seed", ...(e.argv ?? [])], configurable: true, writable: true })
  Object.defineProperty(process, "execArgv", { value: e.execArgv ?? [], configurable: true, writable: true })
  h.sources = { files: e.files ?? [], unreadable: e.unreadable ?? [] }
  h.surface = { existing: e.surface?.existing ?? [], unreadEnvFiles: e.surface?.unreadEnvFiles ?? [] }
  h.clientConfig = e.clientConfig ?? clientConfig()
  h.interactive = e.interactive ?? false
  h.prompt = e.prompt ?? { kind: "answer", text: "" }
  h.clientModule = e.client ?? makeClientModule()
  captureEntrySnapshot()
}

function makeClientModule(
  opts: { models?: unknown; noPrisma?: boolean; probeError?: unknown; registryError?: unknown; deleteErrorFor?: string } = {}
) {
  const event = (name: string) => h.trace.push(`client.${name}`)
  class FakeClient {
    constructor(args: unknown) {
      h.trace.push("client.ctor")
      h.ctorArgs.push(args)
      h.ctorSideEffect?.()
    }
    radarCountry = {
      count: async () => {
        event("radarCountry.count")
        if (opts.probeError) throw opts.probeError
        return 0
      },
      upsert: async (args: { update: Record<string, unknown> }) => {
        event("radarCountry.upsert")
        if (opts.registryError && !("lastScanAt" in args.update)) throw opts.registryError
        return {}
      },
    }
    radarWinner = {
      deleteMany: async (args: { where: { countryCode: string } }) => {
        event("radarWinner.deleteMany")
        if (opts.deleteErrorFor === args.where.countryCode) throw Object.assign(new Error("deleteMany failed at host-SENTINEL"), { code: "P2010" })
        return {}
      },
      createMany: async () => {
        event("radarWinner.createMany")
        return {}
      },
    }
    radarTrendingKeyword = {
      deleteMany: async () => {
        event("radarTrendingKeyword.deleteMany")
        return {}
      },
      createMany: async () => {
        event("radarTrendingKeyword.createMany")
        return {}
      },
    }
    $disconnect = async () => {
      event("$disconnect")
    }
  }
  const models = opts.models ?? RADAR_MODEL_NAMES.map((name) => ({ name, schema: RADAR_SCHEMA }))
  return { PrismaClient: FakeClient, ...(opts.noPrisma ? {} : { Prisma: { dmmf: { datamodel: { models } } } }) }
}

type Loader = (this: unknown, request: string, ...rest: unknown[]) => unknown
const moduleInternals = Module as unknown as { _load: Loader; _resolveFilename: Loader }
const realLoad = moduleInternals._load
const realResolve = moduleInternals._resolveFilename

beforeEach(() => {
  h.trace.length = 0
  h.questions.length = 0
  h.guardCalls.length = 0
  h.ctorArgs.length = 0
  h.ctorSideEffect = null
  h.interactiveCalls = 0
  h.analyzeCalls = 0
  h.analyzeOverride = null
  h.builderThrowsFor = null
  out = []
  streams = { log: [], error: [], warn: [], info: [] }
  for (const method of ["log", "error", "warn", "info"] as const) {
    vi.spyOn(console, method).mockImplementation((...args: unknown[]) => {
      const line = args.map((a) => (typeof a === "string" ? a : inspect(a, { depth: 6 }))).join(" ")
      out.push(line)
      streams[method].push(line)
    })
  }
  vi.spyOn(moduleInternals, "_load").mockImplementation(function (this: unknown, request: string, ...rest: unknown[]) {
    if (request === ".prisma/client-mi") {
      h.trace.push("client.require")
      return h.clientModule
    }
    return Reflect.apply(realLoad, this, [request, ...rest])
  })
  // `nodeRequire.resolve(...)` must not depend on whether the real generated client is installed on the machine running the tests.
  vi.spyOn(moduleInternals, "_resolveFilename").mockImplementation(function (this: unknown, request: string, ...rest: unknown[]) {
    if (request === ".prisma/client-mi") return `${CLIENT_DIR}/index.js`
    return Reflect.apply(realResolve, this, [request, ...rest])
  })
  const refuseNetwork = (name: string) =>
    (() => {
      h.trace.push(`net.${name}`)
      throw new Error("NETWORK_SENTINEL")
    }) as never
  vi.spyOn(net.Socket.prototype, "connect").mockImplementation(refuseNetwork("connect"))
  vi.spyOn(dns, "lookup").mockImplementation(refuseNetwork("lookup"))
  vi.spyOn(tls, "connect").mockImplementation(refuseNetwork("tls"))
  exitSpy = vi.spyOn(process, "exit").mockImplementation((() => {
    throw new Error("PROCESS_EXIT")
  }) as never) as unknown as typeof exitSpy
})

afterEach(() => {
  // The program reports its code; it never exits on its own (the historical guard, which does, is a double here).
  expect(exitSpy.mock.calls).toEqual([])
  vi.restoreAllMocks()
  for (const [name, value] of touched) {
    if (value === undefined) delete process.env[name]
    else process.env[name] = value
  }
  touched.clear()
  Object.defineProperty(process, "argv", { value: savedProcess.argv, configurable: true, writable: true })
  Object.defineProperty(process, "execArgv", { value: savedProcess.execArgv, configurable: true, writable: true })
})

const output = () => out.join("\n")
const nothingTouched = () => h.trace.filter((e) => e.startsWith("client.") || e.startsWith("net.") || e === "guard.call")
/** The machine-readable last line, exactly as the program prints it. */
const finalLine = (state: string, key: string, exit: number) => `[seed-world-radar] result=${key} exit=${exit} state=${state}`
/** The LAST thing printed is the verdict line, and it goes to stderr whatever the state. */
function expectFinal(state: string, key: string, exit: number) {
  expect(out.at(-1)).toBe(finalLine(state, key, exit))
  expect(streams.error.at(-1)).toBe(finalLine(state, key, exit))
  expect(streams.log.some((l) => l.startsWith("[seed-world-radar] result="))).toBe(false)
}

function expectNoLeak() {
  const text = output()
  for (const forbidden of [PASSWORD, USER, "postgresql://", "SENTINEL"]) {
    expect(text.includes(forbidden), `output contains ${forbidden === PASSWORD ? "the password sentinel" : forbidden}`).toBe(false)
  }
}

/** A refusal: nothing was asked, created, connected or written beyond what the test says. */
function expectNoClientNoNetwork() {
  expect(nothingTouched()).toEqual([])
  expect(h.ctorArgs).toEqual([])
}

const STAGING_NOMINAL: Entry = {
  env: { RADAR_DATABASE_URL: STAGING_URL },
  interactive: true,
  prompt: { kind: "answer", text: `STAGING ${STAGING_ID}` },
}
const LOOPBACK_NOMINAL: Entry = {
  env: { RADAR_DATABASE_URL: loopback(), AFFISELL_ALLOW_LOOPBACK_WRITES: LOOPBACK_ID },
  interactive: true,
  prompt: { kind: "answer", text: `BOUCLAGE ${LOOPBACK_ID}` },
}
const PRODUCTION_NOMINAL: Entry = {
  env: { RADAR_DATABASE_URL: PROD_URL, AFFISELL_ALLOW_PRODUCTION_WRITES: PROD_ID },
  interactive: true,
  prompt: { kind: "answer", text: `PRODUCTION ${PROD_ID}` },
}

/** EVERY authorisation a class could ask for, all present at once. */
const everything = (url: string, id: string, label: string, cls: string, extra: Partial<Entry> = {}): Entry => ({
  env: { RADAR_DATABASE_URL: url, AFFISELL_ALLOW_PRODUCTION_WRITES: id, AFFISELL_ALLOW_LOOPBACK_WRITES: id },
  argv: ["--expect-class", cls, "--expect-identity", id, "--confirm-production", "--confirm-loopback"],
  interactive: true,
  prompt: { kind: "answer", text: `${label} ${id}` },
  ...extra,
})

/** Runs the shipped program once on an entry, with a clean trace. */
async function runShipped(entry: Entry) {
  h.trace.length = 0
  h.ctorArgs.length = 0
  out = []
  streams = { log: [], error: [], warn: [], info: [] }
  h.interactiveCalls = 0
  enter(entry)
  return runRadarSeedCli()
}

/* ================================================================================================================ */

describe("EVERY CLASS IS DISABLED — refused before any prompt, token, guard, client, connection or write, with every authorisation present", () => {
  const classes: Array<{ name: string; url: string; id: string; label: string; cls: string; key: string }> = [
    { name: "production", url: PROD_URL, id: PROD_ID, label: "PRODUCTION", cls: "production", key: "production_seed_disabled" },
    { name: "staging", url: STAGING_URL, id: STAGING_ID, label: "STAGING", cls: "staging", key: "staging_seed_disabled" },
    { name: "bouclage", url: loopback(), id: LOOPBACK_ID, label: "BOUCLAGE", cls: "bouclage", key: "loopback_seed_disabled" },
  ]

  it.each(classes)("T01 $name — class, identity, both ALLOW, both --confirm-*, a terminal and the exact typed phrase: still exit 3, and the ONLY thing that happened is reading the sources", async (c) => {
    expect(await runShipped(everything(c.url, c.id, c.label, c.cls))).toBe(3)
    expectFinal(STATE.REFUSED, c.key, 3)
    expect(output()).toContain("désactivé")
    expect(h.trace).toEqual(["sources.read"])
    expect(h.questions).toEqual([])
    expect(h.interactiveCalls).toBe(0)
    expectNoClientNoNetwork()
    expectNoLeak()
  })

  it.each(classes)("$name — the same outside a terminal, and without any expected class", async (c) => {
    for (const extra of [{ interactive: false }, { argv: ["--expect-identity", c.id, "--confirm-production", "--confirm-loopback"], interactive: false }, { argv: [] }]) {
      expect(await runShipped(everything(c.url, c.id, c.label, c.cls, extra))).toBe(3)
      expectFinal(STATE.REFUSED, c.key, 3)
      expect(h.trace).toEqual(["sources.read"])
      expect(h.interactiveCalls).toBe(0)
      expectNoClientNoNetwork()
    }
  })

  it.each(classes)("$name — whatever variable carries the URL, and whatever file it comes from", async (c) => {
    const variants: Entry[] = [
      { env: { DATABASE_URL_UNPOOLED: c.url } },
      { env: { DATABASE_URL: c.url } },
      { env: { MARKET_INTELLI_DATABASE_URL: c.url } },
      { files: [{ label: ".env.local", resolution: true, values: { DATABASE_URL: c.url }, definedTargetNames: ["DATABASE_URL"], allowNames: [] }] },
    ]
    for (const variant of variants) {
      const entry = everything(c.url, c.id, c.label, c.cls, { ...variant, env: { ...variant.env, AFFISELL_ALLOW_PRODUCTION_WRITES: c.id, AFFISELL_ALLOW_LOOPBACK_WRITES: c.id } })
      expect(await runShipped(entry)).toBe(3)
      expectFinal(STATE.REFUSED, c.key, 3)
      expect(h.trace).toEqual(["sources.read"])
      expectNoClientNoNetwork()
    }
  })

  it.each(classes)("$name — no environment variable lifts it", async (c) => {
    const attempts: Array<[string, string]> = [
      ["PRODUCTION_SEED_ENABLED", "1"],
      ["LOOPBACK_SEED_ENABLED", "true"],
      ["STAGING_SEED_ENABLED", "1"],
      ["AFFISELL_PRODUCTION_SEED", "1"],
      ["ENABLE_STAGING_SEED", "true"],
      ["ALLOW_PRODUCTION_SEED", "yes"],
      ["AFFISELL_ALLOW_STAGING_WRITES", c.id],
      ["RADAR_SEED_FORCE", "1"],
      ["NODE_ENV", "production"],
      ["VERCEL", "1"],
      ["CI", "true"],
    ]
    for (const [name, value] of attempts) {
      h.trace.length = 0
      out = []
      enter(everything(c.url, c.id, c.label, c.cls))
      setEnv(name, value)
      captureEntrySnapshot()
      expect(await runRadarSeedCli(), `${name}=${value}`).toBe(3)
      expectFinal(STATE.REFUSED, c.key, 3)
      expect(h.trace).toEqual(["sources.read"])
      expectNoClientNoNetwork()
    }
  })

  it("no argument lifts any of them: an unknown option is refused at G0, before even the sources are read", async () => {
    for (const flag of ["--enable-production", "--confirm-staging", "--enable-staging", "--production-enabled=true", "--force", "--i-know-what-i-am-doing", "--yes"]) {
      for (const c of classes) {
        const entry = everything(c.url, c.id, c.label, c.cls)
        expect(await runShipped({ ...entry, argv: [...(entry.argv ?? []), flag] }), flag).toBe(2)
        expectFinal(STATE.REFUSED, "unknown_option", 2)
        expect(h.trace, flag).toEqual([])
        expectNoClientNoNetwork()
      }
    }
  })

  it("an entry that expects another class is refused as a mismatch (3), still before anything", async () => {
    for (const [c, other] of [
      [classes[0], "staging"],
      [classes[1], "production"],
      [classes[2], "production"],
      [classes[2], "staging"],
    ] as const) {
      expect(await runShipped(everything(c.url, c.id, c.label, other))).toBe(3)
      expectFinal(STATE.REFUSED, "class_mismatch", 3)
      expect(h.trace).toEqual(["sources.read"])
      expectNoClientNoNetwork()
    }
  })

  it("NEGATIVE CONTROL — each lifted variant lights up every recorder the refusals left dark, and ONLY its own class passes", async () => {
    for (const [lift, entry, other] of [
      ["staging", STAGING_NOMINAL, PRODUCTION_NOMINAL],
      ["production", PRODUCTION_NOMINAL, STAGING_NOMINAL],
      ["loopback", LOOPBACK_NOMINAL, STAGING_NOMINAL],
    ] as const) {
      h.trace.length = 0
      out = []
      enter(entry)
      expect(await (await lifted(lift))(), lift).toBe(6)
      for (const event of ["prompt.ask", "guard.call", "client.require", "client.ctor", "client.radarWinner.deleteMany", "client.radarWinner.createMany", "client.radarCountry.upsert"]) {
        expect(h.trace, `${lift}: ${event}`).toContain(event)
      }
      // The same variant still refuses the OTHER classes: lifting one literal lifts nothing else.
      expect(await runShippedThrough(await lifted(lift), other)).toBe(3)
      expect(h.ctorArgs).toEqual([])
    }
  })

  it("NEGATIVE CONTROL — the network spies are live: a connection attempt throws and is recorded", () => {
    expect(() => net.connect({ host: "never-resolves.invalid", port: 9 })).toThrow("NETWORK_SENTINEL")
    expect(() => dns.lookup("never-resolves.invalid", () => undefined)).toThrow("NETWORK_SENTINEL")
    expect(() => tls.connect({ host: "never-resolves.invalid", port: 9 })).toThrow("NETWORK_SENTINEL")
    expect(h.trace).toEqual(["net.connect", "net.lookup", "net.tls"])
    h.trace.length = 0
  })
})

/** Runs a given program function (shipped or lifted) on an entry with a clean trace. */
async function runShippedThrough(run: () => Promise<number>, entry: Entry) {
  h.trace.length = 0
  h.ctorArgs.length = 0
  out = []
  streams = { log: [], error: [], warn: [], info: [] }
  enter(entry)
  return run()
}

describe("a bouclage target — refused whatever proof is present; hosts that merely look like it are refused earlier", () => {
  const hosts = ["localhost", "127.0.0.1", "[::1]", "127.255.0.9"]
  /** Port 5433, never the Docker-local one (5434, skipped by the resolver): a skipped candidate would make a row vacuous. */
  const rows: Array<{ name: string; entry: (url: string, id: string) => Entry; code: number; key: string }> = [
    { name: "no proof at all, outside a terminal", entry: (url) => ({ env: { RADAR_DATABASE_URL: url } }), code: 3, key: "loopback_seed_disabled" },
    {
      name: "ALLOW naming the exact identity, in a terminal, with the exact typed phrase",
      entry: (url, id) => ({ env: { RADAR_DATABASE_URL: url, AFFISELL_ALLOW_LOOPBACK_WRITES: id }, interactive: true, prompt: { kind: "answer", text: `BOUCLAGE ${id}` } }),
      code: 3,
      key: "loopback_seed_disabled",
    },
    {
      name: "ALLOW + --expect-identity + --confirm-loopback outside a terminal",
      entry: (url, id) => ({ env: { RADAR_DATABASE_URL: url, AFFISELL_ALLOW_LOOPBACK_WRITES: id }, argv: ["--expect-identity", id, "--confirm-loopback"] }),
      code: 3,
      key: "loopback_seed_disabled",
    },
    { name: "a historical endpoint-only ALLOW", entry: (url) => ({ env: { RADAR_DATABASE_URL: url, AFFISELL_ALLOW_LOOPBACK_WRITES: "localhost" }, interactive: true }), code: 3, key: "loopback_seed_disabled" },
    {
      name: "an ALLOW that names another port",
      entry: (url) => ({ env: { RADAR_DATABASE_URL: url, AFFISELL_ALLOW_LOOPBACK_WRITES: identityOf(loopback("localhost", "5435")) }, interactive: true }),
      code: 3,
      key: "loopback_seed_disabled",
    },
    {
      name: "an ALLOW also written in an env file",
      entry: (url, id) => ({
        env: { RADAR_DATABASE_URL: url, AFFISELL_ALLOW_LOOPBACK_WRITES: id },
        interactive: true,
        files: [{ label: ".env.local", resolution: true, values: {}, definedTargetNames: [], allowNames: [ALLOW_VARIABLES[1]] }],
      }),
      code: 3,
      key: "loopback_seed_disabled",
    },
    {
      name: "--expect-class bouclage with everything else",
      entry: (url, id) => ({ env: { RADAR_DATABASE_URL: url, AFFISELL_ALLOW_LOOPBACK_WRITES: id }, argv: ["--expect-class", "bouclage", "--expect-identity", id, "--confirm-loopback"] }),
      code: 3,
      key: "loopback_seed_disabled",
    },
    {
      name: "--expect-class production through a loopback target",
      entry: (url) => ({ env: { RADAR_DATABASE_URL: url }, argv: ["--expect-class", "production"] }),
      code: 3,
      key: "class_mismatch",
    },
    {
      name: "under `--env-file` the SOURCES are not examined: refused at G1, before the class is even read",
      entry: (url, id) => ({ env: { RADAR_DATABASE_URL: url, AFFISELL_ALLOW_LOOPBACK_WRITES: id }, interactive: true, execArgv: ["--env-file=.env.local"] }),
      code: 2,
      key: "foreign_preload",
    },
  ]

  it.each(hosts.flatMap((host) => rows.map((row) => ({ host, ...row }))))("$host — $name → exit $code ($key)", async ({ host, entry, code, key }) => {
    const url = loopback(host)
    expect(await runShipped(entry(url, identityOf(url)))).toBe(code)
    expectFinal(STATE.REFUSED, key, code)
    expect(h.trace).toEqual(["sources.read"])
    expect(h.interactiveCalls).toBe(0)
    expectNoClientNoNetwork()
    expectNoLeak()
  })

  it("a Docker-local DATABASE_URL (:5434) is a bouclage like any other, and is refused as one", async () => {
    expect(await runShipped({ env: { DATABASE_URL: loopback("localhost", "5434") } })).toBe(3)
    expectFinal(STATE.REFUSED, "loopback_seed_disabled", 3)
  })

  it.each([
    ["localhost.", 3, "url_host_invalid"],
    ["foo.localhost", 3, "unknown_class"],
    ["0.0.0.0", 3, "unknown_class"],
    ["host.docker.internal", 3, "unknown_class"],
    ["[::ffff:127.0.0.1]", 3, "unknown_class"],
  ])("%s is not a loopback host: refused earlier (%s %s)", async (host, code, key) => {
    expect(await runShipped({ env: { RADAR_DATABASE_URL: loopback(host) } })).toBe(code)
    expectFinal(STATE.REFUSED, key, code)
    expect(h.trace).toEqual(["sources.read"])
    expectNoClientNoNetwork()
  })
})

describe("refusals before the class decision (G0–G4, environment sources) — each one leaves every recorder dark", () => {
  const cases: Array<{ name: string; entry: Entry; code: number; key: string; trace: string[] }> = [
    { name: "T37 --countries=ZZ (no fallback to all countries)", entry: { ...STAGING_NOMINAL, argv: ["--countries=ZZ"] }, code: 2, key: "countries_unknown", trace: [] },
    { name: "T37 --countries= (empty)", entry: { ...STAGING_NOMINAL, argv: ["--countries="] }, code: 2, key: "countries_invalid", trace: [] },
    { name: "T37 --countries=FR,ZZ (one unknown code refuses the whole list)", entry: { ...STAGING_NOMINAL, argv: ["--countries=FR,ZZ"] }, code: 2, key: "countries_unknown", trace: [] },
    { name: "T05 staging through the production entry", entry: { ...STAGING_NOMINAL, argv: ["--expect-class", "production"] }, code: 3, key: "class_mismatch", trace: ["sources.read"] },
    { name: "T08 a loopback target through the production entry", entry: { env: { RADAR_DATABASE_URL: loopback() }, argv: ["--expect-class", "production"] }, code: 3, key: "class_mismatch", trace: ["sources.read"] },
    { name: "T09 0.0.0.0 is unknown, never loopback", entry: { env: { RADAR_DATABASE_URL: loopback("0.0.0.0") } }, code: 3, key: "unknown_class", trace: ["sources.read"] },
    { name: "T09 host.docker.internal is unknown", entry: { env: { RADAR_DATABASE_URL: loopback("host.docker.internal") } }, code: 3, key: "unknown_class", trace: ["sources.read"] },
    { name: "T10 an unlisted Neon host is unknown", entry: { env: { RADAR_DATABASE_URL: UNKNOWN_NEON_URL } }, code: 3, key: "unknown_class", trace: ["sources.read"] },
    { name: "T10 another provider is unknown", entry: { env: { RADAR_DATABASE_URL: "postgresql://u:p@db.other-provider.invalid:5432/app" } }, code: 3, key: "unknown_class", trace: ["sources.read"] },
    { name: "T21 no database name", entry: { env: { RADAR_DATABASE_URL: `postgresql://${USER}:${PASSWORD}@localhost:5433` } }, code: 3, key: "url_no_database", trace: ["sources.read"] },
    { name: "T21 not a URL", entry: { env: { RADAR_DATABASE_URL: `garbage ${PASSWORD}` } }, code: 3, key: "url_unparsable", trace: ["sources.read"] },
    { name: "T40 Neon on another port", entry: { env: { RADAR_DATABASE_URL: STAGING_URL.replace(".neon.tech/", ".neon.tech:5433/") } }, code: 3, key: "url_neon_port", trace: ["sources.read"] },
    { name: "C1 a `host` parameter on a Neon URL (the engine would connect elsewhere)", entry: { env: { RADAR_DATABASE_URL: `${STAGING_URL}&host=127.0.0.1` } }, code: 3, key: "url_param_destination", trace: ["sources.read"] },
    { name: "C1 a parameter outside the closed list", entry: { env: { RADAR_DATABASE_URL: `${STAGING_URL}&connect_timeout=60` } }, code: 3, key: "url_param_not_allowed", trace: ["sources.read"] },
    { name: "C1 a Neon URL without sslmode (the engine would fall back to `prefer`)", entry: { env: { RADAR_DATABASE_URL: neon("unlisted", "radardb", "") } }, code: 3, key: "url_sslmode_required", trace: ["sources.read"] },
    { name: "T20 nothing to resolve", entry: {}, code: 1, key: "no_target", trace: ["sources.read"] },
    { name: "T06 only a Docker-local RADAR_DATABASE_URL (skipped): no silent fallback", entry: { env: { RADAR_DATABASE_URL: loopback("localhost", "5434") } }, code: 1, key: "no_target", trace: ["sources.read"] },
    { name: "an env file that exists but cannot be read", entry: { ...STAGING_NOMINAL, unreadable: [".env"] }, code: 1, key: "source_unreadable", trace: ["sources.read"] },
    { name: "D5 a `prisma/.env` exists: a file the generated client could read instead", entry: { ...STAGING_NOMINAL, surface: { existing: ["prisma/.env"] } }, code: 3, key: "unexamined_env_source", trace: ["sources.read"] },
    { name: "D5 a `.env.vault` exists", entry: { ...STAGING_NOMINAL, surface: { existing: [".env.vault"] } }, code: 3, key: "unexamined_env_source", trace: ["sources.read"] },
    { name: "D5 DOTENV_KEY is set in the shell", entry: { ...STAGING_NOMINAL, env: { ...STAGING_NOMINAL.env, DOTENV_KEY: "dotenv://:key_SENTINEL@dotenvx.com/vault/.env.vault?environment=production" } }, code: 3, key: "unexamined_env_source", trace: ["sources.read"] },
    {
      name: "D5 DOTENV_KEY is defined in an env file",
      entry: { ...STAGING_NOMINAL, files: [{ label: ".env", resolution: true, values: {}, definedTargetNames: [], allowNames: [], guardedNames: ["DOTENV_KEY"] }] },
      code: 3,
      key: "unexamined_env_source",
      trace: ["sources.read"],
    },
    { name: "D6 PRISMA_QUERY_ENGINE_LIBRARY is set (another native engine would run)", entry: { ...STAGING_NOMINAL, env: { ...STAGING_NOMINAL.env, PRISMA_QUERY_ENGINE_LIBRARY: "/x/engine.node" } }, code: 3, key: "engine_override_variable", trace: ["sources.read"] },
    { name: "D6 bis DYLD_INSERT_LIBRARIES is set", entry: { ...STAGING_NOMINAL, env: { ...STAGING_NOMINAL.env, DYLD_INSERT_LIBRARIES: "/x/lib.dylib" } }, code: 3, key: "engine_override_variable", trace: ["sources.read"] },
    { name: "D6 bis LD_PRELOAD is set", entry: { ...STAGING_NOMINAL, env: { ...STAGING_NOMINAL.env, LD_PRELOAD: "/x/lib.so" } }, code: 3, key: "engine_override_variable", trace: ["sources.read"] },
    {
      name: "D6 PRISMA_CLIENT_ENGINE_TYPE is defined in an env file",
      entry: { ...STAGING_NOMINAL, files: [{ label: ".env.local", resolution: true, values: {}, definedTargetNames: [], allowNames: [], guardedNames: ["PRISMA_CLIENT_ENGINE_TYPE"] }] },
      code: 3,
      key: "engine_override_variable",
      trace: ["sources.read"],
    },
    { name: "provenance: `--env-file` in execArgv (any class, any proof)", entry: { ...STAGING_NOMINAL, execArgv: ["--env-file=.env.local"] }, code: 2, key: "foreign_preload", trace: ["sources.read"] },
    { name: "provenance: `NODE_OPTIONS=--require …`", entry: { ...STAGING_NOMINAL, nodeOptions: "--require dotenv/config" }, code: 2, key: "foreign_preload", trace: ["sources.read"] },
  ]

  it.each(cases)("$name → exit $code ($key)", async ({ entry, code, key, trace }) => {
    expect(await runShipped(entry)).toBe(code)
    expectFinal(STATE.REFUSED, key, code)
    expect(h.trace).toEqual(trace)
    expectNoClientNoNetwork()
    expect(output()).not.toContain("executed_unverified")
    expectNoLeak()
  })

  it("C1 a refused parameter is named, its VALUE never is", async () => {
    const entry: Entry = { env: { RADAR_DATABASE_URL: `${STAGING_URL}&connect_timeout=VALUE-SENTINEL` } }
    expect(await runShipped(entry)).toBe(3)
    expect(output()).toContain("« connect_timeout »")
    expect(output().includes("VALUE-SENTINEL")).toBe(false)
    expect(await runShipped({ env: { RADAR_DATABASE_URL: STAGING_URL.replace("sslmode=require", "sslmode=VALUE-SENTINEL") } })).toBe(3)
    expect(output()).toContain("url_param_value")
    expect(output().includes("VALUE-SENTINEL")).toBe(false)
  })

  it("the `.env.*` files that exist but are not read are named (names only), before the target is resolved", async () => {
    expect(await runShipped({ ...STAGING_NOMINAL, surface: { unreadEnvFiles: [".env.test.local", ".env.vercel.production"] } })).toBe(3)
    expect(output()).toContain("fichiers .env.* présents mais non lus par le seed : .env.test.local, .env.vercel.production")
    expectFinal(STATE.REFUSED, "staging_seed_disabled", 3)
  })

  it("every refusal above says it in the last line, on stderr, with the state `refused`", async () => {
    expect(await runShipped({ env: { RADAR_DATABASE_URL: UNKNOWN_NEON_URL } })).toBe(3)
    expectFinal(STATE.REFUSED, "unknown_class", 3)
    expect(streams.log.join("\n")).not.toContain("state=")
  })
})

describe("behind the staging literal (lifted variant) — proofs of intent, in order, on the exact string that was confirmed", () => {
  const cases: Array<{ name: string; entry: Entry; code: number; key: string; trace: string[] }> = [
    { name: "T24 outside a terminal, no --expect-identity", entry: { env: { RADAR_DATABASE_URL: STAGING_URL } }, code: 2, key: "proof_missing", trace: ["sources.read"] },
    {
      name: "T25 --expect-identity that differs by ONE component (the base)",
      entry: { env: { RADAR_DATABASE_URL: STAGING_URL }, argv: ["--expect-identity", STAGING_ID.replace("/radardb#", "/otherdb#")] },
      code: 3,
      key: "expect_identity_mismatch",
      trace: ["sources.read"],
    },
    { name: "T02 typed `PROD` (the old confirmation)", entry: { ...STAGING_NOMINAL, prompt: { kind: "answer", text: "PROD" } }, code: 2, key: "typed_mismatch", trace: ["sources.read", "prompt.ask"] },
    {
      name: "T02 typed identity that differs by ONE component (the base)",
      entry: { ...STAGING_NOMINAL, prompt: { kind: "answer", text: `STAGING ${STAGING_ID.replace("/radardb#", "/otherdb#")}` } },
      code: 2,
      key: "typed_mismatch",
      trace: ["sources.read", "prompt.ask"],
    },
    { name: "T02 typed with the wrong class label", entry: { ...STAGING_NOMINAL, prompt: { kind: "answer", text: `PRODUCTION ${STAGING_ID}` } }, code: 2, key: "typed_mismatch", trace: ["sources.read", "prompt.ask"] },
    { name: "T36 the operator closes the prompt (Ctrl-D / EOF): a refusal, never a success", entry: { ...STAGING_NOMINAL, prompt: { kind: "closed" } }, code: 2, key: "prompt_closed", trace: ["sources.read", "prompt.ask"] },
    { name: "T23 Ctrl-C at the prompt", entry: { ...STAGING_NOMINAL, prompt: { kind: "aborted" } }, code: 130, key: "interrupted", trace: ["sources.read", "prompt.ask"] },
  ]

  it.each(cases)("$name → exit $code ($key), state refused", async ({ entry, code, key, trace }) => {
    expect(await runShippedThrough(await lifted("staging"), entry)).toBe(code)
    expectFinal(STATE.REFUSED, key, code)
    expect(h.trace).toEqual(trace)
    expectNoClientNoNetwork()
    expectNoLeak()
  })

  it("bouclage under the loopback variant: the ALLOW proof is still enforced behind the literal (no ALLOW → refused BEFORE anyone is asked to type)", async () => {
    expect(await runShippedThrough(await lifted("loopback"), { env: { RADAR_DATABASE_URL: loopback() }, interactive: true, prompt: { kind: "answer", text: `BOUCLAGE ${LOOPBACK_ID}` } })).toBe(2)
    expectFinal(STATE.REFUSED, "allow_missing", 2)
    expect(h.trace).toEqual(["sources.read"])
    expectNoClientNoNetwork()
  })

  it("production under the production variant: ALLOW and --confirm-production are still enforced behind the literal", async () => {
    const run = await lifted("production")
    expect(await runShippedThrough(run, { env: { RADAR_DATABASE_URL: PROD_URL }, interactive: true })).toBe(2)
    expectFinal(STATE.REFUSED, "allow_missing", 2)
    expect(await runShippedThrough(run, { env: { RADAR_DATABASE_URL: PROD_URL, AFFISELL_ALLOW_PRODUCTION_WRITES: PROD_ID }, argv: ["--expect-identity", PROD_ID] })).toBe(2)
    expectFinal(STATE.REFUSED, "confirm_flag_missing", 2)
    expectNoClientNoNetwork()
  })

  it("the entry snapshot is mandatory: see the last describe of this file (it needs a fresh module registry)", () => {
    expect(true).toBe(true)
  })
})

describe("the gate lets a legitimate run through the lifted variant — in order, on the exact string that was confirmed", () => {
  it("T04 staging, typed phrase in a terminal → exit 6 (executed, NOT verified) and the ordered trace of a real run", async () => {
    enter(STAGING_NOMINAL)
    expect(await (await lifted("staging"))()).toBe(6)
    expectFinal(STATE.EXECUTED_UNVERIFIED, "executed_unverified", 6)

    const order = ["sources.read", "prompt.ask", "guard.call", "client.require", "client.ctor", "client.radarCountry.count"]
    expect(h.trace.slice(0, order.length)).toEqual(order)
    expect(h.trace.at(-1)).toBe("client.$disconnect")
    expect(h.trace.filter((e) => e === "client.radarWinner.deleteMany")).toHaveLength(31)
    expect(h.trace.filter((e) => e === "client.ctor")).toHaveLength(1)

    // The client received exactly the URL that was resolved and confirmed, and the historical guard judged the same URL.
    const args = h.ctorArgs[0] as { datasources: { db: { url: string } } }
    expect(args.datasources.db.url === STAGING_URL).toBe(true)
    expect(Object.keys((h.ctorArgs[0] as { datasources: object }).datasources)).toEqual(["db"])
    const guard = h.guardCalls[0].options as { env: Record<string, string>; urlVariables: string[] }
    expect(guard.env.RADAR_DATABASE_URL === STAGING_URL).toBe(true)
    expect(guard.urlVariables).toEqual(["RADAR_DATABASE_URL"])
    expect(Object.keys(guard.env)).toEqual(["RADAR_DATABASE_URL"])
    expect(h.guardCalls[0].tool).toBe("scripts/seed-world-radar.ts")

    expect(h.questions[0]).toContain(`STAGING ${STAGING_ID}`)
    expect(output()).toContain(`Identité (d'après l'URL) : ${STAGING_ID}`)
    expect(output()).toContain("Classe (d'après le nom d'hôte, serveur réel non prouvé) : STAGING")
    expect(output()).toContain(target.TARGET_LIMIT_NOTICE)
    expect(output()).toContain("catalogue de démonstration (mock)")
    expectNoLeak()
  })

  it("the variable the schema reads is pre-set to the confirmed URL before the client is built (D3), and nothing changed it", async () => {
    let seenAtConstruction: boolean | null = null
    h.ctorSideEffect = () => {
      seenAtConstruction = process.env.RADAR_DATABASE_URL === STAGING_URL
    }
    enter({ ...STAGING_NOMINAL, env: { DATABASE_URL: STAGING_URL } }) // the URL does NOT come from RADAR_DATABASE_URL here
    expect(await (await lifted("staging"))()).toBe(6)
    expect(seenAtConstruction).toBe(true)
    expect(process.env.RADAR_DATABASE_URL === STAGING_URL).toBe(true)
  })

  it("something that changes that variable while the client is built is refused before any query (identity_drift, state refused)", async () => {
    h.ctorSideEffect = () => {
      process.env.RADAR_DATABASE_URL = "postgresql://changed:later@elsewhere.invalid:5432/x"
    }
    enter(STAGING_NOMINAL)
    expect(await (await lifted("staging"))()).toBe(3)
    expectFinal(STATE.REFUSED, "identity_drift", 3)
    expect(h.trace.filter((e) => e.startsWith("client.radar"))).toEqual([])
    expectNoLeak()
  })

  it("outside a terminal the identity is NOT displayed, and --expect-identity replaces the prompt", async () => {
    enter({ env: { RADAR_DATABASE_URL: STAGING_URL }, argv: ["--expect-identity", STAGING_ID, "--countries=FR"] })
    expect(await (await lifted("staging"))()).toBe(6)
    expect(h.trace).not.toContain("prompt.ask")
    expect(output()).toContain("non affichée hors terminal")
    expect(output().includes(STAGING_ID)).toBe(false)
    expect(h.trace.filter((e) => e === "client.radarWinner.deleteMany")).toHaveLength(1)
    expectNoLeak()
  })

  it("T08 bouclage, lifted: BOTH proofs → passes, and the banner carries the same limit notice", async () => {
    enter({ ...LOOPBACK_NOMINAL, argv: ["--countries=FR,DE"] })
    expect(await (await lifted("loopback"))()).toBe(6)
    expect(output()).toContain(target.TARGET_LIMIT_NOTICE)
    expect(h.trace).toContain("client.ctor")
    expect(h.trace.filter((e) => e === "client.radarWinner.deleteMany")).toHaveLength(2)
    expectNoLeak()
  })

  it("T07 a Docker-local R is skipped and reported by CLASS; the next candidate is used and confirmed", async () => {
    enter({ ...STAGING_NOMINAL, env: { RADAR_DATABASE_URL: loopback("localhost", "5434"), DATABASE_URL: STAGING_URL } })
    expect(await (await lifted("staging"))()).toBe(6)
    expect(output()).toContain("ignorée : RADAR_DATABASE_URL (shell) → classe bouclage [docker_local_skipped]")
    expect(output()).toContain("cible retenue : DATABASE_URL (source : shell)")
    expectNoLeak()
  })

  it("T17 a variable defined EMPTY is reported and masks nothing; `.env.pre-local-merge.bak` is reported by NAME and ignored", async () => {
    enter({
      ...STAGING_NOMINAL,
      env: { RADAR_DATABASE_URL: "", DATABASE_URL: STAGING_URL },
      files: [{ label: ".env.pre-local-merge.bak", resolution: false, values: {}, definedTargetNames: ["DATABASE_URL"], allowNames: [] }],
    })
    expect(await (await lifted("staging"))()).toBe(6)
    expect(output()).toContain("variable vide traitée comme absente : RADAR_DATABASE_URL (shell)")
    expect(output()).toContain(".env.pre-local-merge.bak n'est pas une source : variables-cibles ignorées : DATABASE_URL")
    expectNoLeak()
  })

  it("T22 the sources are read ONCE", async () => {
    enter(STAGING_NOMINAL)
    await (await lifted("staging"))()
    expect(h.trace.filter((e) => e === "sources.read")).toHaveLength(1)
  })

  it("tsx's own preloads do not block a run; any other preload does (at G1, whatever the class)", async () => {
    const dist = `${root}/node_modules/.pnpm/tsx@4.22.4/node_modules/tsx/dist`
    const own = ["--require", `${dist}/preflight.cjs`, "--import", `file://${dist}/loader.mjs`]
    const run = await lifted("staging")
    expect(await runShippedThrough(run, { ...STAGING_NOMINAL, argv: ["--countries=FR"], execArgv: own })).toBe(6)
    expect(await runShippedThrough(run, { ...STAGING_NOMINAL, argv: ["--countries=FR"], execArgv: [...own, "--import", "./hook.mjs"] })).toBe(2)
    expectFinal(STATE.REFUSED, "foreign_preload", 2)
    expect(nothingTouched()).toEqual([])
  })
})

describe("what a run says about itself — refused, failed before write, executed unverified, indeterminate", () => {
  const withClient = (opts: Parameters<typeof makeClientModule>[0]): Entry => ({ ...STAGING_NOMINAL, client: makeClientModule(opts) })
  const noWrites = () => h.trace.filter((e) => /deleteMany|createMany|upsert/.test(e))
  const run = async (entry: Entry) => runShippedThrough(await lifted("staging"), entry)

  it("T29 P2021 at the probe → exit 4 schema_absent, state failed_before_write: nothing written, the client is disconnected", async () => {
    expect(await run(withClient({ probeError: Object.assign(new Error("The table `market_intelli.RadarCountry` does not exist"), { code: "P2021" }) }))).toBe(4)
    expectFinal(STATE.FAILED_BEFORE_WRITE, "schema_absent", 4)
    expect(output()).toContain("code P2021")
    expect(noWrites()).toEqual([])
    expect(h.trace.at(-1)).toBe("client.$disconnect")
    expect(output()).not.toContain("executed_unverified")
  })

  it("T31 a connection error at the probe → exit 4 connection, failed_before_write (the old seed could exit 0)", async () => {
    for (const code of ["P1001", "P1002", "P1017"]) {
      expect(await run(withClient({ probeError: Object.assign(new Error(`cannot reach host-SENTINEL (${code})`), { code }) })), code).toBe(4)
      expectFinal(STATE.FAILED_BEFORE_WRITE, "connection", 4)
      expect(noWrites()).toEqual([])
      expectNoLeak()
    }
  })

  it("T30 an error whose TEXT contains model names and 'does not exist' but has no code → exit 4 database_error, never a success", async () => {
    expect(await run(withClient({ probeError: new Error("Invalid `prisma.radarCountry.count()` invocation: relation RadarCountry does not exist at host-SENTINEL") }))).toBe(4)
    expectFinal(STATE.FAILED_BEFORE_WRITE, "database_error", 4)
    expect(noWrites()).toEqual([])
    expectNoLeak()
  })

  it("an initialisation error (no code) is a connection failure, exit 4", async () => {
    const err = Object.assign(new Error("host-SENTINEL"), { name: "PrismaClientInitializationError" })
    expect(await run(withClient({ probeError: err }))).toBe(4)
    expectFinal(STATE.FAILED_BEFORE_WRITE, "connection", 4)
    expectNoLeak()
  })

  it("T33 a registry failure → exit 4 registry_failed, state INDETERMINATE (the registry may be partly updated), no country was replaced", async () => {
    expect(await run(withClient({ registryError: Object.assign(new Error("boom host-SENTINEL"), { code: "P2002" }) }))).toBe(4)
    expectFinal(STATE.INDETERMINATE, "registry_failed", 4)
    expect(output()).toContain("peut être partiellement mis à jour")
    expect(h.trace.filter((e) => e.includes("deleteMany") || e.includes("createMany"))).toEqual([])
    expectNoLeak()
  })

  it("T32 one country failing → exit 4 write_failed, state INDETERMINATE, listing it; the others are written, not verified; writes are not transactional", async () => {
    expect(await run(withClient({ deleteErrorFor: "DE" }))).toBe(4)
    expectFinal(STATE.INDETERMINATE, "write_failed", 4)
    expect(output()).toContain("Échec pour 1 pays sur 31 : DE")
    expect(output()).toContain("pas transactionnelles")
    expect(output()).toContain("non vérifiés")
    expect((output().match(/\[WORLD\] \w+ : \d+ gagnants envoyés, écriture acquittée sans erreur \(non relue\)/g) ?? []).length).toBe(30)
    expect(output()).not.toContain("Seeded")
    expectNoLeak()
  })

  it("an unexpected failure BEFORE any client exists is exit 1 `unexpected`, state refused", async () => {
    const boom = { PrismaClient: class { constructor() { throw new Error("constructor failed at host-SENTINEL") } }, Prisma: { dmmf: { datamodel: { models: RADAR_MODEL_NAMES.map((name) => ({ name, schema: RADAR_SCHEMA })) } } } }
    expect(await run({ ...STAGING_NOMINAL, client: boom })).toBe(1)
    expectFinal(STATE.REFUSED, "unexpected", 1)
    expect(output()).toContain("avant toute écriture")
    expectNoLeak()
  })

  it("an unexpected failure AFTER writes began is exit 4 `unexpected_after_start`, state INDETERMINATE", async () => {
    h.builderThrowsFor = "FR"
    enter({ ...STAGING_NOMINAL, argv: ["--countries=FR"] })
    expect(await (await lifted("staging"))()).toBe(4)
    expectFinal(STATE.INDETERMINATE, "unexpected_after_start", 4)
    expect(output()).toContain("après le début des écritures")
    expect(h.trace.at(-1)).toBe("client.$disconnect")
    expectNoLeak()
  })

  it("a successful run says 'written, not verified', never 'verified', and exit 0 is unreachable", async () => {
    expect(await run({ ...STAGING_NOMINAL, argv: ["--countries=FR"] })).toBe(6)
    expectFinal(STATE.EXECUTED_UNVERIFIED, "executed_unverified", 6)
    expect(output()).toContain("Rien n'a été relu")
    expect(output()).toContain("n'est PAS vérifié")
    // Remove the NEGATED claims ("n'est PAS vérifié", "non vérifié", "non vérifiés"): what remains must claim no verification at all.
    const affirmative = output().replace(/(?:PAS|non) vérifié(?:e|s)?/g, "")
    expect(affirmative).not.toMatch(/vérifi|\bverified\b/i)
    expect(output()).toContain(target.TARGET_LIMIT_NOTICE)
    // The state `verified` / exit 0 exists in the vocabulary, never in what this program returns.
    expect(target.deriveState({ clientBuilt: true, writeStarted: true, exit: 0 })).toBe(STATE.VERIFIED)
    expect(readFileSync(join(root, "scripts/radar-seed-run.ts"), "utf8").includes("EXIT.OK")).toBe(false)
  })
})

describe("G9b / G9 — the generated client is judged on its TEXT before it is loaded, then on its metadata; the factory recomputes the identity", () => {
  /** G9b happens BEFORE the module is required: the trace stops at the guard. */
  const envPathsRefused = async (over: Record<string, unknown>, text?: string) => {
    expect(await runShippedThrough(await lifted("staging"), { ...STAGING_NOMINAL, clientConfig: clientConfig(over, text) })).toBe(3)
    expectFinal(STATE.REFUSED, "client_env_paths_unproven", 3)
    expect(h.trace).toEqual(["sources.read", "prompt.ask", "guard.call"])
    expect(h.ctorArgs).toEqual([])
    expectNoLeak()
  }

  it("the nominal shape (no root path, `../../../.env`) is accepted", async () => {
    enter(STAGING_NOMINAL)
    expect(await (await lifted("staging"))()).toBe(6)
  })
  it("a file that could not be read is data, not an exception", async () => {
    expect(await runShippedThrough(await lifted("staging"), { ...STAGING_NOMINAL, clientConfig: { ok: false } })).toBe(3)
    expectFinal(STATE.REFUSED, "client_env_paths_unproven", 3)
    expect(h.trace).toEqual(["sources.read", "prompt.ask", "guard.call"])
  })
  it("another env file after a regeneration (`prisma/.env` present at generation time) is refused", async () => {
    await envPathsRefused({}, `"relativeEnvPaths": { "rootEnvPath": null, "schemaEnvPath": "../../../prisma/.env" }, "datasourceNames": ["db"], "inlineDatasources": { "db": { "url": { "fromEnvVar": "RADAR_DATABASE_URL", "value": null } } }`)
  })
  it("a root path that resolves outside the repository is refused", async () => {
    await envPathsRefused({}, `"relativeEnvPaths": { "rootEnvPath": "../../../../other/.env", "schemaEnvPath": null }, "datasourceNames": ["db"], "inlineDatasources": { "db": { "url": { "fromEnvVar": "RADAR_DATABASE_URL", "value": null } } }`)
  })
  it("a client folder that is not <repo>/node_modules/.prisma/client-mi is refused", async () => {
    await envPathsRefused({ clientDir: "/fake/repo/node_modules/.prisma/client" })
  })
  it("no schema.prisma beside the client, an unreadable or garbage configuration are refused", async () => {
    await envPathsRefused({ schemaBeside: false })
    await envPathsRefused({}, "no configuration here")
    await envPathsRefused({}, `"relativeEnvPaths": { "rootEnvPath": 3, "schemaEnvPath": null }, "datasourceNames": ["db"]`)
  })
  it("a datasource read from another variable, or carrying an inline value, is refused", async () => {
    await envPathsRefused({}, `"relativeEnvPaths": { "rootEnvPath": null, "schemaEnvPath": null }, "datasourceNames": ["db"], "inlineDatasources": { "db": { "url": { "fromEnvVar": "DATABASE_URL", "value": null } } }`)
    await envPathsRefused({}, `"relativeEnvPaths": { "rootEnvPath": null, "schemaEnvPath": null }, "datasourceNames": ["db"], "inlineDatasources": { "db": { "url": { "fromEnvVar": "RADAR_DATABASE_URL", "value": "x" } } }`)
  })
  it("no env path at all is accepted", async () => {
    enter({ ...STAGING_NOMINAL, clientConfig: clientConfig({}, `"relativeEnvPaths": { "rootEnvPath": null, "schemaEnvPath": null }, "datasourceNames": ["db"], "inlineDatasources": { "db": { "url": { "fromEnvVar": "RADAR_DATABASE_URL", "value": null } } }`) })
    expect(await (await lifted("staging"))()).toBe(6)
  })

  const mismatch = async (entry: Entry) => {
    expect(await runShippedThrough(await lifted("staging"), entry)).toBe(3)
    expectFinal(STATE.REFUSED, "schema_mismatch", 3)
    // T44: the module was loaded (once), the guard ran before it, and NO client was ever constructed.
    expect(h.trace).toEqual(["sources.read", "prompt.ask", "guard.call", "client.require"])
    expect(h.ctorArgs).toEqual([])
    expectNoLeak()
  }
  const models = (override: Record<string, string | undefined>) => RADAR_MODEL_NAMES.map((name) => ({ name, schema: name in override ? override[name] : RADAR_SCHEMA }))

  it("T44 one model bound to another schema", async () => {
    await mismatch({ ...STAGING_NOMINAL, client: makeClientModule({ models: models({ RadarWinner: "public" }) }) })
  })
  it("T44 a model without a schema", async () => {
    await mismatch({ ...STAGING_NOMINAL, client: makeClientModule({ models: models({ RadarTrendingKeyword: undefined }) }) })
  })
  it("T44 a model missing from the metadata", async () => {
    await mismatch({ ...STAGING_NOMINAL, client: makeClientModule({ models: [{ name: "RadarCountry", schema: RADAR_SCHEMA }] }) })
  })
  it("T44 unreadable metadata (no `Prisma` export): unreadable = refused", async () => {
    await mismatch({ ...STAGING_NOMINAL, client: makeClientModule({ noPrisma: true }) })
  })
  it("T44 metadata of the wrong shape", async () => {
    await mismatch({ ...STAGING_NOMINAL, client: makeClientModule({ models: "not an array" }) })
  })

  it("T53 the identity recomputed inside the factory differs from the confirmed one → identity_drift, no client", async () => {
    h.analyzeOverride = (real, url, call) => {
      const verdict = real(url) as { ok: boolean; identity: Record<string, unknown> }
      return call >= 2 && verdict.ok ? { ...verdict, identity: { ...verdict.identity, database: "drifted" } } : verdict
    }
    enter(STAGING_NOMINAL)
    expect(await (await lifted("staging"))()).toBe(3)
    expectFinal(STATE.REFUSED, "identity_drift", 3)
    expect(h.trace).toEqual(["sources.read", "prompt.ask", "guard.call", "client.require"])
    expect(h.ctorArgs).toEqual([])
    expect(h.analyzeCalls).toBe(2)
  })
})

describe("defence in depth — the token mint and the factory refuse a disabled class again, on their own", () => {
  /** The class stored in the private registry is forged as the token is issued: only the factory can still say no. */
  async function forged(lift: Lift, entry: Entry, forgedClass: string) {
    const realSet = WeakMap.prototype.set
    vi.spyOn(WeakMap.prototype, "set").mockImplementation(function (this: WeakMap<object, unknown>, key: object, value: unknown) {
      const isToken = key && typeof key === "object" && Object.getPrototypeOf(key) === null && Object.isFrozen(key) && value && typeof value === "object" && "url" in value
      return realSet.call(this, key, isToken ? Object.freeze({ ...(value as object), cls: forgedClass }) : value)
    } as never)
    const code = await runShippedThrough(await lifted(lift), entry)
    vi.mocked(WeakMap.prototype.set).mockRestore()
    return code
  }

  it.each([
    ["staging", STAGING_NOMINAL, "bouclage", "loopback_seed_disabled"],
    ["staging", STAGING_NOMINAL, "production", "production_seed_disabled"],
    ["production", PRODUCTION_NOMINAL, "staging", "staging_seed_disabled"],
    ["loopback", LOOPBACK_NOMINAL, "staging", "staging_seed_disabled"],
    ["loopback", LOOPBACK_NOMINAL, "production", "production_seed_disabled"],
  ] as const)("variant %s, class forged to %s → the factory refuses (%s) before the guard, the module and any client", async (lift, entry, forgedClass, key) => {
    expect(await forged(lift, entry, forgedClass)).toBe(3)
    expectFinal(STATE.REFUSED, key, 3)
    expect(output()).toContain("Aucun client n'a été créé")
    expect(h.trace).toEqual(["sources.read", "prompt.ask"])
    expect(h.ctorArgs).toEqual([])
  })
})

describe("the token — a frozen empty object whose URL lives in a private WeakMap (V8)", () => {
  it("copies, clones and look-alikes are not tokens; the token shows nothing", async () => {
    const captured: Array<{ map: WeakMap<object, unknown>; token: object; value: unknown }> = []
    const realSet = WeakMap.prototype.set
    vi.spyOn(WeakMap.prototype, "set").mockImplementation(function (this: WeakMap<object, unknown>, key: object, value: unknown) {
      if (
        key &&
        typeof key === "object" &&
        Object.getPrototypeOf(key) === null &&
        Object.isFrozen(key) &&
        Reflect.ownKeys(key).length === 0 &&
        value &&
        typeof value === "object" &&
        "url" in value
      ) {
        captured.push({ map: this, token: key, value })
      }
      return realSet.call(this, key, value)
    } as never)

    enter(STAGING_NOMINAL)
    expect(await (await lifted("staging"))()).toBe(6)
    expect(captured).toHaveLength(1)

    const { map, token, value } = captured[0]
    expect(map.has(token)).toBe(true) // control: the real token IS a key
    expect((value as { url: string }).url === STAGING_URL).toBe(true)
    expect(Object.isFrozen(value)).toBe(true)

    expect(Reflect.ownKeys(token)).toEqual([])
    expect(Object.getPrototypeOf(token)).toBeNull()
    expect(JSON.stringify(token)).toBe("{}")
    const shown = inspect(token, { showHidden: true, depth: 5 })
    expect(shown.includes(PASSWORD) || shown.includes(USER) || shown.includes("neon.tech") || shown.includes("postgresql")).toBe(false)

    const forgeries: object[] = [
      {},
      Object.freeze({}),
      Object.create(null),
      { ...token },
      Object.assign({}, token),
      structuredClone(token),
      Object.create(token),
      JSON.parse(JSON.stringify(token)),
      Object.freeze(Object.create(null)),
    ]
    for (const [i, forged] of forgeries.entries()) expect(map.has(forged), `forgery #${i}`).toBe(false)
  })
})

describe("the program reports codes, it does not exit", () => {
  it("every path above returned a code with `process.exit` armed to throw (asserted in afterEach), and the bootstrap sets the code", () => {
    const bootstrap = readFileSync(join(root, "scripts/seed-world-radar.ts"), "utf8")
    expect(bootstrap).toMatch(/process\.exitCode = code/)
  })
})

/* ================================================================================================================ */
/* LAST on purpose: `vi.resetModules()` gives a fresh registry, after which the module instances held above are stale.   */

describe("the entry snapshot is mandatory: a program that was not bootstrapped refuses to run", () => {
  it("exit 1 entry_not_bootstrapped, state refused, nothing touched", async () => {
    vi.resetModules()
    const fresh = await import("../../scripts/radar-seed-run")
    enter({ env: { RADAR_DATABASE_URL: STAGING_URL } })
    // `enter` filled the OLD snapshot module; the freshly imported program reads its own, empty one.
    expect(await fresh.runRadarSeedCli()).toBe(1)
    expectFinal(STATE.REFUSED, "entry_not_bootstrapped", 1)
    expect(nothingTouched()).toEqual([])
  })
})
