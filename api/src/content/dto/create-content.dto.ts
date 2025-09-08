import { IsOptional, IsString } from 'class-validator';

export class CreateContentDto {
    @IsString()
    orgId: string;

    @IsString()
    text: string;

    @IsOptional()
    @IsString()
    lang?: string;
}