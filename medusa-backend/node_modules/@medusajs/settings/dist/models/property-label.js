"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PropertyLabel = void 0;
const utils_1 = require("@medusajs/framework/utils");
/**
 * PropertyLabel stores custom display labels for entity properties.
 * Labels are global (shared across all admin users) and provide
 * consistent terminology throughout the admin interface.
 */
exports.PropertyLabel = utils_1.model
    .define("property_label", {
    id: utils_1.model.id({ prefix: "plbl" }).primaryKey(),
    /**
     * The entity this label applies to (e.g., "Order", "Product")
     */
    entity: utils_1.model.text().searchable(),
    /**
     * The property path (e.g., "display_id", "customer.email")
     */
    property: utils_1.model.text().searchable(),
    /**
     * Custom display name for the property
     */
    label: utils_1.model.text().translatable(),
    /**
     * Optional description providing context about the property
     */
    description: utils_1.model.text().translatable().nullable(),
})
    .indexes([
    {
        on: ["entity", "property"],
        unique: true,
    },
    {
        on: ["entity"],
    },
]);
//# sourceMappingURL=property-label.js.map