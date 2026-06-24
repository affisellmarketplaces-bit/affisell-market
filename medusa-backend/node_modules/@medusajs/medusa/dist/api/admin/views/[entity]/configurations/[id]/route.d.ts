import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { AdminUpdateViewConfigurationType } from "../validators";
import { HttpTypes } from "@medusajs/framework/types";
/**
 * @since 2.10.3
 * @featureFlag view_configurations
 */
export declare const GET: (req: AuthenticatedMedusaRequest<HttpTypes.AdminGetViewConfigurationParams>, res: MedusaResponse<HttpTypes.AdminViewConfigurationResponse>) => Promise<void>;
/**
 * @since 2.10.3
 * @featureFlag view_configurations
 */
export declare const POST: (req: AuthenticatedMedusaRequest<AdminUpdateViewConfigurationType>, res: MedusaResponse<HttpTypes.AdminViewConfigurationResponse>) => Promise<void>;
/**
 * @since 2.10.3
 * @featureFlag view_configurations
 */
export declare const DELETE: (req: AuthenticatedMedusaRequest, res: MedusaResponse<HttpTypes.AdminViewConfigurationDeleteResponse>) => Promise<void>;
//# sourceMappingURL=route.d.ts.map