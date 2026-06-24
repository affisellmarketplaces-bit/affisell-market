import { PricingRuleOperator, RuleOperator, ShippingOptionPriceType as ShippingOptionPriceTypeEnum } from "@medusajs/framework/utils";
import { z } from "@medusajs/framework/zod";
export type AdminGetShippingOptionParamsType = z.infer<typeof AdminGetShippingOptionParams>;
export declare const AdminGetShippingOptionParams: z.ZodObject<{
    fields: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type AdminGetShippingOptionsParamsType = z.infer<typeof AdminGetShippingOptionsParams>;
export declare const AdminGetShippingOptionsParams: z.ZodObject<{
    fields: z.ZodOptional<z.ZodString>;
    offset: z.ZodPipe<z.ZodTransform<unknown, unknown>, z.ZodDefault<z.ZodOptional<z.ZodNumber>>>;
    limit: z.ZodPipe<z.ZodTransform<unknown, unknown>, z.ZodDefault<z.ZodOptional<z.ZodNumber>>>;
    order: z.ZodOptional<z.ZodString> | z.ZodDefault<z.ZodOptional<z.ZodString>>;
    with_deleted: z.ZodPipe<z.ZodTransform<unknown, unknown>, z.ZodOptional<z.ZodBoolean>>;
    id: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>;
    q: z.ZodOptional<z.ZodString>;
    service_zone_id: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>;
    shipping_profile_id: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>;
    provider_id: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>;
    stock_location_id: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>;
    is_return: z.ZodOptional<z.ZodPipe<z.ZodUnion<readonly [z.ZodBoolean, z.ZodString]>, z.ZodTransform<boolean, string | boolean>>>;
    admin_only: z.ZodOptional<z.ZodPipe<z.ZodUnion<readonly [z.ZodBoolean, z.ZodString]>, z.ZodTransform<boolean, string | boolean>>>;
    shipping_option_type_id: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>;
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
/**
 * SHIPPING OPTIONS RULES
 */
export type AdminGetShippingOptionRuleParamsType = z.infer<typeof AdminGetShippingOptionRuleParams>;
export declare const AdminGetShippingOptionRuleParams: z.ZodObject<{
    fields: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type AdminCreateShippingOptionRuleType = z.infer<typeof AdminCreateShippingOptionRule>;
export declare const AdminCreateShippingOptionRule: z.ZodObject<{
    operator: z.ZodEnum<typeof RuleOperator>;
    attribute: z.ZodString;
    value: z.ZodUnion<[z.ZodString, z.ZodArray<z.ZodString>]>;
}, z.core.$strict>;
export type AdminUpdateShippingOptionRuleType = z.infer<typeof AdminUpdateShippingOptionRule>;
export declare const AdminUpdateShippingOptionRule: z.ZodObject<{
    id: z.ZodString;
    operator: z.ZodEnum<typeof RuleOperator>;
    attribute: z.ZodString;
    value: z.ZodUnion<[z.ZodString, z.ZodArray<z.ZodString>]>;
}, z.core.$strict>;
/**
 * SHIPPING OPTIONS
 */
export declare const AdminCreateShippingOptionTypeObject: z.ZodObject<{
    label: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    code: z.ZodString;
}, z.core.$strict>;
export declare const AdminCreateShippingOptionPriceWithCurrency: z.ZodObject<{
    currency_code: z.ZodString;
    amount: z.ZodNumber;
    rules: z.ZodOptional<z.ZodArray<z.ZodObject<{
        attribute: z.ZodLiteral<"item_total">;
        operator: z.ZodEnum<typeof PricingRuleOperator>;
        value: z.ZodNumber;
    }, z.core.$strip>>>;
}, z.core.$strict>;
export declare const AdminCreateShippingOptionPriceWithRegion: z.ZodObject<{
    region_id: z.ZodString;
    amount: z.ZodNumber;
    rules: z.ZodOptional<z.ZodArray<z.ZodObject<{
        attribute: z.ZodLiteral<"item_total">;
        operator: z.ZodEnum<typeof PricingRuleOperator>;
        value: z.ZodNumber;
    }, z.core.$strip>>>;
}, z.core.$strict>;
export declare const AdminUpdateShippingOptionPriceWithCurrency: z.ZodObject<{
    id: z.ZodOptional<z.ZodString>;
    currency_code: z.ZodOptional<z.ZodString>;
    amount: z.ZodOptional<z.ZodNumber>;
    rules: z.ZodOptional<z.ZodArray<z.ZodObject<{
        attribute: z.ZodLiteral<"item_total">;
        operator: z.ZodEnum<typeof PricingRuleOperator>;
        value: z.ZodNumber;
    }, z.core.$strip>>>;
}, z.core.$strict>;
export declare const AdminUpdateShippingOptionPriceWithRegion: z.ZodObject<{
    id: z.ZodOptional<z.ZodString>;
    region_id: z.ZodOptional<z.ZodString>;
    amount: z.ZodOptional<z.ZodNumber>;
    rules: z.ZodOptional<z.ZodArray<z.ZodObject<{
        attribute: z.ZodLiteral<"item_total">;
        operator: z.ZodEnum<typeof PricingRuleOperator>;
        value: z.ZodNumber;
    }, z.core.$strip>>>;
}, z.core.$strict>;
export declare const AdminCreateShippingOption: z.ZodObject<{
    name: z.ZodString;
    service_zone_id: z.ZodString;
    shipping_profile_id: z.ZodString;
    data: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    price_type: z.ZodEnum<typeof ShippingOptionPriceTypeEnum>;
    provider_id: z.ZodString;
    type: z.ZodOptional<z.ZodObject<{
        label: z.ZodString;
        description: z.ZodOptional<z.ZodString>;
        code: z.ZodString;
    }, z.core.$strict>>;
    type_id: z.ZodOptional<z.ZodString>;
    prices: z.ZodArray<z.ZodUnion<[z.ZodObject<{
        currency_code: z.ZodString;
        amount: z.ZodNumber;
        rules: z.ZodOptional<z.ZodArray<z.ZodObject<{
            attribute: z.ZodLiteral<"item_total">;
            operator: z.ZodEnum<typeof PricingRuleOperator>;
            value: z.ZodNumber;
        }, z.core.$strip>>>;
    }, z.core.$strict>, z.ZodObject<{
        region_id: z.ZodString;
        amount: z.ZodNumber;
        rules: z.ZodOptional<z.ZodArray<z.ZodObject<{
            attribute: z.ZodLiteral<"item_total">;
            operator: z.ZodEnum<typeof PricingRuleOperator>;
            value: z.ZodNumber;
        }, z.core.$strip>>>;
    }, z.core.$strict>]>>;
    rules: z.ZodOptional<z.ZodArray<z.ZodObject<{
        operator: z.ZodEnum<typeof RuleOperator>;
        attribute: z.ZodString;
        value: z.ZodUnion<[z.ZodString, z.ZodArray<z.ZodString>]>;
    }, z.core.$strict>>>;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, z.core.$strict>;
export type AdminUpdateShippingOptionType = z.infer<typeof AdminUpdateShippingOption>;
export declare const AdminUpdateShippingOption: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    data: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    price_type: z.ZodOptional<z.ZodEnum<typeof ShippingOptionPriceTypeEnum>>;
    provider_id: z.ZodOptional<z.ZodString>;
    shipping_profile_id: z.ZodOptional<z.ZodString>;
    type: z.ZodOptional<z.ZodObject<{
        label: z.ZodString;
        description: z.ZodOptional<z.ZodString>;
        code: z.ZodString;
    }, z.core.$strict>>;
    type_id: z.ZodOptional<z.ZodString>;
    prices: z.ZodOptional<z.ZodArray<z.ZodUnion<[z.ZodObject<{
        id: z.ZodOptional<z.ZodString>;
        currency_code: z.ZodOptional<z.ZodString>;
        amount: z.ZodOptional<z.ZodNumber>;
        rules: z.ZodOptional<z.ZodArray<z.ZodObject<{
            attribute: z.ZodLiteral<"item_total">;
            operator: z.ZodEnum<typeof PricingRuleOperator>;
            value: z.ZodNumber;
        }, z.core.$strip>>>;
    }, z.core.$strict>, z.ZodObject<{
        id: z.ZodOptional<z.ZodString>;
        region_id: z.ZodOptional<z.ZodString>;
        amount: z.ZodOptional<z.ZodNumber>;
        rules: z.ZodOptional<z.ZodArray<z.ZodObject<{
            attribute: z.ZodLiteral<"item_total">;
            operator: z.ZodEnum<typeof PricingRuleOperator>;
            value: z.ZodNumber;
        }, z.core.$strip>>>;
    }, z.core.$strict>]>>>;
    rules: z.ZodOptional<z.ZodArray<z.ZodUnion<[z.ZodObject<{
        id: z.ZodString;
        operator: z.ZodEnum<typeof RuleOperator>;
        attribute: z.ZodString;
        value: z.ZodUnion<[z.ZodString, z.ZodArray<z.ZodString>]>;
    }, z.core.$strict>, z.ZodObject<{
        operator: z.ZodEnum<typeof RuleOperator>;
        attribute: z.ZodString;
        value: z.ZodUnion<[z.ZodString, z.ZodArray<z.ZodString>]>;
    }, z.core.$strict>]>>>;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, z.core.$strict>;
//# sourceMappingURL=validators.d.ts.map