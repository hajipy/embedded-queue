/// <reference types="node" />
import { EventEmitter } from "events";
import { Job } from "./job";
import { DbOptions, JobRepository } from "./jobRepository";
import { Priority } from "./priority";
import { State } from "./state";
import { Worker } from "./worker";
export interface CreateJobData {
    type: string;
    priority?: Priority;
    data?: unknown;
}
export declare type Processor = (job: Job) => Promise<unknown>;
interface WaitingWorkerRequest {
    resolve: (value: Job) => void;
    reject: (error: Error) => void;
}
export declare class Queue extends EventEmitter {
    static createQueue(dbOptions?: DbOptions): Promise<Queue>;
    protected static sanitizePriority(priority: number): Priority;
    protected readonly repository: JobRepository;
    protected _workers: Worker[];
    protected waitingWorker: {
        [type: string]: WaitingWorkerRequest[];
    };
    get workers(): Worker[];
    protected constructor(dbOptions?: DbOptions);
    createJob(data: CreateJobData): Promise<Job>;
    process(type: string, processor: Processor, concurrency: number): void;
    shutdown(timeoutMilliseconds: number, type?: string | undefined): Promise<void>;
    findJob(id: string): Promise<Job | null>;
    listJobs(state?: State): Promise<Job[]>;
    removeJobById(id: string): Promise<void>;
    removeJobsByCallback(callback: (job: Job) => boolean): Promise<Job[]>;
    /** @package */
    findInactiveJobByType(type: string): Promise<Job>;
    /** @package */
    isExistJob(job: Job): Promise<boolean>;
    /** @package */
    addJob(job: Job): Promise<void>;
    /** @package */
    updateJob(job: Job): Promise<void>;
    /** @package */
    removeJob(job: Job): Promise<void>;
    protected cleanupAfterUnexpectedlyTermination(): Promise<void>;
}
export {};
