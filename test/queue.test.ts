import uuid from "uuid/v4";

import { Priority, Queue, State } from "../src";
import { JobRepository, NeDbJob } from "../src/jobRepository";

jest.mock("uuid/v4");

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
        if (job !== null) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            expect((job as any).queue).toBe(queue);
            expect(job.id).toBe(nedbJob._id);
            expect(job.type).toBe(nedbJob.type);
            expect(job.priority).toBe(nedbJob.priority);
            expect(job.data).toEqual(nedbJob.data);
            expect(job.createdAt).toEqual(nedbJob.createdAt);
            expect(job.updatedAt).toEqual(nedbJob.updatedAt);
            expect(job.startedAt).toEqual(nedbJob.startedAt);
            expect(job.completedAt).toEqual(nedbJob.completedAt);
            expect(job.failedAt).toEqual(nedbJob.failedAt);
            expect(job.state).toBe(nedbJob.state);
            expect(job.logs).toEqual(nedbJob.logs);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            expect((job as any)._saved).toBe(true);
        }
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
        expect(job.logs).toEqual(nedbJobs[index].logs);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect((job as any)._saved).toBe(true);
    }
    expect(mockedRepositoryListJobs).toHaveBeenCalledTimes(1);
    expect(mockedRepositoryListJobs.mock.calls[0][0]).toBe(state);
});
