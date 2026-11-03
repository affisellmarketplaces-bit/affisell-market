import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest"

const m = vi.hoisted(() => ({
  jobFindUnique: vi.fn(),
  getStatus: vi.fn(),
  finalize: vi.fn(),
  deleteSelfie: vi.fn(),
}))

vi.mock("@sentry/nextjs", () => ({
  withScope: (fn: (scope: { setTag: () => void }) => unknown) => fn({ setTag: () => undefined }),
}))
vi.mock("@/lib/prisma", () => ({ prisma: { tryOnJob: { findUnique: m.jobFindUnique } } }))
vi.mock("@/lib/try-on/try-on-service.server", () => ({
  getTryOnJobStatus: m.getStatus,
  finalizeTryOnJobWithOutput: m.finalize,
}))
vi.mock("@/lib/try-on/cloth2body-api.server", () => ({ deleteSelfieBlob: m.deleteSelfie }))

import { POST as uploadPOST } from "@/app/api/try-on/upload/route"
import { POST as webhookPOST } from "@/app/api/try-on/webhook/route"

function webhookRequest(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request("http://localhost/api/try-on/webhook", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  })
}

const PENDING_JOB = { id: "job_1", status: "PROCESSING", inputUrl: "https://blob.example/selfie.webp" }

describe("POST /api/try-on/upload (retired)", () => {
  it("answers 410 whatever it is sent, flag or no flag", async () => {
    const res = await uploadPOST()

    expect(res.status).toBe(410)
    expect((await res.json()).error).toMatch(/retired/i)
  })
})

describe("POST /api/try-on/webhook", () => {
  let fetchSpy: MockInstance<typeof fetch>

  beforeEach(() => {
    for (const fn of Object.values(m)) fn.mockReset()
    m.deleteSelfie.mockResolvedValue(undefined)
    fetchSpy = vi.spyOn(globalThis, "fetch")
    vi.spyOn(console, "log").mockImplementation(() => undefined)
    vi.spyOn(console, "warn").mockImplementation(() => undefined)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("ignores everything a forged body claims and re-reads the job from the provider", async () => {
    m.jobFindUnique.mockResolvedValue(PENDING_JOB)
    m.getStatus.mockResolvedValue({ jobId: "job_1", status: "processing" })

    const res = await webhookPOST(
      webhookRequest(
        // a made-up success pointing the server at its own metadata service, with any header at all
        { id: "pred_1", status: "succeeded", output: "http://169.254.169.254/latest/meta-data/" },
        { authorization: "anything" }
      )
    )

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, status: "processing" })
    expect(m.jobFindUnique).toHaveBeenCalledWith({ where: { replicatePredictionId: "pred_1" } })
    expect(m.getStatus).toHaveBeenCalledWith("job_1")
    // the body's output is never used: nothing finalised from it, nothing downloaded
    expect(m.finalize).not.toHaveBeenCalled()
    expect(fetchSpy).not.toHaveBeenCalled()
    // and a job that is still running keeps its selfie
    expect(m.deleteSelfie).not.toHaveBeenCalled()
  })

  it("needs no header at all (the header check never authenticated anything)", async () => {
    m.jobFindUnique.mockResolvedValue(PENDING_JOB)
    m.getStatus.mockResolvedValue({ jobId: "job_1", status: "processing" })

    const res = await webhookPOST(webhookRequest({ id: "pred_1" }))

    expect(res.status).toBe(200)
    expect(m.getStatus).toHaveBeenCalledTimes(1)
  })

  it("deletes the stored selfie once the provider says the job is done", async () => {
    m.jobFindUnique.mockResolvedValue(PENDING_JOB)
    m.getStatus.mockResolvedValue({ jobId: "job_1", status: "done", outputUrl: "https://blob.example/out.webp" })

    const res = await webhookPOST(webhookRequest({ id: "pred_1" }))

    expect(await res.json()).toEqual({ ok: true, status: "done" })
    expect(m.deleteSelfie).toHaveBeenCalledWith(PENDING_JOB.inputUrl)
  })

  it("deletes the stored selfie once the provider says the job failed", async () => {
    m.jobFindUnique.mockResolvedValue(PENDING_JOB)
    m.getStatus.mockResolvedValue({ jobId: "job_1", status: "failed" })

    await webhookPOST(webhookRequest({ id: "pred_1" }))

    expect(m.deleteSelfie).toHaveBeenCalledWith(PENDING_JOB.inputUrl)
  })

  it("does not fail the webhook when the selfie cannot be deleted", async () => {
    m.jobFindUnique.mockResolvedValue(PENDING_JOB)
    m.getStatus.mockResolvedValue({ jobId: "job_1", status: "done" })
    m.deleteSelfie.mockRejectedValue(new Error("blob down"))

    const res = await webhookPOST(webhookRequest({ id: "pred_1" }))

    expect(res.status).toBe(200)
  })

  it("answers idempotently for a job that is already finished, without asking the provider", async () => {
    m.jobFindUnique.mockResolvedValue({ ...PENDING_JOB, status: "DONE" })

    const res = await webhookPOST(webhookRequest({ id: "pred_1", status: "failed" }))

    expect(await res.json()).toEqual({ ok: true, idempotent: true })
    expect(m.getStatus).not.toHaveBeenCalled()
    expect(m.deleteSelfie).toHaveBeenCalledTimes(1)
  })

  it("ignores a prediction id it does not know", async () => {
    m.jobFindUnique.mockResolvedValue(null)

    const res = await webhookPOST(webhookRequest({ id: "pred_unknown", output: "http://10.0.0.1/x" }))

    expect(await res.json()).toEqual({ ok: true, ignored: true })
    expect(m.getStatus).not.toHaveBeenCalled()
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it("rejects invalid JSON and a missing or non-string id", async () => {
    expect((await webhookPOST(webhookRequest("{not json"))).status).toBe(400)
    expect((await webhookPOST(webhookRequest({}))).status).toBe(400)
    expect((await webhookPOST(webhookRequest({ id: 42 }))).status).toBe(400)
    expect((await webhookPOST(webhookRequest({ id: "   " }))).status).toBe(400)
    expect(m.jobFindUnique).not.toHaveBeenCalled()
  })
})
