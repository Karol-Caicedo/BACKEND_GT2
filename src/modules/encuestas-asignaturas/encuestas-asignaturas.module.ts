import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RespuestaAsignatura, RespuestaAsignaturaItem } from './respuesta-asignatura.entity';
import { InscripcionAsignatura } from './inscripcion-asignatura.entity';
import { Asignatura } from '../asignaturas/asignatura.entity';
import { Periodo } from '../periodos/periodo.entity';
import { User } from '../users/user.entity';
import { PeriodosModule } from '../periodos/periodos.module';
import { EncuestasAsignaturasService } from './encuestas-asignaturas.service';
import { EncuestasAsignaturasController } from './encuestas-asignaturas.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([RespuestaAsignatura, RespuestaAsignaturaItem, InscripcionAsignatura, Asignatura, Periodo, User]),
    PeriodosModule,
  ],
  controllers: [EncuestasAsignaturasController],
  providers: [EncuestasAsignaturasService],
  exports: [EncuestasAsignaturasService],
})
export class EncuestasAsignaturasModule {}
