import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Auth } from '../../common/auth.decorator';
import { DashboardMateriasService } from './dashboard-materias.service';

@ApiTags('dashboard-materias')
@Controller('dashboard-materias')
@Auth('ADMIN')
export class DashboardMateriasController {
  constructor(private svc: DashboardMateriasService) {}

  @Get('top-asignaturas')
  @ApiOperation({ summary: 'Top 5 de asignaturas con dificultad reportada' })
  top(@Query('periodoId') p?: string, @Query('semestre') s?: string) {
    return this.svc.topAsignaturas(p, s ? Number(s) : undefined);
  }

  @Get('tasa-respuesta')
  @ApiOperation({ summary: 'Tasa de respuesta por semestre en encuesta de asignaturas' })
  tasa(@Query('periodoId') p?: string) {
    return this.svc.tasaRespuesta(p);
  }

  @Get('heatmap')
  @ApiOperation({ summary: 'Mapa de calor asignaturas x semestres' })
  heatmap(@Query('periodoId') p?: string) {
    return this.svc.heatmap(p);
  }

  @Get('satisfaccion')
  @ApiOperation({ summary: 'Distribución de los 5 niveles de satisfacción por materia y semestre' })
  satisfaccion(@Query('periodoId') p?: string, @Query('semestre') s?: string) {
    return this.svc.satisfaccion(p, s ? Number(s) : undefined);
  }

  @Get('comparativo')
  @ApiOperation({ summary: 'Evolución de una asignatura entre periodos' })
  comparativo(@Query('asignaturaId') asignaturaId: string) {
    return this.svc.comparativo(asignaturaId);
  }

  @Get('resumen')
  @ApiOperation({ summary: 'Resumen global de métricas del dashboard de materias' })
  resumen(@Query('periodoId') p?: string, @Query('semestre') s?: string) {
    return this.svc.resumen(p, s ? Number(s) : undefined);
  }

  @Get('desglose-grupos')
  @ApiOperation({ summary: 'Desglose detallado por profesor, grupo y horarios de una asignatura' })
  desgloseGrupos(
    @Query('asignaturaId') asignaturaId: string,
    @Query('periodoId') periodoId?: string,
  ) {
    return this.svc.desgloseGrupos(asignaturaId, periodoId);
  }
}

