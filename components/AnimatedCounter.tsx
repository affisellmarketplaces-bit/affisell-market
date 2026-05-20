"use client"

import CountUp from "react-countup"
import { useInView } from "framer-motion"
import { useRef } from "react"

type Props = {
  end: number
  suffix?: string
  className?: string
}

export function AnimatedCounter({ end, suffix = "", className }: Props) {
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true, margin: "-40px" })

  return (
    <span ref={ref} className={className}>
      {inView ? <CountUp end={end} duration={1.4} separator="," /> : "0"}
      {suffix}
    </span>
  )
}
