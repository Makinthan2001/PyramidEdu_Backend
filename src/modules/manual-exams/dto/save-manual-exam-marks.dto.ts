import { Type } from 'class-transformer';
import { IsString, IsNotEmpty, IsArray, ValidateNested, IsNumber, Min, IsOptional, IsBoolean } from 'class-validator';

export class ManualExamMarkDto {
  @IsString()
  @IsNotEmpty()
  studentId!: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  marksObtained?: number;

  @IsBoolean()
  @IsOptional()
  isAbsent?: boolean;
}

export class SaveManualExamMarksDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ManualExamMarkDto)
  marks!: ManualExamMarkDto[];
}
