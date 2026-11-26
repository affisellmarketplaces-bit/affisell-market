/**
 * Finds every place in the repository that can change the LIFE of a reseller listing (`AffiliateProduct`): creation,
 * listing / unlisting, relisting, deletion — whoever writes it. Used by `listing-mutation-provenance.test.ts` (the CI
 * lock) and by nothing that ships: it reads source files with the TypeScript compiler's parser, not with text
 * patterns, so a new write is found whatever its formatting, and an update that does not touch `isListed` is told apart
 * from one that may.
 *
 * What counts (the database trigger fires on exactly these): INSERT (create / createMany / createManyAndReturn /
 * upsert), DELETE (delete / deleteMany), and UPDATE when it MAY set `isListed` (update / updateMany whose `data` is not
 * a literal without `isListed`). Also: Prisma nested writes through a relation (`affiliateProducts: { create … }`) and
 * raw SQL that writes the table. An update whose `data` is an object literal without `isListed` and without spread
 * provably fires nothing and is reported as `no_presence_effect`.
 */
import { readdirSync, readFileSync, statSync } from "node:fs"
import path from "node:path"

import ts from "typescript"

export const WRITE_METHODS = ["create", "createMany", "createManyAndReturn", "upsert", "update", "updateMany", "delete", "deleteMany"] as const
const NESTED_KEYS = new Set(["create", "createMany", "connectOrCreate", "upsert", "update", "updateMany", "delete", "deleteMany", "set"])
const SKIP_DIRS = new Set(["node_modules", ".next", ".git", "Affisell_Audit_Package", "coverage", "dist", "public", "__tests__", ".vercel", ".turbo"])
const EXT = /\.(ts|tsx|mts|cts|js|mjs|cjs)$/
const RAW_SQL_WRITE = /\b(INSERT\s+INTO|UPDATE|DELETE\s+FROM|TRUNCATE(?:\s+TABLE)?)\s+(?:ONLY\s+)?(?:"?public"?\.)?"?AffiliateProduct"?(?![A-Za-z_])/i
const PRESENCE_SET_CONFIG = /affisell\.listing_presence_source['"]?\s*,\s*['"]([a-z0-9_.:-]+)['"]/

export type Attribution =
  | { kind: "declared"; sources: string[]; via: "withListingPresenceSource" | "declareListingPresenceSource" | "set_config" }
  /** Declared through the price-history helpers: the trigger falls back to the price source of the same transaction. */
  | { kind: "inherited_price_source"; sources: string[]; via: string }
  | { kind: "none" }

export type MutationSite = {
  /** Repo-relative path, forward slashes. */
  file: string
  line: number
  /** Nearest named enclosing function / method / variable (or `<module>`). */
  fn: string
  method: string
  effect: "presence" | "no_presence_effect"
  effectReason: string
  attribution: Attribution
}

function walk(dir: string, root: string, out: string[]) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue
    const full = path.join(dir, name)
    const st = statSync(full)
    if (st.isDirectory()) walk(full, root, out)
    else if (EXT.test(name) && !/\.(test|spec)\.[cm]?[jt]sx?$/.test(name) && !name.endsWith(".d.ts")) out.push(full)
  }
}

export function listSourceFiles(root: string): string[] {
  const out: string[] = []
  walk(root, root, out)
  return out
}

function scriptKind(file: string): ts.ScriptKind {
  if (file.endsWith(".tsx")) return ts.ScriptKind.TSX
  if (/\.(js|mjs|cjs)$/.test(file)) return ts.ScriptKind.JS
  return ts.ScriptKind.TS
}

function nameOf(node: ts.Node): string | null {
  if (ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node)) return node.name ? node.name.getText() : null
  if ((ts.isArrowFunction(node) || ts.isFunctionExpression(node)) && node.parent) {
    const p = node.parent
    if (ts.isVariableDeclaration(p)) return p.name.getText()
    if (ts.isPropertyAssignment(p)) return p.name.getText()
  }
  return null
}

function enclosingName(node: ts.Node): string {
  for (let n: ts.Node | undefined = node.parent; n; n = n.parent) {
    const name = nameOf(n)
    if (name) return name
  }
  return "<module>"
}

function calleeName(call: ts.CallExpression): string | null {
  const e = call.expression
  if (ts.isIdentifier(e)) return e.text
  if (ts.isPropertyAccessExpression(e)) return e.name.text
  return null
}

/** String literals that are known presence sources, anywhere in a node (handles `cond ? "a" : "b"`). */
function sourceLiterals(node: ts.Node | undefined, known: readonly string[]): string[] {
  const found = new Set<string>()
  const visit = (n: ts.Node) => {
    if ((ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) && known.includes(n.text)) found.add(n.text)
    ts.forEachChild(n, visit)
  }
  if (node) visit(node)
  return [...found]
}

function sourceOptionOf(arg: ts.Expression | undefined, known: readonly string[]): string[] {
  if (!arg) return []
  if (ts.isObjectLiteralExpression(arg)) {
    const prop = arg.properties.find((p) => ts.isPropertyAssignment(p) && p.name.getText() === "source") as ts.PropertyAssignment | undefined
    return prop ? sourceLiterals(prop.initializer, known) : []
  }
  return []
}

/** Declarations (call or raw set_config) inside a subtree. */
function declarationsIn(node: ts.Node, known: readonly string[]): Attribution | null {
  let found: Attribution | null = null
  const visit = (n: ts.Node) => {
    if (found) return
    if (ts.isCallExpression(n) && calleeName(n) === "declareListingPresenceSource") {
      found = { kind: "declared", sources: sourceOptionOf(n.arguments[1], known), via: "declareListingPresenceSource" }
      return
    }
    if (ts.isTemplateExpression(n) || ts.isNoSubstitutionTemplateLiteral(n) || ts.isStringLiteral(n)) {
      const m = n.getText().match(PRESENCE_SET_CONFIG)
      if (m) {
        found = { kind: "declared", sources: [m[1]!], via: "set_config" }
        return
      }
    }
    ts.forEachChild(n, visit)
  }
  visit(node)
  return found
}

function attributionOf(call: ts.Node, known: readonly string[]): Attribution {
  for (let n: ts.Node | undefined = call.parent; n; n = n.parent) {
    if (!ts.isCallExpression(n)) continue
    const name = calleeName(n)
    if (name === "withListingPresenceSource") return { kind: "declared", sources: sourceOptionOf(n.arguments[1], known), via: "withListingPresenceSource" }
    if (name && PRICE_WRAPPERS.has(name)) return { kind: "inherited_price_source", sources: sourceOptionOf(n.arguments[1], known), via: name }
    if (name === "$transaction") {
      // The declaration must be in the SAME transaction (callback body or batch array).
      const d = declarationsIn(n, known)
      if (d) return d
    }
  }
  return { kind: "none" }
}

function dataEffect(dataExpr: ts.Expression | undefined, missing: string): { effect: MutationSite["effect"]; reason: string } {
  if (!dataExpr) return { effect: "presence", reason: missing }
  const keys = literalKeys(dataExpr)
  if (!keys) return { effect: "presence", reason: "data not provable (variable, call or non-literal spread)" }
  if (keys.includes("isListed")) return { effect: "presence", reason: "data sets isListed" }
  return { effect: "no_presence_effect", reason: `data without isListed (${[...new Set(keys)].join(", ")})` }
}

function updateEffect(call: ts.CallExpression): { effect: MutationSite["effect"]; reason: string } {
  const arg = call.arguments[0]
  if (!arg || !ts.isObjectLiteralExpression(arg)) return { effect: "presence", reason: "arguments not a literal" }
  if (arg.properties.some(ts.isSpreadAssignment)) return { effect: "presence", reason: "arguments spread" }
  const dataProp = arg.properties.find((p) => (ts.isPropertyAssignment(p) || ts.isShorthandPropertyAssignment(p)) && p.name.getText() === "data")
  if (!dataProp) return { effect: "presence", reason: "no data" }
  if (ts.isShorthandPropertyAssignment(dataProp)) return { effect: "presence", reason: "data not provable (variable, call or non-literal spread)" }
  return dataEffect((dataProp as ts.PropertyAssignment).initializer, "no data")
}

const PRICE_WRAPPERS = new Set(["updateListingWithPriceSource", "upsertListingWithPriceSource"])

/** Keys an object literal may set, following spreads of literals / conditionals of literals. null = not provable. */
function literalKeys(e: ts.Expression): string[] | null {
  if (ts.isParenthesizedExpression(e)) return literalKeys(e.expression)
  if (ts.isConditionalExpression(e)) {
    const a = literalKeys(e.whenTrue)
    const b = literalKeys(e.whenFalse)
    return a && b ? [...a, ...b] : null
  }
  if (!ts.isObjectLiteralExpression(e)) return null
  const out: string[] = []
  for (const p of e.properties) {
    if (ts.isSpreadAssignment(p)) {
      const inner = literalKeys(p.expression)
      if (!inner) return null
      out.push(...inner)
    } else if (p.name) {
      if (ts.isComputedPropertyName(p.name)) return null
      out.push(p.name.getText().replace(/["']/g, ""))
    }
  }
  return out
}

export function scanFile(file: string, root: string, known: readonly string[]): MutationSite[] {
  const text = readFileSync(file, "utf8")
  if (!/affiliateProduct|AffiliateProduct|ListingWithPriceSource/.test(text)) return []
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, scriptKind(file))
  const rel = path.relative(root, file).split(path.sep).join("/")
  const out: MutationSite[] = []
  const site = (node: ts.Node, method: string, effect: MutationSite["effect"], effectReason: string): MutationSite => ({
    file: rel,
    line: sf.getLineAndCharacterOfPosition(node.getStart()).line + 1,
    fn: enclosingName(node),
    method,
    effect,
    effectReason,
    attribution: effect === "presence" ? attributionOf(node, known) : { kind: "none" },
  })
  const visit = (n: ts.Node) => {
    if (ts.isCallExpression(n)) {
      const e = n.expression
      const recv = ts.isPropertyAccessExpression(e) ? e.expression : null
      const method = ts.isPropertyAccessExpression(e) ? e.name.text : null
      const onModel =
        recv &&
        ((ts.isPropertyAccessExpression(recv) && recv.name.text === "affiliateProduct") ||
          (ts.isElementAccessExpression(recv) && ts.isStringLiteralLike(recv.argumentExpression) && recv.argumentExpression.text === "affiliateProduct"))
      if (onModel && method && (WRITE_METHODS as readonly string[]).includes(method)) {
        if (method === "update" || method === "updateMany") {
          const u = updateEffect(n)
          out.push(site(n, method, u.effect, u.reason))
        } else out.push(site(n, method, "presence", method.startsWith("delete") ? "delete" : "insert"))
      }
    }
    // Calls of the price-history helpers = writes made elsewhere: their effect is read from the arguments here.
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && PRICE_WRAPPERS.has(n.expression.text)) {
      const isUpsert = n.expression.text === "upsertListingWithPriceSource"
      const arg = n.arguments[0]
      const u = isUpsert
        ? { effect: "presence" as const, reason: "insert" }
        : arg && ts.isObjectLiteralExpression(arg)
          ? updateEffect(n)
          : { effect: "presence" as const, reason: "arguments not a literal" }
      out.push({
        ...site(n, `${n.expression.text}`, u.effect, u.reason),
        attribution: u.effect === "presence" ? { kind: "inherited_price_source", sources: sourceOptionOf(n.arguments[1], known), via: n.expression.text } : { kind: "none" },
      })
    }
    // Nested writes through the relation field of User / Product.
    if (ts.isPropertyAssignment(n) && n.name.getText() === "affiliateProducts" && ts.isObjectLiteralExpression(n.initializer)) {
      for (const p of n.initializer.properties) {
        const k = p.name?.getText()
        if (k && NESTED_KEYS.has(k)) out.push(site(p, `nested:${k}`, "presence", "relation nested write"))
      }
    }
    // Raw SQL that writes the table.
    if ((ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n) || ts.isTemplateExpression(n)) && RAW_SQL_WRITE.test(n.getText())) {
      out.push(site(n, "raw_sql", "presence", "raw SQL write"))
    }
    ts.forEachChild(n, visit)
  }
  visit(sf)
  return out
}

export function scanListingMutations(root: string, known: readonly string[]): MutationSite[] {
  return listSourceFiles(root).flatMap((f) => scanFile(f, root, known))
}

/** Stable identity of a site that survives line moves: file + enclosing function + method + rank within them. */
export function siteKeys(sites: readonly MutationSite[]): Array<MutationSite & { key: string }> {
  const seen = new Map<string, number>()
  return sites.map((s) => {
    const base = `${s.file}#${s.fn}#${s.method}`
    const n = (seen.get(base) ?? 0) + 1
    seen.set(base, n)
    return { ...s, key: n === 1 ? base : `${base}#${n}` }
  })
}
