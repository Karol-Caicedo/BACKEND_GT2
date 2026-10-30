import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, QueryFailedError, Repository } from 'typeorm';
import { Periodo } from './periodo.entity';
import { CreatePeriodoDto } from './periodo.dto';

@Injectable()
export class PeriodosService {
  constructor(
    @InjectRepository(Periodo) private repo: Repository<Periodo>,
    private dataSource: DataSource,
  ) {}

  private async bloquear(manager: EntityManager): Promise<void> {
    await manager
      .createQueryBuilder(Periodo, 'p')
      .setLock('pessimistic_write')
      .setOnLocked('nowait')
      .getMany();
  }

  private esConflictoDeActivo(e: unknown): boolean {
    if (!(e instanceof QueryFailedError)) return false;
    const driver = (e as QueryFailedError & {
      driverError?: { code?: string; constraint?: string; detail?: string };
    }).driverError;
    if (driver?.code === '55P03') return true;
    return driver?.code === '23505' &&
      (driver.constraint === 'uq_periodo_activo' || /uq_periodo_activo/.test(driver.detail ?? ''));
  }

  private async transaccion<T>(cb: (manager: EntityManager) => Promise<T>): Promise<T> {
    try {
      return await this.dataSource.transaction(cb);
    } catch (e) {
      if (this.esConflictoDeActivo(e)) {
        throw new ConflictException('El periodo activo fue modificado por otra operación');
      }
      throw e;
    }
  }

  findAll() {
    return this.repo.find({ order: { fechaInicio: 'DESC' } });
  }

  async activo(): Promise<Periodo | null> {
    return this.repo.findOne({ where: { activo: true } });
  }

  async create(dto: CreatePeriodoDto) {
    if (!dto.activo) {
      const p = this.repo.create({ ...dto, modoEncuesta: dto.modoEncuesta ?? 'seleccion' });
      return this.repo.save(p);
    }
    return this.transaccion(async (manager) => {
      const repo = manager.getRepository(Periodo);
      await this.bloquear(manager);
      await repo.update({ activo: true }, { activo: false });
      const p = repo.create({ ...dto, modoEncuesta: dto.modoEncuesta ?? 'seleccion' });
      return repo.save(p);
    });
  }

  async update(id: string, dto: CreatePeriodoDto) {
    return this.transaccion(async (manager) => {
      const repo = manager.getRepository(Periodo);
      await this.bloquear(manager);
      const p = await repo.findOne({ where: { id } });
      if (!p) throw new NotFoundException('Periodo no encontrado');
      if (dto.activo && !p.activo) await repo.update({ activo: true }, { activo: false });
      Object.assign(p, dto);
      return repo.save(p);
    });
  }

  async remove(id: string) {
    const p = await this.repo.findOne({ where: { id } });
    if (!p) throw new NotFoundException('Periodo no encontrado');
    if (p.activo) throw new BadRequestException('No se puede eliminar el periodo activo');
    await this.repo.remove(p);
    return { ok: true };
  }

  async activar(id: string) {
    return this.transaccion(async (manager) => {
      const repo = manager.getRepository(Periodo);
      await this.bloquear(manager);
      const p = await repo.findOne({ where: { id } });
      if (!p) throw new NotFoundException('Periodo no encontrado');
      await repo.update({ activo: true }, { activo: false });
      p.activo = true;
      return repo.save(p);
    });
  }

  async configurarEncuestaAsignaturas(id: string, dto: { encuestaAsignaturasActiva: boolean; fechaInicioAsignaturas?: string | null; fechaFinAsignaturas?: string | null }) {
    const p = await this.repo.findOne({ where: { id } });
    if (!p) throw new NotFoundException('Periodo no encontrado');
    p.encuestaAsignaturasActiva = dto.encuestaAsignaturasActiva;
    if (dto.fechaInicioAsignaturas !== undefined) p.fechaInicioAsignaturas = dto.fechaInicioAsignaturas;
    if (dto.fechaFinAsignaturas !== undefined) p.fechaFinAsignaturas = dto.fechaFinAsignaturas;
    return this.repo.save(p);
  }

  esEncuestaAsignaturasVigente(p: Periodo): boolean {
    if (!p || !p.activo || !p.encuestaAsignaturasActiva) return false;
    const hoy = new Date().toISOString().slice(0, 10);
    if (p.fechaInicioAsignaturas && hoy < p.fechaInicioAsignaturas) return false;
    if (p.fechaFinAsignaturas && hoy > p.fechaFinAsignaturas) return false;
    return true;
  }
}
