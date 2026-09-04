/**
 * Buyer premium home — hex tokens sampled from /public/mockup.png audit.
 * Keep in sync when adjusting hero / nav / discover intensity.
 */
export const BUYER_PREMIUM = {
  /** Page canvas behind hero + discover */
  pageBg: "#f8fafc",
  text: {
    heading: "#0f172a",
    body: "#475569",
    muted: "#64748b",
    nav: "#334155",
  },
  hero: {
    /** Base mesh — lavender → saturated violet (mockup intensity) */
    gradient:
      "linear-gradient(128deg, #f5f3ff 0%, #ede9fe 12%, #ddd6fe 28%, #c4b5fd 48%, #a78bfa 68%, #9333ea 92%)",
    border: "rgba(167, 139, 250, 0.55)",
    orbLeft: "rgba(217, 70, 239, 0.42)",
    orbRight: "rgba(79, 70, 229, 0.38)",
    orbCenter: "rgba(67, 56, 202, 0.22)",
    shine: "rgba(255, 255, 255, 0.35)",
  },
  badge: {
    heroBg: "rgba(255, 255, 255, 0.78)",
    heroBorder: "rgba(255, 255, 255, 0.92)",
    heroText: "#334155",
    navBg: "#ede9fe",
    navBorder: "#c4b5fd",
    navText: "#6d28d9",
    cardBg: "#f3e8ff",
    cardText: "#7c3aed",
  },
  cta: {
    bg: "#4338ca",
    hover: "#3730a3",
    shadow: "0 4px 14px rgba(67, 56, 202, 0.35)",
  },
  trust: {
    check: "#22c55e",
    pillBg: "rgba(255, 255, 255, 0.92)",
    pillBorder: "rgba(255, 255, 255, 0.95)",
    pillText: "#334155",
  },
  search: {
    shadow: "0 10px 40px rgba(67, 56, 202, 0.14)",
    ring: "rgba(67, 56, 202, 0.18)",
  },
  discover: {
    cardBg: "#ffffff",
    cardBorder: "#e2e8f0",
    cardShadow: "0 1px 3px rgba(15, 23, 42, 0.06), 0 4px 16px rgba(15, 23, 42, 0.04)",
    link: "#4338ca",
    linkHover: "#3730a3",
  },
  logo: {
    gradient: "linear-gradient(145deg, #a78bfa 0%, #6366f1 48%, #4338ca 100%)",
    shadow: "0 4px 12px rgba(67, 56, 202, 0.32)",
  },
} as const

/** Solid indigo CTA — mockup uses #4338ca, not violet gradient. */
export const buyerPremiumCtaClass =
  "bg-[#4338ca] text-white shadow-[0_4px_14px_rgba(67,56,202,0.35)] transition hover:bg-[#3730a3] active:scale-[0.98]"
