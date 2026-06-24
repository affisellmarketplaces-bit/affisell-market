import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { HttpTypes } from "@medusajs/framework/types";
/**
 * Get a property label by ID.
 * @since 2.10.3
 * @featureFlag view_configurations
 */
export declare const GET: (req: AuthenticatedMedusaRequest, res: MedusaResponse<HttpTypes.AdminPropertyLabelResponse>) => Promise<void>;
/**
 * Update a property label.
 * @since 2.10.3
 * @featureFlag view_configurations
 */
export declare const POST: (req: AuthenticatedMedusaRequest<HttpTypes.AdminUpdatePropertyLabel>, res: MedusaResponse<HttpTypes.AdminPropertyLabelResponse>) => Promise<void>;
/**
 * Delete a property label.
 * @since 2.10.3
 * @featureFlag view_configurations
 */
export declare const DELETE: (req: AuthenticatedMedusaRequest, res: MedusaResponse<HttpTypes.AdminPropertyLabelDeleteResponse>) => Promise<void>;
//# sourceMappingURL=route.d.ts.map