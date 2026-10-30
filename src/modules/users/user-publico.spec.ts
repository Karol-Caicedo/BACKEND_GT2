import { User } from './user.entity';
import { respuestaUsuarioSinSecretos, toUsuarioAdmin, toUsuarioSesion } from './user-publico';

const user = {
  id: 'u-1',
  correo: 'est@unipacifico.edu.co',
  nombre: 'Ana',
  numeroIdentificacion: '1098765432',
  passwordHash: '$argon2id$ejemplo',
  tokenVersion: 3,
  proveedorAuth: 'google',
  proveedorId: 'idp-interno',
  semestre: 5,
  rol: 'ESTUDIANTE',
  aceptoDatosAt: new Date(),
  createdAt: new Date(),
} as User;

describe('serialización pública de usuarios', () => {
  test('la sesión no incluye secretos ni PII administrativa', () => {
    const dto = toUsuarioSesion(user);
    expect(dto).toEqual({
      id: 'u-1',
      correo: 'est@unipacifico.edu.co',
      nombre: 'Ana',
      semestre: 5,
      rol: 'ESTUDIANTE',
    });
    expect(respuestaUsuarioSinSecretos(dto)).toBe(true);
    expect(dto).not.toHaveProperty('proveedorId');
    expect(dto).not.toHaveProperty('numeroIdentificacion');
    expect(dto).not.toHaveProperty('aceptoDatosAt');
  });

  test('el admin recibe solo los datos operativos necesarios, nunca campos internos', () => {
    const dto = toUsuarioAdmin(user);
    expect(dto).toMatchObject({
      id: 'u-1',
      numeroIdentificacion: '1098765432',
    });
    expect(respuestaUsuarioSinSecretos(dto)).toBe(true);
    expect(dto).not.toHaveProperty('proveedorId');
    expect(dto).not.toHaveProperty('passwordHash');
    expect(dto).not.toHaveProperty('tokenVersion');
    expect(dto).not.toHaveProperty('proveedorAuth');
    expect(dto).not.toHaveProperty('aceptoDatosAt');
    expect(dto).not.toHaveProperty('createdAt');
  });
});
