import { mock, mockReset } from "jest-mock-extended";
import { mocked } from "ts-jest";

import { Event, Job, Priority, Queue, State } from "../src";

test("constructor", () => {
    const id = "id";
    const type = "type";
    const priority = Priority.HIGH;
    const data = {
        a: "aaa",
        b: 123,
        c: {
            x: true,
            y: {
                z: true,
            },
        },
    };
    const createdAt = new Date(2020, 4, 1, 0, 0, 0);
    const updatedAt = new Date(2020, 4, 2, 0, 0, 0);
    const startedAt = new Date(2020, 4, 3, 0, 0, 0);
    const completedAt = new Date(2020, 4, 4, 0, 0, 0);
    const failedAt = new Date(2020, 4, 5, 0, 0, 0);
    const state = State.INACTIVE;
    const logs = [
        "log1",
        "log2",
        "log3",
    ];

    const job = new Job({
        queue: mock<Queue>(),
        id,
        type,
        priority,
        data,
        createdAt,
        updatedAt,
        startedAt,
        completedAt,
        failedAt,
        state,
        logs,
        saved: true,
    });

    expect(job.id).toBe(id);
    expect(job.type).toBe(type);
    expect(job.priority).toBe(priority);
    expect(job.data).toEqual(data);
    expect(job.createdAt).toBe(createdAt);
    expect(job.updatedAt).toBe(updatedAt);
    expect(job.completedAt).toBe(completedAt);
    expect(job.failedAt).toBe(failedAt);
    expect(job.state).toBe(state);
    expect(job.logs).toEqual(logs);
});

test("setProgress", async () => {
    const mockedQueue = mock<Queue>();
    const updatedAt = new Date(2020, 4, 1, 0, 0, 0);

    const job = new Job({
        queue: mockedQueue,
        id: "id",
        type: "type",
        createdAt: new Date(),
        updatedAt,
        logs: [],
        saved: true,
    });

    expect(job.progress).toBeUndefined();

    await job.setProgress(1, 6);
    expect(job.progress).toBeCloseTo(16.67, 2);
    expect(job.updatedAt).not.toBe(updatedAt);
    expect(mockedQueue.updateJob).toHaveBeenCalledTimes(1);
    expect(mockedQueue.updateJob.mock.calls[0][0]).toBe(job);
    expect(mockedQueue.emit).toHaveBeenCalledTimes(1);
    expect(mockedQueue.emit.mock.calls[0][0]).toBe(Event.Progress);
    expect(mockedQueue.emit.mock.calls[0][1]).toBe(job);
    expect(mockedQueue.emit.mock.calls[0][2]).toBe(job.progress);

    await job.setProgress(2, 6);
    expect(job.progress).toBeCloseTo(33.33, 2);

    await job.setProgress(3, 6);
    expect(job.progress).toBeCloseTo(50.00, 2);

    await job.setProgress(4, 6);
    expect(job.progress).toBeCloseTo(66.67, 2);

    await job.setProgress(5, 6);
    expect(job.progress).toBeCloseTo(83.33, 2);

    await job.setProgress(6, 6);
    expect(job.progress).toBeCloseTo(100.00, 2);
});

test("addLog", async () => {
    const mockedQueue = mock<Queue>();
    const updatedAt = new Date(2020, 4, 1, 0, 0, 0);

    const job = new Job({
        queue: mockedQueue,
        id: "id",
        type: "type",
        createdAt: new Date(),
        updatedAt,
        logs: [],
        saved: true,
    });

    expect(job.logs).toHaveLength(0);

    await job.addLog("First Log");
    expect(job.logs).toEqual([
        "First Log",
    ]);
    expect(job.updatedAt).not.toBe(updatedAt);
    expect(mockedQueue.updateJob).toHaveBeenCalledTimes(1);
    expect(mockedQueue.updateJob.mock.calls[0][0]).toBe(job);
    expect(mockedQueue.emit).toHaveBeenCalledTimes(1);
    expect(mockedQueue.emit.mock.calls[0][0]).toBe(Event.Log);
    expect(mockedQueue.emit.mock.calls[0][1]).toBe(job);

    await job.addLog("Second Log");
    expect(job.logs).toEqual([
        "First Log",
        "Second Log",
    ]);

    await job.addLog("Third Log");
    expect(job.logs).toEqual([
        "First Log",
        "Second Log",
        "Third Log",
    ]);
});

describe("save", () => {
    const mockedQueue = mock<Queue>();
    const id = "id";
    const type = "type";
    const createdAt = new Date();
    const updatedAt = new Date();
    const logs: string[] = [];

    beforeEach(() => {
        mockReset(mockedQueue);
    });

    test("new job", async () => {
        const job = new Job({
            queue: mockedQueue,
            id,
            type,
            createdAt,
            updatedAt,
            logs,
            saved: false,
        });

        await job.save();

        expect(mockedQueue.addJob).toHaveBeenCalledTimes(1);
        expect(mockedQueue.addJob.mock.calls[0][0]).toBe(job);
        expect(mockedQueue.emit).toHaveBeenCalledTimes(1);
        expect(mockedQueue.emit.mock.calls[0][0]).toBe(Event.Enqueue);
        expect(mockedQueue.emit.mock.calls[0][1]).toBe(job);
    });

    test("exist job", async () => {
        const job = new Job({
            queue: mockedQueue,
            id,
            type,
            createdAt,
            updatedAt,
            logs,
            saved: true,
        });

        await job.save();

        expect(mockedQueue.updateJob).toHaveBeenCalledTimes(1);
        expect(mockedQueue.updateJob.mock.calls[0][0]).toBe(job);
    });
});

test("remove", async () => {
    const mockedQueue = mock<Queue>();

    const job = new Job({
        queue: mockedQueue,
        id: "id",
        type: "type",
        createdAt: new Date(),
        updatedAt: new Date(),
        logs: [],
        saved: true,
    });

    await job.remove();

    expect(mockedQueue.removeJob).toHaveBeenCalledTimes(1);
    expect(mockedQueue.removeJob.mock.calls[0][0]).toBe(job);
    expect(mockedQueue.emit).toHaveBeenCalledTimes(1);
    expect(mockedQueue.emit.mock.calls[0][0]).toBe(Event.Remove);
    expect(mockedQueue.emit.mock.calls[0][1]).toBe(job);
});

test("setPriority", async () => {
    const mockedQueue = mock<Queue>();
    const updatedAt = new Date(2020, 4, 1, 0, 0, 0);

    const job = new Job({
        queue: mockedQueue,
        id: "id",
        type: "type",
        priority: Priority.LOW,
        createdAt: new Date(),
        updatedAt,
        logs: [],
        saved: true,
    });

    expect(job.priority).toBe(Priority.LOW);

    await job.setPriority(Priority.NORMAL);

    expect(job.priority).toBe(Priority.NORMAL);
    expect(job.updatedAt).not.toBe(updatedAt);
    expect(mockedQueue.updateJob).toHaveBeenCalledTimes(1);
    expect(mockedQueue.updateJob.mock.calls[0][0]).toBe(job);
    expect(mockedQueue.emit).toHaveBeenCalledTimes(1);
    expect(mockedQueue.emit.mock.calls[0][0]).toBe(Event.Priority);
    expect(mockedQueue.emit.mock.calls[0][1]).toBe(job);
});

describe("isExist", () => {
    const mockedQueue = mock<Queue>();
    const id = "id";
    const type = "type";
    const createdAt = new Date();
    const updatedAt = new Date();
    const logs: string[] = [];

    const job = new Job({
        queue: mockedQueue,
        id,
        type,
        createdAt,
        updatedAt,
        logs,
        saved: false,
    });

    beforeEach(() => {
        mockReset(mockedQueue);
    });

    test("is exist", async () => {
        mockedQueue.isExistJob.mockResolvedValue(true);

        expect(await job.isExist()).toBe(true);
    });

    test("is not exist", async () => {
        mockedQueue.isExistJob.mockResolvedValue(false);

        expect(await job.isExist()).toBe(false);
    });
});

test("setStateToActive", async () => {
    const mockedQueue = mock<Queue>();
    const updatedAt = new Date(2020, 4, 1, 0, 0, 0);

    const job = new Job({
        queue: mockedQueue,
        id: "id",
        type: "type",
        createdAt: new Date(),
        updatedAt,
        startedAt: undefined,
        logs: [],
        saved: true,
    });

    await job.setStateToActive();

    expect(job.startedAt).not.toBeUndefined();
    expect(job.updatedAt).not.toBe(updatedAt);
    expect(mockedQueue.updateJob).toHaveBeenCalledTimes(1);
    expect(mockedQueue.updateJob.mock.calls[0][0]).toBe(job);
    expect(mockedQueue.emit).toHaveBeenCalledTimes(1);
    expect(mockedQueue.emit.mock.calls[0][0]).toBe(Event.Start);
});

test("setStateToComplete", async () => {
    const mockedQueue = mock<Queue>();
    const updatedAt = new Date(2020, 4, 1, 0, 0, 0);
    const startedAt = new Date(2020, 4, 2, 0, 0, 0);

    const job = new Job({
        queue: mockedQueue,
        id: "id",
        type: "type",
        createdAt: new Date(),
        updatedAt,
        startedAt,
        logs: [],
        saved: true,
    });

    expect(job.completedAt).toBeUndefined();
    expect(job.duration).toBeUndefined();

    const result = {
        a: "aaa",
        b: 123,
        c: {
            x: true,
            y: {
                z: true,
            },
        },
    };

    await job.setStateToComplete(result);

    expect(job.completedAt).not.toBeUndefined();
    expect(job.duration).toBeCloseTo((new Date()).getTime() - startedAt.getTime(), -3); // 1 seconds or less
    expect(job.updatedAt).not.toBe(updatedAt);
    expect(mockedQueue.updateJob).toHaveBeenCalledTimes(1);
    expect(mockedQueue.updateJob.mock.calls[0][0]).toBe(job);
    expect(mockedQueue.emit).toHaveBeenCalledTimes(1);
    expect(mockedQueue.emit.mock.calls[0][0]).toBe(Event.Complete);
    expect(mockedQueue.emit.mock.calls[0][1]).toBe(job);
    expect(mockedQueue.emit.mock.calls[0][2]).toEqual(result);
});

test("setStateToFailure", async () => {
    const mockedQueue = mock<Queue>();
    const updatedAt = new Date(2020, 4, 1, 0, 0, 0);
    const startedAt = new Date(2020, 4, 2, 0, 0, 0);

    const job = new Job({
        queue: mockedQueue,
        id: "id",
        type: "type",
        createdAt: new Date(),
        updatedAt,
        startedAt,
        logs: [],
        saved: true,
    });

    expect(job.failedAt).toBeUndefined();

    const error = new Error("my error");
    await job.setStateToFailure(error);

    expect(job.failedAt).not.toBeUndefined();
    expect(job.updatedAt).not.toBe(updatedAt);
    expect(mockedQueue.updateJob).toHaveBeenCalledTimes(1);
    expect(mockedQueue.updateJob.mock.calls[0][0]).toBe(job);
    expect(mockedQueue.emit).toHaveBeenCalledTimes(1);
    expect(mockedQueue.emit.mock.calls[0][0]).toBe(Event.Failure);
    expect(mockedQueue.emit.mock.calls[0][1]).toBe(job);
    expect(mockedQueue.emit.mock.calls[0][2]).toEqual(error);
});
