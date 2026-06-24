import { Logger, MedusaContainer } from "@medusajs/types";
/**
 * A low-level utility to migrate the database. This util should
 * never exit the process implicitly.
 */
export declare function migrate({ directory, skipLinks, skipScripts, executeAllLinks, executeSafeLinks, allOrNothing, concurrency, logger, container, }: {
    directory: string;
    skipLinks: boolean;
    skipScripts: boolean;
    executeAllLinks: boolean;
    executeSafeLinks: boolean;
    allOrNothing?: boolean;
    concurrency?: number;
    logger: Logger;
    container: MedusaContainer;
}): Promise<boolean>;
declare const main: ({ directory, skipLinks, skipScripts, executeAllLinks, executeSafeLinks, concurrency, allOrNothing, }: {
    directory: any;
    skipLinks: any;
    skipScripts: any;
    executeAllLinks: any;
    executeSafeLinks: any;
    concurrency: any;
    allOrNothing: any;
}) => Promise<never>;
export default main;
//# sourceMappingURL=migrate.d.ts.map