/**
 * Queue with BullMQ
 * 
 * Sets up two Redis-backed queues using BullMQ:
 *  - jobsQ: where the API enqueues "please moderate this text" jobs
 *  - resultsQ: optional queue you can later use to post back ML results
 * 
 * Also exports a helper (startWorker) that starts a background worker
 * process that consumes jobs from jobsQ and runs your handler on each job
 */
import { Queue, Worker } from 'bullmq';

/**
 * Connection options for BullMQ
 * BullMQ uses Redis to store and manage queued jobs
 */
const conn = {
    connection: {
        host: process.env.REDIS_HOST, // e.g., "Localhost" in dev
        port: +(process.env.REDIS_PORT || 0) // +(...) converts string into a number 
    }
};
/**
 * The moderation.jobs queue is where the API places work items
 * Each job is a small JSON payload like: { contentId: "uuid", text: "some text", Lang: "en" }
 * 
 * Naming the queue helps keep things organized when I add more queues later
 * (e.g., "appeals.jobs", "webhooks.hobs", etc)
 */
export const jobsQ = new Queue('moderation.jobs', conn);

/**
 * A separate queue for "results"
 * If the ML servive is to push results asynchronously, I could use it
 * Or if another worker computes explainability and posts references here
 */
export const resultsQ = new Queue('moderation.results', conn);


/**
 * startWorker(handleJob)
 * 
 * Spawns a background worker that listens to moderation.jobs
 * Every time a new job is available, BullMQ calls async handler with
 * the job's data (the JSON you enqueued)
 * 
 * Returns a worker to keep a reference. Lets control of the worker later (close, resume, listen to events). Can close it on shutdown, etc
 * 
 * Usage (in api/src/worker.ts):
 *  import { startWorker } from './queue';
 *  startWorker(async (data) => { ... call ML, save to DB ... })
*/

export const startWorker = (handleJob: (data: any) => Promise<void>) =>
    new Worker(
        'moderation.jobs', // the queue to consume from
        async (job) => { // job processor fn (per-job)
            // 'job.data' is exactly the payload you enqueued
            await handleJob(job.data);
        },
        conn // same Redis connection
    );

