import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Respuesta, RespuestaTema } from '../encuestas/respuesta.entity';
import { Tema } from '../temas/tema.entity';
import { Periodo } from '../periodos/periodo.entity';
import { User } from '../users/user.entity';
import { CapacitacionesService } from '../capacitaciones/capacitaciones.service';

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(Respuesta) private resp: Repository<Respuesta>,
    @InjectRepository(RespuestaTema) private rt: Repository<RespuestaTema>,
    @InjectRepository(Tema) private temas: Repository<Tema>,
    @InjectRepository(Periodo) private periodos: Repository<Periodo>,
    @InjectRepository(User) private users: Repository<User>,
    private caps: CapacitacionesService,
  ) {}

  private async periodoOrFail(periodoId?: string) {
    if (periodoId) {
      const p = await this.periodos.findOne({ where: { id: periodoId } });
      if (!p) throw new BadRequestException('Periodo no encontrado');
      return p;
    }
    const p = await this.periodos.findOne({ where: { activo: true } });
    if (!p) throw new BadRequestException('No hay periodo activo');
    return p;
  }

  /** Top 5: en selección cuenta elecciones; en calificación promedio. Solo agregados. */
  async topTemas(periodoId?: string, semestre?: number) {
    const p = await this.periodoOrFail(periodoId);
    const qb = this.rt.createQueryBuilder('rt')
      .innerJoin(Respuesta, 'r', 'r.id = rt.respuestaId')
      .innerJoin(Tema, 't', 't.id = rt.temaId')
      .select('t.id', 'temaId')
      .addSelect('t.nombre', 'nombre')
      .where('r.periodoId = :pid', { pid: p.id });
    if (semestre) qb.andWhere('r.semestreAlResponder = :s', { s: semestre });
    if (p.modoEncuesta === 'calificacion') {
      qb.addSelect('AVG(rt.puntaje)', 'valor').addSelect('COUNT(*)', 'votos');
    } else {
      qb.addSelect('COUNT(*)', 'valor');
    }
    qb.groupBy('t.id').addGroupBy('t.nombre').orderBy('valor', 'DESC', 'NULLS LAST').limit(5);
    const rows = await qb.getRawMany();
    return { periodo: p, modo: p.modoEncuesta, items: rows.map((r) => ({ ...r, valor: Number(r.valor) })) };
  }

  /** Matriz tema x semestre (conteo o promedio). */
  async heatmap(periodoId?: string) {
    const p = await this.periodoOrFail(periodoId);
    const qb = this.rt.createQueryBuilder('rt')
      .innerJoin(Respuesta, 'r', 'r.id = rt.respuestaId')
      .innerJoin(Tema, 't', 't.id = rt.temaId')
      .select('t.nombre', 'tema')
      .addSelect('r.semestreAlResponder', 'semestre')
      .where('r.periodoId = :pid', { pid: p.id });
    if (p.modoEncuesta === 'calificacion') qb.addSelect('AVG(rt.puntaje)', 'valor');
    else qb.addSelect('COUNT(*)', 'valor');
    qb.groupBy('t.nombre').addGroupBy('r.semestreAlResponder');
    const rows = await qb.getRawMany();
    const matriz: Record<string, Record<number, number>> = {};
    for (const r of rows) {
      matriz[r.tema] ??= {};
      matriz[r.tema][Number(r.semestre)] = Number(r.valor);
    }
    return { periodo: p, modo: p.modoEncuesta, matriz };
  }

  /** Tasa de respuesta por semestre: respondieron / estudiantes registrados. */
  async tasaRespuesta(periodoId?: string) {
    const p = await this.periodoOrFail(periodoId);
    const porSem: { semestre: number; respondieron: number; total: number; tasa: number }[] = [];
    let totR = 0;
    let totE = 0;
    for (let s = 1; s <= 9; s++) {
      const respondieron = await this.resp.count({ where: { periodoId: p.id, semestreAlResponder: s } });
      const total = await this.users.count({ where: { rol: 'ESTUDIANTE', semestre: s } });
      // Nota: estudiantes que cambiaron de semestre tras responder cuentan en semestreAlResponder;
      // el denominador usa semestre actual. Es aproximación documentada.
      porSem.push({ semestre: s, respondieron, total, tasa: total ? respondieron / total : 0 });
      totR += respondieron;
      totE += total;
    }
    return { periodo: p, porSemestre: porSem, global: totE ? totR / totE : 0, totalRespuestas: totR };
  }

  /** Evolución de un tema entre periodos. */
  async comparativo(temaId: string) {
    const periodos = await this.periodos.find({ order: { fechaInicio: 'ASC' } });
    const serie: { periodo: string; valor: number; modo: string }[] = [];
    for (const p of periodos) {
      const qb = this.rt.createQueryBuilder('rt')
        .innerJoin(Respuesta, 'r', 'r.id = rt.respuestaId')
        .where('r.periodoId = :pid', { pid: p.id })
        .andWhere('rt.temaId = :tid', { tid: temaId });
      if (p.modoEncuesta === 'calificacion') qb.select('AVG(rt.puntaje)', 'v');
      else qb.select('COUNT(*)', 'v');
      const row = await qb.getRawOne();
      serie.push({ periodo: p.nombre, valor: Number(row?.v ?? 0), modo: p.modoEncuesta });
    }
    return serie;
  }

  /** Interés declarado (encuesta) vs real (clics en capacitaciones del tema). */
  async declaradoVsReal(periodoId?: string) {
    const p = await this.periodoOrFail(periodoId);
    const declarado = await this.rt.createQueryBuilder('rt')
      .innerJoin(Respuesta, 'r', 'r.id = rt.respuestaId')
      .select('rt.temaId', 'temaId')
      .addSelect(p.modoEncuesta === 'calificacion' ? 'AVG(rt.puntaje)' : 'COUNT(*)', 'declarado')
      .where('r.periodoId = :pid', { pid: p.id })
      .groupBy('rt.temaId')
      .getRawMany();
    const clics = await this.caps.clicsPorTema();
    const mapaClics = new Map<string, number>(clics.map((c: { temaId: string; total: string }) => [c.temaId, Number(c.total)]));
    const temas = await this.temas.find();
    return {
      periodo: p,
      items: temas.map((t) => ({
        temaId: t.id,
        nombre: t.nombre,
        declarado: Number(declarado.find((d) => d.temaId === t.id)?.declarado ?? 0),
        clics: mapaClics.get(t.id) ?? 0,
      })),
    };
  }

  async resumen(periodoId?: string) {
    const top = await this.topTemas(periodoId);
    const tasa = await this.tasaRespuesta(periodoId);
    const totalEstudiantes = await this.users.count({ where: { rol: 'ESTUDIANTE' } });
    return {
      totalRespuestas: tasa.totalRespuestas,
      totalEstudiantes,
      tasaGlobal: tasa.global,
      top1: top.items[0] ?? null,
    };
  }
}
