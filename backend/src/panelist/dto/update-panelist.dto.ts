import { IsArray, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class UpdatePanelistDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  fonction?: string;

  @IsString()
  @IsOptional()
  structure?: string;

  @IsInt()
  @IsOptional()
  @Min(1)
  totalSeconds?: number;

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  phaseIds?: number[];
}
