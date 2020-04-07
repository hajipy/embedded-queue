import { mock } from "jest-mock-extended";
import * as util from "util";

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
        saved: false,
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
        saved: false,
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
