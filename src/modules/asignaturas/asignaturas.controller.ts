import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Auth } from '../../common/auth.decorator';
import { AsignaturasService } from './asignaturas.service';
import { AsignaturaDto, ActualizarAsignaturaDto, CambiarEstadoTodasDto, CrearGrupoAsignaturaDto, ActualizarGrupoAsignaturaDto } from './asignatura.dto';

@ApiTags('asignaturas')
@Controller('asignaturas')
export class AsignaturasController {
  constructor(private svc: AsignaturasService) {}

  @Get()
  @Auth('ESTUDIANTE', 'ADMIN')
  @ApiOperation({ summary: 'Listar asignaturas activas, opcionalmente filtradas por semestre' })
  activos(@Query('semestre') semestre?: string) {
    return this.svc.activos(semestre ? Number(semestre) : undefined);
  }

  @Get('admin/todas')
  @Auth('ADMIN')
  @ApiOperation({ summary: 'Listar todas las asignaturas para administración' })
  todas(@Query('semestre') semestre?: string) {
    return this.svc.todos(semestre ? Number(semestre) : undefined);
  }

  @Post()
  @Auth('ADMIN')
  @ApiOperation({ summary: 'Crear una nueva asignatura' })
  crear(@Body() dto: AsignaturaDto) {
    return this.svc.crear(dto);
  }

  @Patch('admin/cambiar-estado-todas')
  @Auth('ADMIN')
  @ApiOperation({ summary: 'Activar o inactivar todas las asignaturas' })
  cambiarEstadoTodas(@Body() dto: CambiarEstadoTodasDto) {
    return this.svc.cambiarEstadoTodas(dto.activo, dto.semestre);
  }

  // --- Endpoints de grupos (rutas específicas antes de :id) ---

  @Get(':id/grupos')
  @Auth('ESTUDIANTE', 'ADMIN')
  @ApiOperation({ summary: 'Listar grupos de una asignatura' })
  listarGrupos(@Param('id') id: string) {
    return this.svc.listarGrupos(id);
  }

  @Post(':id/grupos')
  @Auth('ADMIN')
  @ApiOperation({ summary: 'Crear un nuevo grupo para una asignatura' })
  crearGrupo(@Param('id') id: string, @Body() dto: CrearGrupoAsignaturaDto) {
    return this.svc.crearGrupo(id, dto);
  }

  @Patch('grupos/:grupoId')
  @Auth('ADMIN')
  @ApiOperation({ summary: 'Actualizar un grupo' })
  actualizarGrupo(@Param('grupoId') grupoId: string, @Body() dto: ActualizarGrupoAsignaturaDto) {
    return this.svc.actualizarGrupo(grupoId, dto);
  }

  @Delete('grupos/:grupoId')
  @Auth('ADMIN')
  @ApiOperation({ summary: 'Eliminar un grupo' })
  eliminarGrupo(@Param('grupoId') grupoId: string) {
    return this.svc.eliminarGrupo(grupoId);
  }

  @Patch(':id')
  @Auth('ADMIN')
  @ApiOperation({ summary: 'Actualizar una asignatura existente' })
  actualizar(@Param('id') id: string, @Body() dto: ActualizarAsignaturaDto) {
    return this.svc.actualizar(id, dto);
  }

  @Delete(':id')
  @Auth('ADMIN')
  @ApiOperation({ summary: 'Eliminar una asignatura' })
  eliminar(@Param('id') id: string) {
    return this.svc.eliminar(id);
  }
}

