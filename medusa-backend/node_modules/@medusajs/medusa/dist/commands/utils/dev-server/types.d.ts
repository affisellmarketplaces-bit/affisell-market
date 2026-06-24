import { ApiLoader } from "@medusajs/framework";
import { Logger } from "@medusajs/framework/types";
/**
 * Action types that can be performed on files
 */
export type FileChangeAction = "add" | "change" | "unlink";
/**
 * Configuration for path matching and exclusions
 */
export declare const CONFIG: {
    readonly EXCLUDED_PATH_PATTERNS: readonly ["node_modules"];
    readonly RESOURCE_PATH_PATTERNS: {
        readonly route: "api/";
        readonly workflow: "workflows/";
        readonly subscriber: "subscribers/";
        readonly job: "jobs/";
        readonly module: "modules/";
    };
};
/**
 * Global dependencies available in the dev server environment
 */
export interface DevServerGlobals {
    __MEDUSA_HMR_API_LOADER__?: ApiLoader;
    __MEDUSA_HMR_INITIAL_STACK_LENGTH__?: number;
    WorkflowManager?: {
        unregister: (id: string) => void;
    };
}
/**
 * Parameters for resource reload operations
 */
export interface ReloadParams {
    /**
     * The source of the log, used to prefix the log messages
     */
    logSource: string;
    action: FileChangeAction;
    absoluteFilePath: string;
    keepCache?: boolean;
    logger: Logger;
    skipRecovery?: boolean;
    rootDirectory: string;
}
/**
 * Represents a resource registered in the dev server
 */
export interface Resource {
    id: string;
    [key: string]: any;
}
//# sourceMappingURL=types.d.ts.map