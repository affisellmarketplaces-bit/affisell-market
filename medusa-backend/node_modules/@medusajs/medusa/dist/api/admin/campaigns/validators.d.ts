import { CampaignBudgetType } from "@medusajs/framework/utils";
import { z } from "@medusajs/framework/zod";
export declare const AdminGetCampaignParams: z.ZodObject<{
    fields: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const AdminGetCampaignsParamsFields: z.ZodObject<{
    q: z.ZodOptional<z.ZodString>;
    campaign_identifier: z.ZodOptional<z.ZodString>;
    budget: z.ZodOptional<z.ZodObject<{
        currency_code: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
}, z.core.$strict>;
export type AdminGetCampaignsParamsType = z.infer<typeof AdminGetCampaignsParams>;
export declare const AdminGetCampaignsParams: z.ZodObject<{
    [x: string]: any;
    $and: z.ZodOptional<z.ZodLazy<z.ZodArray<z.ZodObject<{
        q: z.ZodOptional<z.ZodString>;
        campaign_identifier: z.ZodOptional<z.ZodString>;
        budget: z.ZodOptional<z.ZodObject<{
            currency_code: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
    }, z.core.$strict>>>>;
    $or: z.ZodOptional<z.ZodLazy<z.ZodArray<z.ZodObject<{
        q: z.ZodOptional<z.ZodString>;
        campaign_identifier: z.ZodOptional<z.ZodString>;
        budget: z.ZodOptional<z.ZodObject<{
            currency_code: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
    }, z.core.$strict>>>>;
}, z.core.$strict>;
export declare const UpdateCampaignBudget: z.ZodObject<{
    limit: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
}, z.core.$strict>;
export type AdminCreateCampaignType = z.infer<typeof CreateCampaign>;
export declare const CreateCampaign: z.ZodObject<{
    name: z.ZodString;
    campaign_identifier: z.ZodString;
    description: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    budget: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        type: z.ZodEnum<typeof CampaignBudgetType>;
        limit: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        currency_code: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        attribute: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, z.core.$strict>>>;
    starts_at: z.ZodOptional<z.ZodNullable<z.ZodCoercedDate<unknown>>>;
    ends_at: z.ZodOptional<z.ZodNullable<z.ZodCoercedDate<unknown>>>;
}, z.core.$strict>;
export declare const AdminCreateCampaign: (additionalDataValidator?: z.ZodOptional<z.ZodNullable<z.ZodObject<any, any>>>) => z.ZodObject<any, any>;
export type AdminUpdateCampaignType = z.infer<typeof UpdateCampaign>;
export declare const UpdateCampaign: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    campaign_identifier: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    budget: z.ZodOptional<z.ZodObject<{
        limit: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    }, z.core.$strict>>;
    starts_at: z.ZodOptional<z.ZodNullable<z.ZodCoercedDate<unknown>>>;
    ends_at: z.ZodOptional<z.ZodNullable<z.ZodCoercedDate<unknown>>>;
}, z.core.$strip>;
export declare const AdminUpdateCampaign: (additionalDataValidator?: z.ZodOptional<z.ZodNullable<z.ZodObject<any, any>>>) => z.ZodObject<any, any>;
//# sourceMappingURL=validators.d.ts.map