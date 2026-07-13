import { Module } from "@nestjs/common"
import { ConfigModule } from "@nestjs/config"

import { AuthModule } from "./modules/auth/auth.module"
import { TiktokModule } from "./modules/tiktok/tiktok.module"

import { envSchema } from "./shared/env"

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: (raw) => envSchema.parse(raw),
    }),
    AuthModule,
    TiktokModule,
  ],
})
export class AppModule {}

