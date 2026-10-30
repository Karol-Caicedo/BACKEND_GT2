import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsInt, IsOptional, IsString, Max, Min, ValidateNested } from 'class-validator';

export class ItemEncuestaAsignaturaDto {
  @ApiProperty({ example: '123e4567-e89b-42d3-a456-426614174000' })
  @IsString({ message: 'El identificador de la asignatura es obligatorio' })
  asignaturaId: string;

  @ApiPropertyOptional({ example: '123e4567-e89b-42d3-a456-426614174002' })
  @IsOptional()
  @IsString()
  grupoId?: string;

  @ApiProperty({ example: false })
  @IsBoolean()
  tieneDificultad: boolean;

  @ApiPropertyOptional({ example: 4, minimum: 1, maximum: 5 })
  @IsOptional()
  @IsInt({ message: 'El nivel de satisfacción debe ser un entero de 1 a 5' })
  @Min(1, { message: 'El nivel mínimo de satisfacción es 1' })
  @Max(5, { message: 'El nivel máximo de satisfacción es 5' })
  nivelSatisfaccion?: number;
}

export class ResponderEncuestaAsignaturaDto {
  @ApiProperty({
    type: [ItemEncuestaAsignaturaDto],
    example: [
      { asignaturaId: '123e4567-e89b-42d3-a456-426614174000', tieneDificultad: false, nivelSatisfaccion: 4 },
      { asignaturaId: '123e4567-e89b-42d3-a456-426614174001', grupoId: '123e4567-e89b-42d3-a456-426614174002', tieneDificultad: true, nivelSatisfaccion: 2 },
    ],
  })
  @IsArray({ message: 'Debes enviar la lista de asignaturas evaluadas' })
  @ValidateNested({ each: true })
  @Type(() => ItemEncuestaAsignaturaDto)
  items: ItemEncuestaAsignaturaDto[];
}

export class InscripcionItemDto {
  @ApiProperty({ example: '123e4567-e89b-42d3-a456-426614174000' })
  @IsString()
  asignaturaId: string;

  @ApiPropertyOptional({ example: '123e4567-e89b-42d3-a456-426614174002' })
  @IsOptional()
  @IsString()
  grupoId?: string;
}

export class GuardarInscripcionesDto {
  @ApiPropertyOptional({
    example: [
      '123e4567-e89b-42d3-a456-426614174000',
      '123e4567-e89b-42d3-a456-426614174001',
    ],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true, message: 'Cada identificador de asignatura debe ser una cadena' })
  asignaturaIds?: string[];

  @ApiPropertyOptional({
    type: [InscripcionItemDto],
    example: [
      { asignaturaId: '123e4567-e89b-42d3-a456-426614174000', grupoId: '123e4567-e89b-42d3-a456-426614174002' },
    ],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InscripcionItemDto)
  inscripciones?: InscripcionItemDto[];
}

