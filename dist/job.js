"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const event_1 = require("./event");
const priority_1 = require("./priority");
const state_1 = require("./state");
class Job {
    constructor(data) {
        this.queue = data.queue;
        this.id = data.id;
        this.type = data.type;
        this._priority = data.priority || priority_1.Priority.NORMAL;
        this.data = data.data;
        this._state = data.state || state_1.State.INACTIVE;
        this._createdAt = data.createdAt;
        this._updatedAt = data.updatedAt;
        this._startedAt = data.startedAt;
        this._completedAt = data.completedAt;
        this._failedAt = data.failedAt;
        this._logs = [...data.logs];
        this._saved = data.saved;
    }
    // tslint:enable:variable-name
    get priority() {
        return this._priority;
    }
    get createdAt() {
        return this._createdAt;
    }
    get updatedAt() {
        return this._updatedAt;
    }
    // noinspection JSUnusedGlobalSymbols
    get startedAt() {
        return this._startedAt;
    }
    // noinspection JSUnusedGlobalSymbols
    get completedAt() {
        return this._completedAt;
    }
    // noinspection JSUnusedGlobalSymbols
    get failedAt() {
        return this._failedAt;
    }
    get state() {
        return this._state;
    }
    get duration() {
        return this._duration;
    }
    get progress() {
        return this._progress;
    }
    get logs() {
        return [...this._logs];
    }
    async setProgress(completed, total) {
        this._progress = Math.min(100, completed * 100 / total);
        this._updatedAt = new Date();
        await this.update();
        this.queue.emit(event_1.Event.Progress, this, this._progress);
    }
    async addLog(message) {
        this._logs.push(message);
        this._updatedAt = new Date();
        await this.update();
        this.queue.emit(event_1.Event.Log, this);
    }
    async save() {
        if (this._saved) {
            await this.update();
        }
        else {
            await this.queue.addJob(this);
            this._saved = true;
            this.queue.emit(event_1.Event.Enqueue, this);
        }
        return this;
    }
    async remove() {
        await this.queue.removeJob(this);
        this.queue.emit(event_1.Event.Remove, this);
    }
    async setPriority(value) {
        this._priority = value;
        this._updatedAt = new Date();
        await this.update();
        this.queue.emit(event_1.Event.Priority, this);
    }
    async isExist() {
        return this.queue.isExistJob(this);
    }
    /** @package */
    async setStateToActive() {
        this._state = state_1.State.ACTIVE;
        const now = new Date();
        this._startedAt = now;
        this._updatedAt = now;
        await this.update();
        this.queue.emit(event_1.Event.Start, this);
    }
    /** @package */
    async setStateToComplete(result) {
        this._state = state_1.State.COMPLETE;
        const now = new Date();
        this._completedAt = now;
        if (this._startedAt !== undefined) {
            this._duration = now.getTime() - this._startedAt.getTime();
        }
        this._updatedAt = now;
        await this.update();
        this.queue.emit(event_1.Event.Complete, this, result);
    }
    /** @package */
    async setStateToFailure(error) {
        this._state = state_1.State.FAILURE;
        const now = new Date();
        this._failedAt = now;
        this._updatedAt = now;
        await this.update();
        this.queue.emit(event_1.Event.Failure, this, error);
    }
    async update() {
        await this.queue.updateJob(this);
    }
}
exports.Job = Job;
