import type { Variants } from "framer-motion"

export const fadeSlideUp: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0 },
}

export const staggerContainer: Variants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.05 },
  },
}

export const scaleFadeIn: Variants = {
  hidden: { opacity: 0, scale: 0.96 },
  visible: { opacity: 1, scale: 1 },
}

export const motionEaseOut = [0.16, 1, 0.3, 1] as const

export const motionTransition = {
  duration: 0.3,
  ease: motionEaseOut,
} as const
