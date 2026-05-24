/**
 * Fire-and-forget internal trigger for the transfer processor job.
 */
export async function enqueueProcessTransfersJob(): Promise<void> {
  const secret = process.env.CRON_SECRET?.trim()
  if (!secret) {
    if (process.env.NODE_ENV === "development") {
      const { runProcessTransfersJob } = await import("@/lib/transfers/process-transfers")
      void runProcessTransfersJob({ metric: "transfer_job_run" }).catch(() => undefined)
    }
    return
  }

  const base =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://127.0.0.1:3001")

  void fetch(`${base}/api/jobs/process-transfers`, {
    method: "GET",
    headers: { Authorization: `Bearer ${secret}` },
  }).catch(() => undefined)
}
