import { hasOpenAiFallback, openaiChatText } from "@/lib/ai/openai-chat-fallback"
import { AFFISELL_LEGAL_IDENTITY } from "@/lib/legal/auto-entreprise-identity"
import { AFFISELL_LEGAL_SYSTEM_PROMPT, LEGAL_AI_MODEL } from "@/lib/legal/brain"
import { legalMarkdownToHtml } from "@/lib/legal/markdown-html"
import type { LegalIssue } from "@/lib/legal/scan-types"

export type LegalLetterType = "mise_en_demeure" | "avertissement"

export type LegalLetterSupplier = {
  id: string
  name: string | null
  email: string
  siret?: string | null
  legalEntityName?: string | null
}

export type GenerateLetterInput = {
  type: LegalLetterType
  supplier: LegalLetterSupplier
  issues: LegalIssue[]
  targetName?: string
  scanId?: string | null
}

export type GeneratedLetter = {
  letterMarkdown: string
  letterHtml: string
}

const id = AFFISELL_LEGAL_IDENTITY

function letterTypeLabel(type: LegalLetterType): string {
  return type === "mise_en_demeure" ? "MISE EN DEMEURE" : "AVERTISSEMENT PRÉALABLE"
}

function buildStaticLetterMarkdown(input: GenerateLetterInput): string {
  const supplierName = input.supplier.legalEntityName?.trim() || input.supplier.name?.trim() || input.supplier.email
  const today = new Date().toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })
  const primaryIssue = input.issues[0]
  const refs = [...new Set(input.issues.map((i) => i.code))].join(", ") || "L121-1"

  const facts = input.issues
    .map((i, idx) => `${idx + 1}. **${i.code}** (${i.severity}) — ${i.message}`)
    .join("\n")

  const deadline =
    input.type === "mise_en_demeure"
      ? "**48 heures** à compter de la réception du présent courrier"
      : "**7 jours ouvrés**"

  return `# ${letterTypeLabel(input.type)}

---

**AFFISELL MARKET**  
${id.legalName} — ${id.legalForm}  
SIRET : ${id.siret} · RCS : ${id.rcs}  
${id.address}  
*Marketplace Affisell — plateforme de mise en relation*

---

**Date :** ${today}  
**Réf. :** AFF-LEGAL-${input.scanId?.slice(0, 8) ?? "SCAN"}-${input.supplier.id.slice(0, 6).toUpperCase()}

**Destinataire :**  
${supplierName}  
${input.supplier.email}  
${input.supplier.siret ? `SIRET : ${input.supplier.siret}` : ""}

---

## Objet

${input.type === "mise_en_demeure" ? "Mise en demeure" : "Avertissement préalable"} — manquements constatés sur la marketplace Affisell${input.targetName ? ` (cible : *${input.targetName}*)` : ""}.

## Fondement juridique

Conformément aux dispositions du **Code de la consommation** (notamment art. **L121-1** et s. — pratiques commerciales trompeuses), art. **L441-1**, du **Règlement (UE) 2022/2065 (DSA)** imposant aux traders une information loyale, et le **Code de la propriété intellectuelle** art. **L335-3** en cas de contrefaçon, vous êtes tenus de respecter les obligations légales applicables à votre activité de vendeur professionnel sur Affisell.

## Faits reprochés

${facts || "Anomalie de conformité identifiée par le Gardien juridique Affisell."}

**Articles invoqués :** ${refs}

## Mise en demeure

Par la présente, nous vous **mettons en demeure** de :

1. Corriger immédiatement les contenus litigieux (titres, descriptions, allégations, prix barrés, marquages) ;
2. Fournir tout justificatif (CE, autorisation de marque, preuve comparative) sous ${deadline} ;
3. Confirmer par écrit la correction effective à **legal@affisell.com**.

## Sanctions envisagées

À défaut de régularisation dans le délai imparti, Affisell se réserve le droit de :

- **Déréférencer** vos fiches produits et suspendre votre compte vendeur ;
- **Signaler** les faits à la **DGCCRF** et aux autorités compétentes ;
- Engager toute **action civile ou pénale** utile au recouvrement des préjudices subis par la plateforme et les consommateurs.

## Réserve

Le présent courrier vaut mise en demeure au sens de l'article 1344 du Code civil. Il est établi sous le contrôle de l'Avocat Numérique Affisell et devra être validé par un avocat inscrit avant envoi recommandé.

---

*Document généré automatiquement — Affisell Avocat Numérique · ${today}*
`
}

export { legalMarkdownToHtml } from "@/lib/legal/markdown-html"

export function generateMiseEnDemeure(
  supplier: LegalLetterSupplier,
  issue: LegalIssue | LegalIssue[],
  options?: { targetName?: string; scanId?: string | null }
): GeneratedLetter {
  const issues = Array.isArray(issue) ? issue : [issue]
  const letterMarkdown = buildStaticLetterMarkdown({
    type: "mise_en_demeure",
    supplier,
    issues,
    targetName: options?.targetName,
    scanId: options?.scanId,
  })
  return {
    letterMarkdown,
    letterHtml: legalMarkdownToHtml(letterMarkdown),
  }
}

export async function generateLegalLetterWithAi(
  input: GenerateLetterInput
): Promise<GeneratedLetter> {
  const fallback = buildStaticLetterMarkdown(input)

  if (!hasOpenAiFallback()) {
    return {
      letterMarkdown: fallback,
      letterHtml: legalMarkdownToHtml(fallback),
    }
  }

  const supplierName =
    input.supplier.legalEntityName?.trim() || input.supplier.name?.trim() || input.supplier.email

  try {
    const raw = await openaiChatText({
      model: LEGAL_AI_MODEL,
      temperature: 0.12,
      max_tokens: 3_500,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: AFFISELL_LEGAL_SYSTEM_PROMPT },
        {
          role: "user",
          content: `Rédige une ${input.type === "mise_en_demeure" ? "MISE EN DEMEURE" : "AVERTISSEMENT PRÉALABLE"} en français juridique impeccable (niveau cabinet Gide).

Destinataire : ${supplierName} (${input.supplier.email})
Expéditeur : Affisell Market — ${id.legalName}, SIRET ${id.siret}
Cible : ${input.targetName ?? "catalogue fournisseur"}
Faits : ${JSON.stringify(input.issues)}

Exigences :
- Citer L121-1, L441-1, L335-3 si pertinent, DSA
- Délai : ${input.type === "mise_en_demeure" ? "48h" : "7 jours ouvrés"}
- Menaces : déréférencement + signalement DGCCRF
- Ton ferme, professionnel, sans insulte

Réponds en JSON : { "markdown": "...", "html": "..." }
html = document HTML print-ready A4 serif avec styles inline.`,
        },
      ],
    })

    if (!raw) {
      return { letterMarkdown: fallback, letterHtml: legalMarkdownToHtml(fallback) }
    }

    const parsed = JSON.parse(raw) as { markdown?: string; html?: string }
    const letterMarkdown = parsed.markdown?.trim() || fallback
    const letterHtml =
      parsed.html?.trim() ||
      legalMarkdownToHtml(letterMarkdown)

    return { letterMarkdown, letterHtml }
  } catch (error) {
    console.error("[legal:letters]", {
      result: "ai_failed",
      type: input.type,
      error: error instanceof Error ? error.message : String(error),
    })
    return { letterMarkdown: fallback, letterHtml: legalMarkdownToHtml(fallback) }
  }
}

export async function generateLegalLetter(input: GenerateLetterInput): Promise<GeneratedLetter> {
  if (input.type === "mise_en_demeure" && input.issues.length === 1 && !hasOpenAiFallback()) {
    return generateMiseEnDemeure(input.supplier, input.issues, {
      targetName: input.targetName,
      scanId: input.scanId,
    })
  }
  return generateLegalLetterWithAi(input)
}
