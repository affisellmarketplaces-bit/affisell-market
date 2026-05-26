/**
 * Critical catalog leaves (FR marketplace taxonomy) that product-intent scoring expects.
 * Used in CI to catch an incomplete `taxonomy-fr.txt` or failed seed.
 *
 * Each entry is matched as a suffix on a full path line in taxonomy-fr.txt.
 */
export const REQUIRED_TAXONOMY_PATH_SUFFIXES = [
  "Santé et beauté > Santé > Moniteurs biométriques > Moniteurs d'activité",
  "Véhicules et accessoires > Pièces détachées pour véhicules > Électronique pour véhicules > Caméras de recul",
  "Véhicules et accessoires > Pièces détachées pour véhicules > Électronique pour véhicules > Lecteurs et systèmes audio et vidéo intégrés pour véhicules",
  "Véhicules et accessoires > Pièces détachées pour véhicules > Électronique pour véhicules > Kits mains-libres pour véhicules",
  "Appareils électroniques > Communications > Téléphonie > Téléphones mobiles",
  "Appareils électroniques > Ordinateurs > Ordinateurs portables",
  "Appareils électroniques > Systèmes de navigation GPS",
  "Maison et jardin > Appareils électroménagers > Chauffage et climatisation > Ventilateurs > Ventilateurs portatifs et brumisateurs",
] as const

export function findMissingTaxonomyPaths(
  taxonomyFileContent: string,
  required = REQUIRED_TAXONOMY_PATH_SUFFIXES
): string[] {
  const lines = taxonomyFileContent.split("\n")
  const missing: string[] = []
  for (const suffix of required) {
    const found = lines.some((line) => {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith("#")) return false
      const path = trimmed.includes(" - ") ? trimmed.split(" - ").slice(1).join(" - ").trim() : trimmed
      return path === suffix || path.endsWith(suffix)
    })
    if (!found) missing.push(suffix)
  }
  return missing
}
