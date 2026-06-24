/**
 * @ignore
 * @featureFlag rbac
 */
export type RemoveUserRolesWorkflowInput = {
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
export declare const removeUserRolesWorkflowId = "remove-user-roles";
/**
 * This workflow removes roles from users.
 * Supports two modes:
 * - Remove multiple roles from a single user: { user_id, role_ids }
 * - Remove multiple users from a single role: { user_ids, role_id }
 * It validates that the actor has all the policies from the roles being removed.
 * @ignore
 * @featureFlag rbac
 */
export declare const removeUserRolesWorkflow: import("@medusajs/framework/workflows-sdk").ReturnWorkflow<RemoveUserRolesWorkflowInput, undefined, []>;
//# sourceMappingURL=remove-user-roles.d.ts.map