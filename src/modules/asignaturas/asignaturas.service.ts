import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Asignatura } from './asignatura.entity';
import { GrupoAsignatura } from './grupo-asignatura.entity';
import { AsignaturaDto, ActualizarAsignaturaDto, CrearGrupoAsignaturaDto, ActualizarGrupoAsignaturaDto } from './asignatura.dto';

@Injectable()
export class AsignaturasService {
  constructor(
    @InjectRepository(Asignatura) private repo: Repository<Asignatura>,
    @InjectRepository(GrupoAsignatura) private gruposRepo: Repository<GrupoAsignatura>,
  ) {}

  private respuesta(a: Asignatura) {
    return {
      id: a.id,
      nombre: a.nombre,
      codigo: a.codigo ?? null,
      semestre: a.semestre,
      activo: a.activo,
      grupos: (a.grupos || []).map((g) => ({
        id: g.id,
        profesor: g.profesor,
        codigoGrupo: g.codigoGrupo,
        horario: g.horario,
        activo: g.activo,
      })),
    };
  }

  async activos(semestre?: number) {
    const where: { activo: boolean; semestre?: number } = { activo: true };
    if (semestre) where.semestre = semestre;
    const asignaturas = await this.repo.find({
      where,
      relations: ['grupos'],
      order: { semestre: 'ASC', nombre: 'ASC' },
    });
    return asignaturas.map((a) => this.respuesta(a));
  }

  async todos(semestre?: number) {
    const where: { semestre?: number } = {};
    if (semestre) where.semestre = semestre;
    const asignaturas = await this.repo.find({
      where,
      relations: ['grupos'],
      order: { semestre: 'ASC', nombre: 'ASC' },
    });
    return asignaturas.map((a) => this.respuesta(a));
  }

  async crear(dto: AsignaturaDto) {
    const asignatura = await this.repo.save(this.repo.create({ ...dto, activo: dto.activo ?? true }));
    return this.respuesta(asignatura);
  }

  async actualizar(id: string, dto: ActualizarAsignaturaDto) {
    const a = await this.repo.findOne({ where: { id }, relations: ['grupos'] });
    if (!a) throw new NotFoundException('Asignatura no encontrada');
    Object.assign(a, dto);
    return this.respuesta(await this.repo.save(a));
  }

  async eliminar(id: string) {
    const a = await this.repo.findOne({ where: { id } });
    if (!a) throw new NotFoundException('Asignatura no encontrada');
    await this.repo.remove(a);
    return { ok: true };
  }

  async cambiarEstadoTodas(activo: boolean, semestre?: number) {
    const qb = this.repo.createQueryBuilder().update(Asignatura).set({ activo });
    if (semestre) {
      qb.where('semestre = :semestre', { semestre });
    }
    await qb.execute();
    return { ok: true, activo, semestre };
  }

  // --- GESTIÓN DE GRUPOS ---

  async listarGrupos(asignaturaId: string, soloActivos = false) {
    const where: { asignaturaId: string; activo?: boolean } = { asignaturaId };
    if (soloActivos) where.activo = true;
    return this.gruposRepo.find({
      where,
      order: { codigoGrupo: 'ASC' },
    });
  }

  async crearGrupo(asignaturaId: string, dto: CrearGrupoAsignaturaDto) {
    const asig = await this.repo.findOne({ where: { id: asignaturaId } });
    if (!asig) throw new NotFoundException('Asignatura no encontrada');

    const grupo = this.gruposRepo.create({
      asignaturaId,
      profesor: dto.profesor.trim(),
      codigoGrupo: dto.codigoGrupo.trim(),
      horario: dto.horario.trim(),
      activo: dto.activo ?? true,
    });
    return this.gruposRepo.save(grupo);
  }

  async actualizarGrupo(grupoId: string, dto: ActualizarGrupoAsignaturaDto) {
    const g = await this.gruposRepo.findOne({ where: { id: grupoId } });
    if (!g) throw new NotFoundException('Grupo no encontrado');
    if (dto.profesor !== undefined) g.profesor = dto.profesor.trim();
    if (dto.codigoGrupo !== undefined) g.codigoGrupo = dto.codigoGrupo.trim();
    if (dto.horario !== undefined) g.horario = dto.horario.trim();
    if (dto.activo !== undefined) g.activo = dto.activo;
    return this.gruposRepo.save(g);
  }

  async eliminarGrupo(grupoId: string) {
    const g = await this.gruposRepo.findOne({ where: { id: grupoId } });
    if (!g) throw new NotFoundException('Grupo no encontrado');
    await this.gruposRepo.remove(g);
    return { ok: true };
  }
}

