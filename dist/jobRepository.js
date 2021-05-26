"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.JobRepository = void 0;
const nedb_1 = __importDefault(require("nedb"));
const state_1 = require("./state");
class JobRepository {
    constructor(dbOptions = {}) {
        this.db = new nedb_1.default(dbOptions);
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
            this.db.find({ type, state: state_1.State.INACTIVE })
                .sort({ priority: -1, createdAt: 1 })
                .limit(1)
                .exec((error, docs) => {
                if (error !== null) {
                    reject(error);
                    return;
                }
                resolve((docs.length === 0) ? null : docs[0]);
            });
        });
    }
    isExistJob(id) {
        return new Promise((resolve, reject) => {
            this.db.count({ _id: id }, (error, count) => {
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
                resolve(doc);
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
    removeJob(id) {
        return new Promise((resolve, reject) => {
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
exports.JobRepository = JobRepository;
