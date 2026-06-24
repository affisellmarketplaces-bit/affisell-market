import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { HttpTypes } from "@medusajs/framework/types";
/**
 * Batch create, update, and delete property labels.
 * @since 2.10.3
 * @featureFlag view_configurations
 */
export declare const POST: (req: AuthenticatedMedusaRequest<HttpTypes.AdminBatchPropertyLabels>, res: MedusaResponse<HttpTypes.AdminBatchPropertyLabelResponse>) => Promise<void>;
//# sourceMappingURL=route.d.ts.map