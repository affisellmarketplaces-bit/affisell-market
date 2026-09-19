/**
 * Compare LLM providers on the supplier "optimize variants" task, with objective checks.
 *   npx tsx scripts/llm-eval/run-variants-eval.ts            # all configured providers
 *   npx tsx scripts/llm-eval/run-variants-eval.ts --only groq
 * Providers: groq (GROQ_API_KEY, model = GROQ_TEXT_MODEL) and claude (ANTHROPIC_API_KEY, model = EVAL_CLAUDE_MODEL,
 * default claude-haiku-4-5-20251001). A provider without a key is skipped. Costs a few cents.
 */
import { config } from "dotenv"
import { existsSync } from "node:fs"
import { resolve } from "node:path"

for (const name of [".env", ".env.local"]) {
  const p = resolve(process.cwd(), name)
  if (existsSync(p)) config({ path: p, override: true })
}

import Groq from "groq-sdk"

import { GROQ_REASONING_HEADROOM_TOKENS } from "../../lib/ai/groq-client"

import { validateSimpleColorName } from "../../lib/supplier-simple-color-validation"
import { VARIANT_COLOR_REGEX } from "../../lib/supplier-sku-builder"
import { buildPrompt, extractJsonObject, normalizeAiPayload } from "../../lib/supplier-optimize-variants"
import { CASES, type EvalCase } from "./variants-cases"

type Provider = { id: string; label: string; call: (system: string, user: string) => Promise<{ text: string; ms: number; inTok?: number; outTok?: number }> }

const GROQ_MODEL = process.env.GROQ_TEXT_MODEL?.trim() || "openai/gpt-oss-20b"
const CLAUDE_MODEL = process.env.EVAL_CLAUDE_MODEL?.trim() || "claude-haiku-4-5-20251001"

const providers: Provider[] = []
if (process.env.GROQ_API_KEY?.trim()) {
  const client = new Groq({ apiKey: process.env.GROQ_API_KEY.trim() })
  providers.push({
    id: "groq",
    label: `Groq ${GROQ_MODEL}`,
    call: async (system, user) => {
      const t0 = Date.now()
      const r = await client.chat.completions.create({
        model: GROQ_MODEL,
        temperature: 0.25,
        // Mirrors production (lib/ai/groq-client.ts): visible-answer budget + reasoning headroom, low effort.
        max_tokens: 900 + GROQ_REASONING_HEADROOM_TOKENS,
        reasoning_effort: "low",
        messages: [{ role: "system", content: system }, { role: "user", content: user }],
      })
      return { text: r.choices[0]?.message?.content ?? "", ms: Date.now() - t0, inTok: r.usage?.prompt_tokens, outTok: r.usage?.completion_tokens }
    },
  })
}
if (process.env.ANTHROPIC_API_KEY?.trim()) {
  providers.push({
    id: "claude",
    label: `Claude ${CLAUDE_MODEL}`,
    call: async (system, user) => {
      const t0 = Date.now()
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "content-type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY!.trim(), "anthropic-version": "2023-06-01" },
        body: JSON.stringify({ model: CLAUDE_MODEL, max_tokens: 900, temperature: 0.25, system, messages: [{ role: "user", content: user }] }),
      })
      const j = (await res.json()) as { content?: Array<{ text?: string }>; usage?: { input_tokens?: number; output_tokens?: number }; error?: { message?: string } }
      if (!res.ok) throw new Error(j.error?.message ?? `HTTP ${res.status}`)
      return { text: j.content?.map((c) => c.text ?? "").join("") ?? "", ms: Date.now() - t0, inTok: j.usage?.input_tokens, outTok: j.usage?.output_tokens }
    },
  })
}

const only = process.argv.includes("--only") ? process.argv[process.argv.indexOf("--only") + 1] : null
const active = providers.filter((p) => !only || p.id === only)
if (active.length === 0) {
  console.error("No provider configured (GROQ_API_KEY / ANTHROPIC_API_KEY missing in .env.local).")
  process.exit(1)
}
for (const missing of ["groq", "claude"].filter((id) => !providers.some((p) => p.id === id))) {
  console.log(`(skipped ${missing}: API key not set)`)
}

const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").trim()
const CHECKS = ["json", "indexes", "rules", "gold", "sizes", "noInvention", "sku"] as const
type Check = (typeof CHECKS)[number]

function score(c: EvalCase, text: string) {
  const r: Partial<Record<Check, boolean>> = {}
  let parsed: unknown
  try {
    parsed = extractJsonObject(text)
    r.json = true
  } catch {
    return { r: { json: false } as Partial<Record<Check, boolean>>, detail: "invalid JSON" }
  }
  const raw = (parsed ?? {}) as { simpleColors?: Array<{ index: number; name: string }>; rows?: Array<{ index: number; color: string; size: string | null; sku: string | null }>; sizesText?: string }
  const norm = normalizeAiPayload(c.input, parsed)
  const outputs: Array<{ index: number; name: string }> =
    c.input.mode === "simple" ? (norm.simpleColors ?? []).map((x) => ({ index: x.index, name: x.name })) : (norm.rows ?? []).map((x) => ({ index: x.index, name: x.color }))
  const expectedIdx = (c.input.mode === "simple" ? c.input.simpleColors ?? [] : c.input.rows ?? []).map((x) => x.index).sort((a, b) => a - b)
  const gotIdx = outputs.map((o) => o.index).sort((a, b) => a - b)
  r.indexes = JSON.stringify(expectedIdx) === JSON.stringify(gotIdx)

  // rules: what the model returned RAW must already satisfy the platform rules (normalizer drops violators).
  const rawNames = c.input.mode === "simple" ? (raw.simpleColors ?? []).map((x) => x.name ?? "") : (raw.rows ?? []).map((x) => x.color ?? "")
  r.rules = rawNames.length > 0 && rawNames.every((n) => (c.input.mode === "simple" ? !validateSimpleColorName(n) : VARIANT_COLOR_REGEX.test(n) && n.length <= 48))

  if (c.gold) {
    r.gold = c.gold.every((gd) => {
      const o = outputs.find((x) => x.index === gd.index)
      return !!o && gd.anyOf.some((re) => re.test(fold(o.name)) || re.test(o.name))
    })
  }
  if (c.goldSizes) {
    const got = (raw.sizesText ?? "").split(/[,;/]/).map((t) => t.trim().toUpperCase()).filter(Boolean)
    r.sizes = c.goldSizes.length === got.length && c.goldSizes.every((s, i) => s === got[i])
  }
  if (c.goldRowSizes) {
    r.sizes = c.goldRowSizes.every((gs) => {
      const row = (raw.rows ?? []).find((x) => x.index === gs.index)
      const v = row?.size == null || row.size === "" ? null : String(row.size).trim().toUpperCase()
      return v === gs.size
    })
  }
  if (c.noDigits) r.noInvention = outputs.every((o) => !/\d/.test(o.name))
  if (c.input.mode === "advanced") {
    const prefix = (c.skuPrefix ?? "PRD").toUpperCase()
    r.sku = (raw.rows ?? []).length > 0 && (raw.rows ?? []).every((x) => typeof x.sku === "string" && x.sku === x.sku.toUpperCase() && x.sku.startsWith(prefix) && !/\s/.test(x.sku) && x.sku.length <= 64)
  }
  return { r, detail: "" }
}

async function main() {
  const results: Record<string, { cases: number; pass: number; checks: Record<string, [number, number]>; ms: number[]; inTok: number; outTok: number; failures: string[] }> = {}
  for (const p of active) {
    results[p.id] = { cases: 0, pass: 0, checks: {}, ms: [], inTok: 0, outTok: 0, failures: [] }
  }
  for (const c of CASES) {
    const { system, user } = buildPrompt(c.input)
    for (const p of active) {
      const agg = results[p.id]!
      agg.cases++
      let text = ""
      try {
        const out = await p.call(system, user)
        text = out.text
        agg.ms.push(out.ms)
        agg.inTok += out.inTok ?? 0
        agg.outTok += out.outTok ?? 0
      } catch (e) {
        agg.failures.push(`${c.id}: API error ${String((e as Error).message).slice(0, 80)}`)
        continue
      }
      const { r, detail } = score(c, text)
      let allOk = true
      for (const k of CHECKS) {
        if (r[k] === undefined) continue
        const cur = (agg.checks[k] ??= [0, 0])
        cur[1]++
        if (r[k]) cur[0]++
        else {
          allOk = false
          agg.failures.push(`${c.id} [${c.tag}] fails "${k}"${detail ? ` (${detail})` : ""}`)
        }
      }
      if (allOk) agg.pass++
    }
    process.stdout.write(".")
  }
  console.log("\n")
  const pct = (a: number, b: number) => (b ? `${Math.round((100 * a) / b)}%` : "—")
  const med = (xs: number[]) => (xs.length ? [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]! : 0)
  console.log(`Cases: ${CASES.length}  |  strict pass = all checks of the case OK\n`)
  for (const p of active) {
    const a = results[p.id]!
    console.log(`== ${p.label}`)
    console.log(`   strict pass : ${a.pass}/${a.cases} (${pct(a.pass, a.cases)})`)
    console.log(`   checks      : ${Object.entries(a.checks).map(([k, [ok, n]]) => `${k} ${ok}/${n}`).join("  ")}`)
    console.log(`   latency     : median ${med(a.ms)} ms, max ${Math.max(0, ...a.ms)} ms`)
    console.log(`   tokens      : in ${a.inTok}, out ${a.outTok}`)
    if (a.failures.length) console.log(`   failures    :\n     - ${a.failures.join("\n     - ")}`)
    console.log("")
  }
}
main().catch((e) => { console.error(e); process.exit(1) })
