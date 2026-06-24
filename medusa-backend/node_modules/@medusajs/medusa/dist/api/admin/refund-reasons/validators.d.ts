import { z } from "@medusajs/framework/zod";
export type AdminCreatePaymentRefundReasonType = z.infer<typeof AdminCreatePaymentRefundReason>;
export declare const AdminCreatePaymentRefundReason: z.ZodObject<{
    label: z.ZodString;
    code: z.ZodString;
    description: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, z.core.$strict>;
export type AdminUpdatePaymentRefundReasonType = z.infer<typeof AdminUpdatePaymentRefundReason>;
export declare const AdminUpdatePaymentRefundReason: z.ZodObject<{
    label: z.ZodOptional<z.ZodString>;
    code: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, z.core.$strict>;
/**
 * Parameters used to filter and configure the pagination of the retrieved refund reason.
 */
export declare const AdminGetRefundReasonsParams: z.ZodObject<{
    fields: z.ZodOptional<z.ZodString>;
    offset: z.ZodPipe<z.ZodTransform<unknown, unknown>, z.ZodDefault<z.ZodOptional<z.ZodNumber>>>;
    limit: z.ZodPipe<z.ZodTransform<unknown, unknown>, z.ZodDefault<z.ZodOptional<z.ZodNumber>>>;
    order: z.ZodOptional<z.ZodString> | z.ZodDefault<z.ZodOptional<z.ZodString>>;
    with_deleted: z.ZodPipe<z.ZodTransform<unknown, unknown>, z.ZodOptional<z.ZodBoolean>>;
    id: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>;
    q: z.ZodOptional<z.ZodString>;
    created_at: z.ZodOptional<z.ZodUnion<readonly [any, z.ZodObject<{
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
    }, z.core.$strip>]>>;
    updated_at: z.ZodOptional<z.ZodUnion<readonly [any, z.ZodObject<{
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
    }, z.core.$strip>]>>;
    deleted_at: z.ZodOptional<z.ZodUnion<readonly [any, z.ZodObject<{
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
    }, z.core.$strip>]>>;
}, z.core.$strip>;
export type AdminGetRefundReasonsParamsType = z.infer<typeof AdminGetRefundReasonsParams>;
export declare const AdminGetRefundReasonParams: z.ZodObject<{
    fields: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type AdminGetRefundReasonParamsType = z.infer<typeof AdminGetRefundReasonParams>;
//# sourceMappingURL=validators.d.ts.map