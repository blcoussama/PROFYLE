import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class VerifyEmailDto {
  @ApiProperty({ description: 'Token received by email' })
  @IsString()
  @IsNotEmpty()
  token: string;
}
