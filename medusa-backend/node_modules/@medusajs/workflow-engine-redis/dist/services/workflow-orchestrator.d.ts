import { DistributedTransactionEvents, DistributedTransactionType, TransactionStep } from "@medusajs/framework/orchestration";
import { ContainerLike, Context, MedusaContainer } from "@medusajs/framework/types";
import { TransactionState } from "@medusajs/framework/utils";
import { FlowCancelOptions, FlowRunOptions, ReturnWorkflow } from "@medusajs/framework/workflows-sdk";
import Redis from "ioredis";
import type { RedisDistributedTransactionStorage } from "../utils";
export type WorkflowOrchestratorRunOptions<T> = Omit<FlowRunOptions<T>, "container"> & {
    transactionId?: string;
    runId?: string;
    container?: ContainerLike;
};
export type WorkflowOrchestratorCancelOptions = Omit<FlowCancelOptions, "transaction" | "transactionId" | "container"> & {
    transactionId: string;
    runId?: string;
    container?: ContainerLike;
};
type RegisterStepSuccessOptions<T> = Omit<WorkflowOrchestratorRunOptions<T>, "transactionId" | "input">;
type RegisterStepFailureOptions<T> = Omit<WorkflowOrchestratorRunOptions<T>, "transactionId" | "input"> & {
    forcePermanentFailure?: boolean;
};
type RetryStepOptions<T> = Omit<WorkflowOrchestratorRunOptions<T>, "transactionId" | "input" | "resultFrom">;
type IdempotencyKeyParts = {
    workflowId: string;
    transactionId: string;
    stepId: string;
    action: "invoke" | "compensate";
};
type NotifyOptions = {
    eventType: keyof DistributedTransactionEvents;
    isFlowAsync: boolean;
    workflowId: string;
    transactionId?: string;
    step?: TransactionStep;
    response?: unknown;
    result?: unknown;
    errors?: unknown[];
    state?: TransactionState;
};
type SubscriberHandler = {
    (input: NotifyOptions): void;
} & {
    _id?: string;
};
type SubscribeOptions = {
    workflowId: string;
    transactionId?: string;
    subscriber: SubscriberHandler;
    subscriberId?: string;
};
type UnsubscribeOptions = {
    workflowId: string;
    transactionId?: string;
    subscriberOrId: string | SubscriberHandler;
};
export declare class WorkflowOrchestratorService {
    #private;
    private instanceId;
    protected redisPublisher: Redis;
    protected redisSubscriber: Redis;
    protected container_: MedusaContainer;
    private static subscribers;
    protected redisDistributedTransactionStorage_: RedisDistributedTransactionStorage;
    constructor({ dataLoaderOnly, redisDistributedTransactionStorage, redisPublisher, redisSubscriber, sharedContainer, }: {
        dataLoaderOnly: boolean;
        redisDistributedTransactionStorage: RedisDistributedTransactionStorage;
        workflowOrchestratorService: WorkflowOrchestratorService;
        redisPublisher: Redis;
        redisSubscriber: Redis;
        sharedContainer: MedusaContainer;
    });
    onApplicationShutdown(): Promise<void>;
    onApplicationPrepareShutdown(): Promise<void>;
    onApplicationStart(): Promise<void>;
    private triggerParentStep;
    run<T = unknown>(workflowIdOrWorkflow: string | ReturnWorkflow<any, any, any>, options?: WorkflowOrchestratorRunOptions<T>): Promise<any>;
    cancel(workflowIdOrWorkflow: string | ReturnWorkflow<any, any, any>, options?: WorkflowOrchestratorCancelOptions): Promise<any>;
    getRunningTransaction(workflowId: string, transactionId: string, context?: Context): Promise<DistributedTransactionType>;
    retryStep<T = unknown>({ idempotencyKey, options, }: {
        idempotencyKey: string | IdempotencyKeyParts;
        options?: RetryStepOptions<T>;
    }): Promise<any>;
    setStepSuccess<T = unknown>({ idempotencyKey, stepResponse, options, }: {
        idempotencyKey: string | IdempotencyKeyParts;
        stepResponse: unknown;
        options?: RegisterStepSuccessOptions<T>;
    }): Promise<any>;
    setStepFailure<T = unknown>({ idempotencyKey, stepResponse, options, }: {
        idempotencyKey: string | IdempotencyKeyParts;
        stepResponse: unknown;
        options?: RegisterStepFailureOptions<T>;
    }): Promise<any>;
    subscribe({ workflowId, transactionId, subscriber, subscriberId, }: SubscribeOptions): void;
    unsubscribe({ workflowId, transactionId, subscriberOrId, }: UnsubscribeOptions): void;
    private notify;
    private processSubscriberNotifications;
    private getChannelName;
    private buildWorkflowEvents;
    private buildIdempotencyKeyAndParts;
}
export {};
//# sourceMappingURL=workflow-orchestrator.d.ts.map