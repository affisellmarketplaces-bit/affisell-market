"use strict";
/**
 * Relationship filter configuration utilities.
 * Configures dropdown filters for relationship fields.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.RELATIONSHIP_FILTER_OVERRIDES = exports.ENTITY_ENDPOINT_MAP = void 0;
exports.inferOptionsEndpoint = inferOptionsEndpoint;
exports.getRelationshipFilterConfig = getRelationshipFilterConfig;
const utils_1 = require("@medusajs/framework/utils");
const entity_discovery_1 = require("./entity-discovery");
/**
 * Maps entity names to their admin API endpoints.
 *
 * Most endpoints follow the convention: EntityName → /admin/{kebab-case-plural}
 * e.g., SalesChannel → /admin/sales-channels
 *
 * Only entities that DON'T follow this convention need to be listed here.
 * The `inferOptionsEndpoint` function will auto-generate endpoints for unlisted entities.
 */
exports.ENTITY_ENDPOINT_MAP = {
    // ProductCollection uses /admin/collections instead of /admin/product-collections
    ProductCollection: "/admin/collections",
};
/**
 * Infer the API endpoint for fetching filter options.
 */
function inferOptionsEndpoint(entityName) {
    if (exports.ENTITY_ENDPOINT_MAP[entityName]) {
        return exports.ENTITY_ENDPOINT_MAP[entityName];
    }
    // Auto-generate: "SalesChannel" → "/admin/sales-channels"
    return `/admin/${(0, entity_discovery_1.toKebabCasePlural)(entityName)}`;
}
/**
 * Built-in relationship filter configurations for known entities.
 */
exports.RELATIONSHIP_FILTER_OVERRIDES = {
    Product: [
        {
            field: "sales_channels",
            relatedEntity: "SalesChannel",
            valueField: "id",
            displayField: "name",
            multiple: true,
        },
        {
            field: "collection",
            relatedEntity: "ProductCollection",
            valueField: "id",
            displayField: "title",
            multiple: false,
        },
        {
            field: "type",
            relatedEntity: "ProductType",
            valueField: "id",
            displayField: "value",
            multiple: false,
        },
        {
            field: "tags",
            relatedEntity: "ProductTag",
            valueField: "id",
            displayField: "value",
            multiple: true,
        },
    ],
    Order: [
        {
            field: "region",
            relatedEntity: "Region",
            valueField: "id",
            displayField: "name",
            multiple: false,
        },
    ],
    Customer: [
        {
            field: "groups",
            relatedEntity: "CustomerGroup",
            valueField: "id",
            displayField: "name",
            multiple: true,
        },
    ],
};
/**
 * Preferred display field names, in order of priority.
 * Used when inferring the display field from the schema.
 */
const PREFERRED_DISPLAY_FIELDS = [
    "name",
    "title",
    "value",
    "label",
    "email",
    "display_id",
    "display_name",
];
/**
 * Infer the best display field from an entity's GraphQL type.
 * Looks for string fields, preferring known display field names.
 */
function inferDisplayField(relatedEntityName, schemaTypeMap) {
    const defaultField = "name";
    if (!schemaTypeMap) {
        return defaultField;
    }
    const relatedType = schemaTypeMap[relatedEntityName];
    if (!relatedType || !(relatedType instanceof utils_1.GraphQLObjectType)) {
        return defaultField;
    }
    const fields = relatedType.getFields();
    const stringFields = [];
    for (const [fieldName, fieldDef] of Object.entries(fields)) {
        const fieldType = fieldDef.type;
        const underlyingType = (0, entity_discovery_1.getUnderlyingType)(fieldType);
        // Check if it's a String scalar (not ID)
        if ((0, utils_1.isScalarType)(underlyingType) && underlyingType.name === "String") {
            stringFields.push(fieldName);
        }
    }
    // Return the first preferred field that exists, or the first string field
    const preferredMatch = PREFERRED_DISPLAY_FIELDS.find((pf) => stringFields.includes(pf));
    return preferredMatch ?? stringFields[0] ?? defaultField;
}
/**
 * Get the relationship filter configuration for a field.
 */
function getRelationshipFilterConfig(entityName, fieldName, relatedEntityName, isMultiple, schemaTypeMap) {
    // Check if we have a predefined configuration
    const entityOverrides = exports.RELATIONSHIP_FILTER_OVERRIDES[entityName];
    if (entityOverrides) {
        const override = entityOverrides.find((o) => o.field === fieldName);
        if (override) {
            return {
                entity: override.relatedEntity,
                value_field: override.valueField,
                display_field: override.displayField,
                multiple: override.multiple,
                endpoint: override.endpoint ?? inferOptionsEndpoint(override.relatedEntity),
            };
        }
    }
    // Auto-generate configuration with inferred display field
    const displayField = inferDisplayField(relatedEntityName, schemaTypeMap);
    return {
        entity: relatedEntityName,
        value_field: "id",
        display_field: displayField,
        multiple: isMultiple,
        endpoint: inferOptionsEndpoint(relatedEntityName),
    };
}
//# sourceMappingURL=relationship-filters.js.map