import { createUploadthing, type FileRouter } from "uploadthing/next"
import { UploadThingError } from "uploadthing/server"

import { auth } from "@/auth"

const f = createUploadthing()

export const ourFileRouter = {
  reviewMedia: f({
    image: { maxFileSize: "8MB", maxFileCount: 5 },
    video: { maxFileSize: "64MB", maxFileCount: 1 },
  })
    .middleware(async () => {
      const session = await auth()
      if (!session?.user?.id) throw new UploadThingError("Unauthorized")
      return { userId: session.user.id }
    })
    .onUploadComplete(async ({ metadata, file }) => {
      return {
        uploadedBy: metadata.userId,
        url: file.url,
        type: file.type?.startsWith("video/") ? "video" : "image",
        name: file.name,
        size: file.size,
      }
    }),
} satisfies FileRouter

export type OurFileRouter = typeof ourFileRouter
