import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { HttpTypes } from "@medusajs/framework/types";
/**
 * @since 2.10.0
 */
export declare const GET: (req: AuthenticatedMedusaRequest<HttpTypes.AdminGetShippingOptionTypeParams>, res: MedusaResponse<HttpTypes.AdminShippingOptionTypeResponse>) => Promise<void>;
/**
 * @since 2.10.0
 */
export declare const POST: (req: AuthenticatedMedusaRequest<HttpTypes.AdminUpdateShippingOptionType, HttpTypes.AdminGetShippingOptionTypeParams>, res: MedusaResponse<HttpTypes.AdminShippingOptionTypeResponse>) => Promise<void>;
/**
 * @since 2.10.0
 */
export declare const DELETE: (req: AuthenticatedMedusaRequest, res: MedusaResponse<HttpTypes.AdminShippingOptionTypeDeleteResponse>) => Promise<void>;
//# sourceMappingURL=route.d.ts.map