/**
 * @ignore
 * @featureFlag rbac
 */
export type ValidateUserRolePermissionsStepInput = {
    actor_id: string;
    actor?: string;
    role_ids: string[];
};
/**
 * @ignore
 * @featureFlag rbac
 */
export declare const validateUserRolePermissionsStepId = "validate-user-role-permissions";
/**
 * Validates that the actor has all the policies from the roles being assigned.
 * A user can only assign roles whose policies they themselves have.
 * @ignore
 * @featureFlag rbac
 */
export declare const validateUserRolePermissionsStep: import("@medusajs/framework/workflows-sdk").StepFunction<ValidateUserRolePermissionsStepInput, undefined>;
//# sourceMappingURL=validate-user-role-permissions.d.ts.map