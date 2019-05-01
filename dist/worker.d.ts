import { Job } from "./job";
import { Processor, Queue } from "./queue";
interface WorkerConstructorData {
    type: string;
    queue: Queue;
}
interface ShutdownInfo {
    timer: any;
    resolve: () => void;
}
export declare class Worker {
    readonly type: string;
    protected readonly queue: Queue;
    protected shutdownInfo: ShutdownInfo | null;
    protected _isRunning: boolean;
    protected _currentJob: Job | null;
    readonly isRunning: boolean;
    readonly currentJob: Job | null;
    constructor(data: WorkerConstructorData);
    start(processor: Processor): void;
    shutdown(timeoutMilliseconds: number): Promise<void>;
    protected startInternal(processor: Processor): void;
    protected process(processor: Processor): Promise<void>;
}
export {};
