import { z } from "zod"

const mediaItemSchema = z.object({
  type: z.enum(["image", "video"]),
  url: z.string().url().max(2000),
  blurhash: z.string().max(200).optional(),
  width: z.number().int().positive().max(8000).optional(),
  height: z.number().int().positive().max(8000).optional(),
  duration: z.number().min(0).max(120).optional(),
  muxPlaybackId: z.string().max(120).optional(),
})

export const createReviewSchema = z.object({
  productId: z.string().min(1),
  orderId: z.string().min(1),
  rating: z.number().int().min(1).max(5),
  title: z.string().max(120).optional().nullable(),
  body: z.string().min(20).max(2000),
  media: z.array(mediaItemSchema).max(6).default([]),
})

export const voteReviewSchema = z.object({
  type: z.enum(["HELPFUL", "UNHELPFUL"]),
})
