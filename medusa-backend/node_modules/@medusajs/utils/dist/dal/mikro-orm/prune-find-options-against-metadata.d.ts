import type { EntityMetadata } from "@medusajs/deps/mikro-orm/core";
export interface PruneFindOptionsResult {
    droppedFields: string[];
    droppedPopulate: string[];
}
interface PruneFindOptionsLogger {
    debug?: (message: string) => void;
}
interface FindOptionsLike {
    fields?: unknown;
    populate?: unknown;
}
/**
 * Drop entries from `options.fields` and `options.populate` whose dotted
 * paths can't be resolved against the local entity's MikroORM metadata.
 *
 * Why: MikroORM 6.6.14 derives populate hints from nested `fields`
 * entries and merges them into `options.populate`. If any derived hint
 * references a non-relation or a missing property, MikroORM rejects it
 * at populate-resolution time. Pruning at the DAL boundary keeps that
 * branch harmless and matches the silent no-op behavior of 6.6.12 while
 * still surfacing dropped paths to debug logs.
 */
export declare function pruneFindOptionsAgainstMetadata(meta: EntityMetadata<any> | undefined | null, options: FindOptionsLike, logger?: PruneFindOptionsLogger): PruneFindOptionsResult;
export {};
//# sourceMappingURL=prune-find-options-against-metadata.d.ts.map