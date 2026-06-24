"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RBACFieldFilter = void 0;
const utils_1 = require("@medusajs/framework/utils");
const modules_sdk_1 = require("@medusajs/modules-sdk");
const has_permission_1 = require("../../../policies/has-permission");
/**
 * Base GraphQL schema with common scalars
 */
const baseGraphqlSchema = `
    scalar DateTime
    scalar Date
    scalar Time
    scalar JSON
`;
const primitiveTypes = new Set([
    "String",
    "Int",
    "Float",
    "Boolean",
    "ID",
    "DateTime",
    "JSON",
]);
// Cache for the schema and entity mappings to avoid re-parsing the GraphQL
let cachedSchema = null;
let cachedEntityMap = null;
let cachedEntityAliasMap = null;
function isString(value) {
    return typeof value === "string";
}
/**
 * Makes a GraphQL schema executable
 */
function makeSchemaExecutable(inputSchema) {
    const { schema: cleanedSchema } = utils_1.GraphQLUtils.cleanGraphQLSchema(inputSchema);
    if (!cleanedSchema) {
        return;
    }
    return utils_1.GraphQLUtils.makeExecutableSchema({
        typeDefs: cleanedSchema,
    });
}
function getExecutableSchema() {
    if (cachedSchema) {
        return cachedSchema;
    }
    cachedSchema = buildExecutableSchema();
    return cachedSchema;
}
/**
 * Builds entity alias map from joiner configs
 * Maps all possible aliases (e.g., "variant", "variants") to canonical entity names (e.g., "ProductVariant")
 */
function buildEntityAliasMap() {
    const moduleJoinerConfigs = modules_sdk_1.MedusaModule.getAllJoinerConfigs();
    const aliasMap = new Map();
    for (const config of moduleJoinerConfigs) {
        if (!config.alias) {
            continue;
        }
        const aliases = Array.isArray(config.alias) ? config.alias : [config.alias];
        for (const alias of aliases) {
            const aliasNames = Array.isArray(alias.name) ? alias.name : [alias.name];
            if (!alias.entity) {
                continue;
            }
            const targetEntity = alias.entity;
            for (const aliasName of aliasNames) {
                aliasMap.set(aliasName, targetEntity);
            }
        }
    }
    return aliasMap;
}
/**
 * Gets the entity alias map, building it if necessary
 */
function getEntityAliasMap() {
    if (!cachedEntityAliasMap) {
        cachedEntityAliasMap = buildEntityAliasMap();
    }
    return cachedEntityAliasMap;
}
function getSchemaFromJoinerConfigs(moduleJoinerConfigs) {
    const schemaParts = [];
    for (const config of moduleJoinerConfigs) {
        if (!config?.schema) {
            continue;
        }
        schemaParts.push(config.schema);
    }
    return schemaParts.join("\n");
}
function buildCompleteEntityMap() {
    const moduleJoinerConfigs = modules_sdk_1.MedusaModule.getAllJoinerConfigs();
    const entityMap = new Map();
    // base GraphQL schema
    const schema = buildExecutableSchema();
    if (!schema) {
        return entityMap;
    }
    const entitiesMap = schema.getTypeMap();
    // Process each service configuration to build alias field mappings
    for (const config of moduleJoinerConfigs) {
        processServiceConfig(config, entitiesMap, entityMap);
    }
    return entityMap;
}
/**
 * Processes a service configuration to extract field mappings
 */
function processServiceConfig(config, entitiesMap, entityMap) {
    if (!config.extends) {
        return;
    }
    for (const extend of config.extends) {
        if (!entitiesMap[extend?.entity]) {
            continue;
        }
        const extendedFieldAlias = extend.fieldAlias || {};
        if (Object.keys(extendedFieldAlias).length > 0) {
            processFieldAliases(extendedFieldAlias, extend.entity, entitiesMap, entityMap);
        }
    }
}
/**
 * Processes field aliases to build entity mappings
 */
function processFieldAliases(fieldAlias, baseEntity, entitiesMap, entityMap) {
    for (const [aliasName, aliasConfig] of Object.entries(fieldAlias)) {
        const aliasPath = isString(aliasConfig) ? aliasConfig : aliasConfig.path;
        if (!aliasPath) {
            continue;
        }
        // Build the complete path from base entity through alias path
        const pathSegments = aliasPath.split(".");
        let currentEntity = baseEntity;
        let finalEntity = baseEntity;
        let isValidPath = true;
        // Traverse the path to find the final entity
        for (const segment of pathSegments) {
            const entityMapping = findFieldInEntity(currentEntity, segment, entitiesMap);
            if (!entityMapping) {
                isValidPath = false;
                break;
            }
            currentEntity = entityMapping.targetEntity;
            finalEntity = entityMapping.targetEntity;
        }
        if (isValidPath) {
            const fullPath = `${baseEntity}.${aliasName}`;
            entityMap.set(fullPath, {
                entityName: aliasName,
                targetEntity: finalEntity,
                path: pathSegments,
            });
        }
    }
}
/**
 * Finds a field in an entity and returns its target entity
 */
function findFieldInEntity(entityName, fieldName, entitiesMap) {
    const entity = entitiesMap[entityName];
    if (!entity?.astNode?.fields) {
        return null;
    }
    for (const field of entity.astNode.fields) {
        if (field.name?.value === fieldName) {
            let type = field.type;
            while (type.type) {
                type = type.type;
            }
            const targetEntity = type.name?.value;
            if (targetEntity && !primitiveTypes.has(targetEntity)) {
                return { targetEntity };
            }
        }
    }
    return null;
}
/**
 * Gets the complete entity map with all aliases resolved
 */
function getEntityMap() {
    if (!cachedEntityMap) {
        cachedEntityMap = buildCompleteEntityMap();
    }
    return cachedEntityMap;
}
/**
 * Builds executable schema from all joiner configs
 */
function buildExecutableSchema() {
    const moduleJoinerConfigs = modules_sdk_1.MedusaModule.getAllJoinerConfigs();
    const schemaFromJoinerConfigs = getSchemaFromJoinerConfigs(moduleJoinerConfigs);
    const augmentedSchema = baseGraphqlSchema + "\n" + schemaFromJoinerConfigs;
    const executableSchema = makeSchemaExecutable(augmentedSchema);
    return executableSchema || null;
}
/**
 * Gets the actual GraphQL entity name from a field path using the complete entity map
 * This now uses the pre-built entity map with all aliases resolved
 * e.g., "product.variants.prices" -> "Price" (from resolved alias path)
 */
function getActualEntityName(fieldPath) {
    const schema = getExecutableSchema();
    if (!schema) {
        return null;
    }
    const entitiesMap = schema.getTypeMap();
    const entityMap = getEntityMap();
    const entityAliasMap = getEntityAliasMap();
    const parts = fieldPath.split(".");
    const entryPoint = parts[0];
    const resolvedEntityName = entityAliasMap.get(entryPoint);
    if (!resolvedEntityName) {
        return null;
    }
    let currentEntity = entitiesMap[resolvedEntityName];
    let currentEntityName = resolvedEntityName;
    if (!currentEntity) {
        return null;
    }
    for (let i = 1; i < parts.length; i++) {
        const fieldName = parts[i];
        const mappingKey = `${currentEntityName}.${fieldName}`;
        const entityMapping = entityMap.get(mappingKey);
        if (entityMapping) {
            // field alias paths
            const targetEntityName = entityMapping.targetEntity;
            currentEntityName = targetEntityName;
            currentEntity = entitiesMap[currentEntityName];
            if (!currentEntity) {
                return null;
            }
        }
        else {
            const fieldResult = findFieldInEntity(currentEntityName, fieldName, entitiesMap);
            if (!fieldResult) {
                return null;
            }
            currentEntityName = fieldResult.targetEntity;
            currentEntity = entitiesMap[currentEntityName];
            if (!currentEntity) {
                return null;
            }
        }
    }
    return currentEntityName;
}
/**
 * Gets the normalized snake_case entity name for policy comparison
 * e.g., "product.variants" -> "product_variant", "Price" -> "price"
 */
function getNormalizedEntityName(fieldPath) {
    const actualEntityName = getActualEntityName(fieldPath);
    if (!actualEntityName) {
        return null;
    }
    return (0, utils_1.toSnakeCase)(actualEntityName);
}
/**
 * Collects all unique entity paths that need permission checks
 * This avoids duplicate permission checks for shared path prefixes
 */
function collectUniqueEntityPaths(entity, fields) {
    const uniquePaths = new Map();
    for (const field of fields) {
        const fullFieldPath = entity + "." + field;
        const pathSegments = fullFieldPath.split(".");
        // Build paths incrementally using string concatenation (more efficient than slice + join)
        let currentPath = "";
        for (let i = 0; i < pathSegments.length; i++) {
            currentPath =
                i === 0 ? pathSegments[i] : currentPath + "." + pathSegments[i];
            if (!uniquePaths.has(currentPath)) {
                const entityName = getNormalizedEntityName(currentPath);
                uniquePaths.set(currentPath, { path: currentPath, entityName });
            }
        }
    }
    return uniquePaths;
}
/**
 * RBAC Field Filter using the Strategy pattern
 * Optimized for parallel permission checks
 */
class RBACFieldFilter {
    constructor({ policies, userRoles, container, }) {
        this.policies = policies;
        this.userRoles = userRoles;
        this.container = container;
    }
    async getNotAllowedFields(context) {
        const { entity, parsedFields } = context;
        const { fields, starFields } = parsedFields;
        const fieldsToCheck = [...fields, ...Array.from(starFields)];
        if (!fieldsToCheck.length || !this.policies.length || !entity) {
            return [];
        }
        const uniquePaths = collectUniqueEntityPaths(entity, fieldsToCheck);
        const pathsNeedingCheck = [];
        for (const [path, info] of uniquePaths) {
            if (info.entityName && utils_1.PolicyResource[info.entityName]) {
                pathsNeedingCheck.push({ path, entityName: info.entityName });
            }
        }
        const permissionResults = await (0, utils_1.promiseAll)(pathsNeedingCheck.map(async ({ path, entityName }) => {
            const hasAccess = await (0, has_permission_1.hasPermission)({
                roles: this.userRoles,
                actions: { resource: entityName, operation: "read" },
                container: this.container,
            });
            return { path, hasAccess };
        }));
        const accessMap = new Map();
        for (const result of permissionResults) {
            accessMap.set(result.path, result.hasAccess);
        }
        const notAllowedFields = [];
        for (const field of fieldsToCheck) {
            const fullFieldPath = entity + "." + field;
            const pathSegments = fullFieldPath.split(".");
            let currentPath = "";
            let fieldAllowed = true;
            for (let i = 0; i < pathSegments.length; i++) {
                currentPath =
                    i === 0 ? pathSegments[i] : currentPath + "." + pathSegments[i];
                // Check if this path was in our permission check results
                if (accessMap.has(currentPath)) {
                    const hasAccess = accessMap.get(currentPath);
                    if (!hasAccess) {
                        fieldAllowed = false;
                        break;
                    }
                }
            }
            if (!fieldAllowed) {
                notAllowedFields.push(field);
            }
        }
        return notAllowedFields;
    }
}
exports.RBACFieldFilter = RBACFieldFilter;
//# sourceMappingURL=rbac-field-filter.js.map