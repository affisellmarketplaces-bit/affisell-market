export declare enum Entities {
    user = "user",
    rbac_role = "rbac_role"
}
export declare const defaultAdminUserFields: string[];
export declare const retrieveTransformQueryConfig: {
    defaults: string[];
    isList: boolean;
    entity: Entities;
};
export declare const listTransformQueryConfig: {
    isList: boolean;
    entity: Entities;
    defaults: string[];
};
export declare const defaultAdminUserRolesFields: string[];
export declare const listUserRolesTransformQueryConfig: {
    defaults: string[];
    isList: boolean;
    entity: Entities;
};
//# sourceMappingURL=query-config.d.ts.map