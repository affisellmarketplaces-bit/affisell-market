import { Body, Controller, Headers, Post } from "@nestjs/common"
import { UseGuards } from "@nestjs/common"

import { TikTokWebhookGuard } from "../../tiktok/webhook.guard"

/**
 * TikTok webhooks vary by product (Shop, Open Platform).
 * We accept JSON and log a structured event for downstream processing.
 *
 * Endpoint: POST /webhooks/tiktok
 */
@Controller("webhooks/tiktok")
export class TiktokWebhookController {
  @Post()
  @UseGuards(TikTokWebhookGuard)
  async handle(@Body() body: unknown, @Headers() headers: Record<string, string>) {
    // NOTE: signature verification should be added once TikTok webhook secret format is confirmed.
    console.log("[tiktok-webhook]", {
      result: "received",
      contentType: headers["content-type"],
      userAgent: headers["user-agent"],
      body,
    })
    return { ok: true }
  }
}

