import { NestFactory } from "@nestjs/core"
import { json } from "express"

import { AppModule } from "./app.module"

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    cors: true,
  })

  // Capture raw body for TikTok webhook signature verification.
  app.use(
    json({
      verify: (req: any, _res, buf) => {
        req.rawBody = buf?.toString("utf8") ?? ""
      },
    })
  )

  await app.listen(process.env.PORT ? Number(process.env.PORT) : 3002)
}

void bootstrap()

