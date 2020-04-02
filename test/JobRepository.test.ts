import DataStore from "nedb";
import { Priority, State } from "../src";
import { JobRepository } from "../src/jobRepository";

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
        const insertDocs = [
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
                createdAt: new Date(),
                updatedAt: new Date(),
                startedAt: new Date(),
                completedAt: new Date(),
                failedAt: new Date(),
                state: State.INACTIVE,
                duration: 123,
                progress: 1 / 3,
                logs: [
                    "First Log",
                    "Second Log",
                    "Third Log",
                ],
            },
        ];

        for (const insertDoc of insertDocs) {
            await new Promise<void>(((resolve, reject) => {
                db.insert(insertDoc, (error) => {
                    if (error !== null) {
                        reject(error);
                    }
                    else {
                        resolve();
                    }
                });
            }));
        }

        const jobs = await repository.listJobs();

        expect(jobs).toHaveLength(1);
    });
});
