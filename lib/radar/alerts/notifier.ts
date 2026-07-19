import "server-only"

import type { AlertSubscription, RadarAlert } from ".prisma/client-mi"

import { decryptString } from "@/lib/crypto"
import { sendRadarAlertEmail } from "@/lib/radar/alerts/email"
import type { AlertSubscriptionFilters, Severity } from "@/lib/radar/alerts/types"
import { SEVERITY_RANK } from "@/lib/radar/alerts/types"
import { prisma } from "@/lib/prisma"

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function parseFilters(raw: unknown): AlertSubscriptionFilters {
  if (!raw || typeof raw !== "object") return {}
  const o = raw as Record<string, unknown>
  return {
    marketplaces: Array.isArray(o.marketplaces)
      ? o.marketplaces.filter((x): x is string => typeof x === "string")
      : undefined,
    countries: Array.isArray(o.countries)
      ? o.countries.filter((x): x is string => typeof x === "string")
      : undefined,
    categories: Array.isArray(o.categories)
      ? o.categories.filter((x): x is string => typeof x === "string")
      : undefined,
    minSeverity:
      typeof o.minSeverity === "string" && o.minSeverity in SEVERITY_RANK
        ? (o.minSeverity as Severity)
        : undefined,
  }
}

function alertMatchesFilters(alert: RadarAlert, filters: AlertSubscriptionFilters): boolean {
  if (filters.marketplaces?.length && !filters.marketplaces.includes(alert.marketplaceId)) {
    return false
  }
  if (filters.countries?.length && alert.country && !filters.countries.includes(alert.country)) {
    return false
  }
  if (filters.categories?.length && alert.category && !filters.categories.includes(alert.category)) {
    return false
  }
  if (filters.minSeverity) {
    const min = SEVERITY_RANK[filters.minSeverity]
    const sev = SEVERITY_RANK[alert.severity as Severity] ?? 0
    if (sev < min) return false
  }
  return true
}

function slackPayload(alert: RadarAlert): { text: string } {
  const productUrl =
    typeof alert.meta === "object" &&
    alert.meta &&
    "url" in alert.meta &&
    typeof (alert.meta as { url?: unknown }).url === "string"
      ? String((alert.meta as { url: string }).url)
      : `https://affisell.com/radar/winners?productId=${encodeURIComponent(alert.productId ?? "")}`

  const link =
    productUrl && productUrl.startsWith("http")
      ? `<${productUrl}|Voir produit>`
      : "Voir produit"

  return {
    text: `*${alert.severity.toUpperCase()}* - ${alert.title}\n${alert.message}\n${link} | ${alert.marketplaceId} ${alert.country ?? ""}`.trim(),
  }
}

async function postSlackWebhook(webhookUrl: string, alert: RadarAlert): Promise<boolean> {
  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(slackPayload(alert)),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => "")
    console.warn("[radar/alerts/notifier]", {
      result: "slack_failed",
      status: res.status,
      body: body.slice(0, 120),
    })
    return false
  }
  return true
}

/**
 * Fan-out created alerts to active subscriptions (Slack first).
 * Rate-limits Slack to ~1 msg/sec. Failures are isolated per subscription.
 */
export async function sendAlertsToSubscribers(
  alerts: RadarAlert[],
  subscriptions: AlertSubscription[]
): Promise<{ sent: number }> {
  if (alerts.length === 0 || subscriptions.length === 0) {
    return { sent: 0 }
  }

  let sent = 0

  for (const sub of subscriptions) {
    if (!sub.active) continue
    const filters = parseFilters(sub.filters)
    const matched = alerts.filter((a) => alertMatchesFilters(a, filters))
    if (matched.length === 0) continue

    try {
      if (sub.channel === "slack") {
        let webhook = ""
        if (sub.webhookUrl) {
          try {
            webhook = decryptString(sub.webhookUrl)
          } catch (err) {
            console.error("[radar/alerts/notifier]", {
              result: "decrypt_failed",
              userId: sub.userId,
              message: err instanceof Error ? err.message : "unknown",
            })
            continue
          }
        } else if (process.env.SLACK_WEBHOOK_URL?.trim()) {
          webhook = process.env.SLACK_WEBHOOK_URL.trim()
        }

        if (!webhook) {
          console.warn("[radar/alerts/notifier]", {
            result: "no_webhook",
            userId: sub.userId,
          })
          continue
        }

        for (const alert of matched) {
          const ok = await postSlackWebhook(webhook, alert)
          if (ok) sent += 1
          await sleep(1000)
        }
      } else if (sub.channel === "email") {
        let email = ""
        try {
          const user = await prisma.user.findUnique({
            where: { id: sub.userId },
            select: { email: true },
          })
          email = user?.email?.trim() || ""
        } catch (err) {
          console.error("[radar/alerts/notifier]", {
            result: "email_user_lookup_failed",
            userId: sub.userId,
            message: err instanceof Error ? err.message : "unknown",
          })
          continue
        }
        if (!email) {
          console.warn("[radar/alerts/notifier]", {
            result: "email_no_recipient",
            userId: sub.userId,
          })
          continue
        }
        for (const alert of matched) {
          const productUrl =
            typeof alert.meta === "object" &&
            alert.meta &&
            "url" in alert.meta &&
            typeof (alert.meta as { url?: unknown }).url === "string"
              ? String((alert.meta as { url: string }).url)
              : null
          const emailResult = await sendRadarAlertEmail({
            to: email,
            type: alert.type,
            title: alert.title,
            message: alert.message,
            severity: alert.severity,
            marketplaceId: alert.marketplaceId,
            country: alert.country,
            productUrl,
          })
          if (emailResult.emailed) sent += 1
          await sleep(200)
        }
      } else if (sub.channel === "webhook" && sub.webhookUrl) {
        let url = ""
        try {
          url = decryptString(sub.webhookUrl)
        } catch {
          continue
        }
        for (const alert of matched) {
          try {
            await fetch(url, {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ alert }),
            })
            sent += 1
            await sleep(1000)
          } catch (err) {
            console.warn("[radar/alerts/notifier]", {
              result: "webhook_failed",
              userId: sub.userId,
              message: err instanceof Error ? err.message : "unknown",
            })
          }
        }
      }
    } catch (err) {
      console.error("[radar/alerts/notifier]", {
        result: "subscription_failed",
        userId: sub.userId,
        channel: sub.channel,
        message: err instanceof Error ? err.message : "unknown",
      })
    }
  }

  console.log("[radar/alerts/notifier]", { result: "done", sent, alerts: alerts.length })
  return { sent }
}
