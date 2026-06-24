"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ENTITY_OVERRIDES = exports.ROUTE_TO_ENTITY_MAP = exports.EntityOverrideRegistry = exports.BUILTIN_ENTITY_OVERRIDES = void 0;
exports.getEntityOverrideRegistry = getEntityOverrideRegistry;
exports.resetEntityOverrideRegistry = resetEntityOverrideRegistry;
exports.getEntityOverride = getEntityOverride;
exports.hasEntityOverride = hasEntityOverride;
exports.getFieldFilterRules = getFieldFilterRules;
exports.getDefaultVisibleFields = getDefaultVisibleFields;
exports.getFieldOrdering = getFieldOrdering;
exports.getAdditionalTypes = getAdditionalTypes;
exports.getNonFilterableFields = getNonFilterableFields;
exports.entityNameFromRoute = entityNameFromRoute;
/**
 * Built-in entity overrides for core Medusa entities.
 * These provide backward compatibility and sensible defaults.
 */
exports.BUILTIN_ENTITY_OVERRIDES = {
    Order: {
        excludeSuffixes: ["_link"],
        excludePrefixes: ["raw_"],
        excludeFields: ["order_change"],
        additionalTypes: ["OrderDetail"],
        defaultVisibleFields: [
            "display_id",
            "created_at",
            "payment_status",
            "fulfillment_status",
            "total",
            "customer_display",
            "country",
            "sales_channel.name",
        ],
        fieldOrdering: {
            display_id: 100,
            custom_display_id: 101,
            created_at: 200,
            customer_display: 300,
            "sales_channel.name": 400,
            fulfillment_status: 500,
            payment_status: 600,
            total: 700,
            country: 800,
        },
        nonFilterableFields: ["payment_status", "fulfillment_status"],
    },
    Product: {
        excludeSuffixes: ["_link"],
        excludePrefixes: ["raw_"],
        excludeFields: [],
        defaultVisibleFields: [
            "product_display",
            "collection.title",
            "sales_channels_display",
            "variants_count",
            "status",
        ],
        fieldOrdering: {
            product_display: 100,
            "collection.title": 200,
            sales_channels_display: 300,
            variants_count: 400,
            status: 500,
        },
    },
    Customer: {
        excludeSuffixes: ["_link"],
        excludePrefixes: ["raw_"],
        excludeFields: [],
        defaultVisibleFields: [
            "email",
            "first_name",
            "last_name",
            "created_at",
            "updated_at",
        ],
        fieldOrdering: {},
    },
    User: {
        excludeSuffixes: ["_link"],
        excludePrefixes: ["raw_"],
        excludeFields: [],
        defaultVisibleFields: [
            "email",
            "first_name",
            "last_name",
            "created_at",
            "updated_at",
        ],
        fieldOrdering: {},
    },
    Region: {
        excludeSuffixes: ["_link"],
        excludePrefixes: ["raw_"],
        excludeFields: [],
        defaultVisibleFields: ["name", "currency_code", "created_at", "updated_at"],
        fieldOrdering: {},
    },
    SalesChannel: {
        excludeSuffixes: ["_link"],
        excludePrefixes: ["raw_"],
        excludeFields: [],
        defaultVisibleFields: [
            "name",
            "description",
            "is_disabled",
            "created_at",
            "updated_at",
        ],
        fieldOrdering: {},
    },
};
/**
 * Registry for entity overrides.
 * Allows registration of custom overrides for any entity.
 */
class EntityOverrideRegistry {
    constructor() {
        this.overrides = new Map();
        // Register built-in overrides
        for (const [entityName, override] of Object.entries(exports.BUILTIN_ENTITY_OVERRIDES)) {
            this.register(entityName, override);
        }
    }
    /**
     * Register an override for an entity.
     * If an override already exists, it will be merged (new values take precedence).
     */
    register(entityName, override) {
        const existing = this.overrides.get(entityName);
        if (existing) {
            // Merge overrides - new values take precedence
            this.overrides.set(entityName, {
                excludeFields: [
                    ...(existing.excludeFields || []),
                    ...(override.excludeFields || []),
                ],
                excludeSuffixes: override.excludeSuffixes ?? existing.excludeSuffixes,
                excludePrefixes: override.excludePrefixes ?? existing.excludePrefixes,
                defaultVisibleFields: override.defaultVisibleFields ?? existing.defaultVisibleFields,
                fieldOrdering: {
                    ...(existing.fieldOrdering || {}),
                    ...(override.fieldOrdering || {}),
                },
                additionalTypes: [
                    ...(existing.additionalTypes || []),
                    ...(override.additionalTypes || []),
                ],
                nonFilterableFields: [
                    ...(existing.nonFilterableFields || []),
                    ...(override.nonFilterableFields || []),
                ],
                computedColumns: [
                    ...(existing.computedColumns || []),
                    ...(override.computedColumns || []),
                ],
            });
        }
        else {
            this.overrides.set(entityName, override);
        }
    }
    /**
     * Get the override for an entity.
     */
    get(entityName) {
        return this.overrides.get(entityName);
    }
    /**
     * Check if an entity has an override.
     */
    has(entityName) {
        return this.overrides.has(entityName);
    }
    /**
     * Get all registered entity names.
     */
    getEntityNames() {
        return Array.from(this.overrides.keys());
    }
    /**
     * Get all overrides as a record.
     */
    getAll() {
        const result = {};
        for (const [name, override] of this.overrides.entries()) {
            result[name] = override;
        }
        return result;
    }
}
exports.EntityOverrideRegistry = EntityOverrideRegistry;
// Singleton instance
let registryInstance = null;
/**
 * Get the entity override registry singleton.
 */
function getEntityOverrideRegistry() {
    if (!registryInstance) {
        registryInstance = new EntityOverrideRegistry();
    }
    return registryInstance;
}
/**
 * Reset the entity override registry (for testing purposes).
 */
function resetEntityOverrideRegistry() {
    registryInstance = null;
}
/**
 * Get the entity override for an entity name.
 * Returns undefined if no override exists.
 */
function getEntityOverride(entityName) {
    return getEntityOverrideRegistry().get(entityName);
}
/**
 * Check if an entity has custom overrides.
 */
function hasEntityOverride(entityName) {
    return getEntityOverrideRegistry().has(entityName);
}
/**
 * Get the field filter rules for an entity, merging with defaults.
 * @param entityName - The entity name (used if override is not provided)
 * @param override - Optional pre-resolved override to use instead of looking up by entity name
 */
function getFieldFilterRules(entityName, override) {
    const resolvedOverride = override ?? getEntityOverride(entityName);
    return {
        excludeSuffixes: resolvedOverride?.excludeSuffixes || ["_link"],
        excludePrefixes: resolvedOverride?.excludePrefixes || ["raw_"],
        excludeFields: resolvedOverride?.excludeFields || [],
    };
}
/**
 * Get the default visible fields for an entity.
 * @param entityName - The entity name (used if override is not provided)
 * @param override - Optional pre-resolved override to use instead of looking up by entity name
 */
function getDefaultVisibleFields(entityName, override) {
    const resolvedOverride = override ?? getEntityOverride(entityName);
    return resolvedOverride?.defaultVisibleFields || [];
}
/**
 * Get the field ordering for an entity.
 * @param entityName - The entity name (used if override is not provided)
 * @param override - Optional pre-resolved override to use instead of looking up by entity name
 */
function getFieldOrdering(entityName, override) {
    const resolvedOverride = override ?? getEntityOverride(entityName);
    return resolvedOverride?.fieldOrdering || {};
}
/**
 * Get additional types to include for an entity.
 * @param entityName - The entity name (used if override is not provided)
 * @param override - Optional pre-resolved override to use instead of looking up by entity name
 */
function getAdditionalTypes(entityName, override) {
    const resolvedOverride = override ?? getEntityOverride(entityName);
    return resolvedOverride?.additionalTypes || [];
}
/**
 * Get fields that should be displayed but not filterable for an entity.
 * @param entityName - The entity name (used if override is not provided)
 * @param override - Optional pre-resolved override to use instead of looking up by entity name
 */
function getNonFilterableFields(entityName, override) {
    const resolvedOverride = override ?? getEntityOverride(entityName);
    return resolvedOverride?.nonFilterableFields || [];
}
/**
 * Map from plural/route names to entity names for backward compatibility.
 */
exports.ROUTE_TO_ENTITY_MAP = {
    orders: "Order",
    products: "Product",
    customers: "Customer",
    users: "User",
    regions: "Region",
    "sales-channels": "SalesChannel",
};
/**
 * Get the entity name from a route/plural name.
 */
function entityNameFromRoute(routeName) {
    return exports.ROUTE_TO_ENTITY_MAP[routeName];
}
/**
 * @deprecated Use `getEntityOverrideRegistry()` instead.
 * Backward compatibility export - returns a snapshot of current overrides.
 */
exports.ENTITY_OVERRIDES = exports.BUILTIN_ENTITY_OVERRIDES;
//# sourceMappingURL=entity-overrides.js.map