export {
  releaseResilientNavLock as releaseDockNavLock,
  RESILIENT_NAV_STALL_MS as MOBILE_DOCK_NAV_STALL_MS,
  shouldHardFallbackNav,
  tryAcquireResilientNavLock as tryAcquireDockNavLock,
} from "@/lib/resilient-nav"
