import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { HttpTypes } from "@medusajs/framework/types";
/**
 * Get available columns for an entity.
 *
 * @since 2.10.3
 * @featureFlag view_configurations
 */
export declare const GET: (req: AuthenticatedMedusaRequest, res: MedusaResponse<HttpTypes.AdminViewsEntityColumnsResponse>) => Promise<MedusaResponse<HttpTypes.AdminViewsEntityColumnsResponse>>;
//# sourceMappingURL=route.d.ts.map