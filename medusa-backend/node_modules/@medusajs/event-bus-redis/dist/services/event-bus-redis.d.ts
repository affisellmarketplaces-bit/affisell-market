import { InternalModuleDeclaration, Logger, Message } from "@medusajs/framework/types";
import { AbstractEventBusModuleService } from "@medusajs/framework/utils";
import { Queue, QueueOptions, Worker, WorkerOptions } from "bullmq";
import { Redis } from "ioredis";
import { BullJob, EmitOptions, EventBusRedisModuleOptions, Options } from "../types";
type InjectedDependencies = {
    logger: Logger;
    eventBusRedisConnection: Redis;
    eventBusRedisQueueName: string;
    eventBusRedisQueueOptions: Omit<QueueOptions, "connection">;
    eventBusRedisWorkerOptions: Omit<WorkerOptions, "connection">;
    eventBusRedisJobOptions: EmitOptions;
};
/**
 * Can keep track of multiple subscribers to different events and run the
 * subscribers when events happen. Events will run asynchronously.
 */
export default class RedisEventBusService extends AbstractEventBusModuleService {
    protected readonly logger_: Logger;
    protected readonly eventBusRedisConnection_: Redis;
    protected readonly queueName_: string;
    protected readonly queueOptions_: Omit<QueueOptions, "connection">;
    protected readonly workerOptions_: Omit<WorkerOptions, "connection">;
    protected readonly jobOptions_: EmitOptions;
    protected queue_: Queue;
    protected bullWorker_: Worker;
    constructor({ logger, eventBusRedisConnection, eventBusRedisQueueName, eventBusRedisQueueOptions, eventBusRedisWorkerOptions, eventBusRedisJobOptions, }: InjectedDependencies, _moduleOptions: EventBusRedisModuleOptions | undefined, _moduleDeclaration: InternalModuleDeclaration);
    __hooks: {
        onApplicationStart: () => Promise<void>;
        onApplicationShutdown: () => Promise<void>;
        onApplicationPrepareShutdown: () => Promise<void>;
    };
    /**
     * Build events for queue processing with priority handling.
     *
     * Priority levels (lower number = higher priority):
     * - 10: Critical business events (e.g., order placed)
     * - 100: Default priority for normal events (default)
     * - 2,097,152: Lowest priority for internal events
     *
     * Priority override hierarchy (highest to lowest precedence):
     * 1. Message-level options (eventData.options.priority)
     * 2. Emit-level options (options.priority)
     * 3. Module-level job options (this.jobOptions_.priority)
     * 4. Internal flag default (options.internal ? EventPriority.LOWEST : EventPriority.DEFAULT)
     */
    private buildEvents;
    /**
     * Emit a single or number of events
     * @param eventsData
     * @param options
     */
    emit<T = unknown>(eventsData: Message<T> | Message<T>[], options?: Options): Promise<void>;
    private setExpire;
    private groupEvents;
    private getGroupedEvents;
    releaseGroupedEvents(eventGroupId: string): Promise<void>;
    clearGroupedEvents(eventGroupId: string, { eventNames, }?: {
        eventNames?: string[];
    }): Promise<void>;
    /**
     * Handles incoming jobs.
     * @param job The job object
     * @return resolves to the results of the subscriber calls.
     */
    worker_: <T>(job: BullJob<T>) => Promise<unknown>;
}
export {};
//# sourceMappingURL=event-bus-redis.d.ts.map