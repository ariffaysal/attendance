import { IsString, IsOptional, IsIn, IsInt, Min } from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class SearchAttendanceDto {
  @IsOptional()
  @IsString()
  @Transform(({ value }) => value?.trim() || '')
  search?: string = '';

  @IsOptional()
  @IsIn(['general', 'acc_no', 'name', ''])
  @Transform(({ value }) => value || 'general')
  searchType?: 'general' | 'acc_no' | 'name' = 'general';

  @IsOptional()
  @IsString()
  @Transform(({ value }) => value || '')
  fromDate?: string = '';

  @IsOptional()
  @IsString()
  @Transform(({ value }) => value || '')
  toDate?: string = '';

  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  @Transform(({ value }) => {
    if (!value) return 1;
    const num = Number(value);
    return isNaN(num) ? 1 : num;
  })
  page?: number = 1;

  @IsOptional()
  @IsIn(['landing', 'job_card', 'monthly', 'users', ''])
  @Transform(({ value }) => value || 'landing')
  view?: string = 'landing';
}
