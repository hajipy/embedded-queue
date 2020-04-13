import * as util from "util";

import { Event, Job, Queue } from "../src";

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

    await queue.createJob({
        type: "adder",
        data: { a: 1, b: 2 },
    });

    await setTimeoutPromise(100);

    expect(completeHandler).toHaveBeenCalledTimes(1);
    expect(completeHandler.mock.calls[0][0]).toBeInstanceOf(Job);
    expect(completeHandler.mock.calls[0][1]).toBe(3);

    // shutdown queue
    setTimeout(async () => { await queue.shutdown(100); }, 1);
});
