"use client"

import { createContext, useContext, useMemo, type ReactNode } from "react"

import { PLATFORM_HOST_CONTEXT, type StorefrontHostContext } from "@/lib/storefront-buyer-links"

const HostContext = createContext<StorefrontHostContext>(PLATFORM_HOST_CONTEXT)

/** Set by the server layout of buyer-flow routes so client components know they run on a reseller host. */
export function StorefrontHostProvider({
  isStoreHost,
  storeName,
  children,
}: StorefrontHostContext & { children: ReactNode }) {
  const value = useMemo(() => ({ isStoreHost, storeName }), [isStoreHost, storeName])
  return <HostContext.Provider value={value}>{children}</HostContext.Provider>
}

/** Defaults to the platform (marketplace links) when no provider is mounted. */
export function useStorefrontHost(): StorefrontHostContext {
  return useContext(HostContext)
}
