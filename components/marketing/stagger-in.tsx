"use client"

import { motion } from "framer-motion"
import type { ReactNode } from "react"

import { fadeSlideUp, motionTransition, staggerContainer } from "@/lib/motion-presets"

type Props = {
  children: ReactNode
  className?: string
}

export function StaggerIn({ children, className }: Props) {
  return (
    <motion.div
      className={className}
      variants={staggerContainer}
      initial={false}
      whileInView="visible"
      viewport={{ once: true, margin: "-60px", amount: 0.12 }}
    >
      {children}
    </motion.div>
  )
}

export function StaggerItem({ children, className }: Props) {
  return (
    <motion.div className={className} variants={fadeSlideUp} transition={motionTransition}>
      {children}
    </motion.div>
  )
}
