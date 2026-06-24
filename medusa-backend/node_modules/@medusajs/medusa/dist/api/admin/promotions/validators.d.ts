import { ApplicationMethodAllocation, ApplicationMethodTargetType, ApplicationMethodType, PromotionRuleOperator, PromotionStatus, PromotionType } from "@medusajs/framework/utils";
import { z } from "@medusajs/framework/zod";
export type AdminGetPromotionParamsType = z.infer<typeof AdminGetPromotionParams>;
export declare const AdminGetPromotionParams: z.ZodObject<{
    fields: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const AdminGetPromotionsParamsFields: z.ZodObject<{
    q: z.ZodOptional<z.ZodString>;
    code: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>, z.ZodUnion<readonly [any, z.ZodObject<{
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
    }, z.core.$strip>]>]>>;
    id: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>, z.ZodUnion<readonly [any, z.ZodObject<{
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
    }, z.core.$strip>]>]>>;
    campaign_id: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>;
    application_method: z.ZodOptional<z.ZodObject<{
        currency_code: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>;
    }, z.core.$strip>>;
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
export type AdminGetPromotionsParamsType = z.infer<typeof AdminGetPromotionsParams>;
export declare const AdminGetPromotionsParams: z.ZodObject<{
    [x: string]: any;
    $and: z.ZodOptional<z.ZodLazy<z.ZodArray<z.ZodObject<{
        q: z.ZodOptional<z.ZodString>;
        code: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>, z.ZodUnion<readonly [any, z.ZodObject<{
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
        }, z.core.$strip>]>]>>;
        id: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>, z.ZodUnion<readonly [any, z.ZodObject<{
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
        }, z.core.$strip>]>]>>;
        campaign_id: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>;
        application_method: z.ZodOptional<z.ZodObject<{
            currency_code: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>;
        }, z.core.$strip>>;
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
    }, z.core.$strip>>>>;
    $or: z.ZodOptional<z.ZodLazy<z.ZodArray<z.ZodObject<{
        q: z.ZodOptional<z.ZodString>;
        code: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>, z.ZodUnion<readonly [any, z.ZodObject<{
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
        }, z.core.$strip>]>]>>;
        id: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>, z.ZodUnion<readonly [any, z.ZodObject<{
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
        }, z.core.$strip>]>]>>;
        campaign_id: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>;
        application_method: z.ZodOptional<z.ZodObject<{
            currency_code: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>;
        }, z.core.$strip>>;
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
    }, z.core.$strip>>>>;
}, z.core.$strict>;
export type AdminGetPromotionRuleParamsType = z.infer<typeof AdminGetPromotionRuleParams>;
export declare const AdminGetPromotionRuleParams: z.ZodObject<{
    promotion_type: z.ZodOptional<z.ZodString>;
    application_method_type: z.ZodOptional<z.ZodString>;
    application_method_target_type: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type AdminGetPromotionRuleTypeParamsType = z.infer<typeof AdminGetPromotionRuleTypeParams>;
export declare const AdminGetPromotionRuleTypeParams: z.ZodObject<{
    fields: z.ZodOptional<z.ZodString>;
    promotion_type: z.ZodOptional<z.ZodString>;
    application_method_type: z.ZodOptional<z.ZodString>;
    application_method_target_type: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type AdminGetPromotionsRuleValueParamsType = z.infer<typeof AdminGetPromotionsRuleValueParams>;
export declare const AdminGetPromotionsRuleValueParams: z.ZodObject<{
    fields: z.ZodOptional<z.ZodString>;
    offset: z.ZodPipe<z.ZodTransform<unknown, unknown>, z.ZodDefault<z.ZodOptional<z.ZodNumber>>>;
    limit: z.ZodPipe<z.ZodTransform<unknown, unknown>, z.ZodDefault<z.ZodOptional<z.ZodNumber>>>;
    order: z.ZodOptional<z.ZodString> | z.ZodDefault<z.ZodOptional<z.ZodString>>;
    with_deleted: z.ZodPipe<z.ZodTransform<unknown, unknown>, z.ZodOptional<z.ZodBoolean>>;
    q: z.ZodOptional<z.ZodString>;
    value: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>;
    application_method_target_type: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type AdminCreatePromotionRuleType = z.infer<typeof AdminCreatePromotionRule>;
export declare const AdminCreatePromotionRule: z.ZodObject<{
    operator: z.ZodEnum<typeof PromotionRuleOperator>;
    description: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    attribute: z.ZodString;
    values: z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>;
}, z.core.$strict>;
export type AdminUpdatePromotionRuleType = z.infer<typeof AdminUpdatePromotionRule>;
export declare const AdminUpdatePromotionRule: z.ZodObject<{
    id: z.ZodString;
    operator: z.ZodOptional<z.ZodEnum<typeof PromotionRuleOperator>>;
    description: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    attribute: z.ZodOptional<z.ZodString>;
    values: z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>;
}, z.core.$strict>;
export type AdminCreateApplicationMethodType = z.infer<typeof AdminCreateApplicationMethod>;
export declare const AdminCreateApplicationMethod: z.ZodObject<{
    description: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    value: z.ZodNumber;
    currency_code: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    max_quantity: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    type: z.ZodEnum<typeof ApplicationMethodType>;
    target_type: z.ZodEnum<typeof ApplicationMethodTargetType>;
    allocation: z.ZodOptional<z.ZodEnum<typeof ApplicationMethodAllocation>>;
    target_rules: z.ZodOptional<z.ZodArray<z.ZodObject<{
        operator: z.ZodEnum<typeof PromotionRuleOperator>;
        description: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        attribute: z.ZodString;
        values: z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>;
    }, z.core.$strict>>>;
    buy_rules: z.ZodOptional<z.ZodArray<z.ZodObject<{
        operator: z.ZodEnum<typeof PromotionRuleOperator>;
        description: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        attribute: z.ZodString;
        values: z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>;
    }, z.core.$strict>>>;
    apply_to_quantity: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    buy_rules_min_quantity: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
}, z.core.$strict>;
export type AdminUpdateApplicationMethodType = z.infer<typeof AdminUpdateApplicationMethod>;
export declare const AdminUpdateApplicationMethod: z.ZodObject<{
    description: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    value: z.ZodOptional<z.ZodNumber>;
    max_quantity: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    currency_code: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    type: z.ZodOptional<z.ZodEnum<typeof ApplicationMethodType>>;
    target_type: z.ZodOptional<z.ZodEnum<typeof ApplicationMethodTargetType>>;
    allocation: z.ZodOptional<z.ZodEnum<typeof ApplicationMethodAllocation>>;
    apply_to_quantity: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    buy_rules_min_quantity: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
}, z.core.$strict>;
export type AdminCreatePromotionType = z.infer<typeof CreatePromotion>;
export declare const CreatePromotion: z.ZodObject<{
    code: z.ZodString;
    is_automatic: z.ZodOptional<z.ZodBoolean>;
    type: z.ZodEnum<typeof PromotionType>;
    is_tax_inclusive: z.ZodOptional<z.ZodBoolean>;
    status: z.ZodDefault<z.ZodEnum<typeof PromotionStatus>>;
    campaign_id: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    campaign: z.ZodOptional<z.ZodObject<{
        name: z.ZodString;
        campaign_identifier: z.ZodString;
        description: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        budget: z.ZodOptional<z.ZodNullable<z.ZodObject<{
            type: z.ZodEnum<typeof import("@medusajs/framework/utils").CampaignBudgetType>;
            limit: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
            currency_code: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            attribute: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        }, z.core.$strict>>>;
        starts_at: z.ZodOptional<z.ZodNullable<z.ZodCoercedDate<unknown>>>;
        ends_at: z.ZodOptional<z.ZodNullable<z.ZodCoercedDate<unknown>>>;
    }, z.core.$strict>>;
    application_method: z.ZodObject<{
        description: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        value: z.ZodNumber;
        currency_code: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        max_quantity: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        type: z.ZodEnum<typeof ApplicationMethodType>;
        target_type: z.ZodEnum<typeof ApplicationMethodTargetType>;
        allocation: z.ZodOptional<z.ZodEnum<typeof ApplicationMethodAllocation>>;
        target_rules: z.ZodOptional<z.ZodArray<z.ZodObject<{
            operator: z.ZodEnum<typeof PromotionRuleOperator>;
            description: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            attribute: z.ZodString;
            values: z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>;
        }, z.core.$strict>>>;
        buy_rules: z.ZodOptional<z.ZodArray<z.ZodObject<{
            operator: z.ZodEnum<typeof PromotionRuleOperator>;
            description: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            attribute: z.ZodString;
            values: z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>;
        }, z.core.$strict>>>;
        apply_to_quantity: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        buy_rules_min_quantity: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    }, z.core.$strict>;
    rules: z.ZodOptional<z.ZodArray<z.ZodObject<{
        operator: z.ZodEnum<typeof PromotionRuleOperator>;
        description: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        attribute: z.ZodString;
        values: z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>;
    }, z.core.$strict>>>;
    limit: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
}, z.core.$strict>;
export declare const AdminCreatePromotion: (additionalDataValidator?: z.ZodOptional<z.ZodNullable<z.ZodObject<any, any>>>) => z.ZodObject<any, any>;
export type AdminUpdatePromotionType = z.infer<typeof UpdatePromotion>;
export declare const UpdatePromotion: z.ZodObject<{
    code: z.ZodOptional<z.ZodString>;
    is_automatic: z.ZodOptional<z.ZodBoolean>;
    is_tax_inclusive: z.ZodOptional<z.ZodBoolean>;
    type: z.ZodOptional<z.ZodEnum<typeof PromotionType>>;
    status: z.ZodOptional<z.ZodEnum<typeof PromotionStatus>>;
    campaign_id: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    application_method: z.ZodOptional<z.ZodObject<{
        description: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        value: z.ZodOptional<z.ZodNumber>;
        max_quantity: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        currency_code: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        type: z.ZodOptional<z.ZodEnum<typeof ApplicationMethodType>>;
        target_type: z.ZodOptional<z.ZodEnum<typeof ApplicationMethodTargetType>>;
        allocation: z.ZodOptional<z.ZodEnum<typeof ApplicationMethodAllocation>>;
        apply_to_quantity: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        buy_rules_min_quantity: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    }, z.core.$strict>>;
    limit: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
}, z.core.$strict>;
export declare const AdminUpdatePromotion: (additionalDataValidator?: z.ZodOptional<z.ZodNullable<z.ZodObject<any, any>>>) => z.ZodObject<any, any>;
//# sourceMappingURL=validators.d.ts.map