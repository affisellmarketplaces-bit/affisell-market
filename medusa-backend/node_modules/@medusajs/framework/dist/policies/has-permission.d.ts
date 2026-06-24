import { MedusaContainer } from "@medusajs/types";
export type PermissionAction = {
    resource: string;
    operation: string | string[];
};
export type HasPermissionInput = {
    roles: string | string[];
    actions: PermissionAction | PermissionAction[];
    container: MedusaContainer;
};
export type ResolvePermissionsInput = {
    roles: string | string[];
    /**
     * The universe of `(resource, operation)` tuples to evaluate against the
     * actor's policies. The result is the subset of this universe that the
     * actor is granted, with wildcards (`*:*`, `*:op`, `resource:*`) expanded.
     */
    universe: {
        resource: string;
        operation: string;
    }[];
    container: MedusaContainer;
};
/**
 * Checks if the given role(s) have permission to perform the specified action(s).
 *
 * @param input - The input containing roles, actions, and container
 * @returns true if all actions are permitted, false otherwise
 *
 * @example
 * ```ts
 * const canWrite = await hasPermission({
 *   roles: ['role_123'],
 *   actions: { resource: 'product', operation: 'write' },
 *   container
 * })
 *
 * const canDeleteAndWrite = await hasPermission({
 *   roles: ['role_123'],
 *   actions: { resource: 'product', operation: ['delete', 'write'] },
 *   container
 * })
 * ```
 */
export declare function hasPermission(input: HasPermissionInput): Promise<boolean>;
/**
 * Resolves the actor's effective permission set: the subset of `universe` that
 * the actor is granted, with wildcards expanded against concrete entries.
 *
 * This is the "inverse" of {@link hasPermission}. It is intended for use by
 * endpoints that need to hand the client a flat permission list (so the client
 * can do literal lookups instead of duplicating wildcard semantics).
 *
 * @example
 * ```ts
 * const granted = await resolvePermissions({
 *   roles: ["role_super_admin"],
 *   universe: [
 *     { resource: "product", operation: "read" },
 *     { resource: "customer", operation: "create" },
 *   ],
 *   container,
 * })
 * // granted = Set { "product:read", "customer:create" }
 * ```
 */
export declare function resolvePermissions(input: ResolvePermissionsInput): Promise<Set<string>>;
//# sourceMappingURL=has-permission.d.ts.map