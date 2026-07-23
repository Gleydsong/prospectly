import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsObject } from 'class-validator';

export class CreateCsvImportDto {
  @ApiProperty({
    type: 'object',
    example: { companyName: 'Empresa', email: 'E-mail', phone: 'Telefone' },
    additionalProperties: { type: 'string' },
  })
  @Transform(({ value }) => {
    if (typeof value !== 'string') return value;
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  })
  @IsObject()
  mapping!: Record<string, string>;
}
