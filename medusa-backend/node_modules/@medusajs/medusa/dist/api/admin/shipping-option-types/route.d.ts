import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { HttpTypes } from "@medusajs/framework/types";
/**
 * @since 2.10.0
 */
export declare const GET: (req: AuthenticatedMedusaRequest<HttpTypes.AdminShippingOptionTypeListParams>, res: MedusaResponse<HttpTypes.AdminShippingOptionTypeListResponse>) => Promise<void>;
/**
 * @since 2.10.0
 */
export declare const POST: (req: AuthenticatedMedusaRequest<HttpTypes.AdminCreateShippingOptionType, HttpTypes.AdminGetShippingOptionTypeParams>, res: MedusaResponse<HttpTypes.AdminShippingOptionTypeResponse>) => Promise<void>;
//# sourceMappingURL=route.d.ts.map