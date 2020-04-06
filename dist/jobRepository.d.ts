import DataStore, { DataStoreOptions } from "nedb";
import { Job } from "./job";
import { State } from "./state";
export interface NeDbJob {
    _id: string;
    type: string;
    priority: number;
    data?: unknown;
    createdAt: Date;
    updatedAt: Date;
    startedAt?: Date;
    completedAt?: Date;
    failedAt?: Date;
    state?: State;
    duration?: number;
    progress?: number;
    logs: string[];
}
export declare type DbOptions = DataStoreOptions;
interface WaitingWorkerRequest {
    resolve: (value: NeDbJob) => void;
    reject: (error: Error) => void;
}
export declare class JobRepository {
    protected readonly db: DataStore;
    protected waitingWorker: {
        [type: string]: WaitingWorkerRequest[];
    };
    constructor(dbOptions?: DbOptions);
    init(): Promise<void>;
    listJobs(state?: State): Promise<NeDbJob[]>;
    findJob(id: string): Promise<NeDbJob | null>;
    findInactiveJobByType(type: string): Promise<NeDbJob>;
    isExistJob(id: string): Promise<boolean>;
    addJob(job: Job): Promise<void>;
    updateJob(job: Job): Promise<void>;
    removeJob(id: string): Promise<void>;
}
export {};
