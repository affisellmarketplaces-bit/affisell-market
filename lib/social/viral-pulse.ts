/**
 * Client-safe Viral Pulse — private affiliate dashboard only.
 * Never embed this score (or cost/margin) into PNG/GIF/captions.
 */
export type ViralPulseInput = {
  mediaCount: number
  assetCount: number
  expectedAssets?: number
  captionChars: number
  salePrice: number
  /** Private — used only for opportunity band on dashboard. */
  netMarginEuro?: number | null
  aiPaused?: boolean
}

export type ViralPulseResult = {
  score: number
  band: "ignition" | "charged" | "launch"
  label: string
  nextAction: "price" | "gif" | "reel" | "kit"
  nextLabel: string
  signals: string[]
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n))
}

export function computeViralPulse(input: ViralPulseInput): ViralPulseResult {
  const expected = input.expectedAssets ?? 12
  const mediaScore = clamp(input.mediaCount * 10, 0, 30)
  const assetScore = clamp((input.assetCount / Math.max(1, expected)) * 28, 0, 28)
  const captionScore = clamp(Math.floor(input.captionChars / 40), 0, 18)
  const price = input.salePrice
  const pricePsychology =
    price > 0 && (Math.round(price) % 10 === 9 || Math.round(price) % 10 === 7) ? 8 : 4
  const margin = input.netMarginEuro ?? 0
  const marginScore =
    margin <= 0 ? 0 : margin < 15 ? 6 : margin < 40 ? 10 : margin < 80 ? 12 : 14
  const penalty = input.aiPaused ? 18 : 0

  const score = clamp(
    Math.round(mediaScore + assetScore + captionScore + pricePsychology + marginScore - penalty),
    0,
    100
  )

  const band: ViralPulseResult["band"] =
    score >= 72 ? "launch" : score >= 42 ? "charged" : "ignition"

  const label =
    band === "launch"
      ? "Launch ready"
      : band === "charged"
        ? "Charged"
        : "Ignition"

  const signals: string[] = []
  if (input.mediaCount >= 2) signals.push("Carrousel multi-médias")
  else if (input.mediaCount === 1) signals.push("1 média — ajoute des angles")
  else signals.push("Aucun média")

  if (input.assetCount >= 4) signals.push(`${input.assetCount} formats prêts`)
  else signals.push("Pack en génération…")

  if (margin > 0) signals.push("Confidentialité assets OK")
  if (input.aiPaused) signals.push("Mode template (IA pause)")

  let nextAction: ViralPulseResult["nextAction"] = "gif"
  let nextLabel = "Partager le GIF WhatsApp"
  if (input.assetCount < 3) {
    nextAction = "kit"
    nextLabel = "Attendre le pack puis télécharger le kit"
  } else if (input.mediaCount >= 2) {
    nextAction = "reel"
    nextLabel = "Exporter le Reel H.264"
  } else if (margin < 10 && price > 0) {
    nextAction = "price"
    nextLabel = "Ajuster le prix (bénéfice net)"
  }

  return { score, band, label, nextAction, nextLabel, signals }
}
