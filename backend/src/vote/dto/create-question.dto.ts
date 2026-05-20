import { IsString, IsNotEmpty, IsArray, ArrayMinSize, ArrayMaxSize, IsBoolean, IsOptional } from 'class-validator';

export class CreateQuestionDto {
  @IsString()
  @IsNotEmpty()
  question: string;

  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(6)
  @IsString({ each: true })
  options: string[];

  @IsOptional()
  @IsBoolean()
  multiChoice?: boolean;
}
