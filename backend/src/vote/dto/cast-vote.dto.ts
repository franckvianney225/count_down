import { IsString, IsNotEmpty, IsArray, IsInt, ArrayMinSize } from 'class-validator';
import { Type } from 'class-transformer';

export class CastVoteDto {
  @IsString()
  @IsNotEmpty()
  token: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsInt({ each: true })
  @Type(() => Number)
  optionIds: number[];
}
