import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository, In } from 'typeorm';
import { RespuestaAsignatura, RespuestaAsignaturaItem } from './respuesta-asignatura.entity';
import { InscripcionAsignatura } from './inscripcion-asignatura.entity';
import { Asignatura } from '../asignaturas/asignatura.entity';
import { GrupoAsignatura } from '../asignaturas/grupo-asignatura.entity';
import { Periodo } from '../periodos/periodo.entity';
import { PeriodosService } from '../periodos/periodos.service';
import { User } from '../users/user.entity';
import { ResponderEncuestaAsignaturaDto, GuardarInscripcionesDto } from './encuesta-asignatura.dto';

@Injectable()
export class EncuestasAsignaturasService {
  constructor(
    @InjectRepository(RespuestaAsignatura) private resp: Repository<RespuestaAsignatura>,
    @InjectRepository(RespuestaAsignaturaItem) private respItems: Repository<RespuestaAsignaturaItem>,
    @InjectRepository(InscripcionAsignatura) private inscripcionesRepo: Repository<InscripcionAsignatura>,
    @InjectRepository(Asignatura) private asignaturasRepo: Repository<Asignatura>,
    @InjectRepository(Periodo) private periodosRepo: Repository<Periodo>,
    @InjectRepository(User) private usersRepo: Repository<User>,
    private periodosService: PeriodosService,
    private dataSource: DataSource,
  ) {}

  async obtenerEstadoParaEstudiante(userId: string) {
    const periodo = await this.periodosService.activo();
    if (!periodo) {
      return {
        activa: false,
        periodo: null,
        todasAsignaturas: [],
        inscripcionIds: [],
        asignaturasInscritas: [],
        yaRespondio: false,
        miRespuesta: null,
      };
    }

    const activa = this.periodosService.esEncuestaAsignaturasVigente(periodo);
    const user = await this.usersRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuario no encontrado');

    // Todas las materias activas del pensum académico (sin sesgo de semestre), con sus grupos
    const todasAsignaturasEntidades = await this.asignaturasRepo.find({
      where: { activo: true },
      relations: ['grupos'],
      order: { semestre: 'ASC', nombre: 'ASC' },
    });
    const todasAsignaturas = todasAsignaturasEntidades.map((a) => ({
      id: a.id,
      nombre: a.nombre,
      codigo: a.codigo ?? null,
      semestre: a.semestre,
      grupos: (a.grupos || []).filter((g) => g.activo).map((g) => ({
        id: g.id,
        profesor: g.profesor,
        codigoGrupo: g.codigoGrupo,
        horario: g.horario,
      })),
    }));

    const miRespuesta = await this.miRespuesta(userId, periodo.id);
    const yaRespondio = !!miRespuesta;

    // Inscripciones actuales del estudiante en el periodo activo
    const inscripciones = await this.inscripcionesRepo.find({
      where: { usuarioId: userId, periodoId: periodo.id },
      relations: ['asignatura', 'grupo'],
      order: { createdAt: 'ASC' },
    });

    const inscripcionIds = inscripciones.map((i) => i.asignaturaId);
    const inscripcionesDetalle = inscripciones.map((i) => ({
      asignaturaId: i.asignaturaId,
      grupoId: i.grupoId ?? null,
      grupo: i.grupo ? { id: i.grupo.id, profesor: i.grupo.profesor, codigoGrupo: i.grupo.codigoGrupo, horario: i.grupo.horario } : null,
    }));

    let asignaturasInscritas = inscripciones.map((i) => i.asignatura).filter(Boolean).map((a) => {
      const insc = inscripciones.find((item) => item.asignaturaId === a.id);
      const asigInfo = todasAsignaturas.find((t) => t.id === a.id);
      return {
        id: a.id,
        nombre: a.nombre,
        codigo: a.codigo ?? null,
        semestre: a.semestre,
        grupoId: insc?.grupoId ?? null,
        grupo: insc?.grupo ? { id: insc.grupo.id, profesor: insc.grupo.profesor, codigoGrupo: insc.grupo.codigoGrupo, horario: insc.grupo.horario } : null,
        grupos: asigInfo?.grupos || [],
      };
    });

    // Si ya respondió, sus materias evaluadas son las de su respuesta
    if (yaRespondio && miRespuesta?.items?.length) {
      const idsRespondidos = miRespuesta.items.map((it) => it.asignaturaId);
      asignaturasInscritas = todasAsignaturas.filter((a) => idsRespondidos.includes(a.id)).map((a) => {
        const itemResp = miRespuesta.items.find((it) => it.asignaturaId === a.id);
        return {
          ...a,
          grupoId: itemResp?.grupoId ?? null,
          grupo: itemResp?.grupo ?? null,
        };
      });
    }

    return {
      activa,
      periodo: { id: periodo.id, nombre: periodo.nombre, activo: periodo.activo },
      todasAsignaturas,
      inscripcionIds,
      inscripciones: inscripcionesDetalle,
      asignaturasInscritas,
      yaRespondio,
      miRespuesta,
    };
  }

  async guardarInscripciones(userId: string, dto: GuardarInscripcionesDto) {
    await this.dataSource.transaction(async (manager) => {
      const periodos = manager.getRepository(Periodo);
      const resp = manager.getRepository(RespuestaAsignatura);
      const asignaturas = manager.getRepository(Asignatura);
      const inscripciones = manager.getRepository(InscripcionAsignatura);

      const periodo = await periodos.findOne({ where: { activo: true } });
      if (!periodo) throw new BadRequestException('No hay periodo académico activo');

      const ya = await resp.findOne({ where: { usuarioId: userId, periodoId: periodo.id } });
      if (ya) {
        throw new BadRequestException('Ya enviaste tu encuesta para este periodo y no puedes modificar tus materias');
      }

      // Soporta tanto array de IDs directos como objetos con grupoId opcional
      const itemsDeseados: { asignaturaId: string; grupoId?: string | null }[] = [];
      if (dto.inscripciones && dto.inscripciones.length > 0) {
        for (const item of dto.inscripciones) {
          if (item.asignaturaId && !itemsDeseados.some((d) => d.asignaturaId === item.asignaturaId)) {
            itemsDeseados.push({ asignaturaId: item.asignaturaId, grupoId: item.grupoId || null });
          }
        }
      } else if (dto.asignaturaIds && dto.asignaturaIds.length > 0) {
        for (const id of Array.from(new Set(dto.asignaturaIds))) {
          itemsDeseados.push({ asignaturaId: id, grupoId: null });
        }
      }

      if (itemsDeseados.length === 0) {
        await inscripciones.delete({ usuarioId: userId, periodoId: periodo.id });
        return periodo.id;
      }

      const uniqueIds = itemsDeseados.map((i) => i.asignaturaId);
      const asignaturasValidas = await asignaturas.find({
        where: { id: In(uniqueIds), activo: true },
      });
      if (asignaturasValidas.length !== uniqueIds.length) {
        throw new BadRequestException('Algunas de las materias seleccionadas no existen o están inactivas');
      }

      await inscripciones.delete({ usuarioId: userId, periodoId: periodo.id });
      await inscripciones.save(
        itemsDeseados.map((it) =>
          inscripciones.create({
            usuarioId: userId,
            periodoId: periodo.id,
            asignaturaId: it.asignaturaId,
            grupoId: it.grupoId ?? null,
          }),
        ),
      );
    });

    return this.obtenerEstadoParaEstudiante(userId);
  }

  async miRespuesta(userId: string, periodoId?: string) {
    const periodo = periodoId
      ? await this.periodosRepo.findOne({ where: { id: periodoId } })
      : await this.periodosService.activo();
    if (!periodo) return null;

    const r = await this.resp.findOne({
      where: { usuarioId: userId, periodoId: periodo.id },
      relations: ['items', 'items.grupo'],
    });
    if (!r) return null;

    const asigIds = r.items.map((i) => i.asignaturaId);
    const asignaturas = asigIds.length ? await this.asignaturasRepo.find({ where: { id: In(asigIds) } }) : [];
    const mapaAsig = new Map(asignaturas.map((a) => [a.id, a]));

    const itemsConDetalle = r.items.map((i) => {
      const a = mapaAsig.get(i.asignaturaId);
      return {
        id: i.id,
        asignaturaId: i.asignaturaId,
        grupoId: i.grupoId ?? null,
        grupo: i.grupo ? { id: i.grupo.id, profesor: i.grupo.profesor, codigoGrupo: i.grupo.codigoGrupo, horario: i.grupo.horario } : null,
        tieneDificultad: i.tieneDificultad,
        nivelSatisfaccion: i.nivelSatisfaccion,
        asignatura: a ? { id: a.id, nombre: a.nombre, codigo: a.codigo ?? null, semestre: a.semestre } : null,
      };
    });

    return {
      id: r.id,
      items: itemsConDetalle,
    };
  }

  async responder(userId: string, dto: ResponderEncuestaAsignaturaDto) {
    const periodoId = await this.dataSource.transaction(async (manager) => {
      const periodos = manager.getRepository(Periodo);
      const resp = manager.getRepository(RespuestaAsignatura);
      const respItems = manager.getRepository(RespuestaAsignaturaItem);
      const inscripciones = manager.getRepository(InscripcionAsignatura);
      const asignaturas = manager.getRepository(Asignatura);
      const users = manager.getRepository(User);

      const periodo = await periodos.findOne({ where: { activo: true } });
      if (!periodo) throw new BadRequestException('No hay periodo académico activo');
      if (!this.periodosService.esEncuestaAsignaturasVigente(periodo)) {
        throw new BadRequestException('La encuesta de asignaturas no está habilitada en este momento');
      }

      const ya = await resp.findOne({ where: { usuarioId: userId, periodoId: periodo.id } });
      if (ya) throw new BadRequestException('Ya enviaste tu respuesta para este periodo y no se puede modificar');

      const user = await users.findOne({ where: { id: userId } });
      if (!user) throw new NotFoundException('Usuario no encontrado');

      if (!dto.items || dto.items.length === 0) {
        throw new BadRequestException('Debes evaluar las asignaturas que estás cursando');
      }

      const dificultades = dto.items.filter((i) => i.tieneDificultad);
      if (dificultades.length > 4) {
        throw new BadRequestException('Solo puedes seleccionar un máximo de 4 asignaturas con dificultad');
      }

      for (const item of dto.items) {
        if (item.nivelSatisfaccion != null && (item.nivelSatisfaccion < 1 || item.nivelSatisfaccion > 5)) {
          throw new BadRequestException('El nivel de satisfacción debe ser entre 1 y 5');
        }
      }

      const ids = dto.items.map((i) => i.asignaturaId);
      if (new Set(ids).size !== ids.length) {
        throw new BadRequestException('Hay asignaturas duplicadas en la respuesta');
      }

      const asigsValidas = await asignaturas.find({
        where: { id: In(ids), activo: true },
      });
      if (asigsValidas.length !== ids.length) {
        throw new BadRequestException('Algunas asignaturas seleccionadas no están activas en el periodo');
      }

      // Validar que si la asignatura tiene grupos activos configurados, el docente y grupo sea obligatorio
      const gruposRepo = manager.getRepository(GrupoAsignatura);
      const gruposDisponibles = await gruposRepo.find({
        where: { asignaturaId: In(ids), activo: true },
      });
      const gruposPorAsig = new Map<string, string[]>();
      for (const g of gruposDisponibles) {
        const arr = gruposPorAsig.get(g.asignaturaId) || [];
        arr.push(g.id);
        gruposPorAsig.set(g.asignaturaId, arr);
      }

      for (const item of dto.items) {
        const gruposDeEstaAsig = gruposPorAsig.get(item.asignaturaId);
        if (gruposDeEstaAsig && gruposDeEstaAsig.length > 0) {
          if (!item.grupoId) {
            const asigObj = asigsValidas.find((a) => a.id === item.asignaturaId);
            throw new BadRequestException(
              `Debes seleccionar obligatoriamente el docente y horario para la materia "${asigObj?.nombre || 'seleccionada'}"`,
            );
          }
          if (!gruposDeEstaAsig.includes(item.grupoId)) {
            throw new BadRequestException('El grupo y docente seleccionado no es válido para esta asignatura');
          }
        }
      }

      const inscripcionesActuales = await inscripciones.find({
        where: { usuarioId: userId, periodoId: periodo.id },
      });
      const idsInscritos = new Set(inscripcionesActuales.map((i) => i.asignaturaId));
      const inscripcionesFaltantes = ids.filter((id) => !idsInscritos.has(id));
      if (inscripcionesFaltantes.length > 0) {
        await inscripciones.save(
          inscripcionesFaltantes.map((asigId) => {
            const item = dto.items.find((it) => it.asignaturaId === asigId);
            return inscripciones.create({
              usuarioId: userId,
              periodoId: periodo.id,
              asignaturaId: asigId,
              grupoId: item?.grupoId ?? null,
            });
          }),
        );
      }

      // Actualizar grupoId en inscripciones existentes si se especificó en la respuesta
      for (const item of dto.items) {
        if (item.grupoId) {
          await inscripciones.update(
            { usuarioId: userId, periodoId: periodo.id, asignaturaId: item.asignaturaId },
            { grupoId: item.grupoId },
          );
        }
      }

      const r = await resp.save(
        resp.create({
          usuarioId: userId,
          periodoId: periodo.id,
          semestreAlResponder: user.semestre || 1,
        }),
      );

      await respItems.save(
        dto.items.map((i) =>
          respItems.create({
            respuestaAsignaturaId: r.id,
            asignaturaId: i.asignaturaId,
            grupoId: i.grupoId ?? null,
            tieneDificultad: !!i.tieneDificultad,
            nivelSatisfaccion: i.nivelSatisfaccion ?? 3,
          }),
        ),
      );

      return periodo.id;
    });

    return this.miRespuesta(userId, periodoId);
  }
}

