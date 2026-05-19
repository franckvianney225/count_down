import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

export class CreatePanelistDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @Type(() => Number)
  @IsInt()
  @Min(60)
  totalSeconds: number;

  @IsString()
  @IsOptional()
  fonction?: string;

  @IsString()
  @IsOptional()
  structure?: string;
}
