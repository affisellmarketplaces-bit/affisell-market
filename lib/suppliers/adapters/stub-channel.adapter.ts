import type { SupplierChannelType } from "@prisma/client"

import { ManualSupplierAdapter } from "@/lib/suppliers/adapters/manual.adapter"

/** Channels without a dedicated integration yet — same behavior as MANUAL. */
export class StubChannelSupplierAdapter extends ManualSupplierAdapter {
  constructor(
    supplier: ConstructorParameters<typeof ManualSupplierAdapter>[0],
    readonly type: SupplierChannelType
  ) {
    super(supplier)
  }
}
