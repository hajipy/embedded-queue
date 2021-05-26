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
    expect((currentTimestamp.getTime() - completedJob.startedAt.getTime())).toBeLessThan(1000);
    expect(completedJob.completedAt).not.toBeUndefined();
    expect((currentTimestamp.getTime() - completedJob.completedAt.getTime())).toBeLessThan(1000);
    expect(completedJob.duration).not.toBeUndefined();
    expect(completedJob.duration).toBe(completedJob.completedAt.getTime() - completedJob.startedAt.getTime());
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

        // eslint-disable-next-line @typescript-eslint/no-empty-function
        queue.process("SomeType", async () => {}, 1);

        const createdJob = await queue.createJob({ type: "SomeType" });
        await setTimeoutPromise(100);

        expect(startHandler).toHaveBeenCalledTimes(1);
        expect(startHandler.mock.calls[0][0].id).toBe(createdJob.id);
    });

    test("Failure", async () => {
        const queue = await Queue.createQueue({ inMemoryOnly: true });

        const failureHandler = jest.fn();
        queue.on(Event.Failure, failureHandler);

        const error = new Error("SomeError");
        queue.process("SomeType", async () => { throw error; }, 1);

        const createdJob = await queue.createJob({ type: "SomeType" });
        await setTimeoutPromise(100);

        expect(failureHandler).toHaveBeenCalledTimes(1);
        expect(failureHandler.mock.calls[0][0].id).toBe(createdJob.id);
        expect(failureHandler.mock.calls[0][1]).toBe(error);
    });

    test("Complete", async () => {
        const queue = await Queue.createQueue({ inMemoryOnly: true });

        const completeHandler = jest.fn();
        queue.on(Event.Complete, completeHandler);

        const result = 123;
        queue.process("SomeType", async () => result, 1);

        const createdJob = await queue.createJob({ type: "SomeType" });
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

        queue.process(
            "SomeType",
            async (job: Job) => {
                await job.setProgress(1, 3);
                await job.setProgress(2, 3);
                await job.setProgress(3, 3);
            },
            1
        );

        const createdJob = await queue.createJob({ type: "SomeType" });
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

test("Create Job", async () => {
    const queue = await Queue.createQueue({ inMemoryOnly: true });

    const type = "SomeType";
    const priority = Priority.NORMAL;
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

    const createdJob = await queue.createJob({ type, priority, data });

    expect(createdJob.id).not.toBe("");
    expect(createdJob.type).toBe(type);
    expect(createdJob.priority).toBe(priority);
    expect(createdJob.data).toEqual(data);
});

test("Set Job Processor", async () => {
    const queue = await Queue.createQueue({ inMemoryOnly: true });

    const someTypeWorkerCount = 3
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    queue.process("SomeType", async () => {}, someTypeWorkerCount);

    const otherTypeWorkerCount = 5;
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    queue.process("OtherType", async () => {}, otherTypeWorkerCount);

    expect(queue.workers).toHaveLength(someTypeWorkerCount + otherTypeWorkerCount);
    expect(queue.workers.filter((w) => w.type === "SomeType")).toHaveLength(someTypeWorkerCount);
    expect(queue.workers.filter((w) => w.type === "OtherType")).toHaveLength(otherTypeWorkerCount);
    expect(queue.workers.every((w) => w.isRunning)).toBe(true);
});

test("Shutdown Queue", async () => {
    const queue = await Queue.createQueue({ inMemoryOnly: true });

    const processingMilliseconds = 1000;
    queue.process("SomeType", () => setTimeoutPromise(processingMilliseconds), 1);

    expect(queue.workers).toHaveLength(1);

    await queue.createJob({ type: "SomeType" });

    // WorkerがJobを処理し始めるまで待つ
    await setTimeoutPromise(100);

    const before = new Date();
    const timeoutMilliseconds = 100;
    await queue.shutdown(timeoutMilliseconds);
    const after = new Date();

    expect(queue.workers).toHaveLength(0);
    const shutdownMilliseconds = after.getTime() - before.getTime();
    expect(shutdownMilliseconds).toBeGreaterThanOrEqual(timeoutMilliseconds);
    expect(shutdownMilliseconds).toBeLessThan(processingMilliseconds);
});

describe("Queue API", () => {
    test("findJob", async () => {
        const queue = await Queue.createQueue({ inMemoryOnly: true });

        const createdJobs = await Promise.all([
            queue.createJob({ type: "SomeType" }),
            queue.createJob({ type: "SomeType" }),
            queue.createJob({ type: "SomeType" }),
        ]);

        for (const createdJob of createdJobs) {
            const foundJob = await queue.findJob(createdJob.id);
            expect(foundJob).not.toBeNull();
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            expect(foundJob!.id).toBe(createdJob.id);
        }

        const notFoundJob = await queue.findJob("invalid-id");
        expect(notFoundJob).toBeNull();
    });

    test("listJobs", async () => {
        const queue = await Queue.createQueue({ inMemoryOnly: true });

        const createdJobs: Job[] = [];
        createdJobs.push(await queue.createJob({ type: "SomeType" }));
        await setTimeoutPromise(100);
        createdJobs.push(await queue.createJob({ type: "SomeType" }));
        await setTimeoutPromise(100);
        createdJobs.push(await queue.createJob({ type: "SomeType" }));

        const jobs = await queue.listJobs();

        expect(jobs).toHaveLength(createdJobs.length);
        for (let i = 0; i < jobs.length; i++) {
            expect(jobs[i].id).toBe(createdJobs[i].id);
        }
    });

    test("removeJobById", async () => {
        const queue = await Queue.createQueue({ inMemoryOnly: true });

        const createdJobs = await Promise.all([
            queue.createJob({ type: "SomeType" }),
            queue.createJob({ type: "SomeType" }),
            queue.createJob({ type: "SomeType" }),
        ]);

        for (let i = 0; i < createdJobs.length; i++) {
            expect(await queue.listJobs()).toHaveLength(createdJobs.length - i);

            await queue.removeJobById(createdJobs[i].id);

            const job = await queue.findJob(createdJobs[i].id);
            expect(job).toBeNull();

            expect(await queue.listJobs()).toHaveLength(createdJobs.length - i - 1);
        }
    });

    test("removeJobsByCallback", async () => {
        const queue = await Queue.createQueue({ inMemoryOnly: true });

        const createdJobs: Job[] = [];
        createdJobs.push(await queue.createJob({ type: "SomeType" }));
        await setTimeoutPromise(100);
        createdJobs.push(await queue.createJob({ type: "SomeType" }));
        await setTimeoutPromise(100);
        createdJobs.push(await queue.createJob({ type: "SomeType" }));

        await queue.removeJobsByCallback((job: Job) => job.id !== createdJobs[1].id);

        const jobs = await queue.listJobs();

        expect(jobs).toHaveLength(1);
        expect(jobs[0].id).toBe(createdJobs[1].id);
    });
});

describe("Job API", () => {
    test("setProgress", async () => {
        expect.assertions(3);

        const queue = await Queue.createQueue({ inMemoryOnly: true });

        queue.process(
            "SomeType",
            async (job: Job) => {
                await job.setProgress(1, 3);
                expect(job.progress).toBeCloseTo(1 / 3 * 100);

                await job.setProgress(2, 3);
                expect(job.progress).toBeCloseTo(2 / 3 * 100);

                await job.setProgress(3, 3);
                expect(job.progress).toBeCloseTo(3 / 3 * 100);
            },
            1
        );

        await queue.createJob({ type: "SomeType" });
        await setTimeoutPromise(100);
    });

    test("remove", async () => {
        const queue = await Queue.createQueue({ inMemoryOnly: true });

        const createdJob = await queue.createJob({ type: "SomeType" });

        expect(await createdJob.isExist()).toBe(true);

        await createdJob.remove();

        expect(await createdJob.isExist()).toBe(false);
    });
});

test("Multiple Workers", async () => {
    const queue = await Queue.createQueue({ inMemoryOnly: true });

    let completedJobCount = 0;
    queue.on(Event.Complete, () => {
        completedJobCount++;
    });

    let createdJobCount = 0;
    for (let i = 0; i < 10; i++) {
        await queue.createJob({ type: "SomeType" });
        createdJobCount++;
    }

    expect(completedJobCount).toBe(0);

    // eslint-disable-next-line @typescript-eslint/no-empty-function
    queue.process("SomeType", async () => {}, 5);

    // WorkerがJobを処理し終えるまで待つ
    await setTimeoutPromise(100);

    expect(completedJobCount).toBe(createdJobCount);

    for (let i = 0; i < 10; i++) {
        await queue.createJob({ type: "SomeType" });
        createdJobCount++;
    }

    // WorkerがJobを処理し終えるまで待つ
    await setTimeoutPromise(100);

    expect(completedJobCount).toBe(createdJobCount);
});
