import { z } from "@medusajs/deps/zod";
export declare function zodValidator<T>(zodSchema: z.ZodObject<any, any> | z.ZodType<any, any, any>, body: T): Promise<z.output<z.ZodObject<any, any> | z.ZodType<any, any, any>>>;
//# sourceMappingURL=zod-helpers.d.ts.map