import { ConfigManager } from "./config";
import { ConfigModule } from "./types";
export declare const configManager: ConfigManager;
/**
 * Loads the config file and returns the config module after validating, normalizing the configurations
 *
 * @param entryDirectory The directory to find the config file from
 * @param configFileName The name of the config file to search for in the entry directory
 * @param options.throwOnValidationError When false, validation errors won't throw.
 * Useful for build/compile commands. Defaults to true.
 */
export declare function configLoader(entryDirectory: string, configFileName?: string, options?: {
    throwOnValidationError?: boolean;
}): Promise<ConfigModule>;
//# sourceMappingURL=loader.d.ts.map