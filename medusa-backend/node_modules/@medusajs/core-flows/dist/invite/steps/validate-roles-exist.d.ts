/**
 * @ignore
 * @featureFlag rbac
 */
export declare const validateRolesExistStepId = "validate-roles-exist-step";
/**
 * This step validates that the provided role IDs exist in the RBAC module.
 * Throws an error if any role is not found.
 *
 * @example
 * validateRolesExistStep(["role_123", "role_456"])
 * @ignore
 * @featureFlag rbac
 */
export declare const validateRolesExistStep: import("@medusajs/framework/workflows-sdk").StepFunction<string[], undefined>;
//# sourceMappingURL=validate-roles-exist.d.ts.map