export declare const ViewConfiguration: import("@medusajs/framework/utils").DmlEntity<import("@medusajs/framework/utils").DMLEntitySchemaBuilder<{
    id: import("@medusajs/framework/utils").PrimaryKeyModifier<string, import("@medusajs/framework/utils").IdProperty>;
    entity: import("@medusajs/framework/utils").TextProperty;
    name: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
    user_id: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
    is_system_default: import("@medusajs/framework/utils").BooleanProperty;
    configuration: import("@medusajs/framework/utils").JSONProperty;
}>, "view_configuration">;
//# sourceMappingURL=view-configuration.d.ts.map