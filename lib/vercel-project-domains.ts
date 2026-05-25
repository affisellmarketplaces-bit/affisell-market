/**
 * Register merchant custom domains on the Affisell Vercel project (server-only).
 * @see https://vercel.com/docs/rest-api/projects/add-a-domain-to-a-project
 */

import { normalizeRequestHost } from "@/lib/custom-domain-host"

export type VercelDomainProvisionStatus =
  | "registered"
  | "pending"
  | "active"
  | "failed"
  | "skipped"

export type VercelDomainProvisionResult = {
  attempted: boolean
  status: VercelDomainProvisionStatus
  message?: string
  vercelVerified?: boolean
}

type VercelProjectDomainResponse = {
  name?: string
  verified?: boolean
  error?: { code?: string; message?: string }
}

function vercelConfig() {
  const token = process.env.VERCEL_API_TOKEN?.trim()
  const projectId = process.env.VERCEL_PROJECT_ID?.trim()
  const teamId = process.env.VERCEL_TEAM_ID?.trim()
  if (!token || !projectId) return null
  return { token, projectId, teamId }
}

export function isVercelDomainAutoProvisionEnabled(): boolean {
  return vercelConfig() !== null
}

function teamQuery(teamId: string | undefined): string {
  return teamId ? `?teamId=${encodeURIComponent(teamId)}` : ""
}

async function vercelApi<T>(
  path: string,
  init?: RequestInit
): Promise<{ ok: boolean; status: number; data: T | null; text: string }> {
  const cfg = vercelConfig()
  if (!cfg) {
    return { ok: false, status: 0, data: null, text: "not configured" }
  }
  const url = `https://api.vercel.com${path}`
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${cfg.token}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    signal: AbortSignal.timeout(12_000),
  })
  const text = await res.text()
  let data: T | null = null
  try {
    data = text ? (JSON.parse(text) as T) : null
  } catch {
    data = null
  }
  return { ok: res.ok, status: res.status, data, text }
}

export async function addDomainToVercelProject(domainRaw: string): Promise<VercelDomainProvisionResult> {
  const cfg = vercelConfig()
  const domain = normalizeRequestHost(domainRaw)
  if (!cfg) {
    return { attempted: false, status: "skipped", message: "Vercel API not configured (VERCEL_API_TOKEN, VERCEL_PROJECT_ID)" }
  }
  if (!domain) {
    return { attempted: true, status: "failed", message: "Invalid domain name" }
  }

  const path = `/v10/projects/${encodeURIComponent(cfg.projectId)}/domains${teamQuery(cfg.teamId)}`
  const add = await vercelApi<VercelProjectDomainResponse>(path, {
    method: "POST",
    body: JSON.stringify({ name: domain }),
  })

  if (add.ok && add.data) {
    const verified = add.data.verified === true
    return {
      attempted: true,
      status: verified ? "active" : "pending",
      message: verified
        ? "Domain registered on Vercel with SSL."
        : "Domain added on Vercel — SSL will issue once DNS propagates.",
      vercelVerified: verified,
    }
  }

  if (add.status === 400 && /already|exists/i.test(add.text)) {
    const check = await getVercelProjectDomain(domain)
    if (check) {
      return {
        attempted: true,
        status: check.verified ? "active" : "pending",
        message: "Domain already linked to this Vercel project.",
        vercelVerified: check.verified,
      }
    }
    return {
      attempted: true,
      status: "registered",
      message: "Domain already on Vercel project.",
    }
  }

  const errMsg =
    (add.data as VercelProjectDomainResponse | null)?.error?.message ??
    add.text.slice(0, 300) ??
    `Vercel API error (${add.status})`
  return { attempted: true, status: "failed", message: errMsg }
}

export async function getVercelProjectDomain(
  domainRaw: string
): Promise<{ verified: boolean; status: VercelDomainProvisionStatus } | null> {
  const cfg = vercelConfig()
  const domain = normalizeRequestHost(domainRaw)
  if (!cfg || !domain) return null

  const path = `/v9/projects/${encodeURIComponent(cfg.projectId)}/domains/${encodeURIComponent(domain)}${teamQuery(cfg.teamId)}`
  const res = await vercelApi<{ verified?: boolean }>(path, { method: "GET" })
  if (!res.ok) return null
  const verified = res.data?.verified === true
  return {
    verified,
    status: verified ? "active" : "pending",
  }
}

/** Register apex (+ optional www redirect) after DNS points to our CNAME. */
export async function provisionMerchantDomainOnVercel(domainRaw: string): Promise<VercelDomainProvisionResult> {
  const domain = normalizeRequestHost(domainRaw)
  if (!domain) {
    return { attempted: true, status: "failed", message: "Invalid domain" }
  }

  const primary = await addDomainToVercelProject(domain)
  if (primary.status === "failed") return primary

  if (!domain.startsWith("www.")) {
    const www = `www.${domain}`
    const wwwRes = await vercelApi<VercelProjectDomainResponse>(
      `/v10/projects/${encodeURIComponent(vercelConfig()!.projectId)}/domains${teamQuery(vercelConfig()!.teamId)}`,
      {
        method: "POST",
        body: JSON.stringify({
          name: www,
          redirect: domain,
          redirectStatusCode: 308,
        }),
      }
    )
    if (!wwwRes.ok && !/already|exists/i.test(wwwRes.text)) {
      return {
        ...primary,
        message: `${primary.message ?? ""} (www redirect: ${wwwRes.text.slice(0, 120)})`.trim(),
      }
    }
  }

  return primary
}
