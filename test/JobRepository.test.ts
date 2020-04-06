import { mock } from "jest-mock-extended";
import DataStore from "nedb";

import { Job, Priority, Queue, State } from "../src";
import { JobRepository, NeDbJob } from "../src/jobRepository";

// Note: Same as src/jobRepository.ts
interface WaitingWorkerRequest {
    resolve: (value: NeDbJob) => void;
    reject: (error: Error) => void;
}

function dbFind(db: DataStore, _id: string): Promise<NeDbJob | null> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return new Promise<NeDbJob | null>((resolve, reject) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        db.findOne({ _id }, (error, doc: NeDbJob | null) => {
            if (error !== null) {
                reject(error);
            }
            else {
                resolve(doc);
            }
        });
    });
}

function dbInsert(db: DataStore, doc: unknown): Promise<void> {
    return new Promise<void>(((resolve, reject) => {
        db.insert(doc, (error) => {
            if (error !== null) {
                reject(error);
            }
            else {
                resolve();
            }
        });
    }));
}

function dbRemove(db: DataStore, _id: string): Promise<void> {
    return new Promise<void>(((resolve, reject) => {
        db.remove({ _id }, (error) => {
            if (error !== null) {
                reject(error);
            }
            else {
                resolve();
            }
        });
    }));
}

describe("init", () => {
    test("Success", async () => {
        const repository = new JobRepository({
            inMemoryOnly: true,
        });

        await expect(
            repository.init()
        ).resolves.toBeUndefined();
    });

    test("Failure", async () => {
        const repository = new JobRepository({
            filename: "/invalid/file/path",
        });

        await expect(
            repository.init()
        ).rejects.toThrow("no such file or directory, open '/invalid/file/path'");
    });
});

describe("listJobs", () => {
    test("no data", async () => {
        const repository = new JobRepository({
            inMemoryOnly: true,
        });
        await repository.init();

        const jobs = await repository.listJobs();

        expect(jobs).toHaveLength(0);
    });

    test("has data", async () => {
        const repository = new JobRepository({
            inMemoryOnly: true,
        });
        await repository.init();

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const db: DataStore = (repository as any).db;
        const id = "1";
        const type = "type";
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
        const createdAt = new Date(2020, 4, 1, 0, 0, 0);
        const updatedAt = new Date(2020, 4, 2, 0, 0, 0);
        const startedAt = new Date(2020, 4, 3, 0, 0, 0);
        const completedAt = new Date(2020, 4, 4, 0, 0, 0);
        const failedAt = new Date(2020, 4, 5, 0, 0, 0);
        const state = State.INACTIVE;
        const duration = 123;
        const progress = 1 / 3;
        const logs = [
            "First Log",
            "Second Log",
            "Third Log",
        ];

        await dbInsert(
            db,
            {
                _id: id,
                type,
                priority,
                data,
                createdAt,
                updatedAt,
                startedAt,
                completedAt,
                failedAt,
                state,
                duration,
                progress,
                logs,
            }
        );

        const jobs = await repository.listJobs();

        expect(jobs).toHaveLength(1);
        expect(jobs[0]).toEqual({
            _id: id,
            type,
            priority,
            data,
            createdAt,
            updatedAt,
            startedAt,
            completedAt,
            failedAt,
            state,
            duration,
            progress,
            logs,
        });
    });

    test("sort", async () => {
        const repository = new JobRepository({
            inMemoryOnly: true,
        });
        await repository.init();

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const db: DataStore = (repository as any).db;

        const createdAts = [
            new Date(2020, 4, 2, 0, 0, 0),
            new Date(2020, 4, 1, 0, 0, 0),
            new Date(2020, 4, 3, 0, 0, 0),
        ];

        for (const [index, createdAt] of createdAts.entries()) {
            await dbInsert(
                db,
                {
                    _id: index.toString(),
                    type: "type",
                    priority: Priority.NORMAL,
                    createdAt,
                    updatedAt: new Date(),
                }
            );
        }

        const jobs = await repository.listJobs();

        expect(jobs).toHaveLength(3);
        expect(jobs[0]._id).toBe("1");
        expect(jobs[0].createdAt).toBe(createdAts[1]);
        expect(jobs[1]._id).toBe("0");
        expect(jobs[1].createdAt).toBe(createdAts[0]);
        expect(jobs[2]._id).toBe("2");
        expect(jobs[2].createdAt).toBe(createdAts[2]);
    });

    test("state", async () => {
        const repository = new JobRepository({
            inMemoryOnly: true,
        });
        await repository.init();

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const db: DataStore = (repository as any).db;

        const states = [
            State.INACTIVE,
            State.ACTIVE,
            State.COMPLETE,
            State.FAILURE,
        ];

        for (const [index, state] of states.entries()) {
            await dbInsert(
                db,
                {
                    _id: index.toString(),
                    type: "type",
                    priority: Priority.NORMAL,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    state,
                }
            );
        }

        const inactiveJobs = await repository.listJobs(State.INACTIVE);
        expect(inactiveJobs).toHaveLength(1);
        expect(inactiveJobs[0]._id).toBe("0");
        expect(inactiveJobs[0].state).toBe(State.INACTIVE);

        const activeJobs = await repository.listJobs(State.ACTIVE);
        expect(activeJobs).toHaveLength(1);
        expect(activeJobs[0]._id).toBe("1");
        expect(activeJobs[0].state).toBe(State.ACTIVE);

        const completeJobs = await repository.listJobs(State.COMPLETE);
        expect(completeJobs).toHaveLength(1);
        expect(completeJobs[0]._id).toBe("2");
        expect(completeJobs[0].state).toBe(State.COMPLETE);

        const failureJobs = await repository.listJobs(State.FAILURE);
        expect(failureJobs).toHaveLength(1);
        expect(failureJobs[0]._id).toBe("3");
        expect(failureJobs[0].state).toBe(State.FAILURE);
    });
});

describe("findJob", () => {
    const repository = new JobRepository({
        inMemoryOnly: true,
    });

    beforeAll(async () => {
        await repository.init();

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const db: DataStore = (repository as any).db;

        for (let i = 1; i <= 3; i++) {
            await dbInsert(
                db,
                {
                    _id: i.toString(),
                    type: "type",
                    priority: Priority.NORMAL,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                }
            );
        }
    });

    test("found", async () => {
        const job = await repository.findJob("1");
        expect(job).not.toBeNull();
        if (job !== null) {
            expect(job._id).toBe("1");
        }
    });

    test("not found", async () => {
        const job = await repository.findJob("4");
        expect(job).toBeNull();
    });
});

describe("findInactiveJobByType", () => {
    test("immediately found", async () => {
        const repository = new JobRepository({
            inMemoryOnly: true,
        });
        await repository.init();

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const db: DataStore = (repository as any).db;

        await dbInsert(
            db,
            {
                _id: "1",
                type: "type",
                priority: Priority.NORMAL,
                createdAt: new Date(),
                updatedAt: new Date(),
                state: State.INACTIVE,
            }
        );

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const waitingWorker: { [type: string]: WaitingWorkerRequest[] } = (repository as any).waitingWorker;

        expect(waitingWorker["type"]).toBeUndefined();
        const job = await repository.findInactiveJobByType("type");
        expect(job._id).toBe("1");
        expect(waitingWorker["type"]).toBeUndefined();
    });

    test("queue waiting", async () => {
        const repository = new JobRepository({
            inMemoryOnly: true,
        });
        await repository.init();

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const waitingWorker: { [type: string]: WaitingWorkerRequest[] } = (repository as any).waitingWorker;
        expect(waitingWorker["type1"]).toBeUndefined();
        expect(waitingWorker["type2"]).toBeUndefined();

        const findJobPromise1 = repository.findInactiveJobByType("type1");
        await new Promise<void>((resolve) => setTimeout(resolve, 100));
        expect(waitingWorker["type1"]).not.toBeUndefined();
        expect(waitingWorker["type1"]).toHaveLength(1);
        expect(waitingWorker["type2"]).toBeUndefined();

        const findJobPromise2 = repository.findInactiveJobByType("type1");
        await new Promise<void>((resolve) => setTimeout(resolve, 100));
        expect(waitingWorker["type1"]).toHaveLength(2);
        expect(waitingWorker["type2"]).toBeUndefined();

        const findJobPromise3 = repository.findInactiveJobByType("type2");
        await new Promise<void>((resolve) => setTimeout(resolve, 100));
        expect(waitingWorker["type1"]).toHaveLength(2);
        expect(waitingWorker["type2"]).not.toBeUndefined();
        expect(waitingWorker["type2"]).toHaveLength(1);

        await repository.addJob(
            new Job({
                queue: mock<Queue>(),
                id: "1",
                type: "type1",
                createdAt: new Date(),
                updatedAt: new Date(),
                state: State.INACTIVE,
                logs: [],
                saved: false,
            })
        );
        const job1 = await findJobPromise1;
        expect(job1._id).toBe("1");
        expect(waitingWorker["type1"]).toHaveLength(1);
        expect(waitingWorker["type2"]).toHaveLength(1);

        await repository.addJob(
            new Job({
                queue: mock<Queue>(),
                id: "2",
                type: "type1",
                createdAt: new Date(),
                updatedAt: new Date(),
                state: State.INACTIVE,
                logs: [],
                saved: false,
            })
        );
        const job2 = await findJobPromise2;
        expect(job2._id).toBe("2");
        expect(waitingWorker["type1"]).toHaveLength(0);
        expect(waitingWorker["type2"]).toHaveLength(1);

        await repository.addJob(
            new Job({
                queue: mock<Queue>(),
                id: "3",
                type: "type2",
                createdAt: new Date(),
                updatedAt: new Date(),
                state: State.INACTIVE,
                logs: [],
                saved: false,
            })
        );
        const job3 = await findJobPromise3;
        expect(job3._id).toBe("3");
        expect(waitingWorker["type1"]).toHaveLength(0);
        expect(waitingWorker["type2"]).toHaveLength(0);
    });

    test("sort", async () => {
        const repository = new JobRepository({
            inMemoryOnly: true,
        });
        await repository.init();

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const db: DataStore = (repository as any).db;

        const priorities: Priority[] = [
            Priority.LOW,
            Priority.NORMAL,
            Priority.MEDIUM,
            Priority.HIGH,
            Priority.CRITICAL,
        ];

        const createdAts = [
            new Date(2020, 4, 3, 0, 0, 0),
            new Date(2020, 4, 2, 0, 0, 0),
            new Date(2020, 4, 1, 0, 0, 0),
        ];

        let id = 1;
        for (const priority of priorities) {
            for (const createdAt of createdAts) {
                await dbInsert(
                    db,
                    {
                        _id: id.toString(),
                        type: "type",
                        priority,
                        createdAt,
                        updatedAt: new Date(),
                        state: State.INACTIVE,
                    }
                );

                id++;
            }
        }

        const sortedPriorities = [...priorities].sort((lhs, rhs) => rhs - lhs);
        const sortedCreatedAt = [...createdAts].sort((lhs, rhs) => lhs.getTime() - rhs.getTime());
        for (const priority of sortedPriorities) {
            for (const createdAt of sortedCreatedAt) {
                const job = await repository.findInactiveJobByType("type");
                expect(job.priority).toBe(priority);
                expect(job.createdAt).toEqual(createdAt);
                await dbRemove(db, job._id);
            }
        }
    });
});

describe("isExistJob", () => {
    const repository = new JobRepository({
        inMemoryOnly: true,
    });

    beforeAll(async () => {
        await repository.init();

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const db: DataStore = (repository as any).db;

        for (let i = 1; i <= 3; i++) {
            await dbInsert(
                db,
                {
                    _id: i.toString(),
                    type: "type",
                    priority: Priority.NORMAL,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                }
            );
        }
    });

    test("exits", async () => {
        expect(await repository.isExistJob("1")).toBe(true);
        expect(await repository.isExistJob("2")).toBe(true);
        expect(await repository.isExistJob("3")).toBe(true);
    });

    test("not exist", async () => {
        expect(await repository.isExistJob("4")).toBe(false);
    });
});

test("addJob", async () => {
    const repository = new JobRepository({
        inMemoryOnly: true,
    });
    await repository.init();

    const job = new Job({
        queue: mock<Queue>(),
        id: "1",
        type: "type",
        priority: Priority.HIGH,
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
        state: State.INACTIVE,
        logs: [
            "log1",
            "log2",
            "log3",
        ],
        saved: false,
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db: DataStore = (repository as any).db;

    const jobDocBefore = await dbFind(db, "1");
    expect(jobDocBefore).toBeNull();

    await repository.addJob(job);

    const jobDocAfter = await dbFind(db, "1");
    expect(jobDocAfter).not.toBeNull();
    if (jobDocAfter !== null) {
        expect(jobDocAfter._id).toBe(job.id);
        expect(jobDocAfter.type).toBe(job.type);
        expect(jobDocAfter.priority).toBe(job.priority);
        expect(jobDocAfter.data).toEqual(job.data);
        expect(jobDocAfter.createdAt).toEqual(job.createdAt);
        expect(jobDocAfter.updatedAt).toEqual(job.updatedAt);
        expect(jobDocAfter.startedAt).toBeUndefined();
        expect(jobDocAfter.completedAt).toBeUndefined();
        expect(jobDocAfter.failedAt).toBeUndefined();
        expect(jobDocAfter.state).toBe(job.state);
        expect(jobDocAfter.logs).toEqual(job.logs);
    }
});

describe("updateJob", () => {
    const job = new Job({
        queue: mock<Queue>(),
        id: "1",
        type: "type",
        priority: Priority.HIGH,
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
        state: State.INACTIVE,
        logs: [
            "log1",
            "log2",
            "log3",
        ],
        saved: true,
    });

    test("not found", async () => {
        const repository = new JobRepository({
            inMemoryOnly: true,
        });
        await repository.init();

        await expect(
            repository.updateJob(job)
        ).rejects.toThrow("update unexpected number of rows. (expected: 1, actual: 0)");
    });
});
