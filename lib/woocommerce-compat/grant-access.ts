import { generateWooCommerceApiKeys } from "@/lib/woocommerce-compat/generate-keys"
import type { WooCommerceAuthParams } from "@/lib/woocommerce-compat/auth-params"
import { prisma } from "@/lib/prisma"

export type WooCommerceGrantResult =
  | {
      ok: true
      consumerKey: string
      consumerSecret: string
      returnUrl: string
    }
  | { ok: false; error: string; returnUrl: string }

export async function grantWooCommerceAppAccess(args: {
  params: WooCommerceAuthParams
  grantedByUserId: string
}): Promise<WooCommerceGrantResult> {
  const { params } = args
  const keys = generateWooCommerceApiKeys()

  const row = await prisma.wooCommerceApiCredential.create({
    data: {
      appName: params.app_name,
      externalUserId: params.user_id,
      consumerKey: keys.consumerKey,
      consumerSecret: keys.consumerSecret,
      scope: params.scope,
      keyPermissions: params.scope,
      grantedByUserId: args.grantedByUserId,
    },
  })

  const payload = {
    key_id: row.id,
    user_id: params.user_id,
    consumer_key: keys.consumerKey,
    consumer_secret: keys.consumerSecret,
    key_permissions: params.scope,
  }

  try {
    const res = await fetch(params.callback_url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
      cache: "no-store",
    })

    if (!res.ok) {
      console.error("[woocommerce-autods]", {
        result: "callback_failed",
        status: res.status,
        appName: params.app_name,
        userId: params.user_id,
      })
      return { ok: false, error: "callback_failed", returnUrl: params.return_url }
    }
  } catch (error) {
    console.error("[woocommerce-autods]", {
      result: "callback_error",
      appName: params.app_name,
      userId: params.user_id,
      error: error instanceof Error ? error.message : String(error),
    })
    return { ok: false, error: "callback_error", returnUrl: params.return_url }
  }

  console.log("[woocommerce-autods]", {
    result: "access_granted",
    appName: params.app_name,
    userId: params.user_id,
    credentialId: row.id,
  })

  const returnUrl = new URL(params.return_url)
  returnUrl.searchParams.set("success", "1")
  returnUrl.searchParams.set("user_id", params.user_id)

  return {
    ok: true,
    consumerKey: keys.consumerKey,
    consumerSecret: keys.consumerSecret,
    returnUrl: returnUrl.toString(),
  }
}

export function buildWooCommerceDenyReturnUrl(params: WooCommerceAuthParams): string {
  const returnUrl = new URL(params.return_url)
  returnUrl.searchParams.set("success", "0")
  returnUrl.searchParams.set("user_id", params.user_id)
  return returnUrl.toString()
}
