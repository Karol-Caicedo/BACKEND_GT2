import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { PeriodosService } from './periodos.service';
import { mockRepository } from '../../test/test-utils';

function buildService() {
  const repo = mockRepository();
  const builder = {
    setLock: jest.fn().mockReturnThis(),
    setOnLocked: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue([]),
  };
  const manager = {
    getRepository: jest.fn(() => repo),
    createQueryBuilder: jest.fn(() => builder),
  };
  const dataSource = { transaction: jest.fn((cb: (m: unknown) => unknown) => cb(manager)) };
  const svc = new PeriodosService(repo as never, dataSource as never);
  return { svc, repo, manager, builder, dataSource };
}

const P = { id: 'p-1', nombre: '2026-1', activo: false, modoEncuesta: 'seleccion' };

describe('PeriodosService (un solo activo a la vez)', () => {
  test('create activo desactiva los demás y usa modo por defecto', async () => {
    const { svc, repo } = buildService();
    await svc.create({ nombre: '2026-1', fechaInicio: '2026-01-01', fechaFin: '2026-06-01', activo: true } as never);
    expect(repo.update).toHaveBeenCalledWith({ activo: true }, { activo: false });
    expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ modoEncuesta: 'seleccion' }));
  });

  test('create inactivo no toca los demás y respeta modo calificacion', async () => {
    const { svc, repo } = buildService();
    await svc.create({ nombre: '2026-2', fechaInicio: '2026-07-01', fechaFin: '2026-12-01', activo: false, modoEncuesta: 'calificacion' } as never);
    expect(repo.update).not.toHaveBeenCalled();
    expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ modoEncuesta: 'calificacion' }));
  });

  test('update inexistente → 404', async () => {
    const { svc, repo } = buildService();
    repo.findOne.mockResolvedValue(null);
    await expect(svc.update('x', {} as never)).rejects.toThrow(NotFoundException);
  });

  test('update que activa desactiva el anterior; si ya estaba activo no', async () => {
    const { svc, repo } = buildService();
    repo.findOne.mockResolvedValue({ ...P, activo: false });
    await svc.update('p-1', { activo: true } as never);
    expect(repo.update).toHaveBeenCalledWith({ activo: true }, { activo: false });

    const c2 = buildService();
    c2.repo.findOne.mockResolvedValue({ ...P, activo: true });
    await c2.svc.update('p-1', { activo: true } as never);
    expect(c2.repo.update).not.toHaveBeenCalled();
  });

  test('remove: inexistente → 404; activo → 400; inactivo → ok', async () => {
    const { svc, repo } = buildService();
    repo.findOne.mockResolvedValue(null);
    await expect(svc.remove('x')).rejects.toThrow(NotFoundException);
    repo.findOne.mockResolvedValue({ ...P, activo: true });
    await expect(svc.remove('p-1')).rejects.toThrow(BadRequestException);
    expect(repo.remove).not.toHaveBeenCalled();
    repo.findOne.mockResolvedValue({ ...P, activo: false });
    await expect(svc.remove('p-1')).resolves.toEqual({ ok: true });
  });

  test('activar: inexistente → 404; desactiva otros y marca activo', async () => {
    const { svc, repo } = buildService();
    repo.findOne.mockResolvedValue(null);
    await expect(svc.activar('x')).rejects.toThrow(NotFoundException);
    const p = { ...P, activo: false };
    repo.findOne.mockResolvedValue(p);
    await svc.activar('p-1');
    expect(repo.update).toHaveBeenCalledWith({ activo: true }, { activo: false });
    expect(p.activo).toBe(true);
    expect(repo.save).toHaveBeenCalledWith(p);
  });

  test('bloquea las filas con NOWAIT antes de activar', async () => {
    const { svc, repo, builder } = buildService();
    repo.findOne.mockResolvedValue({ ...P });
    await svc.activar('p-1');
    expect(builder.setLock).toHaveBeenCalledWith('pessimistic_write');
    expect(builder.setOnLocked).toHaveBeenCalledWith('nowait');
    expect(builder.getMany).toHaveBeenCalled();
  });

  test('traduce 23505 de uq_periodo_activo a 409', async () => {
    const { svc, repo } = buildService();
    repo.findOne.mockResolvedValue({ ...P });
    const error = new QueryFailedError('INSERT', [], {
      code: '23505', constraint: 'uq_periodo_activo', detail: 'Key (activo)=(true) already exists.',
    } as never);
    repo.save.mockRejectedValueOnce(error);
    await expect(svc.activar('p-1')).rejects.toThrow(ConflictException);
  });

  test('traduce 55P03 de bloqueo no disponible a 409', async () => {
    const { svc, builder } = buildService();
    builder.getMany.mockRejectedValueOnce(new QueryFailedError('SELECT', [], { code: '55P03' } as never));
    await expect(svc.activar('p-1')).rejects.toThrow(ConflictException);
  });

  test('no enmascara un 23505 de nombre', async () => {
    const { svc, repo } = buildService();
    repo.findOne.mockResolvedValue({ ...P });
    const error = new QueryFailedError('INSERT', [], { code: '23505', constraint: 'UQ_nombre' } as never);
    repo.save.mockRejectedValueOnce(error);
    await expect(svc.activar('p-1')).rejects.toBe(error);
  });

  test('activo delega el filtro al repositorio', async () => {
    const { svc, repo } = buildService();
    repo.findOne.mockResolvedValue(P);
    await expect(svc.activo()).resolves.toBe(P);
    expect(repo.findOne).toHaveBeenCalledWith({ where: { activo: true } });
  });
});
