import { BadRequestException, Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, Req, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiConsumes, ApiOperation } from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import { Auth } from '../../common/auth.decorator';
import { CapacitacionesService } from './capacitaciones.service';
import { ActualizarCapacitacionDto, CapacitacionDto, FiltroCapDto } from './capacitacion.dto';
import { MailService } from '../mail/mail.service';
import { escaparHtml } from '../mail/resend.service';
import { eliminarImagen, guardarImagen } from './imagen.util';

function fileFilter(_req: unknown, file: Express.Multer.File, cb: (e: Error | null, ok: boolean) => void) {
  const ok = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'].includes(file.mimetype.toLowerCase());
  if (!ok) return cb(new BadRequestException('Solo se permiten imágenes jpg, png o webp'), false);
  cb(null, true);
}

const imagenUpload = {
  storage: memoryStorage(),
  fileFilter,
  limits: { fileSize: 2 * 1024 * 1024, files: 1 },
};

@ApiTags('capacitaciones')
@Controller('capacitaciones')
export class CapacitacionesController {
  constructor(private svc: CapacitacionesService, private mail: MailService) {}

  @Get('mias')
  @Auth('ESTUDIANTE')
  @ApiOperation({ summary: 'Capacitaciones vigentes dirigidas a mi semestre' })
  mias(@Req() req: { user: { semestre: number } }) {
    return this.svc.mias(Number(req.user.semestre));
  }

  @Get()
  @Auth('ADMIN')
  todas(@Query() filtro: FiltroCapDto) {
    return this.svc.listarAdmin(filtro.estado, filtro.semestre);
  }

  @Get(':id')
  @Auth('ADMIN', 'ESTUDIANTE')
  una(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: { user: { id: string; rol: string; semestre: number } },
  ) {
    return this.svc.detallePara(id, req.user);
  }

  @Post()
  @Auth('ADMIN')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('imagen', imagenUpload))
  async crear(
    @Body() dto: CapacitacionDto,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Req() req: { user: { id: string } },
  ) {
    const url = file ? await guardarImagen(file) : null;
    try {
      return await this.svc.crear(dto, url, req.user.id);
    } catch (e) {
      await eliminarImagen(url).catch(() => undefined);
      throw e;
    }
  }

  @Patch(':id')
  @Auth('ADMIN')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('imagen', imagenUpload))
  async actualizar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ActualizarCapacitacionDto,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    const url = file ? await guardarImagen(file) : undefined;
    try {
      return await this.svc.actualizar(id, dto, url);
    } catch (e) {
      await eliminarImagen(url).catch(() => undefined);
      throw e;
    }
  }

  @Delete(':id')
  @Auth('ADMIN')
  eliminar(@Param('id', ParseUUIDPipe) id: string) {
    return this.svc.eliminar(id);
  }

  @Post(':id/clic')
  @Auth('ESTUDIANTE', 'ADMIN')
  @ApiOperation({ summary: 'Registra el clic y devuelve el enlace para redirigir' })
  clic(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: { user: { id: string; rol: string; semestre: number } },
  ) {
    return this.svc.registrarClic(id, req.user);
  }

  @Post(':id/notificar')
  @Auth('ADMIN')
  @ApiOperation({ summary: 'Notificar por correo a estudiantes de los semestres destino' })
  async notificar(@Param('id', ParseUUIDPipe) id: string) {
    const cap = await this.svc.detalle(id);
    const destinatarios = await this.svc.destinatarios(id);
    if (!destinatarios.length) return { enviados: 0, mensaje: 'No hay estudiantes en los semestres destino' };
    const titulo = escaparHtml(cap.titulo);
    const html = `<h2>${titulo}</h2><p>${escaparHtml(cap.descripcion)}</p><p><b>Modalidad:</b> ${escaparHtml(cap.modalidad)}</p>${cap.fechaEvento ? `<p><b>Fecha:</b> ${escaparHtml(String(cap.fechaEvento))}</p>` : ''}<p><a href="${escaparHtml(cap.enlace)}">Ver más / Inscribirme</a></p>`;
    const r = await this.mail.enviar(destinatarios, `Nueva capacitación: ${cap.titulo}`, html);
    return { enviados: destinatarios.length, ...r };
  }
}
