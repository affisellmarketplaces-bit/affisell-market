import type { MetadataRoute } from "next"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Affisell — Creator marketplace",
    short_name: "Affisell",
    description: "Shop trusted creator stores. Fast checkout, verified sellers.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#09090b",
    theme_color: "#7c3aed",
    categories: ["shopping", "lifestyle"],
    icons: [
      {
        src: "/globe.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  }
}
