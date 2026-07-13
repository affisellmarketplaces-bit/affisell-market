import { Module } from "@nestjs/common"

import { RedisService } from "../../shared/redis"
import { TiktokAuthController } from "./tiktok-auth.controller"
import { TiktokWebhookController } from "./tiktok-webhook.controller"
import { TiktokOAuthService } from "./tiktok-oauth.service"
import { TikTokWebhookGuard } from "../../tiktok/webhook.guard"

@Module({
  controllers: [TiktokAuthController, TiktokWebhookController],
  providers: [RedisService, TiktokOAuthService, TikTokWebhookGuard],
})
export class TiktokModule {}

