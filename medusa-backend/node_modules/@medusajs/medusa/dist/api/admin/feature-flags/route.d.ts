import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
export declare const AUTHENTICATE = false;
/**
 * @since 2.10.0
 */
export declare const GET: (req: MedusaRequest, res: MedusaResponse<{
    feature_flags: Record<string, boolean>;
}>) => Promise<void>;
//# sourceMappingURL=route.d.ts.map