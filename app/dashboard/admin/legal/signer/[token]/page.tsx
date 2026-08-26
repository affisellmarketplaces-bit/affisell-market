import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { LegalSignatureCanvas } from "@/components/admin/legal-signature-canvas"
import { verifySigningToken } from "@/lib/legal/signature"

export const dynamic = "force-dynamic"

type Props = {
  params: Promise<{ token: string }>
}

export const metadata: Metadata = {
  title: "Signature document | Affisell",
  robots: { index: false, follow: false },
}

export default async function LegalSignerPage({ params }: Props) {
  const { token } = await params
  const verified = await verifySigningToken(token)

  if (!verified.ok) {
    notFound()
  }

  const { signing } = verified

  return (
    <div className="min-h-screen bg-zinc-100 px-4 py-8 dark:bg-zinc-950">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 text-center">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-700">Affisell Market</p>
          <h1 className="mt-2 font-serif text-2xl text-zinc-900 dark:text-zinc-100">{signing.document.title}</h1>
          <p className="mt-1 text-sm text-zinc-500">Signature électronique sécurisée</p>
        </div>
        <LegalSignatureCanvas
          token={token}
          signerEmail={signing.signerEmail}
          signerName={signing.signerName}
          documentTitle={signing.document.title}
          documentHtml={signing.document.contentHtml}
        />
      </div>
    </div>
  )
}
