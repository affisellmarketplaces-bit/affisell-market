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

    fetch(`/api/stripe/verify-session?session_id=${session_id}`).finally(() => {
      router.replace("/marketplace/account/wallet")
    })
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
