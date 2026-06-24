/**
 * @ignore
 * @featureFlag rbac
 */
export type AssignUserRolesWorkflowInput = {
    actor_id: string;
    actor?: string;
    user_id?: string;
    user_ids?: string[];
    role_id?: string;
    role_ids?: string[];
};
/**
 * @ignore
 * @featureFlag rbac
 */
export declare const assignUserRolesWorkflowId = "assign-user-roles";
/**
 * This workflow assigns roles to users.
 * Supports two modes:
 * - Assign multiple roles to a single user: { user_id, role_ids }
 * - Assign multiple users to a single role: { user_ids, role_id }
 * It validates that the actor has all the policies from the roles being assigned.
 * @ignore
 * @featureFlag rbac
 */
export declare const assignUserRolesWorkflow: import("@medusajs/framework/workflows-sdk").ReturnWorkflow<AssignUserRolesWorkflowInput, undefined, []>;
//# sourceMappingURL=assign-user-roles.d.ts.map