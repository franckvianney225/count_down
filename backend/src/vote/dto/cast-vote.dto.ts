import { IsString, IsNotEmpty, IsInt } from 'class-validator';
import { Type } from 'class-transformer';

export class CastVoteDto {
  @IsString()
  @IsNotEmpty()
  token: string;

  @Type(() => Number)
  @IsInt()
  optionId: number;
}
