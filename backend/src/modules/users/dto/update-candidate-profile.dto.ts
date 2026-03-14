import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  ValidateNested,
} from 'class-validator';

export class ExperienceDto {
  @ApiPropertyOptional({ example: 'Full-Stack Developer' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiPropertyOptional({ example: 'ALTEN Maroc' })
  @IsString()
  @IsNotEmpty()
  company: string;

  @ApiPropertyOptional({ example: 'Casablanca, Maroc' })
  @IsOptional()
  @IsString()
  location?: string;

  @ApiPropertyOptional({ example: '2024-01-01' })
  @IsDateString()
  startDate: string;

  @ApiPropertyOptional({ example: '2025-06-30' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  current?: boolean;

  @ApiPropertyOptional({
    example: 'Developed REST APIs with NestJS and React.',
  })
  @IsOptional()
  @IsString()
  description?: string;
}

export class EducationDto {
  @ApiPropertyOptional({ example: 'EMSI Tanger' })
  @IsString()
  @IsNotEmpty()
  school: string;

  @ApiPropertyOptional({ example: 'Ingénieur Informatique' })
  @IsString()
  @IsNotEmpty()
  degree: string;

  @ApiPropertyOptional({ example: 'Développement Informatique' })
  @IsOptional()
  @IsString()
  field?: string;

  @ApiPropertyOptional({ example: '2022-09-01' })
  @IsDateString()
  startDate: string;

  @ApiPropertyOptional({ example: '2027-06-30' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  current?: boolean;
}

export class UpdateCandidateProfileDto {
  @ApiPropertyOptional({ example: 'Full-Stack Developer | NestJS & React' })
  @IsOptional()
  @IsString()
  headline?: string;

  @ApiPropertyOptional({
    example: 'Passionate about building scalable web apps.',
  })
  @IsOptional()
  @IsString()
  bio?: string;

  @ApiPropertyOptional({ example: 'Tanger, Maroc' })
  @IsOptional()
  @IsString()
  location?: string;

  @ApiPropertyOptional({ example: '+212 682 139 835' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ example: 'https://linkedin.com/in/oussama-belcadi' })
  @IsOptional()
  @IsUrl()
  linkedinUrl?: string;

  @ApiPropertyOptional({ example: 'https://github.com/blcoussama' })
  @IsOptional()
  @IsUrl()
  githubUrl?: string;

  @ApiPropertyOptional({ example: 'https://oussama.dev' })
  @IsOptional()
  @IsUrl()
  portfolioUrl?: string;

  @ApiPropertyOptional({
    example: ['NestJS', 'React', 'TypeScript', 'MongoDB'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  skills?: string[];

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isAvailable?: boolean;

  @ApiPropertyOptional({ type: [ExperienceDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ExperienceDto)
  experiences?: ExperienceDto[];

  @ApiPropertyOptional({ type: [EducationDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EducationDto)
  education?: EducationDto[];
}
