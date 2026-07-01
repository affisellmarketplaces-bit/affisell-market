import type { MetadataRoute } from "next"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Affisell — Creator marketplace",
    short_name: "Affisell",
    description: "Shop creator partner storefronts. Fast checkout, supplier fulfillment.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#09090b",
    theme_color: "#7c3aed",
    id: "/",
    scope: "/",
    lang: "en",
    dir: "ltr",
    display_override: ["standalone", "minimal-ui"],
    categories: ["shopping", "lifestyle"],
    shortcuts: [
      {
        name: "Discover",
        short_name: "Pulse",
        url: "/discover",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
      },
      {
        name: "Marketplace",
        short_name: "Shop",
        url: "/marketplace",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
      },
      {
        name: "Orders",
        short_name: "Orders",
        url: "/marketplace/account/orders",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
      },
    ],
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/brand/affisell-mark.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  }
}
