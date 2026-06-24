"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const framework_1 = require("@medusajs/framework");
const utils_1 = require("@medusajs/framework/utils");
const core_1 = require("@medusajs/framework/mikro-orm/core");
const postgresql_1 = require("@medusajs/framework/mikro-orm/postgresql");
const glob_1 = require("glob");
const path_1 = require("path");
const promises_1 = require("timers/promises");
const TERMINAL_SIZE = process.stdout.columns;
/**
 * Generate migrations for all scanned modules in a plugin
 */
const main = async function ({ directory }) {
    try {
        const moduleDescriptors = [];
        const modulePaths = glob_1.glob.sync((0, utils_1.toUnixSlash)((0, path_1.join)(directory, "src", "modules", "*", "index.ts")));
        for (const path of modulePaths) {
            const moduleDirname = (0, path_1.dirname)(path);
            const serviceName = await getModuleServiceName(path);
            const entities = await getEntitiesForModule(moduleDirname);
            moduleDescriptors.push({
                serviceName,
                migrationsPath: (0, path_1.join)(moduleDirname, "migrations"),
                entities,
            });
        }
        /**
         * Generating migrations
         */
        framework_1.logger.info("Generating migrations...");
        await generateMigrations(moduleDescriptors, framework_1.logger);
        framework_1.logger.log(new Array(TERMINAL_SIZE).join("-"));
        framework_1.logger.info("Migrations generated");
        process.exit();
    }
    catch (error) {
        framework_1.logger.log(new Array(TERMINAL_SIZE).join("-"));
        framework_1.logger.error(error.message, error);
        process.exit(1);
    }
};
async function getEntitiesForModule(path) {
    const entities = [];
    const entityPaths = glob_1.glob.sync((0, utils_1.toUnixSlash)((0, path_1.join)(path, "models", "*.ts")), {
        ignore: ["**/index.{js,ts}", "**/*.d.ts"],
    });
    for (const entityPath of entityPaths) {
        const entityExports = await (0, utils_1.dynamicImport)(entityPath);
        if ((0, utils_1.isFileSkipped)(entityExports)) {
            continue;
        }
        const validEntities = Object.values(entityExports).filter((potentialEntity) => {
            return (utils_1.DmlEntity.isDmlEntity(potentialEntity) ||
                Object.hasOwn(potentialEntity, core_1.MetadataStorage.PATH_SYMBOL));
        });
        entities.push(...validEntities);
    }
    return entities;
}
async function getModuleServiceName(path) {
    const moduleExport = await (0, utils_1.dynamicImport)(path);
    if (!moduleExport.default) {
        throw new Error("The module should default export the `Module()`");
    }
    return moduleExport.default.service.prototype.__joinerConfig()
        .serviceName;
}
async function generateMigrations(moduleDescriptors = [], logger) {
    const DB_HOST = process.env.DB_HOST ?? "localhost";
    const DB_USERNAME = process.env.DB_USERNAME ?? "";
    const DB_PASSWORD = process.env.DB_PASSWORD ?? "";
    const DB_PORT = process.env.DB_PORT ? Number(process.env.DB_PORT) : 5432;
    const DATABASE_URL = process.env.DATABASE_URL;
    for (const moduleDescriptor of moduleDescriptors) {
        logger.info(`Generating migrations for module ${moduleDescriptor.serviceName}...`);
        if (moduleDescriptor.entities.length === 0) {
            logger.info(`No entities found for module ${moduleDescriptor.serviceName}, skipping...`);
            continue;
        }
        const mikroOrmConfig = (0, utils_1.defineMikroOrmCliConfig)(moduleDescriptor.serviceName, {
            entities: moduleDescriptor.entities,
            host: DB_HOST,
            port: DB_PORT,
            user: DB_USERNAME,
            password: DB_PASSWORD,
            ...(DATABASE_URL ? { clientUrl: DATABASE_URL } : {}),
            migrations: {
                path: moduleDescriptor.migrationsPath,
            },
        });
        const orm = await postgresql_1.MikroORM.init(mikroOrmConfig);
        const migrator = orm.getMigrator();
        const result = await migrator.createMigration();
        if (result.fileName) {
            logger.info(`Migration created: ${result.fileName}`);
            // Add a 1-second delay after creating a migration file to ensure unique
            // timestamps across modules. MikroORM uses second-precision timestamps
            // (YYYYMMDDHHmmss format), so without this delay, multiple modules
            // processed within the same second would get identical migration filenames.
            // The delay is only added when a migration is actually created, not when
            // skipped due to no schema changes.
            // See: https://github.com/medusajs/medusa/issues/14410
            await (0, promises_1.setTimeout)(1000);
        }
        else {
            logger.info(`No migration created`);
        }
    }
}
exports.default = main;
//# sourceMappingURL=generate.js.map