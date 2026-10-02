import { parseJsonObject, type anthropicMessagesText } from "@/lib/ai/anthropic-messages"
import {
  CHOOSE_SYSTEM,
  MAX_PICKS,
  clamp01,
  globalLexicalCandidates,
  normalizeIdentity,
  productBlocks,
  trimCandidates,
  type ChoosePayload,
  type TaxonomyBrowse,
  type TaxonomyIdentity,
  type TaxonomyPick,
} from "@/lib/ai/taxonomy-classifier"
import type { LeafPath } from "@/lib/category-browse-shared"

/**
 * Token-frugal variant of the taxonomy classifier, for providers with a small per-minute budget (Groq: 8 000
 * tokens/min/model on this account). Same idea as the full classifier — understand the item, then choose among
 * exact leaves — but sized to fit:
 *
 *   1. IDENTIFY: item identity + bilingual keywords + up to 3 DEPARTMENTS out of ~23 (≈ 0.8 k tokens, vs ≈ 4 k for the
 *      ~190-section list of the full classifier);
 *   2. CHOOSE: ≤ 80 candidate leaves — the best lexical matches of the picked departments plus a cross-department
 *      rescue — ranked with the MODEL's own French/English keywords (≈ 2.3 k tokens, vs ≈ 12 k for 420 candidates).
 *
 * One classification ≈ 3.5–4 k tokens, i.e. a couple per minute per model, and failures degrade to "no suggestion".
 */

const MAX_DEPARTMENT_PICKS = 3
const MAX_LITE_CANDIDATES = 80
const LITE_GLOBAL_RESCUE = 24

const IDENTIFY_LITE_SYSTEM = `You are the product-taxonomy expert of a European online marketplace (Google Product Taxonomy, French labels).

Step 1: understand what the item REALLY is, then pick the department(s) it belongs to.

Rules:
- If a photo is provided, it is the truth about the item; the supplier's title can be wrong, keyword-stuffed or written in English while the taxonomy is French.
- Classify the item that is SOLD, not its accessories, packaging, power source or features.
- Names are short generic product types: no brands, no marketing words.
- "keywords": 6-10 words that would appear in the CATEGORY NAME of this product in a FRENCH taxonomy (French words first, then English), e.g. ["montre connectée","montres","smartwatch"].
- "departments": up to ${MAX_DEPARTMENT_PICKS} codes from the list, best first.

Answer with JSON only:
{
  "identity": {
    "nameEn": string, "nameFr": string, "kind": string,
    "keywords": string[],
    "photoShows": string,            // "" if no photo
    "photoTitleConflict": boolean,   // photo and title clearly describe different products
    "confidence": number             // 0-1: how sure you are about what the item is
  },
  "departments": [ { "code": string, "confidence": number } ]
}`

type IdentifyLitePayload = {
  identity?: Partial<TaxonomyIdentity>
  departments?: Array<{ code?: string; confidence?: number }>
}

/** Root name + last two segments: enough to disambiguate, ≈ 40 % fewer tokens than the full breadcrumb. */
function shortPath(lp: LeafPath): string {
  const names = lp.path.map((p) => p.name)
  return names.length <= 3 ? names.join(" > ") : [names[0], names[names.length - 2], names[names.length - 1]].join(" > ")
}

function leavesUnder(browse: TaxonomyBrowse, id: string, memo: Map<string, string[]>): string[] {
  const cached = memo.get(id)
  if (cached) return cached
  const kids = browse.childrenByParent[id] ?? []
  const out = kids.length === 0 ? [id] : kids.flatMap((k) => leavesUnder(browse, k, memo))
  memo.set(id, out)
  return out
}

export async function classifyProductTaxonomyLite(
  input: { title: string; description?: string; imageUrl?: string | null },
  data: { browse: TaxonomyBrowse; leafPaths: LeafPath[] },
  deps: { callModel: typeof anthropicMessagesText }
): Promise<{ identity: TaxonomyIdentity; picks: TaxonomyPick[] } | null> {
  const call = deps.callModel
  const roots = data.browse.rootIds
    .map((id, i) => ({ code: `r${i + 1}`, id, name: data.browse.nodes[id]?.name ?? "" }))
    .filter((r) => r.name)
  if (roots.length === 0) return null
  const leafById = new Map(data.leafPaths.map((lp) => [lp.leafId, lp]))
  const imageUrl = input.imageUrl?.trim() || null

  // ── Step 1 — identity + departments ──
  const stage1 = await call({
    system: [
      { type: "text", text: IDENTIFY_LITE_SYSTEM },
      { type: "text", text: `DEPARTMENTS (code | name):\n${roots.map((r) => `${r.code} | ${r.name}`).join("\n")}` },
    ],
    content: productBlocks({ ...input, imageUrl }),
    maxTokens: 600,
    timeoutMs: 12_000,
  })
  const p1 = parseJsonObject<IdentifyLitePayload>(stage1)
  if (!p1) return null
  const identity = normalizeIdentity(p1.identity, input.title.trim())

  const byCode = new Map(roots.map((r) => [r.code, r]))
  const memo = new Map<string, string[]>()
  const departmentLeafIds = [
    ...new Set(
      (Array.isArray(p1.departments) ? p1.departments : [])
        .map((d) => (typeof d.code === "string" ? byCode.get(d.code.trim()) : undefined))
        .filter((r): r is { code: string; id: string; name: string } => Boolean(r))
        .slice(0, MAX_DEPARTMENT_PICKS)
        .flatMap((r) => leavesUnder(data.browse, r.id, memo))
    ),
  ]

  const rescue = globalLexicalCandidates(data.leafPaths, identity, input.title, LITE_GLOBAL_RESCUE)
  const rescueSet = new Set(rescue)
  const candidates = [
    ...rescue,
    ...trimCandidates(
      departmentLeafIds.filter((id) => !rescueSet.has(id)),
      leafById,
      identity,
      Math.max(0, MAX_LITE_CANDIDATES - rescue.length)
    ),
  ].slice(0, MAX_LITE_CANDIDATES)

  const candidateLines = candidates
    .map((id, i) => ({ code: `c${i + 1}`, lp: leafById.get(id) }))
    .filter((c): c is { code: string; lp: LeafPath } => Boolean(c.lp))
  if (candidateLines.length === 0) return { identity, picks: [] }
  const byCandidate = new Map(candidateLines.map((c) => [c.code, c.lp]))

  // ── Step 2 — the exact leaves ──
  const stage2 = await call({
    system: [{ type: "text", text: CHOOSE_SYSTEM }],
    content: [
      ...productBlocks({ ...input, imageUrl }),
      {
        type: "text",
        text:
          `Identified: ${identity.nameEn} (${identity.nameFr}) — ${identity.kind}. ` +
          `${identity.photoShows ? `Photo shows: ${identity.photoShows}. ` : ""}` +
          `Keywords: ${identity.keywords.join(", ")}\n\nCANDIDATES (code | path):\n` +
          candidateLines.map((c) => `${c.code} | ${shortPath(c.lp)}`).join("\n"),
      },
    ],
    maxTokens: 500,
    timeoutMs: 12_000,
  })
  const p2 = parseJsonObject<ChoosePayload>(stage2)
  const seen = new Set<string>()
  const picks: TaxonomyPick[] = []
  for (const row of Array.isArray(p2?.picks) ? p2!.picks! : []) {
    const lp = typeof row.code === "string" ? byCandidate.get(row.code.trim()) : undefined
    if (!lp || seen.has(lp.leafId)) continue
    seen.add(lp.leafId)
    picks.push({
      ...lp,
      confidence: clamp01(row.confidence, 0.4),
      reason: typeof row.reason === "string" ? row.reason.trim().slice(0, 200) : "",
    })
    if (picks.length >= MAX_PICKS) break
  }
  picks.sort((a, b) => b.confidence - a.confidence)
  return { identity, picks }
}
