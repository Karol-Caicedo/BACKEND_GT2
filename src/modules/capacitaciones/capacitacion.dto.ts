import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsArray, IsDateString, IsIn, IsInt, IsOptional, IsString, IsUrl, ArrayMinSize, ArrayUnique, Min, Max, IsUUID } from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class CapacitacionDto {
  @ApiProperty({ example: 'Jornada de proyección social' })
  @IsString()
  titulo: string;

  @ApiPropertyOptional({ example: 'Actividad de acompañamiento a la comunidad del barrio San José.' })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  descripcion?: string;

  @ApiPropertyOptional({ example: 'https://unipacifico.edu.co/capacitaciones/jornada' })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') return undefined;
    if (typeof value === 'string' && value.trim() === '') return undefined;
    return typeof value === 'string' ? value.trim() : value;
  })
  @IsUrl({}, { message: 'El enlace debe ser una URL válida' })
  enlace?: string;

  @ApiPropertyOptional({ example: '123e4567-e89b-42d3-a456-426614174000', nullable: true })
  @IsOptional()
  @IsUUID('4', { message: 'El tema debe ser un UUID válido' })
  temaId?: string | null;

  @ApiPropertyOptional({ example: '2026-05-15T15:00:00.000Z', nullable: true })
  @IsOptional()
  @IsDateString()
  fechaEvento?: string | null;

  @ApiPropertyOptional({ example: 'presencial', enum: ['virtual', 'presencial'] })
  @IsOptional()
  @IsIn(['virtual', 'presencial'])
  modalidad?: 'virtual' | 'presencial';

  @ApiPropertyOptional({ example: '2026-05-01T00:00:00.000Z', nullable: true })
  @IsOptional()
  @IsDateString()
  visibleDesde?: string | null;

  @ApiPropertyOptional({ example: '2026-05-31T23:59:59.000Z', nullable: true })
  @IsOptional()
  @IsDateString()
  visibleHasta?: string | null;

  @ApiPropertyOptional({ example: 'publicado', enum: ['borrador', 'publicado'] })
  @IsOptional()
  @IsIn(['borrador', 'publicado'])
  estado?: 'borrador' | 'publicado';

  @ApiPropertyOptional({ example: [1, 2, 3, 4, 5] })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique({ message: 'Los semestres no deben repetirse' })
  @IsInt({ each: true, message: 'Cada semestre debe ser un número entero' })
  @Min(1, { each: true, message: 'Los semestres deben estar entre 1 y 9' })
  @Max(9, { each: true, message: 'Los semestres deben estar entre 1 y 9' })
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') return undefined;
    if (Array.isArray(value)) return value.map(Number);
    if (typeof value === 'string') {
      try {
        const p = JSON.parse(value);
        if (Array.isArray(p)) return p.map(Number);
      } catch { /* noop */ }
      if (value.toLowerCase() === 'todos') return [1, 2, 3, 4, 5, 6, 7, 8, 9];
      return value.split(',').map((s) => Number(s.trim()));
    }
    return value;
  })
  semestres?: number[];
}

export class ActualizarCapacitacionDto extends PartialType(CapacitacionDto) {}

export class FiltroCapDto {
  @ApiPropertyOptional({ example: 'publicado', enum: ['borrador', 'publicado'] })
  @IsOptional()
  @IsIn(['borrador', 'publicado'])
  estado?: string;

  @ApiPropertyOptional({ example: 5, minimum: 1, maximum: 9 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(9)
  semestre?: number;
}
