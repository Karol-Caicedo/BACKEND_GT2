import { User, Rol } from './user.entity';

/** Campos de sesión que Angular usa en perfil y guards. */
export type UsuarioSesionPublico = {
  id: string;
  correo: string;
  nombre: string;
  semestre: number;
  rol: Rol;
};

/** Campos que el panel admin necesita para listar y editar usuarios. */
export type UsuarioAdminPublico = UsuarioSesionPublico & {
  numeroIdentificacion: string | null;
};

const CAMPOS_SECRETOS = ['passwordHash', 'tokenVersion', 'proveedorId'] as const;

/** Perfil del usuario autenticado: sin hashes, versiones de token ni IDs de IdP. */
export function toUsuarioSesion(u: User): UsuarioSesionPublico {
  return {
    id: u.id,
    correo: u.correo,
    nombre: u.nombre,
    semestre: u.semestre,
    rol: u.rol,
  };
}

/** Respuesta administrativa: PII operativa, nunca secretos de autenticación. */
export function toUsuarioAdmin(u: User): UsuarioAdminPublico {
  return {
    ...toUsuarioSesion(u),
    numeroIdentificacion: u.numeroIdentificacion ?? null,
  };
}

export function respuestaUsuarioSinSecretos(obj: Record<string, unknown>): boolean {
  return CAMPOS_SECRETOS.every((campo) => !Object.prototype.hasOwnProperty.call(obj, campo));
}
