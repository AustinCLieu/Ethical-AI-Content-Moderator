import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { jobsQ } from '../queue';
import { CreateContentDto } from './dto/create-content.dto';

const prisma = new PrismaClient();

@Injectable()
export class ContentService {
    async create(dto: CreateContentDto) {
        return prisma.content.create({
            data: {
                orgId: dto.orgId,
                text: dto.text,
                lang: dto.lang ?? 'en'
            },
        });
    }

    async enqueueModeration(job: { contentId: string; text: string; lang: string }) {
        await jobsQ.add('moderate', job);
    }
}
