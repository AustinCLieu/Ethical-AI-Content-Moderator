import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { jobsQ } from '../queue';
import { CreateContentDto } from './dto/create-content.dto';

// This is the logic layer. It:
// Talks to Prisma (DB)
// Talks to BullMQ queue (background jobs)
// Returns data back to the controller

// Creates a single Prisma client instance here
// This lets us talk to Postgres through Prisma
const prisma = new PrismaClient();

@Injectable() // Marks this class as injectable (so Nest can use DI)
export class ContentService {
    // Create a new content row in the DB
    async create(dto: CreateContentDto) {
        return prisma.content.create({
            data: {
                orgId: dto.orgId,
                text: dto.text,
                lang: dto.lang ?? 'en' // defaults to english if not provided
            },
        });
    }

    // Adds a job to the moderation queue (BullMQ + redis)
    async enqueueModeration(job: { contentId: string; text: string; lang: string }) {
        await jobsQ.add('moderate', job); // Pushes job into Redis
    }
}
