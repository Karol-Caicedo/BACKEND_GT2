import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class AsignaturaDto {
  @ApiProperty({ example: 'Cálculo Diferencial' })
  @IsString({ message: 'El nombre de la asignatura es obligatorio' })
  nombre: string;

  @ApiPropertyOptional({ example: 'MAT-101' })
  @IsOptional()
  @IsString()
  codigo?: string;

  @ApiProperty({ example: 1, minimum: 1, maximum: 9 })
  @IsInt({ message: 'El semestre debe ser un número entero entre 1 y 9' })
  @Min(1, { message: 'El semestre mínimo es 1' })
  @Max(9, { message: 'El semestre máximo es 9' })
  semestre: number;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}

export class ActualizarAsignaturaDto {
  @ApiPropertyOptional({ example: 'Cálculo Diferencial' })
  @IsOptional()
  @IsString()
  nombre?: string;

  @ApiPropertyOptional({ example: 'MAT-101' })
  @IsOptional()
  @IsString()
  codigo?: string;

  @ApiPropertyOptional({ example: 1, minimum: 1, maximum: 9 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(9)
  semestre?: number;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}

export class CambiarEstadoTodasDto {
  @ApiProperty({ example: true })
  @IsBoolean({ message: 'El estado activo debe ser un valor booleano' })
  activo: boolean;

  @ApiPropertyOptional({ example: 3, minimum: 1, maximum: 9 })
  @IsOptional()
  @IsInt({ message: 'El semestre debe ser un número entero entre 1 y 9' })
  @Min(1, { message: 'El semestre mínimo es 1' })
  @Max(9, { message: 'El semestre máximo es 9' })
  semestre?: number;
}

export class CrearGrupoAsignaturaDto {
  @ApiProperty({ example: 'Lucio Perez' })
  @IsString({ message: 'El nombre del profesor es obligatorio' })
  profesor: string;

  @ApiProperty({ example: 'Grupo D1' })
  @IsString({ message: 'El código de grupo es obligatorio' })
  codigoGrupo: string;

  @ApiProperty({ example: 'Lunes 8:00 - 10:00 AM, Jueves 9:00 - 11:00 AM' })
  @IsString({ message: 'El horario es obligatorio' })
  horario: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}

export class ActualizarGrupoAsignaturaDto {
  @ApiPropertyOptional({ example: 'Lucio Perez' })
  @IsOptional()
  @IsString()
  profesor?: string;

  @ApiPropertyOptional({ example: 'Grupo D1' })
  @IsOptional()
  @IsString()
  codigoGrupo?: string;

  @ApiPropertyOptional({ example: 'Lunes 8:00 - 10:00 AM, Jueves 9:00 - 11:00 AM' })
  @IsOptional()
  @IsString()
  horario?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}

