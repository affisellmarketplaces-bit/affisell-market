declare const Translation: import("@medusajs/framework/utils").DmlEntity<import("@medusajs/framework/utils").DMLEntitySchemaBuilder<{
    id: import("@medusajs/framework/utils").PrimaryKeyModifier<string, import("@medusajs/framework/utils").IdProperty>;
    /**
     * The ID of the entity that the translation belongs to. For example, the ID of a product or a product variant.
     */
    reference_id: import("@medusajs/framework/utils").TextProperty;
    /**
     * The name of the table that the translation belongs to. For example, "product" or "product_variant".
     */
    reference: import("@medusajs/framework/utils").TextProperty;
    /**
     * The BCP 47 language tag code of the locale
     *
     * @example
     * "en-US"
     */
    locale_code: import("@medusajs/framework/utils").TextProperty;
    /**
     * The translations of the entity.
     * The object's keys are the field names of the entity, and its value is the translated value.
     *
     * @example
     * {
     *   "title": "Product Title",
     *   "description": "Product Description",
     * }
     */
    translations: import("@medusajs/framework/utils").JSONProperty;
    /**
     * Precomputed count of translated fields of a resource.
     * Useful for optimization purposes.
     */
    translated_field_count: import("@medusajs/framework/utils").NumberProperty;
}>, "translation">;
export default Translation;
//# sourceMappingURL=translation.d.ts.map