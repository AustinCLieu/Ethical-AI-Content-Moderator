/**
 * Worker that processes moderation jobs
 * 
 * What this does:
 * 1. Connects to the Redis-backed queue ("moderation.jobs") via BullMQ
 * 2. Listens for new jobs (content to moderate)
 * 3. For each job, calls the ML service /classify with Axios
 * 4. Saves the prediction to Postgres via Prisma
 */

import 'dotenv/config';
import axios from 'axios';
import { PrismaClient } from '@prisma/client';
import { startWorker } from './queue';

const prisma = new PrismaClient(); // Initialize Prisma client once for this process

// Define the expected shape of a job's data for type safety
type JobPayload = {
    contentId: string; // the Content.id created in the API
    text: string; // the text to classify
    lang: string; // language code (e.g., "en")
};

// Validate critical env vars early to fail fast with a clear message
function requireEnv(name: string): string {
    const v = process.env[name];
    if (!v) throw new Error(`Missing required env var: ${name}`);
    return v;
}

const ML_URL = requireEnv('ML_URL'); // e.g., http://Localhost:8000
const SVC_JWT = requireEnv('SVC_JWT'); // must match ml/.env:SERVICE_JWT on the ML service

// start the BullMQ worker. It will listen to the moderation.jobs queue
// For each incoming job, the async handler below runs

startWorker(async (data: JobPayload) => {
    // Basic sanity-check on the payload
    const { contentId, text, lang } = data;
    if (!contentId || typeof text !== 'string') {
        // Throwing marks this job as failed; BullMQ can retry (will add this feature later)
        throw new Error(`Invalid job payload: ${JSON.stringify(data)}`);
    }

    // 1. Call the ML service /classify
    // - Axios sends JSON body {text, lang }
    // - Adds authorization: Bearer <SVC_JWT> to match ML service's check
    // - timeout helps avoid hanging forever if ML is down
    const r = await axios.post(
        `${ML_URL}/classify`,
        { text, lang },
        {
            headers: { Authorization: `Bearer ${SVC_JWT}` },
            timeout: 10_000, // 10s timeout, will adjust later if needed
        }
    );

    // Expecting response like:
    // { model: "unitary/toxic-bert", top: "toxic", scores: { "non-toxic": 0.02, "toxic": 0.98} }
    const { model, top, scores } = r.data;

    // 2. Save the prediction row in Postgres
    // - The ModerationPrediction model comes from Prisma scheme
    // - This links prediction to contentId for easier joins
    await prisma.moderationPrediction.create({
        data: {
            contentId,
            modelName: String(model),
            topLabel: String(top),
            // "scores" is a JSON column in the schema, stores the dictionary as-is
            scores: scores,
        },
    });

    // Log success
    console.log(`[worker] stored prediction for content ${contentId}: top="${top}"`);
});
