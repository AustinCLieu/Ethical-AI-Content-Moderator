import { Body, Controller, Post } from '@nestjs/common';
import { ContentService } from './content.service';
import { CreateContentDto } from './dto/create-content.dto';

// This controller handles all routes under /api/v1/content
// The controller is the entrypoint. It delegates to the service

@Controller('api/v1/content')
export class ContentController {
    // Inject ContentService so we can call its methods
    constructor(private readonly contentSvc: ContentService) { }

    // POST /api/v1/content
    // Takes a JSON body validated against CreateContentDto
    @Post()
    async create(@Body() dto: CreateContentDto) {
        // Save content to DB
        const content = await this.contentSvc.create(dto);
        // enqueue moderation job (handled by worker later)
        await this.contentSvc.enqueueModeration({
            contentId: content.id, // DB id of the content
            text: content.text, // content text
            lang: content.lang // Language (default "en")
        });
        // Return only the new content ID to the client
        return { id: content.id };
    }
}
