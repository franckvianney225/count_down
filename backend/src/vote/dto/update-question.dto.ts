import { IsString, IsOptional, IsArray, ArrayMinSize, ArrayMaxSize, IsBoolean, IsNotEmpty } from 'class-validator';

export class UpdateQuestionDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  question?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(6)
  @IsString({ each: true })
  options?: string[];

  @IsOptional()
  @IsBoolean()
  multiChoice?: boolean;
}
