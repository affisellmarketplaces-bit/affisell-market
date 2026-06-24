import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework";
import { HttpTypes } from "@medusajs/framework/types";
/**
 * Get the index information for all entities that are indexed and their sync state
 *
 * @since 2.11.2
 * @featureFlag index
 */
export declare const GET: (req: AuthenticatedMedusaRequest<void>, res: MedusaResponse<HttpTypes.AdminIndexDetailsResponse>) => Promise<void>;
//# sourceMappingURL=route.d.ts.map