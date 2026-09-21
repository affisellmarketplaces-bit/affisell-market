/**
 * Finds taxonomy gaps: modern product types whose best category is weak (read-only; calls the Anthropic API).
 *   npx tsx scripts/audit-taxonomy-gaps.ts
 */
import { config } from "dotenv"
import { PrismaClient } from "@prisma/client"
import { pointAtTestDatabase } from "../lib/testing/db-test-guard"

config({ path: ".env.local" })
config()
// EVAL_DB=test → read the dedicated test database (guarded: never the production endpoint).
if (process.env.EVAL_DB === "test") pointAtTestDatabase()

import { buildCategoryBrowse } from "../lib/category-browse-shared"
import { classifyProductTaxonomy } from "../lib/ai/taxonomy-classifier"

const CONCEPTS = [
  "Caméra de tableau de bord voiture dashcam 4K", "Montre connectée bracelet sport GPS", "Batterie externe power bank 20000mAh", "Chargeur de voiture allume-cigare USB C 65W",
  "Aspirateur portable sans fil pour voiture", "Aspirateur robot laveur avec station", "Drone avec caméra 4K pliable", "Casque de réalité virtuelle VR autonome",
  "Hoverboard 6,5 pouces auto-équilibrant", "Vidéoprojecteur portable HD WiFi", "Sonnette vidéo WiFi sans fil", "Serrure connectée à empreinte digitale",
  "Caméra de surveillance WiFi extérieure 360", "Pistolet de massage musculaire", "Brosse à dents électrique sonique", "Épilateur à lumière pulsée IPL",
  "Lisseur cheveux professionnel céramique", "Friteuse à air sans huile 6L", "Machine à café à capsules", "Blender portable rechargeable USB",
  "Gourde isotherme inox 1L", "Humidificateur d'air ultrasonique", "Diffuseur d'huiles essentielles", "Ventilateur portable de cou rechargeable",
  "Purificateur d'air HEPA", "Mini réfrigérateur pour voiture 12V", "Autoradio Android 10 pouces voiture GPS", "Support de téléphone pour voiture magnétique",
  "Tapis de sol voiture sur mesure", "Housse de siège voiture universelle", "Mallette à outils 120 pièces", "Pistolet à colle chaude sans fil",
  "Lampe torche LED rechargeable tactique", "Lampe frontale rechargeable", "Sac de couchage momie -10°C", "Hamac de camping avec moustiquaire",
  "Chaise pliante de camping", "Canne à pêche télescopique carbone", "Casque de vélo avec feu arrière", "Gants de moto homologués",
  "Bandes élastiques de résistance fitness", "Haltères réglables 20 kg", "Corde à sauter avec compteur", "Écran PC gaming 27 pouces 165Hz",
  "Clavier mécanique gaming RGB", "Webcam Full HD avec micro", "Micro USB streaming à condensateur", "Hub USB-C 7 en 1",
  "Disque SSD portable 1To", "Télécommande universelle intelligente", "Boîtier TV Android 4K", "Fer à repasser vapeur",
  "Défroisseur vapeur portable", "Aspirateur balai sans fil", "Distributeur de savon automatique", "Balance connectée impédancemètre",
  "Tensiomètre électronique au bras", "Oxymètre de pouls", "Thermomètre frontal infrarouge", "Appareil TENS électrostimulation",
  "Coussin chauffant électrique", "Siège auto bébé pivotant ISOFIX", "Babyphone vidéo avec caméra", "Tire-lait électrique double",
  "Harnais pour chien réfléchissant", "Arbre à chat avec griffoir", "Fontaine à eau pour chat", "Litière automatique pour chat",
  "Chargeur sans fil MagSafe 15W", "Coque de protection iPhone 16", "Verre trempé protection écran", "Câble USB-C vers Lightning tressé",
  "Tablette enfant 10 pouces éducative", "Liseuse électronique 6 pouces", "Trépied selfie stick Bluetooth", "Stabilisateur cardan smartphone 3 axes",
  "Kit de maquillage palette 40 couleurs", "Perruque cheveux naturels", "Tapis de yoga antidérapant", "Piscine gonflable rectangulaire",
  "Barbecue à charbon portable", "Tondeuse à cheveux et barbe sans fil", "Rasoir électrique homme rotatif", "Sèche-cheveux ionique 2200W",
  "Bouilloire électrique en verre", "Grille-pain 4 tranches", "Robot pâtissier multifonction", "Set de couteaux de cuisine",
  "Lunettes de soleil polarisées", "Sac à dos pour ordinateur antivol", "Valise cabine rigide 20 pouces", "Ceinture de sécurité pour animal voiture",
]

async function main() {
  const prisma = new PrismaClient()
  const rows = await prisma.category.findMany({ select: { id: true, name: true, parentId: true, icon: true, order: true }, orderBy: [{ order: "asc" }, { name: "asc" }] })
  await prisma.$disconnect()
  const browse = buildCategoryBrowse(rows)
  const results: string[] = []
  const only = process.env.AUDIT_ONLY?.split("|")
  const queue = CONCEPTS.filter((c) => !only || only.some((o) => c.includes(o)))
  async function worker() {
    for (;;) {
      const title = queue.shift()
      if (!title) return
      try {
        const r = await classifyProductTaxonomy({ title }, { browse, leafPaths: browse.leafPaths })
        const top = r?.picks[0]
        results.push(`${(top?.confidence ?? 0).toFixed(2)} | ${title} → ${top?.breadcrumb ?? "(none)"}`)
      } catch (e) {
        results.push(`ERR | ${title} | ${(e as Error).message.slice(0, 80)}`)
      }
    }
  }
  await Promise.all([worker(), worker(), worker(), worker()])
  results.sort()
  console.log(results.join("\n"))
}
void main()
