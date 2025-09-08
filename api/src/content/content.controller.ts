import { Body, Controller, Post } from '@nestjs/common';
import { ContentService } from './content.service';
import { CreateContentDto } from './dto/create-content.dto';

@Controller('api/v1/content')
export class ContentController {
    constructor(private readonly contentSvc: ContentService) { }

    @Post()
    async create(@Body() dto: CreateContentDto) {
        // Save content to DB
        const content = await this.contentSvc.create(dto);
        // enqueue moderation job (will wire this later in step 2)
        await this.contentSvc.enqueueModeration({
            contentId: content.id,
            text: content.text,
            lang: content.lang
        });
        return { id: content.id };
    }
}
