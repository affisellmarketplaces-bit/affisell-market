export declare enum Entities {
    customer = "customer",
    customer_address = "customer_address"
}
export declare const defaultAdminCustomerFields: string[];
export declare const allowed: string[];
export declare const retrieveTransformQueryConfig: {
    defaults: string[];
    allowed: string[];
    isList: boolean;
    entity: Entities;
};
export declare const listTransformQueryConfig: {
    isList: boolean;
    entity: Entities;
    defaults: string[];
    allowed: string[];
};
export declare const defaultAdminCustomerAddressFields: string[];
export declare const retrieveAddressTransformQueryConfig: {
    defaults: string[];
    isList: boolean;
    entity: Entities;
};
export declare const listAddressesTransformQueryConfig: {
    isList: boolean;
    entity: Entities;
    defaults: string[];
};
//# sourceMappingURL=query-config.d.ts.map