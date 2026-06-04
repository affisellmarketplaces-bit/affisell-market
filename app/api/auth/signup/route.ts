import * as Sentry from "@sentry/nextjs"
import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"

import { rateLimitClientKey, rateLimitResponse } from "@/lib/api-rate-limit"
import {
  clientIpFromRequest,
  errorMessage,
  errorStackSnippet,
  flushLogs,
  logger,
} from "@/lib/logger"
import { logBusiness } from "@/lib/business-log"
import { prisma } from "@/lib/prisma"
import { ensureMerchantStore } from "@/lib/ensure-store"
import { buildConsentPayload, type MerchantRole } from "@/lib/legal/consent"
import { logTermsAcceptanceFromRequest } from "@/lib/terms-logger"
import { termsLogTypeForRole } from "@/lib/legal-versions"
import {
  clearSignupDrafts,
  loadSignupDrafts,
  persistMerchantLegalProfile,
} from "@/lib/merchant-legal/persist-merchant-legal-profile"
import { validateMerchantSignupPayload } from "@/lib/merchant-legal/validate-merchant-signup"
import {
  BUYER_ACCOUNT_TYPES,
  type BuyerAccountType,
} from "@/lib/merchant-legal/merchant-legal-status-shared"
import type { MerchantDocumentType, MerchantLegalStatus } from "@/lib/merchant-legal/merchant-legal-status-shared"
import { claimAffiliateInvitationForUser } from "@/lib/supplier-affiliate-invitation"
import { claimSupplierInvitationForUser } from "@/lib/supplier-invitation"
import { isValidSignupDraftId } from "@/lib/signup-draft-id"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const ROUTE = "auth/signup"

export async function POST(req: Request) {
  try {
    const ip = clientIpFromRequest(req)
    const limited = rateLimitResponse(rateLimitClientKey(req), {
      prefix: "signup",
      limit: 8,
      windowMs: 60 * 60 * 1000,
    })
    if (limited) {
      await logger.warn("Signup rate limited", { route: ROUTE, ip })
      return limited
    }

    await logger.info("Signup attempt", { route: ROUTE, ip })
    const body = (await req.json()) as {
      email?: string
      password?: string
      role?: string
      name?: string
      tiktok?: string
      siret?: string
      inviteToken?: string
      acceptCgu?: boolean
      acceptTerms?: boolean
      acceptRoleTerms?: boolean
      acceptPrivacy?: boolean
      signupDraftId?: string
      legalStatus?: string
      legalEntityName?: string
      tradeName?: string
      vatNumber?: string
      rnaNumber?: string
      countryCode?: string
      buyerAccountType?: string
    }
    const {
      email,
      password,
      role,
      name: nameRaw,
      tiktok,
      siret,
      inviteToken,
      acceptCgu,
      acceptTerms,
      acceptRoleTerms,
      acceptPrivacy,
      signupDraftId,
      legalStatus,
      legalEntityName,
      tradeName,
      vatNumber,
      rnaNumber,
      countryCode,
      buyerAccountType,
    } = body
    const emailNormalized = typeof email === "string" ? email.toLowerCase().trim() : ""
    if (!emailNormalized || !password) {
      return NextResponse.json({ error: "Missing email or password" }, { status: 400 })
    }

    const resolvedRole =
      role === "SUPPLIER" ? "SUPPLIER" : role === "CUSTOMER" ? "CUSTOMER" : "AFFILIATE"

    const cguOk = Boolean(acceptCgu ?? acceptTerms)
    const privacyOk = Boolean(acceptPrivacy)
    const roleTermsOk =
      resolvedRole === "CUSTOMER" ? true : Boolean(acceptRoleTerms ?? acceptTerms)
    if (!cguOk || !privacyOk) {
      return NextResponse.json(
        { error: "Vous devez accepter les CGU et la politique de confidentialité." },
        { status: 400 }
      )
    }
    if (!roleTermsOk) {
      return NextResponse.json(
        { error: "Vous devez accepter les conditions spécifiques à votre rôle (CGA ou CGS)." },
        { status: 400 }
      )
    }

    const exists = await prisma.user.findUnique({ where: { email: emailNormalized } })
    if (exists) {
      return NextResponse.json({ error: "Email already in use" }, { status: 400 })
    }

    const hash = await bcrypt.hash(password, 10)
    const consent = buildConsentPayload(resolvedRole as MerchantRole)

    let buyerType: BuyerAccountType | null = null
    if (resolvedRole === "CUSTOMER") {
      const raw = buyerAccountType?.trim().toUpperCase() ?? "INDIVIDUAL"
      buyerType = (BUYER_ACCOUNT_TYPES as readonly string[]).includes(raw)
        ? (raw as BuyerAccountType)
        : "INDIVIDUAL"
    }

    type MerchantLegalPayload = {
      legalStatus: MerchantLegalStatus
      legalEntityName: string | null
      tradeName: string | null
      siret: string | null
      vatNumber: string | null
      rnaNumber: string | null
      countryCode: string
      documents: Array<{
        documentType: MerchantDocumentType
        fileUrl: string
        fileName: string | null
        mimeType: string | null
        fileSizeBytes: number | null
      }>
    }

    let merchantLegal: MerchantLegalPayload | null = null
    let pendingDraftId: string | null = null

    if (resolvedRole === "SUPPLIER" || resolvedRole === "AFFILIATE") {
      const draftId = signupDraftId?.trim() ?? ""
      if (!isValidSignupDraftId(draftId)) {
        return NextResponse.json({ error: "signup_draft_required" }, { status: 400 })
      }
      const draftRows = await loadSignupDrafts(draftId)
      const validated = validateMerchantSignupPayload(
        resolvedRole,
        {
          legalStatus: legalStatus ?? "",
          legalEntityName,
          tradeName,
          siret,
          vatNumber,
          rnaNumber,
          countryCode,
        },
        draftRows.map((r) => ({ documentType: r.documentType, fileUrl: r.fileUrl }))
      )
      if (!validated.ok) {
        logBusiness("signup", { result: "legal_validation_failed", error: validated.error, role: resolvedRole })
        return NextResponse.json({ error: validated.error }, { status: 400 })
      }
      const byType = new Map(draftRows.map((r) => [r.documentType, r]))
      merchantLegal = {
        ...validated.data,
        documents: validated.data.documents.map((d) => {
          const row = byType.get(d.documentType)
          return {
            documentType: d.documentType,
            fileUrl: d.fileUrl,
            fileName: row?.fileName ?? null,
            mimeType: row?.mimeType ?? null,
            fileSizeBytes: row?.fileSizeBytes ?? null,
          }
        }),
      }
      pendingDraftId = draftId
    }

    const displayName =
      typeof nameRaw === "string" && nameRaw.trim() ? nameRaw.trim().slice(0, 120) : null

    const user = await prisma.user.create({
      data: {
        email: emailNormalized,
        password: hash,
        role: resolvedRole,
        name: displayName,
        buyerAccountType: buyerType,
        ...consent,
      },
    })

    if (cguOk) {
      await logTermsAcceptanceFromRequest(req, user.id, "cgu")
    }
    if (
      (resolvedRole === "SUPPLIER" || resolvedRole === "AFFILIATE") &&
      roleTermsOk
    ) {
      await logTermsAcceptanceFromRequest(req, user.id, termsLogTypeForRole(resolvedRole))
    }

    let store = null
    if (resolvedRole === "AFFILIATE" || resolvedRole === "SUPPLIER") {
      store = await ensureMerchantStore({
        userId: user.id,
        email: emailNormalized,
        displayName,
      })
    }

    const tiktokHandle =
      typeof tiktok === "string" && tiktok.trim() ? tiktok.trim().replace(/^@/, "").slice(0, 80) : null
    const siretDigits =
      typeof siret === "string" && siret.trim() ? siret.replace(/\D/g, "").slice(0, 14) : null

    if (store && tiktokHandle && resolvedRole === "AFFILIATE") {
      await prisma.store.update({
        where: { id: store.id },
        data: { tiktok: tiktokHandle },
      })
    }

    if (merchantLegal) {
      await persistMerchantLegalProfile({
        userId: user.id,
        legalStatus: merchantLegal.legalStatus,
        legalEntityName: merchantLegal.legalEntityName,
        tradeName: merchantLegal.tradeName,
        siret: merchantLegal.siret,
        vatNumber: merchantLegal.vatNumber,
        rnaNumber: merchantLegal.rnaNumber,
        countryCode: merchantLegal.countryCode,
        documents: merchantLegal.documents,
      })
      if (pendingDraftId) await clearSignupDrafts(pendingDraftId)
      logBusiness("signup", {
        result: "merchant_legal_submitted",
        userId: user.id,
        legalStatus: merchantLegal.legalStatus,
      })
    } else if (store && siretDigits && resolvedRole === "SUPPLIER") {
      await prisma.store.update({
        where: { id: store.id },
        data: { description: `SIRET: ${siretDigits}` },
      })
    }

    if (resolvedRole === "SUPPLIER" && typeof inviteToken === "string" && inviteToken.trim()) {
      await claimSupplierInvitationForUser(inviteToken.trim(), user.id).catch((e) => {
        console.error("[signup] supplier invite claim failed", e)
      })
    }

    if (resolvedRole === "AFFILIATE" && typeof inviteToken === "string" && inviteToken.trim()) {
      await claimAffiliateInvitationForUser(inviteToken.trim(), user.id).catch((e) => {
        console.error("[signup] affiliate invite claim failed", e)
      })
    }

    await logger.info("Signup success", { route: ROUTE, ip, role: resolvedRole })
    return NextResponse.json({ ok: true }, { status: 201 })
  } catch (e: unknown) {
    Sentry.captureException(e)
    await logger.error("Signup failed", {
      route: ROUTE,
      error: errorMessage(e),
      stack: errorStackSnippet(e),
    })
    const message = errorMessage(e)
    return NextResponse.json({ error: message }, { status: 500 })
  } finally {
    await flushLogs()
  }
}
