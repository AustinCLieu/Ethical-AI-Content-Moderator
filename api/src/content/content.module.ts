import { Module } from '@nestjs/common';
import { ContentController } from './content.controller';
import { ContentService } from './content.service';

// A module bundles related code (controller + service) together
// App module imports this so Nest knows to register the routes
// Like a department for my app. Owns everything about content
@Module({
  controllers: [ContentController], // Register /api/v1/content endpoints
  providers: [ContentService], // Register ContentService for injection
})
export class ContentModule { }
