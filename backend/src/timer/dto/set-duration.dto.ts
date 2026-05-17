import { IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class SetDurationDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  duration: number; // en minutes
}
