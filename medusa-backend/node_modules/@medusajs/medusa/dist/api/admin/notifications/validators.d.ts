import { z } from "@medusajs/framework/zod";
export type AdminGetNotificationParamsType = z.infer<typeof AdminGetNotificationParams>;
export declare const AdminGetNotificationParams: z.ZodObject<{
    fields: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const AdminGetNotificationsParamsFields: z.ZodObject<{
    q: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>;
    channel: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>;
}, z.core.$strip>;
export type AdminGetNotificationsParamsType = z.infer<typeof AdminGetNotificationsParams>;
export declare const AdminGetNotificationsParams: z.ZodObject<{
    [x: string]: any;
    $and: z.ZodOptional<z.ZodLazy<z.ZodArray<z.ZodObject<{
        q: z.ZodOptional<z.ZodString>;
        id: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>;
        channel: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>;
    }, z.core.$strip>>>>;
    $or: z.ZodOptional<z.ZodLazy<z.ZodArray<z.ZodObject<{
        q: z.ZodOptional<z.ZodString>;
        id: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>;
        channel: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>;
    }, z.core.$strip>>>>;
}, z.core.$strip>;
//# sourceMappingURL=validators.d.ts.map