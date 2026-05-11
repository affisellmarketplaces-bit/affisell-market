import type { CategoryAttribute } from "@prisma/client"

/** Lightweight spec defs → full Prisma-shaped rows for the supplier form API. */
export type SpecDef = {
  key: string
  label: string
  type: string
  order: number
  required?: boolean
  unit?: string | null
  options?: string[]
}

function toRow(leafCategoryId: string, def: SpecDef): CategoryAttribute {
  const id = `aff-supp-${def.key}-${leafCategoryId.slice(0, 12)}`
  return {
    id,
    categoryId: leafCategoryId,
    key: def.key,
    label: def.label,
    type: def.type,
    unit: def.unit ?? null,
    options: def.options ?? [],
    required: def.required ?? false,
    order: def.order,
    aiSuggest: true,
    showInFilter: true,
  }
}

type Group = { match: (haystack: string) => boolean; attrs: SpecDef[] }

/**
 * Marketplace-style structured attributes: pattern-match on category slug chain
 * (e.g. `electronics-audio-over-ear-headphones` → electronics + audio templates).
 */
const SUPPLEMENT_GROUPS: Group[] = [
  {
    match: (h) =>
      /electronics|phones|tablets|computers|camera|audio|video-games|wearable|office-equipment|components|gps/i.test(
        h
      ),
    attrs: [
      { key: "model_number", label: "Model / manufacturer part number (MPN)", type: "TEXT", order: 110 },
      { key: "power_source_type", label: "Power source", type: "SELECT", order: 115, options: ["Battery", "Mains", "USB rechargeable", "No power / passive", "Solar"] },
      { key: "battery_type", label: "Battery chemistry (if any)", type: "SELECT", order: 116, options: ["None", "Li-ion", "NiMH", "AAA/AA cells", "Button cell", "Other"] },
      { key: "voltage_rating", label: "Rated voltage", type: "TEXT", unit: "V", order: 117 },
      { key: "wattage", label: "Power draw", type: "NUMBER", unit: "W", order: 118 },
      { key: "connectivity_spec", label: "Connectivity", type: "MULTI_SELECT", order: 119, options: ["Bluetooth", "Wi‑Fi", "USB‑C", "Lightning", "3.5 mm jack", "HDMI", "Ethernet", "NFC"] },
      { key: "operating_system", label: "OS / platform (if software product)", type: "TEXT", order: 120 },
      { key: "storage_capacity", label: "Storage / capacity (as sold)", type: "TEXT", order: 121 },
      { key: "region_variant", label: "Region / plug / keyboard layout", type: "TEXT", order: 122 },
      { key: "included_accessories", label: "What’s in the box", type: "TEXTAREA", order: 125 },
      { key: "warranty_months_elec", label: "Manufacturer warranty", type: "NUMBER", unit: "months", order: 128 },
      { key: "certifications_elec", label: "Certifications & marks", type: "MULTI_SELECT", order: 130, options: ["CE", "UKCA", "FCC", "RoHS", "Energy Star", "WEEE", "Other"] },
    ],
  },
  {
    match: (h) => /beauty|skincare|makeup|hair|personal-care|fragrance|oral-care|shaving|bath-and-body/i.test(h),
    attrs: [
      { key: "intended_use", label: "Intended use / area", type: "TEXT", order: 110 },
      { key: "skin_hair_type", label: "Suitable for", type: "MULTI_SELECT", order: 112, options: ["All", "Dry", "Oily", "Combination", "Sensitive", "Colour-treated hair", "All hair types"] },
      { key: "finish_texture", label: "Finish / texture", type: "SELECT", order: 114, options: ["Matte", "Dewy", "Satin", "Gloss", "Powder", "Cream", "Gel", "Oil", "Serum"] },
      { key: "coverage_level", label: "Coverage (makeup)", type: "SELECT", order: 115, options: ["Not applicable", "Sheer", "Medium", "Full"] },
      { key: "scent_profile", label: "Scent family", type: "TEXT", order: 116 },
      { key: "ph_claim", label: "pH-balanced / hypoallergenic (claim)", type: "BOOLEAN", order: 118 },
      { key: "animal_testing", label: "Animal testing policy", type: "SELECT", order: 120, options: ["Unknown", "Cruelty-free", "Not tested on animals (claim)", "Sold in markets requiring testing"] },
      { key: "period_after_opening", label: "PAO / shelf life after open", type: "TEXT", order: 122 },
      { key: "ingredient_highlights", label: "Key ingredients / INCI highlights", type: "TEXTAREA", order: 124 },
      { key: "allergen_free_claims", label: "Allergen-free claims", type: "MULTI_SELECT", order: 126, options: ["Fragrance-free", "Paraben-free", "Sulphate-free", "Alcohol-free", "Oil-free", "Gluten-free (cosmetic)"] },
    ],
  },
  {
    match: (h) =>
      /fashion|wear|underwear|clothing|shoes|bags|jewelry|watches|kids-fashion|menswear|womens|accessories|textiles-soft|sleepwear|activewear/i.test(
        h
      ),
    attrs: [
      { key: "target_gender", label: "Target gender", type: "SELECT", order: 110, options: ["Women", "Men", "Unisex", "Girls", "Boys", "Baby"] },
      { key: "age_range_apparel", label: "Age segment", type: "SELECT", order: 112, options: ["Adult", "Teen", "Kids", "Baby", "All ages"] },
      { key: "fit_type", label: "Fit", type: "SELECT", order: 114, options: ["Regular", "Slim", "Relaxed", "Oversized", "Athletic", "Tailored"] },
      { key: "season", label: "Season", type: "MULTI_SELECT", order: 116, options: ["All-season", "Spring / Summer", "Autumn / Winter"] },
      { key: "fabric_composition", label: "Fabric / composition (%)", type: "TEXTAREA", order: 118 },
      { key: "care_instructions", label: "Care instructions", type: "TEXTAREA", order: 120 },
      { key: "rise_inseam", label: "Rise / inseam / length notes", type: "TEXT", order: 122 },
      { key: "heel_height_mm", label: "Heel height (footwear)", type: "NUMBER", unit: "mm", order: 124 },
    ],
  },
  {
    match: (h) =>
      /home-supplies|home-kitchen|furniture|storage|lighting|kitchen|bakeware|cookware|tableware|appliances|vacuum|garden|patio/i.test(
        h
      ),
    attrs: [
      { key: "room_usage", label: "Recommended room / use", type: "TEXT", order: 110 },
      { key: "assembly_required", label: "Assembly required", type: "BOOLEAN", order: 112 },
      { key: "capacity_volume_l", label: "Capacity / volume", type: "NUMBER", unit: "L", order: 114 },
      { key: "net_weight_item_g", label: "Net item weight", type: "NUMBER", unit: "g", order: 116 },
      { key: "heat_resistance", label: "Heat resistance / max temp", type: "TEXT", order: 118 },
      { key: "dishwasher_safe", label: "Dishwasher safe", type: "BOOLEAN", order: 120 },
      { key: "microwave_safe", label: "Microwave safe", type: "BOOLEAN", order: 121 },
      { key: "dimensions_packaging", label: "Packaged dimensions (L×W×H)", type: "TEXT", order: 124 },
    ],
  },
  {
    match: (h) => /baby|maternity|toys|kids|nursery|feeding|stroller/i.test(h),
    attrs: [
      { key: "age_grade", label: "Age grade / developmental stage", type: "TEXT", order: 110 },
      { key: "small_parts_warning", label: "Contains small parts (choking hazard)", type: "BOOLEAN", order: 112 },
      { key: "toy_safety_standard", label: "Safety standard (claims)", type: "MULTI_SELECT", order: 114, options: ["CE toy", "EN71", "ASTM F963", "Not a toy", "Other"] },
      { key: "supervision_required", label: "Adult supervision required", type: "BOOLEAN", order: 116 },
    ],
  },
  {
    match: (h) => /pet-supplies|pet\b/i.test(h),
    attrs: [
      { key: "pet_species", label: "Pet type", type: "SELECT", order: 110, options: ["Dog", "Cat", "Small animal", "Bird", "Fish", "Reptile", "Other"] },
      { key: "breed_size_pet", label: "Size / breed guidance", type: "TEXT", order: 112 },
      { key: "life_stage_pet", label: "Life stage", type: "SELECT", order: 114, options: ["All", "Puppy / Kitten", "Adult", "Senior"] },
    ],
  },
  {
    match: (h) => /sports|outdoor|fitness|golf|cycling|camping|hiking|fishing|hunting|water-sports/i.test(h),
    attrs: [
      { key: "activity_type", label: "Activity / sport", type: "TEXT", order: 110 },
      { key: "skill_level", label: "Skill level", type: "SELECT", order: 112, options: ["Beginner", "Intermediate", "Advanced", "All levels"] },
      { key: "weather_rating", label: "Weather / climate suitability", type: "TEXT", order: 114 },
      { key: "safety_gear_included", label: "Protective / safety gear included", type: "BOOLEAN", order: 116 },
    ],
  },
  {
    match: (h) => /food|beverages|grocery|tea|coffee|snacks/i.test(h),
    attrs: [
      { key: "allergen_statement", label: "Allergen statement", type: "TEXTAREA", order: 110 },
      { key: "organic_cert", label: "Organic / certification claim", type: "TEXT", order: 112 },
      { key: "storage_after_open", label: "Storage after opening", type: "TEXT", order: 114 },
    ],
  },
  {
    match: (h) => /automotive|car-care|replacement-parts|interior-accessories/i.test(h),
    attrs: [
      { key: "vehicle_fitment", label: "Vehicle fitment / compatibility", type: "TEXTAREA", order: 110 },
      { key: "part_position", label: "Position on vehicle", type: "TEXT", order: 112 },
      { key: "oem_reference", label: "OEM / reference number", type: "TEXT", order: 114 },
    ],
  },
]

/** Cross-category “innovation” fields: trust, logistics, short-video commerce. */
const GLOBAL_INNOVATION: SpecDef[] = [
  { key: "country_of_origin", label: "Country / region of origin", type: "TEXT", order: 60 },
  { key: "shelf_life_bulk", label: "Shelf life (if applicable)", type: "TEXT", order: 62 },
  {
    key: "compliance_markets",
    label: "Compliance / market marks",
    type: "MULTI_SELECT",
    order: 64,
    options: ["CE", "UKCA", "FCC", "FDA (US)", "Reach compliant (EU)", "Other"],
  },
  {
    key: "sustainability_claims",
    label: "Sustainability",
    type: "MULTI_SELECT",
    order: 66,
    options: [
      "Recyclable packaging",
      "Plastic-reduced",
      "Refillable",
      "Carbon-neutral shipping (seller claim)",
      "Ethical sourcing claim",
    ],
  },
  { key: "package_weight_kg", label: "Shipping weight (packed)", type: "NUMBER", unit: "kg", order: 68 },
  { key: "dangerous_goods", label: "Dangerous goods / restricted (batteries, liquids)", type: "BOOLEAN", order: 70 },
  { key: "listing_hook_line", label: "Short hook for video / social (one line)", type: "TEXT", order: 72 },
  { key: "compliance_notes", label: "Additional compliance or import notes", type: "TEXTAREA", order: 74 },
]

export function mergeMarketplaceStyleSupplements(
  leafCategoryId: string,
  chainSlugs: string[],
  base: CategoryAttribute[]
): CategoryAttribute[] {
  const keys = new Set(base.map((b) => b.key.toLowerCase()))
  const haystack = chainSlugs.join(" ").toLowerCase()
  const out: CategoryAttribute[] = []

  for (const def of GLOBAL_INNOVATION) {
    if (keys.has(def.key.toLowerCase())) continue
    keys.add(def.key.toLowerCase())
    out.push(toRow(leafCategoryId, def))
  }

  for (const group of SUPPLEMENT_GROUPS) {
    if (!group.match(haystack)) continue
    for (const def of group.attrs) {
      if (keys.has(def.key.toLowerCase())) continue
      keys.add(def.key.toLowerCase())
      out.push(toRow(leafCategoryId, def))
    }
  }

  const merged = [...base, ...out]
  merged.sort((a, b) => a.order - b.order || a.label.localeCompare(b.label))
  return merged
}
