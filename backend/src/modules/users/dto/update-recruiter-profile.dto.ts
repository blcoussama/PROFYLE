import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUrl } from 'class-validator';

export class UpdateRecruiterProfileDto {
  @ApiPropertyOptional({ example: 'HR Manager' })
  @IsOptional()
  @IsString()
  headline?: string;

  @ApiPropertyOptional({
    example: 'Experienced recruiter specializing in tech profiles.',
  })
  @IsOptional()
  @IsString()
  bio?: string;

  @ApiPropertyOptional({ example: 'Casablanca, Maroc' })
  @IsOptional()
  @IsString()
  location?: string;

  @ApiPropertyOptional({ example: '+212 600 000 000' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ example: 'https://linkedin.com/in/recruiter' })
  @IsOptional()
  @IsUrl()
  linkedinUrl?: string;

  @ApiPropertyOptional({ example: 'ALTEN Maroc' })
  @IsOptional()
  @IsString()
  companyName?: string;

  @ApiPropertyOptional({ example: 'https://alten.ma' })
  @IsOptional()
  @IsUrl()
  companyWebsite?: string;
}
