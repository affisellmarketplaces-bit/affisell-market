import type { LegalIssue } from "@/lib/legal/scan-types"

export type AutoFixProductInput = {
  name: string
  description: string
  descriptionBullets?: string[]
  tags?: string[]
  compareAt?: number | null
  isOnSale?: boolean
  basePriceCents?: number
}

export type AutoFixChange = {
  field: string
  before: string
  after: string
  reason: string
}

export type AutoFixProductResult = {
  fixedTitle: string
  fixedDesc: string
  fixedBullets: string[]
  fixedTags: string[]
  clearCompareAt: boolean
  changes: AutoFixChange[]
}

const CE_SUSPEND_TAG = "Vérification CE en cours - Vente suspendue"

const COMPARATIVE_REPLACEMENTS: Array<{
  pattern: RegExp
  replacement: string
  reason: string
}> = [
  {
    pattern: /\bn[°o]\s*1\b/gi,
    replacement: "parmi les plus appréciés",
    reason: "L121-1 — allégation superlative « N°1 »",
  },
  {
    pattern: /\bnum[ée]ro\s*1\b/gi,
    replacement: "parmi les plus appréciés",
    reason: "L121-1 — allégation superlative « numéro 1 »",
  },
  {
    pattern: /\b#1\b/g,
    replacement: "parmi les plus appréciés",
    reason: "L121-1 — allégation superlative « #1 »",
  },
  {
    pattern: /\bmeilleur(e|s)?\b/gi,
    replacement: "Conçu pour",
    reason: "L121-1 — comparatif « meilleur » sans preuve",
  },
  {
    pattern: /\bgaranti(e|s)?\s+(r[ée]sultat|succ[èe]s|efficacit[ée])\b/gi,
    replacement: "conçu pour favoriser",
    reason: "L121-1 — promesse de résultat garanti",
  },
  {
    pattern: /\b100\s*%\s+garanti\b/gi,
    replacement: "conforme aux attentes annoncées",
    reason: "L121-1 — garantie absolue",
  },
  {
    pattern: /\bsans\s+risque\b/gi,
    replacement: "selon les conditions générales",
    reason: "L121-1 — promesse sans risque",
  },
]

function applyCompliantReplacements(text: string, changes: AutoFixChange[], field: string): string {
  let out = text
  for (const rule of COMPARATIVE_REPLACEMENTS) {
    if (!rule.pattern.test(out)) {
      rule.pattern.lastIndex = 0
      continue
    }
    rule.pattern.lastIndex = 0
    const before = out
    out = out.replace(rule.pattern, rule.replacement)
    if (out !== before) {
      changes.push({
        field,
        before: before.slice(0, 120),
        after: out.slice(0, 120),
        reason: rule.reason,
      })
    }
  }
  return out
}

function issueMatchesCode(issues: LegalIssue[], codes: string[]): boolean {
  return issues.some((i) => codes.some((c) => i.code.includes(c)))
}

function issueMentions(issues: LegalIssue[], needle: string): boolean {
  const n = needle.toLowerCase()
  return issues.some((i) => i.message.toLowerCase().includes(n))
}

/** Scans ouverts produit avec au moins une anomalie auto-corrigeable. */
export function isAutoFixableProductScan(scan: {
  type: string
  status: string
  issues: LegalIssue[]
}): boolean {
  if (scan.type !== "product" || scan.status !== "open") return false
  return scan.issues.some((issue) => isIssueAutoFixable(issue))
}

export function isIssueAutoFixable(issue: LegalIssue): boolean {
  if (issue.code === "L121-1") return true
  if (issue.code === "DSA-PRODUCT") return true
  if (issue.message.toLowerCase().includes("prix barré")) return true
  if (issue.message.toLowerCase().includes("allégation")) return true
  if (issue.message.toLowerCase().includes("ce")) return true
  return false
}

export function countAutoFixableScans(
  scans: Array<{ type: string; status: string; issues: LegalIssue[] }>
): number {
  return scans.filter(isAutoFixableProductScan).length
}

/**
 * Propose un fix conforme sans persister en base (V3 preview).
 */
export function autoFixProduct(
  product: AutoFixProductInput,
  issues: LegalIssue[]
): AutoFixProductResult {
  const changes: AutoFixChange[] = []

  let fixedTitle = applyCompliantReplacements(product.name, changes, "name")
  let fixedDesc = applyCompliantReplacements(product.description, changes, "description")

  const fixedBullets = (product.descriptionBullets ?? []).map((bullet, idx) =>
    applyCompliantReplacements(bullet, changes, `descriptionBullets[${idx}]`)
  )

  let fixedTags = [...(product.tags ?? [])]
  let clearCompareAt = false

  const needsCeTag =
    issueMatchesCode(issues, ["DSA-PRODUCT", "CE"]) ||
    issueMentions(issues, "marquage ce") ||
    issueMentions(issues, "mention ce")

  if (needsCeTag && !fixedTags.some((t) => t.toLowerCase().includes("vérification ce"))) {
    fixedTags = [...fixedTags, CE_SUSPEND_TAG]
    changes.push({
      field: "tags",
      before: (product.tags ?? []).join(", ") || "—",
      after: fixedTags.join(", "),
      reason: "DSA / sécurité produit — marquage CE à vérifier, vente suspendue",
    })
  }

  const needsCompareAtFix =
    issueMentions(issues, "prix barré") ||
    (product.compareAt != null &&
      product.isOnSale &&
      product.basePriceCents != null &&
      product.compareAt > (product.basePriceCents / 100) * 1.2)

  if (needsCompareAtFix) {
    clearCompareAt = true
    const legalNote =
      "\n\n* Prix de référence : le prix barré précédemment affiché a été retiré conformément aux exigences d'information loyale (C. consommation art. L121-1 et s.)."
    if (!fixedDesc.includes("Prix de référence")) {
      fixedDesc += legalNote
      changes.push({
        field: "compareAt + description",
        before: product.compareAt != null ? `${product.compareAt} € barré` : "prix barré actif",
        after: "prix barré supprimé + mention légale",
        reason: "L121-1 — prix barré potentiellement abusif",
      })
    }
  }

  return {
    fixedTitle,
    fixedDesc,
    fixedBullets,
    fixedTags,
    clearCompareAt,
    changes,
  }
}
