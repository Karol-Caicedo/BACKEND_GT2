import { Controller, Get, Param, Req, Res } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiProduces, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { Auth } from '../../common/auth.decorator';
import { CapacitacionViewer } from '../capacitaciones/capacitaciones.service';
import { UploadsService } from './uploads.service';

@ApiTags('uploads')
@Controller('uploads')
export class UploadsController {
  constructor(private readonly svc: UploadsService) {}

  @Get(':nombre')
  @Auth('ADMIN', 'ESTUDIANTE')
  @ApiOperation({ summary: 'Obtiene una imagen de capacitación con autorización por recurso' })
  @ApiParam({ name: 'nombre', example: 'a1b2c3d4e5f60718293a4b5c6d7e8f90.png' })
  @ApiProduces('image/png', 'image/jpeg', 'image/webp')
  obtener(
    @Param('nombre') nombre: string,
    @Req() req: { user: CapacitacionViewer },
    @Res() res: Response,
  ) {
    return this.svc.enviar(nombre, req.user, res);
  }
}
