/**
 * Seed idempotent du réseau d'agents Affisell (upsert par contactEmail).
 * Usage : npm run agents:seed (même DATABASE_URL que le déploiement).
 */
import { prisma } from "@/lib/prisma"

type SeedAgent = {
  displayName: string
  country: string
  city: string
  capabilities: ("QC_INSPECTION" | "COMPLIANCE" | "PHOTO_PROOF" | "REPACK_EXPRESS")[]
  languages: string[]
  ratingX10: number
  missionsDone: number
  leadTimeHours: number
  contactEmail: string
}

const AGENTS: SeedAgent[] = [
  {
    displayName: "Shenzhen QC Hub",
    country: "CN",
    city: "Shenzhen",
    capabilities: ["QC_INSPECTION", "PHOTO_PROOF", "REPACK_EXPRESS"],
    languages: ["zh", "en"],
    ratingX10: 48,
    missionsDone: 412,
    leadTimeHours: 24,
    contactEmail: "agent.shenzhen@affisell.com",
  },
  {
    displayName: "Guangzhou Inspection Co.",
    country: "CN",
    city: "Guangzhou",
    capabilities: ["QC_INSPECTION", "COMPLIANCE", "PHOTO_PROOF"],
    languages: ["zh", "en", "fr"],
    ratingX10: 47,
    missionsDone: 305,
    leadTimeHours: 36,
    contactEmail: "agent.guangzhou@affisell.com",
  },
  {
    displayName: "Yiwu Express Relay",
    country: "CN",
    city: "Yiwu",
    capabilities: ["REPACK_EXPRESS", "PHOTO_PROOF"],
    languages: ["zh", "en"],
    ratingX10: 46,
    missionsDone: 528,
    leadTimeHours: 18,
    contactEmail: "agent.yiwu@affisell.com",
  },
  {
    displayName: "Shanghai Compliance Lab",
    country: "CN",
    city: "Shanghai",
    capabilities: ["COMPLIANCE", "QC_INSPECTION"],
    languages: ["zh", "en"],
    ratingX10: 49,
    missionsDone: 178,
    leadTimeHours: 48,
    contactEmail: "agent.shanghai@affisell.com",
  },
  {
    displayName: "Hong Kong Cross-Dock",
    country: "HK",
    city: "Hong Kong",
    capabilities: ["REPACK_EXPRESS", "QC_INSPECTION"],
    languages: ["zh", "en"],
    ratingX10: 47,
    missionsDone: 233,
    leadTimeHours: 24,
    contactEmail: "agent.hongkong@affisell.com",
  },
  {
    displayName: "Istanbul Sourcing Desk",
    country: "TR",
    city: "Istanbul",
    capabilities: ["QC_INSPECTION", "COMPLIANCE", "REPACK_EXPRESS"],
    languages: ["tr", "en", "fr"],
    ratingX10: 46,
    missionsDone: 142,
    leadTimeHours: 36,
    contactEmail: "agent.istanbul@affisell.com",
  },
  {
    displayName: "Ho Chi Minh QC Partners",
    country: "VN",
    city: "Ho Chi Minh City",
    capabilities: ["QC_INSPECTION", "PHOTO_PROOF"],
    languages: ["vi", "en"],
    ratingX10: 45,
    missionsDone: 96,
    leadTimeHours: 48,
    contactEmail: "agent.hcmc@affisell.com",
  },
  {
    displayName: "Mumbai Verification Bureau",
    country: "IN",
    city: "Mumbai",
    capabilities: ["QC_INSPECTION", "COMPLIANCE"],
    languages: ["hi", "en"],
    ratingX10: 44,
    missionsDone: 87,
    leadTimeHours: 60,
    contactEmail: "agent.mumbai@affisell.com",
  },
  {
    displayName: "Warsaw EU Gateway",
    country: "PL",
    city: "Warsaw",
    capabilities: ["COMPLIANCE", "REPACK_EXPRESS"],
    languages: ["pl", "en", "fr"],
    ratingX10: 47,
    missionsDone: 64,
    leadTimeHours: 24,
    contactEmail: "agent.warsaw@affisell.com",
  },
  {
    displayName: "Mexico City Nearshore Hub",
    country: "MX",
    city: "Mexico City",
    capabilities: ["QC_INSPECTION", "REPACK_EXPRESS", "PHOTO_PROOF"],
    languages: ["es", "en"],
    ratingX10: 45,
    missionsDone: 53,
    leadTimeHours: 36,
    contactEmail: "agent.mexico@affisell.com",
  },
]

async function main() {
  for (const agent of AGENTS) {
    const { contactEmail, ...data } = agent
    await prisma.sourcingAgent.upsert({
      where: { contactEmail },
      create: { contactEmail, status: "ACTIVE", ...data },
      update: {
        displayName: data.displayName,
        country: data.country,
        city: data.city,
        capabilities: data.capabilities,
        languages: data.languages,
        leadTimeHours: data.leadTimeHours,
        status: "ACTIVE",
      },
    })
  }
  const count = await prisma.sourcingAgent.count()
  console.log("[agent-network-seed]", { upserted: AGENTS.length, total: count, result: "ok" })
}

main()
  .catch((error) => {
    console.error("[agent-network-seed]", { result: "fatal", error })
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
