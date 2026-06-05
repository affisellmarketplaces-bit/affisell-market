/**
 * Client-safe browse departments (eBay-friendly labels → Google taxonomy targets).
 * Resolved to Prisma `categoryId` on the server — never forks Google as source of truth.
 */

export type BrowseDepartmentTarget =
  | { kind: "googleRoot"; rootNameFr: string }
  | { kind: "googleFullPath"; fullPathFr: string }
  | { kind: "search"; queryFr: string }

export type BrowseDepartmentDef = {
  id: string
  icon: string
  labelFr: string
  labelEn: string
  target: BrowseDepartmentTarget
}

/** Curated marketing rail — maps familiar eBay FR sections to Google nodes. */
export const AFFISELL_BROWSE_DEPARTMENTS: BrowseDepartmentDef[] = [
  {
    id: "auto-moto",
    icon: "🚗",
    labelFr: "Auto & moto",
    labelEn: "Cars & motorbikes",
    target: { kind: "googleRoot", rootNameFr: "Véhicules et accessoires" },
  },
  {
    id: "high-tech",
    icon: "📱",
    labelFr: "High-tech",
    labelEn: "Electronics",
    target: { kind: "googleRoot", rootNameFr: "Appareils électroniques" },
  },
  {
    id: "informatique",
    icon: "💻",
    labelFr: "Informatique",
    labelEn: "Computers",
    target: { kind: "googleFullPath", fullPathFr: "Appareils électroniques > Ordinateurs" },
  },
  {
    id: "telephonie",
    icon: "📞",
    labelFr: "Téléphonie",
    labelEn: "Phones",
    target: {
      kind: "googleFullPath",
      fullPathFr: "Appareils électroniques > Communications > Téléphonie",
    },
  },
  {
    id: "jeux-video",
    icon: "🎮",
    labelFr: "Jeux vidéo",
    labelEn: "Video games",
    target: { kind: "googleFullPath", fullPathFr: "Logiciels > Jeux vidéo" },
  },
  {
    id: "jouets",
    icon: "🧸",
    labelFr: "Jouets & jeux",
    labelEn: "Toys & games",
    target: { kind: "googleRoot", rootNameFr: "Jeux et jouets" },
  },
  {
    id: "collection",
    icon: "🏺",
    labelFr: "Collection",
    labelEn: "Collectibles",
    target: {
      kind: "googleFullPath",
      fullPathFr: "Arts et loisirs > Loisirs et arts créatifs > Articles de collection",
    },
  },
  {
    id: "vetements",
    icon: "👕",
    labelFr: "Mode",
    labelEn: "Fashion",
    target: { kind: "googleRoot", rootNameFr: "Vêtements et accessoires" },
  },
  {
    id: "bijoux",
    icon: "💍",
    labelFr: "Bijoux & montres",
    labelEn: "Jewelry & watches",
    target: {
      kind: "googleFullPath",
      fullPathFr: "Vêtements et accessoires > Bijoux",
    },
  },
  {
    id: "art-antiques",
    icon: "🖼️",
    labelFr: "Art & antiquités",
    labelEn: "Art & antiques",
    target: { kind: "googleRoot", rootNameFr: "Arts et loisirs" },
  },
  {
    id: "monnaies",
    icon: "🪙",
    labelFr: "Monnaies & timbres",
    labelEn: "Coins & stamps",
    target: {
      kind: "googleFullPath",
      fullPathFr:
        "Arts et loisirs > Loisirs et arts créatifs > Articles de collection > Pièces de monnaie et devises à collectionner",
    },
  },
  {
    id: "sports",
    icon: "⚽",
    labelFr: "Sports",
    labelEn: "Sports",
    target: { kind: "googleRoot", rootNameFr: "Équipements sportifs" },
  },
  {
    id: "maison",
    icon: "🏠",
    labelFr: "Maison & jardin",
    labelEn: "Home & garden",
    target: { kind: "googleRoot", rootNameFr: "Maison et jardin" },
  },
  {
    id: "beaute",
    icon: "💄",
    labelFr: "Beauté & santé",
    labelEn: "Beauty & health",
    target: { kind: "googleRoot", rootNameFr: "Santé et beauté" },
  },
  {
    id: "bricolage",
    icon: "🔧",
    labelFr: "Bricolage",
    labelEn: "DIY & tools",
    target: { kind: "googleRoot", rootNameFr: "Quincaillerie" },
  },
  {
    id: "medias",
    icon: "📚",
    labelFr: "Livres & médias",
    labelEn: "Books & media",
    target: { kind: "googleRoot", rootNameFr: "Médias" },
  },
  {
    id: "bebe",
    icon: "👶",
    labelFr: "Bébé",
    labelEn: "Baby",
    target: { kind: "googleRoot", rootNameFr: "Bébés et tout-petits" },
  },
  {
    id: "animaux",
    icon: "🐾",
    labelFr: "Animaux",
    labelEn: "Pets",
    target: { kind: "googleRoot", rootNameFr: "Animaux et articles pour animaux de compagnie" },
  },
  {
    id: "alimentation",
    icon: "🍷",
    labelFr: "Alimentation",
    labelEn: "Food & drinks",
    target: { kind: "googleRoot", rootNameFr: "Alimentation, boissons et tabac" },
  },
  {
    id: "photo",
    icon: "📷",
    labelFr: "Photo & optique",
    labelEn: "Photo & optics",
    target: {
      kind: "googleRoot",
      rootNameFr: "Appareils photo, caméras et instruments d'optique",
    },
  },
]

export type ResolvedBrowseDepartment = {
  id: string
  icon: string
  label: string
  categoryId: string | null
  searchQuery: string | null
  resolved: boolean
}
