"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.initialize = void 0;
exports.getMigrationPlanner = getMigrationPlanner;
const modules_sdk_1 = require("@medusajs/framework/modules-sdk");
const utils_1 = require("@medusajs/framework/utils");
const linkDefinitions = __importStar(require("../definitions"));
const migration_1 = require("../migration");
const utils_2 = require("../utils");
const module_definition_1 = require("./module-definition");
const initialize = async (options, pluginLinksDefinitions, injectedDependencies, cwd, migrationOnly, schemaOnly) => {
    const allLinks = {};
    const modulesLoadedKeys = modules_sdk_1.MedusaModule.getLoadedModules().map((mod) => Object.keys(mod)[0]);
    const allLinksToLoad = Object.values(linkDefinitions)
        .concat(pluginLinksDefinitions ?? [])
        .filter((linkDefinition) => !(0, utils_1.isFileSkipped)(linkDefinition));
    await (0, utils_1.promiseAll)(allLinksToLoad.map(async (linkDefinition) => {
        const definition = JSON.parse(JSON.stringify(linkDefinition));
        const [primary, foreign] = definition.relationships ?? [];
        if (definition.relationships?.length !== 2 &&
            !definition.isReadOnlyLink) {
            throw new Error(`Link module ${definition.serviceName} can only link 2 modules.`);
        }
        else if (foreign?.foreignKey?.split(",").length > 1 &&
            !definition.isReadOnlyLink) {
            throw new Error(`Foreign key cannot be a composed key.`);
        }
        if (Array.isArray(definition.extraDataFields)) {
            const extraDataFields = definition.extraDataFields;
            const definedDbFields = Object.keys(definition.databaseConfig?.extraFields || {});
            const difference = (0, utils_1.arrayDifference)(extraDataFields, definedDbFields);
            if (difference.length) {
                throw new Error(`extraDataFields (fieldNames: ${difference.join(",")}) need to be configured under databaseConfig (serviceName: ${definition.serviceName}).`);
            }
        }
        const serviceKey = !definition.isReadOnlyLink
            ? definition.serviceName ??
                (0, utils_1.composeLinkName)(primary.serviceName, primary.foreignKey, foreign.serviceName, foreign.foreignKey)
            : (0, utils_1.simpleHash)(JSON.stringify(definition.extends));
        if (modulesLoadedKeys.includes(serviceKey)) {
            return;
        }
        else if (serviceKey in allLinks) {
            throw new Error(`Link module ${serviceKey} already defined.`);
        }
        if (definition.isReadOnlyLink) {
            const extended = [];
            for (const extension of definition.extends ?? []) {
                if (modulesLoadedKeys.includes(extension.serviceName) &&
                    modulesLoadedKeys.includes(extension.relationship.serviceName)) {
                    extended.push(extension);
                }
            }
            definition.extends = extended;
            if (extended.length === 0) {
                return;
            }
        }
        else if (!modulesLoadedKeys.includes(primary.serviceName) ||
            !modulesLoadedKeys.includes(foreign.serviceName)) {
            return;
        }
        const logger = injectedDependencies?.[utils_1.ContainerRegistrationKeys.LOGGER] ?? console;
        definition.schema = (0, utils_2.generateGraphQLSchema)(definition, primary, foreign, {
            logger,
        });
        if (!Array.isArray(definition.alias)) {
            definition.alias = definition.alias ? [definition.alias] : [];
        }
        for (const alias of definition.alias) {
            alias.args ??= {};
            alias.entity = (0, utils_1.toPascalCase)("Link_" +
                (definition.databaseConfig?.tableName ??
                    (0, utils_1.composeTableName)(primary.serviceName, primary.foreignKey, foreign.serviceName, foreign.foreignKey)));
        }
        const moduleDefinition = (0, module_definition_1.getLinkModuleDefinition)(definition, primary, foreign);
        const linkModuleDefinition = {
            key: serviceKey,
            label: serviceKey,
            dependencies: [utils_1.Modules.EVENT_BUS],
            defaultModuleDeclaration: {
                scope: modules_sdk_1.MODULE_SCOPE.INTERNAL,
            },
        };
        const loaded = await modules_sdk_1.MedusaModule.bootstrapLink({
            definition: linkModuleDefinition,
            declaration: options,
            moduleExports: moduleDefinition,
            injectedDependencies,
            cwd,
            migrationOnly,
            schemaOnly,
        });
        allLinks[serviceKey] = Object.values(loaded)[0];
    }));
    return allLinks;
};
exports.initialize = initialize;
/**
 * Prepare an execution plan and run the migrations accordingly.
 * It includes creating, updating, deleting the tables according to the execution plan.
 * If any unsafe sql is identified then we will notify the user to act manually.
 *
 * @param options
 * @param pluginLinksDefinition
 */
function getMigrationPlanner(options, pluginLinksDefinition) {
    const modulesLoadedKeys = modules_sdk_1.MedusaModule.getLoadedModules().map((mod) => Object.keys(mod)[0]);
    const allLinksToLoad = Object.values(linkDefinitions).concat(pluginLinksDefinition ?? []);
    const allLinks = new Set();
    for (const definition of allLinksToLoad) {
        if (definition.isReadOnlyLink) {
            continue;
        }
        if (definition.relationships?.length !== 2) {
            throw new Error(`Link module ${definition.serviceName} must have 2 relationships.`);
        }
        const [primary, foreign] = definition.relationships ?? [];
        const serviceKey = definition.serviceName ??
            (0, utils_1.composeLinkName)(primary.serviceName, primary.foreignKey, foreign.serviceName, foreign.foreignKey);
        if (allLinks.has(serviceKey)) {
            throw new Error(`Link module ${serviceKey} already exists.`);
        }
        allLinks.add(serviceKey);
        if (!modulesLoadedKeys.includes(primary.serviceName) ||
            !modulesLoadedKeys.includes(foreign.serviceName)) {
            continue;
        }
    }
    return new migration_1.MigrationsExecutionPlanner(allLinksToLoad, options);
}
//# sourceMappingURL=index.js.map