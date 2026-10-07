"use client"

import { useEffect, useState } from "react"

import { EMPTY_COMPLIANCE_PROFILE, type ComplianceProfile } from "@/lib/listing-compliance/profile-shared"

type State = { profile: ComplianceProfile; available: boolean; loaded: boolean }

let inflight: Promise<State> | null = null

function load(): Promise<State> {
  inflight ??= fetch("/api/supplier/compliance-profile", { credentials: "include", cache: "no-store" })
    .then((r) => (r.ok ? r.json() : null))
    .then(
      (j: { profile?: ComplianceProfile; available?: boolean } | null): State => ({
        profile: { ...EMPTY_COMPLIANCE_PROFILE, ...(j?.profile ?? {}) },
        available: j?.available !== false && j != null,
        loaded: true,
      })
    )
    .catch((): State => ({ profile: EMPTY_COMPLIANCE_PROFILE, available: false, loaded: true }))
  return inflight
}

/** Forget the cached profile (after the settings screen saved a new one). */
export function resetComplianceProfileCache() {
  inflight = null
}

/** The supplier's saved GPSR defaults, fetched once per page load. Never blocks the form: a failure just means "no profile". */
export function useComplianceProfile(): State {
  const [state, setState] = useState<State>({ profile: EMPTY_COMPLIANCE_PROFILE, available: true, loaded: false })
  useEffect(() => {
    let alive = true
    void load().then((s) => alive && setState(s))
    return () => {
      alive = false
    }
  }, [])
  return state
}
