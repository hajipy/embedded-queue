"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Queue = void 0;
const events_1 = require("events");
const await_semaphore_1 = require("await-semaphore");
const uuid_1 = require("uuid");
const event_1 = require("./event");
const job_1 = require("./job");
const jobRepository_1 = require("./jobRepository");
const priority_1 = require("./priority");
const state_1 = require("./state");
const worker_1 = require("./worker");
class Queue extends events_1.EventEmitter {
    constructor(dbOptions) {
        super();
        this.repository = new jobRepository_1.JobRepository(dbOptions);
        this._workers = [];
        this.waitingRequests = {};
        this.requestJobForProcessingMutex = new await_semaphore_1.Mutex();
    }
    static async createQueue(dbOptions) {
        const queue = new Queue(dbOptions);
        await queue.repository.init();
        await queue.cleanupAfterUnexpectedlyTermination();
        return queue;
    }
    static sanitizePriority(priority) {
        switch (priority) {
            case priority_1.Priority.LOW:
            case priority_1.Priority.NORMAL:
            case priority_1.Priority.MEDIUM:
            case priority_1.Priority.HIGH:
            case priority_1.Priority.CRITICAL:
                return priority;
        }
        console.warn(`Invalid Priority: ${priority}`);
        return priority_1.Priority.NORMAL;
    }
    get workers() {
        return [...this._workers];
    }
    async createJob(data) {
        const now = new Date();
        const job = new job_1.Job(Object.assign({}, data, {
            queue: this,
            id: (0, uuid_1.v4)(),
            createdAt: now,
            updatedAt: now,
            logs: [],
            saved: false,
        }));
        return await job.save();
    }
    process(type, processor, concurrency) {
        for (let i = 0; i < concurrency; i++) {
            const worker = new worker_1.Worker({
                type,
                queue: this,
            });
            worker.start(processor);
            this._workers.push(worker);
        }
    }
    async shutdown(timeoutMilliseconds, type) {
        const shutdownWorkers = [];
        for (const worker of this._workers) {
            if (type !== undefined && worker.type !== type) {
                continue;
            }
            await worker.shutdown(timeoutMilliseconds);
            shutdownWorkers.push(worker);
        }
        this._workers = this._workers.filter((worker) => {
            return shutdownWorkers.includes(worker) === false;
        });
    }
    async findJob(id) {
        try {
            const neDbJob = await this.repository.findJob(id);
            if (neDbJob === null) {
                return null;
            }
            return this.convertNeDbJobToJob(neDbJob);
        }
        catch (error) {
            this.emit(event_1.Event.Error, error);
            throw error;
        }
    }
    async listJobs(state) {
        try {
            return await this.repository.listJobs(state).then((docs) => {
                return docs.map((neDbJob) => this.convertNeDbJobToJob(neDbJob));
            });
        }
        catch (error) {
            this.emit(event_1.Event.Error, error);
            throw error;
        }
    }
    async removeJobById(id) {
        let neDbJob;
        try {
            neDbJob = await this.repository.findJob(id);
        }
        catch (error) {
            this.emit(event_1.Event.Error, error);
            throw error;
        }
        if (neDbJob === null) {
            throw new Error(`Job(id:${id}) is not found.`);
        }
        const job = this.convertNeDbJobToJob(neDbJob);
        try {
            return await job.remove();
        }
        catch (error) {
            this.emit(event_1.Event.Error, error, job);
            throw error;
        }
    }
    async removeJobsByCallback(callback) {
        const removedJobs = [];
        let job;
        try {
            const neDbJobs = await this.repository.listJobs();
            for (const neDbJob of neDbJobs) {
                job = this.convertNeDbJobToJob(neDbJob);
                if (callback(job)) {
                    removedJobs.push(job);
                    await job.remove();
                }
                job = undefined;
            }
        }
        catch (error) {
            this.emit(event_1.Event.Error, error, job);
            throw error;
        }
        return removedJobs;
    }
    /** @package */
    async requestJobForProcessing(type, stillRequest) {
        // すでにジョブの作成を待っているリクエストがあれば、行列の末尾に足す
        if (this.waitingRequests[type] !== undefined && this.waitingRequests[type].length > 0) {
            return new Promise((resolve, reject) => {
                this.waitingRequests[type].push({ resolve, reject, stillRequest });
            });
        }
        // 同じジョブを多重処理しないように排他制御
        const releaseMutex = await this.requestJobForProcessingMutex.acquire();
        try {
            const neDbJob = await this.repository.findInactiveJobByType(type);
            if (neDbJob === null) {
                if (this.waitingRequests[type] === undefined) {
                    this.waitingRequests[type] = [];
                }
                return new Promise((resolve, reject) => {
                    this.waitingRequests[type].push({ resolve, reject, stillRequest });
                });
            }
            if (stillRequest()) {
                const job = this.convertNeDbJobToJob(neDbJob);
                await job.setStateToActive();
                return job;
            }
            else {
                return null;
            }
        }
        catch (error) {
            this.emit(event_1.Event.Error, error);
            throw error;
        }
        finally {
            releaseMutex();
        }
    }
    /** @package */
    async isExistJob(job) {
        return await this.repository.isExistJob(job.id);
    }
    /** @package */
    async addJob(job) {
        try {
            const neDbJob = await this.repository.addJob(job);
            if (this.waitingRequests[job.type] === undefined) {
                return;
            }
            let processRequest = undefined;
            while (processRequest === undefined) {
                const headRequest = this.waitingRequests[job.type].shift();
                if (headRequest === undefined) {
                    break;
                }
                if (headRequest.stillRequest()) {
                    processRequest = headRequest;
                }
            }
            if (processRequest === undefined) {
                return;
            }
            const addedJob = this.convertNeDbJobToJob(neDbJob);
            await addedJob.setStateToActive();
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            process.nextTick(() => processRequest.resolve(addedJob));
        }
        catch (error) {
            this.emit(event_1.Event.Error, error, job);
            throw error;
        }
    }
    /** @package */
    async updateJob(job) {
        try {
            return await this.repository.updateJob(job);
        }
        catch (error) {
            this.emit(event_1.Event.Error, error, job);
            throw error;
        }
    }
    /** @package */
    async removeJob(job) {
        try {
            return await this.repository.removeJob(job.id);
        }
        catch (error) {
            this.emit(event_1.Event.Error, error, job);
            throw error;
        }
    }
    async cleanupAfterUnexpectedlyTermination() {
        const jobsNeedCleanup = await this.listJobs(state_1.State.ACTIVE);
        for (const job of jobsNeedCleanup) {
            await job.setStateToFailure(new Error("unexpectedly termination"));
        }
    }
    convertNeDbJobToJob(neDbJob) {
        return new job_1.Job({
            queue: this,
            id: neDbJob._id,
            type: neDbJob.type,
            priority: Queue.sanitizePriority(neDbJob.priority),
            data: neDbJob.data,
            createdAt: neDbJob.createdAt,
            updatedAt: neDbJob.updatedAt,
            startedAt: neDbJob.startedAt,
            completedAt: neDbJob.completedAt,
            failedAt: neDbJob.failedAt,
            state: neDbJob.state,
            duration: neDbJob.duration,
            progress: neDbJob.progress,
            logs: neDbJob.logs,
            saved: true,
        });
    }
}
exports.Queue = Queue;
