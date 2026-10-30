import { ConfigService } from '@nestjs/config';
import { UsersController } from './users.controller';
import { User } from './user.entity';

const user = {
  id: 'u-1',
  correo: 'est@unipacifico.edu.co',
  nombre: 'Ana',
  numeroIdentificacion: '1098',
  passwordHash: '$argon2id$ejemplo',
  tokenVersion: 4,
  proveedorAuth: 'local',
  proveedorId: 'idp-1',
  semestre: 3,
  rol: 'ESTUDIANTE' as const,
  aceptoDatosAt: null,
  createdAt: new Date(),
} as User;

function build() {
  const users = {
    findAll: jest.fn().mockResolvedValue([user]),
    findByCorreo: jest.fn().mockResolvedValue(null),
    findById: jest.fn().mockResolvedValue({ ...user }),
    create: jest.fn().mockResolvedValue({ ...user, passwordHash: '$argon2id$nuevo' }),
    save: jest.fn(async (u: User) => u),
    remove: jest.fn(),
  };
  const config = new ConfigService({ ALLOWED_EMAIL_DOMAIN: '@unipacifico.edu.co' });
  return { ctrl: new UsersController(users as never, config), users };
}

describe('UsersController serialización', () => {
  test('listar no incluye hash, tokenVersion, proveedorId ni proveedorAuth', async () => {
    const { ctrl } = build();
    const lista = await ctrl.listar();
    expect(lista).toHaveLength(1);
    expect(lista[0]).toMatchObject({
      id: 'u-1',
      correo: 'est@unipacifico.edu.co',
      numeroIdentificacion: '1098',
    });
    expect(lista[0]).not.toHaveProperty('passwordHash');
    expect(lista[0]).not.toHaveProperty('tokenVersion');
    expect(lista[0]).not.toHaveProperty('proveedorId');
    expect(lista[0]).not.toHaveProperty('proveedorAuth');
    expect(lista[0]).not.toHaveProperty('aceptoDatosAt');
    expect(lista[0]).not.toHaveProperty('createdAt');
  });

  test('crear y actualizar devuelven el contrato admin sin secretos', async () => {
    const { ctrl, users } = build();
    const creado = await ctrl.crear({
      correo: 'nuevo@unipacifico.edu.co',
      nombre: 'Nuevo',
      password: 'ClaveSegura1',
      numeroIdentificacion: '1',
      rol: 'ESTUDIANTE',
      semestre: 1,
    });
    expect(creado).not.toHaveProperty('passwordHash');
    expect(users.create).toHaveBeenCalled();

    const actualizado = await ctrl.actualizar('u-1', { nombre: 'Ana 2' });
    expect(actualizado.nombre).toBe('Ana 2');
    expect(actualizado).not.toHaveProperty('passwordHash');
    expect(actualizado).not.toHaveProperty('proveedorId');
  });
});
