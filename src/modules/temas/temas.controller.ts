import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Auth } from '../../common/auth.decorator';
import { Public } from '../../common/public.decorator';
import { TemasService, TemaDto, ActualizarTemaDto, CambiarEstadoTodosDto } from './temas.service';

@ApiTags('temas')
@Controller('temas')
export class TemasController {
  constructor(private svc: TemasService) {}

  @Get()
  @Public()
  activos() {
    return this.svc.activos();
  }

  @Get('admin/todos')
  @Auth('ADMIN')
  todos() {
    return this.svc.todos();
  }

  @Post()
  @Auth('ADMIN')
  crear(@Body() dto: TemaDto) {
    return this.svc.crear(dto);
  }

  @Patch('admin/cambiar-estado-todos')
  @Auth('ADMIN')
  @ApiOperation({ summary: 'Activar o inactivar todos los temas' })
  cambiarEstadoTodos(@Body() dto: CambiarEstadoTodosDto) {
    return this.svc.cambiarEstadoTodos(dto.activo);
  }

  @Patch('admin/cambiar-estado-todas')
  @Auth('ADMIN')
  @ApiOperation({ summary: 'Activar o inactivar todos los temas (alias)' })
  cambiarEstadoTodas(@Body() dto: CambiarEstadoTodosDto) {
    return this.svc.cambiarEstadoTodos(dto.activo);
  }

  @Patch(':id')
  @Auth('ADMIN')
  @ApiOperation({ summary: 'Actualizar un tema' })
  actualizar(@Param('id') id: string, @Body() dto: ActualizarTemaDto) {
    return this.svc.actualizar(id, dto);
  }

  @Delete(':id')
  @Auth('ADMIN')
  eliminar(@Param('id') id: string) {
    return this.svc.eliminar(id);
  }
}

