import { z } from "@medusajs/deps/zod";
import { BaseEntity, QueryConfig } from "@medusajs/types";
import { NextFunction } from "express";
import { MedusaRequest, MedusaResponse } from "../types";
export declare function validateAndTransformQuery<TEntity extends BaseEntity>(zodSchema: z.ZodObject<any, any> | z.ZodType<any, any, any>, queryConfig: QueryConfig<TEntity>): (req: MedusaRequest, res: MedusaResponse, next: NextFunction) => Promise<void>;
//# sourceMappingURL=validate-query.d.ts.map