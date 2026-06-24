declare const Locale: import("@medusajs/framework/utils").DmlEntity<import("@medusajs/framework/utils").DMLEntitySchemaBuilder<{
    id: import("@medusajs/framework/utils").PrimaryKeyModifier<string, import("@medusajs/framework/utils").IdProperty>;
    /**
     * The BCP 47 language tag code of the locale (e.g., "en-US", "da-DK").
     */
    code: import("@medusajs/framework/utils").TextProperty;
    /**
     * The human-readable name of the locale (e.g., "English (US)", "Danish").
     */
    name: import("@medusajs/framework/utils").TextProperty;
}>, "locale">;
export default Locale;
//# sourceMappingURL=locale.d.ts.map