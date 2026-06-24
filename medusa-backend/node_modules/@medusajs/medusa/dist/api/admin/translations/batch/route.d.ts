import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework";
import { BatchMethodRequest, HttpTypes } from "@medusajs/types";
/**
 * @since 2.12.3
 * @featureFlag translation
 */
export declare const POST: (req: AuthenticatedMedusaRequest<BatchMethodRequest<HttpTypes.AdminCreateTranslation, HttpTypes.AdminUpdateTranslation>>, res: MedusaResponse<HttpTypes.AdminTranslationsBatchResponse>) => Promise<MedusaResponse<HttpTypes.AdminTranslationsBatchResponse>>;
//# sourceMappingURL=route.d.ts.map