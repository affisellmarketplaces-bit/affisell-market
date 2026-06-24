export declare enum Entities {
    inventory_item = "inventory_item",
    inventory_level = "inventory_level"
}
export declare const defaultAdminLocationLevelFields: string[];
export declare const defaultAdminInventoryItemFields: string[];
export declare const retrieveTransformQueryConfig: {
    defaults: string[];
    isList: boolean;
    entity: Entities;
};
export declare const retrieveLocationLevelsTransformQueryConfig: {
    defaults: string[];
    isList: boolean;
    entity: Entities;
};
export declare const listLocationLevelsTransformQueryConfig: {
    isList: boolean;
    entity: Entities;
    defaults: string[];
};
export declare const listTransformQueryConfig: {
    isList: boolean;
    entity: Entities;
    defaults: string[];
};
//# sourceMappingURL=query-config.d.ts.map