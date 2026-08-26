import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"

import { LegalLetterPrintView } from "@/components/admin/legal-letter-print-view"
import { requireAdminSession } from "@/lib/admin/require-admin-session"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

type Props = {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  return {
    title: `Lettre ${id.slice(0, 8)} | Avocat Numérique`,
    robots: { index: false, follow: false },
  }
}

export default async function LegalLetterPage({ params }: Props) {
  const gate = await requireAdminSession()
  if (!gate.ok) {
    redirect("/login/admin")
  }

  const { id } = await params
  const letter = await prisma.legalLetter.findUnique({ where: { id } })
  if (!letter) notFound()

  const supplier = await prisma.user.findUnique({
    where: { id: letter.supplierId },
    select: { name: true, email: true },
  })

  return (
    <LegalLetterPrintView
      id={letter.id}
      type={letter.type}
      supplierName={supplier?.name ?? supplier?.email ?? letter.supplierId}
      contentHtml={letter.contentHtml}
      createdAt={letter.createdAt.toISOString()}
    />
  )
}
