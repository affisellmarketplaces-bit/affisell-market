"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildGenerateMigrationScript = buildGenerateMigrationScript;
const promises_1 = require("timers/promises");
const dal_1 = require("../../dal");
const load_module_database_config_1 = require("../load-module-database-config");
const migrations_1 = require("../../migrations");
const dml_1 = require("../../dml");
const to_kebab_case_1 = require("../../common/to-kebab-case");
const TERMINAL_SIZE = process.stdout.columns;
/**
 * Utility function to build a migration generation script that will generate the migrations.
 * Only used in mikro orm based modules.
 * @param moduleName
 * @param models
 * @param pathToMigrations
 */
function buildGenerateMigrationScript({ moduleName, models, pathToMigrations, }) {
    /**
     * This script is only valid for mikro orm managers. If a user provide a custom manager
     * he is in charge of running the migrations.
     * @param options
     * @param logger
     * @param moduleDeclaration
     */
    return async function ({ options, logger } = {}) {
        logger ??= console;
        logger.info(new Array(TERMINAL_SIZE).join("-"));
        logger.info("");
        logger.info(`MODULE: ${moduleName}`);
        const dbData = (0, load_module_database_config_1.loadDatabaseConfig)(moduleName, options);
        const normalizedModels = (0, dml_1.toMikroOrmEntities)(models);
        const orm = await (0, dal_1.mikroOrmCreateConnection)({
            ...dbData,
            snapshotName: `.snapshot-${(0, to_kebab_case_1.kebabCase)(moduleName.replace("Service", ""))}`,
        }, normalizedModels, pathToMigrations);
        const migrations = new migrations_1.Migrations(orm);
        try {
            const { fileName } = await migrations.generate();
            if (fileName) {
                logger.info(`Generated successfully (${fileName}).`);
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
                logger.info(`Skipped. No changes detected in your models.`);
            }
        }
        catch (error) {
            logger.error(`Failed with error ${error.message}`, error);
        }
    };
}
//# sourceMappingURL=migration-generate.js.map