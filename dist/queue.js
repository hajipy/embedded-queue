"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const events_1 = require("events");
const v4_1 = __importDefault(require("uuid/v4"));
const event_1 = require("./event");
const job_1 = require("./job");
const jobRepository_1 = require("./jobRepository");
const priority_1 = require("./priority");
const worker_1 = require("./worker");
class Queue extends events_1.EventEmitter {
    static async createQueue(dbOptions) {
        const queue = new Queue(dbOptions);
        await queue.repository.init();
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
    // tslint:disable:variable-name
    get workers() {
        return [...this._workers];
    }
    constructor(dbOptions) {
        super();
        this.repository = new jobRepository_1.JobRepository(dbOptions);
        this._workers = [];
    }
    createJob(data) {
        const now = new Date();
        return new job_1.Job(Object.assign({}, data, {
            queue: this,
            id: v4_1.default(),
            createdAt: now,
            updatedAt: now,
            logs: [],
            saved: false,
        }));
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
    shutdown(timeoutMilliseconds, type) {
        return new Promise(async (resolve) => {
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
            resolve();
        });
    }
    async findJob(id) {
        try {
            const doc = await this.repository.findJob(id);
            if (doc === null) {
                return null;
            }
            return new job_1.Job({
                queue: this,
                id: doc._id,
                type: doc.type,
                priority: Queue.sanitizePriority(doc.priority),
                data: doc.data,
                createdAt: doc.createdAt,
                updatedAt: doc.updatedAt,
                startedAt: doc.startedAt,
                completedAt: doc.completedAt,
                failedAt: doc.failedAt,
                state: doc.state,
                logs: doc.logs,
                saved: true,
            });
        }
        catch (error) {
            this.emit(event_1.Event.Error, error);
            throw error;
        }
    }
    async listJobs(state) {
        try {
            return await this.repository.listJobs(state).then((docs) => {
                return docs.map((doc) => {
                    return new job_1.Job({
                        queue: this,
                        id: doc._id,
                        type: doc.type,
                        priority: Queue.sanitizePriority(doc.priority),
                        data: doc.data,
                        createdAt: doc.createdAt,
                        updatedAt: doc.updatedAt,
                        startedAt: doc.startedAt,
                        completedAt: doc.completedAt,
                        failedAt: doc.failedAt,
                        state: doc.state,
                        logs: doc.logs,
                        saved: true,
                    });
                });
            });
        }
        catch (error) {
            this.emit(event_1.Event.Error, error);
            throw error;
        }
    }
    async removeJobById(id) {
        let job;
        try {
            const doc = await this.repository.findJob(id);
            job = new job_1.Job({
                queue: this,
                id: doc._id,
                type: doc.type,
                priority: Queue.sanitizePriority(doc.priority),
                data: doc.data,
                createdAt: doc.createdAt,
                updatedAt: doc.updatedAt,
                startedAt: doc.startedAt,
                completedAt: doc.completedAt,
                failedAt: doc.failedAt,
                state: doc.state,
                logs: doc.logs,
                saved: true,
            });
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
            const docs = await this.repository.listJobs();
            for (const doc of docs) {
                job = new job_1.Job({
                    queue: this,
                    id: doc._id,
                    type: doc.type,
                    priority: Queue.sanitizePriority(doc.priority),
                    data: doc.data,
                    createdAt: doc.createdAt,
                    updatedAt: doc.updatedAt,
                    startedAt: doc.startedAt,
                    completedAt: doc.completedAt,
                    failedAt: doc.failedAt,
                    state: doc.state,
                    logs: doc.logs,
                    saved: true,
                });
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
    async findInactiveJobByType(type) {
        try {
            return this.repository.findInactiveJobByType(type).then((doc) => {
                return new job_1.Job({
                    queue: this,
                    id: doc._id,
                    type: doc.type,
                    priority: Queue.sanitizePriority(doc.priority),
                    data: doc.data,
                    createdAt: doc.createdAt,
                    updatedAt: doc.updatedAt,
                    startedAt: doc.startedAt,
                    completedAt: doc.completedAt,
                    failedAt: doc.failedAt,
                    state: doc.state,
                    logs: doc.logs,
                    saved: true,
                });
            });
        }
        catch (error) {
            this.emit(event_1.Event.Error, error);
            throw error;
        }
    }
    /** @package */
    async isExistJob(job) {
        return await this.repository.isExistJob(job);
    }
    /** @package */
    async addJob(job) {
        try {
            return await this.repository.addJob(job);
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
            return await this.repository.removeJob(job);
        }
        catch (error) {
            this.emit(event_1.Event.Error, error, job);
            throw error;
        }
    }
}
exports.Queue = Queue;
