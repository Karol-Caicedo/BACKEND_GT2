import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Max, Min, MinLength } from 'class-validator';

export class CrearUsuarioDto {
  @ApiProperty({ example: 'estudiante@unipacifico.edu.co' })
  @IsEmail({}, { message: 'Correo institucional inválido' })
  correo: string;

  @ApiProperty({ example: 'María Fernanda López' })
  @IsString()
  nombre: string;

  @ApiProperty({ example: 'ClaveSegura123*', minLength: 8 })
  @IsString()
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres' })
  password: string;

  @ApiProperty({ example: '1098765432' })
  @IsNotEmpty({ message: 'El número de identificación es obligatorio' })
  @IsString()
  numeroIdentificacion: string;

  @ApiPropertyOptional({ example: 5, minimum: 1, maximum: 9 })
  @IsOptional()
  @IsInt({ message: 'Semestre debe ser un número entre 1 y 9' })
  @Min(1)
  @Max(9)
  semestre?: number;

  @ApiProperty({ example: 'ESTUDIANTE', enum: ['ESTUDIANTE', 'ADMIN'] })
  @IsIn(['ESTUDIANTE', 'ADMIN'], { message: 'Rol inválido' })
  rol: 'ESTUDIANTE' | 'ADMIN' = 'ESTUDIANTE';
}

export class ActualizarUsuarioDto {
  @ApiPropertyOptional({ example: '1098765432' })
  @IsOptional()
  @IsString()
  numeroIdentificacion?: string;

  @ApiPropertyOptional({ example: 'estudiante@unipacifico.edu.co' })
  @IsOptional()
  @IsEmail({}, { message: 'Correo institucional inválido' })
  correo?: string;

  @ApiPropertyOptional({ example: 'María Fernanda López' })
  @IsOptional()
  @IsString()
  nombre?: string;

  @ApiPropertyOptional({ example: 'NuevaClave123*', minLength: 8 })
  @IsOptional()
  @IsString()
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres' })
  password?: string;

  @ApiPropertyOptional({ example: 6, minimum: 1, maximum: 9 })
  @IsOptional()
  @IsInt({ message: 'Semestre debe ser un número entre 1 y 9' })
  @Min(1)
  @Max(9)
  semestre?: number;

  @ApiPropertyOptional({ example: 'ESTUDIANTE', enum: ['ESTUDIANTE', 'ADMIN'] })
  @IsOptional()
  @IsIn(['ESTUDIANTE', 'ADMIN'], { message: 'Rol inválido' })
  rol?: 'ESTUDIANTE' | 'ADMIN';
}

export class VerificarAdminDto {
  @ApiProperty({ example: 'ClaveSegura123*' })
  @IsString()
  password: string;
}

export class CambiarClaveDto {
  @ApiProperty({ example: 'NuevaClave123*', minLength: 8 })
  @IsString()
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres' })
  password: string;
}
