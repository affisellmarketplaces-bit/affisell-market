import type { MerchantDocumentType, MerchantLegalStatus } from "@/lib/merchant-legal/merchant-legal-status-shared"
import { prisma } from "@/lib/prisma"

export type PersistMerchantLegalInput = {
  userId: string
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
    fileName?: string | null
    mimeType?: string | null
    fileSizeBytes?: number | null
  }>
}

export async function persistMerchantLegalProfile(input: PersistMerchantLegalInput) {
  return prisma.$transaction(async (tx) => {
    const profile = await tx.merchantLegalProfile.create({
      data: {
        userId: input.userId,
        legalStatus: input.legalStatus,
        verificationStatus: "PENDING_REVIEW",
        legalEntityName: input.legalEntityName,
        tradeName: input.tradeName,
        siret: input.siret,
        vatNumber: input.vatNumber,
        rnaNumber: input.rnaNumber,
        countryCode: input.countryCode,
        submittedAt: new Date(),
      },
    })

    if (input.documents.length > 0) {
      await tx.merchantLegalDocument.createMany({
        data: input.documents.map((d) => ({
          profileId: profile.id,
          documentType: d.documentType,
          fileUrl: d.fileUrl,
          fileName: d.fileName ?? null,
          mimeType: d.mimeType ?? null,
          fileSizeBytes: d.fileSizeBytes ?? null,
        })),
      })
    }

    if (input.siret) {
      const store = await tx.store.findUnique({ where: { userId: input.userId }, select: { id: true } })
      if (store) {
        await tx.store.update({
          where: { id: store.id },
          data: { description: `SIRET: ${input.siret}` },
        })
      }
    }

    return profile
  })
}

export async function loadSignupDrafts(draftId: string) {
  const now = new Date()
  return prisma.signupDocumentDraft.findMany({
    where: { draftId, expiresAt: { gt: now } },
  })
}

export async function clearSignupDrafts(draftId: string) {
  await prisma.signupDocumentDraft.deleteMany({ where: { draftId } })
}
