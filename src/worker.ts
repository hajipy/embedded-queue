import { Job } from "./job";
import { Processor, Queue } from "./queue";

interface WorkerConstructorData {
    type: string;
    queue: Queue;
}

interface ShutdownInfo {
    timer: NodeJS.Timeout;
    resolve: () => void;
}

export class Worker {
    public readonly type: string;

    protected readonly queue: Queue;
    protected shutdownInfo: ShutdownInfo | null = null;

    // tslint:disable:variable-name
    protected _isRunning = false;
    protected _currentJob: Job | null = null;
    // tslint:disable:variable-name

    // noinspection JSUnusedGlobalSymbols
    public get isRunning(): boolean {
        return this._isRunning;
    }

    // noinspection JSUnusedGlobalSymbols
    public get currentJob(): Job | null {
        return this._currentJob;
    }

    public constructor(data: WorkerConstructorData) {
        this.type = data.type;
        this.queue = data.queue;
    }

    public start(processor: Processor): void {
        this._isRunning = true;

        this.startInternal(processor);
    }

    public shutdown(timeoutMilliseconds: number): Promise<void> {
        return new Promise((resolve) => {
            // 実行中でなければ、何もしないで終了
            if (this._isRunning === false) {
                resolve();
                return;
            }

            // 非実行状態に移行
            this._isRunning = false;

            // 処理中のジョブがなければ、シャットダウン完了
            if (this._currentJob === null) {
                resolve();
                return;
            }

            // タイムアウトまでに処理中のジョブが完了しなければジョブを失敗にする
            this.shutdownInfo = {
                timer: setTimeout(async () => {
                    // istanbul ignore if
                    if (this._currentJob === null) {
                        console.warn(`this._currentJob is null`);
                        return;
                    }

                    await this._currentJob.setStateToFailure(new Error("shutdown timeout"));
                    this._currentJob = null;

                    if (this.shutdownInfo !== null) {
                        this.shutdownInfo.resolve();
                        this.shutdownInfo = null;
                    }
                }, timeoutMilliseconds),
                resolve,
            };
        });
    }

    protected startInternal(processor: Processor): void {
        // 実行中じゃなければシャットダウンが進行中なので、処理を中断する
        // Note: この処理は本当は下に書きたいのだけど、TypeScriptの型認識が間違ってしまうため、ここに書いている
        if (this._isRunning === false) {
            if (this.shutdownInfo !== null) {
                clearTimeout(this.shutdownInfo.timer);
                this.shutdownInfo.resolve();
                this.shutdownInfo = null;
            }
            this._currentJob = null;
            return;
        }

        (async (): Promise<void> => {
            this._currentJob = await this.queue.requestJobForProcessing(this.type, () => this._isRunning);

            // 実行中じゃなければシャットダウンが進行中なので、処理を中断する
            if (this._isRunning === false) {
                // this._isRunningがfalseの場合、this.queue.requestProcessJobはnullを返すことになっている
                if (this._currentJob !== null) {
                    console.warn(`this._currentJob is not null`);
                }

                this._currentJob = null;
                return;
            }

            await this.process(processor);

            // Note: 上の処理は本当はここに書きたい

            this.startInternal(processor);
        })();
    }

    protected async process(processor: Processor): Promise<void> {
        // istanbul ignore if
        if (this._currentJob === null) {
            console.warn(`this._currentJob is null`);
            return;
        }

        let result: unknown;

        try {
            result = await processor(this._currentJob);
        }
        catch (error) {
            if (error instanceof Error) {
                await this._currentJob.setStateToFailure(error);
            }
            else {
                await this._currentJob.setStateToFailure(
                    new Error("Processor is failed, and non error object is thrown.")
                );
            }
            this._currentJob = null;
            return;
        }

        if (this._currentJob === null) {
            return;
        }

        if (await this._currentJob.isExist() === false) {
            this._currentJob = null;
            return;
        }

        await this._currentJob.setStateToComplete(result);

        this._currentJob = null;
    }
}
