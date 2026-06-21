import { prisma } from "@/lib/prisma"

export type WooCommerceCredential = {
  id: string
  appName: string
  scope: string
  consumerKey: string
}

function readBasicAuth(req: Request): { key: string; secret: string } | null {
  const header = req.headers.get("authorization")
  if (header?.startsWith("Basic ")) {
    try {
      const decoded = Buffer.from(header.slice(6), "base64").toString("utf8")
      const sep = decoded.indexOf(":")
      if (sep <= 0) return null
      return {
        key: decoded.slice(0, sep),
        secret: decoded.slice(sep + 1),
      }
    } catch {
      return null
    }
  }

  const url = new URL(req.url)
  const key = url.searchParams.get("consumer_key")?.trim()
  const secret = url.searchParams.get("consumer_secret")?.trim()
  if (key && secret) return { key, secret }
  return null
}

export async function verifyWooCommerceBasicAuth(
  req: Request
): Promise<WooCommerceCredential | null> {
  const creds = readBasicAuth(req)
  if (!creds) return null

  const row = await prisma.wooCommerceApiCredential.findFirst({
    where: {
      consumerKey: creds.key,
      consumerSecret: creds.secret,
      revokedAt: null,
    },
    select: {
      id: true,
      appName: true,
      scope: true,
      consumerKey: true,
    },
  })

  return row
}

export function wooCommerceUnauthorizedResponse(): Response {
  return Response.json(
    {
      code: "woocommerce_rest_authentication_error",
      message: "Invalid consumer key or secret.",
      data: { status: 401 },
    },
    {
      status: 401,
      headers: {
        "WWW-Authenticate": 'Basic realm="WooCommerce REST API"',
      },
    }
  )
}
