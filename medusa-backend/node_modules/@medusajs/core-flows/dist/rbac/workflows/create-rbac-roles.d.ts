/**
 * @ignore
 * @featureFlag rbac
 */
export type CreateRbacRolesWorkflowInput = {
    actor_id?: string;
    actor?: string;
    roles: {
        name: string;
        description?: string | null;
        metadata?: Record<string, unknown> | null;
        parent_ids?: string[];
        policy_ids?: string[];
    }[];
};
/**
 * @ignore
 * @featureFlag rbac
 */
export declare const createRbacRolesWorkflowId = "create-rbac-roles";
/**
 * @ignore
 * @featureFlag rbac
 */
export declare const createRbacRolesWorkflow: import("@medusajs/framework/workflows-sdk").ReturnWorkflow<CreateRbacRolesWorkflowInput, import("@medusajs/types").RbacRoleDTO[], []>;
//# sourceMappingURL=create-rbac-roles.d.ts.map