import { readFileSync, readdirSync } from "node:fs"
import Module from "node:module"
import { join } from "node:path"

import ts from "typescript"
import { afterEach, describe, expect, it, vi } from "vitest"

import * as entrySnapshot from "../../scripts/lib/radar-entry-snapshot.mjs"
import * as radarPrompt from "../../scripts/lib/radar-prompt.mjs"
import * as radarSources from "../../scripts/lib/radar-sources.mjs"
import * as radarTarget from "../../scripts/lib/radar-target.mjs"

/**
 * RSK-90 lot A — STRUCTURAL tests: they read the sources and fail when the design is broken by a later edit.
 *
 * What they guarantee: in the repository, as written and tested, no module exports a way to obtain a token, a URL or a client; the
 * only code that builds the standalone Radar client is the factory of `scripts/radar-seed-run.ts`; EVERY class of target is refused by
 * its own literal `false` that nothing reads from the environment or the arguments; the files that write the three Radar tables, create
 * a Radar client or read the Radar database variables are exactly the registered ones (a new one fails and must be reviewed).
 * What they do NOT guarantee (stated, not hidden — see "documented limits" below): code of the same process that wants to bypass
 * (`require` of the generated client, a monkey patch, a cast), a local script that is not committed, the deletion of these tests,
 * another tool (`psql`, Prisma Studio), a writer outside the repository, or someone who edits a literal ON PURPOSE.
 * They run on `pull_request` and `push` to `main` through `npm run test`.
 */

// These tests read every source file of the repository (~4 000 files) and parse the few that match: fast alone (≈5 s for the whole file),
// slow when the full suite runs 800+ files in parallel. A timeout here would be a false failure, never a protection.
vi.setConfig({ testTimeout: 90_000, hookTimeout: 90_000 })

const root = process.cwd()
const rawCache = new Map<string, string>()
const read = (path: string): string => {
  let text = rawCache.get(path)
  if (text === undefined) {
    text = readFileSync(join(root, path), "utf8")
    rawCache.set(path, text)
  }
  return text
}

const scriptKind = (fileName: string) =>
  /\.tsx$/.test(fileName) ? ts.ScriptKind.TSX : /\.jsx$/.test(fileName) ? ts.ScriptKind.JSX : /\.(mjs|cjs|js)$/.test(fileName) ? ts.ScriptKind.JS : ts.ScriptKind.TS

/**
 * Source text with every COMMENT blanked (newlines kept), found by the TypeScript parser — so a `/*` inside a string, a template or a
 * regular expression (`accept="image/*"`) can never open a fake comment and hide real code from the detectors.
 */
function stripComments(text: string, fileName: string): string {
  const sf = ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, true, scriptKind(fileName))
  const spans: Array<[number, number]> = []
  const seen = new Set<number>()
  const take = (ranges: ts.CommentRange[] | undefined) => {
    for (const r of ranges ?? []) {
      if (seen.has(r.pos)) continue
      seen.add(r.pos)
      spans.push([r.pos, r.end])
    }
  }
  const visit = (node: ts.Node) => {
    const children = node.getChildren(sf)
    if (children.length === 0) {
      take(ts.getLeadingCommentRanges(text, node.getFullStart()))
      take(ts.getTrailingCommentRanges(text, node.getEnd()))
    }
    for (const child of children) visit(child)
  }
  visit(sf)
  spans.sort((a, b) => a[0] - b[0])
  let out = ""
  let last = 0
  for (const [start, end] of spans) {
    out += text.slice(last, start) + text.slice(start, end).replace(/[^\n]/g, " ")
    last = end
  }
  return out + text.slice(last)
}

const codeCache = new Map<string, string>()
/** Source text without comments. */
const code = (path: string): string => {
  let text = codeCache.get(path)
  if (text === undefined) {
    text = stripComments(read(path), path)
    codeCache.set(path, text)
  }
  return text
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* The file universe: every directory that can hold a client creator or a Radar writer, walked for real                    */
/* ------------------------------------------------------------------------------------------------------------------ */

const SCAN_DIRS = ["app", "apps", "components", "e2e", "emails", "hooks", "i18n", "inngest", "lib", "medusa-backend", "packages", "prisma", "scripts", "stores", "types", "workers"]
const SKIPPED_DIRS = new Set(["node_modules", "__tests__", ".next", "dist", ".medusa", ".turbo", "coverage"])
const CODE_FILE = /\.(ts|tsx|mts|cts|mjs|js|cjs|jsx)$/
const isScanned = (name: string) => CODE_FILE.test(name) && !/\.d\.ts$/.test(name) && !/\.(test|spec)\./.test(name)

function sources(): string[] {
  const out: string[] = []
  const walk = (dir: string) => {
    for (const entry of readdirSync(join(root, dir), { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (!SKIPPED_DIRS.has(entry.name)) walk(`${dir}/${entry.name}`)
      } else if (isScanned(entry.name)) out.push(`${dir}/${entry.name}`)
    }
  }
  // A missing directory is a failure, never a silent skip (see the first describe).
  for (const dir of SCAN_DIRS) walk(dir)
  for (const entry of readdirSync(root, { withFileTypes: true })) if (entry.isFile() && isScanned(entry.name)) out.push(entry.name)
  return out.sort()
}
const ALL = sources()

/** Files whose RAW text matches `re` (a cheap prefilter) AND whose comment-free text matches it too. */
const filesMatching = (re: RegExp, files: readonly string[] = ALL): string[] => files.filter((f) => re.test(read(f)) && re.test(code(f)))

const BOOTSTRAP = "scripts/seed-world-radar.ts"
const RUN = "scripts/radar-seed-run.ts"
const LAUNCHER = "scripts/seed-prod-safe.mjs"
const LIBS = ["scripts/lib/radar-entry-snapshot.mjs", "scripts/lib/radar-target.mjs", "scripts/lib/radar-sources.mjs", "scripts/lib/radar-prompt.mjs"]
const SEED_FILES = [BOOTSTRAP, RUN, ...LIBS]
const SOURCES_FILE = "scripts/lib/radar-sources.mjs"
const STORE = "lib/radar/world-radar-store.server.ts"

/** The body of `function name(` up to its closing brace at the start of a line. */
function bodyOf(text: string, header: RegExp): string {
  const start = text.search(header)
  expect(start, `${header} not found`).toBeGreaterThanOrEqual(0)
  const end = text.indexOf("\n}\n", start)
  return text.slice(start, end + 3)
}

const order = (text: string, markers: Array<string | RegExp>) => markers.map((m) => (typeof m === "string" ? text.indexOf(m) : text.search(m)))
function expectAscending(text: string, markers: Array<string | RegExp>) {
  const at = order(text, markers)
  expect(at.every((i) => i >= 0), `a marker is missing: ${JSON.stringify(markers.map(String).filter((_, i) => at[i] < 0))}`).toBe(true)
  expect(at, markers.map(String).join(" < ")).toEqual([...at].sort((a, b) => a - b))
}

/** The assertion lines the seed is allowed to have in its factory (the controlled pre-set of D3 and its check). */
const PRESET_LINE = /^\s*process\.env\.RADAR_DATABASE_URL = url$/m
const PRESET_CHECK = /^\s*if \(process\.env\.RADAR_DATABASE_URL !== url\) \{$/m

/* ================================================================================================================ */

describe("the file universe is REAL — every scanned directory exists and holds files (a missing one is not a silent skip)", () => {
  it("each scan directory is present and non-empty; canary files of the far corners are in the universe", () => {
    for (const dir of SCAN_DIRS) expect(ALL.some((f) => f.startsWith(`${dir}/`)), dir).toBe(true)
    for (const canary of ["medusa-backend/src/lib/prisma-client.ts", "apps/api/src/shared/env.ts", "e2e/helpers/radar-plan.ts", "lib/prisma-radar.ts", RUN]) {
      expect(ALL, canary).toContain(canary)
    }
    expect(ALL.some((f) => f.startsWith("packages/"))).toBe(true)
    expect(ALL.length).toBeGreaterThan(3000)
  })

  it("the audit snapshot, node_modules, build output, declaration files and tests are not in it", () => {
    expect(ALL.filter((f) => /(^|\/)(node_modules|Affisell_Audit_Package|\.next|dist|\.medusa|__tests__)\//.test(f) || /\.d\.ts$/.test(f) || /\.(test|spec)\./.test(f))).toEqual([])
  })

  it("the workflows directory exists and holds workflows (their text is read in the inventory below)", () => {
    expect(readdirSync(join(root, ".github/workflows")).filter((f) => /\.ya?ml$/.test(f)).length).toBeGreaterThan(0)
  })
})

describe("the comment stripper is the parser's: a `/*` inside a string never hides code", () => {
  it("keeps code that follows a string containing `/*`, blanks real comments, keeps line numbers", () => {
    const text = 'const accept = "image/*"\ndb.radarCountry.upsert({}) // real comment\n/** doc */\nconst x = `a/*b`\n'
    const stripped = stripComments(text, "x.ts")
    expect(stripped).toContain("db.radarCountry.upsert({})")
    expect(stripped).not.toContain("real comment")
    expect(stripped).not.toContain("doc")
    expect(stripped.split("\n")).toHaveLength(text.split("\n").length)
    expect(stripComments("// db.radarWinner.deleteMany()\nconst a = 1", "x.ts")).not.toContain("deleteMany")
  })
})

describe("V1/V2 — the surface: one export, one importer", () => {
  it("`radar-seed-run.ts` exports exactly `runRadarSeedCli`, with no parameter", () => {
    const text = code(RUN)
    const exports = text.split("\n").filter((line) => /^export\b/.test(line))
    expect(exports).toEqual(["export async function runRadarSeedCli(): Promise<number> {"])
    expect(text).not.toMatch(/\bmodule\.exports\b|\bexports\./)
  })

  it("the bootstrap exports nothing but `{}`; the pure and I/O modules never export a token, a client or a factory", () => {
    expect(code(BOOTSTRAP).split("\n").filter((l) => /^export\b/.test(l))).toEqual(["export {}"])
    for (const lib of LIBS) {
      expect(code(lib), lib).not.toMatch(/\b(mintToken|redeemTarget|createRadarDb|VerifiedTarget|PrismaClient)\b/)
    }
    // `client-mi` is named by ONE I/O line (the folder the generated client's text is judged against), never by the pure layer.
    expect(code("scripts/lib/radar-target.mjs")).not.toMatch(/client-mi/)
    expect(code(SOURCES_FILE).match(/client-mi/g)).toHaveLength(1)
    expect(code(SOURCES_FILE)).toMatch(/^\s*expectedClientDir: realpathSync\(join\(repoRoot, "node_modules", "\.prisma", "client-mi"\)\),$/m)
  })

  it("`mintToken`, `redeemTarget` and the token registry exist nowhere else; `createRadarDb` only in the two factories", () => {
    expect(filesMatching(/\b(mintToken|redeemTarget)\b/).filter((f) => f !== RUN)).toEqual([])
    expect(filesMatching(/\bissued\.(set|get|has)\(/, ALL.filter((f) => f.startsWith("scripts/") || f.startsWith("vitest-env/") || SEED_FILES.includes(f))).filter((f) => f !== RUN)).toEqual([])
    expect(filesMatching(/\bcreateRadarDb\b/).filter((f) => f !== RUN && f !== "lib/prisma-radar.ts")).toEqual([])
  })

  it("`radar-seed-run` is imported ONLY by the bootstrap, and only dynamically, with no query", () => {
    expect(filesMatching(/(?:from|import\s*\()\s*["'][^"']*radar-seed-run["']/)).toEqual([BOOTSTRAP])
    expect(code(BOOTSTRAP)).toMatch(/await import\("\.\/radar-seed-run"\)/)
    expect(code(BOOTSTRAP)).not.toMatch(/lift=/)
  })

  it("the snapshot is captured by the bootstrap and nowhere else", () => {
    const callers = filesMatching(/\bcaptureEntrySnapshot\(\)/)
    expect(callers.filter((f) => f !== "scripts/lib/radar-entry-snapshot.mjs")).toEqual([BOOTSTRAP])
  })
})

describe("the bootstrap — no static import, an exit listener first, snapshot next", () => {
  const text = code(BOOTSTRAP)
  it("has no static import, no `require`, no `export … from`", () => {
    expect(text.split("\n").filter((l) => /^\s*import\b(?!\s*\()/.test(l))).toEqual([])
    expect(text).not.toMatch(/\brequire\s*\(|\bexport\b[^\n]*\bfrom\b/)
  })
  it("imports the leaf, takes the snapshot, and only then imports the program", () => {
    expectAscending(text, ['await import("./lib/radar-entry-snapshot.mjs")', "captureEntrySnapshot()", 'await import("./radar-seed-run")', "return runRadarSeedCli()"])
    expect(text).toMatch(/process\.exitCode = code/)
  })
  it("reads no environment and loads no env file", () => {
    expect(text).not.toMatch(/process\.env|dotenv|loadEnv|override\s*:/)
  })
  it("the snapshot module is a LEAF: it imports nothing", () => {
    expect(code("scripts/lib/radar-entry-snapshot.mjs").split("\n").filter((l) => /^\s*import\b/.test(l))).toEqual([])
  })

  it("C5 — the exit listener is the FIRST statement after `export {}`, before any import, synchronous, wrapped in try/catch", () => {
    const listener = text.indexOf('process.on("exit"')
    expect(listener).toBeGreaterThan(0)
    expect(text.indexOf("export {}")).toBeLessThan(listener)
    expect(listener).toBeLessThan(text.indexOf("await import("))
    const body = text.slice(listener, text.indexOf("\n})\n", listener) + 4)
    expect(body).toMatch(/try \{/)
    expect(body).toMatch(/catch \{/)
    expect(body).not.toMatch(/\basync\b|\bawait\b|setTimeout|Promise|\.then\(/)
    expect(body).toMatch(/if \(reported\) return/)
  })

  it("C5 — the forced exit code is the literal 4, pinned to EXIT.SEED_FAILED, and only a run with code 0 and no verdict is forced", () => {
    expect(radarTarget.EXIT.SEED_FAILED).toBe(4)
    expect(text).toMatch(/if \(code === 0\) process\.exitCode = 4$/m)
    expect(text.match(/process\.exitCode = 4\b/g)).toHaveLength(2) // the listener and the "started" rejection path
    expect(text).toMatch(/exit=4 state=indeterminate/)
  })

  it("C5 — `reported` is set before the code is applied, in both the success and the rejection handlers", () => {
    expect(text.match(/\breported = true\b/g)).toHaveLength(2)
    expectAscending(text, ["reported = true\n    process.exitCode = code", "reported = true\n    console.error"])
    expect(text).toMatch(/^let reported = false$/m)
    expect(text).toMatch(/^let started = false$/m)
    expect(text).toMatch(/\bstarted = true\b/)
  })

  it("C5 — the literal lines the bootstrap prints are exactly what `formatFinalLine` produces (one contract, no drift)", () => {
    const { formatFinalLine, STATE } = radarTarget
    expect(text).toContain(`"${formatFinalLine("bootstrap_failed", 1, STATE.REFUSED)}"`)
    expect(text).toContain(`"${formatFinalLine("bootstrap_failed", 4, STATE.INDETERMINATE)}"`)
    expect(text).toContain(`\`${formatFinalLine("exited_without_report", 0, STATE.INDETERMINATE).replace("exit=0", "exit=${code}")}\``)
  })
})

describe("V3/S3 — the factory: the only place that builds the standalone Radar client", () => {
  const text = code(RUN)
  const factory = bodyOf(text, /function createRadarDb\(/)

  /** What a `client-mi` string literal IS, decided on the syntax tree (so a multi-line import is classified like a one-line one). */
  function clientMiRoles(source: string, fileName: string) {
    const sf = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, scriptKind(fileName))
    const roles = { creators: 0, typeOrNamespace: 0, resolutions: 0, folder: 0, unclassified: [] as string[] }
    const visit = (node: ts.Node) => {
      if ((ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) && node.text.includes("client-mi")) {
        const p = node.parent
        const note = () => `${fileName}: ${p.getText(sf).replace(/\s+/g, " ").slice(0, 90)}`
        if (ts.isImportDeclaration(p) && p.moduleSpecifier === node) {
          const named = p.importClause?.namedBindings
          const onlyPrisma = !!p.importClause && !p.importClause.name && !!named && ts.isNamedImports(named) && named.elements.every((e) => (e.propertyName ?? e.name).text === "Prisma")
          const typeOnly = !!p.importClause && (p.importClause.isTypeOnly || (!!named && ts.isNamedImports(named) && named.elements.every((e) => e.isTypeOnly)))
          if (typeOnly || onlyPrisma) roles.typeOrNamespace += 1
          else roles.unclassified.push(note())
        } else if (ts.isLiteralTypeNode(p) && ts.isImportTypeNode(p.parent)) roles.typeOrNamespace += 1
        else if (ts.isCallExpression(p) && p.arguments[0] === node && ts.isIdentifier(p.expression) && /^(require|nodeRequire)$/.test(p.expression.text)) roles.creators += 1
        else if (ts.isCallExpression(p) && p.arguments[0] === node && ts.isPropertyAccessExpression(p.expression) && p.expression.name.text === "resolve") roles.resolutions += 1
        else if (ts.isCallExpression(p) && ts.isIdentifier(p.expression) && p.expression.text === "join" && node.text === "client-mi") roles.folder += 1
        else roles.unclassified.push(note())
      }
      ts.forEachChild(node, visit)
    }
    visit(sf)
    return roles
  }

  it("repository-wide, `client-mi` is a type, the `Prisma` namespace, a resolution, one folder name — or a creation, and a creation lives in exactly two files", () => {
    const creators: string[] = []
    const resolutions: string[] = []
    const folders: string[] = []
    const unclassified: string[] = []
    for (const file of filesMatching(/client-mi/)) {
      const roles = clientMiRoles(read(file), file)
      if (roles.creators > 0) creators.push(file)
      if (roles.resolutions > 0) resolutions.push(file)
      if (roles.folder > 0) folders.push(file)
      unclassified.push(...roles.unclassified)
    }
    expect(unclassified).toEqual([])
    expect(creators.sort()).toEqual(["lib/prisma-radar.ts", RUN])
    expect(resolutions).toEqual([RUN])
    expect(folders).toEqual([SOURCES_FILE])
  })

  it("S2 — one `createRequire`, one literal `nodeRequire(...)` and one `.resolve(...)`, no other `require(` and no dynamic `import(` in the program", () => {
    expect(text.match(/\bcreateRequire\(/g)).toHaveLength(1)
    expect(text.match(/\bnodeRequire\(/g)).toHaveLength(1)
    expect(text.match(/\bnodeRequire\.resolve\(/g)).toHaveLength(1)
    expect(text).toMatch(/nodeRequire\("\.prisma\/client-mi"\)/)
    expect(text).toMatch(/nodeRequire\.resolve\("\.prisma\/client-mi"\)/)
    expect(text).not.toMatch(/(?<![\w.])require\s*\(/)
    expect(text).not.toMatch(/\bimport\s*\(/)
    // `createRequire` nowhere else in the seed files, and never next to a `.prisma/` segment elsewhere in the repository.
    for (const file of SEED_FILES.filter((f) => f !== RUN)) expect(code(file), file).not.toMatch(/\bcreateRequire\b/)
    expect(filesMatching(/\bcreateRequire\b/).filter((f) => /\.prisma[/\\]/.test(read(f)))).toEqual([RUN])
  })

  it("exactly one constructor call, preceded in order by: redeem, the three disabled-class re-checks, guard, G9b text check, load, G9, identity recomputation, the pre-set", () => {
    expect(text.match(/new (Radar)?PrismaClient\(/g)).toHaveLength(1)
    expect(factory.match(/new PrismaClient\(/g)).toHaveLength(1)
    expectAscending(factory, [
      "redeemTarget(token)",
      "!PRODUCTION_SEED_ENABLED",
      "!LOOPBACK_SEED_ENABLED",
      "!STAGING_SEED_ENABLED",
      "assertNotProductionByAccident(",
      "assessEnvLoadPaths(",
      'nodeRequire.resolve(".prisma/client-mi")',
      'nodeRequire(".prisma/client-mi")',
      "assertGeneratedSchema(",
      "analyzeTargetUrl(url)",
      "identitiesEqual(",
      "process.env.RADAR_DATABASE_URL = url",
      "new PrismaClient(",
      "process.env.RADAR_DATABASE_URL !== url",
    ])
  })

  it("the factory has a token parameter and NO URL parameter; its ONLY use of the environment is the pre-set line and its check; it loads no env file", () => {
    expect(factory.split("\n")[0]).toBe("function createRadarDb(token: VerifiedTarget): RadarDb {")
    expect(factory.match(PRESET_LINE)).toHaveLength(1)
    expect(factory.match(PRESET_CHECK)).toHaveLength(1)
    expect(factory.match(/process\.env/g)).toHaveLength(2)
    const rest = factory.replace(PRESET_LINE, "").replace(PRESET_CHECK, "")
    expect(rest).not.toMatch(/process\.env|loadEnv|dotenv|override\s*:|readFileSync|readRadarSources/)
    // The G9b read goes through the I/O helper, never through `fs` in the factory.
    expect(factory).toMatch(/readClientConfig\(nodeRequire\.resolve\(/)
  })

  it("no other way to reach the environment in the seed files: no `process[`, no `node:process`, no `globalThis.process`, no destructured `env`", () => {
    for (const file of SEED_FILES.concat(LAUNCHER)) {
      expect(code(file), file).not.toMatch(/\bprocess\s*\[|node:process|globalThis\.process|\{[^}]*\benv\b[^}]*\}\s*=\s*process\b/)
    }
  })

  it("the historical guard is imported and called textually BEFORE the constructor, after no env loader (the repository invariant)", () => {
    const raw = read(RUN)
    const call = raw.search(/^\s*(if \([^)]*\) )?assertNotProductionByAccident\(/m)
    const client = raw.search(/new (Radar)?PrismaClient\(/)
    const envLoad = raw.search(/\b(config|loadEnv)\(\s*\{/)
    expect(/from ["'](\.\/|\.\.\/scripts\/)lib\/production-guard\.mjs["']/.test(raw)).toBe(true)
    expect(call).toBeGreaterThanOrEqual(0)
    expect(call).toBeLessThan(client)
    expect(envLoad).toBe(-1)
  })

  it("S4 — the registry of tokens is written in `mintToken` only, read in `redeemTarget` only, and never exported", () => {
    expect(text.match(/\bissued\.set\(/g)).toHaveLength(1)
    expect(text.match(/\bissued\.get\(/g)).toHaveLength(1)
    expect(bodyOf(text, /function mintToken\(/)).toMatch(/issued\.set\(/)
    expect(bodyOf(text, /function redeemTarget\(/)).toMatch(/issued\.get\(/)
    expect(text).toMatch(/^const issued = new WeakMap<object, Redeemed>\(\)$/m)
    expect(text).not.toMatch(/export[^\n]*\bissued\b/)
  })

  it("the token carries no URL: it is a frozen empty object, and the URL is stored only in the registry", () => {
    const mint = bodyOf(text, /function mintToken\(/)
    expect(mint).toMatch(/Object\.freeze\(Object\.create\(null\)\)/)
    expect(mint).toMatch(/issued\.set\(token, Object\.freeze\(\{ url, identity: Object\.freeze\(\{ \.\.\.identity \}\), cls \}\)\)/)
  })

  it("V4 — no function or options parameter on the exported signature, and no test branch in the seed files", () => {
    expect(text).toMatch(/export async function runRadarSeedCli\(\): Promise<number>/)
    for (const file of SEED_FILES) expect(code(file), file).not.toMatch(/\bVITEST\b|NODE_ENV|isTest|__TEST__|\?lift=/)
  })

  it("the program never exits on its own: it returns a code (only the bootstrap and the launcher call `process.exit`)", () => {
    const callers = [...SEED_FILES, LAUNCHER].filter((f) => /process\.exit\(/.test(code(f)))
    expect(callers.sort()).toEqual([BOOTSTRAP, LAUNCHER].sort())
  })
})

/* ------------------------------------------------------------------------------------------------------------------ */
/* D10 — the three literals, each independent, each refusing its own class                                                  */
/* ------------------------------------------------------------------------------------------------------------------ */

const LITERALS = [
  { name: "PRODUCTION_SEED_ENABLED", cls: "production", key: "production_seed_disabled", phrase: "Do NOT flip PRODUCTION_SEED_ENABLED in lot A, B or D" },
  { name: "LOOPBACK_SEED_ENABLED", cls: "bouclage", key: "loopback_seed_disabled", phrase: "Do NOT lift LOOPBACK_SEED_ENABLED or STAGING_SEED_ENABLED either" },
  { name: "STAGING_SEED_ENABLED", cls: "staging", key: "staging_seed_disabled", phrase: "Do NOT lift LOOPBACK_SEED_ENABLED or STAGING_SEED_ENABLED either" },
] as const

describe.each(LITERALS)("$name — a literal `false`, independent of the other two, read by nothing", (lit) => {
  const text = code(RUN)
  const others = LITERALS.filter((l) => l.name !== lit.name).map((l) => l.name)
  const refusal = `cls === "${lit.cls}" && !${lit.name}`

  it("is declared once, as the exact literal, and assigned nowhere else; no expression links it to another literal", () => {
    expect(text.match(new RegExp(`^const ${lit.name} = false$`, "gm"))).toHaveLength(1)
    expect(text.match(new RegExp(`\\b${lit.name}\\s*=(?!=)`, "g"))).toHaveLength(1)
    expect(text).not.toMatch(new RegExp(`\\b(let|var)\\s+${lit.name}\\b`))
    expect(text).not.toMatch(new RegExp(`${lit.name}\\s*(\\|\\||&&|\\?\\?)=?`))
    for (const line of text.split("\n").filter((l) => l.includes(lit.name))) for (const other of others) expect(line, `${lit.name} / ${other}`).not.toContain(other)
  })

  it("every use is the negation, as `cls === \"%s\" && !…`, in EXACTLY the orchestration, the token mint AND the factory; none involves the environment, the arguments or a proof", () => {
    const uses = text.split("\n").filter((l) => l.includes(lit.name) && !new RegExp(`^const ${lit.name} = false$`).test(l))
    expect(uses).toHaveLength(3)
    for (const line of uses) {
      expect(line.trim(), line).toBe(`if (${refusal}) {`)
      expect(line, line).not.toMatch(/snapshot|process|options|env|argv|proof|allow|confirm|expect/i)
    }
    expect(bodyOf(text, /function mintToken\(/)).toContain(refusal)
    expect(bodyOf(text, /function createRadarDb\(/)).toContain(refusal)
    expect(bodyOf(text, /async function execute\(/)).toContain(refusal)
    expect(text.match(new RegExp(`key: "${lit.key}"`, "g"))).toHaveLength(3)
  })

  it("is refused BEFORE any prompt, proof or token: textually before `isInteractiveTerminal(` and `assessStaticProof(` in the orchestration", () => {
    const execute = bodyOf(text, /async function execute\(/)
    expectAscending(execute, [refusal, "isInteractiveTerminal(", "assessStaticProof(", "askRadarProof(", "mintToken("])
  })

  it("no other file in the repository defines or reads it", () => {
    expect(filesMatching(new RegExp(lit.name)).filter((f) => f !== RUN)).toEqual([])
  })

  it("is `false` in lot A: lifting it is a deliberate commit that must edit this assertion (see the box in radar-seed-run.ts)", () => {
    expect(read(RUN)).toMatch(new RegExp(`^const ${lit.name} = false$`, "m"))
    expect(read(RUN)).toContain(lit.phrase)
  })
})

describe("the classes are a CLOSED set: each one has its literal, and nothing else decides a class", () => {
  it("`TargetClass` is exactly production | staging | bouclage, the pure layer agrees, and each class has a literal with its own refusal key", () => {
    const union = /^type TargetClass = (.+)$/m.exec(code(RUN))?.[1]
    const members = (union ?? "").split("|").map((m) => m.trim().replace(/"/g, "")).sort()
    expect(members).toEqual(["bouclage", "production", "staging"])
    expect(Object.keys(radarTarget.CLASS_LABEL).sort()).toEqual(members)
    expect(LITERALS.map((l) => l.cls).sort()).toEqual(members)
    // No other comparison on the class in the program: a fourth class without a literal cannot slip in.
    const compared = new Set([...code(RUN).matchAll(/\bcls === "(\w+)"/g)].map((m) => m[1]))
    expect(compared.has("unknown")).toBe(true) // the one other value: an unrecognised host, refused at G3
    compared.delete("unknown")
    expect([...compared].sort()).toEqual(members)
  })

  it("the program creates its client in ONE call, reached by ONE call of the factory, after the three refusals", () => {
    const execute = bodyOf(code(RUN), /async function execute\(/)
    expect(execute.match(/\bmintToken\(/g)).toHaveLength(1)
    expect(execute.match(/\bcreateRadarDb\(/g)).toHaveLength(1)
    expect(code(RUN).match(/\bcreateRadarDb\(/g)).toHaveLength(2) // the declaration and the one call
    expect(code(RUN).match(/new PrismaClient\(/g)).toHaveLength(1)
  })
})

describe("the gate runs in order, and every class is refused before any prompt, token or client", () => {
  const execute = bodyOf(code(RUN), /async function execute\(/)
  const firstRefusal = 'cls === "production" && !PRODUCTION_SEED_ENABLED'

  it("G0 → G1 + environment sources → G2/G3 → G4 → three refusals → G5/G6 → prompt → G7-G9 → writes", () => {
    expectAscending(execute, [
      "readEntrySnapshot()",
      "parseSeedArgs(",
      "readRadarSources(",
      "assessEnvSources(",
      "resolveTarget(",
      "analyzeTargetUrl(",
      "checkExpectedClass(",
      firstRefusal,
      'cls === "bouclage" && !LOOPBACK_SEED_ENABLED',
      'cls === "staging" && !STAGING_SEED_ENABLED',
      "isInteractiveTerminal(",
      "assessStaticProof(",
      "askRadarProof(",
      "assessTypedProof(",
      // The argument is evaluated first: the token is minted, then handed to the factory — and to nothing else.
      "createRadarDb(mintToken(resolved.url, identity, cls))",
      "runWrites(",
    ])
    expect(execute.match(/\bmintToken\(/g)).toHaveLength(1)
    expect(execute.match(/\bcreateRadarDb\(/g)).toHaveLength(1)
  })

  it("nothing that could touch a database, ask a question or build a token appears before the first refusal", () => {
    const before = execute.slice(0, execute.indexOf(firstRefusal))
    expect(before).not.toMatch(/askRadarProof\(|isInteractiveTerminal\(|mintToken\(|createRadarDb\(|assertNotProductionByAccident\(|\.count\(\)|upsert\(|deleteMany\(|createMany\(|runWrites\(/)
  })

  it("every refusal path returns before the client is built (a return precedes each later stage)", () => {
    expect(execute.match(/return finish\(/g)!.length).toBeGreaterThanOrEqual(14)
    expect(execute).not.toMatch(/return stop(With)?\(/)
  })
})

describe("C5 — what the program says about itself: one printer, one derivation, no exit 0", () => {
  const text = code(RUN)
  it("the verdict is printed by `finish` ONLY: two `console.error` lines, the state derived by `deriveState`, nothing on stdout", () => {
    const finish = bodyOf(text, /function finish\(/)
    expect(finish.match(/console\.error\(/g)).toHaveLength(2)
    expect(finish).not.toMatch(/console\.log\(/)
    expect(finish).toMatch(/deriveState\(\{ clientBuilt: run\.clientBuilt, writeStarted: run\.writeStarted, exit: verdict\.exit \}\)/)
    expect(finish).toMatch(/formatFinalLine\(verdict\.key, verdict\.exit, state\)/)
    expect(text.match(/formatFinalLine\(/g)).toHaveLength(1)
    expect(text).not.toMatch(/result=/)
  })
  it("the run state is LOCAL to a run (never module-level), `writeStarted` is raised BEFORE the first write, and exit 0 is returned nowhere", () => {
    expect(text).not.toMatch(/^let /m)
    expect(text).toMatch(/const run: Run = \{ clientBuilt: false, writeStarted: false \}/)
    expectAscending(bodyOf(text, /async function runWrites\(/), ["db.radarCountry.count()", "run.writeStarted = true", "await seedCountries(db)"])
    expect(text).not.toMatch(/\bEXIT\.OK\b/)
    expect(text.match(/EXIT\.EXECUTED_UNVERIFIED/g)).toHaveLength(1)
  })
  it("after the client exists, the verdict is printed AFTER `$disconnect` (the last line is the last thing that happens)", () => {
    const execute = bodyOf(text, /async function execute\(/)
    expectAscending(execute, ["verdict = await runWrites(", "await db.$disconnect()", "return finish(run, verdict)"])
  })
  it("an unexpected failure is classified by the phase: before any write → exit 1 `unexpected`, after → exit 4 `unexpected_after_start`", () => {
    const cli = bodyOf(text, /export async function runRadarSeedCli\(\)/)
    expect(cli).toMatch(/if \(run\.writeStarted\) \{/)
    expect(cli).toContain('key: "unexpected_after_start"')
    expect(cli).toContain('key: "unexpected"')
  })
  it("the state vocabulary is the contract: five states, and the vocabulary of the exit codes is documented where the codes are defined", () => {
    expect(Object.values(radarTarget.STATE).sort()).toEqual(["executed_unverified", "failed_before_write", "indeterminate", "refused", "verified"])
    expect(read("scripts/lib/radar-target.mjs")).toContain("Only a final line with `state=refused` proves that nothing was written")
    expect(read(RUN)).toContain("Only a final line `state=refused` proves that nothing was written")
    expect(read(BOOTSTRAP)).toContain("only `state=refused` proves that nothing was")
  })
})

describe("the limit of a class decision is written where it is read, from ONE constant", () => {
  it("the header of the program states it in full; the banner and the message of an executed run use the constant", () => {
    const raw = read(RUN)
    for (const sentence of [
      "Une classification STAGING déduite du nom d'hôte ne prouve pas l'identité du serveur réellement joint",
      "une redirection DNS,",
      "/etc/hosts",
      "le moteur accepte par",
      "les certificats invalides",
      "Aucun seed réel n'est autorisé sur",
      "cette seule classification",
      "sonde S1",
      "le verrou partagé entre l'application et le seed",
    ]) {
      expect(raw, sentence).toContain(sentence)
    }
    expect(code(RUN).match(/TARGET_LIMIT_NOTICE/g)!.length).toBeGreaterThanOrEqual(3) // import, banner, executed message
    expect(radarTarget.TARGET_LIMIT_NOTICE).toContain("serveur réellement joint non vérifié")
  })
})

describe("what the seed files may read, and what they may load", () => {
  it("`process.env` is read in the snapshot module ONLY — the program has exactly the two lines of the controlled pre-set, nothing else", () => {
    for (const file of SEED_FILES.concat(LAUNCHER)) {
      const hits = (code(file).match(/process\.env/g) ?? []).length
      if (file === "scripts/lib/radar-entry-snapshot.mjs") expect(hits).toBeGreaterThan(0)
      else if (file === LAUNCHER) expect(code(file).match(/process\.env\b/g)).toHaveLength(1) // `env: process.env`, passed through untouched
      else if (file === RUN) expect(hits, file).toBe(2) // the pre-set and its check, both inside the factory (asserted above)
      else expect(hits, file).toBe(0)
    }
  })

  it("no env file is loaded into the process: no `config(`/`loadEnv(`, no `override: true`, `parse` is the only dotenv function used", () => {
    for (const file of SEED_FILES.concat(LAUNCHER)) {
      const text = code(file)
      expect(text, file).not.toMatch(/\b(config|loadEnv)\(\s*\{|\boverride\s*:\s*true|dotenv\/config|from ["']dotenv["'][^\n]*\bconfig\b/)
    }
    expect(code(SOURCES_FILE)).toMatch(/import \{ parse \} from "dotenv"/)
  })

  it("the pure module imports only the two existing helpers and the leaf, and does no I/O", () => {
    const text = code("scripts/lib/radar-target.mjs")
    const imports = [...text.matchAll(/^import .* from "([^"]+)"$/gm)].map((m) => m[1]).sort()
    expect(imports).toEqual(["../prisma-explicit-db.mjs", "../schema-deploy.mjs", "./radar-entry-snapshot.mjs"])
    expect(text).not.toMatch(/\bprocess\b|node:|readFileSync|writeFileSync|spawn|fetch\(|Date\.now|Math\.random|console\./)
  })

  it("the I/O modules cannot write a variable, a file or a client", () => {
    for (const file of [SOURCES_FILE, "scripts/lib/radar-prompt.mjs"]) {
      expect(code(file), file).not.toMatch(/writeFile|appendFile|unlink|rmSync|process\.env\s*\[|process\.env\.\w+\s*=|PrismaClient|mintToken|spawn\(|createRequire|\brequire\(/)
    }
  })

  it("the old resolvers are gone from the seed: no Docker-skip copy, no `DATABASE_URL_UNPOOLED` fallback chain in the bootstrap or the program", () => {
    expect(code(BOOTSTRAP)).not.toMatch(/process\.env\.(RADAR|MARKET|DATABASE)/)
    // The program writes `RADAR_DATABASE_URL` once (the pre-set) and compares it once; it resolves nothing from the environment.
    const withoutPreset = code(RUN).replace(PRESET_LINE, "").replace(PRESET_CHECK, "")
    expect(withoutPreset).not.toMatch(/process\.env\.(RADAR|MARKET|DATABASE)/)
  })
})

describe("the existing entry points — both land on the single gate", () => {
  const scripts = JSON.parse(read("package.json")).scripts as Record<string, string>

  it("`radar:seed:world` and `radar:seed:prod` are the bootstrap, the latter with the production class expected", () => {
    expect(scripts["radar:seed:world"]).toBe("tsx scripts/seed-world-radar.ts")
    expect(scripts["radar:seed:prod"]).toBe("tsx scripts/seed-world-radar.ts --expect-class production")
  })

  it("no package script runs the program, the old wrapper or another Radar writer by another route", () => {
    for (const [name, command] of Object.entries(scripts)) {
      expect(command, name).not.toMatch(/radar-seed-run|seed-prod-safe/)
      if (/seed-world-radar/.test(command)) expect(["radar:seed:world", "radar:seed:prod"]).toContain(name)
    }
  })

  it("the old wrapper is a pure relay: no resolution, no prompt, no env loading, no variable injection, no result of its own", () => {
    const text = code(LAUNCHER)
    const imports = [...text.matchAll(/^import .* from "([^"]+)"$/gm)].map((m) => m[1]).sort()
    expect(imports).toEqual(["node:child_process", "node:os", "node:path"])
    expect(text).not.toMatch(/dotenv|readline|createInterface|loadEnv|existsSync|URL\(|PROD|console\.|DATABASE_URL|RADAR_DATABASE_URL|["'`/]\.env/)
    expect(text.match(/spawnSync\(/g)).toHaveLength(1)
    expect(text).toMatch(/spawnSync\("npm", \["run", "radar:seed:prod", "--", \.\.\.process\.argv\.slice\(2\)\]/)
    expect(text).toMatch(/env: process\.env,/)
    // A failure to start is 1, a signal is 128 + its number, anything else is the child's own status.
    expectAscending(text, ["if (result.error) process.exit(1)", "if (result.signal) process.exit(128 + (constants.signals[result.signal] ?? 1))", "process.exit(result.status ?? 1)"])
  })
})

/* ------------------------------------------------------------------------------------------------------------------ */
/* C4 — who writes the Radar tables, who creates a Radar client, who reads the Radar database variables                     */
/* ------------------------------------------------------------------------------------------------------------------ */

const WRITE_VERBS = new Set(["create", "createMany", "createManyAndReturn", "update", "updateMany", "upsert", "delete", "deleteMany"])
const READ_VERBS = new Set(["findMany", "findFirst", "findUnique", "findFirstOrThrow", "findUniqueOrThrow", "count", "aggregate", "groupBy"])
const DELEGATE = /\b(radarCountry|radarWinner|radarTrendingKeyword)\b/g

/** Every occurrence of a Radar delegate, classified: a direct READ call, a direct WRITE call (with its pair), or anything else (a type member, a destructuring, a quoted name, an alias…). */
function delegateUses(text: string) {
  const uses = { reads: 0, writes: [] as string[], other: 0 }
  for (const m of text.matchAll(DELEGATE)) {
    const verb = /^\s*\.\s*(\w+)\s*\(/.exec(text.slice(m.index + m[0].length, m.index + m[0].length + 80))?.[1]
    if (verb && WRITE_VERBS.has(verb)) uses.writes.push(`${m[1]}.${verb}`)
    else if (verb && READ_VERBS.has(verb)) uses.reads += 1
    else uses.other += 1
  }
  return uses
}
const RAW_SQL_WRITE = /(insert\s+into|update|delete\s+from|truncate(\s+table)?|copy)\s+([^\s"]*\.)?"?(RadarCountry|RadarWinner|RadarTrendingKeyword)"?/i
const ENV_NAME = /\b(RADAR_DATABASE_URL|MARKET_INTELLI_DATABASE_URL)\b/
const PRISMA_CONCAT = /["'`]\.prisma[/\\]["'`]\s*\+|\.prisma[/\\]\$\{/

const WRITER_REGISTRY: Record<string, { kind: string; why: string; pairs: string[] }> = {
  [STORE]: {
    kind: "application writer",
    why: "persistWorldRadarScan / seedWorldRadarCountries, called by the radar crons and routes; guarded on a developer machine by the historical endpoint-only guard; the per-country lock is lot C",
    pairs: ["radarCountry.upsert", "radarTrendingKeyword.createMany", "radarTrendingKeyword.deleteMany", "radarWinner.createMany", "radarWinner.deleteMany"],
  },
  [RUN]: {
    kind: "standalone seed",
    why: "the program gated by G0-G9 and by three literals; every class is disabled in lot A",
    pairs: ["radarCountry.upsert", "radarTrendingKeyword.createMany", "radarTrendingKeyword.deleteMany", "radarWinner.createMany", "radarWinner.deleteMany"],
  },
}
/** Files that name a delegate WITHOUT a direct call (types, destructuring…): registered, because that is where a write could hide. */
const OTHER_MENTION_REGISTRY: Record<string, string> = { [RUN]: "the `RadarDb` type of the seed's own client" }
/** Direct READS of a delegate are allowed anywhere; they are listed so that a new reader is a visible fact, not a rule. */
const IMPORTERS_OF_STORE: Record<string, string> = {
  "app/api/cron/radar-rotate/route.ts": "cron: application writer (indirect)",
  "app/api/cron/radar-scan/route.ts": "cron: application writer (indirect)",
  "app/api/radar/countries/route.ts": "route: application writer (indirect, registry seeding)",
  "app/api/radar/route.ts": "route: application writer (indirect)",
  "lib/radar/radar-import-bridge.server.ts": "import bridge: reads (and calls the store)",
}
const CLIENT_CREATOR_REGISTRY: Record<string, string> = {
  "lib/prisma-radar.ts": "the application's Radar client (lazy singleton, build write guard)",
  [RUN]: "the standalone seed's factory (token, three literals)",
}
const ENV_NAME_READERS: Record<string, string> = {
  "apps/api/src/shared/env.ts": "the legacy market-intelli API (its own schema and client)",
  "lib/env-validation.ts": "the startup environment validator (variable NAMES only; a Preview whose Radar URL names production is a critical finding — K1/J3)",
  "lib/prisma-radar.ts": "the application's Radar client",
  "lib/radar/env.ts": "the application's resolver (R > M > U > D)",
  "prisma.config.ts": "Prisma CLI configuration (loads env files; guard for write commands)",
  "scripts/build-isolated.mjs": "the build isolation (empties every datastore credential)",
  "scripts/lib/production-guard.mjs": "the historical guard (judges the URL variables)",
  "scripts/lib/radar-entry-snapshot.mjs": "the seed's snapshot (names of the four candidates)",
  "scripts/lib/radar-target.mjs": "the seed's pure layer (the generated client's datasource must read RADAR_DATABASE_URL)",
  "scripts/radar-db.mjs": "the Radar schema tool (db push, Prisma Studio) — NOT gated by the seed's gate (lot B)",
  [RUN]: "the seed's pre-set of the variable the schema reads",
}

describe("C4 — registries, one per indicator, EXACT in both directions (a stale entry fails as surely as a new file)", () => {
  it("writers: the files that call a write verb on a Radar delegate are exactly the registered ones, and each registered file writes exactly what is pinned", () => {
    const writers = ALL.filter((f) => /radar(Country|Winner|TrendingKeyword)/.test(read(f)) && delegateUses(code(f)).writes.length > 0)
    expect(writers).toEqual(Object.keys(WRITER_REGISTRY).sort())
    for (const [file, entry] of Object.entries(WRITER_REGISTRY)) {
      expect([...new Set(delegateUses(code(file)).writes)].sort(), `${file} (${entry.kind})`).toEqual(entry.pairs)
      expect(entry.why.length, file).toBeGreaterThan(20)
    }
  })

  it("a delegate named WITHOUT a direct call (type member, destructuring, quoted name, alias) is registered too — that is where a write could hide", () => {
    const others = ALL.filter((f) => /radar(Country|Winner|TrendingKeyword)/.test(read(f)) && delegateUses(code(f)).other > 0)
    expect(others).toEqual(Object.keys(OTHER_MENTION_REGISTRY).sort())
  })

  it("raw SQL: no file in the scanned code, and no migration, workflow or script, writes a Radar table with SQL", () => {
    expect(ALL.filter((f) => RAW_SQL_WRITE.test(read(f)) && RAW_SQL_WRITE.test(code(f)))).toEqual([])
    const nonCode: string[] = []
    const walk = (dir: string) => {
      for (const entry of readdirSync(join(root, dir), { withFileTypes: true })) {
        if (entry.isDirectory()) {
          if (!SKIPPED_DIRS.has(entry.name)) walk(`${dir}/${entry.name}`)
        } else if (/\.(sql|sh|py|ya?ml)$/.test(entry.name)) nonCode.push(`${dir}/${entry.name}`)
      }
    }
    for (const dir of ["prisma", "scripts", ".github/workflows"]) walk(dir)
    expect(nonCode.length).toBeGreaterThan(200)
    expect(nonCode.filter((f) => RAW_SQL_WRITE.test(read(f)))).toEqual([])
    expect(ALL.filter((f) => /market_intelli/.test(code(f)) && /\$queryRaw|\$executeRaw|queryRawUnsafe|executeRawUnsafe/.test(code(f)))).toEqual([])
  })

  it("creators of a Radar client are exactly the two registered; a `.prisma/` path is never built by concatenation", () => {
    const creators = filesMatching(/client-mi/).filter((f) => ts.createSourceFile(f, read(f), ts.ScriptTarget.Latest, true, scriptKind(f)) && /\b(require|nodeRequire)\(\s*["'`]\.prisma\/client-mi/.test(code(f)))
    expect(creators.sort()).toEqual(Object.keys(CLIENT_CREATOR_REGISTRY).sort())
    expect(ALL.filter((f) => PRISMA_CONCAT.test(read(f)) && PRISMA_CONCAT.test(code(f)))).toEqual([])
  })

  it("readers of the Radar database variables are exactly the registered ones, each with a reason", () => {
    const readers = ALL.filter((f) => ENV_NAME.test(read(f)) && ENV_NAME.test(code(f)))
    expect(readers).toEqual(Object.keys(ENV_NAME_READERS).sort())
    for (const [file, why] of Object.entries(ENV_NAME_READERS)) expect(why.length, file).toBeGreaterThan(10)
  })

  it("the application's write surface is the store's importers — 5 files today, named, not forbidden", () => {
    const importers = ALL.filter((f) => /world-radar-store\.server/.test(read(f)) && /["'][^"']*world-radar-store\.server["']/.test(code(f)))
    expect(importers).toEqual(Object.keys(IMPORTERS_OF_STORE).sort())
  })

  it("lot A touches no application code: the store and both crons carry no trace of the seed's gate", () => {
    for (const file of [STORE, "app/api/cron/radar-scan/route.ts", "app/api/cron/radar-rotate/route.ts"]) {
      expect(read(file), file).not.toMatch(/radar-entry-snapshot|radar-target|radar-seed-run|_SEED_ENABLED|advisory/i)
    }
  })
})

describe("C4 — entry points: package scripts, crons and workflows that touch Radar are inventoried (a new one must be classified)", () => {
  const RADAR_SCRIPT = /\bradar[:./-]|radar\.schema|market-intelli(?!gence)|client-mi|seed-world|seed-prod-safe/
  const scripts = JSON.parse(read("package.json")).scripts as Record<string, string>

  it("the root scripts that mention the Radar are exactly the inventoried ones, each with its class", () => {
    const inventory: Record<string, string> = {
      postinstall: "generator (prisma generate for both schemas)",
      build: "generator + build",
      "radar:db:push": "schema tool (radar-db.mjs) — not gated by the seed's gate (lot B)",
      "mi:db:push": "schema tool (alias)",
      "radar:db:studio": "schema tool: Prisma Studio — no guard (lot B)",
      "mi:db:studio": "schema tool (alias)",
      "radar:health": "crawler / health (other tables)",
      "radar:crawl": "crawler (other tables)",
      "radar:crawl:prod": "crawler (other tables)",
      "radar:seed:world": "GATED SEED: the bootstrap",
      "radar:seed:prod": "GATED SEED: the bootstrap, production class expected",
      "stripe:ensure-radar": "unrelated: Stripe prices",
    }
    const found = Object.entries(scripts).filter(([name, command]) => RADAR_SCRIPT.test(name) || RADAR_SCRIPT.test(command)).map(([name]) => name)
    expect(found.sort()).toEqual(Object.keys(inventory).sort())
  })

  it("the scripts of the other packages that push a schema or seed are inventoried: only packages/db (the legacy market-intelli schema, its own client)", () => {
    const found: string[] = []
    for (const group of ["apps", "packages"]) {
      for (const entry of readdirSync(join(root, group), { withFileTypes: true })) {
        if (!entry.isDirectory()) continue
        let manifest: { scripts?: Record<string, string> } | null = null
        try {
          manifest = JSON.parse(read(`${group}/${entry.name}/package.json`))
        } catch {
          continue
        }
        for (const [name, command] of Object.entries(manifest?.scripts ?? {})) if (/prisma (db|migrate)|seed|radar/.test(`${name} ${command}`)) found.push(`${group}/${entry.name}:${name}`)
      }
    }
    expect(found.sort()).toEqual(["packages/db:db:migrate:dev", "packages/db:db:push"])
  })

  it("the cron paths that mention the Radar are inventoried; those that import the store are the application's writers", () => {
    const crons = (JSON.parse(read("vercel.json")).crons as Array<{ path: string }>).map((c) => c.path).filter((p) => /radar/.test(p))
    expect(crons.sort()).toEqual(["/api/cron/radar-rotate", "/api/cron/radar-scan", "/api/radar/cron/alerts", "/api/radar/cron/global-scan"])
    const writers = crons.filter((p) => Object.hasOwn(IMPORTERS_OF_STORE, `app${p}/route.ts`))
    expect(writers.sort()).toEqual(["/api/cron/radar-rotate", "/api/cron/radar-scan"])
  })

  it("no workflow runs a Radar tool, a seed or SQL against the Radar schema today (a new one must be classified here)", () => {
    for (const file of readdirSync(join(root, ".github/workflows")).filter((f) => /\.ya?ml$/.test(f))) {
      expect(read(`.github/workflows/${file}`), file).not.toMatch(/radar|seed-world|market_intelli|RADAR_DATABASE_URL|MARKET_INTELLI_DATABASE_URL/i)
    }
  })
})

describe("C4 — the detectors detect (forged TEXT, no file), and what they cannot see is stated and asserted", () => {
  it("each indicator fires on its forged text, and stays quiet on the innocent one", () => {
    expect(delegateUses("db.radarCountry.upsert({})").writes).toEqual(["radarCountry.upsert"])
    expect(delegateUses("db.radarWinner\n  .deleteMany({})").writes).toEqual(["radarWinner.deleteMany"])
    expect(delegateUses("const { radarWinner } = db").other).toBe(1)
    expect(delegateUses('db["radarWinner"].create({})').other).toBe(1)
    expect(delegateUses("type T = { radarCountry: unknown }").other).toBe(1)
    expect(delegateUses("db.radarWinner.findMany({})")).toEqual({ reads: 1, writes: [], other: 0 })
    expect(delegateUses("db.radarCountry.count()").writes).toEqual([])
    expect(RAW_SQL_WRITE.test('INSERT INTO market_intelli."RadarCountry" (code) VALUES (1)')).toBe(true)
    expect(RAW_SQL_WRITE.test('delete from "RadarWinner"')).toBe(true)
    expect(RAW_SQL_WRITE.test('SELECT * FROM "RadarWinner"')).toBe(false)
    expect(RAW_SQL_WRITE.test('CREATE TABLE "market_intelli"."RadarWinner" (id int)')).toBe(false)
    expect(ENV_NAME.test("process.env.RADAR_DATABASE_URL")).toBe(true)
    expect(ENV_NAME.test("process.env.DATABASE_URL")).toBe(false)
    expect(PRISMA_CONCAT.test('require(".prisma/" + name)')).toBe(true)
    expect(PRISMA_CONCAT.test("require(`.prisma/${name}`)")).toBe(true)
    expect(PRISMA_CONCAT.test('require(".prisma/client")')).toBe(false)
  })

  it("`client-mi` is classified on the syntax tree: a multi-line type import is a type, a value import of PrismaClient is not", () => {
    const roles = (text: string) => {
      const sf = ts.createSourceFile("x.ts", text, ts.ScriptTarget.Latest, true)
      let types = 0
      let bad = 0
      const visit = (n: ts.Node) => {
        if (ts.isImportDeclaration(n) && ts.isStringLiteral(n.moduleSpecifier) && n.moduleSpecifier.text.includes("client-mi")) {
          const named = n.importClause?.namedBindings
          const ok = !!n.importClause && (n.importClause.isTypeOnly || (!n.importClause.name && !!named && ts.isNamedImports(named) && named.elements.every((e) => (e.propertyName ?? e.name).text === "Prisma")))
          if (ok) types += 1
          else bad += 1
        }
        ts.forEachChild(n, visit)
      }
      visit(sf)
      return { types, bad }
    }
    expect(roles('import type {\n  Prisma,\n  RadarWinner,\n} from ".prisma/client-mi"')).toEqual({ types: 1, bad: 0 })
    expect(roles('import { Prisma } from ".prisma/client-mi"')).toEqual({ types: 1, bad: 0 })
    expect(roles('import { PrismaClient } from ".prisma/client-mi"')).toEqual({ types: 0, bad: 1 })
    expect(roles('import {\n  Prisma,\n  PrismaClient,\n} from ".prisma/client-mi"')).toEqual({ types: 0, bad: 1 })
  })

  it("DOCUMENTED LIMITS — these are NOT detected, and the test says so, so that nobody claims more than is checked", () => {
    // A delegate reached through a computed name, SQL composed with `${…}`, a child process, another language, a writer outside the repository.
    expect(delegateUses('db["radar" + "Winner"].create({})').writes).toEqual([])
    expect(RAW_SQL_WRITE.test("INSERT INTO ${table} VALUES (1)")).toBe(false)
    expect(RAW_SQL_WRITE.test('execSync("psql -c \\"delete from x\\"")')).toBe(false)
    expect(delegateUses("require('child_process').execSync('node other.js')").writes).toEqual([])
    // The only guard against such a writer — or against a client created outside the repository — is the DATABASE (lot C: the S1 server
    // probe, the lock shared between the application and the seed, role privileges), not these tests.
    expect(true).toBe(true)
  })
})

/* ------------------------------------------------------------------------------------------------------------------ */
/* D10.a — the Vitest-only variant: it can never reach what the seed really does                                          */
/* ------------------------------------------------------------------------------------------------------------------ */

describe("D10.a — the `?lift=` variant exists for Vitest only, and the shipped file is what runs", () => {
  const PLUGIN = "vitest-env/radar-literal-variant.ts"

  it("only the run test imports the program with `?lift=`; no source file does, and nothing but the Vitest config loads the plugin", () => {
    const testDir = "lib/__tests__"
    const mentioning = readdirSync(join(root, testDir)).filter((f) => /\.test\.ts$/.test(f) && f !== "radar-seed-structure.test.ts" && read(`${testDir}/${f}`).includes("?lift="))
    expect(mentioning).toEqual(["radar-seed-run.test.ts"])
    expect(filesMatching(/\?lift=/)).toEqual([])
    expect(ALL.filter((f) => /radar-literal-variant/.test(read(f)))).toEqual(["vitest.config.ts"])
    expect(read("vitest.config.ts")).toMatch(/import \{ radarLiteralVariant \} from "\.\/vitest-env\/radar-literal-variant"/)
    expect(read("vitest.config.ts")).toMatch(/plugins: \[radarLiteralVariant\(\)\]/)
  })

  it("the plugin rewrites in MEMORY one exact declaration, only for the exact query on this one file, and writes nothing", () => {
    const text = code(PLUGIN)
    expect(text).not.toMatch(/^\s*import\b|require\(|node:fs|writeFile|appendFile|process\.env|child_process|fetch\(/m)
    expect(text).toContain('enforce: "pre" as const')
    expect(text).toMatch(/\\\?lift=\(production\|loopback\|staging\)\$/)
    expect(text).toMatch(/scripts\[\\\\\/\]radar-seed-run\\\.ts/)
    expect(text).toContain("const ${literal} = false")
    // the three classes it knows are exactly the three literals of the program
    expect(read(PLUGIN)).toContain('["production", "loopback", "staging"]')
    expect(LITERALS.map((l) => l.name.replace("_SEED_ENABLED", "").toLowerCase()).sort()).toEqual(["loopback", "production", "staging"])
  })

  it("the plugin, run on the SHIPPED text, lifts exactly the literal asked for — and on any other id returns nothing", async () => {
    const { radarLiteralVariant } = await import("../../vitest-env/radar-literal-variant")
    const plugin = radarLiteralVariant()
    const shipped = read(RUN)
    const id = (q: string) => `${root}/scripts/radar-seed-run.ts${q}`
    for (const lit of LITERALS) {
      const lifted = plugin.transform(shipped, id(`?lift=${lit.cls === "bouclage" ? "loopback" : lit.cls}`))
      expect(lifted, lit.name).not.toBeNull()
      const after = lifted?.code ?? ""
      expect(after).toContain(`\nconst ${lit.name} = true\n`)
      expect(after).not.toContain(`\nconst ${lit.name} = false\n`)
      // the other two stay false, and nothing else changed
      for (const other of LITERALS.filter((l) => l.name !== lit.name)) expect(after).toContain(`\nconst ${other.name} = false\n`)
      expect(after.replace(`const ${lit.name} = true`, `const ${lit.name} = false`)).toBe(shipped)
    }
    expect(plugin.transform(shipped, id(""))).toBeNull()
    expect(plugin.transform(shipped, id("?lift=other"))).toBeNull()
    expect(plugin.transform(shipped, `${root}/scripts/other.ts?lift=staging`)).toBeNull()
    expect(() => plugin.transform("const x = 1\n", id("?lift=staging"))).toThrow(/expected exactly one/)
  })
})

describe("V5 — hostile probe: no export of the pure or I/O modules can produce a client, a token or a function", () => {
  const original = (Module as unknown as { _load: (...a: unknown[]) => unknown })._load
  afterEach(() => vi.restoreAllMocks())

  const hostile: unknown[] = [
    undefined,
    null,
    "",
    "x",
    42,
    {},
    { ok: true },
    { ok: true, token: {}, url: "postgresql://u:p@h/db", cls: "production", identity: {} },
    { ok: true, needsTypedProof: false, warnings: [] },
    [],
    ["--force"],
    () => ({ ok: true }),
  ]

  it("every exported function, called with forged inputs, never loads the generated client and never returns a function or a promise", () => {
    const load = vi.spyOn(Module as unknown as { _load: (...a: unknown[]) => unknown }, "_load").mockImplementation(function (this: unknown, ...args: unknown[]) {
      if (args[0] === ".prisma/client-mi") throw new Error("CLIENT_REQUESTED")
      return Reflect.apply(original, this, args)
    })
    const modules = { radarTarget, entrySnapshot, radarPrompt, radarSources } as Record<string, Record<string, unknown>>
    let called = 0
    for (const [moduleName, exported] of Object.entries(modules)) {
      for (const [name, value] of Object.entries(exported)) {
        if (typeof value !== "function") continue
        // The terminal and the file readers do real I/O when given real arguments; forging them is covered elsewhere (real temp files).
        if (moduleName === "radarPrompt" || (moduleName === "radarSources" && ["readRadarSources", "inspectEnvSurface", "readClientConfig"].includes(name))) continue
        for (const input of hostile) {
          let result: unknown
          try {
            result = (value as (...a: unknown[]) => unknown)(input, input)
          } catch {
            result = undefined
          }
          called += 1
          expect(typeof result === "function" || result instanceof Promise, `${moduleName}.${name}`).toBe(false)
          expect(JSON.stringify(result ?? null) ?? "").not.toMatch(/PrismaClient/)
        }
      }
    }
    expect(called).toBeGreaterThan(100)
    expect(load.mock.calls.filter((c) => c[0] === ".prisma/client-mi")).toEqual([])
    expect(Object.keys(radarTarget).filter((k) => /token|client|factory|mint|redeem/i.test(k))).toEqual([])
  })
})
