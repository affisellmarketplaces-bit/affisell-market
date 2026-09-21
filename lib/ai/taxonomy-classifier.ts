import { anthropicMessagesText, parseJsonObject, type AnthropicContentBlock } from "@/lib/ai/anthropic-messages"
import type { BrowseNode, LeafPath } from "@/lib/category-browse-shared"

/**
 * Taxonomy classifier — "understand the product, then descend the tree".
 *
 *  1. IDENTIFY (vision + title): what the item really is (the photo wins over a wrong title), in EN + FR, with
 *     search keywords, and whether the photo and the title disagree. Picks up to 3 SECTIONS (level-2 nodes, ~190).
 *  2. CHOOSE: among the exact leaves of those sections only, pick the 3 best (~4 700 leaves in total).
 *
 * Small, focused prompts instead of one giant "allowed list" — the model can no longer be forced into a wrong
 * shortlist (the old failure: an OBD scanner ending in "Trade Show Counters").
 */

export type TaxonomyIdentity = {
  nameEn: string
  nameFr: string
  kind: string
  keywords: string[]
  /** What the photo shows (empty without photo). */
  photoShows: string
  /** True when the photo and the title clearly describe different products. */
  photoTitleConflict: boolean
  confidence: number
}

export type TaxonomyPick = LeafPath & { confidence: number; reason: string }

export type TaxonomyBrowse = {
  nodes: Record<string, BrowseNode>
  rootIds: string[]
  childrenByParent: Record<string, string[]>
}

export type Section = { code: string; id: string; label: string; leafCount: number }

const MAX_SECTION_PICKS = 3
const MAX_CANDIDATES = 420
const MAX_PICKS = 3

/** Level-2 nodes ("Root > Section") with their leaf counts, in a stable order (the prompt block is cached). */
export function buildSections(browse: TaxonomyBrowse): { sections: Section[]; leavesBySection: Map<string, string[]> } {
  const leavesUnder = new Map<string, string[]>()
  const collect = (id: string): string[] => {
    const cached = leavesUnder.get(id)
    if (cached) return cached
    const kids = browse.childrenByParent[id] ?? []
    const leaves = kids.length === 0 ? [id] : kids.flatMap(collect)
    leavesUnder.set(id, leaves)
    return leaves
  }

  const sections: Section[] = []
  const leavesBySection = new Map<string, string[]>()
  for (const rootId of browse.rootIds) {
    const root = browse.nodes[rootId]
    if (!root) continue
    const kids = browse.childrenByParent[rootId] ?? []
    if (kids.length === 0) {
      const code = `s${sections.length + 1}`
      sections.push({ code, id: rootId, label: root.name, leafCount: 1 })
      leavesBySection.set(code, [rootId])
      continue
    }
    for (const kidId of kids) {
      const kid = browse.nodes[kidId]
      if (!kid) continue
      const leaves = collect(kidId)
      const code = `s${sections.length + 1}`
      sections.push({ code, id: kidId, label: `${root.name} > ${kid.name}`, leafCount: leaves.length })
      leavesBySection.set(code, leaves)
    }
  }
  return { sections, leavesBySection }
}

export function sectionsPromptBlock(sections: Section[]): string {
  return sections.map((s) => `${s.code} | ${s.label} (${s.leafCount})`).join("\n")
}

function normalize(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim()
}

/** Keep the most relevant leaves when the picked sections are large (lexical overlap with identity keywords). */
export function trimCandidates(
  leafIds: string[],
  leafById: Map<string, LeafPath>,
  identity: TaxonomyIdentity,
  max = MAX_CANDIDATES
): string[] {
  if (leafIds.length <= max) return leafIds
  const terms = [...identity.keywords, identity.nameEn, identity.nameFr, identity.kind]
    .flatMap((k) => normalize(k).split(" "))
    .filter((w) => w.length >= 3)
  const scored = leafIds.map((id) => {
    const bc = normalize(leafById.get(id)?.breadcrumb ?? "")
    let s = 0
    for (const w of terms) if (bc.includes(w)) s += 1
    return { id, s }
  })
  scored.sort((a, b) => b.s - a.s)
  return scored.slice(0, max).map((x) => x.id)
}

const IDENTIFY_SYSTEM = `You are the product-taxonomy expert of a European online marketplace (Google Product Taxonomy, French labels).

Your job in this step: understand what the item REALLY is, then pick the section(s) of the taxonomy it belongs to.

Rules:
- If a photo is provided, look at it carefully. The PHOTO is the truth about the item; the supplier's title can be wrong, misleading, keyword-stuffed or about another product.
- If title and photo describe clearly different products, set "photoTitleConflict": true and describe both.
- Classify the item that is SOLD, not its accessories, packaging, power source or features (a "USB-powered car diagnostic scanner" is a vehicle diagnostic tool, not a USB cable or a computer accessory).
- Names must be short generic product types, no brands, no marketing words.
- Pick up to ${MAX_SECTION_PICKS} sections from the list, best first. A section is "Root > Sub-section". Use ONLY the codes of the list.
- Typical places of modern products in this taxonomy (labels are French; choose by meaning):
  smart watches / smart bands / fitness trackers → "Vêtements et accessoires > Bijoux" (watches) and "Santé et beauté > Santé" (activity trackers, biometric monitors);
  earbuds, headphones, speakers → "Appareils électroniques > Audio";
  dash cams, OBD/diagnostic scanners, car accessories → "Véhicules et accessoires";
  power banks, chargers, cables, phone holders, gimbals → "Appareils électroniques > Accessoires électroniques" (and camera stabilizers under "Appareils photo, caméras et instruments d'optique");
  electric scooters → "Équipements sportifs > Loisirs de plein air";
  face masks (FFP2) → "Entreprise et industrie > Équipement de protection".

Answer with JSON only:
{
  "identity": {
    "nameEn": string, "nameFr": string, "kind": string,
    "keywords": string[],            // 5-10 search words (EN + FR) describing the product type
    "photoShows": string,            // what the photo shows, "" if no photo
    "photoTitleConflict": boolean,
    "confidence": number             // 0-1 how sure you are about what the item is
  },
  "sections": [ { "code": string, "confidence": number } ]
}`

const CHOOSE_SYSTEM = `You are the product-taxonomy expert of a European online marketplace.

Choose the ${MAX_PICKS} best exact categories for the item, best first, ONLY from the candidate list (use the codes).

Rules:
- Pick the most specific category that IS the item itself. Never pick a category for an accessory, part or consumable of the item unless the item is that accessory/part.
- If nothing fits well, still return the closest candidates with a LOW confidence — never invent.
- confidence: 0.9+ only when the category is unmistakably right; 0.6-0.8 good match; below 0.5 weak.
- "reason": one short sentence naming the product type (English).

Answer with JSON only:
{ "picks": [ { "code": string, "confidence": number, "reason": string } ] }`

type IdentifyPayload = {
  identity?: Partial<TaxonomyIdentity>
  sections?: Array<{ code?: string; confidence?: number }>
}
type ChoosePayload = { picks?: Array<{ code?: string; confidence?: number; reason?: string }> }

function productBlocks(input: { title: string; description?: string; imageUrl?: string | null }): AnthropicContentBlock[] {
  const lines = [`Supplier title: ${input.title.trim() || "(none)"}`]
  const desc = input.description?.trim()
  if (desc) lines.push(`Supplier notes (may be noisy): ${desc.slice(0, 500)}`)
  const blocks: AnthropicContentBlock[] = []
  if (input.imageUrl) blocks.push({ type: "image", source: { type: "url", url: input.imageUrl } })
  blocks.push({ type: "text", text: lines.join("\n") })
  return blocks
}

function clamp01(n: unknown, fallback = 0): number {
  const v = typeof n === "number" ? n : Number(n)
  return Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : fallback
}

export function normalizeIdentity(raw: Partial<TaxonomyIdentity> | undefined, title: string): TaxonomyIdentity {
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "")
  return {
    nameEn: str(raw?.nameEn) || title,
    nameFr: str(raw?.nameFr) || str(raw?.nameEn) || title,
    kind: str(raw?.kind),
    keywords: Array.isArray(raw?.keywords)
      ? raw!.keywords.filter((k): k is string => typeof k === "string" && k.trim().length > 0).map((k) => k.trim()).slice(0, 12)
      : [],
    photoShows: str(raw?.photoShows),
    photoTitleConflict: raw?.photoTitleConflict === true,
    confidence: clamp01(raw?.confidence, 0.5),
  }
}

export type ClassifyDeps = {
  /** Injected for tests; defaults to the Anthropic Messages call. */
  callModel?: typeof anthropicMessagesText
}

export async function classifyProductTaxonomy(
  input: { title: string; description?: string; imageUrl?: string | null },
  data: { browse: TaxonomyBrowse; leafPaths: LeafPath[] },
  deps: ClassifyDeps = {}
): Promise<{ identity: TaxonomyIdentity; picks: TaxonomyPick[] } | null> {
  const call = deps.callModel ?? anthropicMessagesText
  const { sections, leavesBySection } = buildSections(data.browse)
  if (sections.length === 0) return null
  const leafById = new Map(data.leafPaths.map((lp) => [lp.leafId, lp]))
  const imageUrl = input.imageUrl?.trim() || null

  // ── Step 1 — identify + sections (the taxonomy block is static → prompt-cached) ──
  const stage1 = await call({
    system: [
      { type: "text", text: IDENTIFY_SYSTEM },
      { type: "text", text: `SECTIONS (code | Root > Sub-section (number of categories)):\n${sectionsPromptBlock(sections)}`, cache_control: { type: "ephemeral" } },
    ],
    content: productBlocks({ ...input, imageUrl }),
    maxTokens: 700,
    timeoutMs: 22_000,
  })
  const p1 = parseJsonObject<IdentifyPayload>(stage1)
  if (!p1) return null
  const identity = normalizeIdentity(p1.identity, input.title.trim())

  const pickedSections = (Array.isArray(p1.sections) ? p1.sections : [])
    .map((s) => ({ code: typeof s.code === "string" ? s.code.trim() : "", confidence: clamp01(s.confidence) }))
    .filter((s) => leavesBySection.has(s.code))
    .slice(0, MAX_SECTION_PICKS)
  if (pickedSections.length === 0) return { identity, picks: [] }

  const leafIds = [...new Set(pickedSections.flatMap((s) => leavesBySection.get(s.code) ?? []))]
  const candidates = trimCandidates(leafIds, leafById, identity)
  const candidateLines = candidates
    .map((id, i) => ({ code: `c${i + 1}`, id, lp: leafById.get(id) }))
    .filter((c): c is { code: string; id: string; lp: LeafPath } => Boolean(c.lp))
  if (candidateLines.length === 0) return { identity, picks: [] }
  const byCode = new Map(candidateLines.map((c) => [c.code, c.lp]))

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
          `Keywords: ${identity.keywords.join(", ")}\n\nCANDIDATES (code | full path):\n` +
          candidateLines.map((c) => `${c.code} | ${c.lp.breadcrumb}`).join("\n"),
      },
    ],
    maxTokens: 700,
    timeoutMs: 25_000,
  })
  const p2 = parseJsonObject<ChoosePayload>(stage2)
  const seen = new Set<string>()
  const picks: TaxonomyPick[] = []
  for (const row of Array.isArray(p2?.picks) ? p2!.picks! : []) {
    const lp = typeof row.code === "string" ? byCode.get(row.code.trim()) : undefined
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
