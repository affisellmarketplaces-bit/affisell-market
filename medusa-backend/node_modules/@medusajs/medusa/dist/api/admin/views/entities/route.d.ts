import { HttpTypes } from "@medusajs/framework/types";
import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http";
/**
 * List all available entities that can be used for view configurations.
 * Entities are discovered from joiner configs (GraphQL schema).
 *
 * @since 2.10.3
 * @featureFlag view_configurations
 */
export declare const GET: (req: AuthenticatedMedusaRequest, res: MedusaResponse<HttpTypes.AdminEntityListResponse>) => Promise<MedusaResponse<HttpTypes.AdminEntityListResponse>>;
//# sourceMappingURL=route.d.ts.map