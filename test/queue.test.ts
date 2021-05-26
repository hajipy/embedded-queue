import { v4 as uuid } from "uuid";

import { Job, Priority, Queue, State } from "../src";
import { JobRepository, NeDbJob } from "../src/jobRepository";

// Note: Same as src/queue.ts
interface WaitingWorkerRequest {
    resolve: (value: Job) => void;
    reject: (error: Error) => void;
}

jest.mock("uuid");

test("process & shutdown", async () => {
    const queue = await Queue.createQueue({
        inMemoryOnly: true,
    });

    const type1 = "type1";
    const processor1 = jest.fn();
    const concurrency1 = 2;
    queue.process(type1, processor1, concurrency1);

    expect(queue.workers).toHaveLength(concurrency1);
    for (let i = 0; i < concurrency1; i++) {
        expect(queue.workers[i].type).toBe(type1);
        expect(queue.workers[i].isRunning).toBe(true);
    }

    const type2 = "type2";
    const processor2 = jest.fn();
    const concurrency2 = 3;
    queue.process(type2, processor2, concurrency2);

    expect(queue.workers).toHaveLength(concurrency1 + concurrency2);
    for (let i = concurrency1; i < concurrency2; i++) {
        expect(queue.workers[i].type).toBe(type2);
        expect(queue.workers[i].isRunning).toBe(true);
    }

    const spiedWorkersShutdown = queue.workers.map((worker) => jest.spyOn(worker, "shutdown"));
    const timeoutMilliseconds = 100;
    await queue.shutdown(timeoutMilliseconds, type1);

    expect(queue.workers).toHaveLength(concurrency2);
    for (let i = 0; i < concurrency1; i++) {
        expect(spiedWorkersShutdown[i]).toHaveBeenCalledTimes(1);
        expect(spiedWorkersShutdown[i].mock.calls[0][0]).toBe(timeoutMilliseconds);
    }
    for (let i = concurrency1; i < concurrency2; i++) {
        expect(spiedWorkersShutdown[i]).not.toHaveBeenCalled();
        expect(queue.workers[i].type).toBe(type2);
        expect(queue.workers[i].isRunning).toBe(true);
    }

    await queue.shutdown(timeoutMilliseconds, type2);

    expect(queue.workers).toHaveLength(0);
    for (let i = concurrency1; i < concurrency2; i++) {
        expect(spiedWorkersShutdown[i]).toHaveBeenCalledTimes(1);
        expect(spiedWorkersShutdown[i].mock.calls[0][0]).toBe(timeoutMilliseconds);
    }
});

test("createJob", async () => {
    const uuidValue = "12345678-90ab-cdef-1234-567890abcdef";
    // eslint-disable-next-line
    (uuid as any).mockReturnValue(uuidValue);

    const queue = await Queue.createQueue({
        inMemoryOnly: true,
    });

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

    const job = await queue.createJob({
        type,
        priority,
        data,
    });

    const currentTimestamp = new Date();
    expect(job.id).toBe(uuidValue);
    expect(job.type).toBe(type);
    expect(job.data).toBe(data);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((job as any).queue).toBe(queue);
    expect(job.priority).toBe(priority);
    expect(currentTimestamp.getTime() - job.createdAt.getTime()).toBeLessThan(100);
    expect(currentTimestamp.getTime() - job.updatedAt.getTime()).toBeLessThan(100);
    expect(job.logs).toHaveLength(0);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((job as any)._saved).toBe(true);
});

describe("findJob", () => {
    test("found", async () => {
        const queue = await Queue.createQueue({
            inMemoryOnly: true,
        });

        const nedbJob: NeDbJob = {
            _id: "1",
            type: "type",
            priority: Priority.NORMAL,
            data: {
                a: "aaa",
                b: 123,
                c: {
                    x: true,
                    y: {
                        z: true,
                    },
                },
            },
            createdAt: new Date(2020, 4, 1, 0, 0, 0),
            updatedAt: new Date(2020, 4, 2, 0, 0, 0),
            startedAt: new Date(2020, 4, 3, 0, 0, 0),
            completedAt: new Date(2020, 4, 4, 0, 0, 0),
            failedAt: new Date(2020, 4, 5, 0, 0, 0),
            state: State.INACTIVE,
            duration: 123,
            progress: 1 / 3,
            logs: [
                "First Log",
                "Second Log",
                "Third Log",
            ],
        };

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const repository = (queue as any).repository as JobRepository;
        const mockedRepositoryFindJob = jest.fn().mockResolvedValue(nedbJob);
        repository.findJob = mockedRepositoryFindJob;

        const id = "1";
        const job = await queue.findJob(id);

        expect(job).not.toBeNull();
        /* eslint-disable @typescript-eslint/no-non-null-assertion, @typescript-eslint/no-explicit-any */
        expect((job as any).queue).toBe(queue);
        expect(job!.id).toBe(nedbJob._id);
        expect(job!.type).toBe(nedbJob.type);
        expect(job!.priority).toBe(nedbJob.priority);
        expect(job!.data).toEqual(nedbJob.data);
        expect(job!.createdAt).toEqual(nedbJob.createdAt);
        expect(job!.updatedAt).toEqual(nedbJob.updatedAt);
        expect(job!.startedAt).toEqual(nedbJob.startedAt);
        expect(job!.completedAt).toEqual(nedbJob.completedAt);
        expect(job!.failedAt).toEqual(nedbJob.failedAt);
        expect(job!.state).toBe(nedbJob.state);
        expect(job!.duration).toBe(nedbJob.duration);
        expect(job!.progress).toBe(nedbJob.progress);
        expect(job!.logs).toEqual(nedbJob.logs);
        expect((job as any)._saved).toBe(true);
        /* eslint-enable @typescript-eslint/no-non-null-assertion, @typescript-eslint/no-explicit-any */

        expect(mockedRepositoryFindJob).toHaveBeenCalledTimes(1);
        expect(mockedRepositoryFindJob.mock.calls[0][0]).toBe(id);
    });

    test("not found", async () => {
        const queue = await Queue.createQueue({
            inMemoryOnly: true,
        });

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const repository = (queue as any).repository as JobRepository;
        const mockedRepositoryFindJob = jest.fn().mockResolvedValue(null);
        repository.findJob = mockedRepositoryFindJob;

        const id = "1";
        const job = await queue.findJob(id);

        expect(job).toBeNull();
        expect(mockedRepositoryFindJob).toHaveBeenCalledTimes(1);
        expect(mockedRepositoryFindJob.mock.calls[0][0]).toBe(id);
    });
});

test("listJobs", async () => {
    const queue = await Queue.createQueue({
        inMemoryOnly: true,
    });

    const nedbJobs: NeDbJob[] = [
        {
            _id: "1",
            type: "type",
            priority: Priority.NORMAL,
            data: {
                a: "aaa",
                b: 123,
                c: {
                    x: true,
                    y: {
                        z: true,
                    },
                },
            },
            createdAt: new Date(2020, 4, 1, 0, 0, 0),
            updatedAt: new Date(2020, 4, 2, 0, 0, 0),
            startedAt: new Date(2020, 4, 3, 0, 0, 0),
            completedAt: new Date(2020, 4, 4, 0, 0, 0),
            failedAt: new Date(2020, 4, 5, 0, 0, 0),
            state: State.INACTIVE,
            duration: 123,
            progress: 1 / 3,
            logs: [
                "First Log",
                "Second Log",
                "Third Log",
            ],
        },
        {
            _id: "2",
            type: "type",
            priority: Priority.HIGH,
            createdAt: new Date(2020, 4, 6, 0, 0, 0),
            updatedAt: new Date(2020, 4, 7, 0, 0, 0),
            startedAt: new Date(2020, 4, 8, 0, 0, 0),
            completedAt: new Date(2020, 4, 9, 0, 0, 0),
            failedAt: new Date(2020, 4, 10, 0, 0, 0),
            state: State.ACTIVE,
            duration: 234,
            progress: 2 / 3,
            logs: [
            ],
        },
        {
            _id: "3",
            type: "type",
            priority: Priority.LOW,
            createdAt: new Date(2020, 4, 11, 0, 0, 0),
            updatedAt: new Date(2020, 4, 12, 0, 0, 0),
            startedAt: new Date(2020, 4, 13, 0, 0, 0),
            completedAt: new Date(2020, 14, 9, 0, 0, 0),
            failedAt: new Date(2020, 4, 15, 0, 0, 0),
            state: State.COMPLETE,
            duration: 345,
            progress: 3 / 4,
            logs: [
            ],
        },
    ];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const repository = (queue as any).repository as JobRepository;
    const mockedRepositoryListJobs = jest.fn().mockResolvedValue(nedbJobs);
    repository.listJobs = mockedRepositoryListJobs;

    const state = State.ACTIVE;
    const jobs = await queue.listJobs(state);

    expect(jobs).toHaveLength(3);

    for (const [index, job] of jobs.entries()) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect((job as any).queue).toBe(queue);
        expect(job.id).toBe(nedbJobs[index]._id);
        expect(job.type).toBe(nedbJobs[index].type);
        expect(job.priority).toBe(nedbJobs[index].priority);
        expect(job.data).toEqual(nedbJobs[index].data);
        expect(job.createdAt).toEqual(nedbJobs[index].createdAt);
        expect(job.updatedAt).toEqual(nedbJobs[index].updatedAt);
        expect(job.startedAt).toEqual(nedbJobs[index].startedAt);
        expect(job.completedAt).toEqual(nedbJobs[index].completedAt);
        expect(job.failedAt).toEqual(nedbJobs[index].failedAt);
        expect(job.state).toBe(nedbJobs[index].state);
        expect(job.duration).toBe(nedbJobs[index].duration);
        expect(job.progress).toBe(nedbJobs[index].progress);
        expect(job.logs).toEqual(nedbJobs[index].logs);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect((job as any)._saved).toBe(true);
    }
    expect(mockedRepositoryListJobs).toHaveBeenCalledTimes(1);
    expect(mockedRepositoryListJobs.mock.calls[0][0]).toBe(state);
});

describe("removeJobById", () => {
    test("found", async () => {
        const queue = await Queue.createQueue({
            inMemoryOnly: true,
        });

        const nedbJob: NeDbJob = {
            _id: "1",
            type: "type",
            priority: Priority.NORMAL,
            data: {
                a: "aaa",
                b: 123,
                c: {
                    x: true,
                    y: {
                        z: true,
                    },
                },
            },
            createdAt: new Date(2020, 4, 1, 0, 0, 0),
            updatedAt: new Date(2020, 4, 2, 0, 0, 0),
            startedAt: new Date(2020, 4, 3, 0, 0, 0),
            completedAt: new Date(2020, 4, 4, 0, 0, 0),
            failedAt: new Date(2020, 4, 5, 0, 0, 0),
            state: State.INACTIVE,
            duration: 123,
            progress: 1 / 3,
            logs: [
                "First Log",
                "Second Log",
                "Third Log",
            ],
        };

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const repository = (queue as any).repository as JobRepository;
        const mockedRepositoryFindJob = jest.fn().mockResolvedValue(nedbJob);
        repository.findJob = mockedRepositoryFindJob;

        const id = "1";
        await queue.removeJobById(id);

        expect(mockedRepositoryFindJob).toHaveBeenCalledTimes(1);
        expect(mockedRepositoryFindJob.mock.calls[0][0]).toBe(id);
    });

    test("not found", async () => {
        const queue = await Queue.createQueue({
            inMemoryOnly: true,
        });

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const repository = (queue as any).repository as JobRepository;
        const mockedRepositoryFindJob = jest.fn().mockResolvedValue(null);
        repository.findJob = mockedRepositoryFindJob;

        const id = "1";
        await expect(
            queue.removeJobById(id)
        ).rejects.toThrow();

        expect(mockedRepositoryFindJob).toHaveBeenCalledTimes(1);
        expect(mockedRepositoryFindJob.mock.calls[0][0]).toBe(id);
    });
});

test("removeJobsByCallback", async () => {
    const queue = await Queue.createQueue({
        inMemoryOnly: true,
    });

    const nedbJobs: NeDbJob[] = [
        {
            _id: "1",
            type: "type",
            priority: Priority.NORMAL,
            data: {
                a: "aaa",
                b: 123,
                c: {
                    x: true,
                    y: {
                        z: true,
                    },
                },
            },
            createdAt: new Date(2020, 4, 1, 0, 0, 0),
            updatedAt: new Date(2020, 4, 2, 0, 0, 0),
            startedAt: new Date(2020, 4, 3, 0, 0, 0),
            completedAt: new Date(2020, 4, 4, 0, 0, 0),
            failedAt: new Date(2020, 4, 5, 0, 0, 0),
            state: State.INACTIVE,
            duration: 123,
            progress: 1 / 3,
            logs: [
                "First Log",
                "Second Log",
                "Third Log",
            ],
        },
        {
            _id: "2",
            type: "type",
            priority: Priority.HIGH,
            createdAt: new Date(2020, 4, 6, 0, 0, 0),
            updatedAt: new Date(2020, 4, 7, 0, 0, 0),
            startedAt: new Date(2020, 4, 8, 0, 0, 0),
            completedAt: new Date(2020, 4, 9, 0, 0, 0),
            failedAt: new Date(2020, 4, 10, 0, 0, 0),
            state: State.ACTIVE,
            duration: 234,
            progress: 2 / 3,
            logs: [
            ],
        },
        {
            _id: "3",
            type: "type",
            priority: Priority.LOW,
            createdAt: new Date(2020, 4, 11, 0, 0, 0),
            updatedAt: new Date(2020, 4, 12, 0, 0, 0),
            startedAt: new Date(2020, 4, 13, 0, 0, 0),
            completedAt: new Date(2020, 14, 9, 0, 0, 0),
            failedAt: new Date(2020, 4, 15, 0, 0, 0),
            state: State.COMPLETE,
            duration: 345,
            progress: 3 / 4,
            logs: [
            ],
        },
    ];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const repository = (queue as any).repository as JobRepository;
    const mockedRepositoryListJobs = jest.fn().mockResolvedValue(nedbJobs);
    repository.listJobs = mockedRepositoryListJobs;

    const removeCallback = jest.fn().mockImplementation((job: Job) => job.id !== "2");

    const removedJobs = await queue.removeJobsByCallback(removeCallback);

    expect(removedJobs).toHaveLength(2);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((removedJobs[0] as any).queue).toBe(queue);
    expect(removedJobs[0].id).toBe(nedbJobs[0]._id);
    expect(removedJobs[0].type).toBe(nedbJobs[0].type);
    expect(removedJobs[0].priority).toBe(nedbJobs[0].priority);
    expect(removedJobs[0].data).toEqual(nedbJobs[0].data);
    expect(removedJobs[0].createdAt).toEqual(nedbJobs[0].createdAt);
    expect(removedJobs[0].updatedAt).toEqual(nedbJobs[0].updatedAt);
    expect(removedJobs[0].startedAt).toEqual(nedbJobs[0].startedAt);
    expect(removedJobs[0].completedAt).toEqual(nedbJobs[0].completedAt);
    expect(removedJobs[0].failedAt).toEqual(nedbJobs[0].failedAt);
    expect(removedJobs[0].state).toBe(nedbJobs[0].state);
    expect(removedJobs[0].duration).toBe(nedbJobs[0].duration);
    expect(removedJobs[0].progress).toBe(nedbJobs[0].progress);
    expect(removedJobs[0].logs).toEqual(nedbJobs[0].logs);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((removedJobs[0] as any)._saved).toBe(true);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((removedJobs[1] as any).queue).toBe(queue);
    expect(removedJobs[1].id).toBe(nedbJobs[2]._id);
    expect(removedJobs[1].type).toBe(nedbJobs[2].type);
    expect(removedJobs[1].priority).toBe(nedbJobs[2].priority);
    expect(removedJobs[1].data).toEqual(nedbJobs[2].data);
    expect(removedJobs[1].createdAt).toEqual(nedbJobs[2].createdAt);
    expect(removedJobs[1].updatedAt).toEqual(nedbJobs[2].updatedAt);
    expect(removedJobs[1].startedAt).toEqual(nedbJobs[2].startedAt);
    expect(removedJobs[1].completedAt).toEqual(nedbJobs[2].completedAt);
    expect(removedJobs[1].failedAt).toEqual(nedbJobs[2].failedAt);
    expect(removedJobs[1].state).toBe(nedbJobs[2].state);
    expect(removedJobs[1].duration).toBe(nedbJobs[2].duration);
    expect(removedJobs[1].progress).toBe(nedbJobs[2].progress);
    expect(removedJobs[1].logs).toEqual(nedbJobs[2].logs);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((removedJobs[1] as any)._saved).toBe(true);

    expect(mockedRepositoryListJobs).toHaveBeenCalledTimes(1);

    expect(removeCallback).toHaveBeenCalledTimes(3);
    expect((removeCallback.mock.calls[0][0] as Job).id).toBe(nedbJobs[0]._id);
    expect((removeCallback.mock.calls[1][0] as Job).id).toBe(nedbJobs[1]._id);
    expect((removeCallback.mock.calls[2][0] as Job).id).toBe(nedbJobs[2]._id);
});

describe("requestJobForProcessing", () => {
    test("immediately found", async () => {
        const uuidValue = "12345678-90ab-cdef-1234-567890abcdef";
        // eslint-disable-next-line
        (uuid as any).mockReturnValue(uuidValue);

        const queue = await Queue.createQueue({ inMemoryOnly: true });

        await queue.createJob({
            type: "type",
            priority: Priority.NORMAL,
            data: {},
        });

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const waitingRequests: { [type: string]: WaitingWorkerRequest[] } = (queue as any).waitingRequests;

        expect(waitingRequests["type"]).toBeUndefined();
        const job = await queue.requestJobForProcessing("type", () => true);
        expect(job).not.toBeNull();
        expect(job?.id).toBe(uuidValue);
        expect(job?.state).toBe(State.ACTIVE);
        expect(waitingRequests["type"]).toBeUndefined();
    });

    test("queue waiting", async () => {
        const uuidValues = [
            "12345678-90ab-cdef-1234-567890abcdef",
            "23456789-0abc-def1-2345-67890abcdef1",
            "34567890-abcd-ef12-3456-7890abcdef12",
        ];
        // eslint-disable-next-line
        (uuid as any)
            .mockReturnValueOnce(uuidValues[0])
            .mockReturnValueOnce(uuidValues[1])
            .mockReturnValueOnce(uuidValues[2]);

        const queue = await Queue.createQueue({ inMemoryOnly: true });

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const waitingRequests: { [type: string]: WaitingWorkerRequest[] } = (queue as any).waitingRequests;
        expect(waitingRequests["type1"]).toBeUndefined();
        expect(waitingRequests["type2"]).toBeUndefined();

        const findJobPromise1 = queue.requestJobForProcessing("type1", () => true);
        await new Promise<void>((resolve) => setTimeout(resolve, 100));
        expect(waitingRequests["type1"]).not.toBeUndefined();
        expect(waitingRequests["type1"]).toHaveLength(1);
        expect(waitingRequests["type2"]).toBeUndefined();

        const findJobPromise2 = queue.requestJobForProcessing("type1", () => true);
        await new Promise<void>((resolve) => setTimeout(resolve, 100));
        expect(waitingRequests["type1"]).toHaveLength(2);
        expect(waitingRequests["type2"]).toBeUndefined();

        const findJobPromise3 = queue.requestJobForProcessing("type2", () => true);
        await new Promise<void>((resolve) => setTimeout(resolve, 100));
        expect(waitingRequests["type1"]).toHaveLength(2);
        expect(waitingRequests["type2"]).not.toBeUndefined();
        expect(waitingRequests["type2"]).toHaveLength(1);

        await queue.createJob({
            type: "type1",
            priority: Priority.NORMAL,
            data: {},
        });
        const job1 = await findJobPromise1;
        expect(job1).not.toBeNull();
        expect(job1?.id).toBe(uuidValues[0]);
        expect(job1?.state).toBe(State.ACTIVE);
        expect(waitingRequests["type1"]).toHaveLength(1);
        expect(waitingRequests["type2"]).toHaveLength(1);

        await queue.createJob({
            type: "type1",
            priority: Priority.NORMAL,
            data: {},
        });
        const job2 = await findJobPromise2;
        expect(job2).not.toBeNull();
        expect(job2?.id).toBe(uuidValues[1]);
        expect(job2?.state).toBe(State.ACTIVE);
        expect(waitingRequests["type1"]).toHaveLength(0);
        expect(waitingRequests["type2"]).toHaveLength(1);

        await queue.createJob({
            type: "type2",
            priority: Priority.NORMAL,
            data: {},
        });
        const job3 = await findJobPromise3;
        expect(job3).not.toBeNull();
        expect(job3?.id).toBe(uuidValues[2]);
        expect(job3?.state).toBe(State.ACTIVE);
        expect(waitingRequests["type1"]).toHaveLength(0);
        expect(waitingRequests["type2"]).toHaveLength(0);
    });

    describe("job is already unnecessary", () => {
        test("immediately found", async () => {
            const uuidValue = "12345678-90ab-cdef-1234-567890abcdef";
            // eslint-disable-next-line
            (uuid as any).mockReturnValue(uuidValue);

            const queue = await Queue.createQueue({ inMemoryOnly: true });

            await queue.createJob({
                type: "type",
                priority: Priority.NORMAL,
                data: {},
            });

            const job1 = await queue.requestJobForProcessing("type", () => false);
            expect(job1).toBeNull();

            const job2 = await queue.requestJobForProcessing("type", () => false);
            expect(job2).toBeNull();

            const job3 = await queue.requestJobForProcessing("type", () => true);
            expect(job3).not.toBeNull();
            expect(job3?.id).toBe(uuidValue);
        });

        test("queue waiting", async () => {
            const uuidValue = "12345678-90ab-cdef-1234-567890abcdef";
            // eslint-disable-next-line
            (uuid as any).mockReturnValue(uuidValue);

            const queue = await Queue.createQueue({ inMemoryOnly: true });

            const findJobPromise1 = queue.requestJobForProcessing("type", () => false);
            const findJobPromise2 = queue.requestJobForProcessing("type", () => false);
            const findJobPromise3 = queue.requestJobForProcessing("type", () => true);

            await queue.createJob({
                type: "type",
                priority: Priority.NORMAL,
                data: {},
            });

            const job1 = await findJobPromise1;
            expect(job1).toBeNull();

            const job2 = await findJobPromise2;
            expect(job2).toBeNull();

            const job3 = await findJobPromise3;
            expect(job3).not.toBeNull();
            expect(job3?.id).toBe(uuidValue);
        });
    });
});
