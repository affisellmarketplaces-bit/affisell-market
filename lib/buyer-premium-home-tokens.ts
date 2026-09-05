/**
 * Buyer premium home — hex tokens sampled from /public/mockup.png audit.
 * Keep in sync when adjusting hero / nav / discover intensity.
 */
export const BUYER_PREMIUM = {
  /** Page canvas — saturated Affisell violet (ref-full-decoupage) */
  pageBg: "#6B4EFF",
  text: {
    heading: "#0f172a",
    body: "#475569",
    muted: "#64748b",
    nav: "#334155",
  },
  /** Copy on saturated violet hero gradient — light text + shadow for WCAG on orbs */
  heroText: {
    heading: "#ffffff",
    body: "rgba(255, 255, 255, 0.94)",
    shadow: "0 1px 3px rgba(30, 27, 75, 0.45)",
  },
  hero: {
    /** Saturated violet → indigo (ref-full-decoupage hero) */
    gradient: "linear-gradient(135deg, #7C3AED 0%, #4F46E5 100%)",
    border: "rgba(167, 139, 250, 0.55)",
    orbLeft: "rgba(217, 70, 239, 0.28)",
    orbRight: "rgba(79, 70, 229, 0.24)",
    orbCenter: "rgba(67, 56, 202, 0.14)",
    shine: "rgba(255, 255, 255, 0.12)",
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
