import * as util from "util";

import { Event, Job, Priority, Queue, State } from "../src";

const setTimeoutPromise = util.promisify(setTimeout);

test("Basic Usage", async () => {
    interface JobData {
        a: number;
        b: number;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function isJobData(data: any): data is JobData {
        if (data === null) {
            return false;
        }

        return typeof data.a === "number" && typeof data.b === "number";
    }

    const queue = await Queue.createQueue({ inMemoryOnly: true });

    const processor = jest.fn().mockImplementation(
        async (job: Job) => {
            if (isJobData(job.data)) {
                return job.data.a + job.data.b;
            }
        }
    );
    queue.process("adder", processor, 1);

    const completeHandler = jest.fn();
    queue.on(Event.Complete, completeHandler);

    const createdJob = await queue.createJob({
        type: "adder",
        data: { a: 1, b: 2 },
    });

    await setTimeoutPromise(100);

    expect(completeHandler).toHaveBeenCalledTimes(1);
    expect(completeHandler.mock.calls[0][0]).toBeInstanceOf(Job);
    expect(completeHandler.mock.calls[0][1]).toBe(3);

    const completedJob = completeHandler.mock.calls[0][0];
    expect(completedJob.id).toBe(createdJob.id);
    const currentTimestamp = new Date();
    expect(completedJob.startedAt).not.toBeUndefined();
    if (completedJob.startedAt !== undefined) {
        expect((currentTimestamp.getTime() - completedJob.startedAt.getTime())).toBeLessThan(1000);
    }
    expect(completedJob.completedAt).not.toBeUndefined();
    if (completedJob.completedAt !== undefined) {
        expect((currentTimestamp.getTime() - completedJob.completedAt.getTime())).toBeLessThan(1000);
    }
    expect(completedJob.duration).not.toBeUndefined();
    if (
        completedJob.duration !== undefined &&
        completedJob.startedAt !== undefined &&
        completedJob.completedAt !== undefined
    ) {
        expect(completedJob.duration).toBe(completedJob.completedAt.getTime() - completedJob.startedAt.getTime());
    }
    expect(completedJob.failedAt).toBeUndefined();
    expect(completedJob.state).toBe(State.COMPLETE);

    // shutdown queue
    setTimeout(async () => { await queue.shutdown(100); }, 1);
});

describe("Event Handlers", () => {
    test("Enqueue", async () => {
        const queue = await Queue.createQueue({ inMemoryOnly: true });

        const enqueueHandler = jest.fn();
        queue.on(Event.Enqueue, enqueueHandler);

        const createdJob = await queue.createJob({ type: "SomeType" });

        expect(enqueueHandler).toHaveBeenCalledTimes(1);
        expect(enqueueHandler.mock.calls[0][0].id).toBe(createdJob.id);
    });

    test("Start", async () => {
        const queue = await Queue.createQueue({ inMemoryOnly: true });

        const startHandler = jest.fn();
        queue.on(Event.Start, startHandler);

        const createdJob = await queue.createJob({ type: "SomeType" });

        // eslint-disable-next-line @typescript-eslint/no-empty-function
        queue.process("SomeType", async () => {}, 1);

        await setTimeoutPromise(100);

        expect(startHandler).toHaveBeenCalledTimes(1);
        expect(startHandler.mock.calls[0][0].id).toBe(createdJob.id);
    });

    test("Failure", async () => {
        const queue = await Queue.createQueue({ inMemoryOnly: true });

        const failureHandler = jest.fn();
        queue.on(Event.Failure, failureHandler);

        const createdJob = await queue.createJob({ type: "SomeType" });

        const error = new Error("SomeError");
        queue.process("SomeType", async () => { throw error; }, 1);

        await setTimeoutPromise(100);

        expect(failureHandler).toHaveBeenCalledTimes(1);
        expect(failureHandler.mock.calls[0][0].id).toBe(createdJob.id);
        expect(failureHandler.mock.calls[0][1]).toBe(error);
    });

    test("Complete", async () => {
        const queue = await Queue.createQueue({ inMemoryOnly: true });

        const completeHandler = jest.fn();
        queue.on(Event.Complete, completeHandler);

        const createdJob = await queue.createJob({ type: "SomeType" });

        const result = 123;
        queue.process("SomeType", async () => result, 1);

        await setTimeoutPromise(100);

        expect(completeHandler).toHaveBeenCalledTimes(1);
        expect(completeHandler.mock.calls[0][0].id).toBe(createdJob.id);
        expect(completeHandler.mock.calls[0][1]).toBe(result);
    });

    test("Remove", async () => {
        const queue = await Queue.createQueue({ inMemoryOnly: true });

        const removeHandler = jest.fn();
        queue.on(Event.Remove, removeHandler);

        const createdJob = await queue.createJob({ type: "SomeType" });

        await queue.removeJobById(createdJob.id);

        expect(removeHandler).toHaveBeenCalledTimes(1);
        expect(removeHandler.mock.calls[0][0].id).toBe(createdJob.id);
    });

    test.skip("Error", async () => {
        // Skip it because I can't come up with a good test.
    });

    test("Progress", async () => {
        const queue = await Queue.createQueue({ inMemoryOnly: true });

        const progressHandler = jest.fn();
        queue.on(Event.Progress, progressHandler);

        const createdJob = await queue.createJob({ type: "SomeType" });

        queue.process(
            "SomeType",
            async (job: Job) => {
                await job.setProgress(1, 3);
                await job.setProgress(2, 3);
                await job.setProgress(3, 3);
            },
            1
        );

        await setTimeoutPromise(100);

        expect(progressHandler).toHaveBeenCalledTimes(3);
        expect(progressHandler.mock.calls[0][0].id).toBe(createdJob.id);
        expect(progressHandler.mock.calls[0][1]).toBeCloseTo(1 / 3 * 100);
        expect(progressHandler.mock.calls[1][0].id).toBe(createdJob.id);
        expect(progressHandler.mock.calls[1][1]).toBeCloseTo(2 / 3 * 100);
        expect(progressHandler.mock.calls[2][0].id).toBe(createdJob.id);
        expect(progressHandler.mock.calls[2][1]).toBeCloseTo(3 / 3 * 100);
    });

    test("Log", async () => {
        const queue = await Queue.createQueue({ inMemoryOnly: true });

        const logHandler = jest.fn();
        queue.on(Event.Log, logHandler);

        const createdJob = await queue.createJob({ type: "SomeType" });

        queue.process(
            "SomeType",
            async (job: Job) => {
                await job.addLog("First Log");
                await job.addLog("Second Log");
                await job.addLog("Third Log");
            },
            1
        );

        await setTimeoutPromise(100);

        expect(logHandler).toHaveBeenCalledTimes(3);
        expect(logHandler.mock.calls[0][0].id).toBe(createdJob.id);
        expect(logHandler.mock.calls[0][1]).toBe("First Log");
        expect(logHandler.mock.calls[1][0].id).toBe(createdJob.id);
        expect(logHandler.mock.calls[1][1]).toBe("Second Log");
        expect(logHandler.mock.calls[2][0].id).toBe(createdJob.id);
        expect(logHandler.mock.calls[2][1]).toBe("Third Log");
    });

    test("Priority", async () => {
        const queue = await Queue.createQueue({ inMemoryOnly: true });

        const priorityHandler = jest.fn();
        queue.on(Event.Priority, priorityHandler);

        const createdJob = await queue.createJob({ type: "SomeType", priority: Priority.NORMAL });

        const newPriority = Priority.HIGH;
        await createdJob.setPriority(newPriority);

        expect(priorityHandler).toHaveBeenCalledTimes(1);
        expect(priorityHandler.mock.calls[0][0].id).toBe(createdJob.id);
        expect(priorityHandler.mock.calls[0][1]).toBe(newPriority);
    });
});
