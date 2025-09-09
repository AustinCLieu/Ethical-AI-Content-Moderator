import { IsOptional, IsString } from 'class-validator';

// DTO = Data Transfer Object
// This class defines the shape and rules for the body of POST /apy/v1/content
// Insures every incoming request body is validated before it reaches my service
// If someone sends { orgId: 123 }, NestJS will reject it with a 400 error

export class CreateContentDto {
    @IsString() // Validation: orgID must be a string
    orgId: string;

    @IsString() // Validation: text must be a string
    text: string;

    @IsOptional() // Validation: Lang is not required
    @IsString() // If provided, it must be a string
    lang?: string;
}