import type { BrandPulseCheckId } from "@/lib/storefront-brand-pulse-shared"

const CHECK_LABEL_EN: Record<BrandPulseCheckId, string> = {
  identity: "Set your store name",
  description: "Write a 24+ char tagline",
  logo: "Upload a logo",
  heroVisual: "Add banner, gradient, or Veo hero",
  preset: "Select a theme preset",
  premiumLayout: "Enable immersive / glass / dark layout",
  sections: "Enable 3+ homepage sections",
  staticPages: "Enable About, FAQ, or Returns",
  embed: "Enable embed widget",
  liveListings: "List at least one product",
  liveCatalog: "Publish at least one product",
  customDomain: "Verify custom domain",
}

const CHECK_LABEL_FR: Record<BrandPulseCheckId, string> = {
  identity: "Définir le nom de boutique",
  description: "Rédiger une accroche (24+ caractères)",
  logo: "Téléverser un logo",
  heroVisual: "Ajouter bannière, dégradé ou hero Veo",
  preset: "Choisir un preset thème",
  premiumLayout: "Activer layout immersif / glass / sombre",
  sections: "Activer 3+ sections homepage",
  staticPages: "Activer À propos, FAQ ou Retours",
  embed: "Activer le widget embed",
  liveListings: "Mettre au moins un produit live",
  liveCatalog: "Publier au moins un produit",
  customDomain: "Vérifier le domaine custom",
}

export function formatOpenPulseChecks(
  checkIds: BrandPulseCheckId[],
  locale: "fr" | "en"
): string[] {
  const map = locale === "en" ? CHECK_LABEL_EN : CHECK_LABEL_FR
  return checkIds.slice(0, 3).map((id) => map[id])
}

export function formatPresetAbSummary(args: {
  viewsControl: number
  viewsChallenger: number
  locale: "fr" | "en"
}): string {
  if (args.locale === "en") {
    return `Preset A/B this week: control ${args.viewsControl} views vs challenger ${args.viewsChallenger} views.`
  }
  return `A/B preset cette semaine : contrôle ${args.viewsControl} vues vs challenger ${args.viewsChallenger} vues.`
}

export function computePulseScoreDelta(
  currentScore: number,
  previousScore: number | null | undefined
): number | null {
  if (previousScore == null || !Number.isFinite(previousScore)) return null
  const delta = currentScore - Math.round(previousScore)
  if (delta === 0) return null
  return delta
}

export function formatPulseScoreDelta(args: {
  delta: number
  locale: "fr" | "en"
}): string {
  const sign = args.delta > 0 ? "+" : ""
  if (args.locale === "en") {
    return `${sign}${args.delta} Brand Pulse points vs last week.`
  }
  return `${sign}${args.delta} points Brand Pulse vs la semaine dernière.`
}
