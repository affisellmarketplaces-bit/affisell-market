import { describe, expect, it } from "vitest"

import en from "@/messages/en.json"
import fr from "@/messages/fr.json"
import { PAGE_ERROR_COPY } from "@/lib/page-error-copy"

describe("app/error.tsx copy mirrors the catalogs", () => {
  it("matches errors.page in en.json and fr.json", () => {
    expect(PAGE_ERROR_COPY.en).toEqual(en.errors.page)
    expect(PAGE_ERROR_COPY.fr).toEqual(fr.errors.page)
  })
})
