import { ApiProperty } from '@nestjs/swagger';
import { Equals, IsBoolean, IsEmail, IsInt, IsString, Length, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'estudiante@unipacifico.edu.co' })
  @IsEmail({}, { message: 'Correo institucional inválido' })
  correo: string;

  @ApiProperty({ example: 'María Fernanda López' })
  @IsString()
  nombre: string;

  @ApiProperty({ example: 'ClaveSegura123*', minLength: 8 })
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres' })
  password: string;

  @ApiProperty({ example: 5, minimum: 1, maximum: 9 })
  @IsInt({ message: 'Semestre debe ser un número entre 1 y 9' })
  @Min(1)
  @Max(9)
  semestre: number;

  @ApiProperty({ example: true })
  @IsBoolean()
  @Equals(true, { message: 'Debe autorizar el tratamiento de datos (Ley 1581 de 2012)' })
  aceptoDatos: boolean;
}

export class LoginDto {
  @ApiProperty({ example: 'estudiante@unipacifico.edu.co' })
  @IsEmail()
  correo: string;

  @ApiProperty({ example: 'ClaveSegura123*' })
  @IsString()
  @MinLength(1)
  password: string;
}

export class LoginEnvelopeDto {
  @ApiProperty({ example: 1 })
  @IsInt()
  @Equals(1)
  version: number;

  @ApiProperty({ example: 'rsa-2026-01' })
  @IsString()
  @Matches(/^[A-Za-z0-9._-]{1,64}$/)
  keyId: string;

  @ApiProperty({ example: 'A'.repeat(43) })
  @IsString()
  @Matches(/^[A-Za-z0-9_-]{43}$/)
  challenge: string;

  @ApiProperty({ example: 'A'.repeat(512) })
  @IsString()
  @MaxLength(1024)
  @Matches(/^[A-Za-z0-9_-]+$/)
  wrappedKey: string;

  @ApiProperty({ example: 'A'.repeat(16) })
  @IsString()
  @Length(16, 16)
  @Matches(/^[A-Za-z0-9_-]{16}$/)
  iv: string;

  @ApiProperty({ example: 'A'.repeat(256) })
  @IsString()
  @MaxLength(16_384)
  @Matches(/^[A-Za-z0-9_-]+$/)
  ciphertext: string;
}

export class SolicitarRecuperacionDto {
  @ApiProperty({ example: 'estudiante@unipacifico.edu.co' })
  @IsEmail({}, { message: 'Correo institucional inválido' })
  correo: string;
}

export class RestablecerClaveDto {
  @ApiProperty({ example: 'a1b2c3d4e5f60718293a4b5c6d7e8f90', minLength: 10 })
  @IsString()
  @MinLength(10, { message: 'Token inválido' })
  token: string;

  @ApiProperty({ example: 'NuevaClave123*', minLength: 8 })
  @IsString()
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres' })
  password: string;
}

export class CompleteSsoDto {
  @ApiProperty({ example: 5, minimum: 1, maximum: 9 })
  @IsInt()
  @Min(1)
  @Max(9)
  semestre: number;

  @ApiProperty({ example: true })
  @IsBoolean()
  @Equals(true, { message: 'Debe autorizar el tratamiento de datos (Ley 1581 de 2012)' })
  aceptoDatos: boolean;
}

export class CompletarSsoDto extends CompleteSsoDto {
  @ApiProperty({ example: 'temp_7f3c9a2b1d4e5f60718293a4b5c6d7e8', minLength: 10 })
  @IsString()
  @MinLength(10, { message: 'Token temporal inválido' })
  temp: string;
}

export class ActualizarSemestreDto {
  @ApiProperty({ example: 6, minimum: 1, maximum: 9 })
  @IsInt()
  @Min(1)
  @Max(9)
  semestre: number;
}
