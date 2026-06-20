"use server"

import { redirect } from "next/navigation"

import { auth } from "@/auth"
import type { WooCommerceAuthParams } from "@/lib/woocommerce-compat/auth-params"
import {
  buildWooCommerceDenyReturnUrl,
  grantWooCommerceAppAccess,
} from "@/lib/woocommerce-compat/grant-access"

export async function approveWooCommerceAuthAction(params: WooCommerceAuthParams) {
  const session = await auth()
  if (!session?.user?.id || session.user.role !== "ADMIN") {
    redirect(`/login/admin?callbackUrl=${encodeURIComponent(buildCallbackPath(params))}`)
  }

  const result = await grantWooCommerceAppAccess({
    params,
    grantedByUserId: session.user.id,
  })

  redirect(result.returnUrl)
}

export async function denyWooCommerceAuthAction(params: WooCommerceAuthParams) {
  redirect(buildWooCommerceDenyReturnUrl(params))
}

function buildCallbackPath(params: WooCommerceAuthParams): string {
  const q = new URLSearchParams({
    app_name: params.app_name,
    scope: params.scope,
    user_id: params.user_id,
    return_url: params.return_url,
    callback_url: params.callback_url,
  })
  return `/wc-auth/v1/authorize?${q.toString()}`
}
