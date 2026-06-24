"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isNonNullType = exports.isListType = exports.EntityDiscoveryService = void 0;
exports.toKebabCasePlural = toKebabCasePlural;
exports.getUnderlyingType = getUnderlyingType;
exports.isArrayField = isArrayField;
exports.isSingleRelationship = isSingleRelationship;
const utils_1 = require("@medusajs/framework/utils");
Object.defineProperty(exports, "isListType", { enumerable: true, get: function () { return utils_1.isListType; } });
Object.defineProperty(exports, "isNonNullType", { enumerable: true, get: function () { return utils_1.isNonNullType; } });
/**
 * Convert PascalCase to kebab-case with pluralization.
 */
function toKebabCasePlural(name) {
    const kebab = (0, utils_1.kebabCase)(name);
    return (0, utils_1.pluralize)(kebab);
}
/**
 * Normalize entity name to PascalCase.
 */
function normalizeEntityName(name) {
    // Handle kebab-case (e.g., "sales-channels" -> "SalesChannel")
    if (name.includes("-")) {
        return (0, utils_1.singularize)(name
            .split("-")
            .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
            .join(""));
    }
    // Handle snake_case (e.g., "sales_channel" -> "SalesChannel")
    if (name.includes("_")) {
        return (0, utils_1.singularize)(name
            .split("_")
            .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
            .join(""));
    }
    // Already PascalCase or camelCase
    return (0, utils_1.singularize)(name.charAt(0).toUpperCase() + name.slice(1));
}
/**
 * Service for discovering entities from joiner configs.
 * Unlike the API version, this service requires explicit initialization
 * with joiner configs (typically in onApplicationStart hook).
 */
class EntityDiscoveryService {
    constructor() {
        this.schemaTypeMap = null;
        this.discoveredEntities = null;
        this.joinerConfigs = [];
        this.initialized = false;
    }
    /**
     * Initialize the service with joiner configs.
     * Should be called from onApplicationStart hook.
     */
    initialize(joinerConfigs) {
        this.joinerConfigs = joinerConfigs;
        this.initialized = true;
        // Clear cache when reinitializing
        this.schemaTypeMap = null;
        this.discoveredEntities = null;
    }
    /**
     * Check if the service has been initialized.
     */
    isInitialized() {
        return this.initialized;
    }
    /**
     * Build and cache the merged schema type map.
     */
    getSchemaTypeMap() {
        if (!this.initialized) {
            return {};
        }
        if (this.schemaTypeMap) {
            return this.schemaTypeMap;
        }
        const schemaFragments = [];
        for (const config of this.joinerConfigs) {
            if (config.schema) {
                schemaFragments.push(config.schema);
            }
        }
        if (schemaFragments.length === 0) {
            return {};
        }
        const scalarDefinitions = `
      scalar DateTime
      scalar JSON
    `;
        const allSchemas = [scalarDefinitions, ...schemaFragments];
        const mergedSchemaAST = (0, utils_1.mergeTypeDefs)(allSchemas);
        const mergedSchemaString = (0, utils_1.print)(mergedSchemaAST);
        const { schema: cleanedSchemaString } = (0, utils_1.cleanGraphQLSchema)(mergedSchemaString);
        const schema = (0, utils_1.makeExecutableSchema)({
            typeDefs: cleanedSchemaString,
            resolvers: {},
        });
        this.schemaTypeMap = schema.getTypeMap();
        return this.schemaTypeMap;
    }
    /**
     * Discover all entities from joiner configs.
     * Filters out link configs and returns metadata about each entity.
     */
    discoverEntities() {
        if (!this.initialized) {
            return [];
        }
        if (this.discoveredEntities) {
            return this.discoveredEntities;
        }
        const entities = [];
        const seenTypes = new Set();
        for (const config of this.joinerConfigs) {
            // Skip link configs
            if (config.isLink) {
                continue;
            }
            // Skip if no schema
            if (!config.schema) {
                continue;
            }
            const serviceName = config.serviceName || "";
            // Extract type name from schema by finding "type <Name> {"
            const typeMatches = config.schema.matchAll(/type\s+(\w+)\s*\{/g);
            for (const match of typeMatches) {
                const typeName = match[1];
                // Skip if we've already seen this type
                if (seenTypes.has(typeName)) {
                    continue;
                }
                // Skip utility types
                if (typeName.endsWith("Link") ||
                    typeName.startsWith("_") ||
                    typeName === "Query" ||
                    typeName === "Mutation") {
                    continue;
                }
                seenTypes.add(typeName);
                entities.push({
                    name: typeName,
                    pluralName: toKebabCasePlural(typeName),
                    module: serviceName,
                    graphqlType: typeName,
                    schema: config.schema,
                    primaryKeys: config.primaryKeys || ["id"],
                    linkableKeys: config.linkableKeys || {},
                });
            }
        }
        this.discoveredEntities = entities;
        return entities;
    }
    /**
     * Get an entity by name.
     * Supports PascalCase, kebab-case, snake_case, and plural forms.
     */
    getEntity(name) {
        const entities = this.discoverEntities();
        // Try direct match on name
        let entity = entities.find((e) => e.name.toLowerCase() === name.toLowerCase());
        if (entity) {
            return entity;
        }
        // Try plural name match
        entity = entities.find((e) => e.pluralName.toLowerCase() === name.toLowerCase());
        if (entity) {
            return entity;
        }
        // Try normalizing the input name
        const normalized = normalizeEntityName(name);
        entity = entities.find((e) => e.name.toLowerCase() === normalized.toLowerCase());
        if (entity) {
            return entity;
        }
        return null;
    }
    /**
     * Check if an entity exists by name.
     */
    hasEntity(name) {
        return this.getEntity(name) !== null;
    }
    /**
     * Get the GraphQL type for an entity.
     */
    getEntityType(entityName) {
        const entity = this.getEntity(entityName);
        if (!entity) {
            return null;
        }
        const schemaTypeMap = this.getSchemaTypeMap();
        return schemaTypeMap[entity.graphqlType];
    }
    /**
     * Get fields for an entity type.
     */
    getEntityFields(entityName) {
        const entity = this.getEntity(entityName);
        if (!entity) {
            return [];
        }
        const schemaTypeMap = this.getSchemaTypeMap();
        return (0, utils_1.graphqlSchemaToFields)(schemaTypeMap, entity.graphqlType, []);
    }
    /**
     * Get entity info for the API response.
     */
    getEntityInfo(entity, hasOverrides) {
        const schemaTypeMap = this.getSchemaTypeMap();
        const entityType = schemaTypeMap[entity.graphqlType];
        const fieldCount = entityType?.getFields
            ? Object.keys(entityType.getFields()).length
            : 0;
        return {
            name: entity.name,
            pluralName: entity.pluralName,
            module: entity.module,
            propertyCount: fieldCount,
            hasOverrides,
        };
    }
    /**
     * Clear the cache (useful for testing).
     */
    clearCache() {
        this.schemaTypeMap = null;
        this.discoveredEntities = null;
    }
}
exports.EntityDiscoveryService = EntityDiscoveryService;
/**
 * Helper to get the underlying type from wrapped types (NonNull, List).
 */
function getUnderlyingType(type) {
    if (type.ofType) {
        return getUnderlyingType(type.ofType);
    }
    return type;
}
/**
 * Helper to check if a field type is an array/list.
 */
function isArrayField(type) {
    if ((0, utils_1.isListType)(type)) {
        return true;
    }
    if ((0, utils_1.isNonNullType)(type)) {
        return isArrayField(type.ofType);
    }
    return false;
}
/**
 * Helper to check if a field is a single relationship (many-to-one, one-to-one).
 */
function isSingleRelationship(type) {
    if (isArrayField(type)) {
        return false;
    }
    const underlyingType = getUnderlyingType(type);
    return underlyingType instanceof utils_1.GraphQLObjectType;
}
//# sourceMappingURL=entity-discovery.js.map