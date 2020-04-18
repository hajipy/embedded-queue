import * as util from "util";

import { mock } from "jest-mock-extended";

import { Job, Queue, State, Worker } from "../src";

const setTimeoutPromise = util.promisify(setTimeout);

function createJob(queue: Queue, id: string): Job {
    return new Job({
        queue,
        id,
        type: "type",
        createdAt: new Date(),
        updatedAt: new Date(),
        state: State.INACTIVE,
        logs: [],
        saved: true,
    });
}

test("basic", async () => {
    const mockedQueue = mock<Queue>();

    const job = createJob(mockedQueue, "1"); 
    const spiedJobSetStateToActive = jest.spyOn(job, "setStateToActive");
    const spiedJobSetStateToComplete = jest.spyOn(job, "setStateToComplete");
    const spiedJobSetStateToFailure = jest.spyOn(job, "setStateToFailure");
    
    mockedQueue.findInactiveJobByType
        .mockResolvedValueOnce(job)
        .mockResolvedValueOnce(createJob(mockedQueue, "2"));

    const worker = new Worker({
        type: "type",
        queue: mockedQueue
    });

    // eslint-disable-next-line @typescript-eslint/no-empty-function
    const processor = jest.fn().mockImplementation(async (job: Job) => {
        switch (job.id) {
            case "1":
                return 123;
            case "2":
                await worker.shutdown(100);
                break;
        }
    });

    worker.start(processor);

    expect(worker.isRunning).toBe(true);

    await setTimeoutPromise(500); // wait for shutting down queue

    expect(worker.isRunning).toBe(false);
    expect(processor).toHaveBeenCalledTimes(2);
    expect(spiedJobSetStateToActive).toHaveBeenCalledTimes(1);
    expect(spiedJobSetStateToComplete).toHaveBeenCalledTimes(1);
    expect(spiedJobSetStateToComplete.mock.calls[0][0]).toBe(123);
    expect(spiedJobSetStateToFailure).not.toHaveBeenCalled();
});

describe("shutdown", () => {
    test("idle", async () => {
        const mockedQueue = mock<Queue>();

        const worker = new Worker({
            type: "type",
            queue: mockedQueue
        });

        const processor = jest.fn();

        worker.start(processor);

        expect(worker.isRunning).toBe(true);

        await worker.shutdown(100);

        expect(worker.isRunning).toBe(false);
        expect(worker.currentJob).toBeNull();
        expect(processor).not.toHaveBeenCalled();
    });

    test("is not running", async () => {
        const mockedQueue = mock<Queue>();

        const worker = new Worker({
            type: "type",
            queue: mockedQueue
        });

        await worker.shutdown(100);

        expect(worker.isRunning).toBe(false);
        expect(worker.currentJob).toBeNull();
    });
    
    test("processing job is finished before timed out", async () => {
        const mockedQueue = mock<Queue>();

        const job = createJob(mockedQueue, "1");
        const spiedJobSetStateToActive = jest.spyOn(job, "setStateToActive");
        const spiedJobSetStateToComplete = jest.spyOn(job, "setStateToComplete");
        const spiedJobSetStateToFailure = jest.spyOn(job, "setStateToFailure");

        mockedQueue.findInactiveJobByType.mockResolvedValueOnce(job);

        const worker = new Worker({
            type: "type",
            queue: mockedQueue
        });

        const processor = jest.fn().mockImplementation(async () => {
            return setTimeoutPromise(500);
        });

        worker.start(processor);
        await setTimeoutPromise(100);

        expect(worker.isRunning).toBe(true);

        await worker.shutdown(1000);

        expect(worker.isRunning).toBe(false);
        expect(worker.currentJob).toBeNull();
        expect(processor).toHaveBeenCalledTimes(1);
        expect(spiedJobSetStateToActive).toHaveBeenCalledTimes(1);
        expect(spiedJobSetStateToComplete).toHaveBeenCalledTimes(1);
        expect(spiedJobSetStateToFailure).not.toHaveBeenCalled();
    });

    test("processing job is timed out", async () => {
        const mockedQueue = mock<Queue>();

        const job = createJob(mockedQueue, "1");
        const spiedJobSetStateToActive = jest.spyOn(job, "setStateToActive");
        const spiedJobSetStateToComplete = jest.spyOn(job, "setStateToComplete");
        const spiedJobSetStateToFailure = jest.spyOn(job, "setStateToFailure");

        mockedQueue.findInactiveJobByType.mockResolvedValueOnce(job);

        const worker = new Worker({
            type: "type",
            queue: mockedQueue
        });

        const processor = jest.fn().mockImplementation(async () => {
            return setTimeoutPromise(1000);
        });

        worker.start(processor);
        await setTimeoutPromise(100);

        expect(worker.isRunning).toBe(true);

        await worker.shutdown(500);

        expect(worker.isRunning).toBe(false);
        expect(worker.currentJob).toBeNull();
        expect(processor).toHaveBeenCalledTimes(1);
        expect(spiedJobSetStateToActive).toHaveBeenCalledTimes(1);
        expect(spiedJobSetStateToComplete).not.toHaveBeenCalled();
        expect(spiedJobSetStateToFailure).toHaveBeenCalledTimes(1);
        expect(spiedJobSetStateToFailure.mock.calls[0][0].message).toBe("shutdown timeout")
    });
});

test("processor failed", async () => {
    const mockedQueue = mock<Queue>();

    const job = createJob(mockedQueue, "1");
    const spiedJobSetStateToActive = jest.spyOn(job, "setStateToActive");
    const spiedJobSetStateToComplete = jest.spyOn(job, "setStateToComplete");
    const spiedJobSetStateToFailure = jest.spyOn(job, "setStateToFailure");
    
    mockedQueue.findInactiveJobByType
        .mockResolvedValueOnce(job)
        .mockResolvedValueOnce(createJob(mockedQueue, "2"));

    const worker = new Worker({
        type: "type",
        queue: mockedQueue
    });

    const processor = jest.fn().mockImplementation(async (job: Job) => {
        switch (job.id) {
            case "1":
                throw new Error("Some Error");
            case "2":
                await worker.shutdown(100);
                break;
        }
    });

    worker.start(processor);
    await setTimeoutPromise(100);

    expect(spiedJobSetStateToActive).toHaveBeenCalledTimes(1);
    expect(spiedJobSetStateToComplete).not.toHaveBeenCalled();
    expect(spiedJobSetStateToFailure).toHaveBeenCalledTimes(1);
    expect(spiedJobSetStateToFailure.mock.calls[0][0].message).toBe("Some Error");
});

test("processing job is deleted", async () => {
    const mockedQueue = mock<Queue>();

    const job1 = createJob(mockedQueue, "1");
    const spiedJobSetStateToActive = jest.spyOn(job1, "setStateToActive");
    const spiedJobSetStateToComplete = jest.spyOn(job1, "setStateToComplete");
    const spiedJobSetStateToFailure = jest.spyOn(job1, "setStateToFailure");

    mockedQueue.findInactiveJobByType
        .mockResolvedValueOnce(job1)
        .mockResolvedValueOnce(createJob(mockedQueue, "2"));

    const worker = new Worker({
        type: "type",
        queue: mockedQueue
    });

    const processor = jest.fn().mockImplementation(async (job: Job) => {
        switch (job.id) {
            case "1":
                job1.isExist = (): Promise<boolean> => Promise.resolve(false);
                break;
            case "2":
                await worker.shutdown(100);
                break;
        }
    });

    worker.start(processor);
    await setTimeoutPromise(100);

    expect(spiedJobSetStateToActive).toHaveBeenCalledTimes(1);
    expect(spiedJobSetStateToComplete).not.toHaveBeenCalled();
    expect(spiedJobSetStateToFailure).not.toHaveBeenCalled();
});
