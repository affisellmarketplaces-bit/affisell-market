export type AutoDsCreateOrderPayload = {
  sell_site_order_id: string
  store_name: string
  first_name: string
  last_name: string
  city: string
  zip_code: string
  country: string
  buy_site_id: string
  quantity_to_buy: number
  buy_item_real_id: string
  buy_item_variant: string
  product_title: string
  suggested_buy_price: number
  store_id: number
  buy_item_url: string
  supplier: number
  region: number
  autods_product_id: string
  address1: string
  address2?: string | null
  state?: string | null
  phone_number?: string | null
}

export type AutoDsCreateOrderResponse = {
  order?: {
    id?: number | string
    sell_site_order_id?: string
    status?: string
    tracking_number?: string | null
  }
  id?: number | string
  order_id?: number | string
  status?: string
  tracking_number?: string | null
}

export type AutoDsSubmitResult =
  | { ok: true; autodsOrderId: string; status: string; alreadyExists: boolean }
  | { ok: false; error: string; retryable: boolean }
