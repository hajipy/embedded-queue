# embedded-queue
embedded-queue is job/message queue for Node.js and Electron. It is not need other process for persistence data, like Redis, MySQL, and so on. It persitences data by using [nedb](https://github.com/louischatriot/nedb) embedded database.

## Installation
```sh
npm install --save embedded-queue 
```
or 
```sh
yarn add embedded-queue 
```

## Basic Usage
```js
const EmbeddedQueue = require("embedded-queue");

(async () => {
    // argument path through nedb
    const queue = await EmbeddedQueue.Queue.createQueue({ inMemoryOnly: true });

    // set up job processor for "type1", concurrency is 1
    queue.process(
        "type1",
        (job) => {
            return new Promise((resolve) => {
                resolve(job.data.a + job.data.b);
            })
        },
        1
    );

    // handle job complete event
    queue.on(
        EmbeddedQueue.Event.Complete,
        (job, result) => {
            console.log("Job Completed.");
            console.log(`    job.id: ${job.id}`);
            console.log(`    job.type: ${job.type}`);
            console.log(`    job.data: ${JSON.stringify(job.data)}`);
            console.log(`    result: ${result}`);
        }
    );

    // create "type1" job
    const job1 = queue.createJob({
        type: "type1",
        data: { a: 1, b: 2 },
    });
    // job need to save
    await job1.save();

    // shutdown queue
    setTimeout(async () => { await queue.shutdown(1000); }, 1);
})();
```

## API
- Create queue
- Set job processor
- Set job event handler
- Create job
    - Priority    
- Shutdown queue
- Queue API
    - findJob
    - listJobs
    - removeJobById
    - removeJobsByCallback
- Job API
    - getter
        - priority
        - createdAt
        - updatedAt
        - startedAt
        - completedAt
        - failedAt
        - state
        - duration
        - progress
        - logs
    - setProgress
    - addLog
    - save
    - remove
    - setPriority
    - isExist

### Create queue
You can create a new queue by calling `Queue.createQueue(dbOptions)`. `dbOptions` argument is pass to nedb database constructor. for more information see [nedb documents](https://github.com/louischatriot/nedb#creatingloading-a-database). `Queue.createQueue` returns a `Promise`, `await` it for initialize finish.

### Set job processor
Job processor is a function that process single job. It is called by `Worker` and pass `Job` argument, it must return `Promise<any>`. It runs any process(calculation, network access, etc...) and call `resolve(result)`. Required data can pass by `Job.data` object. Also you can call `Job.setProgress` for notify progress, `Job.addLog` for logging.
You can set any number of job processors, each processor is associate to single job `type`, it processes only jobs of that `type`.
If you want to need process many jobs that same `type` in concurrency, you can launch any number of job processor of same `type`.

Finally, `queue.process` method signature is `quque.process(type, processor, concurrency)`.
 
### Set job event handler
`Queue` implements `EventEmitter`, when job is completed or job is failed, job progress updated, etc..., you can observe these events by set handlers `Queue.on(Event, Handler)`.

| Event            | Description                                      | Handler Signature         |
|------------------|--------------------------------------------------|---------------------------|
| `Event.Enqueue`  | Job add to queue                                 | `(job) => void`           | 
| `Event.Start`    | Job start processing                             | `(job) => void`           |
| `Event.Failure`  | Job process fail                                 | `(job, error) => void`    |
| `Event.Complete` | Job process complete                             | `(job, result) => void`   |
| `Event.Remove`   | Job is removed from queue                        | `(job) => void`           |
| `Event.Error`    | Error has occurred (on outside of job processor) | `(error, job?) => void`   |
| `Event.Progress` | Job progress update                              | `(job, progress) => void` |
| `Event.Log`      | Job log add                                      | `(job) => void`           |
| `Event.Priority` | Job priority change                              | `(job) => void`           |

`Event.Complete` event handler is most used, it can receive job result from job processor.  

### Create job
WIP...

## License
MIT
