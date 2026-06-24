import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { AdminSetActiveViewConfigurationType, AdminGetActiveViewConfigurationParamsType } from "../validators";
import { HttpTypes } from "@medusajs/framework/types";
/**
 * @since 2.10.3
 * @featureFlag view_configurations
 */
export declare const GET: (req: AuthenticatedMedusaRequest<AdminGetActiveViewConfigurationParamsType>, res: MedusaResponse<HttpTypes.AdminViewConfigurationResponse & {
    is_default_active?: boolean;
    default_type?: "system" | "code";
}>) => Promise<void>;
/**
 * @since 2.10.3
 * @featureFlag view_configurations
 */
export declare const POST: (req: AuthenticatedMedusaRequest<AdminSetActiveViewConfigurationType>, res: MedusaResponse<{
    success: boolean;
}>) => Promise<void>;
//# sourceMappingURL=route.d.ts.map