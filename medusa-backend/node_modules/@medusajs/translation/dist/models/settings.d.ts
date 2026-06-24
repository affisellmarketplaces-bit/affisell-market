/**
 * @since 2.12.4
 */
declare const Settings: import("@medusajs/framework/utils").DmlEntity<import("@medusajs/framework/utils").DMLEntitySchemaBuilder<{
    id: import("@medusajs/framework/utils").PrimaryKeyModifier<string, import("@medusajs/framework/utils").IdProperty>;
    /**
     * The entity type that these settings apply to (e.g., "product", "product_variant").
     */
    entity_type: import("@medusajs/framework/utils").TextProperty;
    /**
     * The translatable fields for this entity type.
     * Array of field names that can be translated.
     *
     * @example
     * ["title", "description", "material"]
     */
    fields: import("@medusajs/framework/utils").JSONProperty;
    /**
     * Wether the entity translatable status is enabled.
     *
     * @since 2.13.0
     */
    is_active: import("@medusajs/framework/utils").BooleanProperty;
}>, "translation_settings">;
export default Settings;
//# sourceMappingURL=settings.d.ts.map