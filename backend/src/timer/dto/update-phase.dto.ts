import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class UpdatePhaseDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsInt()
  @IsOptional()
  @Min(1)
  duration?: number;
}
