import { render } from "@react-email/render"
import { describe, expect, it } from "vitest"

import { expansionEmailExportsBundlePath } from "@/lib/admin/expansion-email-export-kinds"
import { ExpansionDigestEmail } from "@/emails/expansion-digest"
import {
  EXPANSION_DIGEST_EMAIL_PREVIEW_APP_URL,
  buildExpansionDigestEmailPreviewProps,
} from "@/lib/expansion/expansion-digest-email-preview"

describe("buildExpansionDigestEmailPreviewProps", () => {
  it("aligns filtered console URL with cron digest props", () => {
    const props = buildExpansionDigestEmailPreviewProps("https://app.test")
    expect(props.filteredConsoleUrl).toBe("https://app.test/admin/expansion?multiAlert=1")
    expect(props.adminConsoleUrl).toBe(props.filteredConsoleUrl)
    expect(props.multiAlertCountryCount).toBe(3)
    expect(props.topMultiAlertCountries).toHaveLength(3)
  })

  it("includes text footer console and ZIP lines in bodyText", () => {
    const props = buildExpansionDigestEmailPreviewProps("https://app.test")
    expect(props.bodyText).toContain("Console (multi-alert filter): https://app.test/admin/expansion?multiAlert=1")
    expect(props.bodyText).toContain("Multi-alert ZIPs:")
    expect(props.bodyText).toContain(`JP ZIP https://app.test${expansionEmailExportsBundlePath("jp")}`)
  })
})

describe("ExpansionDigestEmail preview props", () => {
  it("renders filtered console footer and ZIP links for email:dev", async () => {
    const props = buildExpansionDigestEmailPreviewProps(EXPANSION_DIGEST_EMAIL_PREVIEW_APP_URL)
    const html = await render(ExpansionDigestEmail(props))
    const normalizedHtml = html.replace(/<!-- -->/g, "")
    expect(normalizedHtml).toContain("Console (multi-alert filter):")
    expect(normalizedHtml).toContain("https://affisell.com/admin/expansion?multiAlert=1")
    expect(normalizedHtml).toContain("Multi-alert ZIPs:")
    expect(normalizedHtml).toContain("Open filtered console")
    expect(normalizedHtml).toContain("JP ZIP")
    expect(normalizedHtml).toContain("KR ZIP")
    expect(normalizedHtml).toContain("SG ZIP")
  })

  it("uses shared preview props on the email component", () => {
    expect(ExpansionDigestEmail.PreviewProps.adminConsoleUrl).toBe(
      "https://affisell.com/admin/expansion?multiAlert=1"
    )
    expect(ExpansionDigestEmail.PreviewProps.filteredConsoleUrl).toBe(
      ExpansionDigestEmail.PreviewProps.adminConsoleUrl
    )
  })
})
