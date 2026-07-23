import type { CSSProperties, ReactNode } from "react"

import type { BubbleProductView } from "@/lib/social/bubble-product-types"

type LayoutProps = {
  product: BubbleProductView
  width: number
  height: number
  template: string
  hook?: string
  safeZone?: boolean
}

const DEFAULT_ACCENT = "#8b5cf6"

function money(product: BubbleProductView): string {
  return `${product.salePrice.toFixed(0)}€`
}

function margin(product: BubbleProductView): string {
  return `+${product.marginEuro.toFixed(0)}€`
}

/** Satori/ImageResponse: every multi-child node needs explicit display:flex|contents|none. */
function rootStyle(w: number, h: number): CSSProperties {
  return {
    width: w,
    height: h,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    background: `linear-gradient(145deg, ${DEFAULT_ACCENT} 0%, #0f172a 55%, #020617 100%)`,
    color: "white",
    fontFamily: "system-ui, -apple-system, sans-serif",
    position: "relative",
    overflow: "hidden",
  }
}

function ProductCircle({ size }: { size: number }) {
  const ring = Math.max(4, Math.round(size * 0.04))
  const core = Math.round(size * 0.42)
  return (
    <div
      style={{
        width: size,
        height: size,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: size / 2,
        border: `${ring}px solid rgba(255,255,255,0.35)`,
        background: "rgba(255,255,255,0.10)",
      }}
    >
      <div
        style={{
          width: core,
          height: core,
          display: "flex",
          borderRadius: core / 2,
          background: "linear-gradient(160deg, rgba(167,139,250,0.95) 0%, rgba(56,189,248,0.55) 100%)",
          boxShadow: "0 0 40px rgba(139,92,246,0.55)",
        }}
      />
    </div>
  )
}

function BubblePill({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 999,
        padding: "12px 28px",
        background: "rgba(255,255,255,0.14)",
        border: "1px solid rgba(255,255,255,0.25)",
        fontSize: 28,
        fontWeight: 700,
        ...style,
      }}
    >
      {children}
    </div>
  )
}

/** OG + social PNG layout (ImageResponse / satori-compatible JSX). */
export function BubbleAssetLayout({ product, width, height, template, hook, safeZone }: LayoutProps) {
  const title = product.title.slice(0, 80)
  const cta =
    template.includes("tiktok") || template.includes("story")
      ? "Link in bio · Affisell"
      : "Lister sans stock → Affisell"

  const topPad = safeZone ? 140 : 48
  const circle = Math.min(width, height) * 0.28

  return (
    <div style={rootStyle(width, height)}>
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: "flex",
          background: "radial-gradient(circle at 50% 30%, rgba(139,92,246,0.5), transparent 60%)",
        }}
      />

      <div
        style={{
          position: "relative",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          width: "100%",
          height: "100%",
          paddingTop: topPad,
          paddingBottom: safeZone ? 160 : 64,
          paddingLeft: 48,
          paddingRight: 48,
        }}
      >
        {hook ? (
          <div
            style={{
              display: "flex",
              width: "100%",
              marginBottom: 28,
              justifyContent: "center",
              textAlign: "center",
              fontSize: width > 1000 ? 36 : 30,
              fontWeight: 800,
              lineHeight: 1.25,
            }}
          >
            {hook}
          </div>
        ) : null}

        <ProductCircle size={circle} />

        <div
          style={{
            display: "flex",
            marginTop: 28,
            width: "100%",
            justifyContent: "center",
            textAlign: "center",
            fontSize: Math.min(42, Math.round(width * 0.045)),
            fontWeight: 800,
            lineHeight: 1.2,
          }}
        >
          {title}
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "row",
            gap: 16,
            marginTop: 24,
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <BubblePill>{money(product)}</BubblePill>
          <BubblePill style={{ background: "rgba(16,185,129,0.25)", borderColor: "rgba(52,211,153,0.4)" }}>
            {margin(product)} sans stock
          </BubblePill>
        </div>

        <div
          style={{
            display: "flex",
            marginTop: 28,
            justifyContent: "center",
            textAlign: "center",
            fontSize: 24,
            opacity: 0.92,
            fontWeight: 600,
          }}
        >
          {cta}
        </div>

        <div
          style={{
            position: "absolute",
            bottom: 28,
            right: 36,
            display: "flex",
            alignItems: "center",
            fontSize: 22,
            fontWeight: 700,
            opacity: 0.85,
          }}
        >
          Affisell · Live Profit
        </div>
      </div>
    </div>
  )
}

export function StoryTemplate(props: Omit<LayoutProps, "template">) {
  return <BubbleAssetLayout {...props} template="bubble-story" safeZone />
}

export function FeedTemplate(props: Omit<LayoutProps, "template">) {
  return (
    <BubbleAssetLayout
      {...props}
      template="bubble-feed"
      hook={`3 bénéfices · ${margin(props.product)} marge · ${props.product.deliveryDays}j livraison`}
    />
  )
}

export function TikTokTemplate(props: Omit<LayoutProps, "template">) {
  const hook = `POV: Tu trouves ce produit à ${props.product.costPrice?.toFixed(0) ?? "—"}€ et tu le revends ${money(props.product)} sans stock`
  return <BubbleAssetLayout {...props} template="bubble-tiktok" hook={hook} safeZone />
}

export function PinterestTemplate(props: Omit<LayoutProps, "template">) {
  return (
    <BubbleAssetLayout
      {...props}
      template="bubble-pinterest"
      hook="Catalogue luxe · Dropshipping sans stock"
    />
  )
}

export function pickTemplateElement(props: LayoutProps) {
  const { template } = props
  if (template.includes("tiktok")) return <TikTokTemplate {...props} />
  if (template.includes("story") || template.includes("reel")) return <StoryTemplate {...props} />
  if (template.includes("feed") || template.includes("threads") || template.includes("whatsapp"))
    return <FeedTemplate {...props} />
  if (template.includes("pinterest")) return <PinterestTemplate {...props} />
  return <BubbleAssetLayout {...props} />
}
