import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Respuesta, RespuestaTema } from '../encuestas/respuesta.entity';
import { Tema } from '../temas/tema.entity';
import { Periodo } from '../periodos/periodo.entity';
import { User } from '../users/user.entity';
import { RespuestaAsignatura, RespuestaAsignaturaItem } from '../encuestas-asignaturas/respuesta-asignatura.entity';
import { Asignatura } from '../asignaturas/asignatura.entity';
import { GrupoAsignatura } from '../asignaturas/grupo-asignatura.entity';
import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';
import { DashboardMateriasService } from './dashboard-materias.service';
import { DashboardMateriasController } from './dashboard-materias.controller';
import { CapacitacionesModule } from '../capacitaciones/capacitaciones.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Respuesta, RespuestaTema, Tema, Periodo, User,
      RespuestaAsignatura, RespuestaAsignaturaItem, Asignatura, GrupoAsignatura,
    ]),
    CapacitacionesModule,
  ],

  controllers: [DashboardController, DashboardMateriasController],
  providers: [DashboardService, DashboardMateriasService],
})
export class DashboardModule {}
