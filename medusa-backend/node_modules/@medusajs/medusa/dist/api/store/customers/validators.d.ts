import { z } from "@medusajs/framework/zod";
export declare const StoreGetCustomerParams: z.ZodObject<{
    fields: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const StoreCreateCustomer: z.ZodObject<{
    email: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    company_name: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    first_name: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    last_name: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    phone: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    metadata: z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
}, z.core.$strip>;
export declare const StoreUpdateCustomer: z.ZodObject<{
    company_name: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    first_name: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    last_name: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    phone: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    metadata: z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
}, z.core.$strip>;
export declare const StoreGetCustomerAddressParams: z.ZodObject<{
    fields: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const StoreCreateCustomerAddress: z.ZodObject<{
    first_name: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    last_name: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    phone: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    company: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    address_1: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    address_2: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    city: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    country_code: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    province: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    postal_code: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    metadata: z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
    address_name: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    is_default_shipping: z.ZodOptional<z.ZodBoolean>;
    is_default_billing: z.ZodOptional<z.ZodBoolean>;
}, z.core.$strip>;
export declare const StoreUpdateCustomerAddress: z.ZodObject<{
    first_name: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    last_name: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    phone: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    company: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    address_1: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    address_2: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    city: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    country_code: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    province: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    postal_code: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    metadata: z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
    address_name: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    is_default_shipping: z.ZodOptional<z.ZodBoolean>;
    is_default_billing: z.ZodOptional<z.ZodBoolean>;
}, z.core.$strip>;
export declare const StoreGetCustomerAddressesParams: z.ZodObject<{
    fields: z.ZodOptional<z.ZodString>;
    offset: z.ZodPipe<z.ZodTransform<unknown, unknown>, z.ZodDefault<z.ZodOptional<z.ZodNumber>>>;
    limit: z.ZodPipe<z.ZodTransform<unknown, unknown>, z.ZodDefault<z.ZodOptional<z.ZodNumber>>>;
    order: z.ZodOptional<z.ZodString> | z.ZodDefault<z.ZodOptional<z.ZodString>>;
    with_deleted: z.ZodPipe<z.ZodTransform<unknown, unknown>, z.ZodOptional<z.ZodBoolean>>;
    q: z.ZodOptional<z.ZodString>;
    city: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>;
    country_code: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>;
    postal_code: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>;
}, z.core.$strip>;
export type StoreGetCustomerParamsType = z.infer<typeof StoreGetCustomerParams>;
export type StoreCreateCustomerType = z.infer<typeof StoreCreateCustomer>;
export type StoreUpdateCustomerType = z.infer<typeof StoreUpdateCustomer>;
export type StoreGetCustomerAddressParamsType = z.infer<typeof StoreGetCustomerAddressParams>;
export type StoreGetCustomerAddressesParamsType = z.infer<typeof StoreGetCustomerAddressesParams>;
export type StoreCreateCustomerAddressType = z.infer<typeof StoreCreateCustomerAddress>;
export type StoreUpdateCustomerAddressType = z.infer<typeof StoreUpdateCustomerAddress>;
//# sourceMappingURL=validators.d.ts.map