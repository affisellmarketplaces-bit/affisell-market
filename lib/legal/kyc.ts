import type { Prisma } from "@prisma/client"

import { deriveSirenFromSiret } from "@/lib/legal/company-env"
import { prisma } from "@/lib/prisma"

export { scoreKycBadgeClass, scoreKycColor } from "@/lib/legal/kyc-shared"

export type SiretVerification = {
  valid: boolean
  companyName: string | null
  status: "active" | "inactive" | "unknown"
  siren: string | null
  mock?: boolean
}

export type TvaVerification = {
  valid: boolean
  companyName: string | null
  countryCode: string | null
  mock?: boolean
}

export type KycResult = {
  id: string
  supplierId: string
  siret: string | null
  tva: string | null
  siretValid: boolean
  tvaValid: boolean
  companyName: string | null
  score: number
  status: "pending" | "verified" | "failed"
}

type PappersResponse = {
  nom_entreprise?: string
  denomination?: string
  entreprise_cessee?: boolean
  statut_consolide?: string
  siret?: string
  siren?: string
}

function mockSiretVerification(siret: string): SiretVerification {
  const digits = siret.replace(/\D/g, "")
  const valid = digits.length === 14
  console.warn("[legal:kyc]", {
    result: "siret_mock",
    reason: "PAPPERS_API_KEY missing",
    siret: digits.slice(0, 6) + "…",
  })
  return {
    valid,
    companyName: valid ? "Entreprise (mode dev — Pappers non configuré)" : null,
    status: valid ? "active" : "unknown",
    siren: valid ? digits.slice(0, 9) : null,
    mock: true,
  }
}

export async function verifySIRET(siret: string): Promise<SiretVerification> {
  const normalized = siret.replace(/\s/g, "")
  const digits = normalized.replace(/\D/g, "")
  if (digits.length !== 14) {
    return { valid: false, companyName: null, status: "unknown", siren: null }
  }

  const apiKey = process.env.PAPPERS_API_KEY?.trim()
  if (!apiKey) return mockSiretVerification(normalized)

  const siren = deriveSirenFromSiret(digits)
  const url = new URL("https://api.pappers.fr/v2/entreprise")
  url.searchParams.set("api_token", apiKey)
  url.searchParams.set("siret", digits)

  try {
    const res = await fetch(url.toString(), { next: { revalidate: 0 } })
    if (!res.ok) {
      console.error("[legal:kyc]", {
        result: "siret_failed",
        status: res.status,
        siret: digits.slice(0, 6) + "…",
      })
      return { valid: false, companyName: null, status: "unknown", siren }
    }

    const data = (await res.json()) as PappersResponse
    const companyName = data.nom_entreprise?.trim() || data.denomination?.trim() || null
    const inactive =
      data.entreprise_cessee === true ||
      (data.statut_consolide?.toLowerCase().includes("cess") ?? false)

    console.log("[legal:kyc]", {
      result: "siret_ok",
      siret: digits.slice(0, 6) + "…",
      companyName,
      active: !inactive,
    })

    return {
      valid: Boolean(companyName),
      companyName,
      status: inactive ? "inactive" : "active",
      siren: data.siren ?? siren,
    }
  } catch (error) {
    console.error("[legal:kyc]", {
      result: "siret_error",
      error: error instanceof Error ? error.message : String(error),
    })
    return { valid: false, companyName: null, status: "unknown", siren }
  }
}

function mockTvaVerification(tva: string): TvaVerification {
  const normalized = tva.replace(/\s/g, "").toUpperCase()
  const valid = /^[A-Z]{2}[A-Z0-9]{8,12}$/.test(normalized)
  console.warn("[legal:kyc]", {
    result: "tva_mock",
    reason: "VIES fallback unavailable — format check only",
    tva: normalized.slice(0, 4) + "…",
  })
  return {
    valid,
    companyName: valid ? "TVA (mode dev — validation format uniquement)" : null,
    countryCode: valid ? normalized.slice(0, 2) : null,
    mock: true,
  }
}

export async function verifyTVA(tva: string): Promise<TvaVerification> {
  const normalized = tva.replace(/\s/g, "").toUpperCase()
  if (!/^[A-Z]{2}[A-Z0-9]{8,12}$/.test(normalized)) {
    return { valid: false, companyName: null, countryCode: null }
  }

  try {
    const url = `https://api.vatcomply.com/vat?vat_number=${encodeURIComponent(normalized)}`
    const res = await fetch(url, { next: { revalidate: 0 } })
    if (!res.ok) return mockTvaVerification(normalized)

    const data = (await res.json()) as {
      valid?: boolean
      name?: string
      country_code?: string
    }

    console.log("[legal:kyc]", {
      result: "tva_ok",
      tva: normalized.slice(0, 4) + "…",
      valid: data.valid,
    })

    return {
      valid: data.valid === true,
      companyName: data.name?.trim() || null,
      countryCode: data.country_code ?? normalized.slice(0, 2),
    }
  } catch (error) {
    console.error("[legal:kyc]", {
      result: "tva_error",
      error: error instanceof Error ? error.message : String(error),
    })
    return mockTvaVerification(normalized)
  }
}

function computeKycScore(input: {
  siret: SiretVerification
  tva: TvaVerification
}): number {
  let score = 0
  if (input.siret.valid) score += 40
  if (input.siret.status === "active") score += 15
  if (input.tva.valid) score += 30
  if (input.siret.companyName || input.tva.companyName) score += 15
  return Math.min(100, score)
}

function resolveKycStatus(score: number): "pending" | "verified" | "failed" {
  if (score > 80) return "verified"
  if (score >= 50) return "pending"
  return "failed"
}

export async function kycSupplier(input: {
  supplierId: string
  siret?: string | null
  tva?: string | null
}): Promise<KycResult> {
  const profile = await prisma.merchantLegalProfile.findUnique({
    where: { userId: input.supplierId },
    select: { siret: true, vatNumber: true, legalEntityName: true },
  })

  const siretRaw = (input.siret ?? profile?.siret ?? "").trim()
  const tvaRaw = (input.tva ?? profile?.vatNumber ?? "").trim()

  const [siretResult, tvaResult] = await Promise.all([
    siretRaw ? verifySIRET(siretRaw) : Promise.resolve({ valid: false, companyName: null, status: "unknown" as const, siren: null }),
    tvaRaw ? verifyTVA(tvaRaw) : Promise.resolve({ valid: false, companyName: null, countryCode: null }),
  ])

  const score = computeKycScore({ siret: siretResult, tva: tvaResult })
  const status = resolveKycStatus(score)
  const companyName =
    siretResult.companyName ?? tvaResult.companyName ?? profile?.legalEntityName ?? null

  const rawData: Prisma.InputJsonValue = {
    siret: siretResult,
    tva: tvaResult,
    checkedAt: new Date().toISOString(),
  }

  const row = await prisma.kycCheck.upsert({
    where: { supplierId: input.supplierId },
    create: {
      supplierId: input.supplierId,
      siret: siretRaw || null,
      tva: tvaRaw || null,
      siretValid: siretResult.valid,
      tvaValid: tvaResult.valid,
      companyName,
      score,
      status,
      rawData,
    },
    update: {
      siret: siretRaw || null,
      tva: tvaRaw || null,
      siretValid: siretResult.valid,
      tvaValid: tvaResult.valid,
      companyName,
      score,
      status,
      rawData,
      checkedAt: new Date(),
    },
  })

  console.log("[legal:kyc]", {
    result: "supplier_checked",
    supplierId: input.supplierId,
    score,
    status,
  })

  return {
    id: row.id,
    supplierId: row.supplierId,
    siret: row.siret,
    tva: row.tva,
    siretValid: row.siretValid,
    tvaValid: row.tvaValid,
    companyName: row.companyName,
    score: row.score,
    status: row.status as KycResult["status"],
  }
}

export async function listKycChecksForSupplier(supplierId: string) {
  const row = await prisma.kycCheck.findUnique({ where: { supplierId } })
  return row ? [row] : []
}

export async function listAllSuppliersWithKyc() {
  const suppliers = await prisma.user.findMany({
    where: { role: "SUPPLIER" },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      name: true,
      email: true,
      merchantLegalProfile: {
        select: { siret: true, vatNumber: true, legalEntityName: true, verificationStatus: true },
      },
    },
  })

  const kycRows = await prisma.kycCheck.findMany({
    where: { supplierId: { in: suppliers.map((s) => s.id) } },
  })
  const kycBySupplier = new Map(kycRows.map((k) => [k.supplierId, k]))

  return suppliers.map((s) => ({
    supplierId: s.id,
    name: s.merchantLegalProfile?.legalEntityName ?? s.name ?? s.email,
    email: s.email,
    siret: s.merchantLegalProfile?.siret ?? null,
    tva: s.merchantLegalProfile?.vatNumber ?? null,
    verificationStatus: s.merchantLegalProfile?.verificationStatus ?? null,
    kyc: kycBySupplier.get(s.id) ?? null,
  }))
}
