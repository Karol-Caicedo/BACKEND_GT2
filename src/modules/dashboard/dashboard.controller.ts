import { Controller, Get, ParseUUIDPipe, Query, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { Auth } from '../../common/auth.decorator';
import { DashboardService } from './dashboard.service';

@ApiTags('dashboard')
@Controller('dashboard')
@Auth('ADMIN')
export class DashboardController {
  constructor(private svc: DashboardService) {}

  @Get('top-temas')
  top(@Query('periodoId', new ParseUUIDPipe({ optional: true })) periodoId?: string, @Query('semestre') semestre?: string) {
    return this.svc.topTemas(periodoId, semestre ? Number(semestre) : undefined);
  }

  @Get('heatmap')
  heat(@Query('periodoId', new ParseUUIDPipe({ optional: true })) periodoId?: string) {
    return this.svc.heatmap(periodoId);
  }

  @Get('tasa-respuesta')
  tasa(@Query('periodoId', new ParseUUIDPipe({ optional: true })) periodoId?: string) {
    return this.svc.tasaRespuesta(periodoId);
  }

  @Get('comparativo')
  comp(@Query('temaId', ParseUUIDPipe) temaId: string) {
    return this.svc.comparativo(temaId);
  }

  @Get('declarado-vs-real')
  dvr(@Query('periodoId', new ParseUUIDPipe({ optional: true })) periodoId?: string) {
    return this.svc.declaradoVsReal(periodoId);
  }

  @Get('resumen')
  resumen(@Query('periodoId', new ParseUUIDPipe({ optional: true })) periodoId?: string) {
    return this.svc.resumen(periodoId);
  }

  @Get('export')
  async exportar(@Query('periodoId', new ParseUUIDPipe({ optional: true })) periodoId?: string, @Query('semestre') semestre?: string, @Res() res?: Response) {
    const top = await this.svc.topTemas(periodoId, semestre ? Number(semestre) : undefined);
    const tasa = await this.svc.tasaRespuesta(periodoId);
    const dvr = await this.svc.declaradoVsReal(periodoId);
    const lineas = ['seccion;clave;valor'];
    for (const i of top.items) lineas.push(`top;${String(i.nombre).replace(/;/g, ',')};${i.valor}`);
    for (const t of tasa.porSemestre) lineas.push(`tasa;semestre_${t.semestre};${t.respondieron}/${t.total}=${t.tasa.toFixed(3)}`);
    for (const d of dvr.items) lineas.push(`declarado_vs_real;${String(d.nombre).replace(/;/g, ',')};declarado=${d.declarado}|clics=${d.clics}`);
    const csv = '﻿' + lineas.join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="dashboard.csv"');
    res.send(csv);
  }
}
