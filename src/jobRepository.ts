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

interface WaitingWorkerRequest {
    resolve: (value: NeDbJob) => void;
    reject: (error: Error) => void;
}

export class JobRepository {
    protected readonly db: DataStore;
    protected waitingWorker: { [type: string]: WaitingWorkerRequest[] };

    public constructor(dbOptions: DbOptions = {}) {
        this.db = new DataStore(
            Object.assign({}, dbOptions, { timestampData: true })
        );
        this.waitingWorker = {};
    }

    public init(): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            this.db.loadDatabase((error: Error) => {
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

    public findInactiveJobByType(type: string): Promise<NeDbJob> {
        return new Promise<NeDbJob>((resolve, reject) => {
            if (this.waitingWorker[type] !== undefined && this.waitingWorker[type].length > 0) {
                this.waitingWorker[type].push({ resolve, reject });
            }

            this.db.find({ type, state: State.INACTIVE })
                .sort({ priority: -1, createdAt: 1 })
                .limit(1)
                .exec((error, docs: NeDbJob[]) => {
                    if (error !== null) {
                        reject(error);
                        return;
                    }

                    // 該当typeのジョブがない場合、新たに作成されるまで待機する
                    if (docs.length === 0) {
                        if (this.waitingWorker[type] === undefined) {
                            this.waitingWorker[type] = [];
                        }

                        this.waitingWorker[type].push({ resolve, reject });
                        return;
                    }

                    resolve(docs[0]);
                });
        });
    }

    public isExistJob(job: Job): Promise<boolean> {
        return new Promise<boolean>((resolve, reject) => {
            this.db.count({ _id: job.id }, (error, count: number) => {
                if (error !== null) {
                    reject(error);
                    return;
                }

                resolve(count === 1);
            });
        });
    }

    public addJob(job: Job): Promise<void> {
        return new Promise<void>((resolve, reject) => {
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

                const type = job.type;
                if (this.waitingWorker[type] !== undefined) {
                    const waitingHead = this.waitingWorker[type].shift();

                    if (waitingHead !== undefined) {
                        process.nextTick(() => { waitingHead.resolve(doc); });
                    }
                }

                resolve();
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

    public removeJob(job: Job): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            const query = {
                _id: job.id,
            };

            this.db.remove(query, (error) => {
                if (error) {
                    reject(error);
                    return;
                }

                resolve();
            });
        });
    }
}
