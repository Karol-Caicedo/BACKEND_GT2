import { AsignaturasService } from './asignaturas.service';
import { mockRepository } from '../../test/test-utils';

function build() {
  const repo = mockRepository();
  return { service: new AsignaturasService(repo as never), repo };
}

describe('AsignaturasService respuestas públicas', () => {
  test('listas devuelven campos funcionales sin createdAt', async () => {
    const { service, repo } = build();
    repo.find.mockResolvedValue([{
      id: 'a-1',
      nombre: 'Álgebra',
      codigo: 'MAT-1',
      semestre: 1,
      activo: true,
      createdAt: new Date(),
    }]);

    await expect(service.activos()).resolves.toEqual([{
      id: 'a-1',
      nombre: 'Álgebra',
      codigo: 'MAT-1',
      semestre: 1,
      activo: true,
    }]);
    expect(repo.find.mock.calls[0][0]).toMatchObject({ where: { activo: true } });
  });

  test('crear y actualizar serializan los campos permitidos', async () => {
    const { service, repo } = build();
    repo.save.mockResolvedValue({
      id: 'a-1',
      nombre: 'Álgebra',
      codigo: 'MAT-1',
      semestre: 1,
      activo: true,
      createdAt: new Date(),
    } as never);

    await expect(service.crear({ nombre: 'Álgebra', codigo: 'MAT-1', semestre: 1 } as never)).resolves.toEqual({
      id: 'a-1',
      nombre: 'Álgebra',
      codigo: 'MAT-1',
      semestre: 1,
      activo: true,
    });

    repo.findOne.mockResolvedValue({
      id: 'a-1',
      nombre: 'Vieja',
      codigo: null,
      semestre: 1,
      activo: true,
      createdAt: new Date(),
    } as never);
    await expect(service.actualizar('a-1', { nombre: 'Nueva' })).resolves.toEqual({
      id: 'a-1',
      nombre: 'Álgebra',
      codigo: 'MAT-1',
      semestre: 1,
      activo: true,
    });
  });
});
