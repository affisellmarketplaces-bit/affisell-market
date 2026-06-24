import { MedusaAppLoader } from "@medusajs/framework";
import { MedusaContainer } from "@medusajs/framework/types";
/**
 * Low-level utility to sync links. This utility is used
 * by the migrate command as-well.
 */
export declare function syncLinks(medusaAppLoader: MedusaAppLoader, { executeAll, executeSafe, directory, container, concurrency, }: {
    executeSafe: boolean;
    executeAll: boolean;
    directory: string;
    container: MedusaContainer;
    concurrency?: number;
}): Promise<void>;
declare const main: ({ directory, executeSafe, executeAll, concurrency, }: {
    directory: any;
    executeSafe: any;
    executeAll: any;
    concurrency: any;
}) => Promise<never>;
export default main;
//# sourceMappingURL=sync-links.d.ts.map