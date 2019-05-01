import DataStore from "nedb";
import { Job } from "./job";
import { State } from "./state";
interface INeDbJob {
    _id: string;
    type: string;
    priority: number;
    data?: any;
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
export declare class JobRepository {
    protected readonly db: DataStore;
    protected waitingWorkers: any;
    constructor(dbOptions?: any);
    init(): Promise<void>;
    listJobs(state?: State): Promise<INeDbJob[]>;
    findJob(id: string): Promise<INeDbJob>;
    findInactiveJobByType(type: string): Promise<INeDbJob>;
    isExistJob(job: Job): Promise<boolean>;
    addJob(job: Job): Promise<void>;
    updateJob(job: Job): Promise<void>;
    removeJob(job: Job): Promise<void>;
}
export {};
