import { prisma } from "@/lib/prisma"
import { resolvePublicAppUrl } from "@/lib/public-app-url"

export type SignatureField = {
  name: string
  x: number
  y: number
}

export type PrepareSignatureRequestInput = {
  documentId: string
  signerEmail: string
  signerName?: string
  fields?: SignatureField[]
}

export type SigningLinkResult = {
  signingUrl: string
  token: string
  provider: "docuseal" | "internal"
  expiresAt: string
}

const SIGNING_TTL_DAYS = 14

function resolveAppOrigin(): string {
  return resolvePublicAppUrl()
}

/** DocuSeal API placeholder — retourne null si non configuré ou échec. */
export async function prepareDocuSealRequest(
  input: PrepareSignatureRequestInput & { documentHtml: string }
): Promise<{ externalUrl: string } | null> {
  const apiKey = process.env.DOCUSEAL_API_KEY?.trim()
  const baseUrl = process.env.DOCUSEAL_API_URL?.trim() || "https://api.docuseal.co"
  if (!apiKey) return null

  try {
    const res = await fetch(`${baseUrl}/submissions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "X-Auth-Token": apiKey,
      },
      body: JSON.stringify({
        name: `Affisell — document ${input.documentId}`,
        documents: [{ html: input.documentHtml }],
        submitters: [{ email: input.signerEmail, name: input.signerName ?? input.signerEmail }],
      }),
    })

    if (!res.ok) {
      const body = await res.text().catch(() => "")
      console.log("[legal:signature]", {
        result: "docuseal_failed",
        status: res.status,
        body: body.slice(0, 200),
      })
      return null
    }

    const data = (await res.json()) as { url?: string; signing_url?: string }
    const externalUrl = data.url ?? data.signing_url
    if (!externalUrl) return null

    console.log("[legal:signature]", { result: "docuseal_ok", documentId: input.documentId })
    return { externalUrl }
  } catch (error) {
    console.error("[legal:signature]", {
      result: "docuseal_error",
      error: error instanceof Error ? error.message : String(error),
    })
    return null
  }
}

export async function createSigningLink(
  documentId: string,
  signerEmail: string,
  options?: { supplierId?: string; signerName?: string; documentHtml?: string }
): Promise<SigningLinkResult> {
  const expiresAt = new Date(Date.now() + SIGNING_TTL_DAYS * 24 * 60 * 60 * 1000)

  const record = await prisma.avocatSigningToken.create({
    data: {
      documentId,
      supplierId: options?.supplierId ?? null,
      signerEmail: signerEmail.trim(),
      signerName: options?.signerName?.trim() ?? null,
      expiresAt,
    },
  })

  const origin = resolveAppOrigin()
  const internalUrl = `${origin}/dashboard/admin/legal/signer/${record.token}`

  if (options?.documentHtml) {
    const docuseal = await prepareDocuSealRequest({
      documentId,
      signerEmail,
      signerName: options.signerName,
      documentHtml: options.documentHtml,
    })
    if (docuseal) {
      return {
        signingUrl: docuseal.externalUrl,
        token: record.token,
        provider: "docuseal",
        expiresAt: expiresAt.toISOString(),
      }
    }
  }

  console.log("[legal:signature]", {
    result: "internal_link",
    documentId,
    token: record.token,
    signerEmail,
  })

  return {
    signingUrl: internalUrl,
    token: record.token,
    provider: "internal",
    expiresAt: expiresAt.toISOString(),
  }
}

export async function verifySigningToken(token: string) {
  const row = await prisma.avocatSigningToken.findUnique({
    where: { token },
    include: { document: true },
  })
  if (!row) return { ok: false as const, error: "token_not_found" as const }
  if (row.signedAt) return { ok: false as const, error: "already_signed" as const }
  if (row.expiresAt < new Date()) return { ok: false as const, error: "token_expired" as const }
  return { ok: true as const, signing: row }
}

export async function confirmSignature(input: {
  token: string
  signatureData: string
  signerName?: string
}) {
  const verified = await verifySigningToken(input.token)
  if (!verified.ok) return verified

  const { signing } = verified
  const signedAt = new Date()

  await prisma.$transaction(async (tx) => {
    await tx.avocatSigningToken.update({
      where: { id: signing.id },
      data: {
        signedAt,
        signatureData: input.signatureData,
        signerName: input.signerName?.trim() || signing.signerName,
      },
    })

    await tx.avocatLegalDocument.update({
      where: { id: signing.documentId },
      data: { status: "signed" },
    })

    await tx.avocatSignatureLog.create({
      data: {
        documentId: signing.documentId,
        signingTokenId: signing.id,
        signerEmail: signing.signerEmail,
        signerName: input.signerName?.trim() || signing.signerName,
        signatureData: input.signatureData,
      },
    })
  })

  console.log("[legal:signature]", {
    result: "confirmed",
    documentId: signing.documentId,
    signerEmail: signing.signerEmail,
  })

  return { ok: true as const, documentId: signing.documentId, signedAt: signedAt.toISOString() }
}
