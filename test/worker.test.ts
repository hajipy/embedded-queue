import * as util from "util";

import { mock } from "jest-mock-extended";

import { Job, Queue, State, Worker } from "../src";

const setTimeoutPromise = util.promisify(setTimeout);

test("Basic", async () => {
    const mockedQueue = mock<Queue>();

    const job1 = new Job({
        queue: mockedQueue,
        id: "1",
        type: "type",
        createdAt: new Date(),
        updatedAt: new Date(),
        state: State.INACTIVE,
        logs: [],
        saved: true,
    });
    const spiedJob1SetStateToActive = jest.spyOn(job1, "setStateToActive");
    const spiedJob1SetStateToComplete = jest.spyOn(job1, "setStateToComplete");
    const spiedJob1SetStateToFailure = jest.spyOn(job1, "setStateToFailure");

    const job2 = new Job({
        queue: mockedQueue,
        id: "2",
        type: "type",
        createdAt: new Date(),
        updatedAt: new Date(),
        state: State.INACTIVE,
        logs: [],
        saved: true,
    });
    const spiedJob2SetStateToActive = jest.spyOn(job2, "setStateToActive");
    const spiedJob2SetStateToComplete = jest.spyOn(job2, "setStateToComplete");
    const spiedJob2SetStateToFailure = jest.spyOn(job2, "setStateToFailure");

    mockedQueue.findInactiveJobByType
        .mockResolvedValueOnce(job1)
        .mockResolvedValueOnce(job2);

    const worker = new Worker({
        type: "type",
        queue: mockedQueue
    });

    // eslint-disable-next-line @typescript-eslint/no-empty-function
    const processor = jest.fn().mockImplementation(async (job: Job) => {
        switch (job.id) {
            case "1":
                expect(worker.currentJob).toBe(job1);
                break;
            case "2":
                expect(worker.currentJob).toBe(job2);
                await worker.shutdown(100);
                break;
        }
    });

    worker.start(processor);

    expect(worker.isRunning).toBe(true);

    await setTimeoutPromise(1000); // wait for shutting down queue

    expect(worker.isRunning).toBe(false);

    expect(spiedJob1SetStateToActive).toHaveBeenCalledTimes(1);
    expect(spiedJob1SetStateToComplete).toHaveBeenCalledTimes(1);
    expect(spiedJob1SetStateToFailure).not.toHaveBeenCalled();

    expect(spiedJob2SetStateToActive).toHaveBeenCalledTimes(1);
    expect(spiedJob2SetStateToComplete).not.toHaveBeenCalled();
    expect(spiedJob2SetStateToFailure).toHaveBeenCalledTimes(1);
    expect(spiedJob2SetStateToFailure.mock.calls[0][0].message).toBe("shutdown timeout")
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
    
    test("processing job is finished", async () => {
        const mockedQueue = mock<Queue>();

        const job = new Job({
            queue: mockedQueue,
            id: "1",
            type: "type",
            createdAt: new Date(),
            updatedAt: new Date(),
            state: State.INACTIVE,
            logs: [],
            saved: true,
        });
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

        const job = new Job({
            queue: mockedQueue,
            id: "1",
            type: "type",
            createdAt: new Date(),
            updatedAt: new Date(),
            state: State.INACTIVE,
            logs: [],
            saved: true,
        });
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

    const job1 = new Job({
        queue: mockedQueue,
        id: "1",
        type: "type",
        createdAt: new Date(),
        updatedAt: new Date(),
        state: State.INACTIVE,
        logs: [],
        saved: true,
    });
    const spiedJob1SetStateToActive = jest.spyOn(job1, "setStateToActive");
    const spiedJob1SetStateToComplete = jest.spyOn(job1, "setStateToComplete");
    const spiedJob1SetStateToFailure = jest.spyOn(job1, "setStateToFailure");

    const job2 = new Job({
        queue: mockedQueue,
        id: "2",
        type: "type",
        createdAt: new Date(),
        updatedAt: new Date(),
        state: State.INACTIVE,
        logs: [],
        saved: true,
    });

    mockedQueue.findInactiveJobByType
        .mockResolvedValueOnce(job1)
        .mockResolvedValueOnce(job2);

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

    expect(spiedJob1SetStateToActive).toHaveBeenCalledTimes(1);
    expect(spiedJob1SetStateToComplete).not.toHaveBeenCalled();
    expect(spiedJob1SetStateToFailure).toHaveBeenCalledTimes(1);
    expect(spiedJob1SetStateToFailure.mock.calls[0][0].message).toBe("Some Error");
});
