import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { AdminShippingOption, HttpTypes } from "@medusajs/framework/types";
/**
 * @since 2.10.0
 */
export declare const GET: (req: MedusaRequest<{}, HttpTypes.AdminGetOrderShippingOptionList>, res: MedusaResponse<{
    shipping_options: AdminShippingOption[];
}>) => Promise<void>;
//# sourceMappingURL=route.d.ts.map