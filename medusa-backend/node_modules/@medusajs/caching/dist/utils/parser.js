"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CacheInvalidationParser = void 0;
const utils_1 = require("@medusajs/framework/utils");
const graphql_1 = require("graphql");
class CacheInvalidationParser {
    constructor(schema, joinerConfigs) {
        this.typeMap = new Map();
        // Build type map for quick lookups
        const schemaTypeMap = schema.getTypeMap();
        Object.keys(schemaTypeMap).forEach((typeName) => {
            const type = schemaTypeMap[typeName];
            if ((0, graphql_1.isObjectType)(type) && !typeName.startsWith("__")) {
                this.typeMap.set(typeName, type);
            }
        });
        this.idPrefixToEntityName = joinerConfigs.reduce((acc, joinerConfig) => {
            if (joinerConfig.idPrefixToEntityName) {
                Object.entries(joinerConfig.idPrefixToEntityName).forEach(([idPrefix, entityName]) => {
                    acc[idPrefix] = entityName;
                });
            }
            return acc;
        }, {});
    }
    /**
     * Parse an object to identify entities and their relationships
     */
    parseObjectForEntities(obj, parentType, isInArray = false) {
        const entities = [];
        if (!obj || typeof obj !== "object") {
            return entities;
        }
        // Check if this object matches any known GraphQL types
        const detectedType = this.detectEntityType(obj, parentType);
        if (detectedType && obj.id) {
            entities.push({
                type: detectedType,
                id: obj.id,
                isInArray,
            });
        }
        // Recursively parse nested objects and arrays
        Object.keys(obj).forEach((key) => {
            const value = obj[key];
            if (Array.isArray(value)) {
                value.forEach((item) => {
                    entities.push(...this.parseObjectForEntities(item, this.getRelationshipType(detectedType, key), true));
                });
            }
            else if ((0, utils_1.isObject)(value)) {
                entities.push(...this.parseObjectForEntities(value, this.getRelationshipType(detectedType, key), false));
            }
        });
        return entities;
    }
    /**
     * Detect entity type based on object structure and GraphQL type map
     */
    detectEntityType(obj, suggestedType) {
        if (obj.id) {
            const idParts = obj.id.split("_");
            if (idParts.length > 1 && this.idPrefixToEntityName[idParts[0]]) {
                return this.idPrefixToEntityName[idParts[0]];
            }
        }
        if (suggestedType && this.typeMap.has(suggestedType)) {
            const type = this.typeMap.get(suggestedType);
            if (this.objectMatchesType(obj, type)) {
                return suggestedType;
            }
        }
        // Try to match against all known types
        for (const [typeName, type] of this.typeMap) {
            if (this.objectMatchesType(obj, type)) {
                return typeName;
            }
        }
        return null;
    }
    /**
     * Check if object structure matches GraphQL type fields
     */
    objectMatchesType(obj, type) {
        const fields = type.getFields();
        const objKeys = Object.keys(obj);
        // Must have id field for entities
        if (!obj.id || !fields.id) {
            return false;
        }
        // Check if at least 50% of non-null object fields match type fields
        const matchingFields = objKeys.filter((key) => fields[key]).length;
        return matchingFields >= Math.max(1, objKeys.length * 0.5);
    }
    /**
     * Get the expected type for a relationship field
     */
    getRelationshipType(parentType, fieldName) {
        if (!parentType || !this.typeMap.has(parentType)) {
            return undefined;
        }
        const type = this.typeMap.get(parentType);
        const field = type.getFields()[fieldName];
        if (!field) {
            return undefined;
        }
        let fieldType = field.type;
        // Unwrap NonNull and List wrappers
        if ((0, graphql_1.isNonNullType)(fieldType)) {
            fieldType = fieldType.ofType;
        }
        if ((0, graphql_1.isListType)(fieldType)) {
            fieldType = fieldType.ofType;
        }
        if ((0, graphql_1.isNonNullType)(fieldType)) {
            fieldType = fieldType.ofType;
        }
        if ((0, graphql_1.isObjectType)(fieldType)) {
            return fieldType.name;
        }
        return undefined;
    }
    /**
     * Build invalidation events based on parsed entities
     */
    buildInvalidationEvents(entities, operation = "updated") {
        const events = [];
        const processedEntities = new Set();
        entities.forEach((entity) => {
            const entityKey = `${entity.type}:${entity.id}`;
            if (processedEntities.has(entityKey)) {
                return;
            }
            processedEntities.add(entityKey);
            const relatedEntities = entities.filter((e) => e.type !== entity.type || e.id !== entity.id);
            const affectedKeys = this.buildAffectedCacheKeys(entity, operation);
            events.push({
                entityType: entity.type,
                entityId: entity.id,
                relatedEntities,
                cacheKeys: affectedKeys,
            });
        });
        return events;
    }
    /**
     * Build list of cache keys that should be invalidated
     */
    buildAffectedCacheKeys(entity, operation = "updated") {
        const keys = new Set();
        keys.add(`${entity.type}:${entity.id}`);
        // Add list key only if entity was found in an array context or if an event of type created or
        // deleted is triggered
        if (entity.isInArray || ["created", "deleted"].includes(operation)) {
            keys.add(`${entity.type}:list:*`);
        }
        return Array.from(keys);
    }
}
exports.CacheInvalidationParser = CacheInvalidationParser;
//# sourceMappingURL=parser.js.map