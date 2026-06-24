"use strict";
var __classPrivateFieldSet = (this && this.__classPrivateFieldSet) || function (receiver, state, value, kind, f) {
    if (kind === "m") throw new TypeError("Private method is not writable");
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a setter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot write private member to an object whose class did not declare it");
    return (kind === "a" ? f.call(receiver, value) : f ? f.value = value : state.set(receiver, value)), value;
};
var __classPrivateFieldGet = (this && this.__classPrivateFieldGet) || function (receiver, state, kind, f) {
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
    return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
};
var _RedisDistributedTransactionStorage_instances, _RedisDistributedTransactionStorage_isWorkerMode, _RedisDistributedTransactionStorage_getLockKey, _RedisDistributedTransactionStorage_acquireLock, _RedisDistributedTransactionStorage_releaseLock, _RedisDistributedTransactionStorage_preventRaceConditionExecutionIfNecessary;
Object.defineProperty(exports, "__esModule", { value: true });
exports.RedisDistributedTransactionStorage = void 0;
const core_1 = require("@medusajs/framework/mikro-orm/core");
const orchestration_1 = require("@medusajs/framework/orchestration");
const utils_1 = require("@medusajs/framework/utils");
const bullmq_1 = require("bullmq");
var JobType;
(function (JobType) {
    JobType["SCHEDULE"] = "schedule";
    JobType["RETRY"] = "retry";
    JobType["STEP_TIMEOUT"] = "step_timeout";
    JobType["TRANSACTION_TIMEOUT"] = "transaction_timeout";
})(JobType || (JobType = {}));
const THIRTY_MINUTES_IN_MS = 1000 * 60 * 30;
const REPEATABLE_CLEARER_JOB_ID = "clear-expired-executions";
const doneStates = new Set([
    utils_1.TransactionStepState.DONE,
    utils_1.TransactionStepState.REVERTED,
    utils_1.TransactionStepState.FAILED,
    utils_1.TransactionStepState.SKIPPED,
    utils_1.TransactionStepState.SKIPPED_FAILURE,
    utils_1.TransactionStepState.TIMEOUT,
]);
const finishedStates = new Set([
    utils_1.TransactionState.DONE,
    utils_1.TransactionState.FAILED,
    utils_1.TransactionState.REVERTED,
]);
const failedStates = new Set([
    utils_1.TransactionState.FAILED,
    utils_1.TransactionState.REVERTED,
]);
class RedisDistributedTransactionStorage {
    constructor({ workflowExecutionService, redisConnection, redisWorkerConnection, redisQueueName, redisJobQueueName, redisMainQueueOptions, redisMainWorkerOptions, redisJobQueueOptions, redisJobWorkerOptions, redisCleanerQueueOptions, redisCleanerWorkerOptions, logger, isWorkerMode, }) {
        _RedisDistributedTransactionStorage_instances.add(this);
        _RedisDistributedTransactionStorage_isWorkerMode.set(this, false);
        this.workflowExecutionService_ = workflowExecutionService;
        this.logger_ = logger;
        this.redisClient = redisConnection;
        this.redisWorkerConnection = redisWorkerConnection;
        this.cleanerQueueName = "workflows-cleaner";
        this.queueName = redisQueueName;
        this.jobQueueName = redisJobQueueName;
        // Store per-queue options
        this.mainQueueOptions_ = redisMainQueueOptions ?? {};
        this.mainWorkerOptions_ = redisMainWorkerOptions ?? {};
        this.jobQueueOptions_ = redisJobQueueOptions ?? {};
        this.jobWorkerOptions_ = redisJobWorkerOptions ?? {};
        this.cleanerQueueOptions_ = redisCleanerQueueOptions ?? {};
        this.cleanerWorkerOptions_ = redisCleanerWorkerOptions ?? {};
        // Create queues with their respective options
        this.queue = new bullmq_1.Queue(redisQueueName, {
            ...this.mainQueueOptions_,
            connection: this.redisClient,
        });
        this.jobQueue = isWorkerMode
            ? new bullmq_1.Queue(redisJobQueueName, {
                ...this.jobQueueOptions_,
                connection: this.redisClient,
            })
            : undefined;
        this.cleanerQueue_ = isWorkerMode
            ? new bullmq_1.Queue(this.cleanerQueueName, {
                ...this.cleanerQueueOptions_,
                connection: this.redisClient,
            })
            : undefined;
        __classPrivateFieldSet(this, _RedisDistributedTransactionStorage_isWorkerMode, isWorkerMode, "f");
    }
    async onApplicationPrepareShutdown() {
        // Close worker gracefully, i.e. wait for the current jobs to finish
        await this.worker?.close();
        await this.jobWorker?.close();
        await this.cleanerWorker_?.close();
    }
    async onApplicationShutdown() {
        await this.queue?.close();
        await this.jobQueue?.close();
        await this.cleanerQueue_?.close();
    }
    async onApplicationStart() {
        await this.ensureRedisConnection();
        const allowedJobs = [
            JobType.RETRY,
            JobType.STEP_TIMEOUT,
            JobType.TRANSACTION_TIMEOUT,
        ];
        // Per-worker options with their respective configurations
        const mainWorkerOptions = {
            ...this.mainWorkerOptions_,
            connection: this.redisWorkerConnection,
        };
        const jobWorkerOptions = {
            ...this.jobWorkerOptions_,
            connection: this.redisWorkerConnection,
        };
        const cleanerWorkerOptions = {
            ...this.cleanerWorkerOptions_,
            connection: this.redisWorkerConnection,
        };
        // TODO: Remove this once we have released to all clients (Added: v2.6+)
        // Remove all repeatable jobs from the old queue since now we have a queue dedicated to scheduled jobs
        await this.removeAllRepeatableJobs(this.queue);
        if (__classPrivateFieldGet(this, _RedisDistributedTransactionStorage_isWorkerMode, "f")) {
            this.worker = new bullmq_1.Worker(this.queueName, async (job) => {
                this.logger_.debug(`executing job ${job.name} from queue ${this.queueName} with the following data: ${JSON.stringify(job.data)}`);
                if (allowedJobs.includes(job.name)) {
                    try {
                        await this.executeTransaction(job.data.workflowId, job.data.transactionId, job.data.transactionMetadata);
                    }
                    catch (error) {
                        if (!orchestration_1.SkipExecutionError.isSkipExecutionError(error)) {
                            throw error;
                        }
                    }
                }
                if (job.name === JobType.SCHEDULE) {
                    // Remove repeatable job from the old queue since now we have a queue dedicated to scheduled jobs
                    await this.remove(job.data.jobId);
                }
            }, mainWorkerOptions);
            this.jobWorker = new bullmq_1.Worker(this.jobQueueName, async (job) => {
                this.logger_.debug(`executing scheduled job ${job.data.jobId} from queue ${this.jobQueueName} with the following options: ${JSON.stringify(job.data.schedulerOptions)}`);
                return await this.executeScheduledJob(job.data.jobId, job.data.schedulerOptions);
            }, jobWorkerOptions);
            this.cleanerWorker_ = new bullmq_1.Worker(this.cleanerQueueName, async () => {
                await this.clearExpiredExecutions();
            }, cleanerWorkerOptions);
            await this.cleanerQueue_?.add("cleaner", {}, {
                repeat: {
                    every: THIRTY_MINUTES_IN_MS,
                },
                jobId: REPEATABLE_CLEARER_JOB_ID,
                removeOnComplete: true,
                removeOnFail: true,
            });
        }
    }
    setWorkflowOrchestratorService(workflowOrchestratorService) {
        this.workflowOrchestratorService_ = workflowOrchestratorService;
    }
    async ensureRedisConnection() {
        const reconnectTasks = [];
        if (this.redisClient.status !== "ready") {
            this.logger_.warn(`[Workflow-engine-redis] Redis connection is not ready (status: ${this.redisClient.status}). Attempting to reconnect...`);
            reconnectTasks.push(this.redisClient
                .connect()
                .then(() => {
                this.logger_.info("[Workflow-engine-redis] Redis connection reestablished successfully");
            })
                .catch((error) => {
                this.logger_.error("[Workflow-engine-redis] Failed to reconnect to Redis", error);
                throw new utils_1.MedusaError(utils_1.MedusaError.Types.DB_ERROR, `Redis connection failed: ${error.message}`);
            }));
        }
        if (this.redisWorkerConnection.status !== "ready") {
            this.logger_.warn(`[Workflow-engine-redis] Redis worker connection is not ready (status: ${this.redisWorkerConnection.status}). Attempting to reconnect...`);
            reconnectTasks.push(this.redisWorkerConnection
                .connect()
                .then(() => {
                this.logger_.info("[Workflow-engine-redis] Redis worker connection reestablished successfully");
            })
                .catch((error) => {
                this.logger_.error("[Workflow-engine-redis] Failed to reconnect to Redis worker connection", error);
                throw new utils_1.MedusaError(utils_1.MedusaError.Types.DB_ERROR, `Redis worker connection failed: ${error.message}`);
            }));
        }
        if (reconnectTasks.length > 0) {
            await (0, utils_1.promiseAll)(reconnectTasks);
        }
    }
    async saveToDb(data, retentionTime) {
        const isNotStarted = data.flow.state === utils_1.TransactionState.NOT_STARTED;
        const asyncVersion = data.flow._v;
        const isFinished = finishedStates.has(data.flow.state);
        const isWaitingToCompensate = data.flow.state === utils_1.TransactionState.WAITING_TO_COMPENSATE;
        const isFlowInvoking = data.flow.state === utils_1.TransactionState.INVOKING;
        const stepsArray = Object.values(data.flow.steps);
        let currentStep;
        const targetStates = isFlowInvoking
            ? new Set([
                utils_1.TransactionStepState.INVOKING,
                utils_1.TransactionStepState.DONE,
                utils_1.TransactionStepState.FAILED,
            ])
            : new Set([utils_1.TransactionStepState.COMPENSATING]);
        for (let i = stepsArray.length - 1; i >= 0; i--) {
            const step = stepsArray[i];
            if (step.id === "_root") {
                break;
            }
            const isTargetState = targetStates.has(step.invoke?.state);
            if (isTargetState && !currentStep) {
                currentStep = step;
                break;
            }
        }
        let shouldStoreCurrentSteps = false;
        if (currentStep) {
            for (const step of stepsArray) {
                if (step.id === "_root") {
                    continue;
                }
                if (step.depth === currentStep.depth &&
                    step?.definition?.store === true) {
                    shouldStoreCurrentSteps = true;
                    break;
                }
            }
        }
        if (!(isNotStarted || isFinished || isWaitingToCompensate) &&
            !shouldStoreCurrentSteps &&
            !asyncVersion) {
            return;
        }
        await this.workflowExecutionService_.upsert([
            {
                workflow_id: data.flow.modelId,
                transaction_id: data.flow.transactionId,
                run_id: data.flow.runId,
                execution: data.flow,
                context: {
                    data: data.context,
                    errors: data.errors,
                },
                state: data.flow.state,
                retention_time: retentionTime,
            },
        ]);
    }
    async deleteFromDb(data) {
        await this.workflowExecutionService_.delete([
            {
                run_id: data.flow.runId,
            },
        ]);
    }
    async executeTransaction(workflowId, transactionId, transactionMetadata = {}) {
        return await this.workflowOrchestratorService_.run(workflowId, {
            transactionId,
            logOnError: true,
            throwOnError: false,
            context: {
                eventGroupId: transactionMetadata.eventGroupId,
                parentStepIdempotencyKey: transactionMetadata.parentStepIdempotencyKey,
                preventReleaseEvents: transactionMetadata.preventReleaseEvents,
            },
        });
    }
    async executeScheduledJob(jobId, schedulerOptions) {
        try {
            // TODO: In the case of concurrency being forbidden, we want to generate a predictable transaction ID and rely on the idempotency
            // of the transaction to ensure that the transaction is only executed once.
            await this.workflowOrchestratorService_.run(jobId, {
                logOnError: true,
            });
        }
        catch (e) {
            if (e instanceof utils_1.MedusaError && e.type === utils_1.MedusaError.Types.NOT_FOUND) {
                this.logger_?.warn(`Tried to execute a scheduled workflow with ID ${jobId} that does not exist, removing it from the scheduler.`);
                await this.remove(jobId);
                return;
            }
            throw e;
        }
    }
    async get(key, options) {
        const [_, workflowId, transactionId] = key.split(":");
        const [trx, rawData] = await (0, utils_1.promiseAll)([
            this.workflowExecutionService_
                .list({
                workflow_id: workflowId,
                transaction_id: transactionId,
            }, {
                select: ["execution", "context"],
                order: {
                    id: "desc",
                },
                take: 1,
            })
                .then((trx) => trx[0])
                .catch(() => undefined),
            options?._cachedRawData !== undefined
                ? Promise.resolve(options._cachedRawData)
                : this.redisClient.get(key),
        ]);
        if (trx) {
            let flow, errors;
            if (rawData) {
                const data = JSON.parse(rawData);
                flow = data.flow;
                errors = data.errors;
            }
            const { idempotent } = options ?? {};
            const execution = trx.execution;
            if (!idempotent) {
                const isFailedOrReverted = failedStates.has(execution.state);
                const isDone = execution.state === utils_1.TransactionState.DONE;
                const isCancellingAndFailedOrReverted = options?.isCancelling && isFailedOrReverted;
                const isNotCancellingAndDoneOrFailedOrReverted = !options?.isCancelling && (isDone || isFailedOrReverted);
                if (isCancellingAndFailedOrReverted ||
                    isNotCancellingAndDoneOrFailedOrReverted) {
                    return;
                }
            }
            return new orchestration_1.TransactionCheckpoint(flow ?? trx.execution, trx.context?.data, errors ?? trx.context?.errors);
        }
        return;
    }
    async save(key, data, ttl, options) {
        /**
         * Store the retention time only if the transaction is done, failed or reverted.
         */
        const { retentionTime } = options ?? {};
        let lockAcquired = false;
        let storedData;
        if (data.flow._v) {
            lockAcquired = await __classPrivateFieldGet(this, _RedisDistributedTransactionStorage_instances, "m", _RedisDistributedTransactionStorage_acquireLock).call(this, key);
            if (!lockAcquired) {
                throw new Error("Lock not acquired");
            }
            storedData = await this.get(key, {
                isCancelling: !!data.flow.cancelledAt,
            });
            orchestration_1.TransactionCheckpoint.mergeCheckpoints(data, storedData);
        }
        try {
            const hasFinished = finishedStates.has(data.flow.state);
            await __classPrivateFieldGet(this, _RedisDistributedTransactionStorage_instances, "m", _RedisDistributedTransactionStorage_preventRaceConditionExecutionIfNecessary).call(this, {
                data: data,
                key,
                options,
                storedData,
            });
            // Only set if not exists
            const shouldSetNX = data.flow.state === utils_1.TransactionState.NOT_STARTED &&
                !data.flow.transactionId.startsWith("auto-");
            if (retentionTime) {
                Object.assign(data, {
                    retention_time: retentionTime,
                });
            }
            const execPipeline = () => {
                const stringifiedData = JSON.stringify({
                    errors: data.errors,
                    flow: data.flow,
                });
                const pipeline = this.redisClient.pipeline();
                if (!hasFinished) {
                    if (ttl) {
                        if (shouldSetNX) {
                            pipeline.set(key, stringifiedData, "EX", ttl, "NX");
                        }
                        else {
                            pipeline.set(key, stringifiedData, "EX", ttl);
                        }
                    }
                    else {
                        if (shouldSetNX) {
                            pipeline.set(key, stringifiedData, "NX");
                        }
                        else {
                            pipeline.set(key, stringifiedData);
                        }
                    }
                }
                else {
                    pipeline.unlink(key);
                }
                return pipeline.exec().then((result) => {
                    if (!shouldSetNX) {
                        return result;
                    }
                    const actionResult = result?.pop();
                    const isOk = !!actionResult?.pop();
                    if (!isOk) {
                        throw new orchestration_1.SkipExecutionError("Transaction already started for transactionId: " +
                            data.flow.transactionId);
                    }
                    return result;
                });
            };
            // Parallelize DB and Redis operations for better performance
            if (hasFinished && !retentionTime) {
                if (!data.flow.metadata?.parentStepIdempotencyKey) {
                    await (0, utils_1.promiseAll)([this.deleteFromDb(data), execPipeline()]);
                }
                else {
                    await (0, utils_1.promiseAll)([this.saveToDb(data, retentionTime), execPipeline()]);
                }
            }
            else {
                await (0, utils_1.promiseAll)([this.saveToDb(data, retentionTime), execPipeline()]);
            }
            return data;
        }
        finally {
            if (lockAcquired) {
                await __classPrivateFieldGet(this, _RedisDistributedTransactionStorage_instances, "m", _RedisDistributedTransactionStorage_releaseLock).call(this, key);
            }
        }
    }
    async scheduleRetry(transaction, step, timestamp, interval) {
        await this.queue.add(JobType.RETRY, {
            workflowId: transaction.modelId,
            transactionId: transaction.transactionId,
            transactionMetadata: transaction.getFlow().metadata,
            stepId: step.id,
        }, {
            delay: interval > 0 ? interval * 1000 : undefined,
            jobId: this.getJobId(JobType.RETRY, transaction, step, interval),
            removeOnComplete: true,
        });
    }
    async clearRetry(transaction, step) {
        // Pass retry interval to ensure we remove the correct job (with -retry suffix if interval > 0)
        const interval = step.definition.retryInterval ||
            step.definition.retryIntervalAwaiting ||
            0;
        await this.removeJob(JobType.RETRY, transaction, step, interval);
    }
    async scheduleTransactionTimeout(transaction, _, interval) {
        await this.queue.add(JobType.TRANSACTION_TIMEOUT, {
            workflowId: transaction.modelId,
            transactionId: transaction.transactionId,
            transactionMetadata: transaction.getFlow().metadata,
        }, {
            delay: interval * 1000,
            jobId: this.getJobId(JobType.TRANSACTION_TIMEOUT, transaction),
            removeOnComplete: true,
        });
    }
    async clearTransactionTimeout(transaction) {
        await this.removeJob(JobType.TRANSACTION_TIMEOUT, transaction);
    }
    async scheduleStepTimeout(transaction, step, timestamp, interval) {
        await this.queue.add(JobType.STEP_TIMEOUT, {
            workflowId: transaction.modelId,
            transactionId: transaction.transactionId,
            transactionMetadata: transaction.getFlow().metadata,
            stepId: step.id,
        }, {
            delay: interval * 1000,
            jobId: this.getJobId(JobType.STEP_TIMEOUT, transaction, step),
            removeOnComplete: true,
        });
    }
    async clearStepTimeout(transaction, step) {
        await this.removeJob(JobType.STEP_TIMEOUT, transaction, step);
    }
    getJobId(type, transaction, step, interval) {
        const key = [type, transaction.modelId, transaction.transactionId];
        if (step) {
            key.push(step.id);
            // Step timeout has a single job per step
            if (type !== JobType.STEP_TIMEOUT) {
                key.push(step.attempts + "");
            }
            // Add suffix for retry scheduling (interval > 0) to avoid collision with async execution (interval = 0)
            if (type === JobType.RETRY && (0, utils_1.isDefined)(interval) && interval > 0) {
                key.push("retry");
            }
            if (step.isCompensating()) {
                key.push("compensate");
            }
        }
        return key.join(":");
    }
    async removeJob(type, transaction, step, interval) {
        const jobId = this.getJobId(type, transaction, step, interval);
        if (type === JobType.SCHEDULE) {
            const job = await this.jobQueue?.getJob(jobId);
            if (job) {
                await job.remove();
            }
        }
        else {
            const job = await this.queue.getJob(jobId);
            if (job && job.attemptsStarted === 0) {
                await job.remove();
            }
        }
    }
    /* Scheduler storage methods */
    async schedule(jobDefinition, schedulerOptions) {
        const jobId = typeof jobDefinition === "string" ? jobDefinition : jobDefinition.jobId;
        if ("cron" in schedulerOptions && "interval" in schedulerOptions) {
            throw new Error(`Unable to register a job with both scheduler options interval and cron.`);
        }
        const repeatOptions = {
            limit: schedulerOptions.numberOfExecutions,
            key: `${JobType.SCHEDULE}_${jobId}`,
        };
        if ("cron" in schedulerOptions) {
            repeatOptions.pattern = schedulerOptions.cron;
        }
        else {
            repeatOptions.every = schedulerOptions.interval;
        }
        // If it is the same key (eg. the same workflow name), the old one will get overridden.
        await this.jobQueue?.add(JobType.SCHEDULE, {
            jobId,
            schedulerOptions,
        }, {
            repeat: repeatOptions,
            removeOnComplete: {
                age: 86400,
                count: 1000,
            },
            removeOnFail: {
                age: 604800,
                count: 5000,
            },
        });
    }
    async remove(jobId) {
        await this.jobQueue?.removeRepeatableByKey(`${JobType.SCHEDULE}_${jobId}`);
    }
    async removeAll() {
        return await this.removeAllRepeatableJobs(this.jobQueue);
    }
    async removeAllRepeatableJobs(queue) {
        const repeatableJobs = (await queue.getRepeatableJobs()) ?? [];
        await (0, utils_1.promiseAll)(repeatableJobs.map((job) => queue.removeRepeatableByKey(job.key)));
    }
    async clearExpiredExecutions() {
        await this.workflowExecutionService_.delete({
            retention_time: {
                $ne: null,
            },
            updated_at: {
                $lte: (0, core_1.raw)((_alias) => `CURRENT_TIMESTAMP - (INTERVAL '1 second' * "retention_time")`),
            },
            state: {
                $in: [
                    utils_1.TransactionState.DONE,
                    utils_1.TransactionState.FAILED,
                    utils_1.TransactionState.REVERTED,
                ],
            },
        });
    }
}
exports.RedisDistributedTransactionStorage = RedisDistributedTransactionStorage;
_RedisDistributedTransactionStorage_isWorkerMode = new WeakMap(), _RedisDistributedTransactionStorage_instances = new WeakSet(), _RedisDistributedTransactionStorage_getLockKey = function _RedisDistributedTransactionStorage_getLockKey(key) {
    return `${key}:lock`;
}, _RedisDistributedTransactionStorage_acquireLock = async function _RedisDistributedTransactionStorage_acquireLock(key, ttlSeconds = 2) {
    const lockKey = __classPrivateFieldGet(this, _RedisDistributedTransactionStorage_instances, "m", _RedisDistributedTransactionStorage_getLockKey).call(this, key);
    const result = await this.redisClient.set(lockKey, 1, "EX", ttlSeconds, "NX");
    return result === "OK";
}, _RedisDistributedTransactionStorage_releaseLock = async function _RedisDistributedTransactionStorage_releaseLock(key) {
    const lockKey = __classPrivateFieldGet(this, _RedisDistributedTransactionStorage_instances, "m", _RedisDistributedTransactionStorage_getLockKey).call(this, key);
    await this.redisClient.del(lockKey);
}, _RedisDistributedTransactionStorage_preventRaceConditionExecutionIfNecessary = async function _RedisDistributedTransactionStorage_preventRaceConditionExecutionIfNecessary({ data, key, options, storedData, }) {
    const isInitialCheckpoint = [utils_1.TransactionState.NOT_STARTED].includes(data.flow.state);
    /**
     * In case many execution can succeed simultaneously, we need to ensure that the latest
     * execution does continue if a previous execution is considered finished
     */
    const currentFlow = data.flow;
    let data_ = storedData ?? {};
    if (!storedData) {
        const rawData = await this.redisClient.get(key);
        if (rawData) {
            data_ = JSON.parse(rawData);
        }
        else {
            // Pass cached raw data to avoid redundant Redis fetch
            const getOptions = {
                ...options,
                isCancelling: !!data.flow.cancelledAt,
                _cachedRawData: rawData,
            };
            data_ =
                (await this.get(key, getOptions)) ??
                    { flow: {} };
        }
    }
    const { flow: latestUpdatedFlow } = data_;
    if (options?.stepId) {
        const stepId = options.stepId;
        const currentStep = data.flow.steps[stepId];
        const latestStep = latestUpdatedFlow.steps?.[stepId];
        if (latestStep && currentStep) {
            const isCompensating = data.flow.state === utils_1.TransactionState.COMPENSATING;
            const latestState = isCompensating
                ? latestStep.compensate?.state
                : latestStep.invoke?.state;
            const shouldSkip = doneStates.has(latestState);
            if (shouldSkip) {
                throw new orchestration_1.SkipStepAlreadyFinishedError(`Step ${stepId} already finished by another execution`);
            }
        }
    }
    if (!isInitialCheckpoint &&
        !(0, utils_1.isPresent)(latestUpdatedFlow) &&
        !data.flow.metadata?.parentStepIdempotencyKey) {
        /**
         * the initial checkpoint expect no other checkpoint to have been stored.
         * In case it is not the initial one and another checkpoint is trying to
         * find if a concurrent execution has finished, we skip the execution.
         * The already finished execution would have deleted the checkpoint already.
         */
        throw new orchestration_1.SkipExecutionError("Already finished by another execution");
    }
    // Ensure that the latest execution was not cancelled, otherwise we skip the execution
    const latestTransactionCancelledAt = latestUpdatedFlow.cancelledAt;
    const currentTransactionCancelledAt = currentFlow.cancelledAt;
    if (!!latestTransactionCancelledAt &&
        currentTransactionCancelledAt == null) {
        throw new orchestration_1.SkipCancelledExecutionError("Workflow execution has been cancelled during the execution");
    }
};
//# sourceMappingURL=workflow-orchestrator-storage.js.map