/**
 * Quality harness for the taxonomy classifier (read-only: reads categories, calls the Anthropic API).
 *   npx tsx scripts/eval-taxonomy-classifier.ts            # text-only cases
 * Prints, per case: PASS/FAIL against the expected category pattern (best pick and any of the 3), and the picks.
 */
import { config } from "dotenv"
import { PrismaClient } from "@prisma/client"

config({ path: ".env.local" })
config()

import { buildCategoryBrowse } from "../lib/category-browse-shared"
import { classifyProductTaxonomy } from "../lib/ai/taxonomy-classifier"

const CASES: Array<{ title: string; expect: RegExp }> = [
  { title: "Nouveaux écouteurs sans fil Bluetooth Air Pro 2026", expect: /écouteurs|casques/i },
  { title: "Diagnostic automobile alimenté par USB avec flux de données en temps réel, testeur de défauts moteur", expect: /diagnostic automobile/i },
  { title: "Scanner OBD2 ELM327 Bluetooth voiture lecteur de codes défaut", expect: /diagnostic automobile/i },
  { title: "Montre connectée Xiaomi Smart Band 10 suivi d'activité", expect: /connect|activit/i },
  { title: "Masques FFP2 blancs certifiés CE lot de 50", expect: /masque/i },
  { title: "Trottinette électrique M365 PRO 36V 10.5Ah", expect: /trottinettes|scooters/i },
  { title: "Meuble de rangement 6 tiroirs blanc bois", expect: /commode|rangement|meubles/i },
  { title: "Casserole vapeur à 5 niveaux grande capacité", expect: /vapeur|casseroles|cuisson/i },
  { title: "Console de jeu vidéo portable Anbernic RG40XX V", expect: /consoles/i },
  { title: "Stabilisateur de téléphone intelligent avec suivi du visage", expect: /stabilis|trépied|support|cardan/i },
  { title: "Kit tente dôme géodésique glamping PVC imperméable", expect: /tentes/i },
  { title: "Leggings femme taille haute noir sport", expect: /leggings|pantalons|collants/i },
  { title: "Sac à dos antivol USB étanche 15 pouces", expect: /sacs à dos|bagages|sacs/i },
  { title: "Sérum visage vitamine C anti-âge 30ml", expect: /soin|sérum|visage|peau/i },
  { title: "Barbecue électrique NINJA Woodfire Pro", expect: /barbecue|grill/i },
  { title: "Ordinateur portable 2026 Windows 11 Intel 16 Go 512 Go SSD", expect: /ordinateurs portables/i },
  { title: "Pompe à bouteille d'eau électrique pliable", expect: /pompes|distributeurs|eau/i },
  { title: "Routeur WiFi 4G LTE portable 150Mbps clé USB", expect: /routeurs|modems|réseau/i },
  { title: "Caméra de voiture 3 canaux 4K WiFi vision nocturne", expect: /caméras.*(véhicule|voiture|bord)|dashcam|embarqu/i },
  { title: "Stylo multifonction 4 en 1 avec lumière LED et support pour téléphone", expect: /stylos|écriture|fournitures/i },
  { title: "iPhone 17 Pro Max neuf 256 Go", expect: /téléphones mobiles/i },
  { title: "Croquettes pour chien adulte 15 kg", expect: /chiens|animaux|croquettes/i },
  { title: "Robe de soirée longue rouge", expect: /robes/i },
  { title: "Perceuse visseuse sans fil 18V avec 2 batteries", expect: /perceuses|visseuses|outils/i },
]

async function main() {
  const prisma = new PrismaClient()
  const rows = await prisma.category.findMany({
    select: { id: true, name: true, parentId: true, icon: true, order: true },
    orderBy: [{ order: "asc" }, { name: "asc" }],
  })
  await prisma.$disconnect()
  const browse = buildCategoryBrowse(rows)
  let top1 = 0, top3 = 0
  const started = Date.now()
  for (const c of (process.env.EVAL_ONLY ? CASES.slice(0, Number(process.env.EVAL_ONLY)) : CASES)) {
    const t0 = Date.now()
    try {
      const r = await classifyProductTaxonomy({ title: c.title }, { browse, leafPaths: browse.leafPaths })
      const picks = r?.picks ?? []
      const ok1 = picks[0] ? c.expect.test(picks[0].breadcrumb) : false
      const ok3 = picks.some((p) => c.expect.test(p.breadcrumb))
      if (ok1) top1++
      if (ok3) top3++
      console.log(`${ok1 ? "PASS" : ok3 ? "top3" : "FAIL"} ${((Date.now() - t0) / 1000).toFixed(1)}s | ${c.title.slice(0, 60)}`)
      for (const p of picks) console.log(`       ${p.confidence.toFixed(2)}  ${p.breadcrumb}`)
    } catch (e) {
      console.log(`ERR  | ${c.title.slice(0, 60)} | ${(e as Error).message.slice(0, 120)}`)
    }
  }
  console.log(`\nTop-1: ${top1}/${CASES.length}  Top-3: ${top3}/${CASES.length}  in ${((Date.now() - started) / 1000).toFixed(0)}s`)
}
void main()
