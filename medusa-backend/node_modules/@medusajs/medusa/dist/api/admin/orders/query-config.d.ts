export declare enum Entities {
    order = "order",
    fulfillment = "fulfillment",
    credit_line = "credit_line"
}
export declare const defaultAdminOrderFields: string[];
export declare const defaultAdminRetrieveOrderFields: string[];
export declare const defaultAdminRetrieveOrderChangesFields: string[];
export declare const defaultAdminOrderItemsFields: string[];
export declare const retrieveTransformQueryConfig: {
    defaults: string[];
    isList: boolean;
    entity: Entities;
};
export declare const listTransformQueryConfig: {
    defaults: string[];
    defaultLimit: number;
    isList: boolean;
    entity: Entities;
};
export declare const retrieveOrderChangesTransformQueryConfig: {
    defaults: string[];
    isList: boolean;
};
export declare const listOrderItemsQueryConfig: {
    defaults: string[];
    defaultLimit: number;
    isList: boolean;
};
export declare const listShippingOptionsQueryConfig: {
    defaultLimit: number;
    isList: boolean;
};
export declare const defaultAdminExportOrderFields: string[];
export declare const exportTransformQueryConfig: {
    defaults: string[];
    isList: boolean;
    entity: Entities;
};
//# sourceMappingURL=query-config.d.ts.map