/**
 * @ignore
 * @featureFlag rbac
 */
export type ValidateUserPermissionsStepInput = {
    actor_id: string;
    actor?: string;
    policy_ids?: string[];
    actions?: {
        resource: string;
        operation: string;
    }[];
};
/**
 * @ignore
 * @featureFlag rbac
 */
export declare const validateUserPermissionsStepId = "validate-user-permissions";
/**
 * Validates that a user has access to all the policies they are trying to assign.
 * A user can only create roles and add policies that they themselves have access to.
 * @ignore
 * @featureFlag rbac
 */
export declare const validateUserPermissionsStep: import("@medusajs/framework/workflows-sdk").StepFunction<ValidateUserPermissionsStepInput, unknown>;
//# sourceMappingURL=validate-user-permissions.d.ts.map