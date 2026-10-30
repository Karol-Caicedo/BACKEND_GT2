import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RespuestaAsignatura, RespuestaAsignaturaItem } from '../encuestas-asignaturas/respuesta-asignatura.entity';
import { Asignatura } from '../asignaturas/asignatura.entity';
import { Periodo } from '../periodos/periodo.entity';
import { User } from '../users/user.entity';

@Injectable()
export class DashboardMateriasService {
  constructor(
    @InjectRepository(RespuestaAsignatura) private raRepo: Repository<RespuestaAsignatura>,
    @InjectRepository(RespuestaAsignaturaItem) private raiRepo: Repository<RespuestaAsignaturaItem>,
    @InjectRepository(Asignatura) private asigRepo: Repository<Asignatura>,
    @InjectRepository(Periodo) private periodosRepo: Repository<Periodo>,
    @InjectRepository(User) private usersRepo: Repository<User>,
  ) {}

  private async periodoOrFail(periodoId?: string) {
    if (periodoId) {
      const p = await this.periodosRepo.findOne({ where: { id: periodoId } });
      if (!p) throw new BadRequestException('Periodo no encontrado');
      return p;
    }
    const p = await this.periodosRepo.findOne({ where: { activo: true } });
    if (!p) throw new BadRequestException('No hay periodo activo');
    return p;
  }

  /** Top 5 de asignaturas con mayor reporte de dificultad */
  async topAsignaturas(periodoId?: string, semestre?: number) {
    const p = await this.periodoOrFail(periodoId);
    const qb = this.raiRepo.createQueryBuilder('rai')
      .innerJoin(RespuestaAsignatura, 'ra', 'ra.id = rai.respuestaAsignaturaId')
      .innerJoin(Asignatura, 'a', 'a.id = rai.asignaturaId')
      .select('a.id', 'asignaturaId')
      .addSelect('a.nombre', 'nombre')
      .addSelect('a.semestre', 'semestre')
      .addSelect('COUNT(CASE WHEN rai.tieneDificultad = true THEN 1 END)', 'valor')
      .addSelect('AVG(rai.nivelSatisfaccion)', 'promedioSatisfaccion')
      .where('ra.periodoId = :pid', { pid: p.id });

    if (semestre) {
      qb.andWhere('ra.semestreAlResponder = :s', { s: semestre });
    }

    qb.groupBy('a.id').addGroupBy('a.nombre').addGroupBy('a.semestre')
      .orderBy('valor', 'DESC')
      .limit(5);

    const rows = await qb.getRawMany();
    return {
      periodo: p,
      items: rows.map((r) => ({
        asignaturaId: r.asignaturaId,
        nombre: r.nombre,
        semestre: Number(r.semestre),
        valor: Number(r.valor),
        promedioSatisfaccion: Number(Number(r.promedioSatisfaccion || 0).toFixed(2)),
      })),
    };
  }

  /** Tasa de respuesta por semestre para la encuesta de materias */
  async tasaRespuesta(periodoId?: string) {
    const p = await this.periodoOrFail(periodoId);
    const porSem: { semestre: number; respondieron: number; total: number; tasa: number }[] = [];
    let totR = 0;
    let totE = 0;

    for (let s = 1; s <= 9; s++) {
      const respondieron = await this.raRepo.count({ where: { periodoId: p.id, semestreAlResponder: s } });
      const total = await this.usersRepo.count({ where: { rol: 'ESTUDIANTE', semestre: s } });
      porSem.push({ semestre: s, respondieron, total, tasa: total ? respondieron / total : 0 });
      totR += respondieron;
      totE += total;
    }

    return {
      periodo: p,
      porSemestre: porSem,
      global: totE ? totR / totE : 0,
      totalRespuestas: totR,
    };
  }

  /** Mapa de calor: asignaturas x semestre con cantidad de reportes de dificultad */
  async heatmap(periodoId?: string) {
    const p = await this.periodoOrFail(periodoId);
    const qb = this.raiRepo.createQueryBuilder('rai')
      .innerJoin(RespuestaAsignatura, 'ra', 'ra.id = rai.respuestaAsignaturaId')
      .innerJoin(Asignatura, 'a', 'a.id = rai.asignaturaId')
      .select('a.nombre', 'asignatura')
      .addSelect('ra.semestreAlResponder', 'semestre')
      .addSelect('COUNT(CASE WHEN rai.tieneDificultad = true THEN 1 END)', 'valor')
      .where('ra.periodoId = :pid', { pid: p.id })
      .groupBy('a.nombre')
      .addGroupBy('ra.semestreAlResponder');

    const rows = await qb.getRawMany();
    const matriz: Record<string, Record<number, number>> = {};
    for (const r of rows) {
      matriz[r.asignatura] ??= {};
      matriz[r.asignatura][Number(r.semestre)] = Number(r.valor);
    }

    return { periodo: p, matriz };
  }

  /** Materias con desglose de los 5 niveles de satisfacción por cada asignatura */
  async satisfaccion(periodoId?: string, semestre?: number) {
    const p = await this.periodoOrFail(periodoId);
    const qb = this.raiRepo.createQueryBuilder('rai')
      .innerJoin(RespuestaAsignatura, 'ra', 'ra.id = rai.respuestaAsignaturaId')
      .innerJoin(Asignatura, 'a', 'a.id = rai.asignaturaId')
      .select('a.id', 'asignaturaId')
      .addSelect('a.nombre', 'nombre')
      .addSelect('a.semestre', 'semestre')
      .addSelect('COUNT(CASE WHEN rai.nivelSatisfaccion = 1 THEN 1 END)', 'nivel1')
      .addSelect('COUNT(CASE WHEN rai.nivelSatisfaccion = 2 THEN 1 END)', 'nivel2')
      .addSelect('COUNT(CASE WHEN rai.nivelSatisfaccion = 3 THEN 1 END)', 'nivel3')
      .addSelect('COUNT(CASE WHEN rai.nivelSatisfaccion = 4 THEN 1 END)', 'nivel4')
      .addSelect('COUNT(CASE WHEN rai.nivelSatisfaccion = 5 THEN 1 END)', 'nivel5')
      .addSelect('COUNT(*)', 'total')
      .addSelect('AVG(rai.nivelSatisfaccion)', 'promedio')
      .where('ra.periodoId = :pid', { pid: p.id });

    if (semestre) {
      qb.andWhere('ra.semestreAlResponder = :s', { s: semestre });
    }

    qb.groupBy('a.id').addGroupBy('a.nombre').addGroupBy('a.semestre')
      .orderBy('a.semestre', 'ASC')
      .addOrderBy('a.nombre', 'ASC');

    const rows = await qb.getRawMany();
    return {
      periodo: p,
      items: rows.map((r) => ({
        asignaturaId: r.asignaturaId,
        nombre: r.nombre,
        semestre: Number(r.semestre),
        nivel1: Number(r.nivel1),
        nivel2: Number(r.nivel2),
        nivel3: Number(r.nivel3),
        nivel4: Number(r.nivel4),
        nivel5: Number(r.nivel5),
        total: Number(r.total),
        promedio: Number(Number(r.promedio || 0).toFixed(2)),
      })),
    };
  }

  /** Comparativo de una materia a lo largo de los periodos */
  async comparativo(asignaturaId: string) {
    const periodos = await this.periodosRepo.find({ order: { fechaInicio: 'ASC' } });
    const serie: { periodo: string; promedio: number; dificultadCount: number }[] = [];

    for (const p of periodos) {
      const qb = this.raiRepo.createQueryBuilder('rai')
        .innerJoin(RespuestaAsignatura, 'ra', 'ra.id = rai.respuestaAsignaturaId')
        .where('ra.periodoId = :pid', { pid: p.id })
        .andWhere('rai.asignaturaId = :aid', { aid: asignaturaId })
        .select('AVG(rai.nivelSatisfaccion)', 'prom')
        .addSelect('COUNT(CASE WHEN rai.tieneDificultad = true THEN 1 END)', 'dif');

      const row = await qb.getRawOne();
      serie.push({
        periodo: p.nombre,
        promedio: Number(Number(row?.prom ?? 0).toFixed(2)),
        dificultadCount: Number(row?.dif ?? 0),
      });
    }

    return serie;
  }

  /** Resumen de métricas para Dashboard Materias */
  async resumen(periodoId?: string, semestre?: number) {
    const top = await this.topAsignaturas(periodoId, semestre);
    const tasa = await this.tasaRespuesta(periodoId);
    const totalEstudiantes = await this.usersRepo.count({ where: { rol: 'ESTUDIANTE' } });

    return {
      totalRespuestas: tasa.totalRespuestas,
      totalEstudiantes,
      tasaGlobal: tasa.global,
      top1: top.items[0] ?? null,
    };
  }

  /** Desglose detallado por profesor, grupo y horarios para una asignatura específica */
  async desgloseGrupos(asignaturaId: string, periodoId?: string) {
    const p = await this.periodoOrFail(periodoId);
    const asig = await this.asigRepo.findOne({
      where: { id: asignaturaId },
      relations: ['grupos'],
    });
    if (!asig) throw new BadRequestException('Asignatura no encontrada');

    const items = await this.raiRepo.createQueryBuilder('rai')
      .innerJoin(RespuestaAsignatura, 'ra', 'ra.id = rai.respuestaAsignaturaId')
      .leftJoinAndSelect('rai.grupo', 'g')
      .where('ra.periodoId = :pid', { pid: p.id })
      .andWhere('rai.asignaturaId = :aid', { aid: asignaturaId })
      .getMany();

    const totalEvaluaciones = items.length;
    const totalDificultad = items.filter((i) => i.tieneDificultad).length;
    const promedioGeneral = totalEvaluaciones
      ? Number((items.reduce((acc, cur) => acc + cur.nivelSatisfaccion, 0) / totalEvaluaciones).toFixed(2))
      : 0;

    const gruposConfigurados = asig.grupos || [];
    const desglose = gruposConfigurados.map((g) => {
      const itemsDelGrupo = items.filter((i) => i.grupoId === g.id);
      const dificultades = itemsDelGrupo.filter((i) => i.tieneDificultad).length;
      const totalGrupo = itemsDelGrupo.length;
      const promedio = totalGrupo
        ? Number((itemsDelGrupo.reduce((acc, cur) => acc + cur.nivelSatisfaccion, 0) / totalGrupo).toFixed(2))
        : 0;
      const porcentajeDeDificultad = totalDificultad
        ? Number(((dificultades / totalDificultad) * 100).toFixed(1))
        : 0;

      return {
        grupoId: g.id,
        profesor: g.profesor,
        codigoGrupo: g.codigoGrupo,
        horario: g.horario,
        activo: g.activo,
        reportesDificultad: dificultades,
        totalEstudiantesEvaluaron: totalGrupo,
        promedioSatisfaccion: promedio,
        porcentajeDeDificultad,
      };
    });

    const itemsSinGrupo = items.filter((i) => !i.grupoId);
    if (itemsSinGrupo.length > 0) {
      const difSin = itemsSinGrupo.filter((i) => i.tieneDificultad).length;
      const promSin = Number((itemsSinGrupo.reduce((acc, cur) => acc + cur.nivelSatisfaccion, 0) / itemsSinGrupo.length).toFixed(2));
      desglose.push({
        grupoId: 'sin-grupo',
        profesor: 'Sin docente asignado',
        codigoGrupo: 'Sin grupo específico',
        horario: 'Horario no registrado',
        activo: true,
        reportesDificultad: difSin,
        totalEstudiantesEvaluaron: itemsSinGrupo.length,
        promedioSatisfaccion: promSin,
        porcentajeDeDificultad: totalDificultad ? Number(((difSin / totalDificultad) * 100).toFixed(1)) : 0,
      });
    }

    desglose.sort((a, b) => b.reportesDificultad - a.reportesDificultad);

    return {
      periodo: p,
      asignatura: {
        id: asig.id,
        nombre: asig.nombre,
        codigo: asig.codigo ?? null,
        semestre: asig.semestre,
      },
      totalDificultad,
      totalEvaluaciones,
      promedioSatisfaccion: promedioGeneral,
      grupos: desglose,
    };
  }
}

