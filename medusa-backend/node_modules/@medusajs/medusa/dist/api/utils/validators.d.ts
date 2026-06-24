import { z, type ZodNullable, type ZodObject, type ZodOptional } from "@medusajs/framework/zod";
/**
 * Wraps the original schema to a function to accept and merge
 * additional_data schema
 */
export declare const WithAdditionalData: <T extends ZodObject<any, any>>(originalSchema: T, modifyCallback?: (schema: T) => ZodObject<any, any>) => (additionalDataValidator?: ZodOptional<ZodNullable<ZodObject<any, any>>>) => z.ZodObject<any, any>;
export declare const createBatchBody: (createValidator: z.ZodType, updateValidator: z.ZodType, deleteValidator?: z.ZodType) => z.ZodObject<{
    create: z.ZodOptional<z.ZodArray<z.ZodType<unknown, unknown, z.core.$ZodTypeInternals<unknown, unknown>>>>;
    update: z.ZodOptional<z.ZodArray<z.ZodType<unknown, unknown, z.core.$ZodTypeInternals<unknown, unknown>>>>;
    delete: z.ZodOptional<z.ZodArray<z.ZodType<unknown, unknown, z.core.$ZodTypeInternals<unknown, unknown>>>>;
}, z.core.$strip>;
export declare const createLinkBody: () => z.ZodObject<{
    add: z.ZodOptional<z.ZodArray<z.ZodString>>;
    remove: z.ZodOptional<z.ZodArray<z.ZodString>>;
}, z.core.$strip>;
export declare const createSelectParams: () => z.ZodObject<{
    fields: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const createFindParams: ({ offset, limit, order, }?: {
    offset?: number;
    limit?: number;
    order?: string;
}) => z.ZodObject<{
    fields: z.ZodOptional<z.ZodString>;
    offset: z.ZodPipe<z.ZodTransform<unknown, unknown>, z.ZodDefault<z.ZodOptional<z.ZodNumber>>>;
    limit: z.ZodPipe<z.ZodTransform<unknown, unknown>, z.ZodDefault<z.ZodOptional<z.ZodNumber>>>;
    order: z.ZodOptional<z.ZodString> | z.ZodDefault<z.ZodOptional<z.ZodString>>;
    with_deleted: z.ZodPipe<z.ZodTransform<unknown, unknown>, z.ZodOptional<z.ZodBoolean>>;
}, z.core.$strip>;
export declare const createOperatorMap: (type?: z.ZodType, valueParser?: (val: any) => any) => z.ZodUnion<readonly [any, z.ZodObject<{
    $eq: any;
    $ne: any;
    $in: any;
    $nin: any;
    $like: any;
    $ilike: any;
    $re: any;
    $contains: any;
    $gt: any;
    $gte: any;
    $lt: any;
    $lte: any;
}, z.core.$strip>]>;
//# sourceMappingURL=validators.d.ts.map