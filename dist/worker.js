"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class Worker {
    constructor(data) {
        this.shutdownInfo = null;
        // tslint:disable:variable-name
        this._isRunning = false;
        this._currentJob = null;
        this.type = data.type;
        this.queue = data.queue;
    }
    // tslint:disable:variable-name
    // noinspection JSUnusedGlobalSymbols
    get isRunning() {
        return this._isRunning;
    }
    // noinspection JSUnusedGlobalSymbols
    get currentJob() {
        return this._currentJob;
    }
    start(processor) {
        this._isRunning = true;
        this.startInternal(processor);
    }
    shutdown(timeoutMilliseconds) {
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
    startInternal(processor) {
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
        (async () => {
            this._currentJob = await this.queue.findInactiveJobByType(this.type);
            // 実行中じゃなければシャットダウンが進行中なので、処理を中断する
            if (this._isRunning === false) {
                this._currentJob = null;
                return;
            }
            await this.process(processor);
            // Note: 上の処理は本当はここに書きたい
            this.startInternal(processor);
        })();
    }
    async process(processor) {
        // istanbul ignore if
        if (this._currentJob === null) {
            console.warn(`this._currentJob is null`);
            return;
        }
        await this._currentJob.setStateToActive();
        let result;
        try {
            result = await processor(this._currentJob);
        }
        catch (error) {
            await this._currentJob.setStateToFailure(error);
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
exports.Worker = Worker;
