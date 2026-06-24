import { RbacModuleService } from "./services";
declare const _default: import("@medusajs/types").ModuleExports<typeof RbacModuleService> & {
    linkable: {
        readonly rbacRole: {
            id: {
                serviceName: "rbac";
                field: "rbacRole";
                linkable: "rbac_role_id";
                primaryKey: "id";
            };
            toJSON: () => {
                serviceName: "rbac";
                field: "rbacRole";
                linkable: "rbac_role_id";
                primaryKey: "id";
            };
        };
        readonly rbacPolicy: {
            id: {
                serviceName: "rbac";
                field: "rbacPolicy";
                linkable: "rbac_policy_id";
                primaryKey: "id";
            };
            toJSON: () => {
                serviceName: "rbac";
                field: "rbacPolicy";
                linkable: "rbac_policy_id";
                primaryKey: "id";
            };
        };
        readonly rbacRoleParent: {
            id: {
                serviceName: "rbac";
                field: "rbacRoleParent";
                linkable: "rbac_role_parent_id";
                primaryKey: "id";
            };
            toJSON: () => {
                serviceName: "rbac";
                field: "rbacRoleParent";
                linkable: "rbac_role_parent_id";
                primaryKey: "id";
            };
        };
        readonly rbacRolePolicy: {
            id: {
                serviceName: "rbac";
                field: "rbacRolePolicy";
                linkable: "rbac_role_policy_id";
                primaryKey: "id";
            };
            toJSON: () => {
                serviceName: "rbac";
                field: "rbacRolePolicy";
                linkable: "rbac_role_policy_id";
                primaryKey: "id";
            };
        };
    };
};
export default _default;
//# sourceMappingURL=index.d.ts.map