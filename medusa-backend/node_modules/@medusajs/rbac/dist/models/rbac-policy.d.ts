declare const RbacPolicy: import("@medusajs/framework/utils").DmlEntity<import("@medusajs/framework/utils").DMLEntitySchemaBuilder<{
    id: import("@medusajs/framework/utils").PrimaryKeyModifier<string, import("@medusajs/framework/utils").IdProperty>;
    key: import("@medusajs/framework/utils").TextProperty;
    resource: import("@medusajs/framework/utils").TextProperty;
    operation: import("@medusajs/framework/utils").TextProperty;
    name: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
    description: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
    metadata: import("@medusajs/framework/utils").NullableModifier<Record<string, unknown>, import("@medusajs/framework/utils").JSONProperty>;
}>, "rbac_policy">;
export default RbacPolicy;
//# sourceMappingURL=rbac-policy.d.ts.map