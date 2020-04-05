import { EventEmitter } from "events";

import uuid from "uuid/v4";

import { Event } from "./event";
import { Job } from "./job";
import { DbOptions, JobRepository, NeDbJob } from "./jobRepository";
import { Priority } from "./priority";
import { State } from "./state";
import { Worker } from "./worker";

export interface CreateJobData {
    type: string;
    priority?: Priority;
    data?: unknown;
}

export type Processor = (job: Job) => Promise<unknown>;

export class Queue extends EventEmitter {
    public static async createQueue(dbOptions?: DbOptions): Promise<Queue> {
        const queue = new Queue(dbOptions);

        await queue.repository.init();

        await queue.cleanupAfterUnexpectedlyTermination();

        return queue;
    }

    protected static sanitizePriority(priority: number): Priority {
        switch (priority) {
            case Priority.LOW:
            case Priority.NORMAL:
            case Priority.MEDIUM:
            case Priority.HIGH:
            case Priority.CRITICAL:
                return priority;
        }

        console.warn(`Invalid Priority: ${priority}`);
        return Priority.NORMAL;
    }

    protected readonly repository: JobRepository;

    // tslint:disable:variable-name
    protected _workers: Worker[];
    // tslint:disable:variable-name

    public get workers(): Worker[] {
        return [...this._workers];
    }

    protected constructor(dbOptions?: DbOptions) {
        super();

        this.repository = new JobRepository(dbOptions);
        this._workers = [];
    }

    public async createJob(data: CreateJobData): Promise<Job> {
        const now = new Date();

        const job = new Job(
            Object.assign(
                {},
                data,
                {
                    queue: this,
                    id: uuid(),
                    createdAt: now,
                    updatedAt: now,
                    logs: [],
                    saved: false,
                }
            )
        );

        return await job.save();
    }

    public process(type: string, processor: Processor, concurrency: number): void {
        for (let i = 0; i < concurrency; i++) {
            const worker = new Worker({
                type,
                queue: this,
            });

            worker.start(processor);

            this._workers.push(worker);
        }
    }

    public async shutdown(timeoutMilliseconds: number, type?: string | undefined): Promise<void> {
        const shutdownWorkers: Worker[] = [];

        for (const worker of this._workers) {
            if (type !== undefined && worker.type !== type) {
                continue;
            }

            await worker.shutdown(timeoutMilliseconds);

            shutdownWorkers.push(worker);
        }

        this._workers = this._workers.filter(
            (worker) => {
                return shutdownWorkers.includes(worker) === false;
            }
        );
    }

    public async findJob(id: string): Promise<Job | null> {
        try {
            const doc = await this.repository.findJob(id);

            if (doc === null) {
                return null;
            }

            return new Job({
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
            this.emit(Event.Error, error);
            throw error;
        }
    }

    public async listJobs(state?: State): Promise<Job[]> {
        try {
            return await this.repository.listJobs(state).then((docs) => {
                return docs.map((doc) => {
                    return new Job({
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
            this.emit(Event.Error, error);
            throw error;
        }
    }

    public async removeJobById(id: string): Promise<void> {
        let doc: NeDbJob | null;
        try {
            doc = await this.repository.findJob(id);
        }
        catch (error) {
            this.emit(Event.Error, error);
            throw error;
        }

        if (doc === null) {
            throw new Error(`Job(id:${id}) is not found.`);
        }

        const job = new Job({
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

        try {
            return await job.remove();
        }
        catch (error) {
            this.emit(Event.Error, error, job);
            throw error;
        }
    }

    public async removeJobsByCallback(callback: (job: Job) => boolean): Promise<Job[]> {
        const removedJobs: Job[] = [];

        let job: Job | undefined;

        try {
            const docs = await this.repository.listJobs();

            for (const doc of docs) {
                job = new Job({
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
            this.emit(Event.Error, error, job);
            throw error;
        }

        return removedJobs;
    }

    /** @package */
    public async findInactiveJobByType(type: string): Promise<Job> {
        try {
            return this.repository.findInactiveJobByType(type).then((doc) => {
                return new Job({
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
            this.emit(Event.Error, error);
            throw error;
        }
    }

    /** @package */
    public async isExistJob(job: Job): Promise<boolean> {
        return await this.repository.isExistJob(job.id);
    }

    /** @package */
    public async addJob(job: Job): Promise<void> {
        try {
            return await this.repository.addJob(job);
        }
        catch (error) {
            this.emit(Event.Error, error, job);
            throw error;
        }
    }

    /** @package */
    public async updateJob(job: Job): Promise<void> {
        try {
            return await this.repository.updateJob(job);
        }
        catch (error) {
            this.emit(Event.Error, error, job);
            throw error;
        }
    }

    /** @package */
    public async removeJob(job: Job): Promise<void> {
        try {
            return await this.repository.removeJob(job);
        }
        catch (error) {
            this.emit(Event.Error, error, job);
            throw error;
        }
    }

    protected async cleanupAfterUnexpectedlyTermination(): Promise<void> {
        const jobsNeedCleanup = await this.listJobs(State.ACTIVE);

        for (const job of jobsNeedCleanup) {
            await job.setStateToFailure(new Error("unexpectedly termination"));
        }
    }
}
