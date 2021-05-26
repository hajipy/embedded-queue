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

export type DbOptions = DataStoreOptions;

export class JobRepository {
    protected readonly db: DataStore;

    public constructor(dbOptions: DbOptions = {}) {
        this.db = new DataStore(dbOptions);
    }

    public init(): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            this.db.loadDatabase((error) => {
                if (error !== null) {
                    reject(error);
                    return;
                }

                resolve();
            });
        });
    }

    public listJobs(state?: State): Promise<NeDbJob[]> {
        return new Promise<NeDbJob[]>((resolve, reject) => {
            const query = (state === undefined) ? {} : { state };

            this.db.find(query)
                .sort({ createdAt: 1 })
                .exec((error, docs: NeDbJob[]) => {
                    if (error !== null) {
                        reject(error);
                        return;
                    }

                    resolve(docs);
                });
        });
    }

    public findJob(id: string): Promise<NeDbJob | null> {
        return new Promise<NeDbJob | null>((resolve, reject) => {
            this.db.findOne({ _id: id }, (error, doc: NeDbJob| null) => {
                    if (error !== null) {
                        reject(error);
                        return;
                    }

                    resolve(doc);
                });
        });
    }

    public findInactiveJobByType(type: string): Promise<NeDbJob | null> {
        return new Promise<NeDbJob | null>((resolve, reject) => {
            this.db.find({ type, state: State.INACTIVE })
                .sort({ priority: -1, createdAt: 1 })
                .limit(1)
                .exec((error, docs: NeDbJob[]) => {
                    if (error !== null) {
                        reject(error);
                        return;
                    }

                    resolve((docs.length === 0) ? null : docs[0]);
                });
        });
    }

    public isExistJob(id: string): Promise<boolean> {
        return new Promise<boolean>((resolve, reject) => {
            this.db.count({ _id: id }, (error, count: number) => {
                if (error !== null) {
                    reject(error);
                    return;
                }

                resolve(count === 1);
            });
        });
    }

    public addJob(job: Job): Promise<NeDbJob> {
        return new Promise<NeDbJob>((resolve, reject) => {
            const insertDoc = {
                _id: job.id,
                type: job.type,
                priority: job.priority,
                data: job.data,
                createdAt: job.createdAt,
                updatedAt: job.updatedAt,
                state: job.state,
                logs: job.logs,
            };

            this.db.insert(insertDoc, (error, doc) => {
                if (error !== null) {
                    reject(error);
                    return;
                }

                resolve(doc);
            });
        });
    }

    public updateJob(job: Job): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            const query = {
                _id: job.id,
            };
            const updateQuery = {
                $set: {
                    priority: job.priority,
                    data: job.data,
                    createdAt: job.createdAt,
                    updatedAt: job.updatedAt,
                    startedAt: job.startedAt,
                    completedAt: job.completedAt,
                    failedAt: job.failedAt,
                    state: job.state,
                    duration: job.duration,
                    progress: job.progress,
                    logs: job.logs,
                },
            };

            this.db.update(query, updateQuery, {}, (error, numAffected) => {
                if (error !== null) {
                    reject(error);
                    return;
                }

                if (numAffected !== 1) {
                    reject(new Error(`update unexpected number of rows. (expected: 1, actual: ${numAffected})`));
                }

                resolve();
            });
        });
    }

    public removeJob(id: string): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            this.db.remove({ _id: id }, (error) => {
                if (error) {
                    reject(error);
                    return;
                }

                resolve();
            });
        });
    }
}
