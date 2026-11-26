import { describe, expect, it } from "vitest"

import {
  normaliseTrackingNumber,
  parseAeOrderGetTracking,
  parseAeTrackingGet,
} from "@/lib/aliexpress-ds-tracking-parse"

/**
 * Shapes taken from AliExpress's public documentation (TOP-style wrapped lists and plain arrays). NOT recorded from a
 * live answer: the development environment has no AliExpress access.
 */
describe("parseAeTrackingGet (aliexpress.ds.order.tracking.get)", () => {
  it("reads the tracking number, carrier and last event of a TOP-style answer", () => {
    const payload = {
      aliexpress_ds_order_tracking_get_response: {
        result: {
          ret: true,
          data: {
            tracking_detail_line_list: {
              tracking_detail: [
                {
                  mail_no: "lp 0012 3456 789cn",
                  carrier_name: "Cainiao Super Economy",
                  detail_node_list: { detail_node: [{ tracking_detail_desc: "Departed from sorting center" }] },
                },
              ],
            },
          },
        },
      },
    }
    expect(parseAeTrackingGet(payload)).toEqual({
      number: "LP00123456789CN",
      carrier: "Cainiao Super Economy",
      source: "ds_order_tracking_get",
      lastEvent: "Departed from sorting center",
    })
  })

  it("reads plain arrays and an unwrapped answer", () => {
    const payload = { result: { data: { tracking_detail_line_list: [{ logistics_no: "RB123456789CN" }] } } }
    expect(parseAeTrackingGet(payload)).toMatchObject({ number: "RB123456789CN", carrier: null })
  })

  it("answers 'no tracking' for ret=false, an empty list, or garbage numbers", () => {
    expect(parseAeTrackingGet({ result: { ret: false, data: { tracking_detail_line_list: [{ mail_no: "RB123456789CN" }] } } })).toBeNull()
    expect(parseAeTrackingGet({ result: { ret: true, data: { tracking_detail_line_list: [] } } })).toBeNull()
    expect(parseAeTrackingGet({ result: { data: { tracking_detail_line_list: [{ mail_no: "pending" }] } } })).toBeNull()
    expect(parseAeTrackingGet({ result: { data: { tracking_detail_line_list: [{ mail_no: "<script>1</script>" }] } } })).toBeNull()
    expect(parseAeTrackingGet(null)).toBeNull()
    expect(parseAeTrackingGet("oops")).toBeNull()
  })

  it("skips a line without a usable number and takes the next one", () => {
    const payload = {
      result: { data: { tracking_detail_line_list: [{ mail_no: "" }, { mail_no: "YT2300000000000001", carrier_name: "YunExpress" }] } },
    }
    expect(parseAeTrackingGet(payload)).toMatchObject({ number: "YT2300000000000001", carrier: "YunExpress" })
  })
})

describe("parseAeOrderGetTracking (aliexpress.trade.ds.order.get)", () => {
  it("reads the logistics number once the seller shipped", () => {
    const payload = {
      aliexpress_trade_ds_order_get_response: {
        result: {
          order_status: "WAIT_BUYER_ACCEPT_GOODS",
          logistics_info_list: {
            ae_order_logistics_info: [{ logistics_no: "LX123456789CN", logistics_service: "AliExpress Standard Shipping" }],
          },
        },
      },
    }
    expect(parseAeOrderGetTracking(payload)).toEqual({
      number: "LX123456789CN",
      carrier: "AliExpress Standard Shipping",
      source: "trade_ds_order_get",
      lastEvent: null,
    })
  })

  it("answers 'no tracking' before shipment", () => {
    expect(
      parseAeOrderGetTracking({ aliexpress_trade_ds_order_get_response: { result: { order_status: "PLACE_ORDER_SUCCESS" } } })
    ).toBeNull()
  })
})

describe("normaliseTrackingNumber", () => {
  it("keeps carrier-like numbers only", () => {
    expect(normaliseTrackingNumber(" ab 1234 5678 ")).toBe("AB12345678")
    expect(normaliseTrackingNumber("1Z999AA10123456784")).toBe("1Z999AA10123456784")
    expect(normaliseTrackingNumber("ABCDEFGHIJ")).toBeNull() // no digit
    expect(normaliseTrackingNumber("12345")).toBeNull() // too short
    expect(normaliseTrackingNumber("A".repeat(20) + "1".repeat(21))).toBeNull() // too long
    expect(normaliseTrackingNumber(null)).toBeNull()
  })
})
