/** Professional category taxonomy — French labels */
export const CATEGORIES = [
  "Électronique",
  "Informatique",
  "Smartphones",
  "Tablettes",
  "Audio & Casques",
  "TV & Vidéo",
  "Photo & Caméra",
  "Maison & Cuisine",
  "Électroménager",
  "Bricolage & Outils",
  "Jardin & Extérieur",
  "Mode Femme",
  "Mode Homme",
  "Mode Enfant",
  "Chaussures",
  "Bijoux & Montres",
  "Beauté & Parfum",
  "Santé & Bien-être",
  "Sport & Loisirs",
  "Jouets & Jeux",
  "Bébé & Puériculture",
  "Animalerie",
  "Auto & Moto",
  "Bureau & Papeterie",
  "Livres",
  "Jeux Vidéo",
  "Musique",
  "Épicerie",
  "Bagagerie",
] as const

export type CatalogColorSwatch = { name: string; hex: string; multicolor?: boolean }

export const COLORS: CatalogColorSwatch[] = [
  { name: "Noir", hex: "#000000" },
  { name: "Blanc", hex: "#FFFFFF" },
  { name: "Gris sidéral", hex: "#8E8E93" },
  { name: "Argent", hex: "#C0C0C0" },
  { name: "Or", hex: "#FFD700" },
  { name: "Bleu", hex: "#007AFF" },
  { name: "Bleu nuit", hex: "#1D1D3A" },
  { name: "Rouge", hex: "#FF3B30" },
  { name: "Vert", hex: "#34C759" },
  { name: "Rose", hex: "#FF2D92" },
  { name: "Violet", hex: "#AF52DE" },
  { name: "Jaune", hex: "#FFCC02" },
  { name: "Orange", hex: "#FF9500" },
  { name: "Marron", hex: "#A2845E" },
  { name: "Beige", hex: "#F5E6D3" },
  { name: "Turquoise", hex: "#5AC8FA" },
  { name: "Multicolore", hex: "", multicolor: true },
]

export type VariantGroupKey = "size" | "storage" | "ram" | "material"

export const VARIANT_GROUP_LABELS: Record<VariantGroupKey, string> = {
  size: "Taille",
  storage: "Capacité / Stockage",
  ram: "Mémoire RAM",
  material: "Matière",
}

export const VARIANT_PRESETS: Record<VariantGroupKey, string[]> = {
  size: ["XS", "S", "M", "L", "XL", "XXL", "32", "34", "36", "38", "40", "42", "44"],
  storage: ["64 Go", "128 Go", "256 Go", "512 Go", "1 To", "2 To"],
  ram: ["4 Go", "8 Go", "16 Go", "32 Go"],
  material: ["Coton", "Polyester", "Cuir", "Métal", "Plastique", "Verre"],
}
