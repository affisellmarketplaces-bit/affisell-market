export type CustomColumnType = "text" | "number" | "boolean" | "url" | "select"

export type CustomColumn = {
  key: string
  label: string
  type: CustomColumnType
  required: boolean
  options?: string[]
}

/** Client-only row id for React lists */
export type CustomColumnUi = CustomColumn & { id: string }

export type VariantCustomData = Record<string, string | number | boolean>

/** Viral Assets V2 — product gallery for cinematic carousel / Reel export. */
export type ViralMediaType = "image" | "video"

export type ViralMedia = {
  type: ViralMediaType
  url: string
  /** Auto-advance ms (images default 1200; videos prefer real length). */
  duration?: number
}

export type ProductWithViralMedias = {
  medias: ViralMedia[]
}
