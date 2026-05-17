import { IsString, IsNotEmpty, IsInt, Min, Max, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';

export class SendMessageDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  text: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)  // 0 = permanent
  @Max(60)
  duration: number; // secondes
}
