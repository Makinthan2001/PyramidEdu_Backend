import { IsString, IsNotEmpty, IsInt, IsOptional, IsDateString, Min } from 'class-validator';

export class CreateManualExamDto {
  @IsString()
  @IsNotEmpty()
  examTitle: string;

  @IsString()
  @IsNotEmpty()
  batchId: string;

  @IsInt()
  @Min(1)
  totalMarks: number;

  @IsDateString()
  @IsNotEmpty()
  examDate: string;

  @IsInt()
  @Min(1)
  @IsOptional()
  duration?: number;
}
