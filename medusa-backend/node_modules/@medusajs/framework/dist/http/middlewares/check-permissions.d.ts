import type { MiddlewareFunction } from "../types";
export type PolicyAction = {
    resource: string;
    operation: string | string[];
};
/**
 * Wraps a middleware or route handler with RBAC permission checking.
 * Checks if the authenticated user has the required policies before executing the handler.
 *
 * @param handler - The original middleware or route handler to wrap
 * @param policies - Single policy or array of policies to check
 * @returns Wrapped middleware or route function that checks permissions first
 */
export declare function wrapWithPoliciesCheck(handler: MiddlewareFunction, policies: PolicyAction | PolicyAction[]): MiddlewareFunction;
//# sourceMappingURL=check-permissions.d.ts.map