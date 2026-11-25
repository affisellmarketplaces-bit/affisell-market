/**
 * Strict baseline of the historical divergences between the migration chain and prisma/schema.prisma
 * (founder decision 2026-11-24, docs/SCHEMA-DRIFT-BASELINE.md). Pure: no I/O, no database.
 *
 * Two independent comparisons, both exact (no pattern, no wildcard, no « close enough »):
 *   1. the statements `prisma migrate diff --to-schema-datamodel --script` emits for a chain-built database,
 *      split into ONE statement per clause, against the baseline's statements;
 *   2. the catalogue fact behind each accepted statement (index definition, column type + default, CHECK constraint)
 *      read on that same database, against the fact recorded in the baseline — a divergence that keeps the same
 *      Prisma statement but changes underneath (another column, another default) is caught here.
 * Anything not in the baseline = new divergence. A baseline entry no longer observed = disappeared or modified.
 * All of them fail.
 */

export const BASELINE_FORMAT = "affisell.schema-drift-baseline"

export const DRIFT_CATEGORIES = [
  "extra_index",
  "unmodelled_default",
  "timestamp_type",
  "partial_unique_index",
  "truncated_index_name",
] as const
export type DriftCategory = (typeof DRIFT_CATEGORIES)[number]

export type FactKind = "index" | "column" | "check"
export type CatalogFact = { kind: FactKind; key: string; value: string }

export type BaselineEntry = {
  id: string
  category: DriftCategory
  statement: string
  fact: CatalogFact
  reason: string
  risk: string
}
export type NonPrismaConstraint = {
  id: string
  category: "check_constraint"
  fact: CatalogFact
  reason: string
  risk: string
}
export type SchemaDriftBaseline = {
  format: string
  version: number
  recordedAt: string
  decision: string
  evidence: string
  scope: string
  entries: BaselineEntry[]
  nonPrismaConstraints: NonPrismaConstraint[]
  checkedTables: string[]
}

/** Marker written by the absent side of a catalogue read. */
export const ABSENT = "<absent>"

const collapse = (s: string) => s.replace(/\s+/g, " ").trim()

/**
 * `prisma migrate diff --script` output → one normalised statement per clause.
 * Comment lines and the repo's `[ensure-direct-url]` banner are dropped; a multi-clause ALTER TABLE
 * (`ALTER TABLE "X" ALTER COLUMN "a" …, ALTER COLUMN "b" …`) becomes one statement per clause so each
 * divergence is identified on its own. Commas inside parentheses (types, column lists) are never split points.
 */
export function normalizeDiffScript(script: string): string[] {
  const body = script
    .split("\n")
    .filter((line) => !line.trim().startsWith("--") && !line.startsWith("[ensure-direct-url]"))
    .join("\n")
  const out: string[] = []
  for (const raw of splitTopLevel(body, ";")) {
    const stmt = collapse(raw)
    if (!stmt) continue
    const alter = /^ALTER TABLE ("(?:[^"]|"")+")\s+([\s\S]*)$/.exec(stmt)
    if (alter) {
      const clauses = splitTopLevel(alter[2], ",").map(collapse).filter(Boolean)
      if (clauses.length > 1 && clauses.every((c) => /^(ALTER|ADD|DROP|RENAME)\b/.test(c))) {
        for (const c of clauses) out.push(`ALTER TABLE ${alter[1]} ${c}`)
        continue
      }
    }
    out.push(stmt)
  }
  return out
}

/** Split on `sep` outside parentheses and outside quotes. */
function splitTopLevel(text: string, sep: string): string[] {
  const parts: string[] = []
  let depth = 0
  let quote: string | null = null
  let cur = ""
  for (const ch of text) {
    if (quote) {
      if (ch === quote) quote = null
    } else if (ch === '"' || ch === "'") quote = ch
    else if (ch === "(") depth++
    else if (ch === ")") depth = Math.max(0, depth - 1)
    else if (ch === sep && depth === 0) {
      parts.push(cur)
      cur = ""
      continue
    }
    cur += ch
  }
  parts.push(cur)
  return parts
}

/**
 * Catalogue dump lines `kind|key|value` (value may contain `|`: everything after the second one) → map.
 * Duplicate keys are kept as an error: a catalogue read that lists one object twice is not trusted.
 */
export function parseCatalog(text: string): { facts: Map<string, string>; duplicates: string[] } {
  const facts = new Map<string, string>()
  const duplicates: string[] = []
  for (const line of text.split("\n")) {
    if (!line.trim()) continue
    const a = line.indexOf("|")
    const b = a < 0 ? -1 : line.indexOf("|", a + 1)
    if (a < 0 || b < 0) continue
    const key = `${line.slice(0, a)}|${line.slice(a + 1, b)}`
    if (facts.has(key)) duplicates.push(key)
    facts.set(key, line.slice(b + 1).trim())
  }
  return { facts, duplicates }
}

const factKey = (f: CatalogFact) => `${f.kind}|${f.key}`

/** Problems that make a baseline file itself unacceptable — checked before anything is compared. */
export function validateBaseline(b: unknown): string[] {
  const errs: string[] = []
  const x = b as SchemaDriftBaseline
  if (!x || x.format !== BASELINE_FORMAT) return ["format inconnu (affisell.schema-drift-baseline attendu)"]
  if (!Number.isInteger(x.version) || x.version < 1) errs.push("version absente ou invalide")
  if (!Array.isArray(x.entries) || !Array.isArray(x.nonPrismaConstraints) || !Array.isArray(x.checkedTables))
    return [...errs, "entries / nonPrismaConstraints / checkedTables doivent être des listes"]
  const ids = new Set<string>()
  const stmts = new Set<string>()
  for (const e of [...x.entries, ...x.nonPrismaConstraints]) {
    if (!e.id || ids.has(e.id)) errs.push(`identifiant absent ou en double : ${e.id ?? "(vide)"}`)
    ids.add(e.id)
    if (!e.reason?.trim()) errs.push(`${e.id} : justification absente`)
    if (!e.risk?.trim()) errs.push(`${e.id} : risque absent`)
    if (!e.fact || !e.fact.key || typeof e.fact.value !== "string" || !["index", "column", "check"].includes(e.fact.kind))
      errs.push(`${e.id} : fait de catalogue absent ou invalide`)
  }
  for (const e of x.entries) {
    if (!(DRIFT_CATEGORIES as readonly string[]).includes(e.category)) errs.push(`${e.id} : catégorie inconnue ${e.category}`)
    const s = collapse(e.statement ?? "")
    if (!s) errs.push(`${e.id} : instruction absente`)
    if (s !== e.statement) errs.push(`${e.id} : instruction non normalisée (espaces)`)
    // Exact strings only: anything that looks like a pattern would let one entry cover many divergences.
    if (/[*?]|\.\*|\\[dws]|%/.test(s)) errs.push(`${e.id} : motif interdit dans l'instruction (comparaison exacte seulement)`)
    if (s.endsWith(";")) errs.push(`${e.id} : instruction terminée par « ; »`)
    if (normalizeDiffScript(s).length !== 1) errs.push(`${e.id} : une entrée = une seule instruction`)
    if (stmts.has(s)) errs.push(`${e.id} : instruction en double`)
    stmts.add(s)
  }
  for (const c of x.nonPrismaConstraints) {
    if (c.category !== "check_constraint" || c.fact?.kind !== "check") errs.push(`${c.id} : seule une contrainte CHECK est admise ici`)
    const table = c.fact?.key?.split(".")[0]
    if (table && !x.checkedTables.includes(table)) errs.push(`${c.id} : table ${table} hors du périmètre vérifié`)
  }
  return errs
}

export type DriftVerdict = {
  ok: boolean
  baselineErrors: string[]
  accepted: { id: string; category: DriftCategory; statement: string }[]
  /** Statements Prisma emits that no baseline entry lists. */
  unexpected: string[]
  /** Baseline statements Prisma no longer emits (divergence fixed, renamed or changed). */
  disappeared: { id: string; statement: string }[]
  /** Statement still emitted but the object underneath is not what the baseline recorded. */
  modified: { id: string; key: string; expected: string; observed: string }[]
  /** CHECK constraints on the checked tables that are not in the baseline. */
  unexpectedConstraints: { key: string; value: string }[]
  /** Baseline CHECK constraints absent or different. */
  constraintMismatches: { id: string; key: string; expected: string; observed: string }[]
  catalogDuplicates: string[]
}

export function compareToBaseline(baseline: SchemaDriftBaseline, diffScript: string, catalogText: string): DriftVerdict {
  const baselineErrors = validateBaseline(baseline)
  const empty: DriftVerdict = {
    ok: false, baselineErrors, accepted: [], unexpected: [], disappeared: [], modified: [],
    unexpectedConstraints: [], constraintMismatches: [], catalogDuplicates: [],
  }
  if (baselineErrors.length) return empty

  const actual = normalizeDiffScript(diffScript)
  const actualSet = new Map<string, number>()
  for (const s of actual) actualSet.set(s, (actualSet.get(s) ?? 0) + 1)
  const { facts, duplicates } = parseCatalog(catalogText)

  const accepted: DriftVerdict["accepted"] = []
  const disappeared: DriftVerdict["disappeared"] = []
  const modified: DriftVerdict["modified"] = []
  const listed = new Set(baseline.entries.map((e) => e.statement))
  for (const e of baseline.entries) {
    if (!actualSet.has(e.statement)) disappeared.push({ id: e.id, statement: e.statement })
    else accepted.push({ id: e.id, category: e.category, statement: e.statement })
    const observed = facts.get(factKey(e.fact)) ?? ABSENT
    if (observed !== e.fact.value) modified.push({ id: e.id, key: factKey(e.fact), expected: e.fact.value, observed })
  }
  const unexpected = [...actualSet.entries()].flatMap(([s, n]) =>
    !listed.has(s) ? [s] : n > 1 ? [`${s}   (émise ${n} fois)`] : [],
  )

  const checked = new Set(baseline.checkedTables)
  const allowedChecks = new Map(baseline.nonPrismaConstraints.map((c) => [factKey(c.fact), c]))
  const unexpectedConstraints: DriftVerdict["unexpectedConstraints"] = []
  for (const [k, v] of facts) {
    if (!k.startsWith("check|")) continue
    if (!checked.has(k.slice(6).split(".")[0])) continue
    if (!allowedChecks.has(k)) unexpectedConstraints.push({ key: k, value: v })
  }
  const constraintMismatches: DriftVerdict["constraintMismatches"] = []
  for (const c of baseline.nonPrismaConstraints) {
    const observed = facts.get(factKey(c.fact)) ?? ABSENT
    if (observed !== c.fact.value) constraintMismatches.push({ id: c.id, key: factKey(c.fact), expected: c.fact.value, observed })
  }

  const ok =
    unexpected.length === 0 && disappeared.length === 0 && modified.length === 0 &&
    unexpectedConstraints.length === 0 && constraintMismatches.length === 0 && duplicates.length === 0
  return { ok, baselineErrors, accepted, unexpected, disappeared, modified, unexpectedConstraints, constraintMismatches, catalogDuplicates: duplicates }
}

/** Human-readable report (French: founder-facing). Markdown, also readable as plain text in a CI log. */
export function formatDriftReport(v: DriftVerdict, label: string, baseline: SchemaDriftBaseline | null): string {
  const L: string[] = []
  L.push(`## Dérive de schéma — ${label} : ${v.ok ? "CONFORME À LA BASELINE" : "REJETÉE"}`)
  if (baseline) L.push(`Baseline v${baseline.version} (${baseline.recordedAt}) — ${baseline.entries.length} écarts + ${baseline.nonPrismaConstraints.length} contrainte(s) hors Prisma.`)
  if (v.baselineErrors.length) {
    L.push("", "### Baseline invalide (rien n'a été comparé)")
    for (const e of v.baselineErrors) L.push(`- ${e}`)
    return L.join("\n")
  }
  const byCat = new Map<string, number>()
  for (const a of v.accepted) byCat.set(a.category, (byCat.get(a.category) ?? 0) + 1)
  L.push("", `### Écarts historiques acceptés (${v.accepted.length})`)
  for (const [c, n] of byCat) L.push(`- ${c} : ${n}`)
  const block = (title: string, rows: string[]) => {
    if (!rows.length) return
    L.push("", `### ${title} (${rows.length})`)
    for (const r of rows) L.push(`- ${r}`)
  }
  block("NOUVELLE divergence — absente de la baseline", v.unexpected)
  block("Écart de la baseline DISPARU ou changé — mettre la baseline à jour, avec justification", v.disappeared.map((d) => `${d.id} : ${d.statement}`))
  block("Écart existant MODIFIÉ (même instruction Prisma, objet différent)", v.modified.map((m) => `${m.id} ${m.key}\n  attendu : ${m.expected}\n  observé : ${m.observed}`))
  block("Contrainte CHECK NON répertoriée sur une table vérifiée", v.unexpectedConstraints.map((c) => `${c.key} ${c.value}`))
  block("Contrainte CHECK répertoriée absente ou différente", v.constraintMismatches.map((m) => `${m.id} ${m.key}\n  attendu : ${m.expected}\n  observé : ${m.observed}`))
  block("Lecture du catalogue douteuse (objet listé deux fois)", v.catalogDuplicates)
  if (!v.ok) L.push("", "Cause de l'échec : toute divergence non répertoriée, modifiée ou disparue est rejetée. Corriger le schéma ou la migration ; ne l'ajouter à la baseline qu'avec une décision écrite.")
  return L.join("\n")
}
