import { notFound, redirect } from "next/navigation"

import { ImportJobResultClient } from "@/components/import/ImportJobResultClient"
import { auth } from "@/auth"
import { getRadarImportJobForUser } from "@/lib/radar/radar-import-bridge.server"

export const dynamic = "force-dynamic"

export default async function ImportJobPage({
  params,
}: {
  params: Promise<{ jobId: string }>
}) {
  const session = await auth()
  if (!session?.user?.id) {
    redirect(`/login?callbackUrl=${encodeURIComponent("/dashboard/imports")}`)
  }

  const { jobId } = await params
  const job = await getRadarImportJobForUser({ jobId: jobId.trim(), userId: session.user.id })
  if (!job) notFound()

  console.log("[dashboard/imports]", {
    userId: session.user.id,
    jobId: job.id,
    count: job.products.length,
  })

  return (
    <ImportJobResultClient
      jobId={job.id}
      country={job.sourceCountry}
      status={job.status}
      destination={job.destination}
      products={job.products}
    />
  )
}
