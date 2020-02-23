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
export declare class Job {
    readonly id: string;
    readonly type: string;
    readonly data: unknown | undefined;
    protected readonly queue: Queue;
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
    get priority(): Priority;
    get createdAt(): Date;
    get updatedAt(): Date;
    get startedAt(): Date | undefined;
    get completedAt(): Date | undefined;
    get failedAt(): Date | undefined;
    get state(): State;
    get duration(): number | undefined;
    get progress(): number | undefined;
    get logs(): string[];
    constructor(data: JobConstructorData);
    setProgress(completed: number, total: number): Promise<void>;
    addLog(message: string): Promise<void>;
    save(): Promise<Job>;
    remove(): Promise<void>;
    setPriority(value: Priority): Promise<void>;
    isExist(): Promise<boolean>;
    /** @package */
    setStateToActive(): Promise<void>;
    /** @package */
    setStateToComplete(result?: unknown): Promise<void>;
    /** @package */
    setStateToFailure(error: Error): Promise<void>;
    protected update(): Promise<void>;
}
