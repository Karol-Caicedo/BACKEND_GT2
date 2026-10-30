import { Controller, Get, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Auth } from '../../common/auth.decorator';
import { RecordatoriosService } from './recordatorios.service';

@ApiTags('recordatorios')
@Controller('recordatorios')
@Auth('ADMIN')
export class RecordatoriosController {
  constructor(private svc: RecordatoriosService) {}

  @Get('resumen')
  resumen(@Query('periodoId') periodoId?: string) {
    return this.svc.resumen(periodoId);
  }

  @Post('ejecutar')
  ejecutar() {
    return this.svc.cronDiario();
  }
}
