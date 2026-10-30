/**
 * Integración contra Postgres real (BD aislada `intereses_db_test`).
 * Verifica flujos completos y restricciones de BD que los mocks no cubren:
 * unicidad (usuario, periodo), agregaciones del dashboard, filtrado de
 * capacitaciones por semestre/vigencia y el cron de recordatorios E2E.
 */
import { DataSource, Repository } from 'typeorm';
import { ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { ensureTestDatabase, createTestDataSource, assertTestDatabase, truncateAll } from './test-db';
import { User } from '../modules/users/user.entity';
import { Periodo } from '../modules/periodos/periodo.entity';
import { Tema } from '../modules/temas/tema.entity';
import { Respuesta, RespuestaTema } from '../modules/encuestas/respuesta.entity';
import { Capacitacion, CapacitacionSemestre } from '../modules/capacitaciones/capacitacion.entity';
import { ClicCapacitacion } from '../modules/capacitaciones/clic.entity';
import { RecordatorioEnviado } from '../modules/recordatorios/recordatorio.entity';
import { PasswordReset } from '../modules/auth/password-reset.entity';
import { SsoCode } from '../modules/auth/sso-code.entity';
import { hashSsoCode } from '../modules/auth/sso-code.util';
import { ResendService } from '../modules/mail/resend.service';
import { UsersService } from '../modules/users/users.service';
import { AuthService } from '../modules/auth/auth.service';
import { EncuestasService } from '../modules/encuestas/encuestas.service';
import { CapacitacionesService } from '../modules/capacitaciones/capacitaciones.service';
import { DashboardService } from '../modules/dashboard/dashboard.service';
import { RecordatoriosService } from '../modules/recordatorios/recordatorios.service';
import { PeriodosService } from '../modules/periodos/periodos.service';
import { EncuestasAsignaturasService } from '../modules/encuestas-asignaturas/encuestas-asignaturas.service';
import { RespuestaAsignatura, RespuestaAsignaturaItem } from '../modules/encuestas-asignaturas/respuesta-asignatura.entity';
import { InscripcionAsignatura } from '../modules/encuestas-asignaturas/inscripcion-asignatura.entity';
import { Asignatura } from '../modules/asignaturas/asignatura.entity';
import { TemasService } from '../modules/temas/temas.service';
import { MailService } from '../modules/mail/mail.service';

jest.setTimeout(60000);

let ds: DataSource;
let R: {
  user: Repository<User>;
  periodo: Repository<Periodo>;
  tema: Repository<Tema>;
  resp: Repository<Respuesta>;
  rt: Repository<RespuestaTema>;
  cap: Repository<Capacitacion>;
  sem: Repository<CapacitacionSemestre>;
  clic: Repository<ClicCapacitacion>;
  rec: Repository<RecordatorioEnviado>;
  resets: Repository<PasswordReset>;
  sso: Repository<SsoCode>;
  respAsig: Repository<RespuestaAsignatura>;
  respItems: Repository<RespuestaAsignaturaItem>;
  inscripciones: Repository<InscripcionAsignatura>;
  asig: Repository<Asignatura>;
};
let auth: AuthService;
let enc: EncuestasService;
let caps: CapacitacionesService;
let dash: DashboardService;
let recs: RecordatoriosService;
let periodos: PeriodosService;
let temasSvc: TemasService;
let asigSvc: EncuestasAsignaturasService;

const hace = (dias: number) => new Date(Date.now() - dias * 86400000).toISOString().slice(0, 10);

beforeAll(async () => {
  jest.spyOn(console, 'log').mockImplementation(() => undefined);
  await ensureTestDatabase();
  ds = createTestDataSource();
  await ds.initialize();
  await assertTestDatabase(ds);
  await ds.synchronize();
  R = {
    user: ds.getRepository(User),
    periodo: ds.getRepository(Periodo),
    tema: ds.getRepository(Tema),
    resp: ds.getRepository(Respuesta),
    rt: ds.getRepository(RespuestaTema),
    cap: ds.getRepository(Capacitacion),
    sem: ds.getRepository(CapacitacionSemestre),
    clic: ds.getRepository(ClicCapacitacion),
    rec: ds.getRepository(RecordatorioEnviado),
    resets: ds.getRepository(PasswordReset),
    sso: ds.getRepository(SsoCode),
    respAsig: ds.getRepository(RespuestaAsignatura),
    respItems: ds.getRepository(RespuestaAsignaturaItem),
    inscripciones: ds.getRepository(InscripcionAsignatura),
    asig: ds.getRepository(Asignatura),
  };
  const config = new ConfigService({ ALLOWED_EMAIL_DOMAIN: '@unipacifico.edu.co', AUTH_SSO_ENABLED: 'false' });
  const jwt = new JwtService({ secret: 'test-secret' });
  const usersSvc = new UsersService(R.user);
  const resetsRepo = ds.getRepository(PasswordReset);
  auth = new AuthService(usersSvc as never, jwt, config, resetsRepo as never, R.sso as never, new ResendService(new ConfigService({})));
  enc = new EncuestasService(R.resp as never, R.rt as never, R.tema as never, R.periodo as never, R.user as never, ds);
  caps = new CapacitacionesService(R.cap as never, R.sem as never, R.clic as never, ds);
  dash = new DashboardService(R.resp as never, R.rt as never, R.tema as never, R.periodo as never, R.user as never, caps);
  recs = new RecordatoriosService(R.rec as never, R.periodo as never, R.user as never, R.resp as never, new MailService(new ConfigService({})));
  periodos = new PeriodosService(R.periodo as never, ds);
  temasSvc = new TemasService(R.tema as never);
  asigSvc = new EncuestasAsignaturasService(
    R.respAsig as never,
    R.respItems as never,
    R.inscripciones as never,
    R.asig as never,
    R.periodo as never,
    R.user as never,
    periodos,
    ds,
  );
});

afterAll(async () => {
  await ds?.destroy();
  (console.log as jest.Mock).mockRestore();
});

beforeEach(async () => {
  await truncateAll(ds);
});

async function crearTemas(nombres: string[]) {
  return Promise.all(nombres.map((nombre) => temasSvc.crear({ nombre })));
}

/** DataSource real con fallo inyectado al guardar una entidad concreta. */
function dataSourceConFallo(ds: DataSource, entidad: unknown): DataSource {
  const transaction = ((cb: (manager: unknown) => unknown) =>
    ds.transaction(async (manager) => {
      const original = manager.getRepository.bind(manager);
      const managerConFallo = new Proxy(manager, {
        get(target, prop) {
          if (prop === 'getRepository') {
            return (e: unknown) => {
              const repo = original(e as never);
              if (e !== entidad) return repo;
              return new Proxy(repo, {
                get(r, p) {
                  if (p === 'save') return async () => { throw new Error('fallo inyectado'); };
                  const valor = Reflect.get(r, p, r);
                  return typeof valor === 'function' ? valor.bind(r) : valor;
                },
              });
            };
          }
          const valor = Reflect.get(target, prop, target);
          return typeof valor === 'function' ? valor.bind(target) : valor;
        },
      });
      return cb(managerConFallo);
    })) as DataSource['transaction'];
  return { transaction } as unknown as DataSource;
}

async function registrar(correo: string, semestre = 4) {
  const r = await auth.register({ correo, nombre: 'Test', password: 'Clave1234', semestre, aceptoDatos: true });
  return R.user.findOneByOrFail({ correo: correo.toLowerCase() }).then((u) => ({ token: r.access_token, user: u }));
}

describe('Auth E2E', () => {
  test('registro → login → me → cambio de semestre', async () => {
    const { token, user } = await registrar('flujo@unipacifico.edu.co', 4);
    expect(token).toBeTruthy();
    const login = await auth.login('flujo@unipacifico.edu.co', 'Clave1234');
    expect(login).toEqual({ access_token: expect.any(String) });
    const me = await auth.me(user.id);
    expect(me).not.toHaveProperty('passwordHash');
    expect(me).not.toHaveProperty('tokenVersion');
    expect(me).not.toHaveProperty('proveedorId');
    expect(me).toEqual({
      id: user.id,
      correo: user.correo,
      nombre: user.nombre,
      semestre: user.semestre,
      rol: user.rol,
    });
    await expect(auth.login('flujo@unipacifico.edu.co', 'mala-clave')).rejects.toThrow('Credenciales inválidas');
    await expect(auth.actualizarMiSemestre(user.id, 10)).rejects.toThrow('Semestre inválido');
    const actualizado = await auth.actualizarMiSemestre(user.id, 6);
    expect(actualizado).toHaveProperty('semestre', 6);
  });

  test('dominio externo y duplicados se rechazan', async () => {
    await expect(registrar('x@gmail.com')).rejects.toThrow('institucional');
    await registrar('unico@unipacifico.edu.co');
    await expect(registrar('UNICO@unipacifico.edu.co')).rejects.toThrow('ya está registrado');
  });

  test('SSO: temporal → completar → login con clave imposible', async () => {
    const r = await auth.loginSso({ correo: 'sso@unipacifico.edu.co', nombre: 'SSO', proveedorId: 'g-1' }, 'google');
    expect(r.necesitaCompletar).toBe(true);
    await auth.completarSso((r as { temp: string }).temp, { semestre: 2, aceptoDatos: true });
    // Sin password: el login local queda bloqueado
    await expect(auth.login('sso@unipacifico.edu.co', 'cualquiera')).rejects.toThrow('Credenciales inválidas');
    const r2 = await auth.loginSso({ correo: 'sso@unipacifico.edu.co', nombre: 'SSO', proveedorId: 'g-1' }, 'google');
    expect(r2.necesitaCompletar).toBe(false);
  });

  test('SSO H-01: código hasheado, un solo uso, vencimiento y sesión emitida en exchange', async () => {
    const perfil = { correo: 'sso-code@unipacifico.edu.co', nombre: 'SSO Code', proveedorId: 'g-9' };
    const codigo = await auth.crearCodigoSso(perfil, 'google');
    const fila = await R.sso.findOneByOrFail({ codigoHash: hashSsoCode(codigo) });
    expect(fila.codigoHash).toHaveLength(64);
    expect(fila.codigoHash).not.toBe(codigo);
    expect(fila.datos).toMatchObject({ correo: perfil.correo, proveedor: 'google' });

    const r = await auth.intercambiarCodigoSso(codigo);
    expect(r.necesitaCompletar).toBe(true);
    await expect(auth.intercambiarCodigoSso(codigo)).rejects.toThrow(/inválido/);
    await auth.completarSso((r as { temp: string }).temp, { semestre: 2, aceptoDatos: true });

    const codigoExistente = await auth.crearCodigoSso(perfil, 'google');
    const sesion = await auth.intercambiarCodigoSso(codigoExistente);
    expect(sesion.necesitaCompletar).toBe(false);
    expect((sesion as { access_token: string }).access_token).toBeTruthy();
    expect(sesion).not.toHaveProperty('user');

    const vencido = await auth.crearCodigoSso({ ...perfil, correo: 'sso-vencido@unipacifico.edu.co' }, 'google');
    const filaVencida = await R.sso.findOneByOrFail({ codigoHash: hashSsoCode(vencido) });
    await R.sso.update({ id: filaVencida.id }, { expiraAt: new Date(Date.now() - 1000) });
    await expect(auth.intercambiarCodigoSso(vencido)).rejects.toThrow(/inválido/);
  });
});

describe('Encuesta E2E (modo selección)', () => {
  test('responder → ver → editar; duplicado y restricción única de BD', async () => {
    await periodos.create({ nombre: '2026-1', fechaInicio: hace(10), fechaFin: hace(-100), activo: true, modoEncuesta: 'seleccion' });
    const ts = await crearTemas(['IA', 'Nube', 'Seguridad', 'Datos', 'Web', 'Móvil']);
    const { user } = await registrar('enc@unipacifico.edu.co', 4);

    const alea1 = await enc.temasAleatorios(user.id, (await periodos.activo())!.id);
    const alea2 = await enc.temasAleatorios(user.id, (await periodos.activo())!.id);
    expect(alea1.map((t) => t.id).sort()).toEqual(ts.map((t) => t.id).sort());
    expect(alea1.map((t) => t.id)).toEqual(alea2.map((t) => t.id));

    const creada = await enc.responder(user.id, {
      items: ts.slice(0, 3).map((t) => ({ temaId: t.id })),
    });
    expect(creada).toMatchObject({ semestreAlResponder: 4 });

    await expect(enc.responder(user.id, { items: [{ temaId: ts[0].id }] })).rejects.toThrow('Ya respondiste');

    // La unicidad también está blindada a nivel de BD
    await expect(
      R.resp.save(R.resp.create({ usuarioId: user.id, periodoId: (await periodos.activo())!.id, semestreAlResponder: 4 })),
    ).rejects.toThrow();

    // El histórico conserva el semestre original aunque el usuario cambie
    await auth.actualizarMiSemestre(user.id, 5);
    const editada = await enc.editar(user.id, { items: [{ temaId: ts[3].id }, { temaId: ts[4].id }] });
    expect(editada).toMatchObject({ semestreAlResponder: 4 });
    expect((editada!.temas as RespuestaTema[])).toHaveLength(2);
  });
});

describe('Encuesta E2E (modo calificación)', () => {
  test('puntajes con fronteras y rechazo de 0', async () => {
    await periodos.create({ nombre: '2026-2', fechaInicio: hace(5), fechaFin: hace(-100), activo: true, modoEncuesta: 'calificacion' });
    const ts = await crearTemas(['A', 'B', 'C']);
    const { user } = await registrar('cal@unipacifico.edu.co', 2);
    await expect(enc.responder(user.id, { items: [{ temaId: ts[0].id, puntaje: 0 }] })).rejects.toThrow('1 a 5');
    const r = await enc.responder(user.id, {
      items: [
        { temaId: ts[0].id, puntaje: 1 },
        { temaId: ts[1].id, puntaje: 5 },
      ],
    });
    expect(r!.temasDetalle).toHaveLength(2);
    const top = await dash.topTemas();
    expect(top.modo).toBe('calificacion');
    expect(top.items.find((i) => i.nombre === 'A')).toMatchObject({ valor: 1 });
    expect(top.items.find((i) => i.nombre === 'B')).toMatchObject({ valor: 5 });
  });
});

describe('Atomicidad E2E (rollback real)', () => {
  test('si falla respuesta_temas no queda una respuesta huérfana', async () => {
    await periodos.create({ nombre: '2026-1', fechaInicio: hace(10), fechaFin: hace(-100), activo: true, modoEncuesta: 'seleccion' });
    const [tema] = await crearTemas(['Tema atómico']);
    const { user } = await registrar('rollback-enc@unipacifico.edu.co', 4);
    const encFallido = new EncuestasService(R.resp as never, R.rt as never, R.tema as never, R.periodo as never, R.user as never, dataSourceConFallo(ds, RespuestaTema));

    await expect(encFallido.responder(user.id, { items: [{ temaId: tema.id }] })).rejects.toThrow('fallo inyectado');

    await expect(R.resp.count()).resolves.toBe(0);
    await expect(R.rt.count()).resolves.toBe(0);
  });
});

describe('Encuesta de asignaturas E2E (transacciones)', () => {
  async function contexto(correo: string) {
    const periodo = await periodos.create({
      nombre: '2026-1',
      fechaInicio: hace(10),
      fechaFin: hace(-100),
      activo: true,
      encuestaAsignaturasActiva: true,
      fechaInicioAsignaturas: hace(1),
      fechaFinAsignaturas: hace(-10),
    });
    const [a1, a2] = await Promise.all([
      R.asig.save(R.asig.create({ nombre: 'Asignatura A', semestre: 4, activo: true })),
      R.asig.save(R.asig.create({ nombre: 'Asignatura B', semestre: 4, activo: true })),
    ]);
    const { user } = await registrar(correo, 4);
    return { periodo, a1, a2, user };
  }

  test('guardarInscripciones reemplaza el conjunto completo', async () => {
    const { periodo, a1, a2, user } = await contexto('asig-ok@unipacifico.edu.co');
    await R.inscripciones.save(R.inscripciones.create({ usuarioId: user.id, periodoId: periodo.id, asignaturaId: a1.id }));

    const estado = await asigSvc.guardarInscripciones(user.id, { asignaturaIds: [a2.id] });

    expect(estado.inscripcionIds).toEqual([a2.id]);
    const filas = await R.inscripciones.find();
    expect(filas).toHaveLength(1);
    expect(filas[0].asignaturaId).toBe(a2.id);
  });

  test('si falla el guardado de inscripciones se restauran las anteriores', async () => {
    const { periodo, a1, a2, user } = await contexto('asig-rollback@unipacifico.edu.co');
    await R.inscripciones.save(R.inscripciones.create({ usuarioId: user.id, periodoId: periodo.id, asignaturaId: a1.id }));
    const svcFallido = new EncuestasAsignaturasService(
      R.respAsig as never, R.respItems as never, R.inscripciones as never, R.asig as never,
      R.periodo as never, R.user as never, periodos, dataSourceConFallo(ds, InscripcionAsignatura),
    );

    await expect(svcFallido.guardarInscripciones(user.id, { asignaturaIds: [a2.id] })).rejects.toThrow('fallo inyectado');

    const filas = await R.inscripciones.find();
    expect(filas).toHaveLength(1);
    expect(filas[0].asignaturaId).toBe(a1.id);
  });

  test('responder guarda inscripciones faltantes, respuesta e ítems', async () => {
    const { a1, user } = await contexto('asig-resp@unipacifico.edu.co');

    const r = await asigSvc.responder(user.id, {
      items: [{ asignaturaId: a1.id, tieneDificultad: true, nivelSatisfaccion: 3 }],
    });

    expect(r).toMatchObject({ semestreAlResponder: 4 });
    expect(r?.items).toHaveLength(1);
    expect(r?.items[0]).toMatchObject({ asignaturaId: a1.id, nivelSatisfaccion: 3 });
    expect(await R.inscripciones.count()).toBe(1);
    expect(await R.respAsig.count()).toBe(1);
    expect(await R.respItems.count()).toBe(1);
  });

  test('si fallan los ítems se revierten inscripción, respuesta e ítems', async () => {
    const { a1, user } = await contexto('asig-resp-rollback@unipacifico.edu.co');
    const svcFallido = new EncuestasAsignaturasService(
      R.respAsig as never, R.respItems as never, R.inscripciones as never, R.asig as never,
      R.periodo as never, R.user as never, periodos, dataSourceConFallo(ds, RespuestaAsignaturaItem),
    );

    await expect(svcFallido.responder(user.id, {
      items: [{ asignaturaId: a1.id, tieneDificultad: false, nivelSatisfaccion: 5 }],
    })).rejects.toThrow('fallo inyectado');

    expect(await R.inscripciones.count()).toBe(0);
    expect(await R.respAsig.count()).toBe(0);
    expect(await R.respItems.count()).toBe(0);
  });
});

describe('Capacitaciones E2E (transacciones)', () => {
  test('si fallan los semestres no queda una capacitación huérfana', async () => {
    const creador = await registrar('cap-rollback@unipacifico.edu.co', 1);
    const svcFallido = new CapacitacionesService(
      R.cap as never, R.sem as never, R.clic as never, dataSourceConFallo(ds, CapacitacionSemestre),
    );

    await expect(svcFallido.crear(
      { titulo: 'Fallida', descripcion: 'D', enlace: 'https://x.co', estado: 'publicado', semestres: [4] },
      null,
      creador.user.id,
    )).rejects.toThrow('fallo inyectado');

    expect(await R.cap.count()).toBe(0);
    expect(await R.sem.count()).toBe(0);
  });

  test('si fallan los semestres se revierten la edición y el borrado previo', async () => {
    const creador = await registrar('cap-edit-rollback@unipacifico.edu.co', 1);
    const original = await caps.crear(
      { titulo: 'Original', descripcion: 'D', enlace: 'https://x.co', estado: 'publicado', semestres: [4] },
      null,
      creador.user.id,
    );
    const svcFallido = new CapacitacionesService(
      R.cap as never, R.sem as never, R.clic as never, dataSourceConFallo(ds, CapacitacionSemestre),
    );

    await expect(svcFallido.actualizar(original.id, { titulo: 'Nuevo', semestres: [5] } as never)).rejects.toThrow('fallo inyectado');

    const cap = await R.cap.findOneByOrFail({ id: original.id });
    const sems = await R.sem.find({ where: { capacitacionId: original.id } });
    expect(cap.titulo).toBe('Original');
    expect(sems.map((s) => s.semestre)).toEqual([4]);
  });
});

describe('Periodo activo único E2E', () => {
  test('crear un periodo activo desactiva el anterior', async () => {
    const p1 = await periodos.create({ nombre: '2026-1', fechaInicio: hace(10), fechaFin: hace(-100), activo: true });
    const p2 = await periodos.create({ nombre: '2026-2', fechaInicio: hace(5), fechaFin: hace(-80), activo: true });

    expect((await R.periodo.findOneByOrFail({ id: p1.id })).activo).toBe(false);
    expect((await R.periodo.findOneByOrFail({ id: p2.id })).activo).toBe(true);
    expect(await R.periodo.count({ where: { activo: true } })).toBe(1);
  });

  test('editar un periodo para activarlo desactiva el anterior', async () => {
    const p1 = await periodos.create({ nombre: '2026-1', fechaInicio: hace(10), fechaFin: hace(-100), activo: true });
    const p2 = await periodos.create({ nombre: '2026-2', fechaInicio: hace(5), fechaFin: hace(-80), activo: false });

    const editado = await periodos.update(p2.id, {
      nombre: '2026-2', fechaInicio: hace(5), fechaFin: hace(-80), activo: true,
    });

    expect(editado.activo).toBe(true);
    expect((await R.periodo.findOneByOrFail({ id: p1.id })).activo).toBe(false);
    expect(await R.periodo.count({ where: { activo: true } })).toBe(1);
  });

  test('la BD rechaza un segundo activo aunque se salte el servicio', async () => {
    await periodos.create({ nombre: '2026-1', fechaInicio: hace(10), fechaFin: hace(-100), activo: true });

    await expect(R.periodo.save(R.periodo.create({
      nombre: '2026-2', fechaInicio: hace(5), fechaFin: hace(-80), activo: true,
    }))).rejects.toThrow();

    expect(await R.periodo.count({ where: { activo: true } })).toBe(1);
  });

  test('un activador concurrente recibe 409 y no deja cero activos', async () => {
    const p1 = await periodos.create({ nombre: '2026-1', fechaInicio: hace(10), fechaFin: hace(-100), activo: true });
    const p2 = await periodos.create({ nombre: '2026-2', fechaInicio: hace(5), fechaFin: hace(-80), activo: false });

    let liberar!: () => void;
    let tomado!: () => void;
    const soltar = new Promise<void>((r) => { liberar = r; });
    const bloqueado = new Promise<void>((r) => { tomado = r; });
    const holder = ds.transaction(async (manager) => {
      await manager.query('SELECT id FROM periodos FOR UPDATE');
      tomado();
      await soltar;
    });
    await bloqueado;

    try {
      await expect(periodos.activar(p2.id)).rejects.toThrow(ConflictException);
    } finally {
      liberar();
      await holder;
    }

    expect((await R.periodo.findOneByOrFail({ id: p1.id })).activo).toBe(true);
    expect((await R.periodo.findOneByOrFail({ id: p2.id })).activo).toBe(false);
    expect(await R.periodo.count({ where: { activo: true } })).toBe(1);
  });
});

describe('Dashboard E2E (agregados reales)', () => {
  test('top, heatmap, tasa, comparativo, declarado-vs-real y resumen', async () => {
    const p1 = await periodos.create({ nombre: '2026-1', fechaInicio: hace(60), fechaFin: hace(-30), activo: true, modoEncuesta: 'seleccion' });
    const [ia, nube, datos] = await crearTemas(['IA', 'Nube', 'Datos']);
    const a = await registrar('a@unipacifico.edu.co', 4);
    const b = await registrar('b@unipacifico.edu.co', 4);
    await registrar('c@unipacifico.edu.co', 7); // no responde

    await enc.responder(a.user.id, { items: [{ temaId: ia.id }, { temaId: nube.id }] });
    await enc.responder(b.user.id, { items: [{ temaId: ia.id }] });

    const top = await dash.topTemas(p1.id);
    expect(top.items[0]).toMatchObject({ nombre: 'IA', valor: 2 });
    expect(top.items.find((i) => i.nombre === 'Nube')).toMatchObject({ valor: 1 });

    const sem4 = await dash.topTemas(p1.id, 4);
    expect(sem4.items).toHaveLength(2);
    const sem7 = await dash.topTemas(p1.id, 7);
    expect(sem7.items).toHaveLength(0);

    const heat = await dash.heatmap(p1.id);
    expect(heat.matriz['IA']).toMatchObject({ 4: 2 });

    const tasa = await dash.tasaRespuesta(p1.id);
    const s4 = tasa.porSemestre.find((s) => s.semestre === 4)!;
    expect(s4).toMatchObject({ respondieron: 2, total: 2, tasa: 1 });
    expect(tasa.porSemestre.find((s) => s.semestre === 7)).toMatchObject({ respondieron: 0, total: 1, tasa: 0 });
    expect(tasa.totalRespuestas).toBe(2);

    // Segundo periodo para el comparativo
    const p2 = await periodos.create({ nombre: '2026-2', fechaInicio: hace(5), fechaFin: hace(-100), activo: false, modoEncuesta: 'seleccion' });
    await periodos.activar(p2.id);
    await enc.responder(a.user.id, { items: [{ temaId: nube.id }] });
    const serie = await dash.comparativo(ia.id);
    expect(serie).toEqual([
      { periodo: '2026-1', valor: 2, modo: 'seleccion' },
      { periodo: '2026-2', valor: 0, modo: 'seleccion' },
    ]);
    const serieNube = await dash.comparativo(nube.id);
    expect(serieNube.map((s) => s.valor)).toEqual([1, 1]);

    // Declarado vs real: capacitación ligada a IA con 2 clics
    const cap = await caps.crear(
      { titulo: 'Taller IA', descripcion: 'D', enlace: 'https://x.co/ia', temaId: ia.id, estado: 'publicado', semestres: [4] },
      null,
      a.user.id,
    );
    await caps.registrarClic(cap.id, { id: a.user.id, rol: 'ESTUDIANTE', semestre: 4 });
    await caps.registrarClic(cap.id, { id: b.user.id, rol: 'ESTUDIANTE', semestre: 4 });
    const dvr = await dash.declaradoVsReal(p1.id);
    expect(dvr.items.find((i) => i.nombre === 'IA')).toMatchObject({ declarado: 2, clics: 2 });
    expect(dvr.items.find((i) => i.nombre === 'Datos')).toMatchObject({ declarado: 0, clics: 0 });

    const resumen = await dash.resumen(p1.id);
    expect(resumen).toMatchObject({ totalRespuestas: 2, top1: { nombre: 'IA', valor: 2 } });

    await expect(dash.topTemas('123e4567-e89b-12d3-a456-426614174000')).rejects.toThrow('Periodo no encontrado');
  });

  test('sin periodo activo → 400 en todos los endpoints', async () => {
    await expect(dash.topTemas()).rejects.toThrow('No hay periodo activo');
    await expect(dash.tasaRespuesta()).rejects.toThrow('No hay periodo activo');
  });
});

describe('Capacitaciones E2E (filtrado por semestre y vigencia)', () => {
  let creadorId = '';
  beforeEach(async () => {
    creadorId = (await registrar('creador@unipacifico.edu.co', 1)).user.id;
  });
  async function crear(opts: Record<string, unknown>) {
    return caps.crear(
      { titulo: 'T', descripcion: 'D', enlace: 'https://x.co', estado: 'publicado', ...opts } as never,
      null,
      creadorId,
    );
  }

  test('mias solo trae publicadas, vigentes y de mi semestre', async () => {
    const ok = await crear({ titulo: 'Para S4', semestres: [4, 5] });
    await crear({ titulo: 'Borrador', estado: 'borrador', semestres: [4] });
    await crear({ titulo: 'Otra sem', semestres: [9] });
    await crear({ titulo: 'Vencida', semestres: [4], visibleHasta: new Date(Date.now() - 86400000).toISOString() });
    await crear({ titulo: 'Futura', semestres: [4], visibleDesde: new Date(Date.now() + 86400000).toISOString() });

    const mias4 = await caps.mias(4);
    expect(mias4.map((c) => c.titulo)).toEqual(['Para S4']);
    const mias9 = await caps.mias(9);
    expect(mias9.map((c) => c.titulo)).toEqual(['Otra sem']);

    const dest = await caps.destinatarios(ok.id);
    expect(dest).toEqual([]);

    const alumno4 = await registrar('alumno4@unipacifico.edu.co', 4);
    const clic = await caps.registrarClic(ok.id, { id: alumno4.user.id, rol: 'ESTUDIANTE', semestre: 4 });
    expect(clic).toEqual({ enlace: 'https://x.co' });
    await expect(caps.detalle(ok.id)).resolves.toMatchObject({ clics: 1 });

    const { user } = await registrar('dest@unipacifico.edu.co', 5);
    expect(await caps.destinatarios(ok.id)).toEqual([
      'alumno4@unipacifico.edu.co',
      'dest@unipacifico.edu.co',
    ]);
    void user;
  });
});

describe('Recordatorios E2E (cron día 7 y 14, máx 2, sin duplicar)', () => {
  test('flujo completo con respondedores y topes', async () => {
    await periodos.create({ nombre: '2026-1', fechaInicio: hace(8), fechaFin: hace(-100), activo: true, modoEncuesta: 'seleccion' });
    await crearTemas(['T1', 'T2']);
    const pendiente = await registrar('pend@unipacifico.edu.co', 3);
    const responde = await registrar('resp@unipacifico.edu.co', 3);
    const p = (await periodos.activo())!;
    await enc.responder(responde.user.id, { items: [{ temaId: (await temasSvc.activos())[0].id }] });

    // Día 8: solo el pendiente recibe el #1
    await expect(recs.cronDiario()).resolves.toEqual({ enviados: 1 });
    let filas = await R.rec.find();
    expect(filas).toHaveLength(1);
    expect(filas[0]).toMatchObject({ usuarioId: pendiente.user.id, periodoId: p.id, numero: 1 });

    // Re-corrida mismo ciclo: nada nuevo
    await expect(recs.cronDiario()).resolves.toEqual({ enviados: 0 });

    // Día 16: llega el #2
    await R.periodo.update(p.id, { fechaInicio: hace(16) } as never);
    await expect(recs.cronDiario()).resolves.toEqual({ enviados: 1 });
    expect((await R.rec.find()).map((r) => r.numero).sort()).toEqual([1, 2]);

    // Tope de 2: silencio total desde aquí
    await expect(recs.cronDiario()).resolves.toEqual({ enviados: 0 });

    // El pendiente responde → la tasa posterior lo refleja
    await enc.responder(pendiente.user.id, { items: [{ temaId: (await temasSvc.activos())[1].id }] });
    const resumen = await recs.resumen(p.id);
    expect(resumen).toMatchObject({ total: 2, porNumero: { 1: 1, 2: 1 }, recordados: 1, respondieronDespues: 1, tasaPosterior: 1 });
  });

  test('periodo recién abierto (día 2): nadie recibe nada', async () => {
    await periodos.create({ nombre: '2026-1', fechaInicio: hace(2), fechaFin: hace(-100), activo: true, modoEncuesta: 'seleccion' });
    await registrar('nuevo@unipacifico.edu.co', 1);
    await expect(recs.cronDiario()).resolves.toEqual({ enviados: 0 });
    expect(await R.rec.count()).toBe(0);
  });
});

describe('Recuperación de contraseña E2E', () => {
  test('solicitar → restablecer → login con nueva clave; token de un solo uso', async () => {
    const { user } = await registrar('recup@unipacifico.edu.co', 3);

    await expect(auth.solicitarRecuperacion('recup@unipacifico.edu.co')).resolves.toHaveProperty('mensaje');
    let filas = await R.resets.find({ where: { usuarioId: user.id } });
    expect(filas).toHaveLength(1);
    expect(filas[0].usadoAt).toBeNull();
    expect(filas[0].expiraAt.getTime()).toBeGreaterThan(Date.now());

    // Segunda solicitud invalida la anterior
    await auth.solicitarRecuperacion('recup@unipacifico.edu.co');
    filas = await R.resets.find({ where: { usuarioId: user.id } });
    expect(filas).toHaveLength(2);

    // Fijo un token conocido sobre la fila vigente para probar el consumo
    const vigente = filas.find((f) => !f.usadoAt)!;
    vigente.tokenHash = AuthService.hashToken('mi-token-secreto-123456789');
    await R.resets.save(vigente);

    await expect(auth.restablecerClave('mi-token-secreto-123456789', 'NuevaClave99')).resolves.toHaveProperty('mensaje');
    await expect(auth.login('recup@unipacifico.edu.co', 'NuevaClave99')).resolves.toHaveProperty('access_token');
    await expect(auth.login('recup@unipacifico.edu.co', 'Clave1234')).rejects.toThrow('Credenciales inválidas');
    await expect(auth.restablecerClave('mi-token-secreto-123456789', 'OtraClave99')).rejects.toThrow(/inválido o ya venció/);
  });

  test('correo inexistente responde igual sin crear tokens', async () => {
    await expect(auth.solicitarRecuperacion('fantasma@unipacifico.edu.co')).resolves.toHaveProperty('mensaje');
    expect(await R.resets.count()).toBe(0);
  });
});
