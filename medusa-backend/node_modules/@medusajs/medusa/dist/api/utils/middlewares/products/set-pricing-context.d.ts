import { AuthenticatedMedusaRequest } from "@medusajs/framework/http";
import { NextFunction } from "express";
type PricingContextOptions = {
    priceFieldPaths?: string[];
};
export declare function setPricingContext(options?: PricingContextOptions): (req: AuthenticatedMedusaRequest, _: any, next: NextFunction) => Promise<void>;
export {};
//# sourceMappingURL=set-pricing-context.d.ts.map