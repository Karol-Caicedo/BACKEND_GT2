import { ExecutionContext } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { AuthController } from '../modules/auth/auth.controller';
import { UsersController } from '../modules/users/users.controller';
import { PeriodosController } from '../modules/periodos/periodos.controller';
import { TemasController } from '../modules/temas/temas.controller';
import { EncuestasController } from '../modules/encuestas/encuestas.controller';
import { CapacitacionesController } from '../modules/capacitaciones/capacitaciones.controller';
import { DashboardController } from '../modules/dashboard/dashboard.controller';
import { DashboardMateriasController } from '../modules/dashboard/dashboard-materias.controller';
import { RecordatoriosController } from '../modules/recordatorios/recordatorios.controller';
import { AsignaturasController } from '../modules/asignaturas/asignaturas.controller';
import { EncuestasAsignaturasController } from '../modules/encuestas-asignaturas/encuestas-asignaturas.controller';
import { UploadsController } from '../modules/uploads/uploads.controller';
import { HealthController } from './health.controller';
import { UnknownRouteController } from './unknown-route.controller';
import { AccessGuard } from './access.guard';
import { AccessLogService } from './access-log.service';
import { AccessPolicyService } from './access-policy.service';
import { Auth } from './auth.decorator';
import { cuerpoError } from './http-error';
import { Public } from './public.decorator';
import { ROLES_KEY } from './roles.decorator';
import { RolesGuard } from './roles.guard';

const CONTROLADORES = [
  AuthController,
  UsersController,
  PeriodosController,
  TemasController,
  EncuestasController,
  CapacitacionesController,
  DashboardController,
  DashboardMateriasController,
  RecordatoriosController,
  AsignaturasController,
  EncuestasAsignaturasController,
  UploadsController,
  HealthController,
  UnknownRouteController,
];

function contexto(tipo = 'http', user?: { rol: string }, handler?: Function, clase?: Function): ExecutionContext {
  return {
    getType: () => tipo,
    getHandler: () => handler ?? (() => undefined),
    getClass: () => clase ?? class {},
    switchToHttp: () => ({ getRequest: () => ({ user, correlationId: 'corr-1234', method: 'GET', path: '/x' }) }),
  } as unknown as ExecutionContext;
}

function policy(mode: 'audit' | 'enforce') {
  return new AccessPolicyService(new ConfigService({ ACCESS_POLICY_MODE: mode }));
}

function log() {
  return { deniedContext: jest.fn(), deniedRequest: jest.fn() } as unknown as AccessLogService;
}

describe('AccessPolicyService', () => {
  test('usa enforce por defecto y audit solo en staging', () => {
    expect(new AccessPolicyService(new ConfigService({})).mode).toBe('enforce');
    expect(new AccessPolicyService(new ConfigService({ NODE_ENV: 'staging' })).mode).toBe('audit');
    expect(new AccessPolicyService(new ConfigService({ NODE_ENV: 'staging', ACCESS_POLICY_MODE: 'enforce' })).mode).toBe('enforce');
    expect(new AccessPolicyService(new ConfigService({ ACCESS_POLICY_MODE: 'otro' })).mode).toBe('enforce');
  });
});

describe('política de acceso fail-closed', () => {
  test('@Public y @Auth escriben metadatos explícitos', () => {
    class Demo {
      @Public()
      publico() {}

      @Auth()
      autenticado() {}

      @Auth('ADMIN')
      admin() {}
    }

    expect(Reflect.getMetadata('access:public', Demo.prototype.publico)).toBe(true);
    expect(Reflect.getMetadata(ROLES_KEY, Demo.prototype.autenticado)).toEqual([]);
    expect(Reflect.getMetadata(ROLES_KEY, Demo.prototype.admin)).toEqual(['ADMIN']);
  });

  test('AccessGuard deniega rutas sin decorador en enforce y las permite en audit', () => {
    const reflector = new Reflector();
    const enforce = new AccessGuard(reflector, policy('enforce'), log());
    const audit = new AccessGuard(reflector, policy('audit'), log());

    class SinDecorar {
      ruta() {}
    }

    const ctx = contexto('http', undefined, SinDecorar.prototype.ruta, SinDecorar);
    expect(enforce.canActivate(ctx)).toBe(false);
    expect(audit.canActivate(ctx)).toBe(true);
  });

  test('AccessGuard permite @Public y rutas con @Auth', () => {
    const guard = new AccessGuard(new Reflector(), policy('enforce'), log());

    class Demo {
      @Public()
      publico() {}

      @Auth('ADMIN')
      admin() {}
    }

    expect(guard.canActivate(contexto('http', undefined, Demo.prototype.publico, Demo))).toBe(true);
    expect(guard.canActivate(contexto('http', undefined, Demo.prototype.admin, Demo))).toBe(true);
  });

  test('AccessGuard falla cerrado en contextos no HTTP', () => {
    const guard = new AccessGuard(new Reflector(), policy('audit'), log());
    expect(guard.canActivate(contexto('ws'))).toBe(false);
  });

  test('RolesGuard deniega rol incorrecto en enforce y lo audita en audit', () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(['ADMIN']) } as unknown as Reflector;
    const logService = log();
    const enforce = new RolesGuard(reflector, policy('enforce'), logService);
    const audit = new RolesGuard(reflector, policy('audit'), logService);

    const ctx = contexto('http', { rol: 'ESTUDIANTE' });
    expect(enforce.canActivate(ctx)).toBe(false);
    expect(audit.canActivate(ctx)).toBe(true);
    expect(logService.deniedContext).toHaveBeenCalled();
  });

  test('cuerpo de error uniforme sin detalles internos', () => {
    expect(cuerpoError(403, 'corr-1')).toEqual({
      statusCode: 403,
      error: 'Forbidden',
      message: 'Acceso denegado',
      correlationId: 'corr-1',
    });
  });
});

describe('cobertura de decoradores de acceso', () => {
  test.each(CONTROLADORES)('%p declara @Public o @Auth en todas sus rutas', (controlador) => {
    const clase = controlador as unknown as { prototype: Record<string, unknown> };
    const rolesClase = Reflect.getMetadata(ROLES_KEY, controlador);
    const publicoClase = Reflect.getMetadata('access:public', controlador) === true;

    for (const nombre of Object.getOwnPropertyNames(clase.prototype)) {
      if (nombre === 'constructor') continue;
      const fn = clase.prototype[nombre];
      if (typeof fn !== 'function') continue;
      if (Reflect.getMetadata(PATH_METADATA, fn) === undefined) continue;
      if (Reflect.getMetadata(METHOD_METADATA, fn) === undefined) continue;

      const publico = Reflect.getMetadata('access:public', fn) === true;
      const roles = Reflect.getMetadata(ROLES_KEY, fn);
      expect({
        controlador: (controlador as { name: string }).name,
        ruta: nombre,
        protegida: publico || publicoClase || roles !== undefined || rolesClase !== undefined,
      }).toEqual({
        controlador: (controlador as { name: string }).name,
        ruta: nombre,
        protegida: true,
      });
    }
  });
});
