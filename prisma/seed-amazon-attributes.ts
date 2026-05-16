/**
 * Seed Amazon FR–style dynamic attributes for 10 top aisles.
 * Run: npx tsx prisma/seed-amazon-attributes.ts
 */
import { Prisma, PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

type AttrSeed = {
  key: string
  label: string
  type: string
  required?: boolean
  options?: string[]
  order: number
  aiSuggest?: boolean
  showInFilter?: boolean
  unit?: string | null
  validationRule?: Prisma.InputJsonValue | null
  dependsOnKey?: string | null
  dependsOnValue?: string | null
  helpText?: string | null
}

type AisleSeed = {
  label: string
  /** Exact Google taxonomy leaf slugs, tried in order. */
  preferredSlugs: string[]
  attrs: AttrSeed[]
}

const AMAZON_AISLES: AisleSeed[] = [
  {
    label: "Smartphones",
    preferredSlugs: [
      "telephones-portables-deverrouilles-543514",
      "telephones-portables-prepayes-543512",
      "telephones-portables-sous-contrat-543513",
    ],
    attrs: [
      {
        key: "brand",
        label: "Marque",
        type: "SELECT",
        required: true,
        options: ["Apple", "Samsung", "Xiaomi", "Google", "OnePlus", "Huawei"],
        order: 1,
        aiSuggest: false,
      },
      {
        key: "storage_gb",
        label: "Stockage (Go)",
        type: "SELECT",
        required: true,
        options: ["64", "128", "256", "512", "1024"],
        order: 2,
        validationRule: { min: 64, max: 1024 },
      },
      {
        key: "operating_system",
        label: "Système",
        type: "SELECT",
        required: true,
        options: ["iOS", "Android"],
        order: 3,
      },
      {
        key: "ean",
        label: "EAN / GTIN",
        type: "TEXT",
        required: false,
        order: 4,
        validationRule: { pattern: "^[0-9]{8,14}$", minLength: 8, maxLength: 14 },
        helpText: "Le numéro EAN se trouve sous le code-barres du produit.",
      },
      {
        key: "apple_model_number",
        label: "Numéro de modèle Apple",
        type: "TEXT",
        required: false,
        order: 5,
        dependsOnKey: "brand",
        dependsOnValue: "Apple",
        helpText: "Ex. A3102 — visible au dos de l’iPhone ou dans Réglages > Général > Informations.",
      },
      {
        key: "dual_sim",
        label: "Double SIM",
        type: "BOOLEAN",
        order: 6,
        aiSuggest: true,
      },
      {
        key: "network",
        label: "Réseau",
        type: "SELECT",
        options: ["4G", "5G"],
        order: 7,
        aiSuggest: true,
      },
    ],
  },
  {
    label: "PC Portables",
    preferredSlugs: ["ordinateurs-portables-328"],
    attrs: [
      {
        key: "brand",
        label: "Marque",
        type: "SELECT",
        required: true,
        options: ["Apple", "Dell", "HP", "Lenovo", "Asus", "Acer", "MSI"],
        order: 1,
      },
      {
        key: "screen_inches",
        label: "Taille écran",
        type: "SELECT",
        required: true,
        options: ['13"', '14"', '15.6"', '16"', '17"'],
        unit: "pouces",
        order: 2,
      },
      {
        key: "ram_gb",
        label: "Mémoire RAM",
        type: "SELECT",
        required: true,
        options: ["8", "16", "32", "64"],
        unit: "Go",
        order: 3,
        validationRule: { min: 8, max: 64 },
      },
      {
        key: "storage_gb",
        label: "Stockage",
        type: "SELECT",
        required: true,
        options: ["256", "512", "1024", "2048"],
        unit: "Go",
        order: 4,
      },
      {
        key: "macos_version",
        label: "Version macOS",
        type: "SELECT",
        options: ["Sonoma", "Sequoia"],
        order: 5,
        dependsOnKey: "brand",
        dependsOnValue: "Apple",
      },
      {
        key: "graphics",
        label: "Carte graphique",
        type: "TEXT",
        order: 6,
        aiSuggest: true,
      },
    ],
  },
  {
    label: "T-shirts",
    preferredSlugs: ["hauts-212", "chemises-a-poche-543663"],
    attrs: [
      { key: "brand", label: "Marque", type: "TEXT", required: true, order: 1 },
      {
        key: "gender",
        label: "Genre",
        type: "SELECT",
        required: true,
        options: ["Homme", "Femme", "Unisexe", "Enfant"],
        order: 2,
      },
      {
        key: "size",
        label: "Taille",
        type: "SELECT",
        required: true,
        options: ["XS", "S", "M", "L", "XL", "XXL"],
        order: 3,
      },
      {
        key: "material",
        label: "Matière",
        type: "SELECT",
        options: ["100 % coton", "Coton bio", "Coton / polyester", "Lin"],
        order: 4,
      },
      {
        key: "fit",
        label: "Coupe",
        type: "SELECT",
        options: ["Regular", "Slim", "Oversize"],
        order: 5,
      },
      {
        key: "care_instructions",
        label: "Entretien",
        type: "TEXTAREA",
        order: 6,
        dependsOnKey: "material",
        dependsOnValue: "100 % coton",
        helpText: "Indiquez lavage à 30 °C, pas de sèche-linge, etc.",
      },
    ],
  },
  {
    label: "Sneakers",
    preferredSlugs: ["chaussures-187"],
    attrs: [
      {
        key: "brand",
        label: "Marque",
        type: "SELECT",
        required: true,
        options: ["Nike", "Adidas", "New Balance", "Puma", "Asics", "Converse"],
        order: 1,
      },
      {
        key: "eu_size",
        label: "Pointure EU",
        type: "SELECT",
        required: true,
        options: ["36", "37", "38", "39", "40", "41", "42", "43", "44", "45", "46"],
        order: 2,
        validationRule: { min: 36, max: 46 },
      },
      {
        key: "color",
        label: "Couleur principale",
        type: "SELECT",
        options: ["Noir", "Blanc", "Gris", "Bleu", "Rouge", "Vert"],
        order: 3,
      },
      {
        key: "upper_material",
        label: "Tige",
        type: "SELECT",
        options: ["Cuir", "Synthétique", "Textile", "Mesh"],
        order: 4,
      },
      {
        key: "nike_style_code",
        label: "Code style Nike",
        type: "TEXT",
        order: 5,
        dependsOnKey: "brand",
        dependsOnValue: "Nike",
        helpText: "Code à 6–10 caractères sur l’étiquette (ex. DD1391-100).",
      },
    ],
  },
  {
    label: "Livres",
    preferredSlugs: ["livres-papier-543543", "livres-audio-543541"],
    attrs: [
      { key: "author", label: "Auteur", type: "TEXT", required: true, order: 1 },
      { key: "publisher", label: "Éditeur", type: "TEXT", order: 2 },
      {
        key: "isbn",
        label: "ISBN",
        type: "TEXT",
        required: true,
        order: 3,
        validationRule: { pattern: "^(97(8|9))?\\d{9}(\\d|X)$", minLength: 10, maxLength: 13 },
        helpText: "ISBN-10 ou ISBN-13 (avec ou sans tirets).",
      },
      {
        key: "language",
        label: "Langue",
        type: "SELECT",
        required: true,
        options: ["Français", "Anglais", "Espagnol", "Allemand"],
        order: 4,
      },
      {
        key: "format",
        label: "Format",
        type: "SELECT",
        options: ["Broché", "Relié", "Poche", "E-book"],
        order: 5,
      },
      {
        key: "pages",
        label: "Nombre de pages",
        type: "NUMBER",
        order: 6,
        validationRule: { min: 1, max: 5000 },
      },
    ],
  },
  {
    label: "Jeux vidéo",
    preferredSlugs: ["jeux-video-1279", "consoles-de-jeu-video-1294"],
    attrs: [
      {
        key: "platform",
        label: "Plateforme",
        type: "SELECT",
        required: true,
        options: ["PlayStation 5", "Xbox Series X|S", "Nintendo Switch", "PC"],
        order: 1,
      },
      { key: "publisher", label: "Éditeur", type: "TEXT", order: 2 },
      {
        key: "pegi",
        label: "PEGI",
        type: "SELECT",
        required: true,
        options: ["3", "7", "12", "16", "18"],
        order: 3,
      },
      {
        key: "ps5_edition",
        label: "Édition PS5",
        type: "SELECT",
        options: ["Standard", "Deluxe", "Collector"],
        order: 4,
        dependsOnKey: "platform",
        dependsOnValue: "PlayStation 5",
      },
      {
        key: "multiplayer",
        label: "Multijoueur en ligne",
        type: "BOOLEAN",
        order: 5,
      },
    ],
  },
  {
    label: "Beauté",
    preferredSlugs: ["parfums-et-eaux-de-cologne-479", "kits-de-cosmetiques-6069"],
    attrs: [
      { key: "brand", label: "Marque", type: "TEXT", required: true, order: 1 },
      {
        key: "product_type",
        label: "Type de produit",
        type: "SELECT",
        required: true,
        options: ["Sérum", "Crème", "Shampooing", "Parfum", "Maquillage"],
        order: 2,
      },
      {
        key: "volume_ml",
        label: "Volume",
        type: "NUMBER",
        unit: "ml",
        order: 3,
        validationRule: { min: 5, max: 1000 },
      },
      {
        key: "skin_type",
        label: "Type de peau",
        type: "MULTI_SELECT",
        options: ["Normale", "Sèche", "Grasse", "Mixte", "Sensible"],
        order: 4,
        dependsOnKey: "product_type",
        dependsOnValue: "Sérum",
      },
      {
        key: "spf",
        label: "Indice SPF",
        type: "SELECT",
        options: ["15", "30", "50", "50+"],
        order: 5,
        dependsOnKey: "product_type",
        dependsOnValue: "Crème",
      },
      {
        key: "cruelty_free",
        label: "Non testé sur les animaux",
        type: "BOOLEAN",
        order: 6,
        aiSuggest: true,
      },
    ],
  },
  {
    label: "Maison",
    preferredSlugs: [
      "stickers-de-decoration-d-interieur-3221",
      "batterie-de-cuisine-et-moules-a-patisserie-6071",
    ],
    attrs: [
      { key: "brand", label: "Marque", type: "TEXT", order: 1 },
      {
        key: "room",
        label: "Pièce",
        type: "SELECT",
        options: ["Cuisine", "Salon", "Chambre", "Salle de bain", "Bureau"],
        order: 2,
      },
      {
        key: "material",
        label: "Matière",
        type: "SELECT",
        options: ["Bois", "Métal", "Verre", "Céramique", "Textile"],
        order: 3,
      },
      {
        key: "dimensions_cm",
        label: "Dimensions (L×l×H)",
        type: "TEXT",
        order: 4,
        helpText: "Ex. 120×60×75 cm",
      },
      {
        key: "dishwasher_safe",
        label: "Compatible lave-vaisselle",
        type: "BOOLEAN",
        order: 5,
        dependsOnKey: "room",
        dependsOnValue: "Cuisine",
      },
    ],
  },
  {
    label: "Auto",
    preferredSlugs: [
      "accessoires-de-pneus-pour-vehicules-2989",
      "carburateurs-et-pieces-detachees-3463",
    ],
    attrs: [
      {
        key: "part_type",
        label: "Type de pièce",
        type: "SELECT",
        required: true,
        options: ["Filtre", "Plaquettes", "Huile", "Pneu", "Batterie", "Ampoule"],
        order: 1,
      },
      {
        key: "vehicle_make",
        label: "Marque véhicule",
        type: "SELECT",
        options: ["Renault", "Peugeot", "Citroën", "Volkswagen", "BMW", "Mercedes"],
        order: 2,
      },
      {
        key: "tire_width_mm",
        label: "Largeur pneu",
        type: "NUMBER",
        unit: "mm",
        order: 3,
        dependsOnKey: "part_type",
        dependsOnValue: "Pneu",
        validationRule: { min: 125, max: 355 },
      },
      {
        key: "tire_profile",
        label: "Profil pneu",
        type: "NUMBER",
        order: 4,
        dependsOnKey: "part_type",
        dependsOnValue: "Pneu",
        validationRule: { min: 25, max: 85 },
      },
      {
        key: "oem_reference",
        label: "Référence constructeur",
        type: "TEXT",
        order: 5,
        helpText: "Numéro OEM pour compatibilité véhicule.",
      },
    ],
  },
  {
    label: "Animalerie",
    preferredSlugs: [
      "aliments-pour-chiens-sans-ordonnance-543682",
      "aliments-pour-chats-sans-ordonnance-543684",
    ],
    attrs: [
      {
        key: "species",
        label: "Espèce",
        type: "SELECT",
        required: true,
        options: ["Chien", "Chat", "Oiseau", "Poisson", "Rongeur"],
        order: 1,
      },
      {
        key: "product_type",
        label: "Type de produit",
        type: "SELECT",
        required: true,
        options: ["Croquettes", "Pâtée", "Litière", "Jouet", "Accessoire"],
        order: 2,
      },
      {
        key: "dog_weight_kg",
        label: "Poids du chien",
        type: "SELECT",
        options: ["< 10 kg", "10–25 kg", "25–40 kg", "> 40 kg"],
        order: 3,
        dependsOnKey: "species",
        dependsOnValue: "Chien",
      },
      {
        key: "grain_free",
        label: "Sans céréales",
        type: "BOOLEAN",
        order: 4,
        dependsOnKey: "product_type",
        dependsOnValue: "Croquettes",
      },
      {
        key: "flavor",
        label: "Saveur",
        type: "SELECT",
        options: ["Poulet", "Bœuf", "Saumon", "Agneau"],
        order: 5,
        dependsOnKey: "product_type",
        dependsOnValue: "Croquettes",
      },
    ],
  },
]

async function findLeafCategory(aisle: AisleSeed) {
  for (const slug of aisle.preferredSlugs) {
    const cat = await prisma.category.findFirst({
      where: { slug, isLeaf: true },
      select: { id: true, name: true, slug: true },
    })
    if (cat) return cat
  }
  return null
}

async function upsertAttrs(categoryId: string, attrs: AttrSeed[]) {
  for (const attr of attrs) {
    await prisma.categoryAttribute.upsert({
      where: { categoryId_key: { categoryId, key: attr.key } },
      create: {
        categoryId,
        key: attr.key,
        label: attr.label,
        type: attr.type,
        required: attr.required ?? false,
        options: attr.options ?? [],
        order: attr.order,
        unit: attr.unit ?? null,
        aiSuggest: attr.aiSuggest ?? true,
        showInFilter: attr.showInFilter ?? true,
        validationRule: attr.validationRule ?? undefined,
        dependsOnKey: attr.dependsOnKey ?? null,
        dependsOnValue: attr.dependsOnValue ?? null,
        helpText: attr.helpText ?? null,
      },
      update: {
        label: attr.label,
        type: attr.type,
        required: attr.required ?? false,
        options: attr.options ?? [],
        order: attr.order,
        unit: attr.unit ?? null,
        aiSuggest: attr.aiSuggest ?? true,
        showInFilter: attr.showInFilter ?? true,
        validationRule: attr.validationRule ?? Prisma.JsonNull,
        dependsOnKey: attr.dependsOnKey ?? null,
        dependsOnValue: attr.dependsOnValue ?? null,
        helpText: attr.helpText ?? null,
      },
    })
  }
}

async function main() {
  let seeded = 0
  for (const aisle of AMAZON_AISLES) {
    const cat = await findLeafCategory(aisle)
    if (!cat) {
      console.warn(`⚠️  ${aisle.label}: no matching leaf category — skipped`)
      continue
    }
    await upsertAttrs(cat.id, aisle.attrs)
    seeded += aisle.attrs.length
    console.log(`✅ ${aisle.label}: ${aisle.attrs.length} attrs → ${cat.name} (${cat.slug})`)
  }
  console.log(`Done. Upserted ${seeded} attribute rows across ${AMAZON_AISLES.length} aisles.`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
