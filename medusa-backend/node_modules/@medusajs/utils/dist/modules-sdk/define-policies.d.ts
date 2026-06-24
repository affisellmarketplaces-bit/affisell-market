export declare const MedusaPolicySymbol: unique symbol;
/**
 * The single character used as the RBAC wildcard across both resource and
 * operation slots. All RBAC code that needs to read, write, or compare the
 * wildcard should import this constant.
 */
export declare const WILDCARD = "*";
export interface PolicyDefinition {
    name: string;
    resource: string;
    operation: string;
    description?: string;
}
export interface definePoliciesExport {
    [MedusaPolicySymbol]: boolean;
    policies: PolicyDefinition[];
}
type DefaultPolicyResources = Record<string, string>;
/**
 * Global registry for all unique resources.
 */
declare const PolicyResource: DefaultPolicyResources & Record<string, string>;
declare const PolicyOperation: Record<string, string> & {
    readonly read: "read";
    readonly create: "create";
    readonly update: "update";
    readonly delete: "delete";
    readonly "*": "*";
    readonly ALL: "*";
};
declare const Policy: Record<string, {
    resource: string;
    operation: string;
    description?: string;
}>;
/**
 * Define RBAC policies that will be automatically synced to the database
 * when the application starts.
 *
 * @param policies - Single policy or array of policy definitions
 *
 * @example
 * ```ts
 * definePolicies({
 *   name: "ReadBrands",
 *   resource: "brand",
 *   operation: "read"
 *   description: "Read brands"
 * })
 *
 * definePolicies([
 *   {
 *     name: "ReadBrands",
 *     resource: "brand",
 *     operation: "read"
 *   },
 *   {
 *     name: "CreateBrands",
 *     resource: "brand",
 *     operation: "create"
 *   }
 * ])
 * ```
 */
export declare function definePolicies(policies: PolicyDefinition | PolicyDefinition[]): definePoliciesExport;
export { Policy, PolicyOperation, PolicyResource };
//# sourceMappingURL=define-policies.d.ts.map