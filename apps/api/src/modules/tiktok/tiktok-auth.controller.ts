import { Controller, Get, Query, Req, Res, UseGuards } from "@nestjs/common"
import type { Response } from "express"

import { ClerkAuthGuard } from "../auth/clerk-auth.guard"
import { TiktokOAuthService } from "./tiktok-oauth.service"
import { PrismaClient, encryptString } from "@affisell/mi-db"

@Controller("auth/tiktok")
export class TiktokAuthController {
  constructor(private readonly oauth: TiktokOAuthService) {}

  @Get()
  @UseGuards(ClerkAuthGuard)
  async start(@Req() req: any, @Res() res: Response) {
    const clerkUserId = String(req?.clerkUserId || "").trim()
    if (!clerkUserId) return res.status(500).send("Auth guard misconfigured (missing clerkUserId)")

    const state = await this.oauth.createStateNonce({ clerkUserId })

    // TikTok Shop scopes P0 (provided by spec).
    const scope =
      "user.info.basic,video.list,tiktok.shop.v2:product:list,tiktok.shop.v2:order:list,tiktok.shop.v2:analytics:view,tiktok.shop.v2:shop:info"
    const url = this.oauth.buildAuthorizeUrl({
      state,
      scope,
    })
    return res.redirect(url)
  }

  /**
   * Callback URL must match the one set in TikTok dev console:
   * https://verify.affisell.com/auth/tiktok/callback
   */
  @Get("callback")
  async callback(
    @Query("code") code: string | undefined,
    @Query("state") state: string | undefined,
    @Query("error") error: string | undefined,
    @Query("error_description") errorDescription: string | undefined,
    @Res() res: Response
  ) {
    if (error) {
      console.log("[tiktok-oauth]", { result: "error", error, errorDescription })
      return res.status(400).send("TikTok OAuth error")
    }
    if (!code || !state) return res.status(400).send("Missing code/state")

    const ctx = await this.oauth.consumeStateNonce(state)
    if (!ctx) return res.status(400).send("Invalid state")

    const token = await this.oauth.exchangeCodeForToken(code)
    if (token.error) {
      console.log("[tiktok-oauth]", { result: "token_error", token })
      return res.status(400).send("Token exchange failed")
    }

    // Persist encrypted tokens (at rest).
    const prisma = new PrismaClient()
    try {
      const user = await prisma.user.upsert({
        where: { clerkUserId: ctx.clerkUserId },
        update: {},
        create: { clerkUserId: ctx.clerkUserId },
        select: { id: true },
      })

      const accessToken = token.access_token || ""
      if (!accessToken) return res.status(400).send("Missing access token from TikTok")

      const shop = await this.oauth.getShopInfo(accessToken)
      const shopId = shop.shopId
      const shopName = shop.shopName
      const expiresAt = new Date(Date.now() + (token.expires_in ? token.expires_in * 1000 : 60 * 60 * 1000))
      const scopes = (token.scope || "").split(",").map((s) => s.trim()).filter(Boolean)

      await prisma.shopConnection.upsert({
        where: { shopId },
        update: {
          userId: user.id,
          shopName,
          accessToken: encryptString(accessToken),
          refreshToken: encryptString(token.refresh_token || ""),
          expiresAt,
          scopes,
        },
        create: {
          userId: user.id,
          shopId,
          shopName,
          accessToken: encryptString(accessToken),
          refreshToken: encryptString(token.refresh_token || ""),
          expiresAt,
          scopes,
        },
      })
    } finally {
      await prisma.$disconnect()
    }

    console.log("[tiktok-oauth]", {
      result: "connected",
      hasAccessToken: Boolean(token.access_token),
      expiresIn: token.expires_in,
      scope: token.scope,
      openId: token.open_id,
    })

    return res
      .status(200)
      .send(`TikTok connected for clerkUserId=${ctx.clerkUserId}. You can close this window.`)
  }
}

