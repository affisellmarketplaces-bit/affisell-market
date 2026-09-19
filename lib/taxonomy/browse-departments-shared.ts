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
  // ── Benchmarked against Amazon, Cdiscount, Fnac, Zalando, ManoMano, Decathlon, Sephora, Etsy, AliExpress, eBay ──
  // Every target below is an exact Google-taxonomy node present in our category table; an unresolved one is skipped.
  { id: "electromenager", icon: "🧺", labelFr: "Électroménager", labelEn: "Home appliances", target: { kind: "googleFullPath", fullPathFr: "Maison et jardin > Appareils électroménagers" } },
  { id: "cuisine", icon: "🍳", labelFr: "Cuisine & arts de la table", labelEn: "Kitchen & dining", target: { kind: "googleFullPath", fullPathFr: "Maison et jardin > Arts de la table et arts culinaires" } },
  { id: "luminaires", icon: "💡", labelFr: "Luminaires & éclairage", labelEn: "Lighting", target: { kind: "googleFullPath", fullPathFr: "Maison et jardin > Luminaires" } },
  { id: "decoration", icon: "🕯️", labelFr: "Décoration", labelEn: "Decor", target: { kind: "googleFullPath", fullPathFr: "Maison et jardin > Décorations" } },
  { id: "literie", icon: "🛏️", labelFr: "Literie & linge de maison", labelEn: "Bedding & linens", target: { kind: "googleFullPath", fullPathFr: "Maison et jardin > Linge > Literie" } },
  { id: "jardin", icon: "🌿", labelFr: "Jardin & pelouse", labelEn: "Garden & lawn", target: { kind: "googleFullPath", fullPathFr: "Maison et jardin > Pelouses et jardins" } },
  { id: "piscine", icon: "🏊", labelFr: "Piscine & spa", labelEn: "Pool & spa", target: { kind: "googleFullPath", fullPathFr: "Maison et jardin > Piscine et spa" } },
  { id: "meubles", icon: "🛋️", labelFr: "Meubles", labelEn: "Furniture", target: { kind: "googleRoot", rootNameFr: "Meubles" } },
  { id: "bureau", icon: "🗂️", labelFr: "Fournitures de bureau", labelEn: "Office supplies", target: { kind: "googleRoot", rootNameFr: "Fournitures de bureau" } },
  { id: "bagages", icon: "🧳", labelFr: "Bagages & maroquinerie", labelEn: "Luggage & bags", target: { kind: "googleRoot", rootNameFr: "Bagages et maroquinerie" } },
  { id: "chaussures", icon: "👟", labelFr: "Chaussures", labelEn: "Shoes", target: { kind: "googleFullPath", fullPathFr: "Vêtements et accessoires > Chaussures" } },
  { id: "montres", icon: "⌚", labelFr: "Montres", labelEn: "Watches", target: { kind: "googleFullPath", fullPathFr: "Vêtements et accessoires > Bijoux > Montres" } },
  { id: "cosmetiques", icon: "💄", labelFr: "Cosmétiques & maquillage", labelEn: "Cosmetics & makeup", target: { kind: "googleFullPath", fullPathFr: "Santé et beauté > Hygiène personnelle > Cosmétiques" } },
  { id: "parfums", icon: "🌸", labelFr: "Parfums", labelEn: "Fragrances", target: { kind: "googleFullPath", fullPathFr: "Santé et beauté > Hygiène personnelle > Cosmétiques > Parfums et eaux de Cologne" } },
  { id: "sante", icon: "🩺", labelFr: "Santé & bien-être", labelEn: "Health & wellness", target: { kind: "googleFullPath", fullPathFr: "Santé et beauté > Santé" } },
  { id: "livres", icon: "📖", labelFr: "Livres", labelEn: "Books", target: { kind: "googleFullPath", fullPathFr: "Médias > Livres" } },
  { id: "musique", icon: "🎵", labelFr: "Musique, CD & vinyles", labelEn: "Music, CDs & vinyl", target: { kind: "googleFullPath", fullPathFr: "Médias > Musique et enregistrements audio" } },
  { id: "films", icon: "🎬", labelFr: "Films & séries (DVD, Blu-ray)", labelEn: "Movies & TV (DVD, Blu-ray)", target: { kind: "googleFullPath", fullPathFr: "Médias > DVD et vidéos" } },
  { id: "instruments", icon: "🎸", labelFr: "Instruments de musique", labelEn: "Musical instruments", target: { kind: "googleFullPath", fullPathFr: "Arts et loisirs > Loisirs et arts créatifs > Instruments de musique" } },
  { id: "loisirs-creatifs", icon: "🎨", labelFr: "Loisirs créatifs & fait main", labelEn: "Crafts & handmade", target: { kind: "googleFullPath", fullPathFr: "Arts et loisirs > Loisirs et arts créatifs > Loisirs créatifs" } },
  { id: "jeux-societe", icon: "🎲", labelFr: "Jeux de société & puzzles", labelEn: "Board games & puzzles", target: { kind: "googleFullPath", fullPathFr: "Jeux et jouets > Jeux" } },
  { id: "consoles", icon: "🕹️", labelFr: "Consoles de jeu", labelEn: "Game consoles", target: { kind: "googleFullPath", fullPathFr: "Appareils électroniques > Consoles de jeu vidéo" } },
  { id: "audio", icon: "🎧", labelFr: "Audio, casques & enceintes", labelEn: "Audio, headphones & speakers", target: { kind: "googleFullPath", fullPathFr: "Appareils électroniques > Audio" } },
  { id: "tv-video", icon: "📺", labelFr: "TV & vidéo", labelEn: "TV & video", target: { kind: "googleFullPath", fullPathFr: "Appareils électroniques > Vidéo" } },
  { id: "impression", icon: "🖨️", labelFr: "Impression & numérisation", labelEn: "Printing & scanning", target: { kind: "googleFullPath", fullPathFr: "Appareils électroniques > Impression, copie, numérisation et télécopie" } },
  { id: "logiciels", icon: "💾", labelFr: "Logiciels", labelEn: "Software", target: { kind: "googleRoot", rootNameFr: "Logiciels" } },
  { id: "pieces-auto", icon: "🔩", labelFr: "Pièces auto & moto", labelEn: "Car & motorbike parts", target: { kind: "googleFullPath", fullPathFr: "Véhicules et accessoires > Pièces détachées pour véhicules" } },
  { id: "velos", icon: "🚲", labelFr: "Vélos & cyclisme", labelEn: "Bikes & cycling", target: { kind: "googleFullPath", fullPathFr: "Équipements sportifs > Loisirs de plein air > Cyclisme" } },
  { id: "trottinettes", icon: "🛴", labelFr: "Trottinettes & glisse", labelEn: "Scooters & skating", target: { kind: "googleFullPath", fullPathFr: "Équipements sportifs > Loisirs de plein air > Trottinettes" } },
  { id: "camping", icon: "⛺", labelFr: "Camping & randonnée", labelEn: "Camping & hiking", target: { kind: "googleFullPath", fullPathFr: "Équipements sportifs > Loisirs de plein air > Camping et randonnée" } },
  { id: "fitness", icon: "🏋️", labelFr: "Fitness & musculation", labelEn: "Fitness & training", target: { kind: "googleFullPath", fullPathFr: "Équipements sportifs > Entraînement et fitness" } },
  { id: "pro-industrie", icon: "🏭", labelFr: "Secteur industriel & pro", labelEn: "Industrial & professional", target: { kind: "googleRoot", rootNameFr: "Entreprise et industrie" } },
  { id: "ceremonies", icon: "💐", labelFr: "Cérémonies & mariage", labelEn: "Weddings & ceremonies", target: { kind: "googleRoot", rootNameFr: "Offices religieux et cérémonies" } },
  { id: "reconditionne", icon: "♻️", labelFr: "Occasion & reconditionné", labelEn: "Second-hand & refurbished", target: { kind: "googleRoot", rootNameFr: "Occasion et reconditionné" } },
]

/** Directory grouping (Amazon-style "all departments"). Unknown ids fall into "other". */
export type BrowseDepartmentTheme =
  | "tech"
  | "home"
  | "fashion"
  | "sport"
  | "culture"
  | "family"
  | "food"
  | "auto-pro"
  | "other"

export const BROWSE_DEPARTMENT_THEME_ORDER: BrowseDepartmentTheme[] = [
  "tech",
  "home",
  "fashion",
  "sport",
  "culture",
  "family",
  "food",
  "auto-pro",
  "other",
]

export const BROWSE_DEPARTMENT_THEME: Record<string, BrowseDepartmentTheme> = {
  "high-tech": "tech", informatique: "tech", telephonie: "tech", "jeux-video": "tech", photo: "tech",
  consoles: "tech", audio: "tech", "tv-video": "tech", impression: "tech", logiciels: "tech",
  maison: "home", electromenager: "home", cuisine: "home", luminaires: "home", decoration: "home", literie: "home",
  jardin: "home", piscine: "home", meubles: "home", bricolage: "home", bureau: "home",
  vetements: "fashion", bijoux: "fashion", chaussures: "fashion", montres: "fashion", bagages: "fashion",
  beaute: "fashion", cosmetiques: "fashion", parfums: "fashion", sante: "fashion",
  sports: "sport", velos: "sport", trottinettes: "sport", camping: "sport", fitness: "sport",
  medias: "culture", livres: "culture", musique: "culture", films: "culture", instruments: "culture",
  "loisirs-creatifs": "culture", "art-antiques": "culture", collection: "culture", monnaies: "culture",
  jouets: "family", "jeux-societe": "family", bebe: "family", animaux: "family", ceremonies: "family",
  alimentation: "food",
  "auto-moto": "auto-pro", "pieces-auto": "auto-pro", "pro-industrie": "auto-pro", reconditionne: "other",
}

export type ResolvedBrowseDepartment = {
  id: string
  icon: string
  label: string
  categoryId: string | null
  categorySlug: string | null
  searchQuery: string | null
  resolved: boolean
}
