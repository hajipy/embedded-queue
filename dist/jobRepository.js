"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const nedb_1 = __importDefault(require("nedb"));
const state_1 = require("./state");
class JobRepository {
    constructor(dbOptions = {}) {
        this.db = new nedb_1.default(Object.assign({}, dbOptions, { timestampData: true }));
        this.waitingWorkers = {};
    }
    init() {
        return new Promise((resolve, reject) => {
            this.db.loadDatabase((error) => {
                if (error !== null) {
                    reject(error);
                    return;
                }
                resolve();
            });
        });
    }
    listJobs(state) {
        return new Promise((resolve, reject) => {
            const query = (state === undefined) ? {} : { state };
            this.db.find(query)
                .sort({ createdAt: 1 })
                .exec((error, docs) => {
                if (error !== null) {
                    reject(error);
                    return;
                }
                resolve(docs);
            });
        });
    }
    findJob(id) {
        return new Promise((resolve, reject) => {
            this.db.findOne({ _id: id }, (error, doc) => {
                if (error !== null) {
                    reject(error);
                    return;
                }
                resolve(doc);
            });
        });
    }
    findInactiveJobByType(type) {
        return new Promise((resolve, reject) => {
            if (this.waitingWorkers[type] !== undefined && this.waitingWorkers[type].length > 0) {
                this.waitingWorkers[type].push({ resolve, reject });
            }
            this.db.find({ type, state: state_1.State.INACTIVE })
                .sort({ priority: -1, createdAt: 1 })
                .limit(1)
                .exec((error, docs) => {
                if (error !== null) {
                    reject(error);
                    return;
                }
                // 該当typeのジョブがない場合、新たに作成されるまで待機する
                if (docs.length === 0) {
                    if (this.waitingWorkers[type] === undefined) {
                        this.waitingWorkers[type] = [];
                    }
                    this.waitingWorkers[type].push({ resolve, reject });
                    return;
                }
                resolve(docs[0]);
            });
        });
    }
    isExistJob(job) {
        return new Promise((resolve, reject) => {
            this.db.count({ _id: job.id }, (error, count) => {
                if (error !== null) {
                    reject(error);
                    return;
                }
                resolve(count === 1);
            });
        });
    }
    addJob(job) {
        return new Promise((resolve, reject) => {
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
                if (this.waitingWorkers[type] !== undefined && this.waitingWorkers[type].length > 0) {
                    const waitingHead = this.waitingWorkers[type].shift();
                    process.nextTick(() => { waitingHead.resolve(doc); });
                }
                resolve();
            });
        });
    }
    updateJob(job) {
        return new Promise((resolve, reject) => {
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
    removeJob(job) {
        return new Promise((resolve, reject) => {
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
exports.JobRepository = JobRepository;
