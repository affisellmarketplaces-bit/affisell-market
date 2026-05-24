"use client"

import { Suspense, useEffect, useRef } from "react"
import { useSearchParams, useRouter } from "next/navigation"

function SuccessRedirect() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const handled = useRef(false)

  useEffect(() => {
    if (handled.current) return
    handled.current = true

    const session_id = searchParams.get("session_id")
    if (!session_id) {
      router.replace("/")
      return
    }

    fetch(`/api/stripe/verify-session?session_id=${encodeURIComponent(session_id)}`).finally(() => {
      router.replace("/marketplace/account/wallet")
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once; session_id read at mount
  }, [])

  return <div>Redirection...</div>
}

export default function SuccessPage() {
  return (
    <Suspense fallback={<div>Redirection...</div>}>
      <SuccessRedirect />
    </Suspense>
  )
}
