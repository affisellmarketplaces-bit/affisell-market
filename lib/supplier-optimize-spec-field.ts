import { groqChatText } from "@/lib/ai/groq-client"

export type OptimizeSpecFieldInput = {
  fieldKey: string
  fieldLabel: string
  currentValue: string
  title: string
  description: string
  categoryPath: string
  bullets: string[]
}

function buildPrompt(input: OptimizeSpecFieldInput): { system: string; user: string } {
  const key = input.fieldKey.toLowerCase()
  const label = input.fieldLabel.trim() || input.fieldKey

  let fieldInstruction =
    "Réécris ce champ pour la marketplace Affisell : clair, vendeur, factuel, sans promesses inventées."

  if (key === "highlights" || label.toLowerCase().includes("key feature")) {
    fieldInstruction =
      "Rédige 3 à 6 points forts concis (une ligne par point, tiret ou phrase courte). Mise en avant bénéfices client et différenciation."
  } else if (key === "whats_in_box" || label.toLowerCase().includes("what's in the box")) {
    fieldInstruction =
      "Liste précisément le contenu de la boîte / ce qui est inclus (une ligne par élément). Quantités si pertinent."
  }

  const context = [
    input.title.trim() ? `Titre produit: ${input.title.trim()}` : "",
    input.categoryPath.trim() ? `Catégorie: ${input.categoryPath.trim()}` : "",
    input.description.trim() ? `Description:\n${input.description.trim().slice(0, 1500)}` : "",
    input.bullets.length ? `Points clés:\n${input.bullets.map((b) => `- ${b}`).join("\n")}` : "",
    input.currentValue.trim() ? `Brouillon actuel (${label}):\n${input.currentValue.trim()}` : "",
  ]
    .filter(Boolean)
    .join("\n\n")

  return {
    system:
      "Tu es copywriter e-commerce Affisell. Tu optimises une fiche produit en français. Réponds uniquement avec le texte final du champ, sans markdown, sans guillemets, sans préambule.",
    user: `${fieldInstruction}\n\nChamp: ${label}\n\n${context || "Aucun contexte — propose un contenu générique adapté au type de champ."}`,
  }
}

export async function optimizeSupplierSpecField(input: OptimizeSpecFieldInput): Promise<string> {
  const { system, user } = buildPrompt(input)

  const raw = await groqChatText({
    vision: false,
    temperature: 0.35,
    max_tokens: 400,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  })

  const text = raw?.trim()
  if (!text) {
    throw new Error("L'IA n'a pas renvoyé de texte.")
  }

  console.log("[supplier-optimize-spec-field]", {
    fieldKey: input.fieldKey,
    resultLength: text.length,
  })

  return text.slice(0, 2000)
}
