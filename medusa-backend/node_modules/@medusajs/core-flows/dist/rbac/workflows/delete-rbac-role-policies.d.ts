/**
 * @ignore
 * @featureFlag rbac
 */
export type DeleteRbacRolePoliciesWorkflowInput = {
    role_policy_ids: string[];
};
/**
 * @ignore
 * @featureFlag rbac
 */
export declare const deleteRbacRolePoliciesWorkflowId = "delete-rbac-role-policies";
/**
 * @ignore
 * @featureFlag rbac
 */
export declare const deleteRbacRolePoliciesWorkflow: import("@medusajs/framework/workflows-sdk").ReturnWorkflow<DeleteRbacRolePoliciesWorkflowInput, any, []>;
//# sourceMappingURL=delete-rbac-role-policies.d.ts.map