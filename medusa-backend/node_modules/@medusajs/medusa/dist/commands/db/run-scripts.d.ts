import { Logger, MedusaContainer } from "@medusajs/types";
/**
 * A low-level utility to migrate the migration scripts. This util should
 * never exit the process implicitly.
 */
export declare function runMigrationScripts({ directory, container, logger, }: {
    directory: string;
    container: MedusaContainer;
    logger: Logger;
}): Promise<boolean>;
declare const main: ({ directory, }: {
    directory: string;
    container?: MedusaContainer;
}) => Promise<never>;
export default main;
//# sourceMappingURL=run-scripts.d.ts.map