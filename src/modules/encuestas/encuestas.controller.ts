import { BadRequestException, Body, Controller, Get, Patch, Post, Query, Req } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Auth } from '../../common/auth.decorator';
import { EncuestasService } from './encuestas.service';
import { CrearEncuestaDto } from './encuesta.dto';

@ApiTags('encuestas')
@Controller()
export class EncuestasController {
  constructor(private svc: EncuestasService) {}

  @Get('encuestas/temas-aleatorios')
  @Auth('ESTUDIANTE', 'ADMIN')
  async aleatorios(@Req() req: { user: { id: string } }) {
    const p = await this.svc.periodoActivoOrFail();
    const temas = await this.svc.temasAleatorios(req.user.id, p.id);
    return {
      periodo: { id: p.id, nombre: p.nombre, activo: p.activo, modoEncuesta: p.modoEncuesta },
      temas: temas.map(({ id, nombre, descripcion }) => ({ id, nombre, descripcion })),
    };
  }

  @Get('encuestas/mi-respuesta')
  @Auth('ESTUDIANTE', 'ADMIN')
  miRespuesta(@Req() req: { user: { id: string } }, @Query('periodoId') periodoId?: string) {
    return this.svc.miRespuesta(req.user.id, periodoId);
  }

  @Post('encuestas')
  @Auth('ESTUDIANTE')
  @ApiOperation({ summary: 'Responder encuesta del periodo activo' })
  responder(@Req() req: { user: { id: string } }, @Body() dto: CrearEncuestaDto) {
    return this.svc.responder(req.user.id, dto);
  }

  @Patch('encuestas/mi-respuesta')
  @Auth('ESTUDIANTE')
  @ApiOperation({ summary: 'Las respuestas son definitivas y no se pueden modificar' })
  editar() {
    throw new BadRequestException('Las respuestas ya no se pueden modificar una vez enviadas');
  }
}
