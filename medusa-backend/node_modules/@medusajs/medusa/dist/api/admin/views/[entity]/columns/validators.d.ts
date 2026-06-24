import { z } from "@medusajs/framework/zod";
export type AdminGetColumnsParamsType = z.infer<typeof AdminGetColumnsParams>;
export declare const AdminGetColumnsParams: z.ZodObject<{
    fields: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
//# sourceMappingURL=validators.d.ts.map