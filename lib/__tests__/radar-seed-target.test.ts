import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, describe, expect, it, vi } from "vitest"

import { resolveRadarDatabaseUrl } from "@/lib/radar/env"

import { normalizeEndpoint } from "../../scripts/prisma-explicit-db.mjs"
import { classifyDatabaseUrl } from "../../scripts/schema-deploy.mjs"

import {
  captureEntrySnapshot,
  readEntrySnapshot,
} from "../../scripts/lib/radar-entry-snapshot.mjs"
import { inspectEnvSurface, readClientConfig, readRadarSources } from "../../scripts/lib/radar-sources.mjs"
import {
  ALLOW_VARIABLES,
  CLASS_LABEL,
  ENGINE_VARIABLES,
  EXIT,
  GUARDED_VARIABLES,
  RADAR_SCHEMA,
  STATE,
  TARGET_LIMIT_NOTICE,
  TARGET_VARIABLES,
  analyzeTargetUrl,
  assessEnvLoadPaths,
  assessEnvSources,
  assessStaticProof,
  assessTypedProof,
  checkExpectedClass,
  classifySeedError,
  collectPreloadFindings,
  deriveState,
  diffIdentity,
  formatFinalLine,
  formatIdentity,
  identitiesEqual,
  isDockerLocalRadarUrl,
  isLoopbackHost,
  parseAllowValue,
  parseIdentity,
  parseSeedArgs,
  resolveTarget,
} from "../../scripts/lib/radar-target.mjs"

/**
 * RSK-90 lot A — the PURE layer of the World Radar seed gate. Nothing here can reach a database: every URL is a string, every
 * host is synthetic. The production / staging markers are read from the classifier's own source at run time (never written in
 * this file), and every comparison that involves a marker is reduced to a boolean so that a failing assertion cannot print one.
 */

const root = process.cwd()
const sharedSource = readFileSync(join(root, "scripts/env-shared.mjs"), "utf8")
function marker(name: "PROD_NEON_MARKER" | "STAGING_NEON_MARKER"): string {
  const found = new RegExp(`const ${name} = "([^"]+)"`).exec(sharedSource)
  if (!found) throw new Error(`${name} not found in scripts/env-shared.mjs`)
  return found[1]
}
const PROD_MARK = marker("PROD_NEON_MARKER")
const STAGING_MARK = marker("STAGING_NEON_MARKER")

const PASSWORD = "p4ss-SENTINEL-do-not-print"
const USER = "user-SENTINEL"
const neon = (mark: string, id = "zz000000", { port = "", db = "radardb", query = "?sslmode=require&channel_binding=require" } = {}) =>
  `postgresql://${USER}:${PASSWORD}@ep-${mark}-${id}-pooler.c-3.eu-central-1.aws.neon.tech${port}/${db}${query}`
const PROD_URL = neon(PROD_MARK)
const STAGING_URL = neon(STAGING_MARK)
const UNKNOWN_NEON_URL = neon("unlisted")
const loopback = (host = "localhost", port = "5433", db = "radar") => `postgresql://radar:${PASSWORD}@${host}:${port}/${db}`

function analyze(url: string) {
  const a = analyzeTargetUrl(url)
  if (!a.ok) throw new Error(`analysis refused: ${a.key}`)
  if (a.cls === "unknown") throw new Error("unknown class")
  return { identity: a.identity, cls: a.cls }
}
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

const KNOWN = ["FR", "DE", "US", "UK", "JP"]

describe("G0 — arguments are strict (no fallback to every country, no unknown option)", () => {
  it("accepts the documented forms", () => {
    const none = parseSeedArgs([], KNOWN)
    expect(none.ok && none.options.countries === null && none.options.expectClass === null).toBe(true)

    const a = parseSeedArgs(["--countries=fr, de", "--expect-class", "staging", "--expect-identity=pg:localhost:5433/radar#market_intelli", "--confirm-loopback"], KNOWN)
    expect(a.ok).toBe(true)
    if (a.ok) {
      expect(a.options.countries).toEqual(["FR", "DE"])
      expect(a.options.expectClass).toBe("staging")
      expect(a.options.expectIdentity).toBe("pg:localhost:5433/radar#market_intelli")
      expect(a.options.confirmLoopback).toBe(true)
      expect(a.options.confirmProduction).toBe(false)
    }
    const b = parseSeedArgs(["--", "--countries", "FR,FR,US"], KNOWN)
    expect(b.ok && same(b.options.countries, ["FR", "US"])).toBe(true)
  })

  const refusals: Array<[string[], string]> = [
    [["--force"], "unknown_option"],
    [["--enable-production"], "unknown_option"],
    [["something-positional"], "unknown_option"],
    [["--countries="], "countries_invalid"],
    [["--countries=FR,"], "countries_invalid"],
    [["--countries=FR,ZZ"], "countries_unknown"],
    [["--countries=ZZ"], "countries_unknown"],
    [["--countries"], "missing_value"],
    [["--countries", "--expect-class", "staging"], "missing_value"],
    [["--countries=FR", "--countries=DE"], "duplicate_option"],
    [["--confirm-production=1"], "flag_with_value"],
    [["--expect-class=local"], "expect_class_invalid"],
    [["--expect-identity"], "missing_value"],
  ]
  it.each(refusals)("refuses %j (%s) with exit 2 — never a silent fallback", (argv, key) => {
    const verdict = parseSeedArgs(argv, KNOWN)
    expect(verdict.ok).toBe(false)
    if (!verdict.ok) {
      expect(verdict.key).toBe(key)
      expect(verdict.exit).toBe(EXIT.REFUSED)
    }
  })

  it("never echoes an unexpected argument that is not an option name", () => {
    const verdict = parseSeedArgs([`postgresql://u:${PASSWORD}@h/db`], KNOWN)
    expect(verdict.ok).toBe(false)
    if (!verdict.ok) expect(verdict.message.includes(PASSWORD)).toBe(false)
  })
})

describe("G1 — one resolution, same rules as the application", () => {
  const D = loopback("localhost", "5434", "radar") // docker-local, skipped for R and M
  const original = { ...process.env }
  afterEach(() => {
    for (const name of TARGET_VARIABLES) {
      if (original[name] === undefined) delete process.env[name]
      else process.env[name] = original[name]
    }
  })

  it("T39 — parity with lib/radar/env.ts over 144 combinations of the four variables", () => {
    const radar = [undefined, "", D, "postgresql://r:p@radar-host.invalid:5432/r"]
    const mi = [undefined, "", loopback("127.0.0.1", "5434"), "postgresql://m:p@mi-host.invalid:5432/m"]
    const unpooled = [undefined, "", "postgresql://u:p@unpooled-host.invalid:5432/u"]
    const database = [undefined, "", "postgresql://d:p@database-host.invalid:5432/d"]
    let checked = 0
    for (const R of radar) for (const M of mi) for (const U of unpooled) for (const Dv of database) {
      const env = { RADAR_DATABASE_URL: R, MARKET_INTELLI_DATABASE_URL: M, DATABASE_URL_UNPOOLED: U, DATABASE_URL: Dv }
      for (const [name, value] of Object.entries(env)) {
        if (value === undefined) delete process.env[name]
        else process.env[name] = value
      }
      const mine = resolveTarget({ shell: env, files: [] })
      const theirs = resolveRadarDatabaseUrl()
      const shape = JSON.stringify([R, M, U, Dv].map((v) => (v === undefined ? "∅" : v === "" ? "''" : "v")))
      expect(mine.ok ? mine.url : undefined, shape).toBe(theirs)
      checked += 1
    }
    expect(checked).toBe(144)
  })

  it("the Docker-local skip rule matches the application's, including its unparsable-URL fallback", () => {
    expect(isDockerLocalRadarUrl("postgresql://a:b@localhost:5434/x")).toBe(true)
    expect(isDockerLocalRadarUrl("postgresql://a:b@127.0.0.1/x")).toBe(true)
    expect(isDockerLocalRadarUrl("postgresql://a:b@localhost:5433/x")).toBe(false)
    expect(isDockerLocalRadarUrl("postgresql://a:b@[::1]:5434/x")).toBe(false)
    expect(isDockerLocalRadarUrl("not a url but localhost:5434")).toBe(true)
  })

  it("per variable: shell > .env.local > .env; a variable defined EMPTY is absent AND reported; the lower sources are reported, not applied", () => {
    const local = { label: ".env.local", values: { DATABASE_URL: "postgresql://l:p@local-file.invalid:5432/l", RADAR_DATABASE_URL: "" } }
    const dotenv = { label: ".env", values: { DATABASE_URL: "postgresql://e:p@dotenv-file.invalid:5432/e" } }
    const fromFiles = resolveTarget({ shell: {}, files: [local, dotenv] })
    expect(fromFiles.ok && fromFiles.source === ".env.local" && fromFiles.variable === "DATABASE_URL").toBe(true)
    expect(fromFiles.empty).toEqual([{ variable: "RADAR_DATABASE_URL", source: ".env.local" }])
    expect(fromFiles.ignored.map((i) => [i.variable, i.source, i.why])).toEqual([["DATABASE_URL", ".env", "lower_precedence_source"]])

    const fromShell = resolveTarget({ shell: { DATABASE_URL: "postgresql://s:p@shell-host.invalid:5432/s" }, files: [local, dotenv] })
    expect(fromShell.ok && fromShell.source === "shell" && fromShell.url.includes("shell-host")).toBe(true)
  })

  it("T14/T15 — M beats U and D; a Docker-local R is skipped and reported by class, never by value", () => {
    const verdict = resolveTarget({
      shell: {
        RADAR_DATABASE_URL: D,
        MARKET_INTELLI_DATABASE_URL: "postgresql://m:p@mi-host.invalid:5432/m",
        DATABASE_URL_UNPOOLED: "postgresql://u:p@unpooled-host.invalid:5432/u",
      },
      files: [],
    })
    expect(verdict.ok && verdict.variable === "MARKET_INTELLI_DATABASE_URL").toBe(true)
    expect(verdict.ignored.map((i) => [i.variable, i.why, i.cls])).toEqual([
      ["RADAR_DATABASE_URL", "docker_local_skipped", "bouclage"],
      ["DATABASE_URL_UNPOOLED", "lower_priority_variable", "unknown"],
    ])
  })

  it("T06/T20 — only a Docker-local R, or nothing at all: no target, no silent fallback", () => {
    expect(resolveTarget({ shell: { RADAR_DATABASE_URL: D }, files: [] }).ok).toBe(false)
    expect(resolveTarget({ shell: {}, files: [] }).ok).toBe(false)
  })
})

describe("G2 / G3 — canonical identity and class", () => {
  it("builds `provider:endpoint[:port]/database#schema` with no user, password or parameter", () => {
    const { identity, cls } = analyze(PROD_URL)
    expect(cls).toBe("production")
    expect(identity.provider).toBe("neon")
    expect(identity.port).toBeNull()
    expect(identity.schema).toBe(RADAR_SCHEMA)
    const text = formatIdentity(identity)
    expect(text.includes(PASSWORD) || text.includes(USER) || text.includes("sslmode") || text.includes("pgbouncer")).toBe(false)
    expect(text.endsWith(`/radardb#${RADAR_SCHEMA}`)).toBe(true)
    expect(text.startsWith("neon:ep-")).toBe(true)
  })

  it("Neon: pooled and direct are the SAME identity; staging, production and an unlisted Neon host are three classes", () => {
    const pooled = analyze(PROD_URL).identity
    const direct = analyze(`postgresql://${USER}:${PASSWORD}@ep-${PROD_MARK}-zz000000.c-3.eu-central-1.aws.neon.tech/radardb?sslmode=require`).identity
    expect(identitiesEqual(pooled, direct)).toBe(true)
    expect(analyze(STAGING_URL).cls).toBe("staging")
    const unknown = analyzeTargetUrl(UNKNOWN_NEON_URL)
    expect(unknown.ok && unknown.cls === "unknown").toBe(true)
  })

  it("T40 — a Neon URL on a port other than 5432 is NOT proven (tunnel / proxy), 5432 is fine", () => {
    const odd = analyzeTargetUrl(neon(PROD_MARK, "zz000000", { port: ":5433" }))
    expect(odd.ok).toBe(false)
    if (!odd.ok) expect([odd.key, odd.exit]).toEqual(["url_neon_port", EXIT.TARGET_UNPROVEN])
    expect(analyzeTargetUrl(neon(PROD_MARK, "zz000000", { port: ":5432" })).ok).toBe(true)
  })

  it("T41 / T21 — no database name, a non-postgres scheme, no host, garbage: refused with exit 3, no value in the message", () => {
    for (const url of [
      `postgresql://${USER}:${PASSWORD}@localhost:5433`,
      `postgresql://${USER}:${PASSWORD}@localhost:5433/`,
      `mysql://${USER}:${PASSWORD}@localhost:3306/db`,
      `postgresql:///db`,
      "not a url",
      "",
      `postgresql://${USER}:${PASSWORD}@localhost:5433/db?schema=public`,
      // The closed list of parameters (C1b): `schema` is not in it, whatever its value — even the Radar schema itself.
      `postgresql://${USER}:${PASSWORD}@localhost:5433/db?schema=${RADAR_SCHEMA}`,
    ]) {
      const verdict = analyzeTargetUrl(url)
      expect(verdict.ok, url.replace(PASSWORD, "***")).toBe(false)
      if (!verdict.ok) {
        expect(verdict.exit).toBe(EXIT.TARGET_UNPROVEN)
        expect(verdict.message.includes(PASSWORD) || verdict.message.includes(USER) || verdict.message.includes("localhost")).toBe(false)
      }
    }
    // The identity's schema is a constant of the program, not something the URL says.
    expect(analyze(`postgresql://${USER}:${PASSWORD}@localhost:5433/db`).identity.schema).toBe(RADAR_SCHEMA)
  })

  it("T42/T43 — a non-Neon port is always explicit (5432 made explicit); the host's case does not change the identity", () => {
    const plain = analyzeTargetUrl(`postgresql://u:p@db.example.invalid/radar`)
    expect(plain.ok && formatIdentity(plain.identity) === "pg:db.example.invalid:5432/radar#market_intelli").toBe(true)
    const upper = analyzeTargetUrl(`postgresql://u:p@LOCALHOST:5433/radar`)
    const lower = analyzeTargetUrl(`postgresql://u:p@localhost:5433/radar`)
    expect(upper.ok && lower.ok && formatIdentity(upper.identity) === formatIdentity(lower.identity)).toBe(true)
  })

  it("L1 / T09 — localhost, 127.0.0.1 and [::1] are three DIFFERENT bouclage identities; 0.0.0.0, host.docker.internal and private hosts are unknown", () => {
    const ids = ["localhost", "127.0.0.1", "[::1]"].map((h) => {
      const a = analyze(loopback(h))
      expect(a.cls).toBe("bouclage")
      return formatIdentity(a.identity)
    })
    expect(new Set(ids).size).toBe(3)
    expect(ids).toEqual(["pg:localhost:5433/radar#market_intelli", "pg:127.0.0.1:5433/radar#market_intelli", "pg:[::1]:5433/radar#market_intelli"])
    for (const host of ["0.0.0.0", "host.docker.internal", "10.0.0.5", "db.example.invalid", "foo.localhost", "0x7f.1"]) {
      const a = analyzeTargetUrl(loopback(host))
      expect(a.ok && a.cls === "unknown", host).toBe(true)
    }
    // A trailing dot is outside the host grammar: not "unknown", not proven at all.
    const dotted = analyzeTargetUrl(loopback("localhost."))
    expect(!dotted.ok && dotted.key === "url_host_invalid").toBe(true)
    expect(isLoopbackHost("127.255.0.9")).toBe(true)
    expect(isLoopbackHost("127.256.0.1")).toBe(false)
  })

  it("the database name is the RAW path segment the engine sends: no decoding, a closed grammar, so identity == what is sent", () => {
    // What the engine sends is the first path segment as written (quaint `dbname()` does not decode). A name that WHATWG would encode
    // or that we would decode is therefore not the same name on both sides: refused.
    for (const name of ["my%20db", "my%20db%23x%2Cy", "a%25b", "d%3Fx", "a%2Fb", "my db", "a%2fb", "r%C3%A4dar", "a/b", "x".repeat(64)]) {
      const verdict = analyzeTargetUrl(loopback("localhost", "5433", name))
      expect(!verdict.ok && verdict.key === "url_database_invalid", name).toBe(true)
    }
    for (const name of ["radar", "Radar_db-1", "a.b", "x".repeat(63)]) {
      const a = analyze(loopback("localhost", "5433", name))
      expect(a.identity.database).toBe(name)
      expect(formatIdentity(a.identity)).toBe(`pg:localhost:5433/${name}#market_intelli`)
    }
  })

  it("G4 — the class an entry expects must equal the resolved class", () => {
    expect(checkExpectedClass(null, "staging").ok).toBe(true)
    expect(checkExpectedClass("staging", "staging").ok).toBe(true)
    const bad = checkExpectedClass("production", "staging")
    expect(bad.ok).toBe(false)
    if (!bad.ok) expect([bad.exit, bad.key]).toEqual([EXIT.TARGET_UNPROVEN, "class_mismatch"])
    expect(checkExpectedClass("production", "unknown").ok).toBe(false)
  })
})

describe("canonical identity — parse and compare on the five components", () => {
  it("round-trips, normalises Neon endpoints, and refuses a port on Neon / no port elsewhere", () => {
    for (const url of [PROD_URL, STAGING_URL, loopback(), loopback("[::1]", "5433")]) {
      const identity = analyze(url).identity
      expect(identitiesEqual(parseIdentity(formatIdentity(identity)) as never, identity)).toBe(true)
    }
    expect(parseIdentity("neon:ep-x/db#market_intelli")).not.toBeNull()
    expect(parseIdentity("neon:ep-x-pooler/db#market_intelli")?.endpoint).toBe("ep-x")
    expect(parseIdentity("neon:EP-X:5432/db#market_intelli")).toBeNull()
    expect(parseIdentity("pg:localhost/db#market_intelli")).toBeNull()
    expect(parseIdentity("pg:localhost:99999/db#market_intelli")).toBeNull()
    expect(parseIdentity("localhost:5433/db#market_intelli")).toBeNull()
    expect(parseIdentity("pg:localhost:5433/#market_intelli")).toBeNull()
  })

  it("differs by exactly the component that differs — endpoint and provider case-insensitive, base and schema case-sensitive", () => {
    const base = parseIdentity("pg:localhost:5433/Radar#market_intelli")!
    expect(diffIdentity(base, parseIdentity("pg:LOCALHOST:5433/Radar#market_intelli")!)).toEqual([])
    expect(diffIdentity(base, parseIdentity("pg:localhost:5434/Radar#market_intelli")!)).toEqual(["port"])
    expect(diffIdentity(base, parseIdentity("pg:localhost:5433/radar#market_intelli")!)).toEqual(["base"])
    expect(diffIdentity(base, parseIdentity("pg:localhost:5433/Radar#Market_Intelli")!)).toEqual(["schéma"])
    expect(diffIdentity(base, parseIdentity("pg:127.0.0.1:5433/Radar#market_intelli")!)).toEqual(["endpoint"])
    expect(diffIdentity(base, parseIdentity("neon:ep-x/Radar#market_intelli")!)).toEqual(["fournisseur", "endpoint", "port"])
  })
})

describe("ALLOW values name the COMPLETE identity (E13)", () => {
  const id = (s: string) => parseIdentity(s)!
  it("separates valid identities, legacy endpoint-only tokens and malformed tokens — counting, never echoing", () => {
    const parsed = parseAllowValue("ep-old-endpoint, pg:localhost:5433/radar#market_intelli  garbage!! neon:bad#x pg:[::1]:5433/radar#market_intelli")
    expect(parsed.identities.length).toBe(2)
    expect(parsed.legacy).toBe(1)
    expect(parsed.malformed).toBe(2)
    expect(parseAllowValue(undefined)).toEqual({ identities: [], legacy: 0, malformed: 0 })
    expect(parseAllowValue("1")).toEqual({ identities: [], legacy: 1, malformed: 0 })
  })
  it("a token for another base, another port or another endpoint is not the identity", () => {
    const target = id("pg:localhost:5433/radar#market_intelli")
    const matches = (value: string) => parseAllowValue(value).identities.some((c) => identitiesEqual(c, target))
    expect(matches("pg:localhost:5433/radar#market_intelli")).toBe(true)
    expect(matches("PG:LOCALHOST:5433/radar#market_intelli")).toBe(true)
    expect(matches("pg:localhost:5433/other#market_intelli")).toBe(false)
    expect(matches("pg:localhost:5434/radar#market_intelli")).toBe(false)
    expect(matches("pg:127.0.0.1:5433/radar#market_intelli")).toBe(false)
    expect(matches("pg:localhost:5433/Radar#market_intelli")).toBe(false)
  })
})

describe("provenance — Node options that load an env file or foreign code (execArgv AND NODE_OPTIONS)", () => {
  const repoRoot = "/work/affisell-market"
  const tsxDist = `${repoRoot}/node_modules/.pnpm/tsx@4.22.4/node_modules/tsx/dist`
  const own = ["--require", `${tsxDist}/preflight.cjs`, "--import", `file://${tsxDist}/loader.mjs`]
  const scan = (execArgv: string[], nodeOptions = "") => collectPreloadFindings({ execArgv, nodeOptions, repoRoot })

  it("tsx's own two preloads are legitimate and ignored", () => {
    expect(scan(own)).toEqual([])
    expect(scan([...own, "--max-old-space-size=4096", "--conditions=node", "--inspect=0"])).toEqual([])
    expect(scan(own, "--import tsx --max-old-space-size=4096")).toEqual([])
    expect(scan(own, "--require tsx/cjs")).toEqual([])
  })

  it("--env-file in any spelling, in execArgv or NODE_OPTIONS, is found by NAME", () => {
    for (const execArgv of [["--env-file=.env.local"], ["--env-file", ".env"], ["--env-file-if-exists=.env"]]) {
      expect(scan([...own, ...execArgv]).map((f) => [f.flag, f.source, f.kind])).toEqual([[execArgv[0].split("=")[0], "execArgv", "env"]])
    }
    expect(scan(own, "--env-file=.env.local").map((f) => [f.flag, f.source])).toEqual([["--env-file", "NODE_OPTIONS"]])
  })

  it("foreign code is found: -r, --require, --import, --loader, --experimental-loader, -e, -p", () => {
    const found = scan(
      [...own, "-r", "dotenv/config", "--require=./hook.js", "--import", "./hook.mjs", "--loader=x", "--experimental-loader", "y", "-e", "1", "-p", "2"],
      '--require "/some dir/x.js"'
    )
    expect(found.map((f) => f.flag)).toEqual(["-r", "--require", "--import", "--loader", "--experimental-loader", "-e", "-p", "--require"])
    expect(found.at(-1)?.source).toBe("NODE_OPTIONS")
  })

  it("a look-alike of tsx's files elsewhere, another file of tsx, or the REPL patch are NOT its preloads", () => {
    expect(scan(["--require", "/tmp/node_modules/tsx/dist/preflight.cjs"]).length).toBe(1)
    expect(scan(["--require", `${repoRoot}/node_modules/tsx/dist/evil.cjs`]).length).toBe(1)
    expect(scan(["--require", `${tsxDist}/patch-repl.cjs`]).length).toBe(1)
    expect(scan(["--import", `${repoRoot}/scripts/loader.mjs`]).length).toBe(1)
    expect(scan(["--require", `${repoRoot}/node_modules/tsx/dist/loader.mjs`]).length).toBe(1)
  })

  it("never reports a value or a path, only the flag, where it was and what it loads", () => {
    const found = scan(["--env-file=/Users/someone/secret/.env", "-r", "/Users/someone/hook.js"])
    expect(JSON.stringify(found)).not.toMatch(/someone|secret|\.env|hook/)
  })
})

describe("G5 / G6 — proofs of intent (production is pure-testable here; it is disabled in the program by a literal)", () => {
  const prod = analyze(PROD_URL)
  const staging = analyze(STAGING_URL)
  const lo = analyze(loopback())
  const idText = (a: { identity: Parameters<typeof formatIdentity>[0] }) => formatIdentity(a.identity)

  const base = (cls: "production" | "staging" | "bouclage", over: Partial<Parameters<typeof assessStaticProof>[0]> = {}) => {
    const t = cls === "production" ? prod : cls === "staging" ? staging : lo
    return {
      cls,
      identity: t.identity,
      expectIdentity: null,
      interactive: true,
      confirmProduction: false,
      confirmLoopback: false,
      allowProduction: undefined,
      allowLoopback: undefined,
      preloads: [],
      allowDefinedInFiles: [],
      ...over,
    } as Parameters<typeof assessStaticProof>[0]
  }
  const refused = (v: ReturnType<typeof assessStaticProof>) => {
    if (v.ok) throw new Error("expected a refusal")
    return v
  }

  it("T04 — staging needs the identity only (typed or --expect-identity), no ALLOW", () => {
    const typed = assessStaticProof(base("staging"))
    expect(typed.ok && typed.needsTypedProof).toBe(true)
    const declared = assessStaticProof(base("staging", { interactive: false, expectIdentity: idText(staging) }))
    expect(declared.ok && !declared.needsTypedProof).toBe(true)
  })

  it("T24/T25 — outside a terminal the proof is mandatory (2); a declared identity that differs by ONE component is exit 3", () => {
    const missing = refused(assessStaticProof(base("staging", { interactive: false })))
    expect([missing.exit, missing.key]).toEqual([EXIT.REFUSED, "proof_missing"])
    const id = staging.identity
    for (const [component, wrong] of [
      ["endpoint", { ...id, endpoint: `${id.endpoint}x` }],
      ["base", { ...id, database: "other" }],
      ["schéma", { ...id, schema: "public" }],
      ["fournisseur", { ...id, provider: "pg" as const, port: 5432 }],
    ] as const) {
      const v = refused(assessStaticProof(base("staging", { interactive: false, expectIdentity: formatIdentity(wrong as never) })))
      expect([v.exit, v.key], component).toEqual([EXIT.TARGET_UNPROVEN, "expect_identity_mismatch"])
      expect(v.message.includes(component)).toBe(true)
      expect(v.message.includes(id.endpoint)).toBe(false)
    }
    const malformed = refused(assessStaticProof(base("staging", { interactive: false, expectIdentity: "PROD" })))
    expect([malformed.exit, malformed.key]).toEqual([EXIT.TARGET_UNPROVEN, "expect_identity_malformed"])
  })

  it("A3 — same host, other port (non-Neon): not the declared identity", () => {
    const declared = formatIdentity({ ...lo.identity, port: 5434 })
    const v = refused(assessStaticProof(base("bouclage", { interactive: false, expectIdentity: declared, allowLoopback: idText(lo), confirmLoopback: true })))
    expect([v.exit, v.message.includes("port")]).toEqual([EXIT.TARGET_UNPROVEN, true])
  })

  it("T08/L2 — bouclage: ALLOW_LOOPBACK naming the identity + (outside a terminal) --confirm-loopback; a PRODUCTION allow does not count", () => {
    const ok = assessStaticProof(base("bouclage", { allowLoopback: idText(lo) }))
    expect(ok.ok && ok.needsTypedProof).toBe(true)
    const nonInteractive = { interactive: false, expectIdentity: idText(lo), allowLoopback: idText(lo) }
    expect(refused(assessStaticProof(base("bouclage", nonInteractive))).key).toBe("confirm_flag_missing")
    expect(assessStaticProof(base("bouclage", { ...nonInteractive, confirmLoopback: true })).ok).toBe(true)
    expect(refused(assessStaticProof(base("bouclage", { allowProduction: idText(lo) }))).key).toBe("allow_missing")
    expect(refused(assessStaticProof(base("bouclage", { confirmProduction: true }))).key).toBe("allow_missing")
  })

  it("T01/T25 — production: ALLOW (shell) naming the identity, plus --confirm-production outside a terminal; each missing piece is exit 2", () => {
    const full = { interactive: false, expectIdentity: idText(prod), allowProduction: idText(prod), confirmProduction: true }
    const ok = assessStaticProof(base("production", full))
    expect(ok.ok && !ok.needsTypedProof).toBe(true)
    expect(refused(assessStaticProof(base("production", { ...full, allowProduction: undefined }))).key).toBe("allow_missing")
    expect(refused(assessStaticProof(base("production", { ...full, confirmProduction: false }))).key).toBe("confirm_flag_missing")
    expect(refused(assessStaticProof(base("production", { ...full, allowProduction: "" }))).key).toBe("allow_missing")
    expect(assessStaticProof(base("production", { allowProduction: idText(prod) })).ok).toBe(true)
  })

  it("A1 — a historical endpoint-only ALLOW never authorises the seed (message: name the complete identity)", () => {
    const v = refused(assessStaticProof(base("production", { allowProduction: prod.identity.endpoint })))
    expect([v.exit, v.key]).toEqual([EXIT.REFUSED, "allow_legacy_endpoint_only"])
    expect(v.message.includes(prod.identity.endpoint)).toBe(false)
  })

  it("A2/A6 — the same endpoint with another base, port or schema, or the base in another case, is refused", () => {
    for (const wrong of [
      formatIdentity({ ...prod.identity, database: "otherdb" }),
      formatIdentity({ ...prod.identity, database: "RADARDB" }),
      formatIdentity({ ...prod.identity, schema: "public" }),
      formatIdentity({ ...lo.identity, port: 5434 }),
    ]) {
      expect(refused(assessStaticProof(base("production", { allowProduction: wrong }))).key).toBe("allow_not_naming_identity")
    }
    expect(assessStaticProof(base("production", { allowProduction: idText(prod).replace("neon:ep-", "NEON:EP-") })).ok).toBe(true)
  })

  it("A4/A5 — several tokens: one valid match is enough; malformed tokens are ignored, and refused if nothing valid remains", () => {
    const other = formatIdentity({ ...prod.identity, database: "otherdb" })
    const third = formatIdentity({ ...prod.identity, database: "thirddb" })
    expect(assessStaticProof(base("production", { allowProduction: `legacy-endpoint,${other},${idText(prod)}` })).ok).toBe(true)
    expect(refused(assessStaticProof(base("production", { allowProduction: `legacy-endpoint,${other},${third}` }))).key).toBe("allow_not_naming_identity")
    expect(assessStaticProof(base("production", { allowProduction: `!!!bad,${idText(prod)}` })).ok).toBe(true)
    const none = refused(assessStaticProof(base("production", { allowProduction: "!!!bad" })))
    expect(none.key).toBe("allow_not_naming_identity")
    expect(none.message).toContain("1 jeton")
  })

  it("an ALLOW written in an env file is refused even when the shell has a correct one (I10)", () => {
    const v = refused(
      assessStaticProof(base("bouclage", { allowLoopback: idText(lo), allowDefinedInFiles: [{ label: ".env.local", name: ALLOW_VARIABLES[1] }] }))
    )
    expect([v.exit, v.key]).toEqual([EXIT.REFUSED, "allow_defined_in_file"])
    expect(v.message).toContain(".env.local")
    // The other confirmation defined in a file does not block this class.
    expect(assessStaticProof(base("bouclage", { allowLoopback: idText(lo), allowDefinedInFiles: [{ label: ".env", name: ALLOW_VARIABLES[0] }] })).ok).toBe(true)
  })

  it("foreign preloads make an ALLOW unprovable (refused for bouclage and production) and only warn for staging", () => {
    const preloads = [{ flag: "--env-file", source: "execArgv" }]
    expect(refused(assessStaticProof(base("bouclage", { allowLoopback: idText(lo), preloads }))).key).toBe("foreign_preload")
    expect(refused(assessStaticProof(base("production", { allowProduction: idText(prod), preloads }))).key).toBe("foreign_preload")
    const staged = assessStaticProof(base("staging", { preloads }))
    expect(staged.ok && staged.warnings.length === 1 && staged.warnings[0].includes("--env-file")).toBe(true)
  })

  it("no verdict or message ever contains the endpoint, the base or a token", () => {
    const cases = [
      assessStaticProof(base("staging", { interactive: false })),
      assessStaticProof(base("production", { allowProduction: "x" })),
      assessStaticProof(base("production", { allowProduction: prod.identity.endpoint })),
      assessStaticProof(base("production", { allowProduction: formatIdentity({ ...prod.identity, database: "otherdb" }) })),
      assessStaticProof(base("staging", { interactive: false, expectIdentity: formatIdentity({ ...staging.identity, database: "otherdb" }) })),
    ]
    for (const v of cases) {
      if (v.ok) continue
      expect(v.message.includes(prod.identity.endpoint) || v.message.includes(staging.identity.endpoint) || v.message.includes("otherdb")).toBe(false)
    }
  })

  describe("assessTypedProof — `<CLASS> <complete identity>`", () => {
    it("accepts the exact phrase of each class, tolerates surrounding blanks", () => {
      expect(assessTypedProof({ identity: staging.identity, cls: "staging", typed: `STAGING ${idText(staging)}` }).ok).toBe(true)
      expect(assessTypedProof({ identity: lo.identity, cls: "bouclage", typed: `  BOUCLAGE ${idText(lo)}  ` }).ok).toBe(true)
      expect(assessTypedProof({ identity: prod.identity, cls: "production", typed: `PRODUCTION ${idText(prod)}` }).ok).toBe(true)
    })

    it("T02 — `PROD`, the wrong class, no identity, a lower-case class or an identity off by one component: exit 2", () => {
      const typed = (cls: "production" | "staging" | "bouclage", t: string, identity = (cls === "production" ? prod : cls === "staging" ? staging : lo).identity) =>
        assessTypedProof({ identity, cls, typed: t })
      for (const v of [
        typed("production", "PROD"),
        typed("production", "PRODUCTION"),
        typed("production", `STAGING ${idText(prod)}`),
        typed("production", `production ${idText(prod)}`),
        typed("staging", `STAGING ${formatIdentity({ ...staging.identity, database: "otherdb" })}`),
        typed("staging", `STAGING ${formatIdentity({ ...staging.identity, schema: "public" })}`),
        typed("bouclage", `BOUCLAGE ${formatIdentity({ ...lo.identity, port: 5434 })}`),
        typed("bouclage", `BOUCLAGE ${formatIdentity({ ...lo.identity, endpoint: "127.0.0.1" })}`),
        typed("staging", ""),
      ]) {
        expect(v.ok).toBe(false)
        if (!v.ok) expect([v.exit, v.key]).toEqual([EXIT.REFUSED, "typed_mismatch"])
      }
      const off = typed("bouclage", `BOUCLAGE ${formatIdentity({ ...lo.identity, port: 5434 })}`)
      if (!off.ok) expect(off.message).toContain("port")
    })
  })

  it("CLASS_LABEL is what the operator types", () => {
    expect(CLASS_LABEL).toEqual({ production: "PRODUCTION", staging: "STAGING", bouclage: "BOUCLAGE" })
  })
})

describe("honest results — a database error is classified by its Prisma CODE, never by its text", () => {
  it("P2021 → schema_absent, P2022 → schema_outdated, P1000-P1019 and initialisation errors → connection", () => {
    expect(classifySeedError({ code: "P2021" })).toEqual({ key: "schema_absent", code: "P2021" })
    expect(classifySeedError({ code: "P2022" })).toEqual({ key: "schema_outdated", code: "P2022" })
    for (const code of ["P1000", "P1001", "P1002", "P1008", "P1017"]) expect(classifySeedError({ code }).key, code).toBe("connection")
    expect(classifySeedError({ name: "PrismaClientInitializationError", errorCode: "P1001" })).toEqual({ key: "connection", code: "P1001" })
    expect(classifySeedError({ name: "PrismaClientInitializationError" }).key).toBe("connection")
  })

  it("T30 — a message that merely CONTAINS a model name or 'does not exist' is a database_error, never 'schema absent' (the old regex exited 0)", () => {
    const err = new Error("Invalid `prisma.radarCountry.count()` invocation: relation RadarCountry does not exist (host ep-x.invalid)")
    expect(classifySeedError(err)).toEqual({ key: "database_error", code: null })
    for (const odd of [null, undefined, "boom", 42, {}, { code: 12 }, { code: "ECONNRESET" }]) expect(classifySeedError(odd).key).toBe("database_error")
  })

  it("the result never carries the message of the error", () => {
    const out = classifySeedError(Object.assign(new Error(`secret host ${PASSWORD}`), { code: "P1001" }))
    expect(JSON.stringify(out).includes(PASSWORD)).toBe(false)
  })

  it("the last line is machine readable and constant: result, exit, then the state", () => {
    expect(formatFinalLine("schema_absent", 4, STATE.FAILED_BEFORE_WRITE)).toBe("[seed-world-radar] result=schema_absent exit=4 state=failed_before_write")
    expect(EXIT).toEqual({ OK: 0, CONFIG: 1, REFUSED: 2, TARGET_UNPROVEN: 3, SEED_FAILED: 4, VERIFY_FAILED: 5, EXECUTED_UNVERIFIED: 6, INTERRUPTED: 130 })
    expect(STATE).toEqual({
      REFUSED: "refused",
      FAILED_BEFORE_WRITE: "failed_before_write",
      EXECUTED_UNVERIFIED: "executed_unverified",
      VERIFIED: "verified",
      INDETERMINATE: "indeterminate",
    })
    expect(formatFinalLine("x", 6, STATE.EXECUTED_UNVERIFIED)).toMatch(/^\[seed-world-radar\] result=\w+ exit=\d+ state=[a-z_]+$/)
  })

  it("C5 — the state comes from what happened, never from the exit code alone (exit 4 and exit 1 each cover two states)", () => {
    const state = (clientBuilt: boolean, writeStarted: boolean, exit: number) => deriveState({ clientBuilt, writeStarted, exit })
    // nothing created: refused, whatever the code (1, 2, 3, 130)
    for (const exit of [1, 2, 3, 130]) expect(state(false, false, exit), `exit ${exit}`).toBe(STATE.REFUSED)
    // a client and a connection attempt, but no write issued
    expect(state(true, false, 4)).toBe(STATE.FAILED_BEFORE_WRITE)
    expect(state(true, false, 1)).toBe(STATE.FAILED_BEFORE_WRITE)
    // a write may have been issued: whatever failed, the outcome is not known
    expect(state(true, true, 4)).toBe(STATE.INDETERMINATE)
    expect(state(true, true, 1)).toBe(STATE.INDETERMINATE)
    // code 6 is "written, not verified"; code 0 is the only way to say "verified"
    expect(state(true, true, 6)).toBe(STATE.EXECUTED_UNVERIFIED)
    expect(state(true, true, 0)).toBe(STATE.VERIFIED)
  })
})

describe("the entry snapshot — the only reader of process.env", () => {
  const saved = { env: { ...process.env }, argv: process.argv, execArgv: process.execArgv }
  afterEach(() => {
    for (const name of [...TARGET_VARIABLES, ...ALLOW_VARIABLES, ...GUARDED_VARIABLES, "NODE_OPTIONS", "SOME_OTHER_SECRET"]) {
      if (saved.env[name] === undefined) delete process.env[name]
      else process.env[name] = saved.env[name]
    }
    Object.defineProperty(process, "argv", { value: saved.argv, configurable: true, writable: true })
    Object.defineProperty(process, "execArgv", { value: saved.execArgv, configurable: true, writable: true })
  })

  it("keeps ONLY the six authority variables and NODE_OPTIONS, frozen, and later changes do not alter it", () => {
    process.env.RADAR_DATABASE_URL = "postgresql://a:b@radar-host.invalid:5432/r"
    process.env.AFFISELL_ALLOW_LOOPBACK_WRITES = "pg:localhost:5433/radar#market_intelli"
    process.env.SOME_OTHER_SECRET = "must-not-be-kept"
    process.env.DOTENV_KEY = "dotenv://:key_must-not-be-kept@dotenvx.com/vault/.env.vault"
    process.env.NODE_OPTIONS = "--max-old-space-size=4096"
    Object.defineProperty(process, "argv", { value: ["node", "seed", "--countries=FR"], configurable: true, writable: true })
    Object.defineProperty(process, "execArgv", { value: ["--conditions=node"], configurable: true, writable: true })
    captureEntrySnapshot()
    const snap = readEntrySnapshot()
    expect(Object.keys(snap.env).sort()).toEqual([...TARGET_VARIABLES, ...ALLOW_VARIABLES].sort())
    expect(JSON.stringify(snap).includes("must-not-be-kept")).toBe(false)
    // The guarded names (D5 / D6) are kept as BOOLEANS: presence only, never a value (DOTENV_KEY is a decryption secret).
    expect(Object.keys(snap.guarded).sort()).toEqual([...GUARDED_VARIABLES].sort())
    expect(snap.guarded.DOTENV_KEY).toBe(true)
    expect(snap.guarded.PRISMA_QUERY_ENGINE_LIBRARY).toBe(false)
    expect(Object.values(snap.guarded).every((v) => typeof v === "boolean")).toBe(true)
    expect(Object.isFrozen(snap.guarded)).toBe(true)
    expect(snap.nodeOptions).toBe("--max-old-space-size=4096")
    expect([...snap.execArgv]).toEqual(["--conditions=node"])
    expect([...snap.argv]).toEqual(["--countries=FR"])
    expect(Object.isFrozen(snap) && Object.isFrozen(snap.env) && Object.isFrozen(snap.argv) && Object.isFrozen(snap.execArgv)).toBe(true)

    process.env.RADAR_DATABASE_URL = "postgresql://changed:later@other.invalid:5432/x"
    delete process.env.DOTENV_KEY
    process.argv.push("--force")
    expect(readEntrySnapshot().guarded.DOTENV_KEY).toBe(true)
    expect(readEntrySnapshot().env.RADAR_DATABASE_URL).toBe("postgresql://a:b@radar-host.invalid:5432/r")
    expect([...readEntrySnapshot().argv]).toEqual(["--countries=FR"])
  })

  it("a fresh module that was never bootstrapped refuses to hand anything out", async () => {
    vi.resetModules()
    const fresh = await import("../../scripts/lib/radar-entry-snapshot.mjs")
    expect(() => fresh.readEntrySnapshot()).toThrow("entry_not_bootstrapped")
  })
})

describe("env files — read in memory, never applied, never printed", () => {
  const dirs: string[] = []
  afterEach(() => {
    for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true })
  })
  const repo = (files: Record<string, string>) => {
    const dir = mkdtempSync(join(tmpdir(), "radar-sources-"))
    dirs.push(dir)
    for (const [name, content] of Object.entries(files)) writeFileSync(join(dir, name), content)
    return dir
  }

  it("keeps only the four target variables of `.env.local` and `.env`, in precedence order, and does not touch process.env", () => {
    const before = JSON.stringify(Object.entries(process.env).sort())
    const dir = repo({
      ".env.local": `DATABASE_URL="postgresql://u:${PASSWORD}@local-file.invalid:5432/l"\nOTHER_SECRET=do-not-keep\nAFFISELL_ALLOW_LOOPBACK_WRITES=x\n`,
      ".env": `# AFFISELL_ALLOW_PRODUCTION_WRITES=commented-out\nRADAR_DATABASE_URL=\nexport DATABASE_URL_UNPOOLED=postgresql://u:p@unpooled-file.invalid:5432/u\n`,
    })
    const sources = readRadarSources(dir)
    expect(sources.unreadable).toEqual([])
    expect(sources.files.map((f) => f.label)).toEqual([".env.local", ".env"])
    const [local, dotenv] = sources.files
    expect(Object.keys(local.values)).toEqual(["DATABASE_URL"])
    expect(local.allowNames).toEqual([ALLOW_VARIABLES[1]])
    expect(JSON.stringify(sources).includes("do-not-keep")).toBe(false)
    expect(dotenv.values).toEqual({ RADAR_DATABASE_URL: "", DATABASE_URL_UNPOOLED: "postgresql://u:p@unpooled-file.invalid:5432/u" })
    expect(dotenv.allowNames).toEqual([])
    expect(JSON.stringify(Object.entries(process.env).sort())).toBe(before)
  })

  it(".env.pre-local-merge.bak is NOT a source: only the NAMES of its target variables are reported", () => {
    const dir = repo({ ".env.pre-local-merge.bak": `DATABASE_URL=postgresql://u:${PASSWORD}@bak.invalid:5432/b\nAFFISELL_ALLOW_PRODUCTION_WRITES=whatever\n` })
    const [bak] = readRadarSources(dir).files
    expect(bak.resolution).toBe(false)
    expect(bak.values).toEqual({})
    expect(bak.definedTargetNames).toEqual(["DATABASE_URL"])
    expect(bak.allowNames).toEqual([ALLOW_VARIABLES[0]])
    expect(JSON.stringify(bak).includes(PASSWORD)).toBe(false)
  })

  it("an existing file that cannot be read is reported (the program stops: the target cannot be proven)", () => {
    const dir = repo({})
    mkdirSync(join(dir, ".env"))
    expect(readRadarSources(dir).unreadable).toEqual([".env"])
  })

  it("a machine without any env file yields no source at all", () => {
    expect(readRadarSources(repo({}))).toEqual({ files: [], unreadable: [] })
  })

  it("feeds the resolver: shell beats .env.local beats .env, per variable", () => {
    const dir = repo({
      ".env.local": "DATABASE_URL=postgresql://l:p@local-file.invalid:5432/l\n",
      ".env": "DATABASE_URL=postgresql://e:p@dotenv-file.invalid:5432/e\nDATABASE_URL_UNPOOLED=postgresql://u:p@unpooled-file.invalid:5432/u\n",
    })
    const files = readRadarSources(dir).files.filter((f) => f.resolution).map((f) => ({ label: f.label, values: f.values }))
    const verdict = resolveTarget({ shell: {}, files })
    // U beats D whatever the source: the application's order is R > M > U > D.
    expect(verdict.ok && verdict.variable === "DATABASE_URL_UNPOOLED" && verdict.source === ".env").toBe(true)
  })
})

/* ======================================================================================================================== */
/* C1 — the URL grammar, the closed list of parameters, ONE parser, and an oracle of what the engine would connect to       */
/* ======================================================================================================================== */

describe("C1 — strict URL grammar: refusals (hostile table), each with exit 3 and no value in the message", () => {
  const BASE = STAGING_URL
  const refusedKey = (url: string) => {
    const v = analyzeTargetUrl(url)
    if (v.ok) return `ACCEPTED(${v.cls})`
    expect(v.exit).toBe(EXIT.TARGET_UNPROVEN)
    expect(v.message.includes(PASSWORD) || v.message.includes(USER) || v.message.includes("SENTINEL")).toBe(false)
    return v.key
  }
  const table: Array<[string, string, string]> = [
    // `host` changes WHERE the engine connects (it wins over the URL's own host) — refused in every spelling, before anything else
    ["host parameter", `${BASE}&host=127.0.0.1`, "url_param_destination"],
    ["host parameter, upper case", `${BASE}&HOST=127.0.0.1`, "url_param_destination"],
    ["host parameter, percent-encoded key", `${BASE}&%68ost=127.0.0.1`, "url_param_destination"],
    ["host parameter, no value", `${BASE}&host`, "url_param_destination"],
    ["host parameter, empty value", `${BASE}&host=`, "url_param_destination"],
    ["host parameter, a unix socket", `${BASE}&host=%2Ftmp`, "url_param_destination"],
    ["host parameter, duplicated", `${BASE}&host=a.invalid&host=b.invalid`, "url_param_destination"],
    ["hostaddr", `${BASE}&hostaddr=127.0.0.1`, "url_param_destination"],
    ["port", `${BASE}&port=5433`, "url_param_destination"],
    ["dbname", `${BASE}&dbname=other`, "url_param_destination"],
    ["service", `${BASE}&service=x`, "url_param_destination"],
    ["user", `${BASE}&user=x`, "url_param_destination"],
    ["password", `${BASE}&password=x`, "url_param_destination"],
    // duplicates: the engine keeps the LAST one, `searchParams.get` the first
    ["duplicated sslmode", `${BASE}&sslmode=require`, "url_param_duplicate"],
    ["duplicated channel_binding", `${BASE}&channel_binding=require`, "url_param_duplicate"],
    // the closed list: everything else is refused, including what the repository's own tools add or the engine understands
    ["connect_timeout", `${BASE}&connect_timeout=60`, "url_param_not_allowed"],
    ["pool_timeout", `${BASE}&pool_timeout=10`, "url_param_not_allowed"],
    ["socket_timeout", `${BASE}&socket_timeout=10`, "url_param_not_allowed"],
    ["connection_limit", `${BASE}&connection_limit=1`, "url_param_not_allowed"],
    ["pgbouncer", `${BASE}&pgbouncer=true`, "url_param_not_allowed"],
    ["schema (even the Radar schema)", `${BASE}&schema=${RADAR_SCHEMA}`, "url_param_not_allowed"],
    ["options", `${BASE}&options=-c%20role%3Dx`, "url_param_not_allowed"],
    ["sslaccept", `${BASE}&sslaccept=accept_invalid_certs`, "url_param_not_allowed"],
    ["sslcert", `${BASE}&sslcert=/x`, "url_param_not_allowed"],
    ["application_name", `${BASE}&application_name=x`, "url_param_not_allowed"],
    ["statement_cache_size", `${BASE}&statement_cache_size=0`, "url_param_not_allowed"],
    ["an unknown parameter", `${BASE}&anything=1`, "url_param_not_allowed"],
    ["an empty parameter name", `${BASE}&=x`, "url_param_not_allowed"],
    // values are compared EXACTLY, on the decoded value
    ["sslmode=prefer", BASE.replace("sslmode=require", "sslmode=prefer"), "url_param_value"],
    ["sslmode=REQUIRE", BASE.replace("sslmode=require", "sslmode=REQUIRE"), "url_param_value"],
    ["sslmode=verify-full (the engine ignores it silently)", BASE.replace("sslmode=require", "sslmode=verify-full"), "url_param_value"],
    ["sslmode with a trailing blank", BASE.replace("sslmode=require", "sslmode=require%20"), "url_param_value"],
    ["sslmode empty", BASE.replace("sslmode=require", "sslmode="), "url_param_value"],
    ["channel_binding=prefer", BASE.replace("channel_binding=require", "channel_binding=prefer"), "url_param_value"],
    ["channel_binding=disable", BASE.replace("channel_binding=require", "channel_binding=disable"), "url_param_value"],
    // sslmode=require is MANDATORY on a Neon host
    ["Neon without sslmode", neon(STAGING_MARK, "zz000000", { query: "?channel_binding=require" }), "url_sslmode_required"],
    ["Neon without any parameter", neon(STAGING_MARK, "zz000000", { query: "" }), "url_sslmode_required"],
    // fragment, control characters, scheme, '@'
    ["a fragment", `${BASE}#frag`, "url_fragment"],
    ["an empty fragment", `${BASE}#`, "url_fragment"],
    ["a newline inside the string", BASE.replace("/radardb", "/rad\nardb"), "url_control_characters"],
    ["a tab inside the string", BASE.replace("?sslmode", "?ssl\tmode"), "url_control_characters"],
    ["an upper-case scheme", BASE.replace("postgresql://", "POSTGRESQL://"), "url_not_postgres"],
    ["another scheme", "mysql://u:p@host.invalid:3306/db", "url_not_postgres"],
    ["no `//` after the scheme", "postgresql:u:p@host.invalid/db", "url_not_postgres"],
    ["two '@' (unencoded '@' in a password)", BASE.replace(PASSWORD, "pass@word"), "url_at_sign"],
    ["an '@' in the query after the credentials", `${BASE}&x=@${PROD_MARK}-1.neon.tech`, "url_at_sign"],
    // host grammar and the Neon endpoint shape
    ["a trailing dot", loopback("localhost."), "url_host_invalid"],
    ["an empty label", neon(STAGING_MARK).replace(".c-3.", "..c-3."), "url_host_invalid"],
    ["a comma host (multi-host syntax)", loopback("a.invalid,b.invalid"), "url_host_invalid"],
    ["a percent-encoded host", loopback("a%2Eb.invalid"), "url_host_invalid"],
    ["an underscore in the host", loopback("my_host.invalid"), "url_host_invalid"],
    ["a label starting with a hyphen", loopback("-a.invalid"), "url_host_invalid"],
    ["a Neon host whose first label is not an endpoint id", `postgresql://u:p@${STAGING_MARK}-x.neon.tech/radardb?sslmode=require`, "url_neon_endpoint_shape"],
    ["a Neon host with a marker only in a LATER label", `postgresql://u:p@ep-unlisted-1.${STAGING_MARK}.aws.neon.tech/radardb?sslmode=require`, "url_parser_disagreement"],
    ["a production label with a staging marker in a later label", `postgresql://u:p@ep-${PROD_MARK}-1.${STAGING_MARK}.aws.neon.tech/radardb?sslmode=require`, "url_parser_disagreement"],
    ["a Neon port other than 5432", neon(STAGING_MARK, "zz000000", { port: ":5433" }), "url_neon_port"],
    // database name: the RAW path segment
    ["an encoded database name", loopback("localhost", "5433", "my%20db"), "url_database_invalid"],
    ["a database name with a second path segment", loopback("localhost", "5433", "a/b"), "url_database_invalid"],
    ["a 64-character database name", loopback("localhost", "5433", "x".repeat(64)), "url_database_invalid"],
    ["no database", `postgresql://${USER}:${PASSWORD}@localhost:5433/`, "url_no_database"],
  ]

  it.each(table)("%s → %s", (_name, url, key) => {
    expect(refusedKey(url)).toBe(key)
  })

  it("the shared classifier's regex is fooled by an '@' in the query (the finding) — and the URL that would exploit it is refused anyway", () => {
    const crafted = `postgresql://ep-${PROD_MARK}-1.c-3.aws.neon.tech/radardb?sslmode=require&x=@ep-${STAGING_MARK}-1.neon.tech`
    // [FAIT] the shared helper takes the host after the FIRST '@' of the whole string, query included: it says "staging" here.
    expect(classifyDatabaseUrl(crafted).branch).toBe("staging")
    // The URL's real host (the production one) is what the identity carries; the seed refuses the shape before any class is used.
    expect(refusedKey(crafted)).not.toMatch(/^ACCEPTED/)
  })

  it("a legitimate URL is accepted in each of its forms: pooled, direct, with or without channel_binding, loopback without a query", () => {
    for (const [url, cls] of [
      [PROD_URL, "production"],
      [STAGING_URL, "staging"],
      [UNKNOWN_NEON_URL, "unknown"],
      [neon(STAGING_MARK, "zz000000", { query: "?sslmode=require" }), "staging"],
      [`postgresql://${USER}:${PASSWORD}@ep-${STAGING_MARK}-zz000000.c-3.eu-central-1.aws.neon.tech:5432/radardb?channel_binding=require&sslmode=require`, "staging"],
      [loopback("localhost"), "bouclage"],
      [loopback("[::1]"), "bouclage"],
    ] as const) {
      const v = analyzeTargetUrl(url)
      expect(v.ok && v.cls === cls, `${cls}`).toBe(true)
    }
  })

  it("the class comes from the FIRST LABEL: the same marker in the first label is what counts, and the endpoint is that label", () => {
    const a = analyze(neon(STAGING_MARK))
    expect(a.cls).toBe("staging")
    expect(a.identity.endpoint).toBe(`ep-${STAGING_MARK}-zz000000`)
    expect(a.identity.endpoint.endsWith("-pooler")).toBe(false)
  })
})
describe("C1 — identity == what the engine would connect to (a test-side oracle of quaint's url.rs)", () => {
  /**
   * What the installed engine connects to, as quaint reads it (url.rs at the commit of the installed engine): the `host` query
   * parameter wins over the URL's host; the LAST duplicate of a known parameter wins; an unknown one is discarded; the database is the
   * first path segment WITHOUT decoding; the port defaults to 5432; an IPv6 host loses its brackets.
   * This pins OUR grammar and quaint's semantics — it is not the Rust URL parser, which cannot be run here.
   */
  function engineView(raw: string) {
    const url = new URL(raw)
    let hostParam: string | undefined
    for (const [name, value] of url.searchParams) if (name === "host") hostParam = value
    const authority = url.hostname.startsWith("[") ? url.hostname.slice(1, -1) : url.hostname
    return {
      host: hostParam !== undefined ? hostParam : authority === "" ? "localhost" : authority,
      port: url.port === "" ? 5432 : Number(url.port),
      database: url.pathname.split("/").filter(Boolean)[0] ?? "postgres",
    }
  }
  /** Does the verdict agree with the engine's view of the same string? (The property under test.) */
  function agrees(raw: string, verdict: ReturnType<typeof analyzeTargetUrl>): boolean {
    if (!verdict.ok) return true // refused: nothing is connected to
    const view = engineView(raw)
    const id = verdict.identity
    const host = view.host.toLowerCase()
    const sameHost = id.provider === "neon" ? normalizeEndpoint(host.split(".")[0]) === id.endpoint : (id.endpoint.startsWith("[") ? id.endpoint.slice(1, -1) : id.endpoint) === host
    const samePort = id.provider === "neon" ? view.port === 5432 : view.port === id.port
    return sameHost && samePort && view.database === id.database
  }

  const HOSTS = [
    `ep-${STAGING_MARK}-zz000000-pooler.c-3.eu-central-1.aws.neon.tech`,
    `ep-${PROD_MARK}-zz000000.c-3.eu-central-1.aws.neon.tech`,
    "ep-unlisted-zz000000.c-3.aws.neon.tech",
    "localhost",
    "LOCALHOST",
    "127.0.0.1",
    "[::1]",
    "db.example.invalid",
    "0x7f.1",
  ]
  const PORTS = ["", ":5432", ":5433", ":5434"]
  const DBS = ["radar", "Radar_db-1", "a.b", "my%20db", "a%2Fb", ""]
  const QUERIES = ["", "?sslmode=require", "?sslmode=require&channel_binding=require", "?sslmode=require&host=127.0.0.1", "?host=%2Ftmp&sslmode=require", "?sslmode=require&host=a.invalid&host=b.invalid", "?sslmode=prefer", "?HOST=x&sslmode=require", "?sslmode=require&hostaddr=127.0.0.1"]

  it("over a combinatorial corpus, whatever the seed accepts is exactly what the engine would reach (host, port, database)", () => {
    let accepted = 0
    let refused = 0
    let withHostParam = 0
    for (const host of HOSTS) for (const port of PORTS) for (const db of DBS) for (const query of QUERIES) {
      const raw = `postgresql://${USER}:${PASSWORD}@${host}${port}/${db}${query}`
      const verdict = analyzeTargetUrl(raw)
      if (/[?&]host=/i.test(query)) withHostParam += 1
      expect(agrees(raw, verdict), raw.replace(PASSWORD, "***")).toBe(true)
      if (verdict.ok) accepted += 1
      else refused += 1
    }
    // The corpus is not vacuous: it contains accepted URLs, refused URLs and `host` parameters, and every `host` one was refused.
    expect(accepted).toBeGreaterThan(40)
    expect(refused).toBeGreaterThan(400)
    expect(withHostParam).toBeGreaterThan(100)
  })

  it("MUTATION CANARY — the oracle can fail: a verdict that accepted a `host` parameter would disagree with the engine", () => {
    const raw = `${STAGING_URL}&host=127.0.0.1`
    const lie = { ok: true as const, identity: analyze(STAGING_URL).identity, cls: "staging" as const }
    expect(agrees(raw, lie)).toBe(false)
    expect(agrees(raw, analyzeTargetUrl(raw))).toBe(true)
    // …and a last-duplicate one
    const duplicated = `${loopback("localhost", "5433", "radar")}?host=localhost&host=other.invalid`
    expect(agrees(duplicated, { ok: true, identity: analyze(loopback("localhost", "5433", "radar")).identity, cls: "bouclage" })).toBe(false)
  })
})

/* ======================================================================================================================== */
/* C3a — environment sources the seed has not examined (D5 / D6), and the generated client's env paths (G9b)                 */
/* ======================================================================================================================== */

describe("D5 / D6 — environment sources the seed has not examined are refused, by NAME", () => {
  const ok = { guarded: {}, preloads: [], existing: [], definedInFiles: [] }
  const refuse = (over: Partial<Parameters<typeof assessEnvSources>[0]>) => {
    const v = assessEnvSources({ ...ok, ...over } as Parameters<typeof assessEnvSources>[0])
    if (v.ok) throw new Error("expected a refusal")
    return v
  }

  it("nothing to report: accepted", () => {
    expect(assessEnvSources(ok as never)).toEqual({ ok: true })
    expect(assessEnvSources({ ...ok, guarded: Object.fromEntries(GUARDED_VARIABLES.map((n) => [n, false])) } as never).ok).toBe(true)
  })

  it("a foreign preload / --env-file is exit 2, ahead of everything else", () => {
    const v = refuse({ preloads: [{ flag: "--env-file", source: "execArgv" }], existing: ["prisma/.env"] })
    expect([v.exit, v.key]).toEqual([EXIT.REFUSED, "foreign_preload"])
    expect(v.message).toContain("--env-file dans execArgv")
  })

  it("`prisma/.env`, `.env.vault`, DOTENV_KEY (shell or file) are exit 3 `unexamined_env_source`, named, never valued", () => {
    for (const over of [
      { existing: ["prisma/.env"] },
      { existing: [".env.vault"] },
      { guarded: { DOTENV_KEY: true } },
      { definedInFiles: [{ label: ".env", name: "DOTENV_KEY" }] },
    ]) {
      const v = refuse(over)
      expect([v.exit, v.key]).toEqual([EXIT.TARGET_UNPROVEN, "unexamined_env_source"])
    }
    expect(refuse({ existing: ["prisma/.env", ".env.vault"], guarded: { DOTENV_KEY: true } }).message).toMatch(/prisma\/\.env.*\.env\.vault.*DOTENV_KEY/)
  })

  it("each variable that changes the code or the engine is exit 3 `engine_override_variable`; DOTENV_KEY is not one of them", () => {
    expect(ENGINE_VARIABLES).toEqual(["PRISMA_QUERY_ENGINE_LIBRARY", "PRISMA_QUERY_ENGINE_BINARY", "PRISMA_CLIENT_ENGINE_TYPE", "DYLD_INSERT_LIBRARIES", "LD_PRELOAD"])
    for (const name of ENGINE_VARIABLES) {
      for (const over of [{ guarded: { [name]: true } }, { definedInFiles: [{ label: ".env.local", name }] }]) {
        const v = refuse(over)
        expect([v.exit, v.key], name).toEqual([EXIT.TARGET_UNPROVEN, "engine_override_variable"])
        expect(v.message).toContain(name)
      }
    }
  })

  it("a name that is not guarded is nobody's business", () => {
    expect(assessEnvSources({ ...ok, definedInFiles: [{ label: ".env", name: "SOMETHING_ELSE" }], guarded: { SOMETHING_ELSE: true } } as never).ok).toBe(true)
  })
})

describe("G9b — the generated client's `relativeEnvPaths`, read as TEXT before the module is required", () => {
  const DIR = "/work/repo/node_modules/.prisma/client-mi"
  const DS = `"datasourceNames": ["db"], "inlineDatasources": { "db": { "url": { "fromEnvVar": "RADAR_DATABASE_URL", "value": null } } }`
  const read = (text: string, over: Record<string, unknown> = {}) => ({ ok: true, text, clientDir: DIR, expectedClientDir: DIR, repoRoot: "/work/repo", schemaBeside: true, ...over })
  const refusal = (v: ReturnType<typeof assessEnvLoadPaths>) => {
    if (v.ok) throw new Error("expected a refusal")
    return v
  }

  it("accepts: no env path at all, or exactly <repo>/.env (the shape Prisma 6.19 writes)", () => {
    expect(assessEnvLoadPaths(read(`"relativeEnvPaths": { "rootEnvPath": null, "schemaEnvPath": null }, ${DS}`)).ok).toBe(true)
    expect(assessEnvLoadPaths(read(`"relativeEnvPaths": {\n "rootEnvPath": null,\n "schemaEnvPath": "../../../.env"\n }, ${DS}`)).ok).toBe(true)
    expect(assessEnvLoadPaths(read(`"relativeEnvPaths": { "rootEnvPath": "../../../.env", "schemaEnvPath": "../../../.env" }, ${DS}`)).ok).toBe(true)
  })

  it("refuses, with a constant label and never a path: another env file, outside the repository, another folder, garbage, no schema beside", () => {
    for (const [text, over, label] of [
      [`"relativeEnvPaths": { "rootEnvPath": null, "schemaEnvPath": "../../../prisma/.env" }, ${DS}`, {}, "fichier d'environnement étranger"],
      [`"relativeEnvPaths": { "rootEnvPath": "../../../../x/.env", "schemaEnvPath": null }, ${DS}`, {}, "fichier d'environnement étranger"],
      [`"relativeEnvPaths": { "rootEnvPath": null, "schemaEnvPath": "/etc/passwd" }, ${DS}`, {}, "fichier d'environnement étranger"],
      [`"relativeEnvPaths": { "rootEnvPath": null, "schemaEnvPath": null }, ${DS}`, { clientDir: "/work/repo/node_modules/.prisma/client" }, "dossier du client inattendu"],
      [`"relativeEnvPaths": { "rootEnvPath": null, "schemaEnvPath": null }, ${DS}`, { schemaBeside: false }, "schema.prisma absent"],
      ["nothing here", {}, "configuration introuvable"],
      [`"relativeEnvPaths": { "rootEnvPath": 3, "schemaEnvPath": null }, ${DS}`, {}, "forme inattendue"],
      [`"relativeEnvPaths": { "rootEnvPath": null, "schemaEnvPath": null }, "datasourceNames": ["db"], "inlineDatasources": { "db": { "url": { "fromEnvVar": "DATABASE_URL", "value": null } } }`, {}, "source de l'URL inattendue"],
      [`"relativeEnvPaths": { "rootEnvPath": null, "schemaEnvPath": null }, "datasourceNames": ["db"], "inlineDatasources": { "db": { "url": { "fromEnvVar": "RADAR_DATABASE_URL", "value": "x" } } }`, {}, "source de l'URL inattendue"],
      [`"relativeEnvPaths": { "rootEnvPath": null, "schemaEnvPath": null }, "datasourceNames": ["db", "other"], ${DS.split(",").slice(1).join(",")}`, {}, "source de l'URL inattendue"],
    ] as const) {
      const v = refusal(assessEnvLoadPaths(read(text, over)))
      expect([v.exit, v.key]).toEqual([EXIT.TARGET_UNPROVEN, "client_env_paths_unproven"])
      expect(v.message, label).toContain(label)
      expect(v.message.includes("/work") || v.message.includes("/etc")).toBe(false)
    }
  })

  it("an unreadable or incomplete read is data, not an exception", () => {
    for (const input of [{ ok: false }, null, undefined, { ok: true }, { ok: true, text: "x" }]) {
      expect(refusal(assessEnvLoadPaths(input as never)).key).toBe("client_env_paths_unproven")
    }
  })

  it("`..` segments are resolved: a path that climbs out and back in is still <repo>/.env", () => {
    expect(assessEnvLoadPaths(read(`"relativeEnvPaths": { "rootEnvPath": null, "schemaEnvPath": "../../../node_modules/../.env" }, ${DS}`)).ok).toBe(true)
  })
})

describe("the I/O side of C3 — which other env files exist, and the generated client's text (real files in a temp directory)", () => {
  const dirs: string[] = []
  afterEach(() => {
    for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true })
  })
  const repo = (files: Record<string, string>) => {
    const dir = mkdtempSync(join(tmpdir(), "radar-surface-"))
    dirs.push(dir)
    for (const [name, content] of Object.entries(files)) {
      mkdirSync(join(dir, name, ".."), { recursive: true })
      writeFileSync(join(dir, name), content)
    }
    return dir
  }

  it("reports `prisma/.env` and `.env.vault` as existing, and names the `.env.*` files that are not read (templates excluded)", () => {
    const dir = repo({
      "prisma/.env": "SECRET=never-read",
      ".env.vault": "x",
      ".env": "A=1",
      ".env.local": "A=1",
      ".env.pre-local-merge.bak": "A=1",
      ".env.test.local": "A=1",
      ".env.vercel.production": "A=1",
      ".env.example": "A=1",
      ".env.local.radar.template": "A=1",
      "notes.txt": "x",
    })
    const surface = inspectEnvSurface(dir)
    expect(surface.existing).toEqual(["prisma/.env", ".env.vault"])
    expect(surface.unreadEnvFiles).toEqual([".env.test.local", ".env.vercel.production"])
    expect(JSON.stringify(surface).includes("never-read")).toBe(false)
    expect(inspectEnvSurface(repo({}))).toEqual({ existing: [], unreadEnvFiles: [] })
    expect(inspectEnvSurface(join(dir, "does-not-exist"))).toEqual({ existing: [], unreadEnvFiles: [] })
  })

  it("keeps the NAMES of the guarded variables of the two real sources, never a value; the backup is not a source", () => {
    const dir = repo({
      ".env": "DOTENV_KEY=dotenv://:key_must-not-be-kept@x\nPRISMA_QUERY_ENGINE_LIBRARY=/x/engine.node\n# LD_PRELOAD=commented-out\nOTHER=1\n",
      ".env.local": "export DYLD_INSERT_LIBRARIES=/x/lib.dylib\n",
      ".env.pre-local-merge.bak": "DOTENV_KEY=also-must-not-be-kept\n",
    })
    const files = Object.fromEntries(readRadarSources(dir).files.map((f) => [f.label, f.guardedNames]))
    expect(files[".env"]).toEqual(["DOTENV_KEY", "PRISMA_QUERY_ENGINE_LIBRARY"])
    expect(files[".env.local"]).toEqual(["DYLD_INSERT_LIBRARIES"])
    expect(files[".env.pre-local-merge.bak"]).toEqual([])
    expect(JSON.stringify(readRadarSources(dir)).includes("must-not-be-kept")).toBe(false)
  })

  it("reads the generated client's text from the resolved path, with the folders it must be judged against; any failure is data", () => {
    const dir = repo({
      "node_modules/.prisma/client-mi/index.js": '"relativeEnvPaths": { "rootEnvPath": null, "schemaEnvPath": null }',
      "node_modules/.prisma/client-mi/schema.prisma": "// schema",
    })
    const read = readClientConfig(join(dir, "node_modules/.prisma/client-mi/index.js"), dir)
    expect(read.ok).toBe(true)
    expect(read.text).toContain("relativeEnvPaths")
    expect(read.clientDir).toBe(read.expectedClientDir)
    expect(read.schemaBeside).toBe(true)
    // The read is complete (folders equal, schema beside, text present): the only thing this tiny client lacks is its datasource, so
    // that is the label the assessor reports — not "fichier illisible" / "lecture incomplète".
    const verdict = assessEnvLoadPaths(read as never)
    expect(!verdict.ok && verdict.message.includes("source de l'URL inattendue")).toBe(true)
    expect(readClientConfig(join(dir, "nowhere/index.js"), dir)).toEqual({ ok: false })
    expect(readClientConfig(join(dir, "node_modules/.prisma/client-mi/index.js"), join(dir, "elsewhere"))).toEqual({ ok: false })
  })

  it("the notice every class decision carries is one constant, and it says what a hostname classification does not prove", () => {
    expect(TARGET_LIMIT_NOTICE).toContain("serveur réellement joint non vérifié")
    expect(TARGET_LIMIT_NOTICE).toContain("DNS")
    expect(TARGET_LIMIT_NOTICE).toContain("/etc/hosts")
  })
})
