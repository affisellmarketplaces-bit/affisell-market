import { hasOpenAiFallback, openaiChatText } from "@/lib/ai/openai-chat-fallback"
import { AFFISELL_LEGAL_SYSTEM_PROMPT, LEGAL_AI_MODEL } from "@/lib/legal/brain"
import { checkImageTrademark } from "@/lib/legal/vision"
import type { LegalIssue, LegalIssueSeverity } from "@/lib/legal/scan-types"

export type { LegalIssue, LegalIssueSeverity } from "@/lib/legal/scan-types"

export type LegalScanResult = {
  riskScore: number
  issues: LegalIssue[]
}

export type LegalProductScanInput = {
  id: string
  name: string
  description: string
  descriptionBullets?: string[]
  tags?: string[]
  basePriceCents: number
  compareAt?: number | null
  isOnSale?: boolean
  supplierTag?: string | null
  listingKind?: string
  images?: string[]
}

export type LegalSupplierScanInput = {
  id: string
  name: string | null
  email: string
  isVerifiedSupplier?: boolean
  trustScore?: number | null
  legalStatus?: string | null
  verificationStatus?: string | null
  siret?: string | null
  vatNumber?: string | null
  productCount?: number
}

const SEVERITY_WEIGHT: Record<LegalIssueSeverity, number> = {
  low: 10,
  medium: 25,
  high: 40,
  critical: 55,
}

const MISLEADING_PATTERNS: Array<{ re: RegExp; code: string; message: string; severity: LegalIssueSeverity }> = [
  {
    re: /\bn[°o]\s*1\b|\bnum[ée]ro\s*1\b|\b#1\b|\bmeilleur(e|s)?\s+(du|de la|des)\b|\b100\s*%\s+garanti\b/i,
    code: "L121-1",
    message: "Allégation comparative ou superlative non prouvée (ex. N°1, meilleur, 100% garanti)",
    severity: "high",
  },
  {
    re: /\bgaranti(e|s)?\s+(r[ée]sultat|succ[èe]s|efficacit[ée])\b|\bsans\s+risque\b/i,
    code: "L121-1",
    message: "Promesse de résultat garanti — pratique commerciale trompeuse potentielle",
    severity: "high",
  },
  {
    re: /\bgu[ée]rit\b|\banti[-\s]?cancer\b|\bpert[e\s]?\s+de\s+poids\s+garantie\b|\btraitement\s+miracle\b/i,
    code: "L121-1",
    message: "Allégation santé / thérapeutique non autorisée sur marketplace",
    severity: "critical",
  },
  {
    re: /\bce\b|\bconformit[ée]\s+europ[ée]enne\b|\bmarquage\s+ce\b/i,
    code: "DSA-PRODUCT",
    message: "Mention CE détectée — vérifier documentation technique et REP",
    severity: "medium",
  },
  {
    re: /\b(nike|adidas|louis\s+vuitton|gucci|chanel|apple|rolex|hermes|prada|supreme)\b/i,
    code: "CONTREFACON",
    message: "Marque déposée détectée — risque contrefaçon si non autorisé",
    severity: "high",
  },
]

const KNOWN_BRANDS = /\b(nike|adidas|louis\s+vuitton|gucci|chanel|apple|rolex|hermes|prada|supreme)\b/i

function corpusFromProduct(product: LegalProductScanInput): string {
  const parts = [
    product.name,
    product.description,
    ...(product.descriptionBullets ?? []),
    ...(product.tags ?? []),
    product.supplierTag ?? "",
  ]
  return parts.filter(Boolean).join("\n")
}

function corpusFromSupplier(supplier: LegalSupplierScanInput): string {
  return [
    supplier.name ?? "",
    supplier.email,
    supplier.legalStatus ?? "",
    supplier.verificationStatus ?? "",
    supplier.siret ?? "",
    supplier.vatNumber ?? "",
  ]
    .filter(Boolean)
    .join("\n")
}

function scoreFromIssues(issues: LegalIssue[]): number {
  if (issues.length === 0) return 0
  const raw = issues.reduce((sum, issue) => sum + SEVERITY_WEIGHT[issue.severity], 0)
  return Math.min(100, raw)
}

function dedupeIssues(issues: LegalIssue[]): LegalIssue[] {
  const seen = new Set<string>()
  const out: LegalIssue[] = []
  for (const issue of issues) {
    const key = `${issue.code}:${issue.message.slice(0, 80)}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(issue)
  }
  return out
}

function runRuleChecksOnText(text: string): LegalIssue[] {
  const issues: LegalIssue[] = []
  for (const rule of MISLEADING_PATTERNS) {
    if (rule.re.test(text)) {
      issues.push({ code: rule.code, severity: rule.severity, message: rule.message })
    }
  }
  return issues
}

function checkCompareAtAbuse(product: LegalProductScanInput): LegalIssue[] {
  if (!product.compareAt || !product.isOnSale) return []
  const base = product.basePriceCents / 100
  const compare = product.compareAt
  if (compare <= base * 1.2) return []
  const discountPct = Math.round(((compare - base) / compare) * 100)
  if (discountPct < 30) return []
  return [
    {
      code: "L121-1",
      severity: "medium",
      message: `Prix barré abusif potentiel : ${compare.toFixed(2)} € barré vs ${base.toFixed(2)} € (−${discountPct}%)`,
    },
  ]
}

function checkSupplierCompliance(supplier: LegalSupplierScanInput): LegalIssue[] {
  const issues: LegalIssue[] = []

  if (supplier.verificationStatus && supplier.verificationStatus !== "APPROVED") {
    issues.push({
      code: "DSA-TRADER",
      severity: "high",
      message: `KYC marchand non approuvé (${supplier.verificationStatus}) — obligation DSA traceability`,
    })
  }

  if (!supplier.siret && supplier.legalStatus !== "FOREIGN" && supplier.legalStatus !== "PARTICULIER") {
    issues.push({
      code: "L441-1",
      severity: "medium",
      message: "SIRET absent pour profil professionnel — information trader incomplète",
    })
  }

  if ((supplier.productCount ?? 0) > 0 && !supplier.isVerifiedSupplier && (supplier.trustScore ?? 75) < 50) {
    issues.push({
      code: "DSA-TRADER",
      severity: "medium",
      message: "Fournisseur actif avec trust score faible — renforcer due diligence plateforme",
    })
  }

  return issues
}

type AiScanBatchItem = {
  id: string
  kind: "product" | "supplier"
  name: string
  text: string
}

type AiScanBatchResponse = {
  results?: Array<{
    id: string
    riskScore?: number
    issues?: Array<{ code?: string; severity?: string; message?: string }>
  }>
}

const LEGAL_SCAN_JSON_PROMPT = `${AFFISELL_LEGAL_SYSTEM_PROMPT}

## Mode scan automatique (JSON strict)
Tu audites des fiches produit/fournisseur Affisell pour non-conformité juridique FR/UE.
Réponds UNIQUEMENT en JSON valide :
{
  "results": [
    {
      "id": "<id>",
      "riskScore": 0-100,
      "issues": [{ "code": "L121-1|L441-1|RGPD-6|DSA|CONTREFACON|PRIX-BARRE", "severity": "low|medium|high|critical", "message": "..." }]
    }
  ]
}
Vérifie : allégations trompeuses, marquage CE, allégations santé, contrefaçon marque, prix barré abusif, KYC trader DSA.
Max 5 issues par entrée. riskScore = gravité cumulée plafonnée 100.`

function normalizeSeverity(raw: string | undefined): LegalIssueSeverity {
  if (raw === "critical" || raw === "high" || raw === "medium" || raw === "low") return raw
  return "medium"
}

async function aiBatchScan(items: AiScanBatchItem[]): Promise<Map<string, LegalScanResult>> {
  const out = new Map<string, LegalScanResult>()
  if (items.length === 0 || !hasOpenAiFallback()) return out

  const payload = JSON.stringify(
    items.map((item) => ({
      id: item.id,
      kind: item.kind,
      name: item.name,
      text: item.text.slice(0, 4_000),
    }))
  )

  try {
    const raw = await openaiChatText({
      model: LEGAL_AI_MODEL,
      temperature: 0.1,
      max_tokens: 3_072,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: LEGAL_SCAN_JSON_PROMPT },
        {
          role: "user",
          content: `Audite ce batch JSON et retourne results[] avec un objet par id :\n${payload}`,
        },
      ],
    })

    if (!raw) return out

    const parsed = JSON.parse(raw) as AiScanBatchResponse
    for (const row of parsed.results ?? []) {
      if (!row.id) continue
      const issues: LegalIssue[] = (row.issues ?? [])
        .filter((i) => i.message?.trim())
        .map((i) => ({
          code: i.code?.trim() || "L121-1",
          severity: normalizeSeverity(i.severity),
          message: i.message!.trim(),
        }))
      const riskScore =
        typeof row.riskScore === "number"
          ? Math.min(100, Math.max(0, Math.round(row.riskScore)))
          : scoreFromIssues(issues)
      out.set(row.id, { riskScore, issues })
    }
  } catch (error) {
    console.error("[legal:scanner]", {
      result: "ai_batch_failed",
      count: items.length,
      error: error instanceof Error ? error.message : String(error),
    })
  }

  return out
}

function mergeScanResults(ruleIssues: LegalIssue[], ai?: LegalScanResult): LegalScanResult {
  const issues = dedupeIssues([...ruleIssues, ...(ai?.issues ?? [])])
  const riskScore = Math.min(100, Math.max(scoreFromIssues(issues), ai?.riskScore ?? 0))
  return { riskScore, issues }
}

async function checkProductImageTrademark(product: LegalProductScanInput): Promise<LegalIssue[]> {
  const imageUrl = product.images?.[0]?.trim()
  if (!imageUrl || !hasOpenAiFallback()) return []

  const result = await checkImageTrademark(imageUrl)
  if (!result.hasTrademark || result.risk !== "high") return []

  const brands = result.brands.length > 0 ? result.brands.join(", ") : "marque déposée"
  return [
    {
      code: "CONTREFACON",
      severity: "critical",
      message: `Logo/marque détecté(s) sur l'image produit (${brands}, confiance ${result.confidence}%) — risque contrefaçon visuelle`,
    },
  ]
}

export async function scanProduct(product: LegalProductScanInput): Promise<LegalScanResult> {
  const text = corpusFromProduct(product)
  const ruleIssues = dedupeIssues([
    ...runRuleChecksOnText(text),
    ...checkCompareAtAbuse(product),
    ...(await checkProductImageTrademark(product)),
  ])

  if (KNOWN_BRANDS.test(text)) {
    ruleIssues.push({
      code: "CONTREFACON",
      severity: "high",
      message: `Marque tierce détectée dans « ${product.name} » — vérifier autorisation et origine`,
    })
  }

  const aiMap = await aiBatchScan([
    { id: product.id, kind: "product", name: product.name, text },
  ])
  return mergeScanResults(ruleIssues, aiMap.get(product.id))
}

export async function scanSupplier(supplier: LegalSupplierScanInput): Promise<LegalScanResult> {
  const text = corpusFromSupplier(supplier)
  const displayName = supplier.name?.trim() || supplier.email
  const ruleIssues = dedupeIssues([
    ...runRuleChecksOnText(text),
    ...checkSupplierCompliance(supplier),
  ])

  const aiMap = await aiBatchScan([
    { id: supplier.id, kind: "supplier", name: displayName, text },
  ])
  return mergeScanResults(ruleIssues, aiMap.get(supplier.id))
}

/** Batch OpenAI scan — chunks of 5 for cron/API throughput. */
export async function scanProductsBatch(products: LegalProductScanInput[]): Promise<Map<string, LegalScanResult>> {
  const results = new Map<string, LegalScanResult>()

  for (const product of products) {
    const text = corpusFromProduct(product)
    const ruleIssues = dedupeIssues([
      ...runRuleChecksOnText(text),
      ...checkCompareAtAbuse(product),
    ])
    if (KNOWN_BRANDS.test(text)) {
      ruleIssues.push({
        code: "CONTREFACON",
        severity: "high",
        message: `Marque tierce détectée dans « ${product.name} » — vérifier autorisation`,
      })
    }
    const visionIssues = await checkProductImageTrademark(product)
    ruleIssues.push(...visionIssues)
    results.set(product.id, { riskScore: scoreFromIssues(ruleIssues), issues: ruleIssues })
  }

  if (!hasOpenAiFallback()) return results

  const items: AiScanBatchItem[] = products.map((p) => ({
    id: p.id,
    kind: "product" as const,
    name: p.name,
    text: corpusFromProduct(p),
  }))

  for (let i = 0; i < items.length; i += 5) {
    const chunk = items.slice(i, i + 5)
    const aiMap = await aiBatchScan(chunk)
    for (const item of chunk) {
      const rule = results.get(item.id)
      if (!rule) continue
      results.set(item.id, mergeScanResults(rule.issues, aiMap.get(item.id)))
    }
  }

  return results
}

export async function scanSuppliersBatch(
  suppliers: LegalSupplierScanInput[]
): Promise<Map<string, LegalScanResult>> {
  const results = new Map<string, LegalScanResult>()

  for (const supplier of suppliers) {
    const ruleIssues = dedupeIssues([
      ...runRuleChecksOnText(corpusFromSupplier(supplier)),
      ...checkSupplierCompliance(supplier),
    ])
    results.set(supplier.id, { riskScore: scoreFromIssues(ruleIssues), issues: ruleIssues })
  }

  if (!hasOpenAiFallback()) return results

  const items: AiScanBatchItem[] = suppliers.map((s) => ({
    id: s.id,
    kind: "supplier" as const,
    name: s.name?.trim() || s.email,
    text: corpusFromSupplier(s),
  }))

  for (let i = 0; i < items.length; i += 5) {
    const chunk = items.slice(i, i + 5)
    const aiMap = await aiBatchScan(chunk)
    for (const item of chunk) {
      const rule = results.get(item.id)
      if (!rule) continue
      results.set(item.id, mergeScanResults(rule.issues, aiMap.get(item.id)))
    }
  }

  return results
}

export function primaryIssueMessage(issues: LegalIssue[]): string {
  if (issues.length === 0) return "Aucune anomalie détectée"
  const order: LegalIssueSeverity[] = ["critical", "high", "medium", "low"]
  const sorted = [...issues].sort(
    (a, b) => order.indexOf(a.severity) - order.indexOf(b.severity)
  )
  return sorted[0]!.message
}
