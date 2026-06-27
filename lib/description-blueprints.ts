/** Product-type blueprints — varied SEO section structures for Studio copy. */

export type DescriptionBlueprint = {
  id: string
  family: string
  sections: readonly string[]
  /** Prompt angle: tone + narrative focus for this layout */
  angle: string
}

export type DescriptionBlueprintContext = {
  title: string
  categoryPath: string
  /** Optional nonce — pass Date.now() to rotate layouts on each generation */
  variationNonce?: number
}

const FAMILY_KEYWORDS: Record<string, string[]> = {
  tech: [
    "électronique",
    "electronique",
    "smartphone",
    "téléphone",
    "telephone",
    "ordinateur",
    "tablette",
    "barbecue",
    "grill",
    "fumoir",
    "robot",
    "machine",
    "appareil",
    "connect",
    "wifi",
    "bluetooth",
    "batterie",
    "chargeur",
    "caméra",
    "camera",
    "audio",
    "casque",
    "tv",
    "électrique",
    "electrique",
    "ninja",
    "kitchen",
    "cuisine connectée",
  ],
  fashion: [
    "mode",
    "vêtement",
    "vetement",
    "robe",
    "pantalon",
    "chemise",
    "sac",
    "chaussure",
    "bijou",
    "textile",
    "cuir",
    "coton",
    "lingerie",
    "accessoire",
    "montre",
  ],
  beauty: [
    "beauté",
    "beaute",
    "peau",
    "crème",
    "creme",
    "sérum",
    "serum",
    "maquillage",
    "parfum",
    "cheveux",
    "shampooing",
    "soin",
    "cosmétique",
    "cosmetique",
    "wellness",
    "bien-être",
  ],
  home: [
    "maison",
    "déco",
    "deco",
    "meuble",
    "coussin",
    "literie",
    "casserole",
    "vaisselle",
    "jardin",
    "luminaire",
    "rangement",
    "ustensile",
    "art de la table",
    "linge de maison",
  ],
  food: [
    "alimentaire",
    "nourriture",
    "café",
    "cafe",
    "thé",
    "the",
    "épicerie",
    "epicerie",
    "snack",
    "boisson",
    "vin",
    "chocolat",
    "gourmet",
    "bio",
  ],
  sport: [
    "sport",
    "fitness",
    "gym",
    "yoga",
    "vélo",
    "velo",
    "running",
    "outdoor",
    "camping",
    "randonnée",
    "randonnee",
    "musculation",
    "entraînement",
  ],
  kids: [
    "enfant",
    "bébé",
    "bebe",
    "jouet",
    "maternelle",
    "poussette",
    "puériculture",
    "puericulture",
    "école",
    "ecole",
  ],
}

export const DESCRIPTION_BLUEPRINTS: DescriptionBlueprint[] = [
  {
    id: "classic-conversion",
    family: "default",
    sections: [
      "ACCROCHE",
      "POUR QUI ?",
      "POINTS FORTS",
      "UTILISATION & ENTRETIEN",
      "POURQUOI CE PRODUIT ?",
      "INNOVATION",
    ],
    angle: "Fiche conversion classique : bénéfice → cible → preuves → usage → différenciation.",
  },
  {
    id: "classic-story",
    family: "default",
    sections: [
      "L'ESSENTIEL",
      "LE PROBLÈME RÉSOLU",
      "CE QUI CHANGE POUR VOUS",
      "AU QUOTIDIEN",
      "POURQUOI MAINTENANT",
    ],
    angle: "Récit orienté problème/solution — ton direct, phrases courtes en ouverture.",
  },
  {
    id: "tech-performance",
    family: "tech",
    sections: [
      "EN UN COUP D'ŒIL",
      "CE QUE VOUS GAGNEZ",
      "SPECS QUI COMPTENT",
      "MISE EN ROUTE",
      "SCÉNARIOS D'USAGE",
      "POURQUOI CE MODÈLE",
    ],
    angle: "Produit technique : specs traduites en bénéfices, scénarios concrets, pas de jargon vide.",
  },
  {
    id: "tech-lifestyle",
    family: "tech",
    sections: [
      "L'ESSENTIEL",
      "POUR QUEL USAGE ?",
      "POINTS TECHNIQUES",
      "UTILISATION QUOTIDIENNE",
      "ENTRETIEN & DURABILITÉ",
      "CE QUI NOUS A CONVAINCUS",
    ],
    angle: "Tech grand public : accessible, orienté usage réel et tranquillité d'esprit.",
  },
  {
    id: "fashion-style",
    family: "fashion",
    sections: [
      "L'ESSENTIEL STYLE",
      "POUR QUI ?",
      "MATIÈRES & FINITIONS",
      "PORTER & ASSOCIER",
      "ENTRETIEN",
      "POURQUOI L'ADOPTER",
    ],
    angle: "Mode : matière, silhouette, styling — vocabulaire tendance mais factuel.",
  },
  {
    id: "fashion-wardrobe",
    family: "fashion",
    sections: [
      "VOTRE NOUVEAU BASIQUE",
      "SILHOUETTE & CONFORT",
      "DÉTAILS QUI FONT LA DIFFÉRENCE",
      "COMMENT LE PORTER",
      "SOINS & LAVAGE",
      "L'AVANTAGE AFFISELL",
    ],
    angle: "Garde-robe : confort, polyvalence, idées de looks — pas de superlatifs creux.",
  },
  {
    id: "beauty-ritual",
    family: "beauty",
    sections: [
      "PROMESSE BEAUTÉ",
      "POUR QUEL BESOIN ?",
      "FORMULE & TEXTURE",
      "RITUEL D'APPLICATION",
      "RÉSULTATS ATTENDUS",
      "POURQUOI CETTE FORMULE",
    ],
    angle: "Beauté : rituel, texture, attentes réalistes — jamais de claims médicaux inventés.",
  },
  {
    id: "home-living",
    family: "home",
    sections: [
      "ACCROCHE DÉCO",
      "POUR QUELLE PIÈCE ?",
      "MATÉRIAUX & QUALITÉ",
      "UTILISATION AU QUOTIDIEN",
      "ENTRETIEN FACILE",
      "POURQUOI CE CHOIX",
    ],
    angle: "Maison : ambiance, pièce cible, durabilité — ton chaleureux et rassurant.",
  },
  {
    id: "food-gourmet",
    family: "food",
    sections: [
      "SAVEUR & ORIGINE",
      "POUR QUEL MOMENT ?",
      "COMPOSITION",
      "CONSERVATION",
      "CONSEILS DÉGUSTATION",
      "POURQUOI LE CHOISIR",
    ],
    angle: "Alimentaire : origine, moment de consommation, conservation — sensoriel et factuel.",
  },
  {
    id: "sport-performance",
    family: "sport",
    sections: [
      "PERFORMANCE",
      "POUR QUEL NIVEAU ?",
      "TECHNOLOGIES CLÉS",
      "UTILISATION & SÉCURITÉ",
      "ENTRAÎNEMENTS IDÉAUX",
      "POURQUOI CE MODÈLE",
    ],
    angle: "Sport : niveau cible, sécurité, sessions types — énergie sans hyperbole.",
  },
  {
    id: "kids-family",
    family: "kids",
    sections: [
      "POURQUOI LES PARENTS L'ADORENT",
      "ÂGE & SÉCURITÉ",
      "POINTS FORTS",
      "UTILISATION",
      "ENTRETIEN",
      "POURQUOI CE CHOIX",
    ],
    angle: "Famille : sécurité, tranche d'âge, simplicité — rassurant pour les parents.",
  },
]

function normalizeContext(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
}

function scoreFamily(family: string, haystack: string): number {
  const keywords = FAMILY_KEYWORDS[family]
  if (!keywords) return 0
  let score = 0
  for (const kw of keywords) {
    const n = normalizeContext(kw)
    if (n && haystack.includes(n)) score += n.includes(" ") ? 2 : 1
  }
  return score
}

function resolveFamily(ctx: DescriptionBlueprintContext): string {
  const haystack = normalizeContext(`${ctx.title} ${ctx.categoryPath}`)
  let bestFamily = "default"
  let bestScore = 0
  for (const family of Object.keys(FAMILY_KEYWORDS)) {
    const score = scoreFamily(family, haystack)
    if (score > bestScore) {
      bestScore = score
      bestFamily = family
    }
  }
  return bestScore > 0 ? bestFamily : "default"
}

/** Pick the best blueprint for product type; rotates among variants when nonce changes. */
export function pickDescriptionBlueprint(ctx: DescriptionBlueprintContext): DescriptionBlueprint {
  const family = resolveFamily(ctx)
  const candidates = DESCRIPTION_BLUEPRINTS.filter((b) => b.family === family)
  const pool = candidates.length > 0 ? candidates : DESCRIPTION_BLUEPRINTS.filter((b) => b.family === "default")
  const nonce = ctx.variationNonce ?? Date.now()
  const index = Math.abs(nonce) % pool.length
  return pool[index] ?? DESCRIPTION_BLUEPRINTS[0]!
}

/** All section titles across blueprints — used for parsing & validation. */
export function allDescriptionSectionTitles(): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const bp of DESCRIPTION_BLUEPRINTS) {
    for (const section of bp.sections) {
      const key = section.toUpperCase()
      if (seen.has(key)) continue
      seen.add(key)
      out.push(section)
    }
  }
  return out
}
