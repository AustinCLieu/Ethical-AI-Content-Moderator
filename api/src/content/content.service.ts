// api/src/content/content.service.ts
import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { jobsQ } from '../queue'; // BullMQ queues

// Single Prisma client instance for this process
const prisma = new PrismaClient();

type CreateDto = { orgId: string; text: string; lang?: string };
type EnqueueJob = { contentId: string; text: string; lang: string };

@Injectable()
export class ContentService {
    /**
     * Insert the content row. If this fails, it's a DB/Prisma problem.
     */
    async create(dto: CreateDto) {
        try {
            // DEV visibility: print the DB host/DB name we think we're using
            console.log(
                '[content.service] DB URL tail:',
                process.env.DATABASE_URL?.split('@').pop()
            );

            // Make sure strings are strings (DTOs already help, this is just defensive)
            const orgId = String(dto.orgId);
            const text = String(dto.text);
            const lang = dto.lang ? String(dto.lang) : 'en';

            const content = await prisma.content.create({
                data: { orgId, text, lang },
            });

            console.log('[content.service] insert OK:', content.id);
            return content;
        } catch (err: any) {
            // Prisma errs often include .code (e.g. P1001 can't reach DB)
            console.error('[content.service] prisma insert failed:', err);
            throw new HttpException(
                {
                    message: 'DB insert failed',
                    detail: err?.code ? { code: err.code, meta: err.meta } : err?.message ?? String(err),
                },
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    /**
     * Enqueue a moderation job. If this fails, it's Redis/BullMQ connectivity or envs.
     */
    async enqueueModeration(job: EnqueueJob) {
        try {
            console.log(
                '[content.service] enqueue ->',
                job.contentId,
                'redis=',
                `${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`
            );

            const res = await jobsQ.add('moderate', job);

            console.log('[content.service] enqueued job id:', res.id);
        } catch (err: any) {
            console.error('[content.service] enqueue failed:', err);
            throw new HttpException(
                {
                    message: 'Queue enqueue failed',
                    detail: err?.message ?? String(err),
                    redis: `${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`,
                },
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }
}

// import { Injectable } from '@nestjs/common';
// import { PrismaClient } from '@prisma/client';
// import { jobsQ } from '../queue';
// import { CreateContentDto } from './dto/create-content.dto';

// // This is the logic layer. It:
// // Talks to Prisma (DB)
// // Talks to BullMQ queue (background jobs)
// // Returns data back to the controller

// // Creates a single Prisma client instance here
// // This lets us talk to Postgres through Prisma
// const prisma = new PrismaClient();

// @Injectable() // Marks this class as injectable (so Nest can use DI)
// export class ContentService {
//     // Create a new content row in the DB
//     async create(dto: CreateContentDto) {
//         return prisma.content.create({
//             data: {
//                 orgId: dto.orgId,
//                 text: dto.text,
//                 lang: dto.lang ?? 'en' // defaults to english if not provided
//             },
//         });
//     }

//     // Adds a job to the moderation queue (BullMQ + redis)
//     async enqueueModeration(job: { contentId: string; text: string; lang: string }) {
//         await jobsQ.add('moderate', job); // Pushes job into Redis
//     }
// }
