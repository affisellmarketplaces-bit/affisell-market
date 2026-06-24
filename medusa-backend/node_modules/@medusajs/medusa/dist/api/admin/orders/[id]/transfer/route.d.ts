import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { HttpTypes } from "@medusajs/framework/types";
/**
 * Request a transfer of an order to a customer.
 */
export declare const POST: (req: AuthenticatedMedusaRequest<HttpTypes.AdminRequestOrderTransfer, HttpTypes.AdminGetOrderParams>, res: MedusaResponse<HttpTypes.AdminOrderResponse>) => Promise<void>;
//# sourceMappingURL=route.d.ts.map