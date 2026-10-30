import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tema } from './tema.entity';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class TemaDto {
  @ApiProperty({ example: 'Salud y bienestar comunitario' })
  @IsString({ message: 'El nombre del tema es obligatorio' })
  nombre: string;
  @ApiPropertyOptional({ example: 'Acciones de promoción de la salud en la comunidad.' })
  @IsOptional()
  @IsString()
  descripcion?: string;
  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}

export class ActualizarTemaDto {
  @ApiPropertyOptional({ example: 'Salud y bienestar comunitario' })
  @IsOptional()
  @IsString({ message: 'El nombre del tema debe ser una cadena de texto' })
  nombre?: string;
  @ApiPropertyOptional({ example: 'Acciones de promoción de la salud en la comunidad.' })
  @IsOptional()
  @IsString()
  descripcion?: string;
  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}

export class CambiarEstadoTodosDto {
  @ApiProperty({ example: true })
  @IsBoolean({ message: 'El estado activo debe ser un valor booleano' })
  activo: boolean;
}

@Injectable()
export class TemasService {
  constructor(@InjectRepository(Tema) private repo: Repository<Tema>) {}

  private respuesta(t: Tema) {
    return { id: t.id, nombre: t.nombre, descripcion: t.descripcion, activo: t.activo };
  }

  async activos() {
    const temas = await this.repo.find({ where: { activo: true }, order: { nombre: 'ASC' } });
    return temas.map((t) => this.respuesta(t));
  }

  async todos() {
    const temas = await this.repo.find({ order: { nombre: 'ASC' } });
    return temas.map((t) => this.respuesta(t));
  }

  async crear(dto: TemaDto) {
    const tema = await this.repo.save(this.repo.create({ ...dto, activo: dto.activo ?? true }));
    return this.respuesta(tema);
  }

  async actualizar(id: string, dto: ActualizarTemaDto) {
    const t = await this.repo.findOne({ where: { id } });
    if (!t) throw new NotFoundException('Tema no encontrado');
    Object.assign(t, dto);
    return this.respuesta(await this.repo.save(t));
  }
  async eliminar(id: string) {
    const t = await this.repo.findOne({ where: { id } });
    if (!t) throw new NotFoundException('Tema no encontrado');
    await this.repo.remove(t);
    return { ok: true };
  }
  async cambiarEstadoTodos(activo: boolean) {
    await this.repo.createQueryBuilder().update(Tema).set({ activo }).execute();
    return { ok: true, activo };
  }
}
