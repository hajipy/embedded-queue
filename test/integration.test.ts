import * as util from "util";

import { Event, Job, Queue, State } from "../src";

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
