import {
  BadRequestException,
  Controller,
  Get,
  Query,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common"
import type { Response } from "express"
import { PrismaClient, encryptString } from "@affisell/mi-db"

import { AuthenticatedRequest, ClerkAuthGuard } from "../auth/clerk-auth.guard"
import { TIKTOK_SHOP_SCOPES, TiktokOAuthService } from "./tiktok-oauth.service"

@Controller("auth/tiktok")
export class TiktokAuthController {
  constructor(private readonly oauth: TiktokOAuthService) {}

  /**
   * Starts TikTok Shop OAuth for the authenticated Clerk user.
   * Requires: Authorization: Bearer <Clerk session token>
   */
  @Get("start")
  @UseGuards(ClerkAuthGuard)
  async start(@Req() req: AuthenticatedRequest, @Res() res: Response) {
    const clerkUserId = req.auth.userId
    const state = await this.oauth.createOAuthState(clerkUserId)
    const url = this.oauth.buildAuthorizeUrl({ state, scope: TIKTOK_SHOP_SCOPES })
    console.log("[tiktok-oauth]", { result: "start", clerkUserId })
    return res.redirect(url)
  }

  /**
   * Callback URL (TikTok dev console):
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
      throw new BadRequestException("TikTok OAuth error")
    }
    if (!code || !state) throw new BadRequestException("Missing code/state")

    const clerkUserId = await this.oauth.verifyOAuthState(state)

    const token = await this.oauth.exchangeCodeForToken(code)
    if (token.error) {
      console.log("[tiktok-oauth]", { result: "token_error", clerkUserId, token })
      throw new BadRequestException("Token exchange failed")
    }

    const accessToken = token.access_token?.trim() ?? ""
    if (!accessToken) throw new BadRequestException("Missing access token from TikTok")

    const shop = await this.oauth.getShopInfo(accessToken)
    const expiresAt = new Date(
      Date.now() + (token.expires_in ? token.expires_in * 1000 : 60 * 60 * 1000)
    )
    const scopes = (token.scope ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)

    const prisma = new PrismaClient()
    try {
      const user = await prisma.user.upsert({
        where: { clerkUserId },
        update: {},
        create: { clerkUserId },
        select: { id: true },
      })

      await prisma.shopConnection.upsert({
        where: { shopId: shop.shopId },
        update: {
          userId: user.id,
          shopName: shop.shopName,
          accessToken: encryptString(accessToken),
          refreshToken: encryptString(token.refresh_token ?? ""),
          expiresAt,
          scopes,
        },
        create: {
          userId: user.id,
          shopId: shop.shopId,
          shopName: shop.shopName,
          accessToken: encryptString(accessToken),
          refreshToken: encryptString(token.refresh_token ?? ""),
          expiresAt,
          scopes,
        },
      })
    } finally {
      await prisma.$disconnect()
    }

    console.log("[tiktok-oauth]", {
      result: "connected",
      clerkUserId,
      shopId: shop.shopId,
      expiresIn: token.expires_in,
      scope: token.scope,
    })

    return res.status(200).send("TikTok connected. You can close this window.")
  }
}
