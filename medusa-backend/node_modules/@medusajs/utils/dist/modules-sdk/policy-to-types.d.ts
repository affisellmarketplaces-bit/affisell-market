/**
 * Generates TypeScript type definitions for RBAC Resource, Operation, and Policy.
 * Creates two files:
 * - "policy-types.d.ts" - Ambient type declarations with global types
 * - "policy-bindings.d.ts" - Module augmentation for @medusajs/framework/utils
 *
 * @param outputDir - Directory where the type definition files should be created
 */
export declare function generatePolicyTypes({ outputDir, }: {
    outputDir: string;
}): Promise<void>;
//# sourceMappingURL=policy-to-types.d.ts.map