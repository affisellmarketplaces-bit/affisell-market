"use strict";
var __classPrivateFieldGet = (this && this.__classPrivateFieldGet) || function (receiver, state, kind, f) {
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
    return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
};
var _InMemoryDistributedTransactionStorage_instances, _InMemoryDistributedTransactionStorage_preventRaceConditionExecutionIfNecessary;
Object.defineProperty(exports, "__esModule", { value: true });
exports.InMemoryDistributedTransactionStorage = void 0;
const core_1 = require("@medusajs/framework/mikro-orm/core");
const orchestration_1 = require("@medusajs/framework/orchestration");
const utils_1 = require("@medusajs/framework/utils");
const cron_parser_1 = require("cron-parser");
const THIRTY_MINUTES_IN_MS = 1000 * 60 * 30;
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
function calculateDelayFromExpression(expression) {
    const nextTime = expression.next().getTime();
    const now = Date.now();
    const delay = nextTime - now;
    // If the calculated delay is negative or zero, get the next occurrence
    if (delay <= 0) {
        const nextNextTime = expression.next().getTime();
        return Math.max(1, nextNextTime - now);
    }
    return delay;
}
function parseNextExecution(optionsOrExpression) {
    if (typeof optionsOrExpression === "object") {
        if ("cron" in optionsOrExpression) {
            const expression = (0, cron_parser_1.parseExpression)(optionsOrExpression.cron);
            return calculateDelayFromExpression(expression);
        }
        if ("interval" in optionsOrExpression) {
            return optionsOrExpression.interval;
        }
        return calculateDelayFromExpression(optionsOrExpression);
    }
    const result = parseInt(`${optionsOrExpression}`);
    if (isNaN(result)) {
        const expression = (0, cron_parser_1.parseExpression)(`${optionsOrExpression}`);
        return calculateDelayFromExpression(expression);
    }
    return result;
}
class InMemoryDistributedTransactionStorage {
    constructor({ workflowExecutionService, logger, }) {
        _InMemoryDistributedTransactionStorage_instances.add(this);
        this.storage = {};
        this.scheduled = new Map();
        this.retries = new Map();
        this.timeouts = new Map();
        this.pendingTimers = new Set();
        this.isLocked = new Map();
        this.workflowExecutionService_ = workflowExecutionService;
        this.logger_ = logger;
    }
    async onApplicationStart() {
        this.clearTimeout_ = setInterval(async () => {
            try {
                await this.clearExpiredExecutions();
            }
            catch { }
        }, THIRTY_MINUTES_IN_MS);
    }
    async onApplicationShutdown() {
        clearInterval(this.clearTimeout_);
        for (const timer of this.pendingTimers) {
            clearTimeout(timer);
        }
        this.pendingTimers.clear();
        for (const timer of this.retries.values()) {
            clearTimeout(timer);
        }
        this.retries.clear();
        for (const timer of this.timeouts.values()) {
            clearTimeout(timer);
        }
        this.timeouts.clear();
        // Clean up scheduled job timers
        for (const job of this.scheduled.values()) {
            clearTimeout(job.timer);
        }
        this.scheduled.clear();
    }
    setWorkflowOrchestratorService(workflowOrchestratorService) {
        this.workflowOrchestratorService_ = workflowOrchestratorService;
    }
    createManagedTimer(callback, delay) {
        const timer = setTimeout(async () => {
            this.pendingTimers.delete(timer);
            const res = callback();
            if (res instanceof Promise) {
                await res;
            }
        }, delay);
        this.pendingTimers.add(timer);
        return timer;
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
    async get(key, options) {
        const [_, workflowId, transactionId] = key.split(":");
        const trx = await this.workflowExecutionService_
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
            .catch(() => undefined);
        if (trx) {
            const { flow, errors } = this.storage[key]
                ? JSON.parse(JSON.stringify(this.storage[key]))
                : {};
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
            return new orchestration_1.TransactionCheckpoint(flow ?? trx?.execution, trx?.context?.data, errors ?? trx?.context?.errors);
        }
        return;
    }
    async save(key, data, ttl, options) {
        if (this.isLocked.has(key)) {
            throw new Error("Transaction storage is locked");
        }
        this.isLocked.set(key, true);
        try {
            /**
             * Store the retention time only if the transaction is done, failed or reverted.
             * From that moment, this tuple can be later on archived or deleted after the retention time.
             */
            const { retentionTime } = options ?? {};
            const hasFinished = finishedStates.has(data.flow.state);
            await __classPrivateFieldGet(this, _InMemoryDistributedTransactionStorage_instances, "m", _InMemoryDistributedTransactionStorage_preventRaceConditionExecutionIfNecessary).call(this, {
                data,
                key,
                options,
            });
            // Only store retention time if it's provided
            if (retentionTime) {
                Object.assign(data, {
                    retention_time: retentionTime,
                });
            }
            // Store in memory
            const isNotStarted = data.flow.state === utils_1.TransactionState.NOT_STARTED;
            const isManualTransactionId = !data.flow.transactionId.startsWith("auto-");
            if (isNotStarted && isManualTransactionId) {
                const storedData = this.storage[key];
                if (storedData) {
                    throw new orchestration_1.SkipExecutionError("Transaction already started for transactionId: " +
                        data.flow.transactionId);
                }
            }
            if (data.flow._v) {
                const storedData = await this.get(key, {
                    isCancelling: !!data.flow.cancelledAt,
                });
                orchestration_1.TransactionCheckpoint.mergeCheckpoints(data, storedData);
            }
            const { flow, context, errors } = data;
            this.storage[key] = {
                flow: JSON.parse(JSON.stringify(flow)),
                context: JSON.parse(JSON.stringify(context)),
                errors: [...errors],
            };
            // Optimize DB operations - only perform when necessary
            if (hasFinished) {
                if (!retentionTime) {
                    if (!flow.metadata?.parentStepIdempotencyKey) {
                        await this.deleteFromDb(data);
                    }
                    else {
                        await this.saveToDb(data, retentionTime);
                    }
                }
                else {
                    await this.saveToDb(data, retentionTime);
                }
                delete this.storage[key];
            }
            else {
                await this.saveToDb(data, retentionTime);
            }
            return data;
        }
        finally {
            this.isLocked.delete(key);
        }
    }
    async scheduleRetry(transaction, step, timestamp, interval) {
        const { modelId: workflowId, transactionId } = transaction;
        const key = `${workflowId}:${transactionId}:${step.id}`;
        const existingTimer = this.retries.get(key);
        if (existingTimer) {
            clearTimeout(existingTimer);
            this.pendingTimers.delete(existingTimer);
        }
        const timer = this.createManagedTimer(async () => {
            this.retries.delete(key);
            const context = transaction.getFlow().metadata ?? {};
            await this.workflowOrchestratorService_.run(workflowId, {
                transactionId,
                logOnError: true,
                throwOnError: false,
                context: {
                    eventGroupId: context.eventGroupId,
                    parentStepIdempotencyKey: context.parentStepIdempotencyKey,
                    preventReleaseEvents: context.preventReleaseEvents,
                },
            });
        }, interval * 1e3);
        this.retries.set(key, timer);
    }
    async clearRetry(transaction, step) {
        const { modelId: workflowId, transactionId } = transaction;
        const key = `${workflowId}:${transactionId}:${step.id}`;
        const timer = this.retries.get(key);
        if (timer) {
            clearTimeout(timer);
            this.pendingTimers.delete(timer);
            this.retries.delete(key);
        }
    }
    async scheduleTransactionTimeout(transaction, timestamp, interval) {
        const { modelId: workflowId, transactionId } = transaction;
        const key = `${workflowId}:${transactionId}`;
        const existingTimer = this.timeouts.get(key);
        if (existingTimer) {
            clearTimeout(existingTimer);
            this.pendingTimers.delete(existingTimer);
        }
        const timer = this.createManagedTimer(async () => {
            this.timeouts.delete(key);
            const context = transaction.getFlow().metadata ?? {};
            await this.workflowOrchestratorService_.run(workflowId, {
                transactionId,
                logOnError: true,
                throwOnError: false,
                context: {
                    eventGroupId: context.eventGroupId,
                    parentStepIdempotencyKey: context.parentStepIdempotencyKey,
                    preventReleaseEvents: context.preventReleaseEvents,
                },
            });
        }, interval * 1e3);
        this.timeouts.set(key, timer);
    }
    async clearTransactionTimeout(transaction) {
        const { modelId: workflowId, transactionId } = transaction;
        const key = `${workflowId}:${transactionId}`;
        const timer = this.timeouts.get(key);
        if (timer) {
            clearTimeout(timer);
            this.pendingTimers.delete(timer);
            this.timeouts.delete(key);
        }
    }
    async scheduleStepTimeout(transaction, step, timestamp, interval) {
        const { modelId: workflowId, transactionId } = transaction;
        const key = `${workflowId}:${transactionId}:${step.id}`;
        const existingTimer = this.timeouts.get(key);
        if (existingTimer) {
            clearTimeout(existingTimer);
            this.pendingTimers.delete(existingTimer);
        }
        const timer = this.createManagedTimer(async () => {
            this.timeouts.delete(key);
            const context = transaction.getFlow().metadata ?? {};
            await this.workflowOrchestratorService_.run(workflowId, {
                transactionId,
                logOnError: true,
                throwOnError: false,
                context: {
                    eventGroupId: context.eventGroupId,
                    parentStepIdempotencyKey: context.parentStepIdempotencyKey,
                    preventReleaseEvents: context.preventReleaseEvents,
                },
            });
        }, interval * 1e3);
        this.timeouts.set(key, timer);
    }
    async clearStepTimeout(transaction, step) {
        const { modelId: workflowId, transactionId } = transaction;
        const key = `${workflowId}:${transactionId}:${step.id}`;
        const timer = this.timeouts.get(key);
        if (timer) {
            clearTimeout(timer);
            this.pendingTimers.delete(timer);
            this.timeouts.delete(key);
        }
    }
    /* Scheduler storage methods */
    async schedule(jobDefinition, schedulerOptions) {
        const jobId = typeof jobDefinition === "string" ? jobDefinition : jobDefinition.jobId;
        // In order to ensure that the schedule configuration is always up to date, we first cancel an existing job, if there was one
        await this.remove(jobId);
        let expression;
        let nextExecution = parseNextExecution(schedulerOptions);
        if ("cron" in schedulerOptions) {
            // Cache the parsed expression to avoid repeated parsing
            expression = (0, cron_parser_1.parseExpression)(schedulerOptions.cron);
        }
        else if ("interval" in schedulerOptions) {
            expression = schedulerOptions.interval;
        }
        else {
            throw new utils_1.MedusaError(utils_1.MedusaError.Types.INVALID_ARGUMENT, "Schedule cron or interval definition is required for scheduled jobs.");
        }
        const timer = setTimeout(async () => {
            this.jobHandler(jobId);
        }, nextExecution);
        // Set the timer's unref to prevent it from keeping the process alive
        timer.unref();
        this.scheduled.set(jobId, {
            timer,
            expression,
            numberOfExecutions: 0,
            config: schedulerOptions,
        });
    }
    async remove(jobId) {
        const job = this.scheduled.get(jobId);
        if (!job) {
            return;
        }
        clearTimeout(job.timer);
        this.scheduled.delete(jobId);
    }
    async removeAll() {
        for (const [key] of this.scheduled) {
            await this.remove(key);
        }
    }
    async jobHandler(jobId) {
        const job = this.scheduled.get(jobId);
        if (!job) {
            return;
        }
        if (job.config?.numberOfExecutions !== undefined &&
            job.config.numberOfExecutions <= job.numberOfExecutions) {
            this.scheduled.delete(jobId);
            return;
        }
        const nextExecution = parseNextExecution(job.expression);
        try {
            await this.workflowOrchestratorService_.run(jobId, {
                logOnError: true,
                throwOnError: false,
            });
            const timer = this.createManagedTimer(() => {
                this.jobHandler(jobId);
            }, nextExecution);
            // Prevent timer from keeping the process alive
            timer.unref();
            this.scheduled.set(jobId, {
                timer,
                expression: job.expression,
                numberOfExecutions: (job.numberOfExecutions ?? 0) + 1,
                config: job.config,
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
exports.InMemoryDistributedTransactionStorage = InMemoryDistributedTransactionStorage;
_InMemoryDistributedTransactionStorage_instances = new WeakSet(), _InMemoryDistributedTransactionStorage_preventRaceConditionExecutionIfNecessary = async function _InMemoryDistributedTransactionStorage_preventRaceConditionExecutionIfNecessary({ data, key, options, }) {
    const isInitialCheckpoint = [utils_1.TransactionState.NOT_STARTED].includes(data.flow.state);
    /**
     * In case many execution can succeed simultaneously, we need to ensure that the latest
     * execution does continue if a previous execution is considered finished
     */
    const currentFlow = data.flow;
    const rawData = this.storage[key];
    let data_ = {};
    if (rawData) {
        data_ = rawData;
    }
    else {
        const getOptions = {
            ...options,
            isCancelling: !!data.flow.cancelledAt,
        };
        data_ =
            (await this.get(key, getOptions)) ??
                { flow: {} };
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