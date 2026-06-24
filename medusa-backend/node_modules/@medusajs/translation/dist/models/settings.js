"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const utils_1 = require("@medusajs/framework/utils");
/**
 * @since 2.12.4
 */
const Settings = utils_1.model
    .define("translation_settings", {
    id: utils_1.model.id({ prefix: "trset" }).primaryKey(),
    /**
     * The entity type that these settings apply to (e.g., "product", "product_variant").
     */
    entity_type: utils_1.model.text().searchable(),
    /**
     * The translatable fields for this entity type.
     * Array of field names that can be translated.
     *
     * @example
     * ["title", "description", "material"]
     */
    fields: utils_1.model.json(),
    /**
     * Wether the entity translatable status is enabled.
     *
     * @since 2.13.0
     */
    is_active: utils_1.model.boolean().default(true),
})
    .indexes([
    {
        on: ["entity_type"],
        unique: true,
    },
]);
exports.default = Settings;
//# sourceMappingURL=settings.js.map