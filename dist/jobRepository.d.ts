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
export declare class JobRepository {
    protected readonly db: DataStore;
    constructor(dbOptions?: DbOptions);
    init(): Promise<void>;
    listJobs(state?: State): Promise<NeDbJob[]>;
    findJob(id: string): Promise<NeDbJob | null>;
    findInactiveJobByType(type: string): Promise<NeDbJob | null>;
    isExistJob(id: string): Promise<boolean>;
    addJob(job: Job): Promise<NeDbJob>;
    updateJob(job: Job): Promise<void>;
    removeJob(id: string): Promise<void>;
}
