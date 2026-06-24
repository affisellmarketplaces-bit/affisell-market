/**
 * @ignore
 * @featureFlag rbac
 */
export type CreateRbacPoliciesWorkflowInput = {
    policies: any[];
};
/**
 * @ignore
 * @featureFlag rbac
 */
export declare const createRbacPoliciesWorkflowId = "create-rbac-policies";
/**
 * @ignore
 * @featureFlag rbac
 */
export declare const createRbacPoliciesWorkflow: import("@medusajs/framework/workflows-sdk").ReturnWorkflow<CreateRbacPoliciesWorkflowInput, import("@medusajs/types").RbacPolicyDTO[], []>;
//# sourceMappingURL=create-rbac-policies.d.ts.map