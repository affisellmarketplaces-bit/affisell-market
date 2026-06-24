import { NextFunction } from "express";
import { AuthenticatedMedusaRequest } from "@medusajs/framework/http";
type PricingContextOptions = {
    priceFieldPaths?: string[];
};
export declare function normalizeDataForContext(options?: PricingContextOptions): (req: AuthenticatedMedusaRequest, _: any, next: NextFunction) => Promise<void>;
export {};
//# sourceMappingURL=normalize-data-for-context.d.ts.map