# embedded-queue
![Test](https://github.com/hajipy/embedded-queue/workflows/Test/badge.svg)

embedded-queue is job/message queue for Node.js and Electron. It is not required other process for persistence data, like Redis, MySQL, and so on. It persistence data by using [nedb](https://github.com/louischatriot/nedb) embedded database.

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

    // set up job processor for "adder" type, concurrency is 1
    queue.process(
        "adder",
        async (job) => job.data.a + job.data.b,
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

    // create "adder" type job
    await queue.createJob({
        type: "adder",
        data: { a: 1, b: 2 },
    });

    // shutdown queue
    setTimeout(async () => { await queue.shutdown(1000); }, 1);
})();
```

## Basic
- Create Queue
- Set Job Processor
- Set Job Event Handler
- Create Job
- Shutdown Queue

### Create Queue
You can create a new queue by calling `Queue.createQueue(dbOptions)`. `dbOptions` argument is pass to nedb database constructor. for more information see [nedb documents](https://github.com/louischatriot/nedb#creatingloading-a-database). `Queue.createQueue` returns a `Promise`, `await` it for initialize finish.

### Set Job Processor
Job processor is a function that process single job. It is called by `Worker` and pass `Job` argument, it must return `Promise<any>`. It runs any process(calculation, network access, etc...) and call `resolve(result)`. Required data can pass by `Job.data` object. Also you can call `Job.setProgress` for notify progress, `Job.addLog` for logging.
You can set any number of job processors, each processor is associate to single job `type`, it processes only jobs of that `type`.
If you want to need process many jobs that same `type` in concurrency, you can launch any number of job processor of same `type`.

Finally, `queue.process` method signature is `quque.process(type, processor, concurrency)`.

### Set Job Event Handler
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
| `Event.Log`      | Job log add                                      | `(job, message) => void`  |
| `Event.Priority` | Job priority change                              | `(job, priority) => void` |

`Event.Complete` event handler is most commonly used, it can receive job result from job processor.  

### Create Job
You can create a job by calling `Queue.createJob(data)`. `data` argument is object that contains `type`, `priority` and `data`.

| Field      | Type       | Description |
|------------|------------|-------------|
| `type`     | `string`   | Identifier for select job processor |
| `priority` | `Priority` | `Queue` picks up job that has high priority first |
| `data`     | `object`   | Data that is used by job processor, you can set any data |

`Queue.createJob(data)` returns `Promise<Job>` object, this job is associated to `Queue`.

`Priority` is any of `Priority.LOW`, `Priority.NORMAL`, `Priority.MEDIUM`, `Priority.HIGH`, `Priority.CRITICAL`.

### Shutdown Queue
If you want stop processing jobs, you have to call `Queue.shutdown(timeoutMilliseconds, type) => Promise<void>`. `Queue` starts to stop running job processor, and all job processors are stopped, Promise is resolved. If stopping job processor takes long time, after `timeoutMilliseconds` `Queue` terminate job processor, and set `Job.state` to `State.FAILURE`.  
You can stop specified type job processor by passing second argument `type`. If `undefined` is passed, stop all type job processors. 

## API

### Queue API
- `createJob(data)`: Create a new `Job`, see above for usage.
- `process(type, processor, concurrency)`: Set job processor, see above for usage.
- `shutdown(timeoutMilliseconds, type)`: Start shutting down `Queue`, see above for usage.
- `findJob(id)`: Search queue by `Job.id`. If found return `Job`, otherwise return `null`. 
- `listJobs(state)`: List all jobs that has specified state. If passed `undefined` return all jobs. 
- `removeJobById(id)`: Remove a `Job` from queue that specified id. 
- `removeJobsByCallback(callback)`: Remove all jobs that `callback` returns `true`. Callback signature is `(job) => boolean`. 

### Job API
- `setProgress(completed, total)`: Set progress, arguments are convert to percentage value(completed / total).
- `addLog(message)`: Add log.
- `save()`: After call it, job put into associate `Queue`, and waiting for process by job processor.
- `remove()`: Remove job from `Queue`, it will not be processed anymore.
- `setPriority(value)`: Set `priority` value.
- `isExist()`: Return `Job` is in `Queue`. Before calling `save()` or after calling `remove()` returns `false`, otherwise `true`. 
- Getters
    - `id`: String that identifies `Job`.
    - `type`: String that Identifier for select job processor.
    - `data`: Object that is used by job processor, you can set any data.
    - `priority`: Number that determines processing order.
    - `createdAt`: Date that job is created.
    - `updatedAt`: Date that job is updated.
    - `startedAt`: Date that job processor start process. Before job start, value is `undefined`. 
    - `completedAt`: Date that job processor complete process. Before job complete or job failed, value is `undefined`.
    - `failedAt`:  Date that job processor occurred error. Before job complete or job complete successfully, value is `undefined`.
    - `state`: String that represents current `Job` state, any of `State.INACTIVE`, `State.ACTIVE`, `STATE.COMPLETE`, `State.FAILURE`.
    - `duration`: Number that processing time of `Job` in milliseconds. Before job complete or job failed, value is `undefined`.
    - `progress`: Number that `Job` progress in percentage. You can set value by calling `Job.setProgress`. When job complete, set 100 automatically.
    - `logs`: Array of String. You can add log by calling `Job.addLog`.

## Advanced

### Unexpectedly Termination
If your program suddenly terminated without calling `Queue.shutdown` while your processor was processing jobs. These jobs remain `State.ACTIVE` in queue. When next time `Queue.createQueue` is called, these jobs are updated to `State.FAILURE` automatically.    
If you want reprocessing these jobs, please call `Queue.createJob` with same parameter.

## License
MIT
