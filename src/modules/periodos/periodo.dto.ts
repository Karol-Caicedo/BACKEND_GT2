import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsDateString, IsIn, IsOptional, IsString } from 'class-validator';

export class CreatePeriodoDto {
  @ApiProperty({ example: '2026-1' })
  @IsString()
  nombre: string;

  @ApiProperty({ example: '2026-01-20T00:00:00.000Z' })
  @IsDateString()
  fechaInicio: string;

  @ApiProperty({ example: '2026-06-10T00:00:00.000Z' })
  @IsDateString()
  fechaFin: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  activo?: boolean;

  @ApiPropertyOptional({ example: 'seleccion', enum: ['seleccion', 'calificacion'] })
  @IsOptional()
  @IsIn(['seleccion', 'calificacion'])
  modoEncuesta?: 'seleccion' | 'calificacion';

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  encuestaAsignaturasActiva?: boolean;

  @ApiPropertyOptional({ example: '2026-05-01T00:00:00.000Z', nullable: true })
  @IsOptional()
  @IsDateString()
  fechaInicioAsignaturas?: string | null;

  @ApiPropertyOptional({ example: '2026-05-20T00:00:00.000Z', nullable: true })
  @IsOptional()
  @IsDateString()
  fechaFinAsignaturas?: string | null;
}

export class ConfigurarEncuestaAsignaturasDto {
  @ApiProperty({ example: true })
  @IsBoolean()
  encuestaAsignaturasActiva: boolean;

  @ApiPropertyOptional({ example: '2026-05-01T00:00:00.000Z', nullable: true })
  @IsOptional()
  @IsDateString()
  fechaInicioAsignaturas?: string | null;

  @ApiPropertyOptional({ example: '2026-05-20T00:00:00.000Z', nullable: true })
  @IsOptional()
  @IsDateString()
  fechaFinAsignaturas?: string | null;
}

export class UpdatePeriodoDto extends CreatePeriodoDto {}
