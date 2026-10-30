import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cron } from '@nestjs/schedule';
import { RecordatorioEnviado } from './recordatorio.entity';
import { Periodo } from '../periodos/periodo.entity';
import { User } from '../users/user.entity';
import { Respuesta } from '../encuestas/respuesta.entity';
import { MailService } from '../mail/mail.service';

@Injectable()
export class RecordatoriosService {
  private log = new Logger(RecordatoriosService.name);

  constructor(
    @InjectRepository(RecordatorioEnviado) private rec: Repository<RecordatorioEnviado>,
    @InjectRepository(Periodo) private periodos: Repository<Periodo>,
    @InjectRepository(User) private users: Repository<User>,
    @InjectRepository(Respuesta) private resp: Repository<Respuesta>,
    private mail: MailService,
  ) {}

  /** Lógica pura: ¿toca recordatorio n según días desde apertura y ya enviados? */
  static numeroAEnviar(diasDesdeApertura: number, enviados: number[]): number | null {
    if (enviados.length >= 2) return null;
    if (diasDesdeApertura >= 14 && !enviados.includes(2)) {
      if (!enviados.includes(1) && diasDesdeApertura >= 7) return 1; // se envía el 1 primero
      return 2;
    }
    if (diasDesdeApertura >= 7 && !enviados.includes(1)) return 1;
    return null;
  }

  @Cron('0 8 * * *')
  async cronDiario() {
    const periodo = await this.periodos.findOne({ where: { activo: true } });
    if (!periodo) {
      this.log.log('Sin periodo activo: no hay recordatorios');
      return { enviados: 0 };
    }
    const dias = Math.floor((Date.now() - new Date(periodo.fechaInicio).getTime()) / 86400000);
    const estudiantes = await this.users.find({
      where: { rol: 'ESTUDIANTE' },
      select: { id: true, correo: true, nombre: true },
    });
    let enviados = 0;
    for (const est of estudiantes) {
      const yaRespondio = await this.resp.findOne({ where: { usuarioId: est.id, periodoId: periodo.id } });
      if (yaRespondio) continue;
      const previos = await this.rec.find({ where: { usuarioId: est.id, periodoId: periodo.id } });
      const nums = previos.map((p) => p.numero);
      const n = RecordatoriosService.numeroAEnviar(dias, nums);
      if (!n) continue;
      const asunto = `Recuerda responder la encuesta de intereses (${periodo.nombre})`;
      const html = `<p>Hola ${est.nombre},</p><p>Aún no has respondido la encuesta de intereses tecnológicos del periodo <b>${periodo.nombre}</b>. Te toma 2 minutos y ayuda a Proyección Social a programar capacitaciones para tu semestre.</p>`;
      await this.mail.enviar([est.correo], asunto, html);
      await this.rec.save(this.rec.create({ usuarioId: est.id, periodoId: periodo.id, numero: n }));
      enviados++;
    }
    this.log.log(`Recordatorios procesados: ${enviados} (día ${dias} del periodo ${periodo.nombre})`);
    return { enviados };
  }

  async resumen(periodoId?: string) {
    const periodo = periodoId
      ? await this.periodos.findOne({ where: { id: periodoId } })
      : await this.periodos.findOne({ where: { activo: true } });
    if (!periodo) return { total: 0, porNumero: {}, tasaPosterior: 0 };
    const todos = await this.rec.find({ where: { periodoId: periodo.id } });
    const total = todos.length;
    const porNumero: Record<number, number> = {};
    for (const r of todos) porNumero[r.numero] = (porNumero[r.numero] ?? 0) + 1;
    // Tasa posterior: de los recordados, cuántos terminaron respondiendo
    let respondieron = 0;
    const ids = [...new Set(todos.map((t) => t.usuarioId))];
    for (const uid of ids) {
      const r = await this.resp.findOne({ where: { usuarioId: uid, periodoId: periodo.id } });
      if (r) respondieron++;
    }
    return { periodo: periodo.nombre, total, porNumero, recordados: ids.length, respondieronDespues: respondieron, tasaPosterior: ids.length ? respondieron / ids.length : 0 };
  }
}
