import { NotFoundException } from '@nestjs/common';
import { TemasService } from './temas.service';
import { Tema } from './tema.entity';
import { mockRepository } from '../../test/test-utils';

function buildService() {
  const repo = mockRepository();
  const svc = new TemasService(repo as never);
  return { svc, repo };
}

describe('TemasService', () => {
  test('activos filtra y ordena; todos no filtra', async () => {
    const { svc, repo } = buildService();
    const tema = { id: 't-1', nombre: 'IA', descripcion: 'Descripción', activo: true, createdAt: new Date() };
    repo.find.mockResolvedValue([tema]);
    const activos = await svc.activos();
    expect(repo.find).toHaveBeenCalledWith({ where: { activo: true }, order: { nombre: 'ASC' } });
    expect(activos).toEqual([{ id: 't-1', nombre: 'IA', descripcion: 'Descripción', activo: true }]);
    const todos = await svc.todos();
    expect(repo.find).toHaveBeenCalledWith({ order: { nombre: 'ASC' } });
    expect(todos[0]).not.toHaveProperty('createdAt');
  });

  test('crear usa activo=true por defecto', async () => {
    const { svc, repo } = buildService();
    await svc.crear({ nombre: 'IA' });
    expect(repo.create).toHaveBeenCalledWith({ nombre: 'IA', activo: true });
    await svc.crear({ nombre: 'IoT', activo: false });
    expect(repo.create).toHaveBeenCalledWith({ nombre: 'IoT', activo: false });
  });

  test('crear y actualizar no devuelven metadatos de persistencia', async () => {
    const { svc, repo } = buildService();
    repo.save.mockResolvedValue({ id: 't-1', nombre: 'IA', descripcion: null, activo: true, createdAt: new Date() } as never);
    const creado = await svc.crear({ nombre: 'IA' });
    expect(creado).toEqual({ id: 't-1', nombre: 'IA', descripcion: null, activo: true });

    repo.findOne.mockResolvedValue({ id: 't-1', nombre: 'Viejo', descripcion: null, activo: true, createdAt: new Date() } as never);
    const actualizado = await svc.actualizar('t-1', { nombre: 'Nuevo' });
    expect(actualizado).toEqual({ id: 't-1', nombre: 'IA', descripcion: null, activo: true });
  });

  test('actualizar/eliminar inexistente → 404', async () => {
    const { svc, repo } = buildService();
    repo.findOne.mockResolvedValue(null);
    await expect(svc.actualizar('x', { nombre: 'Y' })).rejects.toThrow(NotFoundException);
    await expect(svc.eliminar('x')).rejects.toThrow(NotFoundException);
    expect(repo.save).not.toHaveBeenCalled();
    expect(repo.remove).not.toHaveBeenCalled();
  });

  test('actualizar mezcla cambios y eliminar retorna ok', async () => {
    const { svc, repo } = buildService();
    const t = { id: 't-1', nombre: 'Viejo', activo: true };
    repo.findOne.mockResolvedValue(t);
    await svc.actualizar('t-1', { nombre: 'Nuevo' });
    expect(repo.save).toHaveBeenCalledWith({ id: 't-1', nombre: 'Nuevo', activo: true });
    await expect(svc.eliminar('t-1')).resolves.toEqual({ ok: true });
  });

  test('cambiarEstadoTodos actualiza todos los registros', async () => {
    const { svc, repo } = buildService();
    const qb = {
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({ affected: 5 }),
    };
    (repo.createQueryBuilder as jest.Mock).mockReturnValue(qb);
    const res = await svc.cambiarEstadoTodos(false);
    expect(qb.update).toHaveBeenCalledWith(Tema);
    expect(qb.set).toHaveBeenCalledWith({ activo: false });
    expect(qb.execute).toHaveBeenCalled();
    expect(res).toEqual({ ok: true, activo: false });
  });
});
