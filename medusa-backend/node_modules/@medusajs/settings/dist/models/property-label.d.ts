/**
 * PropertyLabel stores custom display labels for entity properties.
 * Labels are global (shared across all admin users) and provide
 * consistent terminology throughout the admin interface.
 */
export declare const PropertyLabel: import("@medusajs/framework/utils").DmlEntity<import("@medusajs/framework/utils").DMLEntitySchemaBuilder<{
    id: import("@medusajs/framework/utils").PrimaryKeyModifier<string, import("@medusajs/framework/utils").IdProperty>;
    /**
     * The entity this label applies to (e.g., "Order", "Product")
     */
    entity: import("@medusajs/framework/utils").TextProperty;
    /**
     * The property path (e.g., "display_id", "customer.email")
     */
    property: import("@medusajs/framework/utils").TextProperty;
    /**
     * Custom display name for the property
     */
    label: import("@medusajs/framework/utils").TextProperty;
    /**
     * Optional description providing context about the property
     */
    description: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
}>, "property_label">;
//# sourceMappingURL=property-label.d.ts.map