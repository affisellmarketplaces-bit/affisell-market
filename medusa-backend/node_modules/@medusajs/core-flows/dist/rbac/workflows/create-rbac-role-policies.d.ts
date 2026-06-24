/**
 * @ignore
 * @featureFlag rbac
 */
export type CreateRbacRolePoliciesWorkflowInput = {
    actor_id?: string;
    actor?: string;
    policies: {
        role_id: string;
        policy_id: string;
    }[];
};
/**
 * @ignore
 * @featureFlag rbac
 */
export declare const createRbacRolePoliciesWorkflowId = "create-rbac-role-policies";
/**
 * @ignore
 * @featureFlag rbac
 */
export declare const createRbacRolePoliciesWorkflow: import("@medusajs/framework/workflows-sdk").ReturnWorkflow<CreateRbacRolePoliciesWorkflowInput, import("@medusajs/types").RbacRolePolicyDTO[], []>;
//# sourceMappingURL=create-rbac-role-policies.d.ts.map