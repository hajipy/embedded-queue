import { Priority } from "./priority";
import { Queue } from "./queue";
import { State } from "./state";
export interface JobConstructorData {
    queue: Queue;
    id: string;
    type: string;
    priority?: Priority;
    data?: any;
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
    readonly data: any | undefined;
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
    readonly priority: Priority;
    readonly createdAt: Date;
    readonly updatedAt: Date;
    readonly startedAt: Date | undefined;
    readonly completedAt: Date | undefined;
    readonly failedAt: Date | undefined;
    readonly state: State;
    readonly duration: number | undefined;
    readonly progress: number | undefined;
    readonly logs: string[];
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
    setStateToComplete(result?: any): Promise<void>;
    /** @package */
    setStateToFailure(error: Error): Promise<void>;
    protected update(): Promise<void>;
}
