import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { AdminCreateViewConfigurationType } from "./validators";
import { HttpTypes } from "@medusajs/framework/types";
/**
 * @since 2.10.3
 * @featureFlag view_configurations
 */
export declare const GET: (req: AuthenticatedMedusaRequest<HttpTypes.AdminGetViewConfigurationsParams>, res: MedusaResponse<HttpTypes.AdminViewConfigurationListResponse>) => Promise<void>;
/**
 * @since 2.10.3
 * @featureFlag view_configurations
 */
export declare const POST: (req: AuthenticatedMedusaRequest<AdminCreateViewConfigurationType>, res: MedusaResponse<HttpTypes.AdminViewConfigurationResponse>) => Promise<MedusaResponse<HttpTypes.AdminViewConfigurationResponse>>;
//# sourceMappingURL=route.d.ts.map