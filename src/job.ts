import { Event } from "./event";
import { Priority } from "./priority";
import { Queue } from "./queue";
import { State } from "./state";

export interface JobConstructorData {
    queue: Queue;
    id: string;
    type: string;
    priority?: Priority;
    data?: unknown;
    createdAt: Date;
    updatedAt: Date;
    startedAt?: Date;
    completedAt?: Date;
    failedAt?: Date;
    state?: State;
    logs: string[];
    saved: boolean;
}

export class Job {
    public readonly id: string;
    public readonly type: string;
    public readonly data: unknown | undefined;

    protected readonly queue: Queue;

    // tslint:disable:variable-name
    protected _priority: Priority;
    protected _createdAt: Date;
    protected _updatedAt: Date;
    protected _startedAt: Date | undefined;
    protected _completedAt: Date | undefined;
    protected _failedAt: Date | undefined;
    protected _state: State;
    protected _duration: number | undefined;
    protected _progress: number | undefined;
    protected _logs: string[];
    protected _saved: boolean;
    // tslint:enable:variable-name

    public get priority(): Priority {
        return this._priority;
    }

    public get createdAt(): Date {
        return this._createdAt;
    }

    public get updatedAt(): Date {
        return this._updatedAt;
    }

    // noinspection JSUnusedGlobalSymbols
    public get startedAt(): Date | undefined {
        return this._startedAt;
    }

    // noinspection JSUnusedGlobalSymbols
    public get completedAt(): Date | undefined {
        return this._completedAt;
    }

    // noinspection JSUnusedGlobalSymbols
    public get failedAt(): Date | undefined {
        return this._failedAt;
    }

    public get state(): State {
        return this._state;
    }

    public get duration(): number | undefined {
        return this._duration;
    }

    public get progress(): number | undefined {
        return this._progress;
    }

    public get logs(): string[] {
        return [...this._logs];
    }

    public constructor(data: JobConstructorData) {
        this.queue = data.queue;

        this.id = data.id;
        this.type = data.type;
        this._priority = data.priority || Priority.NORMAL;
        this.data = data.data;
        this._state = data.state || State.INACTIVE;
        this._createdAt = data.createdAt;
        this._updatedAt = data.updatedAt;
        this._startedAt = data.startedAt;
        this._completedAt = data.completedAt;
        this._failedAt = data.failedAt;
        this._logs = [...data.logs];
        this._saved = data.saved;
    }

    public async setProgress(completed: number, total: number): Promise<void> {
        this._progress = Math.min(100, completed * 100 / total);
        this._updatedAt = new Date();

        await this.update();

        this.queue.emit(Event.Progress, this, this._progress);
    }

    public async addLog(message: string): Promise<void> {
        this._logs.push(message);

        this._updatedAt = new Date();

        await this.update();

        this.queue.emit(Event.Log, this);
    }

    public async save(): Promise<Job> {
        if (this._saved) {
            await this.update();
        }
        else {
            await this.queue.addJob(this);
            this._saved = true;

            this.queue.emit(Event.Enqueue, this);
        }

        return this;
    }

    public async remove(): Promise<void> {
        await this.queue.removeJob(this);

        this.queue.emit(Event.Remove, this);
    }

    public async setPriority(value: Priority): Promise<void> {
        this._priority = value;

        this._updatedAt = new Date();

        await this.update();

        this.queue.emit(Event.Priority, this);
    }

    public async isExist(): Promise<boolean> {
        return this.queue.isExistJob(this);
    }

    /** @package */
    public async setStateToActive(): Promise<void> {
        this._state = State.ACTIVE;

        const now = new Date();
        this._startedAt = now;
        this._updatedAt = now;

        await this.update();

        this.queue.emit(Event.Start, this);
    }

    /** @package */
    public async setStateToComplete(result?: unknown): Promise<void> {
        this._state = State.COMPLETE;

        const now = new Date();
        this._completedAt = now;
        if (this._startedAt !== undefined) {
            this._duration = now.getTime() - this._startedAt.getTime();
        }
        this._updatedAt = now;

        await this.update();

        this.queue.emit(Event.Complete, this, result);
    }

    /** @package */
    public async setStateToFailure(error: Error): Promise<void> {
        this._state = State.FAILURE;

        const now = new Date();
        this._failedAt = now;
        this._updatedAt = now;

        await this.update();

        this.queue.emit(Event.Failure, this, error);
    }

    protected async update(): Promise<void> {
        await this.queue.updateJob(this);
    }
}
