import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { HttpTypes } from "@medusajs/framework/types";
/**
 * List property labels.
 * @since 2.10.3
 * @featureFlag view_configurations
 */
export declare const GET: (req: AuthenticatedMedusaRequest<HttpTypes.AdminPropertyLabelListParams>, res: MedusaResponse<HttpTypes.AdminPropertyLabelListResponse>) => Promise<void>;
/**
 * Create a property label.
 * @since 2.10.3
 * @featureFlag view_configurations
 */
export declare const POST: (req: AuthenticatedMedusaRequest<HttpTypes.AdminCreatePropertyLabel>, res: MedusaResponse<HttpTypes.AdminPropertyLabelResponse>) => Promise<void>;
//# sourceMappingURL=route.d.ts.map