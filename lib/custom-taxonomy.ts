import type { AppLocale } from "@/lib/i18n-locale"

/**
 * Affisell additions to the Google product taxonomy (modern product types Google's file does not have).
 * Source of truth for the DB migration `20260921120000_custom_taxonomy_modern_products` (kept in sync by a test)
 * and for the display translations of these rows (they have no googleId, so the official files cannot translate them).
 *
 * Rows are created under existing parents (found by their French `fullPath`): commission rates and attribute
 * templates are inherited through `parentId`, exactly as for every other category.
 */
export type CustomCategory = {
  /** Path (French, as stored in Category.fullPath) of the EXISTING parent. */
  parentPath: string
  /** French name = stored `name`. */
  name: string
  isLeaf: boolean
  order: number
  names: Record<Exclude<AppLocale, "fr">, string>
}

const P_ELEC = "Appareils électroniques"
const SECTION = "Objets connectés et réalité virtuelle"

export const CUSTOM_CATEGORIES: CustomCategory[] = [
  { parentPath: P_ELEC, name: SECTION, isLeaf: false, order: 910001, names: { en: "Wearables & virtual reality", de: "Wearables und virtuelle Realität", es: "Dispositivos vestibles y realidad virtual", it: "Dispositivi indossabili e realtà virtuale", nl: "Wearables en virtual reality", pl: "Urządzenia noszone i wirtualna rzeczywistość", zh: "可穿戴设备与虚拟现实" } },
  { parentPath: `${P_ELEC} > ${SECTION}`, name: "Montres connectées", isLeaf: true, order: 910002, names: { en: "Smartwatches", de: "Smartwatches", es: "Relojes inteligentes", it: "Smartwatch", nl: "Smartwatches", pl: "Smartwatche", zh: "智能手表" } },
  { parentPath: `${P_ELEC} > ${SECTION}`, name: "Bracelets d'activité connectés", isLeaf: true, order: 910003, names: { en: "Smart fitness bands", de: "Fitnessarmbänder", es: "Pulseras de actividad inteligentes", it: "Braccialetti fitness smart", nl: "Slimme activiteitstrackers", pl: "Inteligentne opaski fitness", zh: "智能运动手环" } },
  { parentPath: `${P_ELEC} > ${SECTION}`, name: "Casques de réalité virtuelle", isLeaf: true, order: 910004, names: { en: "Virtual reality headsets", de: "VR-Brillen", es: "Gafas de realidad virtual", it: "Visori per realtà virtuale", nl: "VR-brillen", pl: "Gogle VR", zh: "虚拟现实头显" } },
  { parentPath: `${P_ELEC} > ${SECTION}`, name: "Lunettes connectées", isLeaf: true, order: 910005, names: { en: "Smart glasses", de: "Smart Glasses", es: "Gafas inteligentes", it: "Occhiali smart", nl: "Slimme brillen", pl: "Inteligentne okulary", zh: "智能眼镜" } },
  { parentPath: "Appareils photo, caméras et instruments d'optique > Appareils photo et caméras", name: "Drones avec caméra", isLeaf: true, order: 910006, names: { en: "Camera drones", de: "Kameradrohnen", es: "Drones con cámara", it: "Droni con fotocamera", nl: "Drones met camera", pl: "Drony z kamerą", zh: "带摄像头的无人机" } },
  { parentPath: "Véhicules et accessoires > Pièces détachées pour véhicules > Électronique pour véhicules", name: "Caméras embarquées (dashcams)", isLeaf: true, order: 910007, names: { en: "Dash cams", de: "Dashcams", es: "Cámaras de salpicadero (dashcams)", it: "Dashcam", nl: "Dashcams", pl: "Wideorejestratory samochodowe", zh: "行车记录仪" } },
  { parentPath: "Véhicules et accessoires > Pièces détachées pour véhicules > Électronique pour véhicules", name: "Chargeurs de voiture et adaptateurs allume-cigare", isLeaf: true, order: 910008, names: { en: "Car chargers & cigarette lighter adapters", de: "Kfz-Ladegeräte und Zigarettenanzünder-Adapter", es: "Cargadores de coche y adaptadores de mechero", it: "Caricabatterie auto e adattatori accendisigari", nl: "Autopladers en sigarettenaanstekeradapters", pl: "Ładowarki samochodowe i adaptery zapalniczki", zh: "车载充电器及点烟器转接头" } },
  { parentPath: "Équipements sportifs > Loisirs de plein air", name: "Hoverboards et gyropodes", isLeaf: true, order: 910009, names: { en: "Hoverboards & self-balancing scooters", de: "Hoverboards und Self-Balancing-Scooter", es: "Hoverboards y patinetes autoequilibrados", it: "Hoverboard e monopattini autobilanciati", nl: "Hoverboards en zelfbalancerende steps", pl: "Hoverboardy i deskorolki samobalansujące", zh: "平衡车与自平衡电动滑板车" } },
  { parentPath: `${P_ELEC} > Accessoires électroniques > Alimentation`, name: "Batteries externes (power banks)", isLeaf: true, order: 910010, names: { en: "Power banks", de: "Powerbanks", es: "Baterías externas (power banks)", it: "Power bank", nl: "Powerbanks", pl: "Powerbanki", zh: "移动电源" } },
  { parentPath: "Maison et jardin > Appareils électroménagers", name: "Aspirateurs robots", isLeaf: true, order: 910011, names: { en: "Robot vacuum cleaners", de: "Saugroboter", es: "Aspiradoras robot", it: "Robot aspirapolvere", nl: "Robotstofzuigers", pl: "Odkurzacze automatyczne", zh: "扫地机器人" } },
  { parentPath: "Maison et jardin > Sécurité à domicile et au bureau", name: "Sonnettes vidéo connectées", isLeaf: true, order: 910012, names: { en: "Video doorbells", de: "Video-Türklingeln", es: "Timbres con vídeo", it: "Campanelli video", nl: "Videodeurbellen", pl: "Wideodzwonki do drzwi", zh: "视频门铃" } },
  { parentPath: "Maison et jardin > Sécurité à domicile et au bureau", name: "Serrures connectées", isLeaf: true, order: 910013, names: { en: "Smart locks", de: "Smart Locks", es: "Cerraduras inteligentes", it: "Serrature smart", nl: "Slimme sloten", pl: "Inteligentne zamki", zh: "智能门锁" } },
  { parentPath: "Maison et jardin > Arts de la table et arts culinaires > Électroménager de cuisine", name: "Robots pâtissiers et batteurs", isLeaf: true, order: 910014, names: { en: "Stand mixers & hand mixers", de: "Küchenmaschinen und Handmixer", es: "Robots de repostería y batidoras", it: "Impastatrici e planetarie", nl: "Keukenmachines en mixers", pl: "Roboty planetarne i miksery", zh: "厨师机与手持搅拌器" } },
]

export function customCategorySlug(name: string): string {
  return (
    name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") + "-affisell"
  )
}

/** French stored name → translations (custom rows only; official rows are translated by googleId). */
const BY_FRENCH_NAME = new Map(CUSTOM_CATEGORIES.map((c) => [c.name, c.names] as const))

export function localizeCustomCategoryName(frenchName: string, locale: AppLocale): string | null {
  if (locale === "fr") return null
  return BY_FRENCH_NAME.get(frenchName)?.[locale] ?? null
}

/** SQL of the migration (idempotent: skipped when the slug exists or the parent is missing). */
export function customTaxonomyMigrationSql(): string {
  const q = (s: string) => `'${s.replace(/'/g, "''")}'`
  const rows = CUSTOM_CATEGORIES.map((c) => {
    const slug = customCategorySlug(c.name)
    return `INSERT INTO "Category" ("id", "name", "slug", "icon", "order", "parentId", "level", "fullPath", "isLeaf", "specs")
SELECT ${q(`aff-cat-${slug}`)}, ${q(c.name)}, ${q(slug)}, '📦', ${c.order}, p."id", p."level" + 1, p."fullPath" || ' > ' || ${q(c.name)}, ${c.isLeaf ? "true" : "false"}, ARRAY[]::text[]
FROM "Category" p WHERE p."fullPath" = ${q(c.parentPath)}
ON CONFLICT ("slug") DO NOTHING;`
  })
  return `-- Affisell additions to the Google taxonomy: modern product types (smartwatches, VR, drones, dashcams, power banks,
-- robot vacuums, smart locks…). Additive and idempotent; parents are found by fullPath, commission/attribute
-- inheritance follows parentId. Generated from lib/custom-taxonomy.ts (a test keeps both in sync).
${rows.join("\n\n")}
`
}
